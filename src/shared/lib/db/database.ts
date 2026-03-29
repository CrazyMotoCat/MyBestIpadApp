import { DBSchema, IDBPDatabase, openDB } from "idb";
import { AppSettings, DrawingStroke, Notebook, NotebookAttachment, Page, PageElement, StoredAsset } from "@/shared/types/models";

interface MyBestIpadSchema extends DBSchema {
  notebooks: {
    key: string;
    value: Notebook;
  };
  pages: {
    key: string;
    value: Page;
    indexes: {
      "by-notebookId": string;
    };
  };
  pageElements: {
    key: string;
    value: PageElement;
    indexes: {
      "by-pageId": string;
      "by-pageId-type": [string, string];
    };
  };
  drawingStrokes: {
    key: string;
    value: DrawingStroke;
    indexes: {
      "by-pageId": string;
    };
  };
  assets: {
    key: string;
    value: StoredAsset;
    indexes: {
      "by-ownerId": string;
      "by-kind": string;
    };
  };
  notebookAttachments: {
    key: string;
    value: NotebookAttachment;
    indexes: {
      "by-notebookId": string;
    };
  };
  appSettings: {
    key: string;
    value: AppSettings;
  };
}

type StoreName =
  | "notebooks"
  | "pages"
  | "pageElements"
  | "drawingStrokes"
  | "assets"
  | "notebookAttachments"
  | "appSettings";

let dbPromise: Promise<IDBPDatabase<MyBestIpadSchema>> | null = null;

function ensureStore(db: IDBPDatabase<MyBestIpadSchema>, storeName: StoreName, options?: IDBObjectStoreParameters) {
  if (!db.objectStoreNames.contains(storeName)) {
    db.createObjectStore(storeName, options);
  }
}

export function getDatabase() {
  if (!dbPromise) {
    dbPromise = openDB<MyBestIpadSchema>("my-best-ipad-app", 3, {
      upgrade(db, _oldVersion, _newVersion, transaction) {
        ensureStore(db, "notebooks", { keyPath: "id" });
        ensureStore(db, "pages", { keyPath: "id" });
        ensureStore(db, "pageElements", { keyPath: "id" });
        ensureStore(db, "drawingStrokes", { keyPath: "id" });
        ensureStore(db, "assets", { keyPath: "id" });
        ensureStore(db, "notebookAttachments", { keyPath: "id" });
        ensureStore(db, "appSettings", { keyPath: "id" });

        const pagesStore = transaction.objectStore("pages");
        if (!pagesStore.indexNames.contains("by-notebookId")) {
          pagesStore.createIndex("by-notebookId", "notebookId");
        }

        const elementsStore = transaction.objectStore("pageElements");
        if (!elementsStore.indexNames.contains("by-pageId")) {
          elementsStore.createIndex("by-pageId", "pageId");
        }
        if (!elementsStore.indexNames.contains("by-pageId-type")) {
          elementsStore.createIndex("by-pageId-type", ["pageId", "type"]);
        }

        const strokesStore = transaction.objectStore("drawingStrokes");
        if (!strokesStore.indexNames.contains("by-pageId")) {
          strokesStore.createIndex("by-pageId", "pageId");
        }

        const assetsStore = transaction.objectStore("assets");
        if (!assetsStore.indexNames.contains("by-ownerId")) {
          assetsStore.createIndex("by-ownerId", "ownerId");
        }
        if (!assetsStore.indexNames.contains("by-kind")) {
          assetsStore.createIndex("by-kind", "kind");
        }

        const notebookAttachmentsStore = transaction.objectStore("notebookAttachments");
        if (!notebookAttachmentsStore.indexNames.contains("by-notebookId")) {
          notebookAttachmentsStore.createIndex("by-notebookId", "notebookId");
        }
      },
    });
  }

  return dbPromise;
}
