import { beforeEach, describe, expect, it } from "vitest";
import {
  clearAllPendingPageRecoveryDrafts,
  getPageRecoveryDraftDiagnostics,
} from "@/features/editor/lib/pageRecoveryDraftDiagnostics";

function createMemoryStorage() {
  const entries = new Map<string, string>();

  const storage = {
    get length() {
      return entries.size;
    },
    key(index: number) {
      return [...entries.keys()][index] ?? null;
    },
    getItem(key: string) {
      return entries.has(key) ? entries.get(key) ?? null : null;
    },
    setItem(key: string, value: string) {
      entries.set(key, value);
    },
    removeItem(key: string) {
      entries.delete(key);
    },
    clear() {
      entries.clear();
    },
  };

  return storage as Storage;
}

const sessionStorage = createMemoryStorage();
const localStorage = createMemoryStorage();

Object.defineProperty(globalThis, "window", {
  value: {
    sessionStorage,
    localStorage,
  },
  configurable: true,
});

function writeStorageDraft(storage: Storage, key: string, value: unknown) {
  storage.setItem(key, JSON.stringify(value));
}

describe("getPageRecoveryDraftDiagnostics", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it("collects draft and snapshot entries from both storages", () => {
    writeStorageDraft(sessionStorage, "editor-page-draft:page-1", {
      pageId: "page-1",
      title: "Draft",
    });
    writeStorageDraft(sessionStorage, "mybestipadapp:page-draft:page-2", {
      pageId: "page-2",
      title: "Snapshot",
    });
    writeStorageDraft(localStorage, "mybestipadapp:persisted-page-recovery:page-1", {
      pageId: "page-1",
      title: "Persisted draft",
    });
    localStorage.setItem("mybestipadapp:persisted-page-draft:page-3", "{\"title\":\"Broken\"}");
    sessionStorage.setItem("unrelated:key", "{\"pageId\":\"ignore-me\"}");

    const diagnostics = getPageRecoveryDraftDiagnostics();

    expect(diagnostics.totalEntries).toBe(4);
    expect(diagnostics.uniquePageCount).toBe(3);
    expect(diagnostics.sourceCounts).toEqual({
      sessionStorage: 2,
      localStorage: 2,
    });
    expect(diagnostics.kindCounts).toEqual({
      recovery: 2,
      snapshot: 2,
    });
    expect(diagnostics.invalidEntryCount).toBe(1);
    expect(diagnostics.pages).toEqual([
      {
        pageId: "page-1",
        entryCount: 2,
        sources: ["localStorage", "sessionStorage"],
        kinds: ["recovery"],
      },
      {
        pageId: "page-2",
        entryCount: 1,
        sources: ["sessionStorage"],
        kinds: ["snapshot"],
      },
      {
        pageId: "page-3",
        entryCount: 1,
        sources: ["localStorage"],
        kinds: ["snapshot"],
      },
    ]);
  });
});

describe("clearAllPendingPageRecoveryDrafts", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it("clears only pending page recovery draft keys", () => {
    sessionStorage.setItem("editor-page-draft:page-1", "{\"pageId\":\"page-1\"}");
    localStorage.setItem("mybestipadapp:persisted-page-draft:page-2", "{\"pageId\":\"page-2\"}");
    sessionStorage.setItem("unrelated:key", "keep-me");
    localStorage.setItem("another:key", "keep-me-too");

    clearAllPendingPageRecoveryDrafts();

    expect(sessionStorage.getItem("editor-page-draft:page-1")).toBeNull();
    expect(localStorage.getItem("mybestipadapp:persisted-page-draft:page-2")).toBeNull();
    expect(sessionStorage.getItem("unrelated:key")).toBe("keep-me");
    expect(localStorage.getItem("another:key")).toBe("keep-me-too");
  });
});
