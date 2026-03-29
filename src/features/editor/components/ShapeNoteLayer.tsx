import { PointerEvent, useEffect, useRef, useState } from "react";
import { buildPaperStyle } from "@/shared/lib/paper";
import { ShapeNoteElement } from "@/shared/types/models";

interface ShapeNoteLayerProps {
  items: ShapeNoteElement[];
  activeItemId: string | null;
  onChange: (item: ShapeNoteElement) => void;
  onCommit: (item: ShapeNoteElement) => void;
  onDelete: (id: string) => void;
  onInteractStart: (item: ShapeNoteElement) => ShapeNoteElement;
  getTrashBounds: () => DOMRect | null;
  onDragStateChange: (isDragging: boolean) => void;
  onTrashHoverChange: (isHoveringTrash: boolean) => void;
}

type DragMode = "move" | "resize";

interface DragState {
  id: string;
  mode: DragMode;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  originWidth: number;
  originHeight: number;
}

interface PendingLongPress {
  id: string;
  pointerId: number;
  startX: number;
  startY: number;
}

const LONG_PRESS_MS = 260;
const LONG_PRESS_MOVE_TOLERANCE = 12;

function isPointInRect(x: number, y: number, rect: DOMRect | null) {
  if (!rect) {
    return false;
  }

  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function hasMovedTooFar(startX: number, startY: number, currentX: number, currentY: number) {
  return Math.abs(currentX - startX) > LONG_PRESS_MOVE_TOLERANCE || Math.abs(currentY - startY) > LONG_PRESS_MOVE_TOLERANCE;
}

export function ShapeNoteLayer({
  items,
  activeItemId,
  onChange,
  onCommit,
  onDelete,
  onInteractStart,
  getTrashBounds,
  onDragStateChange,
  onTrashHoverChange,
}: ShapeNoteLayerProps) {
  const [draftItems, setDraftItems] = useState(items);
  const dragRef = useRef<DragState | null>(null);
  const draftItemsRef = useRef(items);
  const longPressTimeoutRef = useRef<number | null>(null);
  const pendingLongPressRef = useRef<PendingLongPress | null>(null);

  useEffect(() => {
    if (!dragRef.current) {
      setDraftItems(items);
      draftItemsRef.current = items;
    }
  }, [items]);

  useEffect(() => {
    return () => {
      if (longPressTimeoutRef.current !== null) {
        window.clearTimeout(longPressTimeoutRef.current);
      }
    };
  }, []);

  function clearLongPress() {
    if (longPressTimeoutRef.current !== null) {
      window.clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }

    pendingLongPressRef.current = null;
  }

  function updateDraftItems(updater: (current: ShapeNoteElement[]) => ShapeNoteElement[]) {
    setDraftItems((current) => {
      const nextItems = updater(current);
      draftItemsRef.current = nextItems;
      return nextItems;
    });
  }

  function startDrag(item: ShapeNoteElement, mode: DragMode, clientX: number, clientY: number) {
    dragRef.current = {
      id: item.id,
      mode,
      startX: clientX,
      startY: clientY,
      originX: item.x,
      originY: item.y,
      originWidth: item.width,
      originHeight: item.height,
    };
    onDragStateChange(true);
    onTrashHoverChange(false);
  }

  function activateItem(item: ShapeNoteElement) {
    const promotedItem = onInteractStart(item);
    draftItemsRef.current = items.map((currentItem) => (currentItem.id === promotedItem.id ? promotedItem : currentItem));
    setDraftItems(draftItemsRef.current);
    return promotedItem;
  }

  function handlePressStart(event: PointerEvent<HTMLDivElement>, item: ShapeNoteElement) {
    event.stopPropagation();
    const promotedItem = activateItem(item);
    event.currentTarget.setPointerCapture(event.pointerId);

    if (event.pointerType === "mouse") {
      startDrag(promotedItem, "move", event.clientX, event.clientY);
      return;
    }

    clearLongPress();
    pendingLongPressRef.current = {
      id: promotedItem.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };
    longPressTimeoutRef.current = window.setTimeout(() => {
      const pending = pendingLongPressRef.current;

      if (!pending || pending.id !== promotedItem.id || pending.pointerId !== event.pointerId) {
        return;
      }

      startDrag(promotedItem, "move", pending.startX, pending.startY);
      longPressTimeoutRef.current = null;
    }, LONG_PRESS_MS);
  }

  function beginResize(event: PointerEvent<HTMLDivElement>, item: ShapeNoteElement) {
    event.stopPropagation();
    clearLongPress();
    const promotedItem = activateItem(item);
    event.currentTarget.setPointerCapture(event.pointerId);
    startDrag(promotedItem, "resize", event.clientX, event.clientY);
  }

  function handleMove(event: PointerEvent<HTMLDivElement>, item: ShapeNoteElement) {
    const dragState = dragRef.current;

    if (dragState && dragState.id === item.id) {
      const deltaX = event.clientX - dragState.startX;
      const deltaY = event.clientY - dragState.startY;

      updateDraftItems((current) =>
        current.map((currentItem) => {
          if (currentItem.id !== item.id) {
            return currentItem;
          }

          if (dragState.mode === "move") {
            return {
              ...currentItem,
              x: Math.max(0, dragState.originX + deltaX),
              y: Math.max(0, dragState.originY + deltaY),
            };
          }

          return {
            ...currentItem,
            width: Math.max(140, dragState.originWidth + deltaX),
            height: Math.max(100, dragState.originHeight + deltaY),
          };
        }),
      );

      onTrashHoverChange(isPointInRect(event.clientX, event.clientY, getTrashBounds()));
      return;
    }

    const pending = pendingLongPressRef.current;

    if (!pending || pending.id !== item.id || pending.pointerId !== event.pointerId) {
      return;
    }

    if (hasMovedTooFar(pending.startX, pending.startY, event.clientX, event.clientY)) {
      clearLongPress();
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    }
  }

  function finishInteraction(event: PointerEvent<HTMLDivElement>, itemId: string) {
    const dragState = dragRef.current;

    if (dragState && dragState.id === itemId) {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      const finalItem = draftItemsRef.current.find((item) => item.id === itemId);
      const shouldDelete = isPointInRect(event.clientX, event.clientY, getTrashBounds());

      dragRef.current = null;
      onDragStateChange(false);
      onTrashHoverChange(false);

      if (!finalItem) {
        return;
      }

      if (shouldDelete) {
        onDelete(itemId);
        return;
      }

      onCommit(finalItem);
      return;
    }

    const pending = pendingLongPressRef.current;

    if (pending && pending.id === itemId && pending.pointerId === event.pointerId) {
      clearLongPress();
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    }
  }

  return (
    <div className="shape-layer">
      {draftItems.map((item) => (
        <div
          key={item.id}
          className={`shape-note ${item.edgeStyle === "torn" ? "shape-note--torn" : ""} ${
            activeItemId === item.id ? "shape-note--active" : ""
          }`}
          style={{
            ...buildPaperStyle(item.paperStyle, item.color),
            left: item.x,
            top: item.y,
            width: item.width,
            height: item.height,
            zIndex: item.zIndex,
          }}
          onPointerDown={(event) => handlePressStart(event, item)}
          onPointerMove={(event) => handleMove(event, item)}
          onPointerUp={(event) => finishInteraction(event, item.id)}
          onPointerCancel={(event) => finishInteraction(event, item.id)}
        >
          <div className="shape-note__drag" aria-hidden="true" />
          <textarea
            className="shape-note__textarea"
            value={item.text}
            onPointerDown={(event) => event.stopPropagation()}
            onChange={(event) => onChange({ ...item, text: event.target.value })}
            onBlur={() => onCommit(item)}
            placeholder="Текст вставки"
          />
          <div
            className="shape-note__resize"
            onPointerDown={(event) => beginResize(event, item)}
            onPointerMove={(event) => handleMove(event, item)}
            onPointerUp={(event) => finishInteraction(event, item.id)}
            onPointerCancel={(event) => finishInteraction(event, item.id)}
          />
        </div>
      ))}
    </div>
  );
}
