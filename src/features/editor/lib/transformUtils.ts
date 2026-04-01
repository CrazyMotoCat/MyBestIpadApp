import { MutableRefObject } from "react";

export const DEFAULT_LONG_PRESS_MS = 260;
export const DEFAULT_LONG_PRESS_MOVE_TOLERANCE = 12;

export function clampValue(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function isPointInBounds(x: number, y: number, rect: DOMRect | null) {
  if (!rect) {
    return false;
  }

  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

export function hasMovedBeyondTolerance(
  startX: number,
  startY: number,
  currentX: number,
  currentY: number,
  tolerance = DEFAULT_LONG_PRESS_MOVE_TOLERANCE,
) {
  return Math.abs(currentX - startX) > tolerance || Math.abs(currentY - startY) > tolerance;
}

export function clearPendingLongPress<T>(
  timeoutRef: MutableRefObject<number | null>,
  pendingRef: MutableRefObject<T | null>,
) {
  if (timeoutRef.current !== null) {
    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }

  pendingRef.current = null;
}

export function scheduleLongPress<T>(
  timeoutRef: MutableRefObject<number | null>,
  pendingRef: MutableRefObject<T | null>,
  nextPending: T,
  onTrigger: (pending: T) => void,
  delay = DEFAULT_LONG_PRESS_MS,
) {
  clearPendingLongPress(timeoutRef, pendingRef);
  pendingRef.current = nextPending;
  timeoutRef.current = window.setTimeout(() => {
    const pending = pendingRef.current;

    if (!pending) {
      return;
    }

    onTrigger(pending);
    timeoutRef.current = null;
  }, delay);
}

export function releasePointerCaptureSafely(
  target: Pick<HTMLElement, "hasPointerCapture" | "releasePointerCapture">,
  pointerId: number,
) {
  if (target.hasPointerCapture(pointerId)) {
    target.releasePointerCapture(pointerId);
  }
}

export function finishDragInteraction<T>({
  target,
  pointerId,
  dragMatches,
  shouldDelete,
  finalItem,
  resetDragState,
  onDelete,
  onCommit,
}: {
  target: Pick<HTMLElement, "hasPointerCapture" | "releasePointerCapture">;
  pointerId: number;
  dragMatches: boolean;
  shouldDelete: boolean;
  finalItem: T | null | undefined;
  resetDragState: () => void;
  onDelete: () => void;
  onCommit: (item: T) => void;
}) {
  if (!dragMatches) {
    return false;
  }

  releasePointerCaptureSafely(target, pointerId);
  resetDragState();

  if (!finalItem) {
    return true;
  }

  if (shouldDelete) {
    onDelete();
    return true;
  }

  onCommit(finalItem);
  return true;
}
