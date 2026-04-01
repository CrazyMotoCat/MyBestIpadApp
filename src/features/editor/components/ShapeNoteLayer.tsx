import { PointerEvent, useEffect, useRef } from "react";
import {
  clampValue,
} from "@/features/editor/lib/transformUtils";
import { useObjectTransformController } from "@/features/editor/lib/useObjectTransformController";
import { useDraftCollectionState } from "@/features/editor/lib/useDraftCollectionState";
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
  onDraftMutation?: () => void;
  registerDraftReader?: (reader: () => ShapeNoteElement[]) => () => void;
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

function getLayerBounds(target: HTMLElement) {
  return target.closest(".shape-layer")?.getBoundingClientRect() ?? null;
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
  onDraftMutation,
  registerDraftReader,
}: ShapeNoteLayerProps) {
  const dragRef = useRef<DragState | null>(null);
  const { items: draftItems, itemsRef: draftItemsRef, setItems: setDraftItems, updateItems: updateDraftItems } =
    useDraftCollectionState(items, Boolean(dragRef.current));

  useEffect(() => {
    if (!registerDraftReader) {
      return;
    }

    return registerDraftReader(() => draftItemsRef.current);
  }, [registerDraftReader]);

  function activateItem(item: ShapeNoteElement) {
    const promotedItem = onInteractStart(item);
    draftItemsRef.current = draftItemsRef.current.map((currentItem) =>
      currentItem.id === promotedItem.id ? promotedItem : currentItem,
    );
    setDraftItems(draftItemsRef.current);
    return promotedItem;
  }

  function handleTextChange(itemId: string, value: string) {
    updateDraftItems((current) => {
      const nextItems = current.map((item) => (item.id === itemId ? { ...item, text: value } : item));
      const changedItem = nextItems.find((item) => item.id === itemId);

      if (changedItem) {
        onChange(changedItem);
      }

      return nextItems;
    });
    onDraftMutation?.();
  }

  function handleTextBlur(itemId: string) {
    const finalItem = draftItemsRef.current.find((item) => item.id === itemId);

    if (finalItem) {
      onCommit(finalItem);
    }
  }
  const { beginResize, finishInteraction, handleMove, handlePressStart } = useObjectTransformController<
    ShapeNoteElement,
    DragState
  >({
    activateItem,
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
    dragRef,
    getFinalItem: (itemId) => draftItemsRef.current.find((item) => item.id === itemId),
    getTrashBounds,
    onCommit,
    onDelete: (itemId) => onDelete(itemId),
    onDragStateChange,
    onMoveWithDrag: (event, item, currentDragState) => {
      const deltaX = event.clientX - currentDragState.startX;
      const deltaY = event.clientY - currentDragState.startY;
      const layerBounds = getLayerBounds(event.currentTarget);

      updateDraftItems((current) =>
        current.map((currentItem) => {
          if (currentItem.id !== item.id) {
            return currentItem;
          }

          if (currentDragState.mode === "move") {
            const maxX = Math.max(0, (layerBounds?.width ?? Number.POSITIVE_INFINITY) - currentItem.width);
            const maxY = Math.max(0, (layerBounds?.height ?? Number.POSITIVE_INFINITY) - currentItem.height);
            return {
              ...currentItem,
              x: clampValue(currentDragState.originX + deltaX, 0, maxX),
              y: clampValue(currentDragState.originY + deltaY, 0, maxY),
            };
          }

          const maxWidth = Math.max(140, (layerBounds?.width ?? currentDragState.originWidth + deltaX) - currentItem.x);
          const maxHeight = Math.max(100, (layerBounds?.height ?? currentDragState.originHeight + deltaY) - currentItem.y);
          return {
            ...currentItem,
            width: clampValue(currentDragState.originWidth + deltaX, 140, maxWidth),
            height: clampValue(currentDragState.originHeight + deltaY, 100, maxHeight),
          };
        }),
      );
      onDraftMutation?.();
    },
    onTrashHoverChange,
  });

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
            onChange={(event) => handleTextChange(item.id, event.target.value)}
            onBlur={() => handleTextBlur(item.id)}
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
