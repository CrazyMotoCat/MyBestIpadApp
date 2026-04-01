import { formatStorageBytes } from "@/shared/lib/db/storageErrors";

const RECOMMENDED_ASSET_SIZE_BYTES = 12 * 1024 * 1024;
const HARD_ASSET_SIZE_BYTES = 32 * 1024 * 1024;
const RECOMMENDED_BATCH_SIZE_BYTES = 24 * 1024 * 1024;
const HARD_BATCH_SIZE_BYTES = 48 * 1024 * 1024;
const RECOMMENDED_BACKUP_SIZE_BYTES = 24 * 1024 * 1024;
const HARD_BACKUP_SIZE_BYTES = 64 * 1024 * 1024;

export interface StoragePreflightResult {
  level: "ok" | "warning" | "blocked";
  message: string | null;
}

export function getAssetUploadPreflight(file: File, label: string): StoragePreflightResult {
  if (file.size >= HARD_ASSET_SIZE_BYTES) {
    return {
      level: "blocked",
      message: `${label} «${file.name}» весит ${formatStorageBytes(file.size)}. Для локального хранилища iPad Safari это уже слишком рискованный размер. Лучше уменьшить файл или разбить данные на несколько более лёгких вложений.`,
    };
  }

  if (file.size >= RECOMMENDED_ASSET_SIZE_BYTES) {
    return {
      level: "warning",
      message: `${label} «${file.name}» весит ${formatStorageBytes(file.size)}. Safari на iPad может сохранить такой файл нестабильно, особенно если локальное хранилище уже почти заполнено.`,
    };
  }

  return { level: "ok", message: null };
}

export function getFilesUploadPreflight(files: File[], label: string): StoragePreflightResult {
  for (const file of files) {
    const single = getAssetUploadPreflight(file, label);

    if (single.level === "blocked") {
      return single;
    }
  }

  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);

  if (totalBytes >= HARD_BATCH_SIZE_BYTES) {
    return {
      level: "blocked",
      message: `Вы выбрали ${files.length} файлов для ${label} на ${formatStorageBytes(totalBytes)} суммарно. Для локального хранения на iPad Safari это уже слишком тяжёлый набор.`,
    };
  }

  if (totalBytes >= RECOMMENDED_BATCH_SIZE_BYTES) {
    return {
      level: "warning",
      message: `Вы выбрали ${files.length} файлов для ${label} на ${formatStorageBytes(totalBytes)} суммарно. Такой импорт может идти заметно дольше и сильнее упираться в quota Safari.`,
    };
  }

  const hasLargeSingleFile = files.some((file) => file.size >= RECOMMENDED_ASSET_SIZE_BYTES);

  if (hasLargeSingleFile) {
    return {
      level: "warning",
      message: `Среди выбранных файлов для ${label} есть тяжёлые вложения. На iPad Safari их сохранение может быть нестабильнее обычного.`,
    };
  }

  return { level: "ok", message: null };
}

export function getBackupImportPreflight(fileSize: number, remainingBytes: number | null): StoragePreflightResult {
  if (remainingBytes !== null && remainingBytes < fileSize) {
    return {
      level: "blocked",
      message: `Backup весит ${formatStorageBytes(fileSize)}, а свободного места в локальном хранилище меньше. Такой импорт почти наверняка сорвётся на квоте Safari.`,
    };
  }

  if (fileSize >= HARD_BACKUP_SIZE_BYTES) {
    return {
      level: "blocked",
      message: `Backup весит ${formatStorageBytes(fileSize)}. Для локального JSON + Blob восстановления на iPad Safari это уже слишком рискованный объём. Лучше сначала уменьшить базу или импортировать более лёгкую копию.`,
    };
  }

  if (fileSize >= RECOMMENDED_BACKUP_SIZE_BYTES) {
    return {
      level: "warning",
      message: `Backup весит ${formatStorageBytes(fileSize)}. Импорт может идти заметно дольше обычного и сильнее упираться в quota Safari.`,
    };
  }

  return { level: "ok", message: null };
}

export function getBackupExportPreflight(estimatedBytes: number, remainingBytes: number | null): StoragePreflightResult {
  if (remainingBytes !== null && remainingBytes < estimatedBytes / 3) {
    return {
      level: "warning",
      message: `Примерный размер backup — ${formatStorageBytes(estimatedBytes)}. Свободного места в локальном хранилище уже немного, поэтому экспорт может пройти медленнее на тяжёлых вложениях.`,
    };
  }

  if (estimatedBytes >= HARD_BACKUP_SIZE_BYTES) {
    return {
      level: "warning",
      message: `Примерный размер backup — ${formatStorageBytes(estimatedBytes)}. Экспорт возможен, но на iPad Safari это уже тяжёлый сценарий из-за base64-представления вложений.`,
    };
  }

  if (estimatedBytes >= RECOMMENDED_BACKUP_SIZE_BYTES) {
    return {
      level: "warning",
      message: `Примерный размер backup — ${formatStorageBytes(estimatedBytes)}. Для крупных вложений экспорт может занять больше времени обычного.`,
    };
  }

  return { level: "ok", message: null };
}
