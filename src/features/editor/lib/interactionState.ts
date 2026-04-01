import { Dispatch, SetStateAction } from "react";

type FlipDirection = "" | "left" | "right";

interface SelectionControllerOptions {
  activeTextElementId: string | null;
  textInputRefs: Record<string, HTMLTextAreaElement | null>;
  setActiveElementId: Dispatch<SetStateAction<string | null>>;
  setActiveTextElementId: Dispatch<SetStateAction<string | null>>;
  setIsKeyboardTextMode: Dispatch<SetStateAction<boolean>>;
  setIsPaletteOpen: Dispatch<SetStateAction<boolean>>;
  setIsTrashHover: Dispatch<SetStateAction<boolean>>;
  setSwipePreviewDirection: Dispatch<SetStateAction<FlipDirection>>;
  setSwipePreviewProgress: Dispatch<SetStateAction<number>>;
  setSwipePreviewOffsetX: Dispatch<SetStateAction<number>>;
}

export function replaceItemById<T extends { id: string }>(items: T[], nextItem: T) {
  return items.map((item) => (item.id === nextItem.id ? nextItem : item));
}

export function removeItemById<T extends { id: string }>(items: T[], targetId: string) {
  return items.filter((item) => item.id !== targetId);
}

export function createEditorSelectionController({
  activeTextElementId,
  textInputRefs,
  setActiveElementId,
  setActiveTextElementId,
  setIsKeyboardTextMode,
  setIsPaletteOpen,
  setIsTrashHover,
  setSwipePreviewDirection,
  setSwipePreviewProgress,
  setSwipePreviewOffsetX,
}: SelectionControllerOptions) {
  function closeActiveTextEditing() {
    if (activeTextElementId) {
      textInputRefs[activeTextElementId]?.blur();
    }

    setIsKeyboardTextMode(false);
    setActiveTextElementId(null);
    setIsPaletteOpen(false);
  }

  function selectOverlayElement(targetId: string) {
    closeActiveTextEditing();
    setActiveElementId(targetId);
  }

  function selectTextElement(targetId: string, options?: { editing?: boolean }) {
    setActiveElementId(null);
    setActiveTextElementId(targetId);
    setIsKeyboardTextMode(options?.editing ?? false);

    if (!options?.editing) {
      setIsPaletteOpen(false);
    }
  }

  function releaseSelectionForElement(targetId: string) {
    setActiveElementId((current) => (current === targetId ? null : current));
    setActiveTextElementId((current) => (current === targetId ? null : current));

    if (activeTextElementId === targetId) {
      setIsKeyboardTextMode(false);
    }

    setIsPaletteOpen(false);
  }

  function clearActiveObjectSelection() {
    closeActiveTextEditing();
    setActiveElementId(null);
    setIsTrashHover(false);
    setSwipePreviewDirection("");
    setSwipePreviewProgress(0);
    setSwipePreviewOffsetX(0);
  }

  return {
    clearActiveObjectSelection,
    closeActiveTextEditing,
    releaseSelectionForElement,
    selectOverlayElement,
    selectTextElement,
  };
}
