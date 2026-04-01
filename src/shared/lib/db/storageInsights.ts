import { getDatabase } from "@/shared/lib/db/database";

export interface NotebookStorageInsight {
  notebookId: string;
  title: string;
  totalBytes: number;
  assetCount: number;
  pageCount: number;
  attachmentCount: number;
  imageBytes: number;
  fileBytes: number;
  coverBytes: number;
}

export interface StorageInsightsSummary {
  topNotebooks: NotebookStorageInsight[];
  appBackgroundBytes: number;
  unassignedAssetBytes: number;
  totalTrackedAssetBytes: number;
}

export async function getStorageInsightsSummary(limit = 3): Promise<StorageInsightsSummary> {
  const db = await getDatabase();
  const [notebooks, pages, assets, notebookAttachments] = await Promise.all([
    db.getAll("notebooks"),
    db.getAll("pages"),
    db.getAll("assets"),
    db.getAll("notebookAttachments"),
  ]);

  const pageToNotebookId = new Map(pages.map((page) => [page.id, page.notebookId]));
  const attachmentCounts = new Map<string, number>();

  for (const attachment of notebookAttachments) {
    attachmentCounts.set(attachment.notebookId, (attachmentCounts.get(attachment.notebookId) ?? 0) + 1);
  }

  const notebookSummaries = new Map(
    notebooks.map((notebook) => [
      notebook.id,
      {
        notebookId: notebook.id,
        title: notebook.title,
        totalBytes: 0,
        assetCount: 0,
        pageCount: pages.filter((page) => page.notebookId === notebook.id).length,
        attachmentCount: attachmentCounts.get(notebook.id) ?? 0,
        imageBytes: 0,
        fileBytes: 0,
        coverBytes: 0,
      } satisfies NotebookStorageInsight,
    ]),
  );

  let appBackgroundBytes = 0;
  let unassignedAssetBytes = 0;

  for (const asset of assets) {
    let notebookId: string | null = null;

    if (notebookSummaries.has(asset.ownerId)) {
      notebookId = asset.ownerId;
    } else {
      notebookId = pageToNotebookId.get(asset.ownerId) ?? null;
    }

    if (asset.kind === "background" && asset.ownerId === "app-settings") {
      appBackgroundBytes += asset.size;
      continue;
    }

    if (!notebookId) {
      unassignedAssetBytes += asset.size;
      continue;
    }

    const summary = notebookSummaries.get(notebookId);
    if (!summary) {
      unassignedAssetBytes += asset.size;
      continue;
    }

    summary.totalBytes += asset.size;
    summary.assetCount += 1;

    if (asset.kind === "cover") {
      summary.coverBytes += asset.size;
    } else if (asset.kind === "image") {
      summary.imageBytes += asset.size;
    } else {
      summary.fileBytes += asset.size;
    }
  }

  const topNotebooks = [...notebookSummaries.values()]
    .filter((item) => item.totalBytes > 0 || item.attachmentCount > 0)
    .sort((a, b) => b.totalBytes - a.totalBytes)
    .slice(0, limit);

  return {
    topNotebooks,
    appBackgroundBytes,
    unassignedAssetBytes,
    totalTrackedAssetBytes: assets.reduce((sum, asset) => sum + asset.size, 0),
  };
}
