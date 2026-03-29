import { useEffect, useState } from "react";
import { getAssetObjectUrl } from "@/shared/lib/db/assets";

export function useAssetObjectUrl(assetId: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;
    let objectUrl: string | null = null;

    if (!assetId) {
      setUrl(null);
      return;
    }

    void getAssetObjectUrl(assetId).then((nextUrl) => {
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
  }, [assetId]);

  return url;
}
