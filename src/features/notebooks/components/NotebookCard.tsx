import { CSSProperties, KeyboardEvent, PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";
import { NotebookBinding } from "@/features/notebooks/components/NotebookBinding";
import { getCoverPreset } from "@/shared/config/coverPresets";
import { notebookStylePresets } from "@/shared/config/notebookPresets";
import { useAssetObjectUrl } from "@/shared/lib/useAssetObjectUrl";
import { Notebook } from "@/shared/types/models";

interface NotebookCardProps {
  notebook: Notebook;
  pagesCount: number;
  isDeleting?: boolean;
  deleteOffset?: { x: number; y: number };
  deleteDragOffset?: { x: number; y: number };
  onOpen: (notebookId: string) => void;
  onDragStart: (notebookId: string) => void;
  onDragMove: (point: { x: number; y: number }) => void;
  onDragEnd: (
    notebookId: string,
    point: { x: number; y: number },
    rect: DOMRect | null,
    dragOffset: { x: number; y: number },
  ) => void;
}

function withAlpha(hexColor: string, alpha: number) {
  const normalized = hexColor.replace("#", "");

  if (normalized.length !== 6) {
    return `rgba(126, 143, 255, ${alpha})`;
  }

  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function buildNotebookStyle(
  notebook: Notebook,
  coverImageUrl: string | null,
  pagesCount: number,
  dragOffset: { x: number; y: number },
  deleteOffset: { x: number; y: number },
): CSSProperties {
  const notebookStyle = notebookStylePresets.find((preset) => preset.id === notebook.style);
  const coverPreset = getCoverPreset(notebook.coverPreset);
  const accent = notebookStyle?.accent ?? notebook.color;
  const thickness = Math.min(30, 12 + Math.max(0, pagesCount - 1) * 1.6);
  const coverBackground =
    notebook.coverMode === "custom" && coverImageUrl
      ? `${notebook.coverBackground}, linear-gradient(180deg, rgba(7,9,15,.18), rgba(7,9,15,.4)), url("${coverImageUrl}") center / cover no-repeat`
      : `${notebook.coverBackground}, ${coverPreset.preview}`;

  return {
    "--notebook-accent": accent,
    "--notebook-accent-soft": withAlpha(accent, 0.26),
    "--notebook-surface": notebookStyle?.surface ?? notebook.coverBackground,
    "--notebook-cover": coverBackground,
    "--notebook-thickness": `${thickness}px`,
    "--notebook-drag-x": `${dragOffset.x}px`,
    "--notebook-drag-y": `${dragOffset.y}px`,
    "--notebook-delete-x": `${deleteOffset.x}px`,
    "--notebook-delete-y": `${deleteOffset.y}px`,
  } as CSSProperties;
}

const LONG_PRESS_MS = 180;
const DRAG_THRESHOLD = 10;

export function NotebookCard({
  notebook,
  pagesCount,
  isDeleting = false,
  deleteOffset = { x: 0, y: 0 },
  deleteDragOffset = { x: 0, y: 0 },
  onOpen,
  onDragStart,
  onDragMove,
  onDragEnd,
}: NotebookCardProps) {
  const coverImageUrl = useAssetObjectUrl(notebook.coverImageAssetId);
  const hasTitle = notebook.title.trim().length > 0;
  const rootRef = useRef<HTMLButtonElement | null>(null);
  const dragTimerRef = useRef<number | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const originRef = useRef({ x: 0, y: 0 });
  const draggingRef = useRef(false);
  const movedRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  function clearDragTimer() {
    if (dragTimerRef.current !== null) {
      window.clearTimeout(dragTimerRef.current);
      dragTimerRef.current = null;
    }
  }

  function resetDragState() {
    clearDragTimer();
    pointerIdRef.current = null;
    draggingRef.current = false;
    movedRef.current = false;
    setIsDragging(false);
    setDragOffset({ x: 0, y: 0 });
  }

  useEffect(() => resetDragState, []);

  function beginDragging() {
    draggingRef.current = true;
    setIsDragging(true);
    setDragOffset({ x: 0, y: 0 });
    onDragStart(notebook.id);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (isDeleting) {
      return;
    }

    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    pointerIdRef.current = event.pointerId;
    originRef.current = { x: event.clientX, y: event.clientY };
    movedRef.current = false;
    rootRef.current?.setPointerCapture(event.pointerId);
    clearDragTimer();
    dragTimerRef.current = window.setTimeout(beginDragging, LONG_PRESS_MS);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    if (pointerIdRef.current !== event.pointerId || isDeleting) {
      return;
    }

    const nextOffset = {
      x: event.clientX - originRef.current.x,
      y: event.clientY - originRef.current.y,
    };

    if (!draggingRef.current && Math.hypot(nextOffset.x, nextOffset.y) > DRAG_THRESHOLD) {
      movedRef.current = true;
      clearDragTimer();
    }

    if (!draggingRef.current) {
      return;
    }

    event.preventDefault();
    movedRef.current = true;
    setDragOffset(nextOffset);
    onDragMove({ x: event.clientX, y: event.clientY });
  }

  function finishPointer(event: ReactPointerEvent<HTMLButtonElement>, cancelled = false) {
    if (pointerIdRef.current !== event.pointerId) {
      return;
    }

    const point = { x: event.clientX, y: event.clientY };
    const rect = rootRef.current?.getBoundingClientRect() ?? null;
    const wasDragging = draggingRef.current;

    try {
      rootRef.current?.releasePointerCapture(event.pointerId);
    } catch {
      // ignore release errors
    }

    resetDragState();

    if (cancelled) {
      return;
    }

    if (wasDragging) {
      onDragEnd(notebook.id, point, rect, dragOffset);
      return;
    }

    if (!movedRef.current) {
      onOpen(notebook.id);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (isDeleting) {
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen(notebook.id);
    }
  }

  return (
    <button
      ref={rootRef}
      type="button"
      className={`notebook-link notebook-link--button ${isDragging ? "notebook-link--dragging" : ""} ${
        isDeleting ? "notebook-link--deleting" : ""
      }`}
      style={buildNotebookStyle(
        notebook,
        coverImageUrl,
        pagesCount,
        isDeleting ? deleteDragOffset : dragOffset,
        deleteOffset,
      )}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(event) => finishPointer(event)}
      onPointerCancel={(event) => finishPointer(event, true)}
      onKeyDown={handleKeyDown}
      aria-label={hasTitle ? `Открыть блокнот ${notebook.title}` : "Открыть блокнот"}
    >
      <article className="notebook-object">
        <div className="notebook-object__shadow" aria-hidden="true" />
        <div className="notebook-object__stack" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>

        <div className="notebook-object__body">
          <div className="notebook-object__spine" aria-hidden="true" />
          <div className="notebook-object__cover">
            <NotebookBinding bindingType={notebook.bindingType} />
            <div className="notebook-object__grain" aria-hidden="true" />
            <div className="notebook-object__shine" aria-hidden="true" />
            <div className="notebook-object__title-wrap">{hasTitle ? <h3 className="notebook-object__title">{notebook.title}</h3> : null}</div>
          </div>
        </div>
      </article>
    </button>
  );
}
