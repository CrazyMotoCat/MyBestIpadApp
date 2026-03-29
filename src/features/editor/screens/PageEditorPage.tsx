import { ChangeEvent, TouchEvent, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { DrawingCanvas } from "@/features/drawing/components/DrawingCanvas";
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
import { AssetGallery } from "@/features/editor/components/AssetGallery";
import { BookmarksPanel } from "@/features/editor/components/BookmarksPanel";
import { FileAttachmentList } from "@/features/editor/components/FileAttachmentList";
import { PageMediaLayer } from "@/features/editor/components/PageMediaLayer";
import { PageFlipControls } from "@/features/editor/components/PageFlipControls";
import { PaperPresetPicker } from "@/features/editor/components/PaperPresetPicker";
import { ShapeInsertLibrary } from "@/features/editor/components/ShapeInsertLibrary";
import { ShapeNoteLayer } from "@/features/editor/components/ShapeNoteLayer";
import { ToolPresetPicker } from "@/features/editor/components/ToolPresetPicker";
import { getNotebook } from "@/features/notebooks/api/notebooks";
import { getPage, listPages, setPageBookmark, updatePage } from "@/features/pages/api/pages";
import { getToolPreset } from "@/shared/config/toolPresets";
import { buildPaperStyle } from "@/shared/lib/paper";
import { DrawingStroke, FileAttachmentPageElement, ImagePageElement, Notebook, Page, PageLayout, ShapeNoteElement } from "@/shared/types/models";
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

export function PageEditorPage() {
  const { pageId } = useParams();
  const navigate = useNavigate();
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const trashButtonRef = useRef<HTMLButtonElement | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const hydratedRef = useRef(false);
  const [notebook, setNotebook] = useState<Notebook | null>(null);
  const [page, setPage] = useState<Page | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "missing">("loading");
  const [activeSection, setActiveSection] = useState<SidebarSectionId | null>("inserts");
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
  const [isObjectDragging, setIsObjectDragging] = useState(false);
  const [isTrashHover, setIsTrashHover] = useState(false);

  const toolPreset = getToolPreset(selectedToolId);
  const activeSidebarSection = sidebarSections.find((section) => section.id === activeSection) ?? null;
  const isEraserActive = selectedToolId === "eraser";

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
    setShapes((current) => [...current, shape]);
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

  function triggerFlip(direction: "prev" | "next") {
    if (!page || !notebook) {
      return;
    }

    const currentIndex = pages.findIndex((item) => item.id === page.id);
    const targetIndex = direction === "next" ? currentIndex + 1 : currentIndex - 1;
    const targetPage = pages[targetIndex];

    if (!targetPage) {
      return;
    }

    setFlipDirection(direction === "next" ? "right" : "left");
    window.setTimeout(() => {
      navigate(`/pages/${targetPage.id}`);
      setFlipDirection("");
    }, 160);
  }

  function handleSheetTouchStart(event: TouchEvent<HTMLDivElement>) {
    touchStartXRef.current = event.touches[0]?.clientX ?? null;
  }

  function handleSheetTouchEnd(event: TouchEvent<HTMLDivElement>) {
    if (touchStartXRef.current === null) {
      return;
    }

    const endX = event.changedTouches[0]?.clientX ?? touchStartXRef.current;
    const delta = endX - touchStartXRef.current;
    touchStartXRef.current = null;

    if (delta > 70) {
      triggerFlip("prev");
    } else if (delta < -70) {
      triggerFlip("next");
    }
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

  function renderSidebarContent() {
    switch (activeSection) {
      case "inserts":
        return (
          <div className="stack">
            <div className="section-head">
              <div>
                <h2>Вставки</h2>
                <p>Фигурные заметки, карточки, изображения и файлы для свободной композиции на листе.</p>
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
              Долгое касание по объекту на листе включает перенос. После этого объект можно увести в корзину рядом с ластиком.
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
                <p>Быстрый выбор письменных инструментов для основного текста, заметок и подчёркиваний.</p>
              </div>
            </div>
            <ToolPresetPicker selectedId={selectedToolId} onSelect={handleToolSelect} categories={["pens", "markers"]} />
            <label className="stack">
              <span>Цвет</span>
              <input className="color-input" type="color" value={toolColor} onChange={(event) => setToolColor(event.target.value)} />
            </label>
            <label className="stack">
              <span>Толщина: {toolWidth.toFixed(1)}</span>
              <input
                className="range"
                type="range"
                min={1}
                max={24}
                step={0.5}
                value={toolWidth}
                onChange={(event) => setToolWidth(Number(event.target.value))}
              />
            </label>
          </div>
        );
      case "art":
        return (
          <div className="stack">
            <div className="section-head">
              <div>
                <h2>Кисти и карандаши</h2>
                <p>Более живая подача для скетчей, акцентов и рисунков поверх текстовой страницы.</p>
              </div>
            </div>
            <ToolPresetPicker selectedId={selectedToolId} onSelect={handleToolSelect} categories={["brushes", "pencils", "special"]} />
            <label className="stack">
              <span>Цвет</span>
              <input className="color-input" type="color" value={toolColor} onChange={(event) => setToolColor(event.target.value)} />
            </label>
            <label className="stack">
              <span>Прозрачность: {Math.round(toolOpacity * 100)}%</span>
              <input
                className="range"
                type="range"
                min={0.1}
                max={1}
                step={0.05}
                value={toolOpacity}
                onChange={(event) => setToolOpacity(Number(event.target.value))}
              />
            </label>
          </div>
        );
      case "paper":
        return (
          <div className="stack">
            <div className="section-head">
              <div>
                <h2>Лист</h2>
                <p>Название страницы, макет, бумага и цвет основы без отдельного верхнего блока.</p>
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
              <button
                type="button"
                className="icon-button editor-sidebar__close"
                aria-label="Свернуть панель"
                onClick={() => setActiveSection(null)}
              >
                ×
              </button>
            </div>
            {renderSidebarContent()}
          </aside>
        ) : null}

        <main className="editor-main stack">
          <section
            className={`editor-sheet ${flipDirection ? `editor-sheet--flip-${flipDirection}` : ""}`}
            style={buildPaperStyle(paperType, paperColor)}
            onTouchStart={handleSheetTouchStart}
            onTouchEnd={handleSheetTouchEnd}
          >
            <div className="editor-sheet__inner">
              <div className="editor-sheet__status">
                <span className="editor-sheet__status-pill editor-sheet__status-pill--save">{saveState}</span>
              </div>

              <textarea
                className="textarea textarea--stage editor-sheet__textarea"
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="Пишите заметки, сценарии, идеи маршрутов и всё, что нужно сохранить офлайн..."
              />

              <div className="editor-sheet__tools">
                <div className="editor-sheet__tool-meta">
                  <strong>Рисование</strong>
                  <span>
                    {toolPreset.label} • {strokeStyleLabels[toolPreset.strokeStyle]}
                  </span>
                </div>
                <Button variant="ghost" onClick={() => setStrokes([])}>
                  Очистить слой
                </Button>
              </div>

              <DrawingCanvas
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
                onImageChange={handleImageChange}
                onImageCommit={handleImageCommit}
                onImageDelete={handleImageDelete}
                onFileChange={handleFileChange}
                onFileCommit={handleFileCommit}
                onFileDelete={handleFileDelete}
                getTrashBounds={getTrashBounds}
                onDragStateChange={setIsObjectDragging}
                onTrashHoverChange={setIsTrashHover}
              />

              <ShapeNoteLayer
                items={shapes}
                onChange={handleShapeChange}
                onCommit={handleShapeCommit}
                onDelete={handleShapeDelete}
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
                canGoPrev={pages.findIndex((item) => item.id === page.id) > 0}
                canGoNext={pages.findIndex((item) => item.id === page.id) < pages.length - 1}
                onPrev={() => triggerFlip("prev")}
                onNext={() => triggerFlip("next")}
              />

              <div className="editor-sheet__dock">
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
                  aria-label="Корзина для удаления объекта"
                >
                  {"\u{1F5D1}"}
                </button>
              </div>
            </div>
          </section>

          <div className="editor-support-grid">
            <section className="editor-support-card panel stack">
              <div className="section-head">
                <div>
                  <h3>Изображения</h3>
                  <p>Все добавленные снимки и картинки страницы остаются локально доступны офлайн.</p>
                </div>
              </div>
              <AssetGallery items={images} />
            </section>

            <section className="editor-support-card panel stack">
              <div className="section-head">
                <div>
                  <h3>Файлы</h3>
                  <p>Прикреплённые файлы под рукой, без отдельного промежуточного экрана.</p>
                </div>
              </div>
              <FileAttachmentList items={files} />
            </section>
          </div>
        </main>
      </div>

      <input ref={imageInputRef} type="file" accept="image/*" multiple hidden onChange={handleImagesChange} />
      <input ref={fileInputRef} type="file" multiple hidden onChange={handleFilesChange} />
    </section>
  );
}
