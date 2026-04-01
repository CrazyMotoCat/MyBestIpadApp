import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { getTextElement } from "@/features/editor/api/editor";
import { FileAttachmentList } from "@/features/editor/components/FileAttachmentList";
import { attachFilesToNotebook, getNotebook, listNotebookAttachments, updateNotebook } from "@/features/notebooks/api/notebooks";
import { CreateNotebookModal } from "@/features/notebooks/components/CreateNotebookModal";
import { NotebookBinding } from "@/features/notebooks/components/NotebookBinding";
import { createPage, listPages, updatePage } from "@/features/pages/api/pages";
import { notebookTypePresets } from "@/shared/config/notebookPresets";
import { getPaperPreset } from "@/shared/config/paperPresets";
import { getToolPreset } from "@/shared/config/toolPresets";
import { getStorageRecoveryMessage } from "@/shared/lib/db/storageErrors";
import { getFilesUploadPreflight } from "@/shared/lib/db/storagePreflight";
import { buildPaperStyle } from "@/shared/lib/paper";
import { useAssetObjectUrl } from "@/shared/lib/useAssetObjectUrl";
import { Notebook, NotebookAttachment, Page } from "@/shared/types/models";
import { Button } from "@/shared/ui/Button";
import { Panel } from "@/shared/ui/Panel";

interface PageCardData extends Page {
  preview: string;
}

const notebookDateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "short",
});

function formatPageMeta(dateIso: string) {
  return `Обновлена ${notebookDateFormatter.format(new Date(dateIso))}`;
}

export function NotebookPage() {
  const { notebookId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [title, setTitle] = useState("");
  const [pageSearchQuery, setPageSearchQuery] = useState("");
  const [showOnlyBookmarks, setShowOnlyBookmarks] = useState(false);
  const [notebook, setNotebook] = useState<Notebook | null>(null);
  const [pages, setPages] = useState<PageCardData[]>([]);
  const [attachments, setAttachments] = useState<NotebookAttachment[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "missing">("loading");
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const sourcePageId =
    typeof location.state === "object" &&
    location.state &&
    "sourcePageId" in location.state &&
    typeof location.state.sourcePageId === "string"
      ? location.state.sourcePageId
      : null;

  const coverImageUrl = useAssetObjectUrl(notebook?.coverImageAssetId);
  const highlightedPageId = sourcePageId ?? pages[0]?.id ?? null;
  const filteredPages = useMemo(() => {
    const normalizedQuery = pageSearchQuery.trim().toLowerCase();

    return pages.filter((page) => {
      if (showOnlyBookmarks && !page.isBookmarked) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return page.title.toLowerCase().includes(normalizedQuery) || page.preview.toLowerCase().includes(normalizedQuery);
    });
  }, [pageSearchQuery, pages, showOnlyBookmarks]);
  const quickPages = useMemo(
    () => [...pages].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.pageOrder - b.pageOrder).slice(0, 8),
    [pages],
  );

  async function load() {
    if (!notebookId) {
      setStatus("missing");
      return;
    }

    setStatus("loading");
    const notebookRecord = await getNotebook(notebookId);

    if (!notebookRecord) {
      setNotebook(null);
      setPages([]);
      setStatus("missing");
      return;
    }

    const pageRecords = await listPages(notebookId);
    const pageCards = await Promise.all(
      pageRecords.map(async (page) => ({
        ...page,
        preview: (await getTextElement(page.id))?.content.slice(0, 140) || "Пустая страница",
      })),
    );

    setNotebook(notebookRecord);
    setPages(pageCards);
    setAttachments(await listNotebookAttachments(notebookId));
    setStatus("ready");
  }

  useEffect(() => {
    void load();
  }, [notebookId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!notebookId) {
      return;
    }

    const normalizedTitle = title.trim();
    const page = await createPage(notebookId, normalizedTitle || `Новая страница ${pages.length + 1}`);
    setTitle("");
    await load();
    navigate(`/pages/${page.id}`);
  }

  async function handleFilesChange(event: ChangeEvent<HTMLInputElement>) {
    if (!notebookId || !event.target.files?.length) {
      return;
    }

    const files = Array.from(event.target.files);
    const preflight = getFilesUploadPreflight(files, "файлов блокнота");

    if (preflight.level === "blocked") {
      setAttachmentError(preflight.message);
      event.target.value = "";
      return;
    }

    if (preflight.level === "warning" && preflight.message && !window.confirm(`${preflight.message}\n\nПродолжить добавление файлов в блокнот?`)) {
      setAttachmentError(preflight.message);
      event.target.value = "";
      return;
    }

    try {
      await attachFilesToNotebook(notebookId, files);
      setAttachmentError(null);
    } catch (error) {
      console.error("Notebook attachment upload failed", error);
      setAttachmentError(getStorageRecoveryMessage(error, "файлы блокнота"));
    }

    event.target.value = "";
    await load();
  }

  if (status === "loading") {
    return (
      <section className="page-section">
        <Panel className="empty-state">Загружаем блокнот...</Panel>
      </section>
    );
  }

  if (!notebook) {
    return (
      <section className="page-section">
        <Panel className="empty-state">
          Блокнот не найден. <Link to="/">Вернуться к списку</Link>
        </Panel>
      </section>
    );
  }

  const notebookTypeLabel =
    notebookTypePresets.find((preset) => preset.id === notebook.notebookType)?.label ?? notebook.notebookType;
  const paperLabel = getPaperPreset(notebook.defaultPaperType).label;
  const toolLabel = getToolPreset(notebook.defaultTool).label;
  const heroCoverStyle =
    notebook.coverMode === "custom" && coverImageUrl
      ? {
          backgroundImage: `${notebook.coverBackground}, linear-gradient(180deg, rgba(7,9,15,.34), rgba(7,9,15,.54)), url("${coverImageUrl}")`,
          backgroundSize: "cover, cover, cover",
          backgroundPosition: "center, center, center",
        }
      : { background: notebook.coverBackground };

  return (
    <section className="page-section notebook-screen">
      <div className="breadcrumbs">
        <Link to="/">Мои блокноты</Link>
        <span>/</span>
        <span>{notebook.title}</span>
      </div>

      <header className="notebook-hero panel">
        <div className="notebook-hero__cover" style={heroCoverStyle}>
          <NotebookBinding bindingType={notebook.bindingType} />
        </div>
        <div className="stack">
          <h1 className="notebook-hero__title">{notebook.title}</h1>
          <p className="notebook-hero__subtitle">
            Тип: {notebookTypeLabel} • Бумага: {paperLabel} • Инструмент: {toolLabel}
          </p>
          <div className="inline-actions">
            {pages[0] ? <Button onClick={() => navigate(`/pages/${pages[0].id}`)}>Открыть рабочую страницу</Button> : null}
            <Button variant="ghost" onClick={() => setIsEditOpen(true)}>
              Изменить оформление
            </Button>
          </div>
          <form className="inline-form" onSubmit={handleSubmit}>
            <input
              className="input"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Название новой страницы"
            />
            <Button type="submit">Создать страницу</Button>
          </form>
        </div>
      </header>

      <div className="page-columns">
        <Panel className="stack">
          <div className="section-head">
            <div>
              <h2>Страницы</h2>
              <p>Новые страницы сразу наследуют бумагу, цвет листа, стиль и визуальную основу блокнота.</p>
            </div>
          </div>

          <div className="screen-caption">
            <span className="tag">Всего страниц: {pages.length}</span>
            <span className="tag">Закладок: {pages.filter((page) => page.isBookmarked).length}</span>
          </div>

          <div className="page-strip">
            {quickPages.map((page) => (
              <Link
                key={page.id}
                to={`/pages/${page.id}`}
                className={`page-strip-card ${sourcePageId === page.id ? "page-strip-card--active" : ""}`}
              >
                <div className="page-strip-card__sheet" style={buildPaperStyle(page.paperType, page.paperColor)} />
                <div className="stack">
                  <strong>
                    {page.isBookmarked ? "★ " : ""}
                    {page.title}
                  </strong>
                  <span className="muted">Лист {page.pageOrder}</span>
                  <span className="muted">{formatPageMeta(page.updatedAt)}</span>
                </div>
              </Link>
            ))}
          </div>

          <div className="search-toolbar search-toolbar--tight">
            <input
              className="input search-toolbar__input"
              value={pageSearchQuery}
              onChange={(event) => setPageSearchQuery(event.target.value)}
              placeholder="Поиск страницы по названию или фрагменту текста"
            />
            <button
              type="button"
              className={`toggle-chip ${showOnlyBookmarks ? "toggle-chip--active" : ""}`}
              onClick={() => setShowOnlyBookmarks((current) => !current)}
            >
              {showOnlyBookmarks ? "Только закладки" : "Все страницы"}
            </button>
            <div className="search-toolbar__meta">
              {filteredPages.length} из {pages.length}
            </div>
          </div>

          {filteredPages.length > 0 ? (
            <div className="page-quick-strip" aria-label="Быстрый переход по страницам">
              {filteredPages.slice(0, 10).map((page) => (
                <Link
                  key={`${page.id}-quick`}
                  to={`/pages/${page.id}`}
                  className={`page-quick-chip ${page.id === highlightedPageId ? "page-quick-chip--active" : ""}`}
                >
                  <span className="page-quick-chip__index">Лист {page.pageOrder}</span>
                  <span className="page-quick-chip__title">{page.title}</span>
                  {page.isBookmarked ? <span className="page-quick-chip__mark">★</span> : null}
                </Link>
              ))}
            </div>
          ) : null}

          <div className="grid grid--pages">
            {filteredPages.length === 0 ? (
              <div className="empty-inline">
                {pageSearchQuery.trim() || showOnlyBookmarks
                  ? "Под такой фильтр страницы не нашлись."
                  : "Страниц пока нет. Создайте первую."}
              </div>
            ) : null}

            {filteredPages.map((page) => (
              <Link key={page.id} to={`/pages/${page.id}`} className="page-link-card">
                <div className="page-card__preview" style={buildPaperStyle(page.paperType, page.paperColor)} />
                <div className="stack">
                  <strong>
                    {page.isBookmarked ? "★ " : ""}
                    {page.title}
                  </strong>
                  <span className="muted">{page.preview}</span>
                  <div className="page-card__meta">
                    <span className="tag">Лист {page.pageOrder}</span>
                    <span className="tag">{formatPageMeta(page.updatedAt)}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </Panel>

        <Panel className="stack">
          <div className="section-head">
            <div>
              <h2>Файлы блокнота</h2>
              <p>Вложения блокнота сохраняются локально и доступны после перезагрузки.</p>
            </div>
          </div>
          <label className="upload-box">
            <span>Добавить файлы в блокнот</span>
            <input type="file" multiple onChange={handleFilesChange} />
          </label>
          {attachmentError ? <div className="inline-notice inline-notice--warning">{attachmentError}</div> : null}
          <FileAttachmentList items={attachments} />
        </Panel>
      </div>

      <CreateNotebookModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        titleText="Изменить блокнот"
        submitText="Сохранить"
        closeDelayMs={90}
        initialValues={{
          title: notebook.title,
          color: notebook.color,
          style: notebook.style,
          notebookType: notebook.notebookType,
          paperType: notebook.defaultPaperType,
          paperColor: notebook.defaultPaperColor,
          defaultTool: notebook.defaultTool,
          coverPreset: notebook.coverPreset,
          bindingType: notebook.bindingType,
          coverMode: notebook.coverMode,
        }}
        onCreate={async (input) => {
          const updatedNotebook = await updateNotebook(notebook.id, input);

          if (sourcePageId) {
            const sourcePage = pages.find((pageItem) => pageItem.id === sourcePageId);

            if (sourcePage) {
              await updatePage(sourcePageId, {
                title: sourcePage.title,
                paperType: input.paperType,
                paperColor: input.paperColor,
                layout: sourcePage.layout,
              });
            }
          }

          setNotebook(updatedNotebook);
          await load();
          return updatedNotebook;
        }}
      />
    </section>
  );
}
