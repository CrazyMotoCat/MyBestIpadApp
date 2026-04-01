import { DrawingStroke, PageLayout, TextPageElement } from "@/shared/types/models";
import { PaperPresetId } from "@/shared/types/presets";

const PAGE_RECOVERY_DRAFT_PREFIX = "editor-page-draft:";
const PAGE_DRAFT_STORAGE_PREFIX = "mybestipadapp:page-draft:";

export interface PageRecoveryDraft {
  pageId: string;
  title: string;
  paperType: PaperPresetId;
  paperColor: string;
  layout: PageLayout;
  textElements: TextPageElement[];
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
}

function getPageRecoveryDraftKey(pageId: string) {
  return `${PAGE_RECOVERY_DRAFT_PREFIX}${pageId}`;
}

function getPageDraftStorageKey(pageId: string) {
  return `${PAGE_DRAFT_STORAGE_PREFIX}${pageId}`;
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
  try {
    const raw = window.sessionStorage.getItem(getPageRecoveryDraftKey(pageId));

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as PageRecoveryDraft;
    return parsed.pageId === pageId ? parsed : null;
  } catch {
    return null;
  }
}

export function clearPageRecoveryDraft(pageId: string) {
  try {
    window.sessionStorage.removeItem(getPageRecoveryDraftKey(pageId));
  } catch {
    // Ignore sessionStorage availability issues and keep editor usable.
  }
}

export function writePageRecoveryDraft(pageId: string, draft: PageRecoveryDraft) {
  try {
    window.sessionStorage.setItem(getPageRecoveryDraftKey(pageId), serializePageRecoveryDraft(draft));
  } catch {
    // Ignore sessionStorage availability issues and keep editor usable.
  }
}

export function readPageDraftSnapshot(pageId: string) {
  try {
    const raw = window.sessionStorage.getItem(getPageDraftStorageKey(pageId));

    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as PageDraftSnapshot;
  } catch (error) {
    console.warn("Failed to read page draft snapshot", error);
    return null;
  }
}

export function clearPageDraftSnapshot(pageId: string) {
  try {
    window.sessionStorage.removeItem(getPageDraftStorageKey(pageId));
  } catch (error) {
    console.warn("Failed to clear page draft snapshot", error);
  }
}

export function writePageDraftSnapshot(pageId: string, snapshot: PageDraftSnapshot) {
  try {
    window.sessionStorage.setItem(getPageDraftStorageKey(pageId), JSON.stringify(snapshot));
  } catch (error) {
    console.warn("Failed to write page draft snapshot", error);
  }
}
