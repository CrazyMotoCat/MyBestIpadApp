import { deleteNotebook, listNotebooks } from "@/features/notebooks/api/notebooks";
import { getDatabase } from "@/shared/lib/db/database";

const LEGACY_BOOTSTRAP_NOTEBOOK_TITLE = "Мой гаражный блокнот";
const LEGACY_BOOTSTRAP_PAGE_TITLE = "Первый выезд";
const LEGACY_BOOTSTRAP_PAGE_TEXT =
  "Здесь можно писать заметки, рисовать схемы, хранить изображения и прикреплять файлы полностью офлайн.";

let bootstrapPromise: Promise<void> | null = null;

async function cleanupLegacyBootstrapNotebook() {
  const notebooks = await listNotebooks();

  if (notebooks.length !== 1) {
    return;
  }

  const notebook = notebooks[0];

  if (
    !notebook ||
    notebook.title !== LEGACY_BOOTSTRAP_NOTEBOOK_TITLE ||
    notebook.style !== "nebula-carbon" ||
    notebook.notebookType !== "garage-log" ||
    notebook.defaultPaperType !== "lined" ||
    notebook.defaultTool !== "ballpoint" ||
    notebook.coverPreset !== "carbon-metal" ||
    notebook.bindingType !== "spiral" ||
    notebook.coverMode !== "preset" ||
    notebook.createdAt !== notebook.updatedAt
  ) {
    return;
  }

  const db = await getDatabase();
  const pages = await db.getAllFromIndex("pages", "by-notebookId", notebook.id);

  if (pages.length !== 1) {
    return;
  }

  const page = pages[0];

  if (
    !page ||
    page.title !== LEGACY_BOOTSTRAP_PAGE_TITLE ||
    page.paperType !== "lined" ||
    page.paperColor !== "#f7f2e6" ||
    page.layout !== "freeform" ||
    page.isBookmarked ||
    page.createdAt !== page.updatedAt
  ) {
    return;
  }

  const notebookAttachments = await db.getAllFromIndex("notebookAttachments", "by-notebookId", notebook.id);
  const pageElements = await db.getAllFromIndex("pageElements", "by-pageId", page.id);
  const drawingStrokes = await db.getAllFromIndex("drawingStrokes", "by-pageId", page.id);
  const textElement = await db.getFromIndex("pageElements", "by-pageId-type", [page.id, "text"]);
  const unsupportedElementExists = pageElements.some((element) => !["text", "drawing"].includes(element.type));

  if (
    notebookAttachments.length > 0 ||
    drawingStrokes.length > 0 ||
    unsupportedElementExists ||
    pageElements.length < 2 ||
    !textElement ||
    textElement.type !== "text" ||
    textElement.content !== LEGACY_BOOTSTRAP_PAGE_TEXT
  ) {
    return;
  }

  await deleteNotebook(notebook.id);
}

export function ensureBootstrapData() {
  if (!bootstrapPromise) {
    bootstrapPromise = cleanupLegacyBootstrapNotebook();
  }

  return bootstrapPromise;
}
