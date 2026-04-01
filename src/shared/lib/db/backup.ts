import { clearAllPageRecoveryDrafts } from "@/features/editor/lib/pageRecoveryDraft";
import { getDatabase } from "@/shared/lib/db/database";
import { formatStorageBytes, getStorageEstimateSnapshot, throwIfLikelyOverQuota } from "@/shared/lib/db/storageErrors";
import { repairStorageIntegrity } from "@/shared/lib/db/storageIntegrity";
import { getBackupExportPreflight, getBackupImportPreflight } from "@/shared/lib/db/storagePreflight";
import {
  AppSettings,
  DrawingStroke,
  Notebook,
  NotebookAttachment,
  Page,
  PageElement,
  StoredAsset,
} from "@/shared/types/models";

interface SerializedAssetRecord extends Omit<StoredAsset, "blob"> {
  blobDataUrl: string;
}

interface DatabaseBackupPayload {
  format: "mybestipadapp-backup";
  version: 1;
  exportedAt: string;
  stores: {
    notebooks: Notebook[];
    pages: Page[];
    pageElements: PageElement[];
    drawingStrokes: DrawingStroke[];
    assets: SerializedAssetRecord[];
    notebookAttachments: NotebookAttachment[];
    appSettings: AppSettings[];
  };
}

export interface DatabaseBackupEstimate {
  estimatedBytes: number;
  assetBytes: number;
  assetCount: number;
}

export interface DatabaseBackupSummary {
  notebookCount: number;
  pageCount: number;
  pageElementCount: number;
  drawingStrokeCount: number;
  assetCount: number;
  notebookAttachmentCount: number;
  appSettingsCount: number;
  totalAssetBytes: number;
  estimatedExportBytes: number;
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read blob"));
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.readAsDataURL(blob);
  });
}

async function dataUrlToBlob(dataUrl: string) {
  const response = await fetch(dataUrl);
  return response.blob();
}

function isBackupPayload(value: unknown): value is DatabaseBackupPayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<DatabaseBackupPayload>;
  return candidate.format === "mybestipadapp-backup" && candidate.version === 1 && Boolean(candidate.stores);
}

export async function getDatabaseBackupSummary(): Promise<DatabaseBackupSummary> {
  const db = await getDatabase();
  const [notebooks, pages, pageElements, drawingStrokes, assets, notebookAttachments, appSettings] = await Promise.all([
    db.getAllKeys("notebooks"),
    db.getAllKeys("pages"),
    db.getAllKeys("pageElements"),
    db.getAllKeys("drawingStrokes"),
    db.getAll("assets"),
    db.getAllKeys("notebookAttachments"),
    db.getAllKeys("appSettings"),
  ]);

  const totalAssetBytes = assets.reduce((sum, asset) => sum + asset.size, 0);
  const estimatedExportBytes = Math.round(totalAssetBytes * 1.38 + assets.length * 512 + 256 * 1024);

  return {
    notebookCount: notebooks.length,
    pageCount: pages.length,
    pageElementCount: pageElements.length,
    drawingStrokeCount: drawingStrokes.length,
    assetCount: assets.length,
    notebookAttachmentCount: notebookAttachments.length,
    appSettingsCount: appSettings.length,
    totalAssetBytes,
    estimatedExportBytes,
  };
}

export async function estimateDatabaseBackup(): Promise<DatabaseBackupEstimate> {
  const summary = await getDatabaseBackupSummary();

  return {
    estimatedBytes: summary.estimatedExportBytes,
    assetBytes: summary.totalAssetBytes,
    assetCount: summary.assetCount,
  };
}

export function formatBackupSummary(summary: DatabaseBackupSummary) {
  return [
    `${summary.notebookCount} блокнотов`,
    `${summary.pageCount} страниц`,
    `${summary.assetCount} вложений`,
    `данные ${formatStorageBytes(summary.totalAssetBytes)}`,
    `backup около ${formatStorageBytes(summary.estimatedExportBytes)}`,
  ].join(", ");
}

export async function getBackupExportWarning() {
  const [summary, estimate] = await Promise.all([getDatabaseBackupSummary(), getStorageEstimateSnapshot()]);
  const preflight = getBackupExportPreflight(summary.estimatedExportBytes, estimate.availableBytes);

  return preflight.message;
}

export async function getBackupImportWarning(file: File) {
  const estimate = await getStorageEstimateSnapshot();
  const projectedBytes = Math.round(file.size * 1.9);
  const preflight = getBackupImportPreflight(projectedBytes, estimate.availableBytes);

  return preflight.message;
}

export async function exportDatabaseBackup() {
  const db = await getDatabase();
  const [notebooks, pages, pageElements, drawingStrokes, assets, notebookAttachments, appSettings] = await Promise.all([
    db.getAll("notebooks"),
    db.getAll("pages"),
    db.getAll("pageElements"),
    db.getAll("drawingStrokes"),
    db.getAll("assets"),
    db.getAll("notebookAttachments"),
    db.getAll("appSettings"),
  ]);

  const serializedAssets = await Promise.all(
    assets.map(async (asset) => ({
      ...asset,
      blobDataUrl: await blobToDataUrl(asset.blob),
    })),
  );

  const payload: DatabaseBackupPayload = {
    format: "mybestipadapp-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    stores: {
      notebooks,
      pages,
      pageElements,
      drawingStrokes,
      assets: serializedAssets,
      notebookAttachments,
      appSettings,
    },
  };

  return payload;
}

export async function downloadDatabaseBackup() {
  const [summary, estimate] = await Promise.all([getDatabaseBackupSummary(), getStorageEstimateSnapshot()]);
  const warning = getBackupExportPreflight(summary.estimatedExportBytes, estimate.availableBytes);

  if (warning.level === "blocked") {
    throw new Error(warning.message ?? "Экспорт резервной копии сейчас небезопасен.");
  }

  const payload = await exportDatabaseBackup();
  const blob = new Blob([JSON.stringify(payload)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const link = document.createElement("a");
  link.href = url;
  link.download = `mybestipadapp-backup-${timestamp}.json`;
  link.click();
  URL.revokeObjectURL(url);

  return summary;
}

export async function importDatabaseBackup(file: File) {
  const estimate = await getStorageEstimateSnapshot();
  const projectedBytes = Math.round(file.size * 1.9);
  const preflight = getBackupImportPreflight(projectedBytes, estimate.availableBytes);

  if (preflight.level === "blocked") {
    throw new Error(preflight.message ?? "Импорт backup-файла сейчас небезопасен.");
  }

  throwIfLikelyOverQuota("импорта backup-файла", projectedBytes, estimate.availableBytes);

  const raw = await file.text();
  const parsed = JSON.parse(raw) as unknown;

  if (!isBackupPayload(parsed)) {
    throw new Error("Неверный формат backup-файла.");
  }

  const assets = await Promise.all(
    parsed.stores.assets.map(async (asset) => ({
      id: asset.id,
      kind: asset.kind,
      ownerId: asset.ownerId,
      blob: await dataUrlToBlob(asset.blobDataUrl),
      name: asset.name,
      mimeType: asset.mimeType,
      size: asset.size,
      createdAt: asset.createdAt,
    })),
  );

  const db = await getDatabase();
  const transaction = db.transaction(
    ["notebooks", "pages", "pageElements", "drawingStrokes", "assets", "notebookAttachments", "appSettings"],
    "readwrite",
  );

  await Promise.all([
    transaction.objectStore("notebooks").clear(),
    transaction.objectStore("pages").clear(),
    transaction.objectStore("pageElements").clear(),
    transaction.objectStore("drawingStrokes").clear(),
    transaction.objectStore("assets").clear(),
    transaction.objectStore("notebookAttachments").clear(),
    transaction.objectStore("appSettings").clear(),
  ]);

  for (const item of parsed.stores.notebooks) {
    await transaction.objectStore("notebooks").put(item);
  }

  for (const item of parsed.stores.pages) {
    await transaction.objectStore("pages").put(item);
  }

  for (const item of parsed.stores.pageElements) {
    await transaction.objectStore("pageElements").put(item);
  }

  for (const item of parsed.stores.drawingStrokes) {
    await transaction.objectStore("drawingStrokes").put(item);
  }

  for (const item of assets) {
    await transaction.objectStore("assets").put(item);
  }

  for (const item of parsed.stores.notebookAttachments) {
    await transaction.objectStore("notebookAttachments").put(item);
  }

  for (const item of parsed.stores.appSettings) {
    await transaction.objectStore("appSettings").put(item);
  }

  await transaction.done;
  await repairStorageIntegrity();
  clearAllPageRecoveryDrafts();
}
