import { defaultBindingPresetId } from "@/shared/config/bindingPresets";
import { defaultCoverPresetId, getCoverPreset } from "@/shared/config/coverPresets";
import { defaultNotebookStyleId, defaultNotebookTypeId } from "@/shared/config/notebookPresets";
import { defaultPaperPresetId, getPaperPreset } from "@/shared/config/paperPresets";
import { defaultToolPresetId } from "@/shared/config/toolPresets";
import { deleteAssetById, saveFileAsset } from "@/shared/lib/db/assets";
import { toStorageWriteError } from "@/shared/lib/db/storageErrors";
import { getDatabase } from "@/shared/lib/db/database";
import { createId } from "@/shared/lib/utils/id";
import { Notebook, NotebookAttachment } from "@/shared/types/models";
import {
  BindingPresetId,
  CoverPresetId,
  NotebookStylePresetId,
  NotebookTypePresetId,
  PaperPresetId,
  ToolPresetId,
} from "@/shared/types/presets";

interface LegacyNotebook {
  id: string;
  title: string;
  coverColor?: string;
  coverStyle?: string;
  color?: string;
  style?: NotebookStylePresetId;
  stylePreset?: NotebookStylePresetId;
  notebookType?: NotebookTypePresetId;
  paperType?: PaperPresetId;
  defaultPaperType?: PaperPresetId;
  defaultPaperColor?: string;
  defaultTool?: ToolPresetId;
  coverPreset?: CoverPresetId;
  coverMode?: Notebook["coverMode"];
  coverImageAssetId?: string | null;
  coverBackground?: string;
  bindingType?: BindingPresetId;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateNotebookInput {
  title: string;
  color: string;
  style: NotebookStylePresetId;
  notebookType: NotebookTypePresetId;
  paperType: PaperPresetId;
  paperColor: string;
  defaultTool: ToolPresetId;
  coverPreset: CoverPresetId;
  bindingType: BindingPresetId;
  coverMode: Notebook["coverMode"];
  coverImage?: File | null;
}

export interface UpdateNotebookAppearanceInput {
  title: string;
  color: string;
  style: NotebookStylePresetId;
  notebookType: NotebookTypePresetId;
  paperType: PaperPresetId;
  paperColor: string;
  defaultTool: ToolPresetId;
  coverPreset: CoverPresetId;
  bindingType: BindingPresetId;
  coverMode: Notebook["coverMode"];
  coverImage?: File | null;
}

function buildCoverBackground(color: string, style: NotebookStylePresetId, coverPresetId: CoverPresetId) {
  const cover = getCoverPreset(coverPresetId);
  return `${cover.preview}, radial-gradient(circle at top right, ${color}66, transparent 38%)`;
}

function resolveLegacyNotebookStyle(style?: string): NotebookStylePresetId {
  switch (style) {
    case "warm":
      return "burnout-red";
    case "ink":
      return "chrome-comet";
    case "soft":
      return "nebula-carbon";
    case "chrome-comet":
    case "midnight-racer":
    case "aurora-track":
    case "burnout-red":
    case "starlit-leather":
    case "retro-wave":
    case "nebula-carbon":
      return style;
    default:
      return defaultNotebookStyleId;
  }
}

export function normalizeNotebook(record: LegacyNotebook): Notebook {
  const color = record.color ?? record.coverColor ?? "#6f7cff";
  const style = record.style ?? record.stylePreset ?? resolveLegacyNotebookStyle(record.coverStyle);
  const paperType = record.paperType ?? record.defaultPaperType ?? defaultPaperPresetId;
  const coverPreset = record.coverPreset ?? defaultCoverPresetId;
  const createdAt = record.createdAt ?? new Date().toISOString();
  const updatedAt = record.updatedAt ?? createdAt;

  return {
    id: record.id,
    title: record.title,
    color,
    style,
    stylePreset: style,
    notebookType: record.notebookType ?? defaultNotebookTypeId,
    paperType,
    defaultPaperType: paperType,
    defaultPaperColor: record.defaultPaperColor ?? getPaperPreset(paperType).baseColor,
    defaultTool: record.defaultTool ?? defaultToolPresetId,
    coverPreset,
    coverMode: record.coverMode ?? (record.coverImageAssetId ? "custom" : "preset"),
    coverImageAssetId: record.coverImageAssetId ?? null,
    coverBackground: record.coverBackground ?? buildCoverBackground(color, style, coverPreset),
    bindingType: record.bindingType ?? defaultBindingPresetId,
    createdAt,
    updatedAt,
  };
}

export async function listNotebooks() {
  const db = await getDatabase();
  const records = await db.getAll("notebooks");
  const notebooks = records.map((record) => normalizeNotebook(record as LegacyNotebook));
  return notebooks.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getNotebook(notebookId: string) {
  const db = await getDatabase();
  const record = await db.get("notebooks", notebookId);
  return record ? normalizeNotebook(record as LegacyNotebook) : null;
}

export async function createNotebook(input: CreateNotebookInput): Promise<Notebook> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const coverAsset =
    input.coverMode === "custom" && input.coverImage
      ? await saveFileAsset(createId("cover-owner"), input.coverImage, "cover")
      : null;

  const notebook: Notebook = {
    id: createId("notebook"),
    title: input.title,
    color: input.color,
    style: input.style,
    stylePreset: input.style,
    notebookType: input.notebookType,
    paperType: input.paperType,
    defaultPaperType: input.paperType,
    defaultPaperColor: input.paperColor,
    defaultTool: input.defaultTool,
    coverPreset: input.coverPreset,
    coverMode: coverAsset ? "custom" : "preset",
    coverImageAssetId: coverAsset?.id ?? null,
    coverBackground: buildCoverBackground(input.color, input.style, input.coverPreset),
    bindingType: input.bindingType,
    createdAt: now,
    updatedAt: now,
  };

  if (coverAsset) {
    await db.put("assets", {
      ...coverAsset,
      ownerId: notebook.id,
    });
  }

  await db.put("notebooks", notebook);
  return notebook;
}

export async function updateNotebook(notebookId: string, input: UpdateNotebookAppearanceInput) {
  const db = await getDatabase();
  const notebook = await getNotebook(notebookId);

  if (!notebook) {
    throw new Error("Notebook not found");
  }

  const previousCoverAssetId = notebook.coverImageAssetId;
  const coverAsset =
    input.coverMode === "custom" && input.coverImage ? await saveFileAsset(notebookId, input.coverImage, "cover") : null;
  const updatedNotebook: Notebook = {
    ...notebook,
    title: input.title,
    color: input.color,
    style: input.style,
    stylePreset: input.style,
    notebookType: input.notebookType,
    paperType: input.paperType,
    defaultPaperType: input.paperType,
    defaultPaperColor: input.paperColor,
    defaultTool: input.defaultTool,
    coverPreset: input.coverPreset,
    coverMode: input.coverMode,
    coverImageAssetId:
      input.coverMode === "custom" ? coverAsset?.id ?? notebook.coverImageAssetId : null,
    coverBackground: buildCoverBackground(input.color, input.style, input.coverPreset),
    bindingType: input.bindingType,
    updatedAt: new Date().toISOString(),
  };

  await db.put("notebooks", updatedNotebook);

  if (
    previousCoverAssetId &&
    (updatedNotebook.coverImageAssetId !== previousCoverAssetId || updatedNotebook.coverMode !== "custom")
  ) {
    await deleteAssetById(previousCoverAssetId);
  }

  return updatedNotebook;
}

export async function touchNotebook(notebookId: string) {
  const db = await getDatabase();
  const notebook = await getNotebook(notebookId);

  if (!notebook) {
    return;
  }

  await db.put("notebooks", {
    ...notebook,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteNotebook(notebookId: string) {
  const db = await getDatabase();
  const notebook = await getNotebook(notebookId);

  if (!notebook) {
    return null;
  }

  const pages = await db.getAllFromIndex("pages", "by-notebookId", notebookId);
  const notebookAttachments = await db.getAllFromIndex("notebookAttachments", "by-notebookId", notebookId);
  const notebookAssets = await db.getAllFromIndex("assets", "by-ownerId", notebookId);
  const transaction = db.transaction(
    ["notebooks", "pages", "pageElements", "drawingStrokes", "assets", "notebookAttachments"],
    "readwrite",
  );

  await transaction.objectStore("notebooks").delete(notebookId);

  for (const attachment of notebookAttachments) {
    await transaction.objectStore("notebookAttachments").delete(attachment.id);
  }

  for (const asset of notebookAssets) {
    await transaction.objectStore("assets").delete(asset.id);
  }

  for (const page of pages) {
    await transaction.objectStore("pages").delete(page.id);

    const pageElements = await db.getAllFromIndex("pageElements", "by-pageId", page.id);
    const drawingStrokes = await db.getAllFromIndex("drawingStrokes", "by-pageId", page.id);
    const pageAssets = await db.getAllFromIndex("assets", "by-ownerId", page.id);

    for (const element of pageElements) {
      await transaction.objectStore("pageElements").delete(element.id);
    }

    for (const stroke of drawingStrokes) {
      await transaction.objectStore("drawingStrokes").delete(stroke.id);
    }

    for (const asset of pageAssets) {
      await transaction.objectStore("assets").delete(asset.id);
    }
  }

  await transaction.done;
  return notebook;
}

export async function listNotebookAttachments(notebookId: string) {
  const db = await getDatabase();
  const attachments = await db.getAllFromIndex("notebookAttachments", "by-notebookId", notebookId);
  return attachments.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function attachFilesToNotebook(notebookId: string, files: File[]) {
  const db = await getDatabase();
  const createdAt = new Date().toISOString();
  const attachments: NotebookAttachment[] = [];

  for (const file of files) {
    const asset = await saveFileAsset(notebookId, file, "file");
    const attachment: NotebookAttachment = {
      id: createId("notebook-attachment"),
      notebookId,
      assetId: asset.id,
      name: file.name,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      createdAt,
    };

    try {
      await db.put("notebookAttachments", attachment);
    } catch (error) {
      await deleteAssetById(asset.id);
      throw toStorageWriteError(error, "добавить файл в блокнот");
    }

    attachments.push(attachment);
  }

  await touchNotebook(notebookId);
  return attachments;
}

export async function getNotebookAttachmentAsset(attachmentId: string) {
  const db = await getDatabase();
  const attachment = await db.get("notebookAttachments", attachmentId);

  if (!attachment) {
    return null;
  }

  return db.get("assets", attachment.assetId);
}
