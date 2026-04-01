import { clearAllPageRecoveryDrafts } from "@/features/editor/lib/pageRecoveryDraft";

export type PageRecoveryDraftStorageSource = "sessionStorage" | "localStorage";
export type PageRecoveryDraftKind = "recovery" | "snapshot";

export interface PageRecoveryDraftEntry {
  key: string;
  pageId: string;
  source: PageRecoveryDraftStorageSource;
  kind: PageRecoveryDraftKind;
  isValid: boolean;
}

export interface PageRecoveryDraftPageSummary {
  pageId: string;
  entryCount: number;
  sources: PageRecoveryDraftStorageSource[];
  kinds: PageRecoveryDraftKind[];
}

export interface PageRecoveryDraftDiagnostics {
  totalEntries: number;
  uniquePageCount: number;
  pages: PageRecoveryDraftPageSummary[];
  entries: PageRecoveryDraftEntry[];
  sourceCounts: Record<PageRecoveryDraftStorageSource, number>;
  kindCounts: Record<PageRecoveryDraftKind, number>;
  invalidEntryCount: number;
}

const PAGE_RECOVERY_DRAFT_PREFIX = "editor-page-draft:";
const PAGE_DRAFT_STORAGE_PREFIX = "mybestipadapp:page-draft:";
const PAGE_RECOVERY_PERSISTED_PREFIX = "mybestipadapp:persisted-page-recovery:";
const PAGE_DRAFT_PERSISTED_PREFIX = "mybestipadapp:persisted-page-draft:";

const SESSION_PREFIXES = [PAGE_RECOVERY_DRAFT_PREFIX, PAGE_DRAFT_STORAGE_PREFIX];
const LOCAL_PREFIXES = [PAGE_RECOVERY_PERSISTED_PREFIX, PAGE_DRAFT_PERSISTED_PREFIX];

function getStorageSource(storage: Storage) {
  return storage === window.sessionStorage ? "sessionStorage" : "localStorage";
}

function getDraftKind(key: string): PageRecoveryDraftKind {
  if (key.startsWith(PAGE_DRAFT_STORAGE_PREFIX) || key.startsWith(PAGE_DRAFT_PERSISTED_PREFIX)) {
    return "snapshot";
  }

  return "recovery";
}

function getPageIdFromKey(key: string) {
  return key.slice(key.lastIndexOf(":") + 1);
}

function readEntryPageId(storage: Storage, key: string) {
  try {
    const raw = storage.getItem(key);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as { pageId?: unknown } | null;
    return typeof parsed?.pageId === "string" && parsed.pageId ? parsed.pageId : null;
  } catch {
    return null;
  }
}

function readEntriesFromStorage(storage: Storage, prefixes: string[]): PageRecoveryDraftEntry[] {
  const entries: PageRecoveryDraftEntry[] = [];

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);

    if (!key || !prefixes.some((prefix) => key.startsWith(prefix))) {
      continue;
    }

    const pageId = readEntryPageId(storage, key) ?? getPageIdFromKey(key);
    const kind = getDraftKind(key);
    entries.push({
      key,
      pageId,
      source: getStorageSource(storage),
      kind,
      isValid: Boolean(readEntryPageId(storage, key)),
    });
  }

  return entries;
}

function uniqueSorted(values: string[]) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function sortSources(values: PageRecoveryDraftStorageSource[]) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function sortKinds(values: PageRecoveryDraftKind[]) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

export function getPageRecoveryDraftDiagnostics(): PageRecoveryDraftDiagnostics {
  const sessionEntries = readEntriesFromStorage(window.sessionStorage, SESSION_PREFIXES);
  const localEntries = readEntriesFromStorage(window.localStorage, LOCAL_PREFIXES);
  const entries = [...sessionEntries, ...localEntries];
  const pageIds = uniqueSorted(entries.map((entry) => entry.pageId));

  return {
    totalEntries: entries.length,
    uniquePageCount: pageIds.length,
    pages: pageIds.map((pageId) => {
      const pageEntries = entries.filter((entry) => entry.pageId === pageId);

      return {
        pageId,
        entryCount: pageEntries.length,
        sources: sortSources(pageEntries.map((entry) => entry.source)),
        kinds: sortKinds(pageEntries.map((entry) => entry.kind)),
      };
    }),
    entries,
    sourceCounts: {
      sessionStorage: sessionEntries.length,
      localStorage: localEntries.length,
    },
    kindCounts: {
      recovery: entries.filter((entry) => entry.kind === "recovery").length,
      snapshot: entries.filter((entry) => entry.kind === "snapshot").length,
    },
    invalidEntryCount: entries.filter((entry) => !entry.isValid).length,
  };
}

export function clearAllPendingPageRecoveryDrafts() {
  clearAllPageRecoveryDrafts();
}
