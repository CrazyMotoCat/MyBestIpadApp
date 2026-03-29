import { CSSProperties, ChangeEvent, PointerEvent as ReactPointerEvent, TouchEvent, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { DrawingCanvas, DrawingCanvasHandle } from "@/features/drawing/components/DrawingCanvas";
import {
  addFileToPage,
  addImageToPage,
  addShapeNote,
  deletePageElement,
  ensureDrawingLayer,
  getPageEditorBundle,
  replaceDrawingStrokes,
  saveTextElement,
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
import { createPage, deletePage, getPage, listPages, setPageBookmark, updatePage } from "@/features/pages/api/pages";
import { getToolPreset } from "@/shared/config/toolPresets";
import { buildPaperStyle } from "@/shared/lib/paper";
import { DrawingPoint, DrawingStroke, FileAttachmentPageElement, ImagePageElement, Notebook, Page, PageLayout, ShapeNoteElement } from "@/shared/types/models";
import { PaperPresetId, ToolPresetId, ToolStrokeStyle } from "@/shared/types/presets";
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
    Boolean(target.closest(".page-media, .shape-note, .bookmark-star, .page-corner, .editor-sheet__dock"))
  );
}

export function PageEditorPage() {
  const { pageId } = useParams();
  const navigate = useNavigate();
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const trashButtonRef = useRef<HTMLButtonElement | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const drawingCanvasRef = useRef<DrawingCanvasHandle | null>(null);
  const sheetPageRef = useRef<HTMLDivElement | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const hydratedRef = useRef(false);
  const drawingPointerIdRef = useRef<number | null>(null);
  const zIndexCounterRef = useRef(1);

  const [notebook, setNotebook] = useState<Notebook | null>(null);
  const [page, setPage] = useState<Page | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "missing">("loading");
  const [activeSection, setActiveSection] = useState<SidebarSectionId | null>(null);
  const [title, setTitle] = useState("");
  const [paperType, setPaperType] = useState<PaperPresetId>("lined");
  const [paperColor, setPaperColor] = useState("#f7f2e6");
  const [layout, setLayout] = useState<PageLayout>("freeform");
  const [text, setText] = useState("");
  const [strokes, setStrokes] = useState<DrawingStroke[]>([]);
  const [images, setImages] = useState<ImagePageElement[]>([]);
  const [files, setFiles] = useState<FileAttachmentPageElement[]>([]);
  const [shapes, setShapes] = useState<ShapeNoteElement[]>([]);
  const [selectedToolId, setSelectedToolId] = useState<ToolPresetId>("ballpoint");
  const [lastDrawingToolId, setLastDrawingToolId] = useState<ToolPresetId>("ballpoint");
  const [toolColor, setToolColor] = useState("#d7e8ff");
  const [toolWidth, setToolWidth] = useState(2.2);
  const [toolOpacity, setToolOpacity] = useState(0.92);
  const [saveState, setSaveState] = useState("Загрузка");
  const [insertColor, setInsertColor] = useState("#fff1a6");
  const [insertPaperStyle, setInsertPaperStyle] = useState<PaperPresetId>("plain");
  const [insertEdgeStyle, setInsertEdgeStyle] = useState<ShapeNoteElement["edgeStyle"]>("straight");
  const [flipDirection, setFlipDirection] = useState<"" | "left" | "right">("");
  const [swipePreviewDirection, setSwipePreviewDirection] = useState<"" | "left" | "right">("");
  const [swipePreviewProgress, setSwipePreviewProgress] = useState(0);
  const [isObjectDragging, setIsObjectDragging] = useState(false);
  const [isTrashHover, setIsTrashHover] = useState(false);
  const [activeElementId, setActiveElementId] = useState<string | null>(null);

  const toolPreset = getToolPreset(selectedToolId);
  const activeSidebarSection = sidebarSections.find((section) => section.id === activeSection) ?? null;
  const isEraserActive = selectedToolId === "eraser";
  const currentPageIndex = page ? pages.findIndex((item) => item.id === page.id) : -1;
  const canGoPrev = currentPageIndex > 0;
  const nextPageLabel = currentPageIndex >= 0 && currentPageIndex < pages.length - 1 ? "Следующая" : "Новый лист";
  const pageIndexLabel = currentPageIndex >= 0 ? `Лист ${currentPageIndex + 1} из ${pages.length}` : "Лист";

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
    setText(bundle.textElement?.content ?? "");
    setStrokes(bundle.strokes);
    setImages(bundle.images);
    setFiles(bundle.files);
    setShapes(bundle.shapes);
    setActiveElementId(null);
    zIndexCounterRef.current = getMaxElementZIndex(bundle.images, bundle.files, bundle.shapes) + 1;

    const initialTool = notebookRecord?.defaultTool ?? "ballpoint";
    const preset = getToolPreset(initialTool);
    setSelectedToolId(initialTool);
    setLastDrawingToolId(initialTool === "eraser" ? "ballpoint" : initialTool);
    setToolColor(preset.defaultColor);
    setToolWidth(preset.defaultWidth);
    setToolOpacity(preset.defaultOpacity);
    setInsertPaperStyle(pageRecord.paperType);
    setInsertColor(pageRecord.paperColor);
    setSaveState("Все изменения сохранены");
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
    setToolColor(preset.defaultColor);
    setToolWidth(preset.defaultWidth);
    setToolOpacity(preset.defaultOpacity);

    if (selectedToolId !== "eraser") {
      setLastDrawingToolId(selectedToolId);
    }
  }, [selectedToolId]);

  useEffect(() => {
    if (!pageId || !hydratedRef.current) {
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      try {
        setSaveState("Сохраняем...");
        await updatePage(pageId, {
          title,
          paperType,
          paperColor,
          layout,
        });
        await saveTextElement(pageId, text);
        await replaceDrawingStrokes(
          pageId,
          strokes.map((stroke) => ({
            ...stroke,
            pageId,
          })),
        );

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
        setSaveState("Все изменения сохранены");
      } catch (error) {
        console.error("Autosave failed", error);
        setSaveState("Ошибка сохранения");
      }
    }, 450);

    return () => window.clearTimeout(timeoutId);
  }, [layout, pageId, paperColor, paperType, strokes, text, title]);

  async function handleImagesChange(event: ChangeEvent<HTMLInputElement>) {
    if (!pageId || !event.target.files?.length) {
      return;
    }

    for (const file of Array.from(event.target.files)) {
      await addImageToPage(pageId, file);
    }

    event.target.value = "";
    await loadPage(pageId);
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

  function handleToolSelect(toolId: ToolPresetId) {
    setSelectedToolId(toolId);
  }

  function toggleEraser() {
    setSelectedToolId((currentToolId) => (currentToolId === "eraser" ? lastDrawingToolId : "eraser"));
  }

  function clearDrawingLayer() {
    setStrokes([]);
  }

  async function handleDeleteCurrentPage() {
    if (!page || !notebook || isObjectDragging) {
      return;
    }

    const shouldDelete = window.confirm(`Удалить лист "${page.title}"?`);

    if (!shouldDelete) {
      return;
    }

    const currentIndex = pages.findIndex((item) => item.id === page.id);
    const nextExistingPage = pages[currentIndex + 1] ?? pages[currentIndex - 1] ?? null;
    const result = await deletePage(page.id);

    if (!result) {
      return;
    }

    if (nextExistingPage) {
      const targetPage = result.remainingPages.find((item) => item.id === nextExistingPage.id) ?? result.remainingPages[0] ?? null;

      if (targetPage) {
        setPages(result.remainingPages);
        navigate(`/pages/${targetPage.id}`);
        return;
      }
    }

    const replacementPage = await createPage(notebook.id, "Новый лист");
    setPages([replacementPage]);
    navigate(`/pages/${replacementPage.id}`);
  }

  async function triggerFlip(direction: "prev" | "next") {
    if (!page || !notebook) {
      return;
    }

    if (flipDirection) {
      return;
    }

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
    }, 240);
  }

  function handleSheetTouchStart(event: TouchEvent<HTMLDivElement>) {
    if (isOverlayTarget(event.target) || event.touches.length !== 1) {
      touchStartXRef.current = null;
      touchStartYRef.current = null;
      setSwipePreviewDirection("");
      setSwipePreviewProgress(0);
      return;
    }

    touchStartXRef.current = event.touches[0]?.clientX ?? null;
    touchStartYRef.current = event.touches[0]?.clientY ?? null;
  }

  function handleSheetTouchMove(event: TouchEvent<HTMLDivElement>) {
    if (touchStartXRef.current === null || isObjectDragging) {
      return;
    }

    const currentX = event.touches[0]?.clientX ?? touchStartXRef.current;
    const currentY = event.touches[0]?.clientY ?? touchStartYRef.current ?? 0;
    const deltaX = currentX - touchStartXRef.current;
    const deltaY = currentY - (touchStartYRef.current ?? currentY);

    if (Math.abs(deltaX) < 18 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.1) {
      setSwipePreviewDirection("");
      setSwipePreviewProgress(0);
      return;
    }

    const direction = deltaX > 0 ? "left" : "right";
    const progress = Math.min(Math.abs(deltaX) / 180, 1);

    setSwipePreviewDirection(direction);
    setSwipePreviewProgress(progress);
  }

  function handleSheetTouchEnd(event: TouchEvent<HTMLDivElement>) {
    if (touchStartXRef.current === null || isObjectDragging) {
      return;
    }

    const endX = event.changedTouches[0]?.clientX ?? touchStartXRef.current;
    const endY = event.changedTouches[0]?.clientY ?? touchStartYRef.current ?? 0;
    const delta = endX - touchStartXRef.current;
    const deltaY = endY - (touchStartYRef.current ?? endY);
    touchStartXRef.current = null;
    touchStartYRef.current = null;

    if (Math.abs(delta) < 72 || Math.abs(delta) <= Math.abs(deltaY) * 1.2) {
      setSwipePreviewDirection("");
      setSwipePreviewProgress(0);
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

  function handleSheetPointerDownCapture(event: ReactPointerEvent<HTMLDivElement>) {
    if (isOverlayTarget(event.target) || isTextTarget(event.target)) {
      return;
    }

    const canDraw = event.pointerType === "pen" || (event.pointerType === "mouse" && event.altKey);

    if (!canDraw) {
      setActiveElementId(null);
      return;
    }

    const point = getStagePoint(event.clientX, event.clientY);

    if (!point) {
      return;
    }

    event.preventDefault();
    drawingPointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    textAreaRef.current?.blur();
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
    drawingCanvasRef.current?.appendPoint(point);
  }

  function finishSheetStroke(event: ReactPointerEvent<HTMLDivElement>) {
    if (drawingPointerIdRef.current !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
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
    flipDirection ? `editor-sheet--flip-${flipDirection}` : "",
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
      <div className="breadcrumbs">
        <Link to="/">Мои блокноты</Link>
        {notebook ? (
          <>
            <span>/</span>
            <Link to={`/notebooks/${notebook.id}/manage`}>{notebook.title}</Link>
          </>
        ) : null}
      </div>

      <div className={`editor-workbench ${activeSection ? "editor-workbench--sidebar" : "editor-workbench--compact"}`}>
        <aside className="editor-rail panel">
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
        </aside>

        {activeSection && activeSidebarSection ? (
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
              } as CSSProperties
            }
          >
            <div className="editor-sheet__inner">
              <div className="editor-sheet__status">
                <span className="editor-sheet__status-pill editor-sheet__status-pill--save">{saveState}</span>
              </div>

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
                {sheetMotionDirection ? (
                  <div
                    className={`editor-sheet__flip-curl editor-sheet__flip-curl--${sheetMotionDirection} ${
                      flipDirection ? "editor-sheet__flip-curl--flip" : "editor-sheet__flip-curl--preview"
                    }`}
                    aria-hidden="true"
                  />
                ) : null}

                <textarea
                  ref={textAreaRef}
                  className="textarea textarea--stage editor-sheet__textarea"
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  onPointerDown={() => setActiveElementId(null)}
                  placeholder="Пишите заметки, маршруты, идеи и всё, что нужно сохранить на этом листе..."
                />

                <DrawingCanvas
                  ref={drawingCanvasRef}
                  className="editor-canvas editor-sheet__canvas"
                  strokes={strokes}
                  onChange={setStrokes}
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
                    className={`trash-dropzone ${isObjectDragging ? "trash-dropzone--ready" : ""} ${isTrashHover ? "trash-dropzone--hot" : ""}`}
                    aria-label={isObjectDragging ? "Корзина для удаления объекта" : "Удалить текущий лист"}
                    title={isObjectDragging ? "Перетащите объект в корзину" : "Удалить текущий лист"}
                    onClick={() => void handleDeleteCurrentPage()}
                  >
                    {"\u{1F5D1}"}
                  </button>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>

      <input ref={imageInputRef} type="file" accept="image/*" multiple hidden onChange={handleImagesChange} />
      <input ref={fileInputRef} type="file" multiple hidden onChange={handleFilesChange} />
    </section>
  );
}
