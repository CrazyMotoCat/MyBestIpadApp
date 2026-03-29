import { PointerEvent, useEffect, useRef, useState } from "react";
import { useAssetObjectUrl } from "@/shared/lib/useAssetObjectUrl";
import { FileAttachmentPageElement, ImagePageElement } from "@/shared/types/models";

interface PageMediaLayerProps {
  images: ImagePageElement[];
  files: FileAttachmentPageElement[];
  activeItemId: string | null;
  onImageChange: (item: ImagePageElement) => void;
  onImageCommit: (item: ImagePageElement) => void;
  onImageDelete: (id: string) => void;
  onImageInteractStart: (item: ImagePageElement) => ImagePageElement;
  onFileChange: (item: FileAttachmentPageElement) => void;
  onFileCommit: (item: FileAttachmentPageElement) => void;
  onFileDelete: (id: string) => void;
  onFileInteractStart: (item: FileAttachmentPageElement) => FileAttachmentPageElement;
  getTrashBounds: () => DOMRect | null;
  onDragStateChange: (isDragging: boolean) => void;
  onTrashHoverChange: (isHoveringTrash: boolean) => void;
}

type MediaDragMode = "move" | "resize";
type MediaElement = ImagePageElement | FileAttachmentPageElement;

interface DragState {
  id: string;
  mode: MediaDragMode;
  type: MediaElement["type"];
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

function ImageElementCard({
  item,
  isActive,
  onChange,
  onCommit,
  onContainerPointerDown,
  onContainerPointerMove,
  onContainerPointerUp,
  onResizePointerDown,
  onResizePointerMove,
  onResizePointerUp,
}: {
  item: ImagePageElement;
  isActive: boolean;
  onChange: (item: ImagePageElement) => void;
  onCommit: (item: ImagePageElement) => void;
  onContainerPointerDown: (event: PointerEvent<HTMLElement>, item: MediaElement) => void;
  onContainerPointerMove: (event: PointerEvent<HTMLElement>, item: MediaElement) => void;
  onContainerPointerUp: (event: PointerEvent<HTMLElement>, itemId: string) => void;
  onResizePointerDown: (event: PointerEvent<HTMLDivElement>, item: MediaElement) => void;
  onResizePointerMove: (event: PointerEvent<HTMLDivElement>, item: MediaElement) => void;
  onResizePointerUp: (event: PointerEvent<HTMLDivElement>, itemId: string) => void;
}) {
  const imageUrl = useAssetObjectUrl(item.assetId);

  return (
    <article
      className={`page-media page-media--image ${isActive ? "page-media--active" : ""}`}
      style={{
        left: item.x,
        top: item.y,
        width: item.width,
        height: item.height,
        zIndex: item.zIndex,
      }}
      onPointerDown={(event) => onContainerPointerDown(event, item)}
      onPointerMove={(event) => onContainerPointerMove(event, item)}
      onPointerUp={(event) => onContainerPointerUp(event, item.id)}
      onPointerCancel={(event) => onContainerPointerUp(event, item.id)}
    >
      <div className="page-media__drag" aria-hidden="true" />
      {imageUrl ? <img className="page-media__image" src={imageUrl} alt={item.name} /> : <div className="page-media__placeholder" />}
      <input
        className="page-media__caption"
        value={item.caption}
        onPointerDown={(event) => event.stopPropagation()}
        onChange={(event) => onChange({ ...item, caption: event.target.value })}
        onBlur={() => onCommit(item)}
        placeholder="Подпись к изображению"
      />
      <div
        className="page-media__resize"
        onPointerDown={(event) => onResizePointerDown(event, item)}
        onPointerMove={(event) => onResizePointerMove(event, item)}
        onPointerUp={(event) => onResizePointerUp(event, item.id)}
        onPointerCancel={(event) => onResizePointerUp(event, item.id)}
      />
    </article>
  );
}

function FileElementCard({
  item,
  isActive,
  onChange,
  onCommit,
  onContainerPointerDown,
  onContainerPointerMove,
  onContainerPointerUp,
  onResizePointerDown,
  onResizePointerMove,
  onResizePointerUp,
}: {
  item: FileAttachmentPageElement;
  isActive: boolean;
  onChange: (item: FileAttachmentPageElement) => void;
  onCommit: (item: FileAttachmentPageElement) => void;
  onContainerPointerDown: (event: PointerEvent<HTMLElement>, item: MediaElement) => void;
  onContainerPointerMove: (event: PointerEvent<HTMLElement>, item: MediaElement) => void;
  onContainerPointerUp: (event: PointerEvent<HTMLElement>, itemId: string) => void;
  onResizePointerDown: (event: PointerEvent<HTMLDivElement>, item: MediaElement) => void;
  onResizePointerMove: (event: PointerEvent<HTMLDivElement>, item: MediaElement) => void;
  onResizePointerUp: (event: PointerEvent<HTMLDivElement>, itemId: string) => void;
}) {
  return (
    <article
      className={`page-media page-media--file ${isActive ? "page-media--active" : ""}`}
      style={{
        left: item.x,
        top: item.y,
        width: item.width,
        height: item.height,
        zIndex: item.zIndex,
      }}
      onPointerDown={(event) => onContainerPointerDown(event, item)}
      onPointerMove={(event) => onContainerPointerMove(event, item)}
      onPointerUp={(event) => onContainerPointerUp(event, item.id)}
      onPointerCancel={(event) => onContainerPointerUp(event, item.id)}
    >
      <div className="page-media__drag" aria-hidden="true" />
      <div className="page-media__file-icon" aria-hidden="true">
        FILE
      </div>
      <div className="page-media__file-meta">
        <strong>{item.name}</strong>
        <span>
          {item.mimeType || "Файл"} • {Math.max(1, Math.round(item.size / 1024))} КБ
        </span>
      </div>
      <input
        className="page-media__caption"
        value={item.note}
        onPointerDown={(event) => event.stopPropagation()}
        onChange={(event) => onChange({ ...item, note: event.target.value })}
        onBlur={() => onCommit(item)}
        placeholder="Заметка к файлу"
      />
      <div
        className="page-media__resize"
        onPointerDown={(event) => onResizePointerDown(event, item)}
        onPointerMove={(event) => onResizePointerMove(event, item)}
        onPointerUp={(event) => onResizePointerUp(event, item.id)}
        onPointerCancel={(event) => onResizePointerUp(event, item.id)}
      />
    </article>
  );
}

export function PageMediaLayer({
  images,
  files,
  activeItemId,
  onImageChange,
  onImageCommit,
  onImageDelete,
  onImageInteractStart,
  onFileChange,
  onFileCommit,
  onFileDelete,
  onFileInteractStart,
  getTrashBounds,
  onDragStateChange,
  onTrashHoverChange,
}: PageMediaLayerProps) {
  const [draftImages, setDraftImages] = useState(images);
  const [draftFiles, setDraftFiles] = useState(files);
  const dragRef = useRef<DragState | null>(null);
  const draftImagesRef = useRef(images);
  const draftFilesRef = useRef(files);
  const longPressTimeoutRef = useRef<number | null>(null);
  const pendingLongPressRef = useRef<PendingLongPress | null>(null);

  useEffect(() => {
    if (!dragRef.current) {
      setDraftImages(images);
      draftImagesRef.current = images;
    }
  }, [images]);

  useEffect(() => {
    if (!dragRef.current) {
      setDraftFiles(files);
      draftFilesRef.current = files;
    }
  }, [files]);

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

  function updateDraftImages(updater: (current: ImagePageElement[]) => ImagePageElement[]) {
    setDraftImages((current) => {
      const nextItems = updater(current);
      draftImagesRef.current = nextItems;
      return nextItems;
    });
  }

  function updateDraftFiles(updater: (current: FileAttachmentPageElement[]) => FileAttachmentPageElement[]) {
    setDraftFiles((current) => {
      const nextItems = updater(current);
      draftFilesRef.current = nextItems;
      return nextItems;
    });
  }

  function startDrag(item: MediaElement, mode: MediaDragMode, clientX: number, clientY: number) {
    dragRef.current = {
      id: item.id,
      type: item.type,
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

  function activateItem(item: MediaElement) {
    if (item.type === "image") {
      const promotedItem = onImageInteractStart(item);
      draftImagesRef.current = images.map((currentItem) => (currentItem.id === promotedItem.id ? promotedItem : currentItem));
      setDraftImages(draftImagesRef.current);
      return promotedItem;
    }

    const promotedItem = onFileInteractStart(item);
    draftFilesRef.current = files.map((currentItem) => (currentItem.id === promotedItem.id ? promotedItem : currentItem));
    setDraftFiles(draftFilesRef.current);
    return promotedItem;
  }

  function handlePressStart(event: PointerEvent<HTMLElement>, item: MediaElement) {
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

  function beginResize(event: PointerEvent<HTMLDivElement>, item: MediaElement) {
    event.stopPropagation();
    clearLongPress();
    const promotedItem = activateItem(item);
    event.currentTarget.setPointerCapture(event.pointerId);
    startDrag(promotedItem, "resize", event.clientX, event.clientY);
  }

  function handleMove(event: PointerEvent<HTMLElement>, item: MediaElement) {
    const dragState = dragRef.current;

    if (dragState && dragState.id === item.id) {
      const deltaX = event.clientX - dragState.startX;
      const deltaY = event.clientY - dragState.startY;

      if (item.type === "image") {
        updateDraftImages((current) =>
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
              height: Math.max(120, dragState.originHeight + deltaY),
            };
          }),
        );
      } else {
        updateDraftFiles((current) =>
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
              width: Math.max(220, dragState.originWidth + deltaX),
              height: Math.max(92, dragState.originHeight + deltaY),
            };
          }),
        );
      }

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

  function finishInteraction(event: PointerEvent<HTMLElement>, itemId: string) {
    const dragState = dragRef.current;

    if (dragState && dragState.id === itemId) {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      const shouldDelete = isPointInRect(event.clientX, event.clientY, getTrashBounds());
      const finalImage = draftImagesRef.current.find((item) => item.id === itemId);
      const finalFile = draftFilesRef.current.find((item) => item.id === itemId);

      dragRef.current = null;
      onDragStateChange(false);
      onTrashHoverChange(false);

      if (dragState.type === "image" && finalImage) {
        if (shouldDelete) {
          onImageDelete(itemId);
        } else {
          onImageCommit(finalImage);
        }
        return;
      }

      if (dragState.type === "fileAttachment" && finalFile) {
        if (shouldDelete) {
          onFileDelete(itemId);
        } else {
          onFileCommit(finalFile);
        }
      }

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
    <div className="page-media-layer">
      {draftImages.map((item) => (
        <ImageElementCard
          key={item.id}
          item={item}
          isActive={activeItemId === item.id}
          onChange={onImageChange}
          onCommit={onImageCommit}
          onContainerPointerDown={handlePressStart}
          onContainerPointerMove={handleMove}
          onContainerPointerUp={finishInteraction}
          onResizePointerDown={beginResize}
          onResizePointerMove={handleMove}
          onResizePointerUp={finishInteraction}
        />
      ))}
      {draftFiles.map((item) => (
        <FileElementCard
          key={item.id}
          item={item}
          isActive={activeItemId === item.id}
          onChange={onFileChange}
          onCommit={onFileCommit}
          onContainerPointerDown={handlePressStart}
          onContainerPointerMove={handleMove}
          onContainerPointerUp={finishInteraction}
          onResizePointerDown={beginResize}
          onResizePointerMove={handleMove}
          onResizePointerUp={finishInteraction}
        />
      ))}
    </div>
  );
}
