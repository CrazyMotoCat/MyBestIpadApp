import { getDatabase } from "@/shared/lib/db/database";
import { recordStorageWriteFailure, recordStorageWriteSuccess } from "@/shared/lib/db/storageHealth";
import { AppSettings, Notebook, NotebookAttachment, Page, PageElement, StoredAsset } from "@/shared/types/models";

interface StorageSnapshot {
  notebooks: Notebook[];
  pages: Page[];
  pageElements: PageElement[];
  assets: StoredAsset[];
  notebookAttachments: NotebookAttachment[];
  appSettings: AppSettings | null;
}

export interface StorageIntegrityReport {
  orphanAssetIds: string[];
  orphanAssetBytes: number;
  danglingNotebookAttachmentIds: string[];
  danglingPageElementIds: string[];
  missingCoverNotebookIds: string[];
  missingBackgroundAsset: boolean;
}

export interface StorageRepairResult {
  deletedAssets: number;
  unresolvedNotebookAttachments: number;
  unresolvedPageElements: number;
  resetNotebookCovers: number;
  resetBackgroundLink: boolean;
}

export function buildStorageIntegrityReport(snapshot: StorageSnapshot): StorageIntegrityReport {
  const notebookIds = new Set(snapshot.notebooks.map((item) => item.id));
  const pageIds = new Set(snapshot.pages.map((item) => item.id));
  const assetIds = new Set(snapshot.assets.map((item) => item.id));

  const orphanAssets = snapshot.assets.filter((asset) => {
    if (asset.ownerId === "app-settings" && asset.kind === "background") {
      return false;
    }

    return !notebookIds.has(asset.ownerId) && !pageIds.has(asset.ownerId);
  });

  const danglingNotebookAttachmentIds = snapshot.notebookAttachments
    .filter((attachment) => !notebookIds.has(attachment.notebookId) || !assetIds.has(attachment.assetId))
    .map((attachment) => attachment.id);

  const danglingPageElementIds = snapshot.pageElements
    .filter((element) => {
      if (!pageIds.has(element.pageId)) {
        return true;
      }

      if (element.type === "image" || element.type === "fileAttachment") {
        return !assetIds.has(element.assetId);
      }

      return false;
    })
    .map((element) => element.id);

  const missingCoverNotebookIds = snapshot.notebooks
    .filter((notebook) => notebook.coverImageAssetId && !assetIds.has(notebook.coverImageAssetId))
    .map((notebook) => notebook.id);

  const missingBackgroundAsset = Boolean(
    snapshot.appSettings?.customBackgroundAssetId && !assetIds.has(snapshot.appSettings.customBackgroundAssetId),
  );

  return {
    orphanAssetIds: orphanAssets.map((asset) => asset.id),
    orphanAssetBytes: orphanAssets.reduce((sum, asset) => sum + asset.size, 0),
    danglingNotebookAttachmentIds,
    danglingPageElementIds,
    missingCoverNotebookIds,
    missingBackgroundAsset,
  };
}

export async function auditStorageIntegrity(): Promise<StorageIntegrityReport> {
  const db = await getDatabase();
  const [notebooks, pages, pageElements, assets, notebookAttachments, appSettings] = await Promise.all([
    db.getAll("notebooks"),
    db.getAll("pages"),
    db.getAll("pageElements"),
    db.getAll("assets"),
    db.getAll("notebookAttachments"),
    db.get("appSettings", "app-settings"),
  ]);

  return buildStorageIntegrityReport({
    notebooks,
    pages,
    pageElements,
    assets,
    notebookAttachments,
    appSettings: appSettings ?? null,
  });
}

export async function repairStorageIntegrity(): Promise<StorageRepairResult> {
  const db = await getDatabase();
  const [report, notebooks, appSettings] = await Promise.all([
    auditStorageIntegrity(),
    db.getAll("notebooks"),
    db.get("appSettings", "app-settings"),
  ]);

  const transaction = db.transaction(["assets", "notebooks", "appSettings"], "readwrite");

  for (const assetId of report.orphanAssetIds) {
    await transaction.objectStore("assets").delete(assetId);
  }

  for (const notebook of notebooks) {
    if (!report.missingCoverNotebookIds.includes(notebook.id)) {
      continue;
    }

    await transaction.objectStore("notebooks").put({
      ...notebook,
      coverImageAssetId: null,
      coverMode: "preset",
      updatedAt: new Date().toISOString(),
    });
  }

  if (report.missingBackgroundAsset && appSettings) {
    await transaction.objectStore("appSettings").put({
      ...appSettings,
      backgroundMode: "preset",
      customBackgroundAssetId: null,
      updatedAt: new Date().toISOString(),
    });
  }

  try {
    await transaction.done;

    const result = {
      deletedAssets: report.orphanAssetIds.length,
      unresolvedNotebookAttachments: report.danglingNotebookAttachmentIds.length,
      unresolvedPageElements: report.danglingPageElementIds.length,
      resetNotebookCovers: report.missingCoverNotebookIds.length,
      resetBackgroundLink: report.missingBackgroundAsset,
    };

    recordStorageWriteSuccess(
      "repair storage integrity",
      `Починены локальные ссылки: assets ${result.deletedAssets}, обложки ${result.resetNotebookCovers}.`,
    );

    return result;
  } catch (error) {
    recordStorageWriteFailure("repair storage integrity", error, "Не удалось починить локальные ссылки.");
    throw error;
  }
}
