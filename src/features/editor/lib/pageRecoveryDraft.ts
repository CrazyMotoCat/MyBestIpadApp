import {
  DrawingStroke,
  FileAttachmentPageElement,
  ImagePageElement,
  PageLayout,
  ShapeNoteElement,
  TextPageElement,
} from "@/shared/types/models";
import { PaperPresetId } from "@/shared/types/presets";

const PAGE_RECOVERY_DRAFT_PREFIX = "editor-page-draft:";
const PAGE_DRAFT_STORAGE_PREFIX = "mybestipadapp:page-draft:";
const PAGE_RECOVERY_PERSISTED_PREFIX = "mybestipadapp:persisted-page-recovery:";
const PAGE_DRAFT_PERSISTED_PREFIX = "mybestipadapp:persisted-page-draft:";

export interface PageRecoveryDraft {
  pageId: string;
  title: string;
  paperType: PaperPresetId;
  paperColor: string;
  layout: PageLayout;
  textElements: TextPageElement[];
  images: ImagePageElement[];
  files: FileAttachmentPageElement[];
  shapes: ShapeNoteElement[];
}

export interface PageDraftSnapshot extends PageRecoveryDraft {
  strokes: DrawingStroke[];
  savedAt: string;
}

interface PageRecoveryDraftPayload {
  pageId: string;
  title: string;
  paperType: PaperPresetId;
  paperColor: string;
  layout: PageLayout;
  textElements: TextPageElement[];
  images: ImagePageElement[];
  files: FileAttachmentPageElement[];
  shapes: ShapeNoteElement[];
}

function getPageRecoveryDraftKey(pageId: string) {
  return `${PAGE_RECOVERY_DRAFT_PREFIX}${pageId}`;
}

function getPageDraftStorageKey(pageId: string) {
  return `${PAGE_DRAFT_STORAGE_PREFIX}${pageId}`;
}

function getPersistedPageRecoveryDraftKey(pageId: string) {
  return `${PAGE_RECOVERY_PERSISTED_PREFIX}${pageId}`;
}

function getPersistedPageDraftStorageKey(pageId: string) {
  return `${PAGE_DRAFT_PERSISTED_PREFIX}${pageId}`;
}

function readJsonFromStorage<T>(storage: Storage | undefined, key: string) {
  if (!storage) {
    return null;
  }

  try {
    const raw = storage.getItem(key);

    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJsonToStorage(storage: Storage | undefined, key: string, value: unknown) {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage availability/quota issues and keep editor usable.
  }
}

function removeFromStorage(storage: Storage | undefined, key: string) {
  if (!storage) {
    return;
  }

  try {
    storage.removeItem(key);
  } catch {
    // Ignore storage availability issues and keep editor usable.
  }
}

function clearKeysByPrefixes(storage: Storage | undefined, prefixes: string[]) {
  if (!storage) {
    return;
  }

  try {
    const keysToDelete: string[] = [];

    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);

      if (key && prefixes.some((prefix) => key.startsWith(prefix))) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => storage.removeItem(key));
  } catch {
    // Ignore storage availability issues and keep editor usable.
  }
}

export function serializePageRecoveryDraft(draft: PageRecoveryDraft) {
  return JSON.stringify(draft);
}

export function createPageRecoveryDraft(payload: PageRecoveryDraftPayload): PageRecoveryDraft {
  return {
    pageId: payload.pageId,
    title: payload.title,
    paperType: payload.paperType,
    paperColor: payload.paperColor,
    layout: payload.layout,
    textElements: payload.textElements,
    images: payload.images,
    files: payload.files,
    shapes: payload.shapes,
  };
}

export function createPageDraftSnapshot(payload: PageRecoveryDraftPayload & { strokes: DrawingStroke[] }): PageDraftSnapshot {
  return {
    ...createPageRecoveryDraft(payload),
    strokes: payload.strokes,
    savedAt: new Date().toISOString(),
  };
}

export function readPageRecoveryDraft(pageId: string) {
  const sessionDraft = readJsonFromStorage<PageRecoveryDraft>(window.sessionStorage, getPageRecoveryDraftKey(pageId));

  if (sessionDraft?.pageId === pageId) {
    return sessionDraft;
  }

  const persistedDraft = readJsonFromStorage<PageRecoveryDraft>(
    window.localStorage,
    getPersistedPageRecoveryDraftKey(pageId),
  );
  return persistedDraft?.pageId === pageId ? persistedDraft : null;
}

export function clearPageRecoveryDraft(pageId: string) {
  removeFromStorage(window.sessionStorage, getPageRecoveryDraftKey(pageId));
  removeFromStorage(window.localStorage, getPersistedPageRecoveryDraftKey(pageId));
}

export function writePageRecoveryDraft(pageId: string, draft: PageRecoveryDraft) {
  writeJsonToStorage(window.sessionStorage, getPageRecoveryDraftKey(pageId), draft);
  writeJsonToStorage(window.localStorage, getPersistedPageRecoveryDraftKey(pageId), draft);
}

export function readPageDraftSnapshot(pageId: string) {
  const sessionSnapshot = readJsonFromStorage<PageDraftSnapshot>(window.sessionStorage, getPageDraftStorageKey(pageId));

  if (sessionSnapshot) {
    return sessionSnapshot;
  }

  return readJsonFromStorage<PageDraftSnapshot>(window.localStorage, getPersistedPageDraftStorageKey(pageId));
}

export function clearPageDraftSnapshot(pageId: string) {
  removeFromStorage(window.sessionStorage, getPageDraftStorageKey(pageId));
  removeFromStorage(window.localStorage, getPersistedPageDraftStorageKey(pageId));
}

export function writePageDraftSnapshot(pageId: string, snapshot: PageDraftSnapshot) {
  writeJsonToStorage(window.sessionStorage, getPageDraftStorageKey(pageId), snapshot);
  writeJsonToStorage(window.localStorage, getPersistedPageDraftStorageKey(pageId), snapshot);
}

export function clearAllPageRecoveryDrafts() {
  clearKeysByPrefixes(window.sessionStorage, [PAGE_RECOVERY_DRAFT_PREFIX, PAGE_DRAFT_STORAGE_PREFIX]);
  clearKeysByPrefixes(window.localStorage, [PAGE_RECOVERY_PERSISTED_PREFIX, PAGE_DRAFT_PERSISTED_PREFIX]);
}
