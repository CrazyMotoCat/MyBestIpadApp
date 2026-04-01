import { getDatabase } from "@/shared/lib/db/database";
import {
  createOversizedAssetError,
  getStorageEstimateSnapshot,
  getStoragePressureWarningMessage,
  SOFT_ASSET_SIZE_LIMIT_BYTES,
  throwIfLikelyOverQuota,
  toStorageWriteError,
} from "@/shared/lib/db/storageErrors";
import { recordStorageWriteFailure, recordStorageWriteSuccess } from "@/shared/lib/db/storageHealth";
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
  if (blob.size > SOFT_ASSET_SIZE_LIMIT_BYTES) {
    throw createOversizedAssetError(blob.size);
  }

  const estimate = await getStorageEstimateSnapshot();
  throwIfLikelyOverQuota("этого вложения", blob.size, estimate.availableBytes);

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

  try {
    await db.put("assets", asset);
    recordStorageWriteSuccess("save asset", `Сохранено локальное вложение ${asset.name}.`);
    return asset;
  } catch (error) {
    recordStorageWriteFailure("save asset", error, "Не удалось сохранить вложение.");
    throw toStorageWriteError(error, "сохранить вложение");
  }
}

export async function saveFileAsset(ownerId: string, file: File, kind: AssetKind) {
  return saveBlobAsset(ownerId, file, kind, {
    name: file.name,
    mimeType: file.type || "application/octet-stream",
  });
}

export async function getBlobAssetStorageWarning(blob: Blob, entityLabel: string) {
  const estimate = await getStorageEstimateSnapshot();
  return getStoragePressureWarningMessage(entityLabel, blob.size, estimate.availableBytes);
}

export async function getAssetById(assetId: string) {
  const db = await getDatabase();
  return db.get("assets", assetId);
}

export async function deleteAssetById(assetId: string) {
  const db = await getDatabase();

  try {
    await db.delete("assets", assetId);
    recordStorageWriteSuccess("delete asset", `Локальное вложение ${assetId} удалено.`);
  } catch (error) {
    recordStorageWriteFailure("delete asset", error, "Не удалось удалить локальное вложение.");
    throw error;
  }
}

export async function getAssetObjectUrl(assetId: string) {
  const asset = await getAssetById(assetId);
  return asset ? URL.createObjectURL(asset.blob) : null;
}
