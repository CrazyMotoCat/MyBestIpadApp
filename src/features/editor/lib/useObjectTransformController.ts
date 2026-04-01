import { MutableRefObject, PointerEvent as ReactPointerEvent, useEffect, useRef } from "react";
import {
  clearPendingLongPress,
  finishDragInteraction,
  hasMovedBeyondTolerance,
  isPointInBounds,
  releasePointerCaptureSafely,
  scheduleLongPress,
} from "@/features/editor/lib/transformUtils";

type TransformMode = "move" | "resize";

interface PendingLongPress {
  id: string;
  pointerId: number;
  startX: number;
  startY: number;
}

interface BaseDragState {
  id: string;
  startX: number;
  startY: number;
}

interface UseObjectTransformControllerOptions<Item extends { id: string }, DragState extends BaseDragState> {
  activateItem: (item: Item) => Item;
  createDragState: (item: Item, mode: TransformMode, clientX: number, clientY: number) => DragState;
  dragRef?: MutableRefObject<DragState | null>;
  getFinalItem: (itemId: string, dragState: DragState) => Item | null | undefined;
  getTrashBounds: () => DOMRect | null;
  onCommit: (item: Item, dragState: DragState) => void;
  onDelete: (itemId: string, dragState: DragState) => void;
  onDragStateChange: (isDragging: boolean) => void;
  onMoveWithDrag: (event: ReactPointerEvent<HTMLElement>, item: Item, dragState: DragState) => void;
  onTrashHoverChange: (isHoveringTrash: boolean) => void;
}

export function useObjectTransformController<Item extends { id: string }, DragState extends BaseDragState>({
  activateItem,
  createDragState,
  dragRef: externalDragRef,
  getFinalItem,
  getTrashBounds,
  onCommit,
  onDelete,
  onDragStateChange,
  onMoveWithDrag,
  onTrashHoverChange,
}: UseObjectTransformControllerOptions<Item, DragState>) {
  const internalDragRef = useRef<DragState | null>(null);
  const dragRef = externalDragRef ?? internalDragRef;
  const longPressTimeoutRef = useRef<number | null>(null);
  const pendingLongPressRef = useRef<PendingLongPress | null>(null);

  useEffect(() => {
    return () => {
      clearPendingLongPress(longPressTimeoutRef, pendingLongPressRef);
    };
  }, []);

  function clearLongPress() {
    clearPendingLongPress(longPressTimeoutRef, pendingLongPressRef);
  }

  function startDrag(item: Item, mode: TransformMode, clientX: number, clientY: number) {
    dragRef.current = createDragState(item, mode, clientX, clientY);
    onDragStateChange(true);
    onTrashHoverChange(false);
  }

  function handlePressStart(event: ReactPointerEvent<HTMLElement>, item: Item) {
    event.stopPropagation();
    const promotedItem = activateItem(item);
    event.currentTarget.setPointerCapture(event.pointerId);

    if (event.pointerType === "mouse") {
      startDrag(promotedItem, "move", event.clientX, event.clientY);
      return;
    }

    scheduleLongPress(
      longPressTimeoutRef,
      pendingLongPressRef,
      {
        id: promotedItem.id,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
      },
      (pending) => {
        if (pending.id !== promotedItem.id || pending.pointerId !== event.pointerId) {
          return;
        }

        startDrag(promotedItem, "move", pending.startX, pending.startY);
      },
    );
  }

  function beginResize(event: ReactPointerEvent<HTMLElement>, item: Item) {
    event.stopPropagation();
    clearLongPress();
    const promotedItem = activateItem(item);
    event.currentTarget.setPointerCapture(event.pointerId);
    startDrag(promotedItem, "resize", event.clientX, event.clientY);
  }

  function handleMove(event: ReactPointerEvent<HTMLElement>, item: Item) {
    const dragState = dragRef.current;

    if (dragState && dragState.id === item.id) {
      onMoveWithDrag(event, item, dragState);
      onTrashHoverChange(isPointInBounds(event.clientX, event.clientY, getTrashBounds()));
      return;
    }

    const pending = pendingLongPressRef.current;

    if (!pending || pending.id !== item.id || pending.pointerId !== event.pointerId) {
      return;
    }

    if (hasMovedBeyondTolerance(pending.startX, pending.startY, event.clientX, event.clientY)) {
      clearLongPress();
      releasePointerCaptureSafely(event.currentTarget, event.pointerId);
    }
  }

  function finishInteraction(event: ReactPointerEvent<HTMLElement>, itemId: string) {
    const dragState = dragRef.current;

    if (
      dragState &&
      finishDragInteraction({
        target: event.currentTarget,
        pointerId: event.pointerId,
        dragMatches: dragState.id === itemId,
        shouldDelete: isPointInBounds(event.clientX, event.clientY, getTrashBounds()),
        finalItem: getFinalItem(itemId, dragState),
        resetDragState: () => {
          dragRef.current = null;
          onDragStateChange(false);
          onTrashHoverChange(false);
        },
        onDelete: () => onDelete(itemId, dragState),
        onCommit: (item) => onCommit(item, dragState),
      })
    ) {
      return;
    }

    const pending = pendingLongPressRef.current;

    if (pending && pending.id === itemId && pending.pointerId === event.pointerId) {
      clearLongPress();
      releasePointerCaptureSafely(event.currentTarget, event.pointerId);
    }
  }

  return {
    dragRef,
    handleMove,
    handlePressStart,
    beginResize,
    finishInteraction,
    clearLongPress,
  };
}
