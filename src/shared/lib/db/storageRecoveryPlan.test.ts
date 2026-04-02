import { describe, expect, it } from "vitest";
import { buildStorageRecoveryPlan } from "@/shared/lib/db/storageRecoveryPlan";

describe("buildStorageRecoveryPlan", () => {
  it("returns no steps for safe storage state", () => {
    expect(
      buildStorageRecoveryPlan({
        storageTone: "safe",
        storageInsights: null,
        storageHealth: null,
        draftDiagnostics: null,
      }),
    ).toEqual({
      steps: [],
      primaryNotebookId: null,
      shouldOpenHome: false,
      shouldClearDrafts: false,
    });
  });

  it("prioritizes heaviest notebook, background cleanup and draft cleanup under warning pressure", () => {
    const plan = buildStorageRecoveryPlan({
      storageTone: "warning",
      storageInsights: {
        topNotebooks: [
          {
            notebookId: "notebook-1",
            title: "Тяжёлый блокнот",
            totalBytes: 25,
            assetCount: 2,
            pageCount: 4,
            attachmentCount: 1,
            imageBytes: 20,
            fileBytes: 3,
            coverBytes: 2,
          },
        ],
        appBackgroundBytes: 12,
        unassignedAssetBytes: 0,
        totalTrackedAssetBytes: 37,
      },
      storageHealth: null,
      draftDiagnostics: {
        totalEntries: 2,
        uniquePageCount: 1,
        pages: [],
        entries: [],
        sourceCounts: {
          sessionStorage: 1,
          localStorage: 1,
        },
        kindCounts: {
          recovery: 1,
          snapshot: 1,
        },
        invalidEntryCount: 0,
      },
    });

    expect(plan.primaryNotebookId).toBe("notebook-1");
    expect(plan.shouldOpenHome).toBe(true);
    expect(plan.shouldClearDrafts).toBe(true);
    expect(plan.steps.join(" ")).toContain("Тяжёлый блокнот");
    expect(plan.steps.join(" ")).toContain("пользовательского фона");
    expect(plan.steps.join(" ")).toContain("stale recovery drafts");
  });

  it("mentions failed write and blocking of new heavy uploads under danger pressure", () => {
    const plan = buildStorageRecoveryPlan({
      storageTone: "danger",
      storageInsights: {
        topNotebooks: [],
        appBackgroundBytes: 0,
        unassignedAssetBytes: 0,
        totalTrackedAssetBytes: 0,
      },
      storageHealth: {
        tone: "warning",
        title: "Хранилище под риском",
        description: "Последняя запись упала.",
        availability: {
          checkedAt: "2026-04-02T00:00:00.000Z",
          indexedDbAvailable: true,
          localStorageAvailable: true,
          databaseAvailable: true,
        },
        lastWrite: {
          outcome: "failure",
          operation: "save asset",
          message: "Quota exceeded",
          timestamp: "2026-04-02T00:00:00.000Z",
        },
        details: [],
      },
      draftDiagnostics: null,
    });

    expect(plan.steps.join(" ")).toContain("save asset");
    expect(plan.steps.join(" ")).toContain("не добавляйте новые крупные");
  });
});
