import { PointerEvent, useRef } from "react";
import { buildPaperStyle } from "@/shared/lib/paper";
import { ShapeNoteElement } from "@/shared/types/models";

interface ShapeNoteLayerProps {
  items: ShapeNoteElement[];
  onChange: (item: ShapeNoteElement) => void;
}

type DragMode = "move" | "resize";

export function ShapeNoteLayer({ items, onChange }: ShapeNoteLayerProps) {
  const dragRef = useRef<{
    id: string;
    mode: DragMode;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    originWidth: number;
    originHeight: number;
  } | null>(null);

  function beginDrag(event: PointerEvent<HTMLDivElement>, item: ShapeNoteElement, mode: DragMode) {
    event.stopPropagation();
    dragRef.current = {
      id: item.id,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      originX: item.x,
      originY: item.y,
      originWidth: item.width,
      originHeight: item.height,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleMove(event: PointerEvent<HTMLDivElement>, item: ShapeNoteElement) {
    const dragState = dragRef.current;

    if (!dragState || dragState.id !== item.id) {
      return;
    }

    const deltaX = event.clientX - dragState.startX;
    const deltaY = event.clientY - dragState.startY;

    if (dragState.mode === "move") {
      onChange({
        ...item,
        x: Math.max(0, dragState.originX + deltaX),
        y: Math.max(0, dragState.originY + deltaY),
      });
      return;
    }

    onChange({
      ...item,
      width: Math.max(140, dragState.originWidth + deltaX),
      height: Math.max(100, dragState.originHeight + deltaY),
    });
  }

  function endDrag() {
    dragRef.current = null;
  }

  return (
    <div className="shape-layer">
      {items.map((item) => (
        <div
          key={item.id}
          className={`shape-note ${item.edgeStyle === "torn" ? "shape-note--torn" : ""}`}
          style={{
            ...buildPaperStyle(item.paperStyle, item.color),
            left: item.x,
            top: item.y,
            width: item.width,
            height: item.height,
          }}
        >
          <div
            className="shape-note__drag"
            onPointerDown={(event) => beginDrag(event, item, "move")}
            onPointerMove={(event) => handleMove(event, item)}
            onPointerUp={endDrag}
          />
          <textarea
            className="shape-note__textarea"
            value={item.text}
            onChange={(event) => onChange({ ...item, text: event.target.value })}
            placeholder="Текст вставки"
          />
          <div
            className="shape-note__resize"
            onPointerDown={(event) => beginDrag(event, item, "resize")}
            onPointerMove={(event) => handleMove(event, item)}
            onPointerUp={endDrag}
          />
        </div>
      ))}
    </div>
  );
}

