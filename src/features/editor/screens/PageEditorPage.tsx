import { CSSProperties, ChangeEvent, Dispatch, PointerEvent as ReactPointerEvent, SetStateAction, TouchEvent, useEffect, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { Link, useBlocker, useNavigate, useParams } from "react-router-dom";
import { DrawingCanvas, DrawingCanvasHandle } from "@/features/drawing/components/DrawingCanvas";
import {
  addFileToPage,
  addImageToPage,
  addShapeNote,
  deletePageElement,
  ensureDrawingLayer,
  getPageEditorBundle,
  replaceDrawingStrokes,
  replaceTextElements,
  updatePageElement,
  updateShapeNote,
} from "@/features/editor/api/editor";
import { BookmarksPanel } from "@/features/editor/components/BookmarksPanel";
import { PageMediaLayer } from "@/features/editor/components/PageMediaLayer";
import { PageFlipControls } from "@/features/editor/components/PageFlipControls";
import { PaperPresetPicker } from "@/features/editor/components/PaperPresetPicker";
import { ShapeInsertLibrary } from "@/features/editor/components/ShapeInsertLibrary";
import { ShapeNoteLayer } from "@/features/editor/components/ShapeNoteLayer";
import { ToolPresetPicker } from "@/features/editor/components/ToolPresetPicker";
import { createEditorSelectionController, removeItemById, replaceItemById } from "@/features/editor/lib/interactionState";
import {
  clearPageDraftSnapshot,
  clearPageRecoveryDraft,
  createPageDraftSnapshot,
  createPageRecoveryDraft,
  PageDraftSnapshot,
  readPageDraftSnapshot,
  readPageRecoveryDraft,
  serializePageRecoveryDraft,
  writePageDraftSnapshot,
  writePageRecoveryDraft,
} from "@/features/editor/lib/pageRecoveryDraft";
import { clampValue, isPointInBounds } from "@/features/editor/lib/transformUtils";
import { useTextTransformController } from "@/features/editor/lib/useTextTransformController";
import { getNotebook } from "@/features/notebooks/api/notebooks";
import { NotebookBinding } from "@/features/notebooks/components/NotebookBinding";
import { createPage, deletePage, getPage, listPages, setPageBookmark, updatePage } from "@/features/pages/api/pages";
import { getStorageRecoveryMessage } from "@/shared/lib/db/storageErrors";
import { getFilesUploadPreflight } from "@/shared/lib/db/storagePreflight";
import { getToolPreset } from "@/shared/config/toolPresets";
import { buildPaperStyle } from "@/shared/lib/paper";
import { DrawingPoint, DrawingStroke, FileAttachmentPageElement, ImagePageElement, Notebook, Page, PageLayout, ShapeNoteElement, TextPageElement } from "@/shared/types/models";
import { PaperPresetId, ToolPresetId, ToolStrokeStyle } from "@/shared/types/presets";
import { createId } from "@/shared/lib/utils/id";
import { Button } from "@/shared/ui/Button";
import { Panel } from "@/shared/ui/Panel";

const layoutOptions: { label: string; value: PageLayout }[] = [
  { label: "Свободный", value: "freeform" },
  { label: "Фокус", value: "focus" },
  { label: "Сплит", value: "split" },
];

const sidebarSections = [
  { id: "inserts", icon: "▣", label: "Вставки" },
  { id: "pens", icon: "✎", label: "Ручки" },
  { id: "art", icon: "◌", label: "Кисти" },
  { id: "paper", icon: "▤", label: "Лист" },
  { id: "bookmarks", icon: "★", label: "Закладки" },
] as const;

type SidebarSectionId = (typeof sidebarSections)[number]["id"];
type RecoveryNotice = {
  source: "snapshot" | "recovery";
  savedAt: string | null;
};

const strokeStyleLabels: Record<ToolStrokeStyle, string> = {
  solid: "гладкий",
  marker: "маркерный",
  dashed: "пунктирный",
  grain: "зернистый",
  eraser: "ластик",
};

const PAGE_DELETE_ANIMATION_MS = 340;
const AUTOSAVE_DELAY_MS = 10 * 60 * 1000;
const PAGE_FLIP_ANIMATION_MS = 460;
const PAGE_FLIP_TOUCH_ZONE_RATIO = 0.28;
const PAGE_FLIP_MIN_GESTURE_MS = 140;
const PAGE_FLIP_RELEASE_THRESHOLD = 0.34;
const TEXT_DRAG_HANDLE_HEIGHT = 18;
const TEXT_BLOCK_MIN_WIDTH = 180;
const TEXT_BLOCK_MIN_HEIGHT = 84;
const TEXT_BLOCK_DEFAULT_WIDTH = 280;
const TEXT_BLOCK_MAX_WIDTH = 520;
const SAVE_STATE_LOADING = "Загрузка";
const SAVE_STATE_PENDING = "Черновик";
const SAVE_STATE_SAVED = "Все изменения сохранены";
const SAVE_STATE_ERROR = "Ошибка сохранения";
const DEFAULT_DRAWING_COLOR = "#111111";
const quickPaletteColors = [DEFAULT_DRAWING_COLOR, "#d7e8ff", "#f8fbff", "#9ed0ff", "#7fffd4", "#d5ff72", "#ffd7b8", "#ff9d8c", "#c9cbc7"];
const PAGE_DRAFT_SYNC_DELAY_MS = 350;

type CaretDocument = Document & {
  caretPositionFromPoint?: (x: number, y: number) => { offset: number } | null;
  caretRangeFromPoint?: (x: number, y: number) => Range | null;
};

function getMaxElementZIndex(
  images: ImagePageElement[],
  files: FileAttachmentPageElement[],
  shapes: ShapeNoteElement[],
) {
  return Math.max(0, ...images.map((item) => item.zIndex), ...files.map((item) => item.zIndex), ...shapes.map((item) => item.zIndex));
}

function isTextTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest("textarea, input, select, [contenteditable='true']"));
}

function isOverlayTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    Boolean(target.closest(".page-media, .shape-note, .editor-text-block, .bookmark-star, .page-corner, .editor-sheet__dock"))
  );
}

function buildEditorTextElement(
  pageId: string,
  source: TextPageElement | null | undefined,
  bindingType?: Notebook["bindingType"],
  defaultColor = DEFAULT_DRAWING_COLOR,
): TextPageElement {
  const defaultLeft = bindingType === "rings" || bindingType === "spiral" ? 72 : 36;
  const now = new Date().toISOString();

  return {
    id: source?.id ?? "draft-text-element",
    pageId,
    type: "text",
    x: source?.x ?? defaultLeft,
    y: source?.y ?? 72,
    width: source?.width ?? TEXT_BLOCK_DEFAULT_WIDTH,
    height: source?.height ?? 180,
    zIndex: source?.zIndex ?? 1,
    createdAt: source?.createdAt ?? now,
    updatedAt: source?.updatedAt ?? now,
    content: source?.content ?? "",
    style: {
      fontSize: source?.style?.fontSize ?? 18,
      lineHeight: source?.style?.lineHeight ?? 1.7,
      color: source?.style?.color ?? defaultColor,
    },
  };
}

function formatRecoverySavedAt(value: string | null) {
  if (!value) {
    return "после перезапуска";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "после перезапуска";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function serializeStrokeDraft(strokes: DrawingStroke[]) {
  return JSON.stringify(strokes);
}

export function PageEditorPage() {
  const { pageId } = useParams();
  const navigate = useNavigate();
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const trashButtonRef = useRef<HTMLButtonElement | null>(null);
  const textInputRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const pendingTextFocusIdRef = useRef<string | null>(null);
  const drawingCanvasRef = useRef<DrawingCanvasHandle | null>(null);
  const sheetPageRef = useRef<HTMLDivElement | null>(null);
  const paletteButtonRef = useRef<HTMLDivElement | null>(null);
  const palettePopoverRef = useRef<HTMLDivElement | null>(null);
  const keyboardPalettePopoverRef = useRef<HTMLDivElement | null>(null);
  const keyboardPaletteInteractionRef = useRef(false);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const touchStartTimeRef = useRef<number | null>(null);
  const hydratedRef = useRef(false);
  const drawingPointerIdRef = useRef<number | null>(null);
  const recentPenInteractionUntilRef = useRef(0);
  const zIndexCounterRef = useRef(1);
  const deleteTimeoutRef = useRef<number | null>(null);
  const saveTimeoutRef = useRef<number | null>(null);
  const draftSnapshotTimeoutRef = useRef<number | null>(null);
  const draftStrokesRef = useRef<DrawingStroke[]>([]);
  const hasPendingStrokeSaveRef = useRef(false);
  const mediaDraftReaderRef = useRef<(() => { images: ImagePageElement[]; files: FileAttachmentPageElement[] }) | null>(null);
  const shapeDraftReaderRef = useRef<(() => ShapeNoteElement[]) | null>(null);
  const lastTextEraseSignatureRef = useRef<string | null>(null);
  const persistedPageSnapshotRef = useRef<string | null>(null);

  const [notebook, setNotebook] = useState<Notebook | null>(null);
  const [page, setPage] = useState<Page | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "missing">("loading");
  const [activeSection, setActiveSection] = useState<SidebarSectionId | null>(null);
  const [title, setTitle] = useState("");
  const [paperType, setPaperType] = useState<PaperPresetId>("lined");
  const [paperColor, setPaperColor] = useState("#f7f2e6");
  const [layout, setLayout] = useState<PageLayout>("freeform");
  const [textElements, setTextElements] = useState<TextPageElement[]>([]);
  const [strokes, setStrokes] = useState<DrawingStroke[]>([]);
  const [images, setImages] = useState<ImagePageElement[]>([]);
  const [files, setFiles] = useState<FileAttachmentPageElement[]>([]);
  const [shapes, setShapes] = useState<ShapeNoteElement[]>([]);
  const [selectedToolId, setSelectedToolId] = useState<ToolPresetId>("ballpoint");
  const [lastDrawingToolId, setLastDrawingToolId] = useState<ToolPresetId>("ballpoint");
  const [toolColor, setToolColor] = useState(DEFAULT_DRAWING_COLOR);
  const [textColor, setTextColor] = useState(DEFAULT_DRAWING_COLOR);
  const [toolWidth, setToolWidth] = useState(2.2);
  const [toolOpacity, setToolOpacity] = useState(0.92);
  const [eraserWidth, setEraserWidth] = useState(16);
  const [saveState, setSaveState] = useState(SAVE_STATE_LOADING);
  const [insertColor, setInsertColor] = useState("#fff1a6");
  const [insertPaperStyle, setInsertPaperStyle] = useState<PaperPresetId>("plain");
  const [insertEdgeStyle, setInsertEdgeStyle] = useState<ShapeNoteElement["edgeStyle"]>("straight");
  const [bookmarkSearchQuery, setBookmarkSearchQuery] = useState("");
  const [flipDirection, setFlipDirection] = useState<"" | "left" | "right">("");
  const [swipePreviewDirection, setSwipePreviewDirection] = useState<"" | "left" | "right">("");
  const [swipePreviewProgress, setSwipePreviewProgress] = useState(0);
  const [swipePreviewOffsetX, setSwipePreviewOffsetX] = useState(0);
  const [isObjectDragging, setIsObjectDragging] = useState(false);
  const [isTrashHover, setIsTrashHover] = useState(false);
  const [activeElementId, setActiveElementId] = useState<string | null>(null);
  const [activeTextElementId, setActiveTextElementId] = useState<string | null>(null);
  const [isDeletingPage, setIsDeletingPage] = useState(false);
  const [pageDeleteOffset, setPageDeleteOffset] = useState({ x: 0, y: 0 });
  const [isKeyboardTextMode, setIsKeyboardTextMode] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [palettePopoverPosition, setPalettePopoverPosition] = useState({ top: 0, left: 0 });
  const [keyboardPaletteBottomOffset, setKeyboardPaletteBottomOffset] = useState(18);
  const [assetStorageError, setAssetStorageError] = useState<string | null>(null);
  const [recoveryNotice, setRecoveryNotice] = useState<RecoveryNotice | null>(null);

  const toolPreset = getToolPreset(selectedToolId);
  const navigationBlocker = useBlocker(({ historyAction }) => historyAction === "POP");
  const activeSidebarSection = sidebarSections.find((section) => section.id === activeSection) ?? null;
  const isEraserActive = selectedToolId === "eraser";
  const activeKeyboardTextElement = activeTextElementId ? textElements.find((item) => item.id === activeTextElementId) ?? null : null;
  const currentPaletteColor = activeKeyboardTextElement?.style.color ?? (activeTextElementId ? textColor : toolColor);
  const paletteLabel = activeKeyboardTextElement ? "Изменить цвет текста" : "Изменить цвет пера";
  const paletteDialogLabel = activeKeyboardTextElement ? "Выбор цвета текста" : "Выбор цвета пера";
  const isPaletteDisabled = isEraserActive && !activeKeyboardTextElement;
  const hasActiveObjectSelection = Boolean(activeElementId || activeTextElementId);
  const { clearActiveObjectSelection, closeActiveTextEditing, releaseSelectionForElement, selectOverlayElement, selectTextElement } =
    createEditorSelectionController({
      activeTextElementId,
      textInputRefs: textInputRefs.current,
      setActiveElementId,
      setActiveTextElementId,
      setIsKeyboardTextMode,
      setIsPaletteOpen,
      setIsTrashHover,
      setSwipePreviewDirection,
      setSwipePreviewProgress,
      setSwipePreviewOffsetX,
    });
  const currentPageIndex = page ? pages.findIndex((item) => item.id === page.id) : -1;
  const canGoPrev = currentPageIndex > 0;
  const nextPageLabel = currentPageIndex >= 0 && currentPageIndex < pages.length - 1 ? "Следующая" : "Новый лист";
  const pageIndexLabel = currentPageIndex >= 0 ? `Лист ${currentPageIndex + 1} из ${pages.length}` : "Лист";
  const saveStateClassName =
    saveState === SAVE_STATE_PENDING
      ? "editor-sheet__status-pill--quiet"
      : saveState === SAVE_STATE_ERROR
        ? "editor-sheet__status-pill--error"
        : "editor-sheet__status-pill--save";

  function buildPageDraftSnapshot(targetPageId: string, nextStrokes = draftStrokesRef.current): PageDraftSnapshot {
    return createPageDraftSnapshot({
      ...buildPageRecoveryDraftState(targetPageId),
      strokes: nextStrokes.map((stroke) => ({
        ...stroke,
        pageId: targetPageId,
      })),
    });
  }

  function getCurrentOverlayDraftState() {
    const mediaDraft = mediaDraftReaderRef.current?.();
    const shapeDraft = shapeDraftReaderRef.current?.();

    return {
      images: mediaDraft?.images ?? images,
      files: mediaDraft?.files ?? files,
      shapes: shapeDraft ?? shapes,
    };
  }

  function buildPageRecoveryDraftState(targetPageId: string) {
    const overlayDrafts = getCurrentOverlayDraftState();

    return createPageRecoveryDraft({
      pageId: targetPageId,
      title,
      paperType,
      paperColor,
      layout,
      textElements,
      images: overlayDrafts.images,
      files: overlayDrafts.files,
      shapes: overlayDrafts.shapes,
    });
  }

  function buildPersistPageInput() {
    return {
      title,
      paperType,
      paperColor,
      layout,
    };
  }

  function flushPageDraftSnapshot(targetPageId = pageId, options?: { syncCanvas?: boolean }) {
    if (!targetPageId || !hydratedRef.current) {
      return;
    }

    if (options?.syncCanvas) {
      syncDraftStrokesFromCanvas();
    }

    writePageDraftSnapshot(targetPageId, buildPageDraftSnapshot(targetPageId));
  }

  function schedulePageDraftSnapshotFlush(targetPageId = pageId, options?: { syncCanvas?: boolean }) {
    if (!targetPageId || !hydratedRef.current) {
      return;
    }

    if (draftSnapshotTimeoutRef.current !== null) {
      window.clearTimeout(draftSnapshotTimeoutRef.current);
    }

    draftSnapshotTimeoutRef.current = window.setTimeout(() => {
      draftSnapshotTimeoutRef.current = null;
      const persistedShellSnapshot = serializePageRecoveryDraft(buildPageRecoveryDraftState(targetPageId));

      if (!hasPendingStrokeSaveRef.current && persistedPageSnapshotRef.current === persistedShellSnapshot) {
        clearPageDraftSnapshot(targetPageId);
        return;
      }

      flushPageDraftSnapshot(targetPageId, options);
    }, PAGE_DRAFT_SYNC_DELAY_MS);
  }

  async function loadPage(targetPageId: string) {
    const pageRecord = await getPage(targetPageId);

    if (!pageRecord) {
      setPage(null);
      setStatus("missing");
      return;
    }

    const notebookRecord = await getNotebook(pageRecord.notebookId);
    const [bundle, notebookPages] = await Promise.all([getPageEditorBundle(targetPageId), listPages(pageRecord.notebookId)]);

    await ensureDrawingLayer(targetPageId, notebookRecord?.defaultTool ?? "ballpoint");

    const baseTextElements = bundle.textElements.map((item) =>
      buildEditorTextElement(targetPageId, item, notebookRecord?.bindingType, textColor),
    );
    const pageDraftSnapshot = readPageDraftSnapshot(targetPageId);
    const recoveryDraft = readPageRecoveryDraft(targetPageId);
    const nextTitle = pageDraftSnapshot?.title ?? recoveryDraft?.title ?? pageRecord.title;
    const nextPaperType = pageDraftSnapshot?.paperType ?? recoveryDraft?.paperType ?? pageRecord.paperType;
    const nextPaperColor = pageDraftSnapshot?.paperColor ?? recoveryDraft?.paperColor ?? pageRecord.paperColor;
    const nextLayout = pageDraftSnapshot?.layout ?? recoveryDraft?.layout ?? pageRecord.layout;
    const nextTextElements =
      pageDraftSnapshot?.textElements.map((item) => buildEditorTextElement(targetPageId, item, notebookRecord?.bindingType, textColor)) ??
      recoveryDraft?.textElements.map((item) => buildEditorTextElement(targetPageId, item, notebookRecord?.bindingType, textColor)) ??
      baseTextElements;
    const nextStrokes = pageDraftSnapshot?.strokes ?? bundle.strokes;
    const nextImages = pageDraftSnapshot?.images ?? recoveryDraft?.images ?? bundle.images;
    const nextFiles = pageDraftSnapshot?.files ?? recoveryDraft?.files ?? bundle.files;
    const nextShapes = pageDraftSnapshot?.shapes ?? recoveryDraft?.shapes ?? bundle.shapes;
    const hasRecoveredDrawingDraft =
      pageDraftSnapshot !== null && serializeStrokeDraft(pageDraftSnapshot.strokes) !== serializeStrokeDraft(bundle.strokes);
    const nextRecoveryNotice = pageDraftSnapshot
      ? { source: "snapshot" as const, savedAt: pageDraftSnapshot.savedAt ?? null }
      : recoveryDraft
        ? { source: "recovery" as const, savedAt: null }
        : null;

    setPage(pageRecord);
    setNotebook(notebookRecord ?? null);
    setPages(notebookPages);
    setTitle(nextTitle);
    setPaperType(nextPaperType);
    setPaperColor(nextPaperColor);
    setLayout(nextLayout);
    setTextElements(nextTextElements);
    setStrokes(nextStrokes);
    draftStrokesRef.current = nextStrokes;
    setImages(nextImages);
    setFiles(nextFiles);
    setShapes(nextShapes);
    setActiveElementId(null);
    setActiveTextElementId(null);
    setIsDeletingPage(false);
    setPageDeleteOffset({ x: 0, y: 0 });
    setIsKeyboardTextMode(false);
    zIndexCounterRef.current = getMaxElementZIndex(nextImages, nextFiles, nextShapes) + 1;

    const initialTool = notebookRecord?.defaultTool ?? "ballpoint";
    const preset = getToolPreset(initialTool);
    setSelectedToolId(initialTool);
    setLastDrawingToolId(initialTool === "eraser" ? "ballpoint" : initialTool);
    setToolColor(DEFAULT_DRAWING_COLOR);
    setTextColor(DEFAULT_DRAWING_COLOR);
    setToolWidth(initialTool === "eraser" ? eraserWidth : preset.defaultWidth);
    setToolOpacity(preset.defaultOpacity);
    setInsertPaperStyle(pageRecord.paperType);
    setInsertColor(pageRecord.paperColor);
    hasPendingStrokeSaveRef.current = hasRecoveredDrawingDraft;
    persistedPageSnapshotRef.current = serializePageRecoveryDraft(
      createPageRecoveryDraft({
        pageId: targetPageId,
        title: pageRecord.title,
        paperType: pageRecord.paperType,
        paperColor: pageRecord.paperColor,
        layout: pageRecord.layout,
        textElements: baseTextElements,
        images: bundle.images,
        files: bundle.files,
        shapes: bundle.shapes,
      }),
    );
    setSaveState(recoveryDraft || pageDraftSnapshot ? SAVE_STATE_PENDING : SAVE_STATE_SAVED);
    setRecoveryNotice(nextRecoveryNotice);
    setStatus("ready");
    hydratedRef.current = true;
  }

  useEffect(() => {
    hydratedRef.current = false;

    if (!pageId) {
      setStatus("missing");
      return;
    }

    setStatus("loading");
    void loadPage(pageId);
  }, [pageId]);

  useEffect(() => {
    const preset = getToolPreset(selectedToolId);
    if (selectedToolId !== "eraser") {
      setToolColor(DEFAULT_DRAWING_COLOR);
    }
    setToolWidth(selectedToolId === "eraser" ? eraserWidth : preset.defaultWidth);
    setToolOpacity(preset.defaultOpacity);

    if (selectedToolId !== "eraser") {
      setLastDrawingToolId(selectedToolId);
    }
  }, [eraserWidth, selectedToolId]);

  useEffect(() => {
    return () => {
      if (deleteTimeoutRef.current !== null) {
        window.clearTimeout(deleteTimeoutRef.current);
      }

      if (saveTimeoutRef.current !== null) {
        window.clearTimeout(saveTimeoutRef.current);
      }

      if (draftSnapshotTimeoutRef.current !== null) {
        window.clearTimeout(draftSnapshotTimeoutRef.current);
      }

    };
  }, []);

  useEffect(() => {
    if (!isPaletteOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;

      if (paletteButtonRef.current?.contains(target) || palettePopoverRef.current?.contains(target)) {
        return;
      }

      setIsPaletteOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isPaletteOpen]);

  useEffect(() => {
    if (isEraserActive) {
      setIsPaletteOpen(false);
    }
  }, [isEraserActive]);

  useEffect(() => {
    if (navigationBlocker.state === "blocked") {
      navigationBlocker.reset();
    }
  }, [navigationBlocker]);

  useEffect(() => {
    if (!isPaletteOpen) {
      return;
    }

    function handleViewportChange() {
      updatePalettePopoverPosition();
    }

    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    return () => {
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [isPaletteOpen]);

  useEffect(() => {
    if (!activeKeyboardTextElement) {
      setKeyboardPaletteBottomOffset(18);
      return;
    }

    const viewport = window.visualViewport;

    function updateKeyboardPalettePosition() {
      const nextViewport = window.visualViewport;

      if (!nextViewport) {
        setKeyboardPaletteBottomOffset(18);
        return;
      }

      const keyboardOverlap = Math.max(0, window.innerHeight - (nextViewport.height + nextViewport.offsetTop));
      setKeyboardPaletteBottomOffset(keyboardOverlap + 18);
    }

    updateKeyboardPalettePosition();
    viewport?.addEventListener("resize", updateKeyboardPalettePosition);
    viewport?.addEventListener("scroll", updateKeyboardPalettePosition);
    window.addEventListener("resize", updateKeyboardPalettePosition);

    return () => {
      viewport?.removeEventListener("resize", updateKeyboardPalettePosition);
      viewport?.removeEventListener("scroll", updateKeyboardPalettePosition);
      window.removeEventListener("resize", updateKeyboardPalettePosition);
    };
  }, [activeKeyboardTextElement]);

  useEffect(() => {
    if (!pageId || !hydratedRef.current) {
      return;
    }

    if (saveTimeoutRef.current !== null) {
      window.clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = window.setTimeout(() => {
      saveTimeoutRef.current = null;
      void persistPageChanges();
    }, AUTOSAVE_DELAY_MS);

    return () => {
      if (saveTimeoutRef.current !== null) {
        window.clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
    };
  }, [files, images, layout, pageId, paperColor, paperType, shapes, textElements, title]);

  useEffect(() => {
    if (!pageId || !hydratedRef.current) {
      return;
    }

    const currentSnapshot = serializePageRecoveryDraft(buildPageRecoveryDraftState(pageId));

    if (persistedPageSnapshotRef.current === currentSnapshot) {
      clearPageRecoveryDraft(pageId);
      return;
    }

    writePageRecoveryDraft(pageId, buildPageRecoveryDraftState(pageId));
  }, [files, images, layout, pageId, paperColor, paperType, shapes, textElements, title]);

  useEffect(() => {
    if (!pageId || !hydratedRef.current) {
      return;
    }

    schedulePageDraftSnapshotFlush(pageId);

    return () => {
      if (draftSnapshotTimeoutRef.current !== null) {
        window.clearTimeout(draftSnapshotTimeoutRef.current);
        draftSnapshotTimeoutRef.current = null;
      }
    };
  }, [files, images, layout, pageId, paperColor, paperType, shapes, strokes, textElements, title]);

  useEffect(() => {
    if (!pageId) {
      return;
    }

    function handlePageVisibilitySync() {
      if (document.visibilityState === "hidden") {
        flushPageDraftSnapshot(pageId, { syncCanvas: true });
      }
    }

    function handlePageHide() {
      flushPageDraftSnapshot(pageId, { syncCanvas: true });
    }

    document.addEventListener("visibilitychange", handlePageVisibilitySync);
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      document.removeEventListener("visibilitychange", handlePageVisibilitySync);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [pageId, title, paperType, paperColor, layout, textElements]);

  async function persistPageChanges(options?: { includeDraftStrokes?: boolean }) {
    if (!pageId || !hydratedRef.current) {
      return;
    }

    const includeDraftStrokes = options?.includeDraftStrokes ?? false;

    if (saveTimeoutRef.current !== null) {
      window.clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    try {
      await updatePage(pageId, buildPersistPageInput());
      await replaceTextElements(pageId, textElements);
      if (includeDraftStrokes) {
        await replaceDrawingStrokes(
          pageId,
          draftStrokesRef.current.map((stroke) => ({
            ...stroke,
            pageId,
          })),
        );
        hasPendingStrokeSaveRef.current = false;
      }

      setPage((currentPage) =>
        currentPage
          ? {
              ...currentPage,
              title,
              paperType,
              paperColor,
              layout,
              updatedAt: new Date().toISOString(),
            }
          : currentPage,
      );
      persistedPageSnapshotRef.current = serializePageRecoveryDraft(buildPageRecoveryDraftState(pageId));
      clearPageRecoveryDraft(pageId);
      if (!hasPendingStrokeSaveRef.current) {
        clearPageDraftSnapshot(pageId);
      }
      setSaveState(hasPendingStrokeSaveRef.current ? SAVE_STATE_PENDING : SAVE_STATE_SAVED);
      setRecoveryNotice(null);
    } catch (error) {
      console.error("Save failed", error);
      setSaveState(SAVE_STATE_ERROR);
    }
  }

  function handleDismissRecoveryNotice() {
    setRecoveryNotice(null);
  }

  async function handleResetRecoveredDraft() {
    if (!pageId) {
      return;
    }

    clearPageRecoveryDraft(pageId);
    clearPageDraftSnapshot(pageId);
    draftStrokesRef.current = [];
    hasPendingStrokeSaveRef.current = false;
    setRecoveryNotice(null);
    hydratedRef.current = false;
    setStatus("loading");
    await loadPage(pageId);
  }

  function handleManualSave() {
    syncDraftStrokesFromCanvas(true);
    setSaveState((current) => (current === SAVE_STATE_ERROR ? current : SAVE_STATE_PENDING));
    void persistPageChanges({ includeDraftStrokes: true });
  }

  function syncDraftStrokesFromCanvas(syncState = false) {
    const nextStrokes = drawingCanvasRef.current?.getStrokes() ?? draftStrokesRef.current;

    draftStrokesRef.current = nextStrokes;

    if (syncState) {
      setStrokes([...nextStrokes]);
    }
  }

  function handleDrawingStrokesChange(nextStrokes: DrawingStroke[]) {
    draftStrokesRef.current = nextStrokes;
    hasPendingStrokeSaveRef.current = true;
    setStrokes([...nextStrokes]);
  }

  async function handleImagesChange(event: ChangeEvent<HTMLInputElement>) {
    if (!pageId || !event.target.files?.length) {
      return;
    }

    const files = Array.from(event.target.files);
    const preflight = getFilesUploadPreflight(files, "изображений");

    if (preflight.level === "blocked") {
      setAssetStorageError(preflight.message);
      event.target.value = "";
      return;
    }

    if (
      preflight.level === "warning" &&
      preflight.message &&
      !window.confirm(`${preflight.message}\n\nПродолжить добавление изображений?`)
    ) {
      setAssetStorageError(preflight.message);
      event.target.value = "";
      return;
    }

    try {
      for (const file of files) {
        await addImageToPage(pageId, file);
      }
      setAssetStorageError(null);
    } catch (error) {
      console.error("Image upload failed", error);
      setAssetStorageError(getStorageRecoveryMessage(error, "изображение"));
    }

    event.target.value = "";
    await loadPage(pageId);
    setActiveSection(null);
  }

  async function handleFilesChange(event: ChangeEvent<HTMLInputElement>) {
    if (!pageId || !event.target.files?.length) {
      return;
    }

    const files = Array.from(event.target.files);
    const preflight = getFilesUploadPreflight(files, "файлов страницы");

    if (preflight.level === "blocked") {
      setAssetStorageError(preflight.message);
      event.target.value = "";
      return;
    }

    if (
      preflight.level === "warning" &&
      preflight.message &&
      !window.confirm(`${preflight.message}\n\nПродолжить добавление файлов?`)
    ) {
      setAssetStorageError(preflight.message);
      event.target.value = "";
      return;
    }

    try {
      for (const file of files) {
        await addFileToPage(pageId, file);
      }
      setAssetStorageError(null);
    } catch (error) {
      console.error("File upload failed", error);
      setAssetStorageError(getStorageRecoveryMessage(error, "файл"));
    }

    event.target.value = "";
    await loadPage(pageId);
    setActiveSection(null);
  }

  async function handleInsertShape(shapePreset: Parameters<typeof addShapeNote>[1]["shapePreset"]) {
    if (!pageId) {
      return;
    }

    const shape = await addShapeNote(pageId, {
      shapePreset,
      color: insertColor,
      paperStyle: insertPaperStyle,
      edgeStyle: insertEdgeStyle,
    });

    const promotedShape = { ...shape, zIndex: zIndexCounterRef.current++ };
    setShapes((current) => [...current, promotedShape]);
    setActiveElementId(promotedShape.id);
    setActiveSection(null);
    void updateShapeNote(promotedShape);
  }

  function promoteShape(shape: ShapeNoteElement) {
    const promotedShape = { ...shape, zIndex: zIndexCounterRef.current++ };
    selectOverlayElement(promotedShape.id);
    setShapes((current) => current.map((item) => (item.id === promotedShape.id ? promotedShape : item)));
    return promotedShape;
  }

  function promoteImage(image: ImagePageElement) {
    const promotedImage = { ...image, zIndex: zIndexCounterRef.current++ };
    selectOverlayElement(promotedImage.id);
    setImages((current) => current.map((item) => (item.id === promotedImage.id ? promotedImage : item)));
    return promotedImage;
  }

  function promoteFile(file: FileAttachmentPageElement) {
    const promotedFile = { ...file, zIndex: zIndexCounterRef.current++ };
    selectOverlayElement(promotedFile.id);
    setFiles((current) => current.map((item) => (item.id === promotedFile.id ? promotedFile : item)));
    return promotedFile;
  }

  function handleShapeChange(nextShape: ShapeNoteElement) {
    setShapes((current) => current.map((item) => (item.id === nextShape.id ? nextShape : item)));
  }

  function handleShapeCommit(nextShape: ShapeNoteElement) {
    commitOverlayElement(setShapes, nextShape, (item) => void updateShapeNote(item));
  }

  function handleShapeDelete(shapeId: string) {
    deleteOverlayElement(setShapes, shapeId);
  }

  function handleImageChange(nextImage: ImagePageElement) {
    setImages((current) => current.map((item) => (item.id === nextImage.id ? nextImage : item)));
  }

  function handleImageCommit(nextImage: ImagePageElement) {
    commitOverlayElement(setImages, nextImage, (item) => void updatePageElement(item));
  }

  function handleImageDelete(imageId: string) {
    deleteOverlayElement(setImages, imageId);
  }

  function handleFileChange(nextFile: FileAttachmentPageElement) {
    setFiles((current) => current.map((item) => (item.id === nextFile.id ? nextFile : item)));
  }

  function handleFileCommit(nextFile: FileAttachmentPageElement) {
    commitOverlayElement(setFiles, nextFile, (item) => void updatePageElement(item));
  }

  function handleFileDelete(fileId: string) {
    deleteOverlayElement(setFiles, fileId);
  }

  function getTrashBounds() {
    return trashButtonRef.current?.getBoundingClientRect() ?? null;
  }

  function calculatePageDeleteOffset() {
    const pageBounds = sheetPageRef.current?.getBoundingClientRect();
    const trashBounds = trashButtonRef.current?.getBoundingClientRect();

    if (!pageBounds || !trashBounds) {
      return { x: 0, y: 140 };
    }

    const pageCenterX = pageBounds.left + pageBounds.width / 2;
    const pageCenterY = pageBounds.top + pageBounds.height / 2;
    const trashCenterX = trashBounds.left + trashBounds.width / 2;
    const trashCenterY = trashBounds.top + trashBounds.height / 2;

    return {
      x: trashCenterX - pageCenterX,
      y: trashCenterY - pageCenterY,
    };
  }

  async function toggleBookmark() {
    if (!pageId || !page) {
      return;
    }

    const updated = await setPageBookmark(pageId, !page.isBookmarked);
    setPage(updated);
    setPages((current) => current.map((item) => (item.id === updated.id ? updated : item)));
  }

  function handleSectionToggle(sectionId: SidebarSectionId) {
    setActiveSection((currentSection) => (currentSection === sectionId ? null : sectionId));
  }

  function openImagePicker() {
    imageInputRef.current?.click();
  }

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function updatePalettePopoverPosition() {
    const bounds = paletteButtonRef.current?.getBoundingClientRect();

    if (!bounds) {
      return;
    }

    setPalettePopoverPosition({
      top: Math.max(12, bounds.bottom - 178),
      left: bounds.right + 12,
    });
  }

  function openFloatingColorPicker() {
    if (isEraserActive && !activeKeyboardTextElement) {
      return;
    }

    updatePalettePopoverPosition();
    setIsPaletteOpen((current) => !current);
  }

  function handlePaletteColorSelect(color: string) {
    if (activeKeyboardTextElement) {
      const targetId = activeKeyboardTextElement.id;
      setTextColor(color);
      setTextElements((current) =>
        current.map((item) =>
          item.id === targetId
            ? {
                ...item,
                style: {
                  ...item.style,
                  color,
                },
              }
            : item,
        ),
      );
      window.requestAnimationFrame(() => enableKeyboardTextMode(targetId));
    } else {
      setToolColor(color);
    }

    setIsPaletteOpen(false);
  }

  function commitOverlayElement<T extends { id: string }>(
    updater: Dispatch<SetStateAction<T[]>>,
    nextItem: T,
    persist: (item: T) => void,
  ) {
    updater((current) => replaceItemById(current, nextItem));
    persist(nextItem);
    selectOverlayElement(nextItem.id);
  }

  function deleteOverlayElement<T extends { id: string }>(updater: Dispatch<SetStateAction<T[]>>, targetId: string) {
    updater((current) => removeItemById(current, targetId));
    releaseSelectionForElement(targetId);
    void deletePageElement(targetId);
  }

  function commitTextElement(nextItem: TextPageElement, options?: { editing?: boolean }) {
    setTextElements((current) => replaceItemById(current, nextItem));
    selectTextElement(nextItem.id, { editing: options?.editing ?? false });
  }

  function deleteTextElement(targetId: string) {
    releaseSelectionForElement(targetId);
    delete textInputRefs.current[targetId];
    setTextElements((current) => removeItemById(current, targetId));
  }

  const { handleTextDragEnd, handleTextDragMove, handleTextDragStart, handleTextResizeStart } = useTextTransformController({
    closeActiveTextEditing,
    commitTextElement,
    deleteTextElement,
    getPageBounds: () => sheetPageRef.current?.getBoundingClientRect() ?? null,
    getTextElement: (targetId) => textElements.find((item) => item.id === targetId) ?? null,
    getTrashBounds,
    maxTextBlockWidth: TEXT_BLOCK_MAX_WIDTH,
    minTextBlockHeight: TEXT_BLOCK_MIN_HEIGHT,
    minTextBlockWidth: TEXT_BLOCK_MIN_WIDTH,
    promoteTextElement,
    selectTextElement: (targetId) => selectTextElement(targetId),
    setIsObjectDragging,
    setIsTrashHover,
    setTextElements,
  });

  function handleGoToNotebooks() {
    navigate("/", { replace: true });
  }

  function handleToolSelect(toolId: ToolPresetId) {
    if (toolId === "eraser") {
      setActiveSection(null);
      clearActiveObjectSelection();
    }

    setSelectedToolId(toolId);
  }

  function toggleEraser() {
    setActiveSection(null);
    clearActiveObjectSelection();
    setSelectedToolId((currentToolId) => (currentToolId === "eraser" ? lastDrawingToolId : "eraser"));
  }

  function handleEraserWidthChange(nextWidth: number) {
    setEraserWidth(nextWidth);

    if (isEraserActive) {
      setToolWidth(nextWidth);
    }
  }

  function clearDrawingLayer() {
    draftStrokesRef.current = [];
    hasPendingStrokeSaveRef.current = true;
    setStrokes([]);
  }

  async function handleDeleteCurrentPage() {
    if (!page || !notebook || isObjectDragging || isDeletingPage) {
      return;
    }

    setSwipePreviewDirection("");
    setSwipePreviewProgress(0);
    setFlipDirection("");
    setPageDeleteOffset(calculatePageDeleteOffset());
    setIsDeletingPage(true);

    deleteTimeoutRef.current = window.setTimeout(() => {
      deleteTimeoutRef.current = null;
      void (async () => {
        const currentIndex = pages.findIndex((item) => item.id === page.id);
        const nextExistingPage = pages[currentIndex + 1] ?? pages[currentIndex - 1] ?? null;
        const result = await deletePage(page.id);

        if (!result) {
          setIsDeletingPage(false);
          return;
        }

        if (nextExistingPage) {
          const targetPage =
            result.remainingPages.find((item) => item.id === nextExistingPage.id) ?? result.remainingPages[0] ?? null;

          if (targetPage) {
            setPages(result.remainingPages);
            navigate(`/pages/${targetPage.id}`);
            return;
          }
        }

        const replacementPage = await createPage(notebook.id, "Новый лист");
        setPages([replacementPage]);
        navigate(`/pages/${replacementPage.id}`);
      })();
    }, PAGE_DELETE_ANIMATION_MS);
  }

  async function triggerFlip(direction: "prev" | "next") {
    if (!page || !notebook || isDeletingPage || isObjectTransforming() || hasActiveObjectSelection || isTextEditingMode()) {
      return;
    }

    if (flipDirection) {
      return;
    }

    syncDraftStrokesFromCanvas(true);

    const currentIndex = pages.findIndex((item) => item.id === page.id);
    const targetIndex = direction === "next" ? currentIndex + 1 : currentIndex - 1;
    let targetPage = pages[targetIndex];

    if (!targetPage && direction === "next") {
      targetPage = await createPage(notebook.id, `Страница ${pages.length + 1}`);
      setPages((current) => [...current, targetPage as Page]);
    }

    if (!targetPage) {
      setSwipePreviewDirection("");
      setSwipePreviewProgress(0);
      return;
    }

    setSwipePreviewDirection("");
    setSwipePreviewProgress(0);
    setFlipDirection(direction === "next" ? "right" : "left");
    window.setTimeout(() => {
      navigate(`/pages/${targetPage.id}`);
      setFlipDirection("");
    }, PAGE_FLIP_ANIMATION_MS);
  }

  function handleSheetTouchStart(event: TouchEvent<HTMLDivElement>) {
    if (!canStartSheetTouchGesture(event.target, event.touches.length)) {
      resetTouchFlipGesture();
      return;
    }

    if (hasActiveObjectSelection) {
      clearActiveObjectSelection();
      resetTouchFlipGesture();
      return;
    }

    const touch = event.touches[0];

    if (!touch || !isBottomFlipZone(touch.clientY)) {
      resetTouchFlipGesture();
      return;
    }

    touchStartXRef.current = touch.clientX;
    touchStartYRef.current = touch.clientY;
    touchStartTimeRef.current = performance.now();
  }

  function handleSheetTouchMove(event: TouchEvent<HTMLDivElement>) {
    if (shouldAbortSheetTouchGesture()) {
      return;
    }

    const startX = touchStartXRef.current;
    const startY = touchStartYRef.current;

    if (startX === null) {
      return;
    }

    const currentX = event.touches[0]?.clientX ?? startX;
    const currentY = event.touches[0]?.clientY ?? startY ?? 0;
    const deltaX = currentX - startX;
    const deltaY = currentY - (startY ?? currentY);

    if (Math.abs(deltaX) < 20 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.15) {
      setSwipePreviewDirection("");
      setSwipePreviewProgress(0);
      setSwipePreviewOffsetX(0);
      return;
    }

    event.preventDefault();
    const direction = deltaX > 0 ? "left" : "right";
    const bounds = sheetPageRef.current?.getBoundingClientRect();
    const travelDistance = Math.max(220, (bounds?.width ?? 0) * 0.42);
    const progress = Math.min(Math.abs(deltaX) / travelDistance, 1);
    const clampedOffsetX = clampValue(deltaX, -travelDistance, travelDistance);

    setSwipePreviewDirection(direction);
    setSwipePreviewProgress(progress);
    setSwipePreviewOffsetX(clampedOffsetX);
  }

  function handleSheetTouchEnd(event: TouchEvent<HTMLDivElement>) {
    if (shouldAbortSheetTouchGesture()) {
      return;
    }

    const startX = touchStartXRef.current;
    const startY = touchStartYRef.current;

    if (startX === null) {
      return;
    }

    const endX = event.changedTouches[0]?.clientX ?? startX;
    const endY = event.changedTouches[0]?.clientY ?? startY ?? 0;
    const delta = endX - startX;
    const deltaY = endY - (startY ?? endY);
    const gestureDuration = touchStartTimeRef.current === null ? 0 : performance.now() - touchStartTimeRef.current;
    const bounds = sheetPageRef.current?.getBoundingClientRect();
    const travelDistance = Math.max(220, (bounds?.width ?? 0) * 0.42);
    const releaseProgress = Math.min(Math.abs(delta) / travelDistance, 1);
    resetTouchFlipGesture();

    if (
      releaseProgress < PAGE_FLIP_RELEASE_THRESHOLD ||
      Math.abs(delta) <= Math.abs(deltaY) * 1.2 ||
      gestureDuration < PAGE_FLIP_MIN_GESTURE_MS
    ) {
      return;
    }

    if (delta > 0) {
      void triggerFlip("prev");
    } else {
      void triggerFlip("next");
    }
  }

  function getStagePoint(clientX: number, clientY: number): DrawingPoint | null {
    const bounds = sheetPageRef.current?.getBoundingClientRect();

    if (!bounds) {
      return null;
    }

    return {
      x: Math.min(Math.max(clientX - bounds.left, 0), bounds.width),
      y: Math.min(Math.max(clientY - bounds.top, 0), bounds.height),
    };
  }

  function isBottomFlipZone(clientY: number) {
    const bounds = sheetPageRef.current?.getBoundingClientRect();

    if (!bounds) {
      return false;
    }

    return clientY >= bounds.bottom - bounds.height * PAGE_FLIP_TOUCH_ZONE_RATIO;
  }

  function markPenInteraction() {
    recentPenInteractionUntilRef.current = Date.now() + 700;
  }

  function isPenInteractionLocked() {
    return drawingPointerIdRef.current !== null || recentPenInteractionUntilRef.current > Date.now();
  }

  function isDrawingPointer(pointerType: ReactPointerEvent<HTMLElement>["pointerType"], altKey = false) {
    return pointerType === "pen" || (pointerType === "mouse" && altKey);
  }

  function isTextEditingMode() {
    return Boolean(activeTextElementId && isKeyboardTextMode);
  }

  function isObjectTransforming() {
    return isObjectDragging;
  }

  function isDrawingInteractionActive() {
    return drawingPointerIdRef.current !== null || isPenInteractionLocked();
  }

  function isIdleForNewText() {
    return !isTextEditingMode() && !isObjectTransforming() && !isDrawingInteractionActive() && !hasActiveObjectSelection && !isDeletingPage;
  }

  function shouldRoutePointerToTextEraser() {
    return isEraserActive;
  }

  function shouldBlockKeyboardTextEntry(pointerType: ReactPointerEvent<HTMLElement>["pointerType"]) {
    return isDrawingPointer(pointerType);
  }

  function shouldCaptureTextLayerPointer(pointerType: ReactPointerEvent<HTMLElement>["pointerType"]) {
    return shouldRoutePointerToTextEraser() || shouldBlockKeyboardTextEntry(pointerType);
  }

  function shouldHandleBottomFlipTouch(pointerType: ReactPointerEvent<HTMLDivElement>["pointerType"], clientY: number) {
    return pointerType === "touch" && isBottomFlipZone(clientY);
  }

  function resetTouchFlipGesture() {
    touchStartXRef.current = null;
    touchStartYRef.current = null;
    touchStartTimeRef.current = null;
    setSwipePreviewDirection("");
    setSwipePreviewProgress(0);
    setSwipePreviewOffsetX(0);
  }

  function canStartSheetTouchGesture(target: EventTarget | null, touchesLength: number) {
    return !isDeletingPage && !isDrawingInteractionActive() && !isOverlayTarget(target) && touchesLength === 1;
  }

  function shouldAbortSheetTouchGesture() {
    return touchStartXRef.current === null || isObjectTransforming() || isDeletingPage || isDrawingInteractionActive();
  }

  function canCreateTextFromSheetPointer(event: ReactPointerEvent<HTMLDivElement>) {
    if (isDrawingPointer(event.pointerType, event.altKey)) {
      return false;
    }

    if (hasActiveObjectSelection || !isIdleForNewText()) {
      return false;
    }

    return Boolean(pageId);
  }

  function buildNewTextElementAtPoint(clientX: number, clientY: number) {
    if (!pageId) {
      return null;
    }

    const frame = getTextElementFrameAtPoint(clientX, clientY);

    if (!frame) {
      return null;
    }

    return {
      ...buildEditorTextElement(pageId, null, notebook?.bindingType, textColor),
      id: createId("element"),
      ...frame,
      zIndex: zIndexCounterRef.current++,
    };
  }

  function getTextElementFrameAtPoint(clientX: number, clientY: number) {
    const bounds = sheetPageRef.current?.getBoundingClientRect();
    const point = getStagePoint(clientX, clientY);

    if (!bounds || !point || !pageId) {
      return null;
    }

    const defaultLeft = notebook?.bindingType === "rings" || notebook?.bindingType === "spiral" ? 72 : 36;
    const left = Math.min(Math.max(point.x, defaultLeft), Math.max(defaultLeft, bounds.width - TEXT_BLOCK_MIN_WIDTH - 24));
    const top = Math.min(Math.max(point.y, 44), Math.max(44, bounds.height - TEXT_BLOCK_MIN_HEIGHT - 112));
    const maxWidth = Math.max(TEXT_BLOCK_MIN_WIDTH, Math.min(TEXT_BLOCK_MAX_WIDTH, bounds.width - left - 24));
    const width = Math.min(TEXT_BLOCK_DEFAULT_WIDTH, maxWidth);
    const height = TEXT_BLOCK_MIN_HEIGHT;

    return { x: left, y: top, width, height };
  }

  function enableKeyboardTextMode(targetId: string) {
    pendingTextFocusIdRef.current = targetId;
    setActiveTextElementId(targetId);
    setIsKeyboardTextMode(true);
  }

  function beginKeyboardEditing(targetId: string) {
    selectTextElement(targetId);

    if (!focusTextInput(targetId)) {
      enableKeyboardTextMode(targetId);
      return;
    }

    selectTextElement(targetId, { editing: true });
    enableKeyboardTextMode(targetId);
  }

  function deactivateKeyboardEditing(targetId: string, options?: { blur?: boolean; keepSelection?: boolean }) {
    if (!options?.keepSelection && activeTextElementId === targetId) {
      setIsKeyboardTextMode(false);
    }

    const textArea = textInputRefs.current[targetId];
    textArea?.setAttribute("inputmode", "none");

    if (textArea) {
      textArea.readOnly = true;
      if (options?.blur) {
        textArea.blur();
      }
    }
  }

  function focusTextInput(targetId: string) {
    const textArea = textInputRefs.current[targetId];

    if (!textArea) {
      return false;
    }

    pendingTextFocusIdRef.current = null;
    textArea.readOnly = false;
    textArea.setAttribute("inputmode", "text");
    textArea.focus({ preventScroll: true });
    const end = textArea.value.length;
    textArea.setSelectionRange(end, end);
    return true;
  }

  useEffect(() => {
    const targetId = pendingTextFocusIdRef.current;

    if (!targetId) {
      return;
    }

    const textArea = textInputRefs.current[targetId];

    if (!textArea) {
      return;
    }

    window.requestAnimationFrame(() => {
      focusTextInput(targetId);
    });
  }, [activeTextElementId, isKeyboardTextMode, textElements]);

  function syncTextElementSize(targetId: string) {
    const textArea = textInputRefs.current[targetId];
    const bounds = sheetPageRef.current?.getBoundingClientRect();
    const targetElement = textElements.find((item) => item.id === targetId);

    if (!textArea || !bounds || !targetElement) {
      return;
    }

    const maxHeight = Math.max(TEXT_BLOCK_MIN_HEIGHT, bounds.height - targetElement.y - 112);
    const desiredHeight = Math.min(maxHeight, Math.max(TEXT_BLOCK_MIN_HEIGHT, textArea.scrollHeight));
    const nextHeight = Math.max(targetElement.height, desiredHeight);

    setTextElements((current) =>
      current.map((item) =>
        item.id === targetId && Math.abs(item.height - nextHeight) >= 1
          ? { ...item, height: nextHeight }
          : item,
      ),
    );
  }

  function handleTextElementChange(targetId: string, content: string) {
    const targetElement = textElements.find((item) => item.id === targetId);

    if (!targetElement) {
      return;
    }

    commitTextElement({ ...targetElement, content }, { editing: true });
    window.requestAnimationFrame(() => {
      syncTextElementSize(targetId);
    });
  }

  function promoteTextElement(targetId: string) {
    let promotedElement: TextPageElement | null = null;

    setTextElements((current) =>
      current.map((item) => {
        if (item.id !== targetId) {
          return item;
        }

        promotedElement = {
          ...item,
          zIndex: zIndexCounterRef.current++,
        };
        return promotedElement;
      }),
    );

    return promotedElement;
  }

  function getTextEraseIndex(textArea: HTMLTextAreaElement, clientX: number, clientY: number) {
    const caretDocument = document as CaretDocument;
    const content = textArea.value;

    if (!content) {
      return null;
    }

    if (typeof caretDocument.caretPositionFromPoint === "function") {
      const position = caretDocument.caretPositionFromPoint(clientX, clientY);

      if (position) {
        return clampValue(position.offset, 0, content.length);
      }
    }

    if (typeof caretDocument.caretRangeFromPoint === "function") {
      const range = caretDocument.caretRangeFromPoint(clientX, clientY);

      if (range) {
        return clampValue(range.startOffset, 0, content.length);
      }
    }

    const bounds = textArea.getBoundingClientRect();
    const styles = window.getComputedStyle(textArea);
    const fontSize = Number.parseFloat(styles.fontSize) || 18;
    const lineHeight = Number.parseFloat(styles.lineHeight) || fontSize * 1.7;
    const paddingLeft = Number.parseFloat(styles.paddingLeft) || 0;
    const paddingRight = Number.parseFloat(styles.paddingRight) || 0;
    const paddingTop = Number.parseFloat(styles.paddingTop) || 0;
    const innerWidth = Math.max(bounds.width - paddingLeft - paddingRight, fontSize * 4);
    const averageCharWidth = Math.max(fontSize * 0.56, 8);
    const columnsPerLine = Math.max(1, Math.floor(innerWidth / averageCharWidth));
    const localX = Math.max(0, clientX - bounds.left - paddingLeft);
    const localY = Math.max(0, clientY - bounds.top - paddingTop + textArea.scrollTop);
    const targetLineIndex = Math.max(0, Math.floor(localY / lineHeight));
    const lines = content.split("\n");
    const safeLineIndex = clampValue(targetLineIndex, 0, Math.max(lines.length - 1, 0));
    const targetLine = lines[safeLineIndex] ?? "";
    let offset = 0;

    for (let lineIndex = 0; lineIndex < safeLineIndex; lineIndex += 1) {
      offset += (lines[lineIndex]?.length ?? 0) + 1;
    }

    if (!targetLine.length) {
      return clampValue(offset, 0, content.length);
    }

    const wrappedColumn = clampValue(Math.round(localX / averageCharWidth), 0, Math.max(columnsPerLine, targetLine.length));
    return clampValue(offset + Math.min(targetLine.length, wrappedColumn), 0, content.length);
  }

  function eraseTextAtPoint(targetId: string, clientX: number, clientY: number) {
    const textArea = textInputRefs.current[targetId];
    const targetElement = textElements.find((item) => item.id === targetId);

    if (!textArea || !targetElement) {
      return;
    }

    if (targetElement.content.length <= 1) {
      deleteTextElement(targetId);
      return;
    }

    const eraseIndex = getTextEraseIndex(textArea, clientX, clientY);

    if (eraseIndex === null) {
      deleteTextElement(targetId);
      return;
    }

    const signature = `${targetId}:${eraseIndex}`;

    if (lastTextEraseSignatureRef.current === signature) {
      return;
    }

    lastTextEraseSignatureRef.current = signature;
    setTextElements((current) =>
      current.flatMap((item) => {
        if (item.id !== targetId) {
          return item;
        }

        if (!item.content.length) {
          return [];
        }

        const deleteIndex = eraseIndex >= item.content.length ? item.content.length - 1 : Math.max(eraseIndex - 1, 0);
        const nextContent = item.content.slice(0, deleteIndex) + item.content.slice(deleteIndex + 1);

        if (!nextContent.length) {
          return [];
        }

        return {
          ...item,
          content: nextContent,
        };
      }),
    );

    window.requestAnimationFrame(() => {
      syncTextElementSize(targetId);
    });
  }

  function eraseTextElement(targetId: string) {
    deleteTextElement(targetId);
  }

  function handleTextLayerPointerDown(targetId: string, event: ReactPointerEvent<HTMLTextAreaElement>) {
    if (shouldRoutePointerToTextEraser()) {
      selectTextElement(targetId);
      event.preventDefault();
      eraseTextAtPoint(targetId, event.clientX, event.clientY);
      return;
    }

    if (shouldBlockKeyboardTextEntry(event.pointerType)) {
      event.preventDefault();
      deactivateKeyboardEditing(targetId, { blur: true, keepSelection: true });
      return;
    }

    beginKeyboardEditing(targetId);
  }

  function handleTextLayerPointerMoveCapture(event: ReactPointerEvent<HTMLTextAreaElement>) {
    if (shouldCaptureTextLayerPointer(event.pointerType)) {
      event.preventDefault();
    }
  }

  function handleTextLayerPointerUpCapture(event: ReactPointerEvent<HTMLTextAreaElement>) {
    if (shouldRoutePointerToTextEraser()) {
      event.preventDefault();
      lastTextEraseSignatureRef.current = null;
      return;
    }

    if (shouldBlockKeyboardTextEntry(event.pointerType)) {
      event.preventDefault();
    }
  }

  function handleTextLayerBlur(targetId: string) {
    if (keyboardPaletteInteractionRef.current) {
      return;
    }

    deactivateKeyboardEditing(targetId);
  }

  function handleTextLayerPointerMove(targetId: string, event: ReactPointerEvent<HTMLTextAreaElement>) {
    if (!isEraserActive) {
      return;
    }

    event.preventDefault();
    eraseTextAtPoint(targetId, event.clientX, event.clientY);
  }

  function handleSheetPointerDownCapture(event: ReactPointerEvent<HTMLDivElement>) {
    if (isDeletingPage) {
      return;
    }

    const canDraw = isDrawingPointer(event.pointerType, event.altKey);
    const isTextLayerTarget = isTextTarget(event.target);
    const isOverlay = isOverlayTarget(event.target);

    if (isOverlay && !(canDraw && isTextLayerTarget)) {
      return;
    }

    if (isTextLayerTarget && !canDraw) {
      return;
    }

    if (shouldHandleBottomFlipTouch(event.pointerType, event.clientY)) {
      if (hasActiveObjectSelection) {
        clearActiveObjectSelection();
      } else {
        setActiveElementId(null);
      }
      return;
    }

    if (!canDraw) {
      if (hasActiveObjectSelection) {
        clearActiveObjectSelection();
        return;
      }

      if (!canCreateTextFromSheetPointer(event)) {
        return;
      }

      setActiveElementId(null);
      const nextTextElement = buildNewTextElementAtPoint(event.clientX, event.clientY);

      if (!nextTextElement) {
        return;
      }

      flushSync(() => {
        setTextElements((current) => [...current, nextTextElement]);
        setActiveTextElementId(nextTextElement.id);
        setIsKeyboardTextMode(true);
      });

      beginKeyboardEditing(nextTextElement.id);
      return;
    }

    const point = getStagePoint(event.clientX, event.clientY);

    if (!point) {
      return;
    }

    event.preventDefault();
    if (event.pointerType === "pen") {
      markPenInteraction();
    }
    drawingPointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    closeActiveTextEditing();
    setActiveElementId(null);
    drawingCanvasRef.current?.beginStroke(point);
  }

  function handleSheetPointerMoveCapture(event: ReactPointerEvent<HTMLDivElement>) {
    if (drawingPointerIdRef.current !== event.pointerId) {
      return;
    }

    const point = getStagePoint(event.clientX, event.clientY);

    if (!point) {
      return;
    }

    event.preventDefault();
    if (event.pointerType === "pen") {
      markPenInteraction();
    }
    drawingCanvasRef.current?.appendPoint(point);
  }

  function finishSheetStroke(event: ReactPointerEvent<HTMLDivElement>) {
    if (drawingPointerIdRef.current !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (event.pointerType === "pen") {
      markPenInteraction();
    }
    drawingPointerIdRef.current = null;
    drawingCanvasRef.current?.endStroke();
  }

  function renderDrawingControls(description: string, categories: Array<"pens" | "markers" | "brushes" | "pencils" | "special">) {
    return (
      <>
        <div className="editor-sidebar__hint">{description}</div>
        <div className="editor-sidebar__hint editor-sidebar__hint--status">
          {toolPreset.label} • {strokeStyleLabels[toolPreset.strokeStyle]}
        </div>
        <ToolPresetPicker selectedId={selectedToolId} onSelect={handleToolSelect} categories={categories} />
        {isEraserActive ? (
          <label className="stack">
            <span>Размер ластика: {toolWidth.toFixed(1)}</span>
            <input
              className="range"
              type="range"
              min={6}
              max={80}
              step={1}
              value={toolWidth}
              onChange={(event) => handleEraserWidthChange(Number(event.target.value))}
            />
          </label>
        ) : (
          <>
            <label className="stack">
              <span>Цвет</span>
              <input className="color-input" type="color" value={toolColor} onChange={(event) => setToolColor(event.target.value)} />
            </label>
            <label className="stack">
              <span>Толщина: {toolWidth.toFixed(1)}</span>
              <input className="range" type="range" min={1} max={24} step={0.5} value={toolWidth} onChange={(event) => setToolWidth(Number(event.target.value))} />
            </label>
            <label className="stack">
              <span>Прозрачность: {Math.round(toolOpacity * 100)}%</span>
              <input className="range" type="range" min={0.1} max={1} step={0.05} value={toolOpacity} onChange={(event) => setToolOpacity(Number(event.target.value))} />
            </label>
          </>
        )}
        <Button variant="ghost" onClick={clearDrawingLayer}>
          Очистить слой
        </Button>
      </>
    );
  }

  if (status === "loading") {
    return (
      <section className="page-section">
        <Panel className="empty-state">Загружаем страницу...</Panel>
      </section>
    );
  }

  if (!page) {
    return (
      <section className="page-section">
        <Panel className="empty-state">
          Страница не найдена. <Link to="/">Вернуться к блокнотам</Link>
        </Panel>
      </section>
    );
  }

  const currentPageId = page.id;
  const sheetMotionDirection = flipDirection || swipePreviewDirection;
  const sheetClassName = [
    "editor-sheet",
    swipePreviewDirection ? `editor-sheet--peek-${swipePreviewDirection}` : "",
    flipDirection ? `editor-sheet--flip-${flipDirection}` : "",
    notebook?.bindingType === "rings" ? "editor-sheet--binding-rings" : "",
    notebook?.bindingType === "spiral" ? "editor-sheet--binding-spiral" : "",
    isEraserActive ? "editor-sheet--eraser" : "",
    isDeletingPage ? "editor-sheet--deleting" : "",
  ]
    .filter(Boolean)
    .join(" ");

  function renderSidebarContent() {
    switch (activeSection) {
      case "inserts":
        return (
          <div className="stack">
            <div className="section-head">
              <div>
                <h2>Вставки</h2>
                <p>Фигурные заметки, изображения и файлы для свободной композиции на листе.</p>
              </div>
            </div>
            <div className="inline-actions">
              <Button variant="ghost" onClick={openImagePicker}>
                Изображение
              </Button>
              <Button variant="ghost" onClick={openFilePicker}>
                Файл
              </Button>
            </div>
            <div className="editor-sidebar__hint">
              Активный объект поднимается выше остальных. Долгое касание включает перенос, а затем объект можно увести в корзину.
            </div>
            {assetStorageError ? <div className="inline-notice inline-notice--warning">{assetStorageError}</div> : null}
            <ShapeInsertLibrary
              color={insertColor}
              edgeStyle={insertEdgeStyle}
              paperStyle={insertPaperStyle}
              onColorChange={setInsertColor}
              onEdgeStyleChange={setInsertEdgeStyle}
              onPaperStyleChange={setInsertPaperStyle}
              onInsert={handleInsertShape}
            />
          </div>
        );
      case "pens":
        return (
          <div className="stack">
            <div className="section-head">
              <div>
                <h2>Ручки и маркеры</h2>
                <p>На iPad лист сам различает клавиатурный текст и рисунок Pencil. Для мыши рисование доступно с зажатым `Alt`.</p>
              </div>
            </div>
            {renderDrawingControls("Текст печатается прямо на листе, а Apple Pencil рисует поверх без отдельного режима прокрутки.", ["pens", "markers"])}
          </div>
        );
      case "art":
        return (
          <div className="stack">
            <div className="section-head">
              <div>
                <h2>Кисти и карандаши</h2>
                <p>Свободные штрихи, акценты и наброски теперь ложатся на тот же лист, что и текст, без отдельной длинной зоны снизу.</p>
              </div>
            </div>
            {renderDrawingControls("Кисти и карандаши работают на общем листе бумаги, а не в отдельном нижнем блоке.", ["brushes", "pencils", "special"])}
          </div>
        );
      case "paper":
        return (
          <div className="stack">
            <div className="section-head">
              <div>
                <h2>Лист</h2>
                <p>Название страницы, макет, бумага и цвет основы без верхней панели и без уезда листа вниз.</p>
              </div>
            </div>
            <label className="stack">
              <span>Название страницы</span>
              <input className="input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Название страницы" />
            </label>
            <label className="stack">
              <span>Макет</span>
              <select className="select" value={layout} onChange={(event) => setLayout(event.target.value as PageLayout)}>
                {layoutOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <PaperPresetPicker selectedId={paperType} onSelect={setPaperType} />
            <label className="stack">
              <span>Цвет листа</span>
              <input className="color-input" type="color" value={paperColor} onChange={(event) => setPaperColor(event.target.value)} />
            </label>
            <div className="editor-sidebar__hint editor-sidebar__hint--status">{saveState}</div>
          </div>
        );
      case "bookmarks":
        return notebook ? (
          <div className="stack">
            <div className="section-head">
              <div>
                <h2>Закладки</h2>
                <p>Отмеченные страницы под рукой, чтобы быстро перескакивать между важными местами.</p>
              </div>
            </div>
            <div className="search-toolbar search-toolbar--tight">
              <input
                className="input search-toolbar__input"
                value={bookmarkSearchQuery}
                onChange={(event) => setBookmarkSearchQuery(event.target.value)}
                placeholder="Поиск по закладкам"
              />
              <div className="search-toolbar__meta">{pages.filter((page) => page.isBookmarked).length} закладок</div>
            </div>
            <BookmarksPanel
              notebookId={notebook.id}
              currentPageId={currentPageId}
              pages={pages}
              searchQuery={bookmarkSearchQuery}
            />
          </div>
        ) : null;
      default:
        return null;
    }
  }

  return (
    <section className="page-section editor-screen">
      <div className="editor-screen__topbar">
        <div className="breadcrumbs">
          <button type="button" className="breadcrumbs__button" onClick={handleGoToNotebooks}>
            Мои блокноты
          </button>
          {notebook ? (
            <>
            <span>/</span>
            <Link to={`/notebooks/${notebook.id}/manage`} state={{ sourcePageId: page?.id }}>
              {notebook.title}
            </Link>
          </>
        ) : null}
        </div>
        <div className="editor-screen__save-action">
          <Button type="button" className="editor-screen__save-button" onClick={handleManualSave}>
            Сохранить
          </Button>
        </div>
        <div className="editor-screen__status">
          <span className={`editor-sheet__status-pill ${saveStateClassName}`}>{saveState}</span>
        </div>
      </div>

      {recoveryNotice ? (
        <div className="editor-recovery-banner">
          <div className="editor-recovery-banner__content">
            <strong>Черновик страницы восстановлен</strong>
            <span>
              {recoveryNotice.source === "snapshot"
                ? `Подняли локальное состояние страницы от ${formatRecoverySavedAt(recoveryNotice.savedAt)}. Сохраните лист вручную, если хотите закрепить изменения.`
                : "Подняли локальные несохранённые изменения после перезапуска. Сохраните лист вручную или сбросьте черновик к последней сохранённой версии."}
            </span>
          </div>
          <div className="editor-recovery-banner__actions">
            <Button type="button" variant="ghost" onClick={handleDismissRecoveryNotice}>
              Оставить
            </Button>
            <Button type="button" variant="ghost" onClick={() => void handleResetRecoveredDraft()}>
              Сбросить черновик
            </Button>
          </div>
        </div>
      ) : null}

      <div className={`editor-workbench ${activeSection ? "editor-workbench--sidebar" : "editor-workbench--compact"}`}>
        <aside className="editor-rail panel">
          <div className="editor-rail__tools">
            {sidebarSections.map((section) => (
              <button
                key={section.id}
                type="button"
                className={`rail-button ${activeSection === section.id ? "rail-button--active" : ""}`}
                onClick={() => handleSectionToggle(section.id)}
                aria-label={section.label}
                title={section.label}
              >
                <span className="rail-button__icon" aria-hidden="true">
                  {section.icon}
                </span>
                <span className="sr-only">{section.label}</span>
              </button>
            ))}
          </div>

          <div ref={paletteButtonRef} className="editor-rail__palette">
            <button
              type="button"
              className={`rail-button rail-button--palette ${isPaletteDisabled ? "rail-button--disabled" : ""}`}
              onClick={openFloatingColorPicker}
              aria-label="Изменить цвет пера"
              title={isEraserActive ? "Сначала выключите ластик" : "Изменить цвет пера"}
              aria-expanded={isPaletteOpen}
              disabled={isPaletteDisabled}
            >
              <span className="rail-button__palette-swatch" style={{ background: currentPaletteColor }} aria-hidden="true" />
              <span className="rail-button__icon" aria-hidden="true">
                Ц
              </span>
              <span className="sr-only">Изменить цвет пера</span>
            </button>

          </div>
        </aside>

        {activeSection && activeSidebarSection && !isEraserActive ? (
          <aside className="editor-sidebar panel">
            <div className="editor-sidebar__header">
              <div className="editor-sidebar__badge">
                <span className="editor-sidebar__badge-icon" aria-hidden="true">
                  {activeSidebarSection.icon}
                </span>
                <span>{activeSidebarSection.label}</span>
              </div>
              <button type="button" className="icon-button editor-sidebar__close" aria-label="Свернуть панель" onClick={() => setActiveSection(null)}>
                ×
              </button>
            </div>
            {renderSidebarContent()}
          </aside>
        ) : null}

        <main className="editor-main">
          <section
            className={sheetClassName}
            style={
              {
                ...buildPaperStyle(paperType, paperColor),
                "--page-swipe-progress": swipePreviewProgress.toFixed(3),
                "--page-swipe-offset-x": `${swipePreviewOffsetX.toFixed(1)}px`,
                "--page-delete-x": `${pageDeleteOffset.x.toFixed(1)}px`,
                "--page-delete-y": `${pageDeleteOffset.y.toFixed(1)}px`,
                "--editor-sheet-text-left":
                  notebook?.bindingType === "rings" || notebook?.bindingType === "spiral" ? "68px" : "36px",
              } as CSSProperties
            }
          >
            <div className="editor-sheet__inner">
              <div
                ref={sheetPageRef}
                className="editor-sheet__page"
                onTouchStart={handleSheetTouchStart}
                onTouchMove={handleSheetTouchMove}
                onTouchEnd={handleSheetTouchEnd}
                onTouchCancel={handleSheetTouchEnd}
                onPointerDownCapture={handleSheetPointerDownCapture}
                onPointerMoveCapture={handleSheetPointerMoveCapture}
                onPointerUpCapture={finishSheetStroke}
                onPointerCancelCapture={finishSheetStroke}
              >
                {notebook && (notebook.bindingType === "rings" || notebook.bindingType === "spiral") ? (
                  <NotebookBinding bindingType={notebook.bindingType} className="editor-sheet__binding" />
                ) : null}

                {sheetMotionDirection ? (
                  <div
                    className={`editor-sheet__flip-curl editor-sheet__flip-curl--${sheetMotionDirection} ${
                      flipDirection ? "editor-sheet__flip-curl--flip" : "editor-sheet__flip-curl--preview"
                    }`}
                    aria-hidden="true"
                  />
                ) : null}

                {textElements.map((textElement) => {
                  const isSelectedTextElement = activeTextElementId === textElement.id;
                  const isTypingTextElement = isKeyboardTextMode && isSelectedTextElement;

                  return (
                    <div
                      key={textElement.id}
                      className={`editor-text-block ${isSelectedTextElement ? "editor-text-block--active" : ""}`}
                      style={{
                        top: `${textElement.y}px`,
                        left: `${textElement.x}px`,
                        width: `${textElement.width}px`,
                        height: `${textElement.height}px`,
                        zIndex: textElement.zIndex,
                      }}
                    >
                      <button
                        type="button"
                        className="editor-text-block__drag"
                        aria-label="Переместить текстовый блок"
                        onPointerDown={(event) => handleTextDragStart(textElement.id, event)}
                        onPointerMove={(event) => handleTextDragMove(textElement.id, event)}
                        onPointerUp={(event) => handleTextDragEnd(textElement.id, event)}
                        onPointerCancel={(event) => handleTextDragEnd(textElement.id, event)}
                      />
                      <button
                        type="button"
                        className="editor-text-block__resize"
                        aria-label="Изменить размер текстового блока"
                        onPointerDown={(event) => handleTextResizeStart(textElement.id, event)}
                        onPointerMove={(event) => handleTextDragMove(textElement.id, event)}
                        onPointerUp={(event) => handleTextDragEnd(textElement.id, event)}
                        onPointerCancel={(event) => handleTextDragEnd(textElement.id, event)}
                      />
                      <textarea
                        ref={(node) => {
                          textInputRefs.current[textElement.id] = node;
                        }}
                        className={`textarea textarea--stage editor-sheet__textarea ${
                          isTypingTextElement ? "editor-sheet__textarea--typing" : "editor-sheet__textarea--idle"
                        }`}
                        style={{
                          fontSize: `${textElement.style.fontSize}px`,
                          lineHeight: String(textElement.style.lineHeight),
                          color: textElement.style.color,
                          paddingTop: `${TEXT_DRAG_HANDLE_HEIGHT + 8}px`,
                        }}
                        value={textElement.content}
                        onChange={(event) => handleTextElementChange(textElement.id, event.target.value)}
                        onPointerDownCapture={(event) => handleTextLayerPointerDown(textElement.id, event)}
                        onPointerMove={(event) => handleTextLayerPointerMove(textElement.id, event)}
                        onPointerMoveCapture={handleTextLayerPointerMoveCapture}
                        onPointerUpCapture={handleTextLayerPointerUpCapture}
                        onPointerCancelCapture={handleTextLayerPointerUpCapture}
                        onBlur={() => handleTextLayerBlur(textElement.id)}
                        onFocus={() => {
                          selectTextElement(textElement.id, { editing: true });
                        }}
                        readOnly={!isTypingTextElement}
                        autoFocus={isTypingTextElement}
                        spellCheck={false}
                        autoCorrect="off"
                        autoCapitalize="off"
                        inputMode={isTypingTextElement ? "text" : "none"}
                      />
                    </div>
                  );
                })}

                <DrawingCanvas
                  ref={drawingCanvasRef}
                  className="editor-canvas editor-sheet__canvas"
                  strokes={strokes}
                  onChange={handleDrawingStrokesChange}
                  toolId={selectedToolId}
                  color={toolColor}
                  strokeWidth={toolWidth}
                  opacity={toolOpacity}
                  strokeStyle={toolPreset.strokeStyle as ToolStrokeStyle}
                  smoothing={toolPreset.smoothing}
                />

                <PageMediaLayer
                  images={images}
                  files={files}
                  activeItemId={activeElementId}
                  onImageChange={handleImageChange}
                  onImageCommit={handleImageCommit}
                  onImageDelete={handleImageDelete}
                  onImageInteractStart={promoteImage}
                  onFileChange={handleFileChange}
                  onFileCommit={handleFileCommit}
                  onFileDelete={handleFileDelete}
                  onFileInteractStart={promoteFile}
                  getTrashBounds={getTrashBounds}
                  onDragStateChange={setIsObjectDragging}
                  onTrashHoverChange={setIsTrashHover}
                  onDraftMutation={() => schedulePageDraftSnapshotFlush()}
                  registerDraftReader={(reader) => {
                    mediaDraftReaderRef.current = reader;
                    return () => {
                      if (mediaDraftReaderRef.current === reader) {
                        mediaDraftReaderRef.current = null;
                      }
                    };
                  }}
                />

                <ShapeNoteLayer
                  items={shapes}
                  activeItemId={activeElementId}
                  onChange={handleShapeChange}
                  onCommit={handleShapeCommit}
                  onDelete={handleShapeDelete}
                  onInteractStart={promoteShape}
                  getTrashBounds={getTrashBounds}
                  onDragStateChange={setIsObjectDragging}
                  onTrashHoverChange={setIsTrashHover}
                  onDraftMutation={() => schedulePageDraftSnapshotFlush()}
                  registerDraftReader={(reader) => {
                    shapeDraftReaderRef.current = reader;
                    return () => {
                      if (shapeDraftReaderRef.current === reader) {
                        shapeDraftReaderRef.current = null;
                      }
                    };
                  }}
                />

                <button
                  type="button"
                  className={`bookmark-star ${page.isBookmarked ? "bookmark-star--active" : ""}`}
                  onClick={toggleBookmark}
                  aria-label="Добавить страницу в закладки"
                >
                  ★
                </button>

                <PageFlipControls
                  canGoPrev={canGoPrev}
                  canGoNext
                  prevLabel="Назад"
                  nextLabel={nextPageLabel}
                  onPrev={() => void triggerFlip("prev")}
                  onNext={() => void triggerFlip("next")}
                />

                <div className="editor-sheet__dock">
                  <div className="editor-sheet__page-index">{pageIndexLabel}</div>
                  <button
                    type="button"
                    className={`eraser-toggle ${isEraserActive ? "eraser-toggle--active" : ""}`}
                    onClick={toggleEraser}
                    aria-pressed={isEraserActive}
                  >
                    {isEraserActive ? "Ластик включён" : "Ластик"}
                  </button>
                  <button
                    ref={trashButtonRef}
                    type="button"
                    className={`trash-dropzone ${isObjectDragging ? "trash-dropzone--ready" : ""} ${
                      isTrashHover ? "trash-dropzone--hot" : ""
                    } ${isDeletingPage ? "trash-dropzone--consume" : ""}`}
                    aria-label={isObjectDragging ? "Корзина для удаления объекта" : "Удалить текущий лист"}
                    title={isObjectDragging ? "Перетащите объект в корзину" : "Удалить текущий лист"}
                    onClick={() => void handleDeleteCurrentPage()}
                    disabled={isDeletingPage}
                  >
                    {"\u{1F5D1}"}
                  </button>
                </div>

                {isEraserActive ? (
                  <div className="editor-sheet__left-tools">
                    <div className="eraser-size-rail" aria-label="Размер ластика">
                      <span className="eraser-size-rail__value">{Math.round(toolWidth)}</span>
                      <input
                        className="eraser-size-rail__range"
                        type="range"
                        min={6}
                        max={80}
                        step={1}
                        value={toolWidth}
                        onChange={(event) => handleEraserWidthChange(Number(event.target.value))}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        </main>
      </div>

      <input ref={imageInputRef} type="file" accept="image/*" multiple hidden onChange={handleImagesChange} />
      <input ref={fileInputRef} type="file" multiple hidden onChange={handleFilesChange} />
      {isKeyboardTextMode && activeKeyboardTextElement
        ? createPortal(
            <div
              ref={keyboardPalettePopoverRef}
              className="palette-popover palette-popover--keyboard"
              role="dialog"
              aria-label={paletteDialogLabel}
              style={{ bottom: `${keyboardPaletteBottomOffset}px` }}
              onPointerDownCapture={() => {
                keyboardPaletteInteractionRef.current = true;
                window.setTimeout(() => {
                  keyboardPaletteInteractionRef.current = false;
                }, 600);
              }}
            >
              <div className="palette-popover__swatches">
                {quickPaletteColors.map((color) => (
                  <button
                    key={`keyboard-${color}`}
                    type="button"
                    className={`palette-popover__swatch ${currentPaletteColor.toLowerCase() === color.toLowerCase() ? "palette-popover__swatch--active" : ""}`}
                    style={{ background: color }}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => handlePaletteColorSelect(color)}
                    aria-label={`Выбрать цвет ${color}`}
                  />
                ))}
              </div>

              <label className="palette-popover__custom">
                <span>Цвет текста</span>
                <div className="palette-popover__picker-header">
                  <span className="palette-popover__picker-preview" style={{ background: currentPaletteColor }} aria-hidden="true" />
                  <span className="palette-popover__picker-label">Открыть большую палитру</span>
                </div>
                <input
                  className="palette-popover__picker-input"
                  type="color"
                  value={currentPaletteColor}
                  onInput={(event) => handlePaletteColorSelect((event.target as HTMLInputElement).value)}
                  onChange={(event) => handlePaletteColorSelect(event.target.value)}
                />
              </label>
            </div>,
            document.body,
          )
        : null}
      {isPaletteOpen
        ? createPortal(
            <div
              ref={palettePopoverRef}
              className="palette-popover"
              role="dialog"
              aria-label="Выбор цвета пера"
              style={{ top: `${palettePopoverPosition.top}px`, left: `${palettePopoverPosition.left}px` }}
            >
              <div className="palette-popover__swatches">
                {quickPaletteColors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`palette-popover__swatch ${currentPaletteColor.toLowerCase() === color.toLowerCase() ? "palette-popover__swatch--active" : ""}`}
                    style={{ background: color }}
                    onClick={() => handlePaletteColorSelect(color)}
                    aria-label={`Выбрать цвет ${color}`}
                  />
                ))}
              </div>

              <label className="palette-popover__custom">
                <span>Свой цвет</span>
                <input type="color" value={currentPaletteColor} onChange={(event) => handlePaletteColorSelect(event.target.value)} />
              </label>
            </div>,
            document.body,
          )
        : null}
    </section>
  );
}
