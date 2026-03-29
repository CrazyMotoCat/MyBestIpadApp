import { useEffect, useState } from "react";
import { getAssetObjectUrl } from "@/features/editor/api/editor";
import { FileAttachmentPageElement, NotebookAttachment } from "@/shared/types/models";

type AttachmentListItem =
  | FileAttachmentPageElement
  | (NotebookAttachment & {
      type?: "notebook";
    });

interface FileAttachmentListProps {
  items: AttachmentListItem[];
}

function FileAttachmentRow({ item }: { item: AttachmentListItem }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;
    let objectUrl: string | null = null;

    void getAssetObjectUrl(item.assetId).then((nextUrl) => {
      if (!isActive) {
        if (nextUrl) {
          URL.revokeObjectURL(nextUrl);
        }
        return;
      }

      objectUrl = nextUrl;
      setUrl(nextUrl);
    });

    return () => {
      isActive = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [item.assetId]);

  return (
    <div className="attachment-row">
      <div className="attachment-row__meta">
        <strong>{item.name}</strong>
        <span className="muted">
          {item.mimeType || "Файл"} • {Math.max(1, Math.round(item.size / 1024))} КБ
        </span>
      </div>
      {url ? (
        <a className="button button--ghost" href={url} download={item.name}>
          Скачать
        </a>
      ) : null}
    </div>
  );
}

export function FileAttachmentList({ items }: FileAttachmentListProps) {
  if (items.length === 0) {
    return <div className="empty-inline">Вложений пока нет.</div>;
  }

  return (
    <div className="stack">
      {items.map((item) => (
        <FileAttachmentRow key={item.id} item={item} />
      ))}
    </div>
  );
}

