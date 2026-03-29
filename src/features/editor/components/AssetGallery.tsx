import { useEffect, useState } from "react";
import { getAssetObjectUrl } from "@/features/editor/api/editor";
import { ImagePageElement } from "@/shared/types/models";

interface AssetGalleryProps {
  items: ImagePageElement[];
}

function AssetCard({ item }: { item: ImagePageElement }) {
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
    <div className="asset-card">
      {url ? <img className="asset-card__image" src={url} alt={item.name} /> : <div className="asset-card__placeholder" />}
      <div className="stack">
        <strong>{item.name}</strong>
        <span className="muted">{Math.round(item.size / 1024)} КБ</span>
      </div>
    </div>
  );
}

export function AssetGallery({ items }: AssetGalleryProps) {
  if (items.length === 0) {
    return <div className="empty-inline">Изображений пока нет.</div>;
  }

  return (
    <div className="asset-grid">
      {items.map((item) => (
        <AssetCard key={item.id} item={item} />
      ))}
    </div>
  );
}

