import { Dispatch, PointerEvent as ReactPointerEvent, SetStateAction } from "react";
import { clampValue, isPointInBounds } from "@/features/editor/lib/transformUtils";
import { useObjectTransformController } from "@/features/editor/lib/useObjectTransformController";
import { TextPageElement } from "@/shared/types/models";

interface TextDragState {
  id: string;
  mode: "move" | "resize";
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  originWidth: number;
  originHeight: number;
}

interface UseTextTransformControllerOptions {
  closeActiveTextEditing: () => void;
  commitTextElement: (item: TextPageElement) => void;
  deleteTextElement: (targetId: string) => void;
  getPageBounds: () => DOMRect | null;
  getTextElement: (targetId: string) => TextPageElement | null;
  getTrashBounds: () => DOMRect | null;
  maxTextBlockWidth: number;
  minTextBlockHeight: number;
  minTextBlockWidth: number;
  promoteTextElement: (targetId: string) => TextPageElement | null;
  selectTextElement: (targetId: string) => void;
  setIsObjectDragging: Dispatch<SetStateAction<boolean>>;
  setIsTrashHover: Dispatch<SetStateAction<boolean>>;
  setTextElements: Dispatch<SetStateAction<TextPageElement[]>>;
}

export function useTextTransformController({
  closeActiveTextEditing,
  commitTextElement,
  deleteTextElement,
  getPageBounds,
  getTextElement,
  getTrashBounds,
  maxTextBlockWidth,
  minTextBlockHeight,
  minTextBlockWidth,
  promoteTextElement,
  selectTextElement,
  setIsObjectDragging,
  setIsTrashHover,
  setTextElements,
}: UseTextTransformControllerOptions) {
  function getItemOrStop(targetId: string, event: ReactPointerEvent<HTMLButtonElement>) {
    const targetElement = getTextElement(targetId);

    if (!targetElement) {
      return null;
    }

    event.preventDefault();
    event.stopPropagation();
    return targetElement;
  }

  const { beginResize, finishInteraction, handleMove, handlePressStart } = useObjectTransformController<
    TextPageElement,
    TextDragState
  >({
    activateItem: (item) => {
      closeActiveTextEditing();
      selectTextElement(item.id);
      return promoteTextElement(item.id) ?? item;
    },
    createDragState: (item, mode, clientX, clientY) => ({
      id: item.id,
      mode,
      startX: clientX,
      startY: clientY,
      originX: item.x,
      originY: item.y,
      originWidth: item.width,
      originHeight: item.height,
    }),
    getFinalItem: (itemId) => getTextElement(itemId),
    getTrashBounds,
    onCommit: (item) => {
      commitTextElement(item);
    },
    onDelete: (itemId) => {
      deleteTextElement(itemId);
    },
    onDragStateChange: setIsObjectDragging,
    onMoveWithDrag: (event, item, dragState) => {
      const bounds = getPageBounds();

      if (!bounds) {
        return;
      }

      if (dragState.mode === "move") {
        const maxX = Math.max(0, bounds.width - item.width);
        const maxY = Math.max(0, bounds.height - item.height);
        const nextX = clampValue(dragState.originX + (event.clientX - dragState.startX), 0, maxX);
        const nextY = clampValue(dragState.originY + (event.clientY - dragState.startY), 0, maxY);

        setTextElements((current) =>
          current.map((currentItem) => (currentItem.id === item.id ? { ...currentItem, x: nextX, y: nextY } : currentItem)),
        );
        return;
      }

      const maxWidth = Math.max(minTextBlockWidth, Math.min(maxTextBlockWidth, bounds.width - item.x));
      const maxHeight = Math.max(minTextBlockHeight, bounds.height - item.y);
      const nextWidth = clampValue(dragState.originWidth + (event.clientX - dragState.startX), minTextBlockWidth, maxWidth);
      const nextHeight = clampValue(dragState.originHeight + (event.clientY - dragState.startY), minTextBlockHeight, maxHeight);

      setTextElements((current) =>
        current.map((currentItem) =>
          currentItem.id === item.id ? { ...currentItem, width: nextWidth, height: nextHeight } : currentItem,
        ),
      );
    },
    onTrashHoverChange: setIsTrashHover,
  });

  function handleTextDragStart(targetId: string, event: ReactPointerEvent<HTMLButtonElement>) {
    const targetElement = getItemOrStop(targetId, event);

    if (!targetElement) {
      return;
    }

    handlePressStart(event, targetElement);
  }

  function handleTextResizeStart(targetId: string, event: ReactPointerEvent<HTMLButtonElement>) {
    const targetElement = getItemOrStop(targetId, event);

    if (!targetElement) {
      return;
    }

    beginResize(event, targetElement);
  }

  function handleTextDragMove(targetId: string, event: ReactPointerEvent<HTMLButtonElement>) {
    const targetElement = getTextElement(targetId);

    if (!targetElement) {
      return;
    }

    handleMove(event, targetElement);
  }

  function handleTextDragEnd(targetId: string, event: ReactPointerEvent<HTMLButtonElement>) {
    finishInteraction(event, targetId);

    if (!isPointInBounds(event.clientX, event.clientY, getTrashBounds()) && getTextElement(targetId)) {
      selectTextElement(targetId);
    }
  }

  return {
    handleTextDragStart,
    handleTextResizeStart,
    handleTextDragMove,
    handleTextDragEnd,
  };
}
