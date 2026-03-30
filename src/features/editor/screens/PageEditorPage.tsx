import { CSSProperties, ChangeEvent, PointerEvent as ReactPointerEvent, TouchEvent, useEffect, useRef, useState } from "react";
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
import { getNotebook } from "@/features/notebooks/api/notebooks";
import { NotebookBinding } from "@/features/notebooks/components/NotebookBinding";
import { createPage, deletePage, getPage, listPages, setPageBookmark, updatePage } from "@/features/pages/api/pages";
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

type CaretDocument = Document & {
  caretPositionFromPoint?: (x: number, y: number) => { offset: number } | null;
  caretRangeFromPoint?: (x: number, y: number) => Range | null;
};

interface TextDragState {
  id: string;
  mode: "move" | "resize";
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  originWidth: number;
  originHeight: number;
}

function getMaxElementZIndex(
  images: ImagePageElement[],
  files: FileAttachmentPageElement[],
  shapes: ShapeNoteElement[],
) {
  return Math.max(0, ...images.map((item) => item.zIndex), ...files.map((item) => item.zIndex), ...shapes.map((item) => item.zIndex));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function isTextTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest("textarea, input, select, [contenteditable='true']"));
}

function isOverlayTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    Boolean(target.closest(".page-media, .shape-note, .bookmark-star, .page-corner, .editor-sheet__dock"))
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

function isPointInsideBounds(clientX: number, clientY: number, bounds: DOMRect | null) {
  if (!bounds) {
    return false;
  }

  return clientX >= bounds.left && clientX <= bounds.right && clientY >= bounds.top && clientY <= bounds.bottom;
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
  const draftStrokesRef = useRef<DrawingStroke[]>([]);
  const hasPendingStrokeSaveRef = useRef(false);
  const lastTextEraseSignatureRef = useRef<string | null>(null);
  const textDragRef = useRef<TextDragState | null>(null);

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

  const toolPreset = getToolPreset(selectedToolId);
  const navigationBlocker = useBlocker(({ historyAction }) => historyAction === "POP");
  const activeSidebarSection = sidebarSections.find((section) => section.id === activeSection) ?? null;
  const isEraserActive = selectedToolId === "eraser";
  const activeKeyboardTextElement = activeTextElementId ? textElements.find((item) => item.id === activeTextElementId) ?? null : null;
  const currentPaletteColor = activeKeyboardTextElement?.style.color ?? (activeTextElementId ? textColor : toolColor);
  const paletteLabel = activeKeyboardTextElement ? "Изменить цвет текста" : "Изменить цвет пера";
  const paletteDialogLabel = activeKeyboardTextElement ? "Выбор цвета текста" : "Выбор цвета пера";
  const isPaletteDisabled = isEraserActive && !activeKeyboardTextElement;
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

    setPage(pageRecord);
    setNotebook(notebookRecord ?? null);
    setPages(notebookPages);
    setTitle(pageRecord.title);
    setPaperType(pageRecord.paperType);
    setPaperColor(pageRecord.paperColor);
    setLayout(pageRecord.layout);
    setTextElements(bundle.textElements.map((item) => buildEditorTextElement(targetPageId, item, notebookRecord?.bindingType, textColor)));
    setStrokes(bundle.strokes);
    draftStrokesRef.current = bundle.strokes;
    setImages(bundle.images);
    setFiles(bundle.files);
    setShapes(bundle.shapes);
    setActiveElementId(null);
    setActiveTextElementId(null);
    setIsDeletingPage(false);
    setPageDeleteOffset({ x: 0, y: 0 });
    setIsKeyboardTextMode(false);
    zIndexCounterRef.current = getMaxElementZIndex(bundle.images, bundle.files, bundle.shapes) + 1;

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
    hasPendingStrokeSaveRef.current = false;
    setSaveState(SAVE_STATE_SAVED);
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
  }, [layout, pageId, paperColor, paperType, textElements, title]);

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
      await updatePage(pageId, {
        title,
        paperType,
        paperColor,
        layout,
      });
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
      setSaveState(hasPendingStrokeSaveRef.current ? SAVE_STATE_PENDING : SAVE_STATE_SAVED);
    } catch (error) {
      console.error("Save failed", error);
      setSaveState(SAVE_STATE_ERROR);
    }
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

  async function handleImagesChange(event: ChangeEvent<HTMLInputElement>) {
    if (!pageId || !event.target.files?.length) {
      return;
    }

    for (const file of Array.from(event.target.files)) {
      await addImageToPage(pageId, file);
    }

    event.target.value = "";
    await loadPage(pageId);
    setActiveSection(null);
  }

  async function handleFilesChange(event: ChangeEvent<HTMLInputElement>) {
    if (!pageId || !event.target.files?.length) {
      return;
    }

    for (const file of Array.from(event.target.files)) {
      await addFileToPage(pageId, file);
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
    setActiveElementId(promotedShape.id);
    setShapes((current) => current.map((item) => (item.id === promotedShape.id ? promotedShape : item)));
    return promotedShape;
  }

  function promoteImage(image: ImagePageElement) {
    const promotedImage = { ...image, zIndex: zIndexCounterRef.current++ };
    setActiveElementId(promotedImage.id);
    setImages((current) => current.map((item) => (item.id === promotedImage.id ? promotedImage : item)));
    return promotedImage;
  }

  function promoteFile(file: FileAttachmentPageElement) {
    const promotedFile = { ...file, zIndex: zIndexCounterRef.current++ };
    setActiveElementId(promotedFile.id);
    setFiles((current) => current.map((item) => (item.id === promotedFile.id ? promotedFile : item)));
    return promotedFile;
  }

  function handleShapeChange(nextShape: ShapeNoteElement) {
    setShapes((current) => current.map((item) => (item.id === nextShape.id ? nextShape : item)));
  }

  function handleShapeCommit(nextShape: ShapeNoteElement) {
    setShapes((current) => current.map((item) => (item.id === nextShape.id ? nextShape : item)));
    void updateShapeNote(nextShape);
  }

  function handleShapeDelete(shapeId: string) {
    setShapes((current) => current.filter((item) => item.id !== shapeId));
    setActiveElementId((current) => (current === shapeId ? null : current));
    void deletePageElement(shapeId);
  }

  function handleImageChange(nextImage: ImagePageElement) {
    setImages((current) => current.map((item) => (item.id === nextImage.id ? nextImage : item)));
  }

  function handleImageCommit(nextImage: ImagePageElement) {
    setImages((current) => current.map((item) => (item.id === nextImage.id ? nextImage : item)));
    void updatePageElement(nextImage);
  }

  function handleImageDelete(imageId: string) {
    setImages((current) => current.filter((item) => item.id !== imageId));
    setActiveElementId((current) => (current === imageId ? null : current));
    void deletePageElement(imageId);
  }

  function handleFileChange(nextFile: FileAttachmentPageElement) {
    setFiles((current) => current.map((item) => (item.id === nextFile.id ? nextFile : item)));
  }

  function handleFileCommit(nextFile: FileAttachmentPageElement) {
    setFiles((current) => current.map((item) => (item.id === nextFile.id ? nextFile : item)));
    void updatePageElement(nextFile);
  }

  function handleFileDelete(fileId: string) {
    setFiles((current) => current.filter((item) => item.id !== fileId));
    setActiveElementId((current) => (current === fileId ? null : current));
    void deletePageElement(fileId);
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

  function handleGoToNotebooks() {
    navigate("/", { replace: true });
  }

  function handleToolSelect(toolId: ToolPresetId) {
    if (toolId === "eraser") {
      setActiveSection(null);
      setIsKeyboardTextMode(false);
      if (activeTextElementId) {
        textInputRefs.current[activeTextElementId]?.blur();
      }
      setActiveTextElementId(null);
      setActiveElementId(null);
      setSwipePreviewDirection("");
      setSwipePreviewProgress(0);
    }

    setSelectedToolId(toolId);
  }

  function toggleEraser() {
    setActiveSection(null);
    setIsKeyboardTextMode(false);
    if (activeTextElementId) {
      textInputRefs.current[activeTextElementId]?.blur();
    }
    setActiveTextElementId(null);
    setActiveElementId(null);
    setSwipePreviewDirection("");
    setSwipePreviewProgress(0);
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
    if (!page || !notebook || isDeletingPage) {
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
    if (isDeletingPage || isPenInteractionLocked() || isOverlayTarget(event.target) || event.touches.length !== 1) {
      touchStartXRef.current = null;
      touchStartYRef.current = null;
      touchStartTimeRef.current = null;
      setSwipePreviewDirection("");
      setSwipePreviewProgress(0);
      setSwipePreviewOffsetX(0);
      return;
    }

    const touch = event.touches[0];

    if (!touch || !isBottomFlipZone(touch.clientY)) {
      touchStartXRef.current = null;
      touchStartYRef.current = null;
      touchStartTimeRef.current = null;
      setSwipePreviewDirection("");
      setSwipePreviewProgress(0);
      setSwipePreviewOffsetX(0);
      return;
    }

    touchStartXRef.current = touch.clientX;
    touchStartYRef.current = touch.clientY;
    touchStartTimeRef.current = performance.now();
  }

  function handleSheetTouchMove(event: TouchEvent<HTMLDivElement>) {
    if (touchStartXRef.current === null || isObjectDragging || isDeletingPage || isPenInteractionLocked()) {
      return;
    }

    const currentX = event.touches[0]?.clientX ?? touchStartXRef.current;
    const currentY = event.touches[0]?.clientY ?? touchStartYRef.current ?? 0;
    const deltaX = currentX - touchStartXRef.current;
    const deltaY = currentY - (touchStartYRef.current ?? currentY);

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
    const clampedOffsetX = clamp(deltaX, -travelDistance, travelDistance);

    setSwipePreviewDirection(direction);
    setSwipePreviewProgress(progress);
    setSwipePreviewOffsetX(clampedOffsetX);
  }

  function handleSheetTouchEnd(event: TouchEvent<HTMLDivElement>) {
    if (touchStartXRef.current === null || isObjectDragging || isDeletingPage || isPenInteractionLocked()) {
      return;
    }

    const endX = event.changedTouches[0]?.clientX ?? touchStartXRef.current;
    const endY = event.changedTouches[0]?.clientY ?? touchStartYRef.current ?? 0;
    const delta = endX - touchStartXRef.current;
    const deltaY = endY - (touchStartYRef.current ?? endY);
    const gestureDuration = touchStartTimeRef.current === null ? 0 : performance.now() - touchStartTimeRef.current;
    const bounds = sheetPageRef.current?.getBoundingClientRect();
    const travelDistance = Math.max(220, (bounds?.width ?? 0) * 0.42);
    const releaseProgress = Math.min(Math.abs(delta) / travelDistance, 1);
    touchStartXRef.current = null;
    touchStartYRef.current = null;
    touchStartTimeRef.current = null;

    if (
      releaseProgress < PAGE_FLIP_RELEASE_THRESHOLD ||
      Math.abs(delta) <= Math.abs(deltaY) * 1.2 ||
      gestureDuration < PAGE_FLIP_MIN_GESTURE_MS
    ) {
      setSwipePreviewDirection("");
      setSwipePreviewProgress(0);
      setSwipePreviewOffsetX(0);
      return;
    }

    setSwipePreviewOffsetX(0);
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

  function resetTextDragTrashState() {
    setIsObjectDragging(false);
    setIsTrashHover(false);
  }

  function handleTextElementChange(targetId: string, content: string) {
    setTextElements((current) => current.map((item) => (item.id === targetId ? { ...item, content } : item)));
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

  function beginTextTransform(targetId: string, mode: "move" | "resize", event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();

    const targetElement = textElements.find((item) => item.id === targetId);

    if (!targetElement) {
      return;
    }

    if (activeTextElementId) {
      textInputRefs.current[activeTextElementId]?.blur();
    }

    setIsKeyboardTextMode(false);
    setActiveTextElementId(null);
    setActiveElementId(null);
    const promotedElement = promoteTextElement(targetId) ?? targetElement;
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsObjectDragging(mode === "move");
    setIsTrashHover(false);
    textDragRef.current = {
      id: targetId,
      mode,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: promotedElement.x,
      originY: promotedElement.y,
      originWidth: promotedElement.width,
      originHeight: promotedElement.height,
    };
  }

  function handleTextDragStart(targetId: string, event: ReactPointerEvent<HTMLButtonElement>) {
    beginTextTransform(targetId, "move", event);
  }

  function handleTextResizeStart(targetId: string, event: ReactPointerEvent<HTMLButtonElement>) {
    beginTextTransform(targetId, "resize", event);
  }

  function handleTextDragMove(targetId: string, event: ReactPointerEvent<HTMLButtonElement>) {
    const dragState = textDragRef.current;

    if (!dragState || dragState.id !== targetId || dragState.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const targetElement = textElements.find((item) => item.id === targetId);
    const bounds = sheetPageRef.current?.getBoundingClientRect();

    if (!targetElement || !bounds) {
      return;
    }

    if (dragState.mode === "move") {
      const maxX = Math.max(0, bounds.width - targetElement.width);
      const maxY = Math.max(0, bounds.height - targetElement.height);
      const nextX = clamp(dragState.originX + (event.clientX - dragState.startX), 0, maxX);
      const nextY = clamp(dragState.originY + (event.clientY - dragState.startY), 0, maxY);
      setIsObjectDragging(true);
      setIsTrashHover(isPointInsideBounds(event.clientX, event.clientY, getTrashBounds()));

      setTextElements((current) =>
        current.map((item) => (item.id === targetId ? { ...item, x: nextX, y: nextY } : item)),
      );
      return;
    }

    const maxWidth = Math.max(TEXT_BLOCK_MIN_WIDTH, Math.min(TEXT_BLOCK_MAX_WIDTH, bounds.width - targetElement.x));
    const maxHeight = Math.max(TEXT_BLOCK_MIN_HEIGHT, bounds.height - targetElement.y);
    const nextWidth = clamp(dragState.originWidth + (event.clientX - dragState.startX), TEXT_BLOCK_MIN_WIDTH, maxWidth);
    const nextHeight = clamp(dragState.originHeight + (event.clientY - dragState.startY), TEXT_BLOCK_MIN_HEIGHT, maxHeight);

    setTextElements((current) =>
      current.map((item) => (item.id === targetId ? { ...item, width: nextWidth, height: nextHeight } : item)),
    );
  }

  function handleTextDragEnd(targetId: string, event: ReactPointerEvent<HTMLButtonElement>) {
    const dragState = textDragRef.current;

    if (!dragState || dragState.id !== targetId || dragState.pointerId !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    event.preventDefault();
    event.stopPropagation();
    const shouldDelete = dragState.mode === "move" && isPointInsideBounds(event.clientX, event.clientY, getTrashBounds());
    textDragRef.current = null;
    resetTextDragTrashState();

    if (shouldDelete) {
      eraseTextElement(targetId);
    }
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
        return clamp(position.offset, 0, content.length);
      }
    }

    if (typeof caretDocument.caretRangeFromPoint === "function") {
      const range = caretDocument.caretRangeFromPoint(clientX, clientY);

      if (range) {
        return clamp(range.startOffset, 0, content.length);
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
    const safeLineIndex = clamp(targetLineIndex, 0, Math.max(lines.length - 1, 0));
    const targetLine = lines[safeLineIndex] ?? "";
    let offset = 0;

    for (let lineIndex = 0; lineIndex < safeLineIndex; lineIndex += 1) {
      offset += (lines[lineIndex]?.length ?? 0) + 1;
    }

    if (!targetLine.length) {
      return clamp(offset, 0, content.length);
    }

    const wrappedColumn = clamp(Math.round(localX / averageCharWidth), 0, Math.max(columnsPerLine, targetLine.length));
    return clamp(offset + Math.min(targetLine.length, wrappedColumn), 0, content.length);
  }

  function eraseTextAtPoint(targetId: string, clientX: number, clientY: number) {
    const textArea = textInputRefs.current[targetId];
    const targetElement = textElements.find((item) => item.id === targetId);

    if (!textArea || !targetElement) {
      return;
    }

    if (targetElement.content.length <= 1) {
      eraseTextElement(targetId);
      return;
    }

    const eraseIndex = getTextEraseIndex(textArea, clientX, clientY);

    if (eraseIndex === null) {
      eraseTextElement(targetId);
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
          delete textInputRefs.current[targetId];
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
    if (activeTextElementId === targetId) {
      setIsKeyboardTextMode(false);
      setActiveTextElementId(null);
    }

    delete textInputRefs.current[targetId];
    setTextElements((current) => current.filter((item) => item.id !== targetId));
  }

  function handleTextLayerPointerDown(targetId: string, event: ReactPointerEvent<HTMLTextAreaElement>) {
    setActiveElementId(null);

    if (isEraserActive) {
      event.preventDefault();
      eraseTextAtPoint(targetId, event.clientX, event.clientY);
      return;
    }

    if (event.pointerType === "pen") {
      event.preventDefault();
      setIsKeyboardTextMode(false);
      textInputRefs.current[targetId]?.setAttribute("inputmode", "none");
      textInputRefs.current[targetId]?.blur();
      return;
    }

    const textArea = textInputRefs.current[targetId];

    if (textArea) {
      focusTextInput(targetId);
    }

    enableKeyboardTextMode(targetId);
  }

  function handleTextLayerPointerMoveCapture(event: ReactPointerEvent<HTMLTextAreaElement>) {
    if (isEraserActive) {
      event.preventDefault();
      return;
    }

    if (event.pointerType === "pen") {
      event.preventDefault();
    }
  }

  function handleTextLayerPointerUpCapture(event: ReactPointerEvent<HTMLTextAreaElement>) {
    if (isEraserActive) {
      event.preventDefault();
      lastTextEraseSignatureRef.current = null;
      return;
    }

    if (event.pointerType === "pen") {
      event.preventDefault();
    }
  }

  function handleTextLayerBlur(targetId: string) {
    if (keyboardPaletteInteractionRef.current) {
      return;
    }

    if (activeTextElementId === targetId) {
      setIsKeyboardTextMode(false);
      setActiveTextElementId(null);
    }

    textInputRefs.current[targetId]?.setAttribute("inputmode", "none");
    if (textInputRefs.current[targetId]) {
      textInputRefs.current[targetId]!.readOnly = true;
    }
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

    const canDraw = event.pointerType === "pen" || (event.pointerType === "mouse" && event.altKey);
    const isTextLayerTarget = isTextTarget(event.target);

    if (isOverlayTarget(event.target)) {
      return;
    }

    if (isTextLayerTarget && !canDraw) {
      return;
    }

    if (event.pointerType === "touch" && isBottomFlipZone(event.clientY)) {
      setActiveElementId(null);
      return;
    }

    if (!canDraw) {
      setActiveElementId(null);
      if (!pageId) {
        return;
      }

      const frame = getTextElementFrameAtPoint(event.clientX, event.clientY);

      if (!frame) {
        return;
      }

      const nextTextElement = {
        ...buildEditorTextElement(pageId, null, notebook?.bindingType, textColor),
        id: createId("element"),
        ...frame,
        zIndex: zIndexCounterRef.current++,
      };

      flushSync(() => {
        setTextElements((current) => [...current, nextTextElement]);
        setActiveTextElementId(nextTextElement.id);
        setIsKeyboardTextMode(true);
      });

      if (!focusTextInput(nextTextElement.id)) {
        enableKeyboardTextMode(nextTextElement.id);
      }
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
    setIsKeyboardTextMode(false);
    if (activeTextElementId) {
      textInputRefs.current[activeTextElementId]?.blur();
    }
    setActiveTextElementId(null);
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
            <BookmarksPanel notebookId={notebook.id} currentPageId={currentPageId} pages={pages} />
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
                  const isActiveTextElement = isKeyboardTextMode && activeTextElementId === textElement.id;

                  return (
                    <div
                      key={textElement.id}
                      className={`editor-text-block ${isActiveTextElement ? "editor-text-block--active" : ""}`}
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
                          isActiveTextElement ? "editor-sheet__textarea--typing" : "editor-sheet__textarea--idle"
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
                          setActiveTextElementId(textElement.id);
                          setIsKeyboardTextMode(true);
                        }}
                        readOnly={!isActiveTextElement}
                        autoFocus={isActiveTextElement}
                        spellCheck={false}
                        autoCorrect="off"
                        autoCapitalize="off"
                        inputMode={isActiveTextElement ? "text" : "none"}
                      />
                    </div>
                  );
                })}

                <DrawingCanvas
                  ref={drawingCanvasRef}
                  className="editor-canvas editor-sheet__canvas"
                  strokes={strokes}
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
