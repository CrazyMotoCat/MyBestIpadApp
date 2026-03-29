import { getDatabase } from "@/shared/lib/db/database";
import { createId } from "@/shared/lib/utils/id";
import { AssetKind, StoredAsset } from "@/shared/types/models";

function nowIso() {
  return new Date().toISOString();
}

export async function saveBlobAsset(
  ownerId: string,
  blob: Blob,
  kind: AssetKind,
  options?: { name?: string; mimeType?: string },
) {
  const db = await getDatabase();
  const asset: StoredAsset = {
    id: createId("asset"),
    kind,
    ownerId,
    blob,
    name: options?.name ?? "asset",
    mimeType: options?.mimeType ?? (blob.type || "application/octet-stream"),
    size: blob.size,
    createdAt: nowIso(),
  };

  await db.put("assets", asset);
  return asset;
}

export async function saveFileAsset(ownerId: string, file: File, kind: AssetKind) {
  return saveBlobAsset(ownerId, file, kind, {
    name: file.name,
    mimeType: file.type || "application/octet-stream",
  });
}

export async function getAssetById(assetId: string) {
  const db = await getDatabase();
  return db.get("assets", assetId);
}

export async function getAssetObjectUrl(assetId: string) {
  const asset = await getAssetById(assetId);
  return asset ? URL.createObjectURL(asset.blob) : null;
}
