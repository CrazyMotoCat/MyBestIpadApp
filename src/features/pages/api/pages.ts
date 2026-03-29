import { getNotebook, touchNotebook } from "@/features/notebooks/api/notebooks";
import { defaultPaperPresetId, getPaperPreset } from "@/shared/config/paperPresets";
import { getDatabase } from "@/shared/lib/db/database";
import { createId } from "@/shared/lib/utils/id";
import { Page, PageLayout } from "@/shared/types/models";
import { PaperPresetId } from "@/shared/types/presets";

interface LegacyPage {
  id: string;
  notebookId: string;
  title: string;
  order?: number;
  index?: number;
  pageOrder?: number;
  background?: PaperPresetId;
  paperType?: PaperPresetId;
  paperColor?: string;
  layout?: PageLayout;
  isBookmarked?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

function resolveLegacyPaperType(
  value?: PaperPresetId | "paper" | "plain" | "lined" | "grid",
  fallbackPaperType?: PaperPresetId,
): PaperPresetId {
  switch (value) {
    case "paper":
      return "plain";
    case "plain":
      return "plain";
    case "lined":
      return "lined";
    case "grid":
      return "grid";
    case "dotted":
    case "millimeter":
    case "engineering-grid":
    case "isometric":
    case "music":
    case "calligraphy":
    case "sketch":
    case "kraft":
    case "cream":
    case "dark":
    case "daily":
    case "planner":
    case "checklist":
    case "cornell":
    case "storyboard":
    case "comic":
    case "school":
    case "lab":
    case "architect":
    case "drafting":
      return value;
    default:
      return fallbackPaperType ?? defaultPaperPresetId;
  }
}

export function normalizePage(record: LegacyPage, fallbackPaperType?: PaperPresetId, fallbackPaperColor?: string): Page {
  const createdAt = record.createdAt ?? new Date().toISOString();
  const paperType = resolveLegacyPaperType(record.paperType ?? record.background, fallbackPaperType);

  return {
    id: record.id,
    notebookId: record.notebookId,
    title: record.title,
    order: record.order ?? record.index ?? record.pageOrder ?? 1,
    pageOrder: record.pageOrder ?? record.order ?? record.index ?? 1,
    paperType,
    paperColor: record.paperColor ?? fallbackPaperColor ?? getPaperPreset(paperType).baseColor,
    layout: record.layout ?? "freeform",
    isBookmarked: record.isBookmarked ?? false,
    createdAt,
    updatedAt: record.updatedAt ?? createdAt,
  };
}

export async function listPages(notebookId: string) {
  const db = await getDatabase();
  const notebook = await getNotebook(notebookId);
  const records = await db.getAllFromIndex("pages", "by-notebookId", notebookId);
  const pages = records.map((record) =>
    normalizePage(
      record as LegacyPage,
      notebook?.defaultPaperType ?? notebook?.paperType ?? defaultPaperPresetId,
      notebook?.defaultPaperColor,
    ),
  );

  return pages.sort((a, b) => a.pageOrder - b.pageOrder || b.updatedAt.localeCompare(a.updatedAt));
}

export async function getPage(pageId: string) {
  const db = await getDatabase();
  const record = await db.get("pages", pageId);

  if (!record) {
    return null;
  }

  const notebook = await getNotebook(record.notebookId);
  return normalizePage(
    record as LegacyPage,
    notebook?.defaultPaperType ?? notebook?.paperType ?? defaultPaperPresetId,
    notebook?.defaultPaperColor,
  );
}

export async function createPage(notebookId: string, title: string) {
  const db = await getDatabase();
  const existing = await listPages(notebookId);
  const notebook = await getNotebook(notebookId);
  const now = new Date().toISOString();
  const pageOrder = existing.length + 1;

  const page: Page = {
    id: createId("page"),
    notebookId,
    title,
    order: pageOrder,
    pageOrder,
    paperType: notebook?.defaultPaperType ?? notebook?.paperType ?? defaultPaperPresetId,
    paperColor:
      notebook?.defaultPaperColor ??
      getPaperPreset(notebook?.defaultPaperType ?? notebook?.paperType ?? defaultPaperPresetId).baseColor,
    layout: "freeform",
    isBookmarked: false,
    createdAt: now,
    updatedAt: now,
  };

  await db.put("pages", page);
  await touchNotebook(notebookId);
  return page;
}

interface UpdatePageInput {
  title: string;
  paperType: PaperPresetId;
  paperColor: string;
  layout: PageLayout;
}

export async function updatePage(pageId: string, input: UpdatePageInput) {
  const db = await getDatabase();
  const page = await getPage(pageId);

  if (!page) {
    throw new Error("Page not found");
  }

  const updatedPage: Page = {
    ...page,
    ...input,
    updatedAt: new Date().toISOString(),
  };

  await db.put("pages", updatedPage);
  await touchNotebook(page.notebookId);
  return updatedPage;
}

export async function setPageBookmark(pageId: string, isBookmarked: boolean) {
  const db = await getDatabase();
  const page = await getPage(pageId);

  if (!page) {
    throw new Error("Page not found");
  }

  const updatedPage: Page = {
    ...page,
    isBookmarked,
    updatedAt: new Date().toISOString(),
  };

  await db.put("pages", updatedPage);
  return updatedPage;
}
