import { expect, test, type Page } from "@playwright/test";

async function dismissOfflineCoach(page: Page) {
  const coachDismiss = page.getByRole("button", { name: "Понятно" });

  if (await coachDismiss.isVisible().catch(() => false)) {
    await coachDismiss.click();
  }
}

test.describe("Sprint 2 storage recovery", () => {
  test("shows cleanup actions for pending drafts and broken local links, then clears them", async ({ page }) => {
    await page.addInitScript(() => {
      if (!navigator.storage) {
        return;
      }

      navigator.storage.estimate = async () => ({
        quota: 100,
        usage: 92,
      });

      navigator.storage.persisted = async () => false;
    });

    await page.goto("/");
    await dismissOfflineCoach(page);

    await page.evaluate(async () => {
      const recoveryDraft = {
        pageId: "page-e2e",
        title: "Черновик",
        paperType: "lined",
        paperColor: "#fffdf4",
        layout: "freeform",
        textElements: [],
        images: [],
        files: [],
        shapes: [],
      };

      const snapshotDraft = {
        ...recoveryDraft,
        strokes: [],
        savedAt: new Date().toISOString(),
      };

      window.sessionStorage.setItem("editor-page-draft:page-e2e", JSON.stringify(recoveryDraft));
      window.localStorage.setItem("mybestipadapp:persisted-page-draft:page-e2e", JSON.stringify(snapshotDraft));

      const openRequest = window.indexedDB.open("my-best-ipad-app", 3);
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        openRequest.onupgradeneeded = () => {
          const upgradeDb = openRequest.result;

          if (!upgradeDb.objectStoreNames.contains("notebooks")) {
            upgradeDb.createObjectStore("notebooks", { keyPath: "id" });
          }
          if (!upgradeDb.objectStoreNames.contains("pages")) {
            const store = upgradeDb.createObjectStore("pages", { keyPath: "id" });
            store.createIndex("by-notebookId", "notebookId");
          }
          if (!upgradeDb.objectStoreNames.contains("pageElements")) {
            const store = upgradeDb.createObjectStore("pageElements", { keyPath: "id" });
            store.createIndex("by-pageId", "pageId");
            store.createIndex("by-pageId-type", ["pageId", "type"]);
          }
          if (!upgradeDb.objectStoreNames.contains("drawingStrokes")) {
            const store = upgradeDb.createObjectStore("drawingStrokes", { keyPath: "id" });
            store.createIndex("by-pageId", "pageId");
          }
          if (!upgradeDb.objectStoreNames.contains("assets")) {
            const store = upgradeDb.createObjectStore("assets", { keyPath: "id" });
            store.createIndex("by-ownerId", "ownerId");
            store.createIndex("by-kind", "kind");
          }
          if (!upgradeDb.objectStoreNames.contains("notebookAttachments")) {
            const store = upgradeDb.createObjectStore("notebookAttachments", { keyPath: "id" });
            store.createIndex("by-notebookId", "notebookId");
          }
          if (!upgradeDb.objectStoreNames.contains("appSettings")) {
            upgradeDb.createObjectStore("appSettings", { keyPath: "id" });
          }
        };
        openRequest.onsuccess = () => resolve(openRequest.result);
        openRequest.onerror = () => reject(openRequest.error);
      });

      const transaction = db.transaction(
        ["notebooks", "pages", "pageElements", "assets", "notebookAttachments", "appSettings"],
        "readwrite",
      );

      transaction.objectStore("notebooks").put({
        id: "notebook-e2e",
        title: "Тяжёлый блокнот",
        color: "#000000",
        style: "nebula-carbon",
        stylePreset: "nebula-carbon",
        notebookType: "garage-log",
        paperType: "lined",
        defaultPaperType: "lined",
        defaultPaperColor: "#fffdf4",
        defaultTool: "ballpoint",
        coverPreset: "carbon-metal",
        coverMode: "custom",
        coverImageAssetId: "missing-cover",
        coverBackground: "",
        bindingType: "spiral",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      transaction.objectStore("pages").put({
        id: "page-1",
        notebookId: "notebook-e2e",
        title: "Page 1",
        order: 1,
        pageOrder: 1,
        paperType: "lined",
        paperColor: "#fffdf4",
        layout: "freeform",
        isBookmarked: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      transaction.objectStore("assets").put({
        id: "orphan-asset",
        kind: "image",
        ownerId: "missing-owner",
        blob: new Blob(["broken"], { type: "text/plain" }),
        name: "broken.txt",
        mimeType: "text/plain",
        size: 6,
        createdAt: new Date().toISOString(),
      });

      transaction.objectStore("notebookAttachments").put({
        id: "attachment-dangling",
        notebookId: "missing-notebook",
        assetId: "missing-attachment-asset",
        name: "ghost.txt",
        mimeType: "text/plain",
        size: 6,
        createdAt: new Date().toISOString(),
      });

      transaction.objectStore("pageElements").put({
        id: "element-dangling",
        pageId: "missing-page",
        type: "fileAttachment",
        x: 0,
        y: 0,
        width: 120,
        height: 80,
        zIndex: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        assetId: "missing-asset",
        name: "ghost.txt",
        mimeType: "text/plain",
        size: 6,
        note: "",
      });

      transaction.objectStore("appSettings").put({
        id: "app-settings",
        backgroundMode: "custom",
        backgroundId: "deep-space",
        customBackgroundAssetId: "missing-background",
        backgroundDimAmount: 0.5,
        backgroundBlurAmount: 0,
        updatedAt: new Date().toISOString(),
      });

      await new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });

      db.close();
    });

    await page.reload();
    await dismissOfflineCoach(page);

    await page.locator(".pwa-status__trigger").click();

    await expect(page.getByText("Pending recovery drafts")).toBeVisible();
    await expect(page.getByText("Проблемы локальных ссылок")).toBeVisible();
    await expect(page.getByRole("button", { name: "Запустить safe repair" })).toBeVisible();

    const clearDraftsButton = page.getByRole("button", { name: "Очистить recovery drafts" });
    await clearDraftsButton.scrollIntoViewIfNeeded();
    await clearDraftsButton.evaluate((element) => {
      (element as HTMLButtonElement).click();
    });
    const clearDraftsDialog = page.getByRole("dialog", { name: "Очистить recovery drafts?" });
    await expect(clearDraftsDialog).toBeVisible();
    await clearDraftsDialog.getByRole("button", { name: "Очистить", exact: true }).click();
    await expect(page.getByText("Pending recovery drafts")).not.toBeVisible();

    const repairButton = page.getByRole("button", { name: "Починить локальные ссылки" });
    await repairButton.scrollIntoViewIfNeeded();
    await repairButton.evaluate((element) => {
      (element as HTMLButtonElement).click();
    });
    const repairDialog = page.getByRole("dialog", { name: "Запустить safe repair?" });
    await expect(repairDialog).toBeVisible();
    await repairDialog.getByRole("button", { name: "Запустить repair", exact: true }).click();

    await expect(page.getByText("Проблемы локальных ссылок")).not.toBeVisible();
    await expect(page.locator(".pwa-status__meta").last()).toContainText("page elements 1");

    const storageState = await page.evaluate(async () => {
      const openRequest = window.indexedDB.open("my-best-ipad-app", 3);
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        openRequest.onsuccess = () => resolve(openRequest.result);
        openRequest.onerror = () => reject(openRequest.error);
      });

      const readAll = (storeName: string) =>
        new Promise<unknown[]>((resolve, reject) => {
          const transaction = db.transaction(storeName, "readonly");
          const request = transaction.objectStore(storeName).getAll();
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });

      const [assets, notebookAttachments, pageElements] = await Promise.all([
        readAll("assets"),
        readAll("notebookAttachments"),
        readAll("pageElements"),
      ]);

      db.close();

      return {
        assets: assets.length,
        notebookAttachments: notebookAttachments.length,
        pageElements: pageElements.length,
        sessionDraft: window.sessionStorage.getItem("editor-page-draft:page-e2e"),
        localDraft: window.localStorage.getItem("mybestipadapp:persisted-page-draft:page-e2e"),
      };
    });

    expect(storageState).toEqual({
      assets: 0,
      notebookAttachments: 0,
      pageElements: 0,
      sessionDraft: null,
      localDraft: null,
    });
  });
});
