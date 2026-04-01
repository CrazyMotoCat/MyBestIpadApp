import { PointerEvent, useRef } from "react";
import {
  clampValue,
} from "@/features/editor/lib/transformUtils";
import { useObjectTransformController } from "@/features/editor/lib/useObjectTransformController";
import { useDraftCollectionState } from "@/features/editor/lib/useDraftCollectionState";
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

function getLayerBounds(target: HTMLElement) {
  return target.closest(".page-media-layer")?.getBoundingClientRect() ?? null;
}

function ImageElementCard({
  item,
  isActive,
  onContainerPointerDown,
  onContainerPointerMove,
  onContainerPointerUp,
  onResizePointerDown,
  onResizePointerMove,
  onResizePointerUp,
}: {
  item: ImagePageElement;
  isActive: boolean;
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
  onContainerPointerDown,
  onContainerPointerMove,
  onContainerPointerUp,
  onResizePointerDown,
  onResizePointerMove,
  onResizePointerUp,
  onCaptionChange,
  onCaptionBlur,
}: {
  item: FileAttachmentPageElement;
  isActive: boolean;
  onContainerPointerDown: (event: PointerEvent<HTMLElement>, item: MediaElement) => void;
  onContainerPointerMove: (event: PointerEvent<HTMLElement>, item: MediaElement) => void;
  onContainerPointerUp: (event: PointerEvent<HTMLElement>, itemId: string) => void;
  onResizePointerDown: (event: PointerEvent<HTMLDivElement>, item: MediaElement) => void;
  onResizePointerMove: (event: PointerEvent<HTMLDivElement>, item: MediaElement) => void;
  onResizePointerUp: (event: PointerEvent<HTMLDivElement>, itemId: string) => void;
  onCaptionChange: (itemId: string, value: string) => void;
  onCaptionBlur: (itemId: string) => void;
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
        onChange={(event) => onCaptionChange(item.id, event.target.value)}
        onBlur={() => onCaptionBlur(item.id)}
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
  const dragRef = useRef<DragState | null>(null);
  const {
    items: draftImages,
    itemsRef: draftImagesRef,
    setItems: setDraftImages,
    updateItems: updateDraftImages,
  } = useDraftCollectionState(images, Boolean(dragRef.current));
  const {
    items: draftFiles,
    itemsRef: draftFilesRef,
    setItems: setDraftFiles,
    updateItems: updateDraftFiles,
  } = useDraftCollectionState(files, Boolean(dragRef.current));

  function activateItem(item: MediaElement) {
    if (item.type === "image") {
      const promotedItem = onImageInteractStart(item);
      draftImagesRef.current = draftImagesRef.current.map((currentItem) =>
        currentItem.id === promotedItem.id ? promotedItem : currentItem,
      );
      setDraftImages(draftImagesRef.current);
      return promotedItem;
    }

    const promotedItem = onFileInteractStart(item);
    draftFilesRef.current = draftFilesRef.current.map((currentItem) =>
      currentItem.id === promotedItem.id ? promotedItem : currentItem,
    );
    setDraftFiles(draftFilesRef.current);
    return promotedItem;
  }

  function handleFileCaptionChange(itemId: string, value: string) {
    updateDraftFiles((current) => {
      const nextItems = current.map((item) => (item.id === itemId ? { ...item, note: value } : item));
      const changedItem = nextItems.find((item) => item.id === itemId);

      if (changedItem) {
        onFileChange(changedItem);
      }

      return nextItems;
    });
  }

  function handleFileCaptionBlur(itemId: string) {
    const finalItem = draftFilesRef.current.find((item) => item.id === itemId);

    if (finalItem) {
      onFileCommit(finalItem);
    }
  }
  const { beginResize, finishInteraction, handleMove, handlePressStart } = useObjectTransformController<
    MediaElement,
    DragState
  >({
    activateItem,
    createDragState: (item, mode, clientX, clientY) => ({
      id: item.id,
      type: item.type,
      mode,
      startX: clientX,
      startY: clientY,
      originX: item.x,
      originY: item.y,
      originWidth: item.width,
      originHeight: item.height,
    }),
    dragRef,
    getFinalItem: (itemId, currentDragState) =>
      currentDragState.type === "image"
        ? draftImagesRef.current.find((item) => item.id === itemId)
        : draftFilesRef.current.find((item) => item.id === itemId),
    getTrashBounds,
    onCommit: (item, currentDragState) => {
      if (currentDragState.type === "image" && item.type === "image") {
        onImageCommit(item);
        return;
      }

      if (currentDragState.type === "fileAttachment" && item.type === "fileAttachment") {
        onFileCommit(item);
      }
    },
    onDelete: (itemId, currentDragState) => {
      if (currentDragState.type === "image") {
        onImageDelete(itemId);
        return;
      }

      onFileDelete(itemId);
    },
    onDragStateChange,
    onMoveWithDrag: (event, item, currentDragState) => {
      const deltaX = event.clientX - currentDragState.startX;
      const deltaY = event.clientY - currentDragState.startY;
      const layerBounds = getLayerBounds(event.currentTarget);

      if (item.type === "image") {
        updateDraftImages((current) =>
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
            const maxHeight = Math.max(120, (layerBounds?.height ?? currentDragState.originHeight + deltaY) - currentItem.y);
            return {
              ...currentItem,
              width: clampValue(currentDragState.originWidth + deltaX, 140, maxWidth),
              height: clampValue(currentDragState.originHeight + deltaY, 120, maxHeight),
            };
          }),
        );
        return;
      }

      updateDraftFiles((current) =>
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

          const maxWidth = Math.max(220, (layerBounds?.width ?? currentDragState.originWidth + deltaX) - currentItem.x);
          const maxHeight = Math.max(92, (layerBounds?.height ?? currentDragState.originHeight + deltaY) - currentItem.y);
          return {
            ...currentItem,
            width: clampValue(currentDragState.originWidth + deltaX, 220, maxWidth),
            height: clampValue(currentDragState.originHeight + deltaY, 92, maxHeight),
          };
        }),
      );
    },
    onTrashHoverChange,
  });

  return (
    <div className="page-media-layer">
      {draftImages.map((item) => (
        <ImageElementCard
          key={item.id}
          item={item}
          isActive={activeItemId === item.id}
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
          onContainerPointerDown={handlePressStart}
          onContainerPointerMove={handleMove}
          onContainerPointerUp={finishInteraction}
          onResizePointerDown={beginResize}
          onResizePointerMove={handleMove}
          onResizePointerUp={finishInteraction}
          onCaptionChange={handleFileCaptionChange}
          onCaptionBlur={handleFileCaptionBlur}
        />
      ))}
    </div>
  );
}
