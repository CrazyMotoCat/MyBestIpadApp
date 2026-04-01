import { getPage } from "@/features/pages/api/pages";
import { getDatabase } from "@/shared/lib/db/database";
import { deleteAssetById, saveFileAsset, getAssetById, getAssetObjectUrl } from "@/shared/lib/db/assets";
import { toStorageWriteError } from "@/shared/lib/db/storageErrors";
import { createId } from "@/shared/lib/utils/id";
import {
  DrawingPageElement,
  DrawingStroke,
  FileAttachmentPageElement,
  ImagePageElement,
  PageElement,
  ShapeNoteElement,
  TextPageElement,
} from "@/shared/types/models";
import { PaperPresetId, ShapeInsertPresetId, ToolPresetId } from "@/shared/types/presets";

function nowIso() {
  return new Date().toISOString();
}

function ensureTextElement(pageId: string, existing?: Partial<TextPageElement> | null): TextPageElement {
  const now = nowIso();
  return {
    id: existing?.id ?? createId("element"),
    pageId,
    type: "text",
    x: existing?.x ?? 24,
    y: existing?.y ?? 24,
    width: existing?.width ?? 860,
    height: existing?.height ?? 260,
    zIndex: existing?.zIndex ?? 1,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    content: existing?.content ?? "",
    style: {
      fontSize: existing?.style?.fontSize ?? 18,
      lineHeight: existing?.style?.lineHeight ?? 1.7,
      color: existing?.style?.color ?? "#f5f7ff",
    },
  };
}

function ensureDrawingElement(
  pageId: string,
  toolId: ToolPresetId,
  existing?: Partial<DrawingPageElement> | null,
): DrawingPageElement {
  const now = nowIso();
  return {
    id: existing?.id ?? createId("element"),
    pageId,
    type: "drawing",
    x: existing?.x ?? 0,
    y: existing?.y ?? 0,
    width: existing?.width ?? 1024,
    height: existing?.height ?? 360,
    zIndex: existing?.zIndex ?? 2,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    toolId: existing?.toolId ?? toolId,
    label: existing?.label ?? "Основной слой",
  };
}

export async function listPageElements(pageId: string) {
  const db = await getDatabase();
  const elements = await db.getAllFromIndex("pageElements", "by-pageId", pageId);
  return elements.sort((a, b) => a.zIndex - b.zIndex || a.createdAt.localeCompare(b.createdAt));
}

export async function getTextElement(pageId: string) {
  const textElements = await listTextElements(pageId);
  return textElements[0] ?? null;
}

export async function listTextElements(pageId: string) {
  const db = await getDatabase();
  const elements = await db.getAllFromIndex("pageElements", "by-pageId-type", [pageId, "text"]);
  return elements
    .map((element) => ensureTextElement(pageId, element as Partial<TextPageElement>))
    .sort((a, b) => a.zIndex - b.zIndex || a.createdAt.localeCompare(b.createdAt));
}

export async function replaceTextElements(pageId: string, textElements: TextPageElement[]) {
  const db = await getDatabase();
  const transaction = db.transaction("pageElements", "readwrite");
  const index = transaction.store.index("by-pageId-type");
  let cursor = await index.openCursor(IDBKeyRange.only([pageId, "text"]));

  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }

  for (const element of textElements) {
    const nextElement = ensureTextElement(pageId, element);
    await transaction.store.put({
      ...nextElement,
      content: element.content,
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
      zIndex: element.zIndex,
      style: {
        ...nextElement.style,
        ...element.style,
      },
    });
  }

  await transaction.done;
}

export async function ensureDrawingLayer(pageId: string, toolId: ToolPresetId) {
  const db = await getDatabase();
  const record = await db.getFromIndex("pageElements", "by-pageId-type", [pageId, "drawing"]);
  const nextElement = ensureDrawingElement(pageId, toolId, record as Partial<DrawingPageElement> | undefined);
  await db.put("pageElements", nextElement);
  return nextElement;
}

export async function listDrawingStrokes(pageId: string) {
  const db = await getDatabase();
  const strokes = await db.getAllFromIndex("drawingStrokes", "by-pageId", pageId);
  return strokes
    .map((stroke) => ({
      ...stroke,
      toolId: stroke.toolId ?? "ballpoint",
      opacity: stroke.opacity ?? 1,
      strokeStyle: stroke.strokeStyle ?? "solid",
      smoothing: stroke.smoothing ?? 0.4,
    }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function replaceDrawingStrokes(pageId: string, strokes: DrawingStroke[]) {
  const db = await getDatabase();
  const transaction = db.transaction("drawingStrokes", "readwrite");
  const index = transaction.store.index("by-pageId");
  let cursor = await index.openCursor(pageId);

  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }

  for (const stroke of strokes) {
    await transaction.store.put({
      ...stroke,
      pageId,
    });
  }

  await transaction.done;
}

export async function addImageToPage(pageId: string, file: File) {
  const db = await getDatabase();
  const asset = await saveFileAsset(pageId, file, "image");
  const element: ImagePageElement = {
    id: createId("element"),
    pageId,
    type: "image",
    x: 18,
    y: 18,
    width: 220,
    height: 160,
    zIndex: 5,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    assetId: asset.id,
    name: file.name,
    mimeType: asset.mimeType,
    size: asset.size,
    caption: "",
  };

  try {
    await db.put("pageElements", element);
  } catch (error) {
    await deleteAssetById(asset.id);
    throw toStorageWriteError(error, "добавить изображение на страницу");
  }

  return element;
}

export async function addFileToPage(pageId: string, file: File) {
  const db = await getDatabase();
  const asset = await saveFileAsset(pageId, file, "file");
  const element: FileAttachmentPageElement = {
    id: createId("element"),
    pageId,
    type: "fileAttachment",
    x: 0,
    y: 0,
    width: 220,
    height: 60,
    zIndex: 6,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    assetId: asset.id,
    name: file.name,
    mimeType: asset.mimeType,
    size: asset.size,
    note: "",
  };

  try {
    await db.put("pageElements", element);
  } catch (error) {
    await deleteAssetById(asset.id);
    throw toStorageWriteError(error, "добавить файл на страницу");
  }

  return element;
}

export async function listPageImages(pageId: string) {
  const elements = await listPageElements(pageId);
  return elements.filter((element): element is ImagePageElement => element.type === "image");
}

export async function listPageFiles(pageId: string) {
  const elements = await listPageElements(pageId);
  return elements.filter(
    (element): element is FileAttachmentPageElement => element.type === "fileAttachment",
  );
}

export async function listShapeNotes(pageId: string) {
  const elements = await listPageElements(pageId);
  return elements.filter((element): element is ShapeNoteElement => element.type === "shapeNote");
}

export async function addShapeNote(
  pageId: string,
  input: {
    shapePreset: ShapeInsertPresetId;
    color: string;
    paperStyle: PaperPresetId;
    edgeStyle: ShapeNoteElement["edgeStyle"];
  },
) {
  const db = await getDatabase();
  const now = nowIso();
  const element: ShapeNoteElement = {
    id: createId("element"),
    pageId,
    type: "shapeNote",
    x: 56,
    y: 56,
    width: 210,
    height: 140,
    zIndex: 4,
    createdAt: now,
    updatedAt: now,
    shapePreset: input.shapePreset,
    color: input.color,
    paperStyle: input.paperStyle,
    edgeStyle: input.edgeStyle,
    text: "",
  };

  await db.put("pageElements", element);
  return element;
}

export async function updateShapeNote(element: ShapeNoteElement) {
  const db = await getDatabase();
  await db.put("pageElements", {
    ...element,
    updatedAt: nowIso(),
  });
}

export async function updatePageElement<
  TElement extends PageElement,
>(element: TElement) {
  const db = await getDatabase();
  const updatedElement = {
    ...element,
    updatedAt: nowIso(),
  } as TElement;

  await db.put("pageElements", updatedElement);
  return updatedElement;
}

export async function deletePageElement(elementId: string) {
  const db = await getDatabase();
  const element = await db.get("pageElements", elementId);

  if (!element) {
    return;
  }

  await db.delete("pageElements", elementId);

  if (element.type === "image" || element.type === "fileAttachment") {
    await db.delete("assets", element.assetId);
  }
}

export { getAssetById, getAssetObjectUrl };

export async function getPageEditorBundle(pageId: string) {
  const [page, textElements, strokes, images, files, shapes] = await Promise.all([
    getPage(pageId),
    listTextElements(pageId),
    listDrawingStrokes(pageId),
    listPageImages(pageId),
    listPageFiles(pageId),
    listShapeNotes(pageId),
  ]);

  return {
    page,
    textElements,
    strokes,
    images,
    files,
    shapes,
  };
}
