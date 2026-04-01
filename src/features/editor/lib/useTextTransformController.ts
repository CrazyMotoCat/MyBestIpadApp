import { Dispatch, PointerEvent as ReactPointerEvent, SetStateAction, useRef } from "react";
import { finishDragInteraction, clampValue, isPointInBounds } from "@/features/editor/lib/transformUtils";
import { TextPageElement } from "@/shared/types/models";

interface TextDragState {
  id: string;
  mode: "move" | "resize";
  pointerId: number;
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
  const dragRef = useRef<TextDragState | null>(null);

  function resetDragState() {
    dragRef.current = null;
    setIsObjectDragging(false);
    setIsTrashHover(false);
  }

  function beginTextTransform(targetId: string, mode: "move" | "resize", event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();

    const targetElement = getTextElement(targetId);

    if (!targetElement) {
      return;
    }

    closeActiveTextEditing();
    selectTextElement(targetId);
    const promotedElement = promoteTextElement(targetId) ?? targetElement;
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsObjectDragging(mode === "move");
    setIsTrashHover(false);
    dragRef.current = {
      id: targetId,
      mode,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: promotedElement.x,
      originY: promotedElement.y,
      originWidth: promotedElement.width,
      originHeight: promotedElement.height,
    };
  }

  function handleTextDragStart(targetId: string, event: ReactPointerEvent<HTMLButtonElement>) {
    beginTextTransform(targetId, "move", event);
  }

  function handleTextResizeStart(targetId: string, event: ReactPointerEvent<HTMLButtonElement>) {
    beginTextTransform(targetId, "resize", event);
  }

  function handleTextDragMove(targetId: string, event: ReactPointerEvent<HTMLButtonElement>) {
    const dragState = dragRef.current;

    if (!dragState || dragState.id !== targetId || dragState.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const targetElement = getTextElement(targetId);
    const bounds = getPageBounds();

    if (!targetElement || !bounds) {
      return;
    }

    if (dragState.mode === "move") {
      const maxX = Math.max(0, bounds.width - targetElement.width);
      const maxY = Math.max(0, bounds.height - targetElement.height);
      const nextX = clampValue(dragState.originX + (event.clientX - dragState.startX), 0, maxX);
      const nextY = clampValue(dragState.originY + (event.clientY - dragState.startY), 0, maxY);
      setIsObjectDragging(true);
      setIsTrashHover(isPointInBounds(event.clientX, event.clientY, getTrashBounds()));

      setTextElements((current) =>
        current.map((item) => (item.id === targetId ? { ...item, x: nextX, y: nextY } : item)),
      );
      return;
    }

    const maxWidth = Math.max(minTextBlockWidth, Math.min(maxTextBlockWidth, bounds.width - targetElement.x));
    const maxHeight = Math.max(minTextBlockHeight, bounds.height - targetElement.y);
    const nextWidth = clampValue(dragState.originWidth + (event.clientX - dragState.startX), minTextBlockWidth, maxWidth);
    const nextHeight = clampValue(dragState.originHeight + (event.clientY - dragState.startY), minTextBlockHeight, maxHeight);

    setTextElements((current) =>
      current.map((item) => (item.id === targetId ? { ...item, width: nextWidth, height: nextHeight } : item)),
    );
  }

  function handleTextDragEnd(targetId: string, event: ReactPointerEvent<HTMLButtonElement>) {
    const dragState = dragRef.current;
    const finalItem = getTextElement(targetId);

    if (!dragState || dragState.id !== targetId || dragState.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    if (
      finishDragInteraction({
        target: event.currentTarget,
        pointerId: event.pointerId,
        dragMatches: true,
        shouldDelete: dragState.mode === "move" && isPointInBounds(event.clientX, event.clientY, getTrashBounds()),
        finalItem,
        resetDragState,
        onDelete: () => deleteTextElement(targetId),
        onCommit: (item) => commitTextElement(item),
      })
    ) {
      return;
    }

    selectTextElement(targetId);
  }

  return {
    handleTextDragStart,
    handleTextResizeStart,
    handleTextDragMove,
    handleTextDragEnd,
  };
}
