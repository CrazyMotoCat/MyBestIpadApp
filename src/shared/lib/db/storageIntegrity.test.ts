import { afterEach, describe, expect, it, vi } from "vitest";
import { buildStorageIntegrityReport, repairStorageIntegrity } from "@/shared/lib/db/storageIntegrity";
import { getDatabase } from "@/shared/lib/db/database";
import { recordStorageWriteFailure, recordStorageWriteSuccess } from "@/shared/lib/db/storageHealth";

vi.mock("@/shared/lib/db/database", () => ({
  getDatabase: vi.fn(),
}));

vi.mock("@/shared/lib/db/storageHealth", () => ({
  recordStorageWriteFailure: vi.fn(),
  recordStorageWriteSuccess: vi.fn(),
}));

type MockState = {
  notebooks: Array<Record<string, unknown> & { id: string }>;
  pages: Array<Record<string, unknown> & { id: string }>;
  pageElements: Array<Record<string, unknown> & { id: string }>;
  assets: Array<Record<string, unknown> & { id: string }>;
  notebookAttachments: Array<Record<string, unknown> & { id: string }>;
  appSettings: Record<string, unknown> & { id: "app-settings" } | null;
};

function createMockDatabase(state: MockState) {
  const getById = (storeName: keyof MockState, id: string) => {
    const store = state[storeName];

    if (!Array.isArray(store)) {
      return store?.id === id ? store : null;
    }

    return store.find((item) => item.id === id) ?? null;
  };

  const mutateStore = (storeName: keyof MockState, operation: "delete" | "put", value: unknown) => {
    const store = state[storeName];

    if (!Array.isArray(store)) {
      state.appSettings = operation === "delete" ? null : (value as MockState["appSettings"]);
      return;
    }

    if (operation === "delete") {
      const targetId = value as string;
      const index = store.findIndex((item) => item.id === targetId);

      if (index >= 0) {
        store.splice(index, 1);
      }

      return;
    }

    const nextItem = value as { id: string };
    const index = store.findIndex((item) => item.id === nextItem.id);

    if (index >= 0) {
      store[index] = nextItem as never;
      return;
    }

    store.push(nextItem as never);
  };

  const transaction = {
    objectStore(storeName: keyof MockState) {
      return {
        delete: async (id: string) => {
          mutateStore(storeName, "delete", id);
        },
        put: async (value: unknown) => {
          mutateStore(storeName, "put", value);
        },
      };
    },
    done: Promise.resolve(),
  };

  return {
    getAll: async (storeName: keyof MockState) => {
      const store = state[storeName];
      return Array.isArray(store) ? [...store] : store ? [store] : [];
    },
    get: async (storeName: keyof MockState, id: string) => getById(storeName, id),
    transaction: () => transaction,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("buildStorageIntegrityReport", () => {
  it("находит orphan assets и битые singleton-ссылки", () => {
    const report = buildStorageIntegrityReport({
      notebooks: [
        {
          id: "notebook-1",
          title: "Тест",
          color: "#000",
          style: "nebula-carbon",
          stylePreset: "nebula-carbon",
          notebookType: "garage-log",
          paperType: "lined",
          defaultPaperType: "lined",
          defaultPaperColor: "#fff",
          defaultTool: "ballpoint",
          coverPreset: "carbon-metal",
          coverMode: "custom",
          coverImageAssetId: "missing-cover",
          coverBackground: "",
          bindingType: "spiral",
          createdAt: "",
          updatedAt: "",
        },
      ],
      pages: [],
      pageElements: [
        {
          id: "element-1",
          pageId: "missing-page",
          type: "image",
          x: 0,
          y: 0,
          width: 10,
          height: 10,
          zIndex: 1,
          createdAt: "",
          updatedAt: "",
          assetId: "missing-asset",
          name: "image.png",
          mimeType: "image/png",
          size: 10,
          caption: "",
        },
      ],
      assets: [
        {
          id: "orphan-asset",
          kind: "image",
          ownerId: "missing-owner",
          blob: new Blob(["a"]),
          name: "a",
          mimeType: "text/plain",
          size: 1,
          createdAt: "",
        },
      ],
      notebookAttachments: [
        {
          id: "attachment-1",
          notebookId: "notebook-1",
          assetId: "missing-attachment-asset",
          name: "a",
          mimeType: "text/plain",
          size: 1,
          createdAt: "",
        },
      ],
      appSettings: {
        id: "app-settings",
        backgroundMode: "custom",
        backgroundId: "deep-space",
        customBackgroundAssetId: "missing-background",
        backgroundDimAmount: 0.5,
        backgroundBlurAmount: 0,
        updatedAt: "",
      },
    });

    expect(report.orphanAssetIds).toEqual(["orphan-asset"]);
    expect(report.orphanAssetBytes).toBe(1);
    expect(report.danglingNotebookAttachmentIds).toEqual(["attachment-1"]);
    expect(report.danglingPageElementIds).toEqual(["element-1"]);
    expect(report.missingCoverNotebookIds).toEqual(["notebook-1"]);
    expect(report.missingBackgroundAsset).toBe(true);
  });
});

describe("repairStorageIntegrity", () => {
  it("удаляет только однозначно битые attachments и page elements, не трогая валидные записи", async () => {
    const state: MockState = {
      notebooks: [
        {
          id: "notebook-1",
          title: "Тест",
          color: "#000",
          style: "nebula-carbon",
          stylePreset: "nebula-carbon",
          notebookType: "garage-log",
          paperType: "lined",
          defaultPaperType: "lined",
          defaultPaperColor: "#fff",
          defaultTool: "ballpoint",
          coverPreset: "carbon-metal",
          coverMode: "custom",
          coverImageAssetId: "missing-cover",
          coverBackground: "",
          bindingType: "spiral",
          createdAt: "",
          updatedAt: "",
        },
      ],
      pages: [
        {
          id: "page-1",
          notebookId: "notebook-1",
          title: "Страница",
          order: 1,
          pageOrder: 1,
          paperType: "lined",
          paperColor: "#fff",
          layout: "freeform",
          isBookmarked: false,
          createdAt: "",
          updatedAt: "",
        },
      ],
      pageElements: [
        {
          id: "element-valid",
          pageId: "page-1",
          type: "image",
          x: 0,
          y: 0,
          width: 10,
          height: 10,
          zIndex: 1,
          createdAt: "",
          updatedAt: "",
          assetId: "asset-valid-image",
          name: "image.png",
          mimeType: "image/png",
          size: 10,
          caption: "",
        },
        {
          id: "element-dangling",
          pageId: "missing-page",
          type: "fileAttachment",
          x: 0,
          y: 0,
          width: 10,
          height: 10,
          zIndex: 1,
          createdAt: "",
          updatedAt: "",
          assetId: "missing-asset",
          name: "file.txt",
          mimeType: "text/plain",
          size: 1,
          note: "",
        },
        {
          id: "element-text",
          pageId: "page-1",
          type: "text",
          x: 10,
          y: 10,
          width: 100,
          height: 50,
          zIndex: 2,
          createdAt: "",
          updatedAt: "",
          content: "keep me",
          style: {
            fontSize: 18,
            lineHeight: 1.5,
            color: "#111111",
          },
        },
      ],
      assets: [
        {
          id: "asset-valid-image",
          kind: "image",
          ownerId: "page-1",
          blob: new Blob(["image"]),
          name: "image.png",
          mimeType: "image/png",
          size: 10,
          createdAt: "",
        },
        {
          id: "asset-valid-attachment",
          kind: "file",
          ownerId: "notebook-1",
          blob: new Blob(["file"]),
          name: "file.txt",
          mimeType: "text/plain",
          size: 1,
          createdAt: "",
        },
        {
          id: "orphan-asset",
          kind: "image",
          ownerId: "missing-owner",
          blob: new Blob(["a"]),
          name: "a",
          mimeType: "text/plain",
          size: 1,
          createdAt: "",
        },
      ],
      notebookAttachments: [
        {
          id: "attachment-valid",
          notebookId: "notebook-1",
          assetId: "asset-valid-attachment",
          name: "file.txt",
          mimeType: "text/plain",
          size: 1,
          createdAt: "",
        },
        {
          id: "attachment-dangling",
          notebookId: "missing-notebook",
          assetId: "missing-attachment-asset",
          name: "broken.txt",
          mimeType: "text/plain",
          size: 1,
          createdAt: "",
        },
      ],
      appSettings: {
        id: "app-settings",
        backgroundMode: "custom",
        backgroundId: "deep-space",
        customBackgroundAssetId: "missing-background",
        backgroundDimAmount: 0.5,
        backgroundBlurAmount: 0,
        updatedAt: "",
      },
    };

    vi.mocked(getDatabase).mockResolvedValue(createMockDatabase(state) as never);

    const result = await repairStorageIntegrity();

    expect(result).toEqual({
      deletedAssets: 1,
      deletedNotebookAttachments: 1,
      deletedPageElements: 1,
      unresolvedNotebookAttachments: 0,
      unresolvedPageElements: 0,
      resetNotebookCovers: 1,
      resetBackgroundLink: true,
    });
    expect(state.assets.map((item) => item.id).sort()).toEqual(["asset-valid-attachment", "asset-valid-image"]);
    expect(state.notebookAttachments.map((item) => item.id)).toEqual(["attachment-valid"]);
    expect(state.pageElements.map((item) => item.id).sort()).toEqual(["element-text", "element-valid"]);
    expect(state.notebooks[0].coverImageAssetId).toBeNull();
    expect(state.notebooks[0].coverMode).toBe("preset");
    expect(state.appSettings?.customBackgroundAssetId).toBeNull();
    expect(state.appSettings?.backgroundMode).toBe("preset");
    expect(recordStorageWriteSuccess).toHaveBeenCalledWith(
      "repair storage integrity",
      expect.stringContaining("notebook attachments 1"),
    );
    expect(recordStorageWriteFailure).not.toHaveBeenCalled();
  });
});
