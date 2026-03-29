import { ChangeEvent, TouchEvent, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getToolPreset } from "@/shared/config/toolPresets";
import { getPaperPreset } from "@/shared/config/paperPresets";
import { DrawingCanvas } from "@/features/drawing/components/DrawingCanvas";
import {
  addFileToPage,
  addImageToPage,
  addShapeNote,
  ensureDrawingLayer,
  getPageEditorBundle,
  replaceDrawingStrokes,
  saveTextElement,
  updateShapeNote,
} from "@/features/editor/api/editor";
import { AssetGallery } from "@/features/editor/components/AssetGallery";
import { BookmarksPanel } from "@/features/editor/components/BookmarksPanel";
import { FileAttachmentList } from "@/features/editor/components/FileAttachmentList";
import { PaperPresetPicker } from "@/features/editor/components/PaperPresetPicker";
import { PageFlipControls } from "@/features/editor/components/PageFlipControls";
import { ShapeInsertLibrary } from "@/features/editor/components/ShapeInsertLibrary";
import { ShapeNoteLayer } from "@/features/editor/components/ShapeNoteLayer";
import { ToolPresetPicker } from "@/features/editor/components/ToolPresetPicker";
import { getNotebook } from "@/features/notebooks/api/notebooks";
import { getPage, listPages, setPageBookmark, updatePage } from "@/features/pages/api/pages";
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
  { id: "pens", icon: "✒", label: "Ручки" },
  { id: "art", icon: "🖌", label: "Кисти" },
  { id: "paper", icon: "◫", label: "Лист" },
  { id: "bookmarks", icon: "★", label: "Закладки" },
] as const;

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
  const touchStartXRef = useRef<number | null>(null);
  const [notebook, setNotebook] = useState<Notebook | null>(null);
  const [page, setPage] = useState<Page | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "missing">("loading");
  const [activeSection, setActiveSection] = useState<(typeof sidebarSections)[number]["id"]>("inserts");
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
  const [toolColor, setToolColor] = useState("#d7e8ff");
  const [toolWidth, setToolWidth] = useState(2.2);
  const [toolOpacity, setToolOpacity] = useState(0.92);
  const [saveState, setSaveState] = useState("Загрузка");
  const [insertColor, setInsertColor] = useState("#fff1a6");
  const [insertPaperStyle, setInsertPaperStyle] = useState<PaperPresetId>("plain");
  const [insertEdgeStyle, setInsertEdgeStyle] = useState<ShapeNoteElement["edgeStyle"]>("straight");
  const [flipDirection, setFlipDirection] = useState<"" | "left" | "right">("");
  const hydratedRef = useRef(false);

  const toolPreset = getToolPreset(selectedToolId);
  const paperPreset = getPaperPreset(paperType);
  const layoutLabel = layoutOptions.find((option) => option.value === layout)?.label ?? layout;

  async function loadPage(targetPageId: string) {
    const pageRecord = await getPage(targetPageId);

    if (!pageRecord) {
      setPage(null);
      setStatus("missing");
      return;
    }

    const notebookRecord = await getNotebook(pageRecord.notebookId);
    const [bundle, notebookPages] = await Promise.all([
      getPageEditorBundle(targetPageId),
      listPages(pageRecord.notebookId),
    ]);

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
  }, [selectedToolId]);

  useEffect(() => {
    if (!pageId || !page || !hydratedRef.current) {
      return;
    }

    setSaveState("Сохраняем...");

    const timeoutId = window.setTimeout(async () => {
      try {
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
  }, [layout, page, pageId, paperColor, paperType, strokes, text, title]);

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
    void updateShapeNote(nextShape);
  }

  async function toggleBookmark() {
    if (!pageId || !page) {
      return;
    }

    const updated = await setPageBookmark(pageId, !page.isBookmarked);
    setPage(updated);
    setPages((current) => current.map((item) => (item.id === updated.id ? updated : item)));
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

  return (
    <section className="page-section editor-screen">
      <div className="breadcrumbs">
        <Link to="/">Мои блокноты</Link>
        {notebook ? (
          <>
            <span>/</span>
            <Link to={`/notebooks/${notebook.id}`}>{notebook.title}</Link>
          </>
        ) : null}
        <span>/</span>
        <span>{page.title}</span>
      </div>

      <div className="editor-workbench">
        <aside className="editor-rail panel">
          {sidebarSections.map((section) => (
            <button
              key={section.id}
              type="button"
              className={`rail-button ${activeSection === section.id ? "rail-button--active" : ""}`}
              onClick={() => setActiveSection(section.id)}
            >
              <span>{section.icon}</span>
              <span>{section.label}</span>
            </button>
          ))}
        </aside>

        <aside className="editor-sidebar panel">
          {activeSection === "inserts" ? (
            <div className="stack">
              <div className="section-head">
                <div>
                  <h2>Формы вставок</h2>
                  <p>Отдельные элементы страницы, которые можно вставлять, двигать и растягивать.</p>
                </div>
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
          ) : null}

          {activeSection === "pens" ? (
            <div className="stack">
              <div className="section-head">
                <div>
                  <h2>Ручки и маркеры</h2>
                  <p>Свободно переключайтесь между любыми пресетами и цветами.</p>
                </div>
              </div>
              <ToolPresetPicker selectedId={selectedToolId} onSelect={setSelectedToolId} categories={["pens", "markers"]} />
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
          ) : null}

          {activeSection === "art" ? (
            <div className="stack">
              <div className="section-head">
                <div>
                  <h2>Кисти и карандаши</h2>
                  <p>Художественные инструменты тоже доступны без жёсткого ограничения одним пресетом.</p>
                </div>
              </div>
              <ToolPresetPicker selectedId={selectedToolId} onSelect={setSelectedToolId} categories={["brushes", "pencils", "special"]} />
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
          ) : null}

          {activeSection === "paper" ? (
            <div className="stack">
              <div className="section-head">
                <div>
                  <h2>Цвет и бумага листа</h2>
                  <p>Меняется цвет основы, но тип бумаги и её разметка сохраняются.</p>
                </div>
              </div>
              <PaperPresetPicker selectedId={paperType} onSelect={setPaperType} />
              <label className="stack">
                <span>Цвет листа</span>
                <input className="color-input" type="color" value={paperColor} onChange={(event) => setPaperColor(event.target.value)} />
              </label>
            </div>
          ) : null}

          {activeSection === "bookmarks" && notebook ? (
            <div className="stack">
              <div className="section-head">
                <div>
                  <h2>Закладки</h2>
                  <p>Список страниц, которые вы отметили звездой.</p>
                </div>
              </div>
              <BookmarksPanel notebookId={notebook.id} currentPageId={page.id} pages={pages} />
            </div>
          ) : null}
        </aside>

        <main className="editor-main stack">
          <header className="editor-topbar panel">
            <div className="stack editor-topbar__content">
              <input
                className="editor-title-input"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Название страницы"
              />
              <div className="editor-topbar__meta">
                <span>{saveState}</span>
                <span>Макет: {layoutLabel}</span>
                <span>Бумага: {paperPreset.label}</span>
                <span>Штрих: {toolPreset.label} • {strokeStyleLabels[toolPreset.strokeStyle]}</span>
              </div>
            </div>
            <div className="editor-topbar__actions">
              <select className="select" value={layout} onChange={(event) => setLayout(event.target.value as PageLayout)}>
                {layoutOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <Button variant="ghost" onClick={() => imageInputRef.current?.click()}>
                Добавить изображение
              </Button>
              <Button variant="ghost" onClick={() => fileInputRef.current?.click()}>
                Прикрепить файл
              </Button>
            </div>
          </header>

          <section
            className={`editor-sheet ${flipDirection ? `editor-sheet--flip-${flipDirection}` : ""}`}
            style={buildPaperStyle(paperType, paperColor)}
            onTouchStart={handleSheetTouchStart}
            onTouchEnd={handleSheetTouchEnd}
          >
            <div className="editor-sheet__inner">
              <label className="stack">
                <span>Текст страницы</span>
                <textarea
                  className="textarea textarea--stage"
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  placeholder="Пишите заметки, сценарии, идеи маршрутов и всё, что нужно сохранить офлайн..."
                />
              </label>

              <div className="stack">
                <div className="section-head">
                  <div>
                    <h3>Рисование</h3>
                    <p>Можно свободно переключаться между всеми ручками, кистями, маркерами и карандашами.</p>
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
              </div>

              <ShapeNoteLayer items={shapes} onChange={handleShapeChange} />

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
            </div>
          </section>

          <section className="stage-assets panel stack">
            <div className="section-head">
              <div>
                <h3>Изображения</h3>
                <p>Изображения сохраняются локально и доступны офлайн после перезагрузки.</p>
              </div>
            </div>
            <AssetGallery items={images} />
          </section>

          <section className="stage-assets panel stack">
            <div className="section-head">
              <div>
                <h3>Файлы</h3>
                <p>К странице можно прикреплять любые нужные файлы и хранить их локально.</p>
              </div>
            </div>
            <FileAttachmentList items={files} />
          </section>
        </main>
      </div>

      <input ref={imageInputRef} type="file" accept="image/*" multiple hidden onChange={handleImagesChange} />
      <input ref={fileInputRef} type="file" multiple hidden onChange={handleFilesChange} />
    </section>
  );
}
