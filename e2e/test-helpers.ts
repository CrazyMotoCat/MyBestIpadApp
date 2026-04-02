import { expect, Page } from "@playwright/test";

export function makeFilePayload(name: string, mimeType: string, sizeBytes: number) {
  return {
    name,
    mimeType,
    buffer: Buffer.alloc(sizeBytes, 1),
  };
}

export async function applyStoragePressureMock(page: Page, quotaBytes: number, usageBytes: number) {
  await page.addInitScript(
    ({ quotaBytes: nextQuotaBytes, usageBytes: nextUsageBytes }) => {
      const mockEstimate = async () => ({ quota: nextQuotaBytes, usage: nextUsageBytes });
      const mockStorage = {
        estimate: mockEstimate,
        persisted: async () => false,
        persist: async () => false,
      };

      try {
        Object.defineProperty(navigator, "storage", {
          value: mockStorage,
          configurable: true,
        });
      } catch {
        try {
          Object.defineProperty(navigator.storage, "estimate", {
            value: mockEstimate,
            configurable: true,
          });
          Object.defineProperty(navigator.storage, "persisted", {
            value: async () => false,
            configurable: true,
          });
          Object.defineProperty(navigator.storage, "persist", {
            value: async () => false,
            configurable: true,
          });
        } catch {
          // Ignore environments where the storage API cannot be patched.
        }
      }
    },
    { quotaBytes, usageBytes },
  );
}

export async function seedRecoveryDiagnosticsState(page: Page) {
  await page.evaluate(async () => {
    const now = "2026-04-02T00:00:00.000Z";
    const notebookId = "notebook-heavy";
    const pageId = "page-heavy";
    const backgroundAssetId = "asset-background";
    const pageAssetId = "asset-page-image";
    const orphanAssetId = "asset-orphan";

    const openDatabase = () =>
      new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("my-best-ipad-app", 3);

        request.onupgradeneeded = () => {
          const db = request.result;

          const ensureStore = (name: string, options?: IDBObjectStoreParameters) => {
            if (!db.objectStoreNames.contains(name)) {
              db.createObjectStore(name, options);
            }
          };

          ensureStore("notebooks", { keyPath: "id" });
          ensureStore("pages", { keyPath: "id" });
          ensureStore("pageElements", { keyPath: "id" });
          ensureStore("drawingStrokes", { keyPath: "id" });
          ensureStore("assets", { keyPath: "id" });
          ensureStore("notebookAttachments", { keyPath: "id" });
          ensureStore("appSettings", { keyPath: "id" });

          const pagesStore = request.transaction?.objectStore("pages");
          if (pagesStore && !pagesStore.indexNames.contains("by-notebookId")) {
            pagesStore.createIndex("by-notebookId", "notebookId");
          }

          const elementsStore = request.transaction?.objectStore("pageElements");
          if (elementsStore && !elementsStore.indexNames.contains("by-pageId")) {
            elementsStore.createIndex("by-pageId", "pageId");
          }
          if (elementsStore && !elementsStore.indexNames.contains("by-pageId-type")) {
            elementsStore.createIndex("by-pageId-type", ["pageId", "type"]);
          }

          const strokesStore = request.transaction?.objectStore("drawingStrokes");
          if (strokesStore && !strokesStore.indexNames.contains("by-pageId")) {
            strokesStore.createIndex("by-pageId", "pageId");
          }

          const assetsStore = request.transaction?.objectStore("assets");
          if (assetsStore && !assetsStore.indexNames.contains("by-ownerId")) {
            assetsStore.createIndex("by-ownerId", "ownerId");
          }
          if (assetsStore && !assetsStore.indexNames.contains("by-kind")) {
            assetsStore.createIndex("by-kind", "kind");
          }

          const notebookAttachmentsStore = request.transaction?.objectStore("notebookAttachments");
          if (notebookAttachmentsStore && !notebookAttachmentsStore.indexNames.contains("by-notebookId")) {
            notebookAttachmentsStore.createIndex("by-notebookId", "notebookId");
          }
        };

        request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB"));
        request.onsuccess = () => resolve(request.result);
      });

    const db = await openDatabase();

    const put = async (storeName: string, value: unknown) => {
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(storeName, "readwrite");
        transaction.objectStore(storeName).put(value as never);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error ?? new Error(`Failed to write ${storeName}`));
        transaction.onabort = () => reject(transaction.error ?? new Error(`Aborted ${storeName} write`));
      });
    };

    const notebook = {
      id: notebookId,
      title: "Тяжёлый блокнот",
      color: "#6f7cff",
      style: "nebula-carbon",
      stylePreset: "nebula-carbon",
      notebookType: "garage-log",
      paperType: "lined",
      defaultPaperType: "lined",
      defaultPaperColor: "#f7f2e6",
      defaultTool: "ballpoint",
      coverPreset: "carbon-metal",
      coverMode: "custom",
      coverImageAssetId: "missing-cover-asset",
      coverBackground: "radial-gradient(circle at top right, rgba(111,124,255,.4), transparent 38%)",
      bindingType: "spiral",
      createdAt: now,
      updatedAt: now,
    };

    const pageRecord = {
      id: pageId,
      notebookId,
      title: "Первая страница",
      order: 1,
      pageOrder: 1,
      paperType: "lined",
      paperColor: "#f7f2e6",
      layout: "freeform",
      isBookmarked: false,
      createdAt: now,
      updatedAt: now,
    };

    const backgroundAsset = {
      id: backgroundAssetId,
      kind: "background",
      ownerId: "app-settings",
      blob: new Blob(["bg"], { type: "image/png" }),
      name: "background.png",
      mimeType: "image/png",
      size: 12 * 1024 * 1024,
      createdAt: now,
    };

    const pageAsset = {
      id: pageAssetId,
      kind: "image",
      ownerId: pageId,
      blob: new Blob(["page"], { type: "image/png" }),
      name: "heavy.png",
      mimeType: "image/png",
      size: 25 * 1024 * 1024,
      createdAt: now,
    };

    const orphanAsset = {
      id: orphanAssetId,
      kind: "file",
      ownerId: "missing-owner",
      blob: new Blob(["orphan"], { type: "text/plain" }),
      name: "orphan.txt",
      mimeType: "text/plain",
      size: 3 * 1024 * 1024,
      createdAt: now,
    };

    const appSettings = {
      id: "app-settings",
      backgroundMode: "custom",
      backgroundId: "deep-space",
      customBackgroundAssetId: backgroundAssetId,
      backgroundDimAmount: 0.62,
      backgroundBlurAmount: 0,
      updatedAt: now,
    };

    sessionStorage.clear();
    localStorage.removeItem("mybestipadapp:storage-health");
    localStorage.removeItem("mybestipadapp:persisted-page-recovery:page-heavy");
    localStorage.removeItem("mybestipadapp:persisted-page-draft:page-heavy");
    sessionStorage.setItem(
      "editor-page-draft:page-heavy",
      JSON.stringify({
        pageId,
        title: "Черновик страницы",
        paperType: "lined",
        paperColor: "#f7f2e6",
        layout: "freeform",
        textElements: [],
        images: [],
        files: [],
        shapes: [],
      }),
    );
    localStorage.setItem(
      "mybestipadapp:persisted-page-draft:page-heavy",
      JSON.stringify({
        pageId,
        title: "Снимок страницы",
        paperType: "lined",
        paperColor: "#f7f2e6",
        layout: "freeform",
        textElements: [],
        images: [],
        files: [],
        shapes: [],
        strokes: [],
        savedAt: now,
      }),
    );
    localStorage.setItem(
      "mybestipadapp:storage-health",
      JSON.stringify({
        outcome: "failure",
        operation: "save page",
        message: "Недостаточно места",
        timestamp: now,
      }),
    );

    await put("notebooks", notebook);
    await put("pages", pageRecord);
    await put("assets", backgroundAsset);
    await put("assets", pageAsset);
    await put("assets", orphanAsset);
    await put("appSettings", appSettings);

    db.close();
  });
}

export async function acceptAppConfirm(page: Page, title: string, confirmText = "Продолжить") {
  const dialog = page.getByRole("dialog", { name: title });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: confirmText }).click();
  await expect(dialog).toHaveCount(0);
}
