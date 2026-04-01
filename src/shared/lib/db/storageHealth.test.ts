import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearStorageHealthStatus,
  getStorageAvailabilityStatus,
  getStorageHealthSnapshot,
  getStorageHealthSummary,
  readStorageHealthStatus,
  writeStorageHealthStatus,
} from "@/shared/lib/db/storageHealth";

vi.mock("@/shared/lib/db/database", () => ({
  getDatabase: vi.fn(),
}));

function createMemoryStorage() {
  const store = new Map<string, string>();

  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  } as Storage;
}

Object.defineProperty(globalThis, "localStorage", {
  value: createMemoryStorage(),
  configurable: true,
  writable: true,
});

Object.defineProperty(globalThis, "indexedDB", {
  value: {},
  configurable: true,
  writable: true,
});

async function mockGetDatabaseResolved() {
  const { getDatabase } = await import("@/shared/lib/db/database");
  vi.mocked(getDatabase).mockResolvedValue({} as never);
}

async function mockGetDatabaseRejected() {
  const { getDatabase } = await import("@/shared/lib/db/database");
  vi.mocked(getDatabase).mockRejectedValue(new Error("indexeddb unavailable"));
}

afterEach(() => {
  vi.restoreAllMocks();
  globalThis.localStorage.clear();
  clearStorageHealthStatus();
});

describe("storage health status", () => {
  it("stores and reads the last write status", () => {
    const status = writeStorageHealthStatus({
      outcome: "failure",
      operation: "save page",
      message: "Недостаточно места",
      timestamp: "2026-04-02T00:00:00.000Z",
    });

    expect(status).toEqual({
      outcome: "failure",
      operation: "save page",
      message: "Недостаточно места",
      timestamp: "2026-04-02T00:00:00.000Z",
    });
    expect(readStorageHealthStatus()).toEqual(status);
  });

  it("clears the stored health status", () => {
    writeStorageHealthStatus({
      outcome: "success",
      operation: "save page",
      message: "ok",
      timestamp: "2026-04-02T00:00:00.000Z",
    });

    clearStorageHealthStatus();

    expect(readStorageHealthStatus()).toBeNull();
  });
});

describe("storage availability", () => {
  it("reports both storage layers when IndexedDB is available", async () => {
    await mockGetDatabaseResolved();

    const status = await getStorageAvailabilityStatus();

    expect(status.indexedDbAvailable).toBe(true);
    expect(status.databaseAvailable).toBe(true);
    expect(status.localStorageAvailable).toBe(true);
  });

  it("marks IndexedDB as unavailable when the DB probe fails", async () => {
    await mockGetDatabaseRejected();

    const status = await getStorageAvailabilityStatus();

    expect(status.indexedDbAvailable).toBe(false);
    expect(status.databaseAvailable).toBe(false);
  });
});

describe("storage health summary", () => {
  it("returns danger when IndexedDB is unavailable", () => {
    const summary = getStorageHealthSummary({
      checkedAt: "2026-04-02T00:00:00.000Z",
      indexedDbAvailable: false,
      localStorageAvailable: true,
      databaseAvailable: false,
      lastWrite: null,
    });

    expect(summary.tone).toBe("danger");
    expect(summary.title).toContain("недоступна");
  });

  it("includes the last write record in the support summary", () => {
    const summary = getStorageHealthSummary({
      checkedAt: "2026-04-02T00:00:00.000Z",
      indexedDbAvailable: true,
      localStorageAvailable: true,
      databaseAvailable: true,
      lastWrite: {
        outcome: "failure",
        operation: "import backup",
        message: "Quota exceeded",
        timestamp: "2026-04-02T00:00:00.000Z",
      },
    });

    expect(summary.tone).toBe("warning");
    expect(summary.details.join(" ")).toContain("import backup");
    expect(summary.details.join(" ")).toContain("Quota exceeded");
  });

  it("returns a snapshot summary from live probes", async () => {
    await mockGetDatabaseResolved();
    writeStorageHealthStatus({
      outcome: "success",
      operation: "save page",
      message: "saved",
      timestamp: "2026-04-02T00:00:00.000Z",
    });

    const summary = getStorageHealthSummary(await getStorageHealthSnapshot());

    expect(summary.tone).toBe("ready");
    expect(summary.lastWrite?.operation).toBe("save page");
  });
});
