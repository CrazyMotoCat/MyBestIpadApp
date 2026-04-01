import { defaultAppBackgroundId } from "@/shared/config/appBackgroundPresets";
import { deleteAssetById, saveFileAsset } from "@/shared/lib/db/assets";
import { getDatabase } from "@/shared/lib/db/database";
import { recordStorageWriteFailure, recordStorageWriteSuccess } from "@/shared/lib/db/storageHealth";
import { AppSettings } from "@/shared/types/models";

const APP_SETTINGS_KEY: AppSettings["id"] = "app-settings";

interface LegacyAppSettings extends Partial<AppSettings> {
  overlayOpacity?: number | null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeAppSettings(record?: LegacyAppSettings | null): AppSettings {
  return {
    id: APP_SETTINGS_KEY,
    backgroundMode: record?.backgroundMode ?? "preset",
    backgroundId: record?.backgroundId ?? defaultAppBackgroundId,
    customBackgroundAssetId: record?.customBackgroundAssetId ?? null,
    backgroundDimAmount: clamp(record?.backgroundDimAmount ?? record?.overlayOpacity ?? 0.62, 0.2, 0.92),
    backgroundBlurAmount: clamp(record?.backgroundBlurAmount ?? 0, 0, 24),
    updatedAt: record?.updatedAt ?? new Date().toISOString(),
  };
}

export async function getAppSettings() {
  const db = await getDatabase();
  const record = await db.get("appSettings", APP_SETTINGS_KEY);

  if (!record) {
    const defaults = normalizeAppSettings();

    try {
      await db.put("appSettings", defaults);
      recordStorageWriteSuccess("init app settings", "Сохранены настройки приложения по умолчанию.");
    } catch (error) {
      recordStorageWriteFailure("init app settings", error, "Не удалось сохранить настройки приложения.");
      throw error;
    }

    return defaults;
  }

  return normalizeAppSettings(record as LegacyAppSettings);
}

export async function updateAppBackground(backgroundId: AppSettings["backgroundId"]) {
  const db = await getDatabase();
  const current = await getAppSettings();
  const previousCustomBackgroundAssetId = current.customBackgroundAssetId;
  const nextSettings = normalizeAppSettings({
    ...current,
    backgroundMode: "preset",
    backgroundId,
    customBackgroundAssetId: null,
    updatedAt: new Date().toISOString(),
  });

  try {
    await db.put("appSettings", nextSettings);

    if (previousCustomBackgroundAssetId) {
      await deleteAssetById(previousCustomBackgroundAssetId);
    }

    recordStorageWriteSuccess("update app background", "Фон приложения обновлён.");
    return nextSettings;
  } catch (error) {
    recordStorageWriteFailure("update app background", error, "Не удалось обновить фон приложения.");
    throw error;
  }
}

export async function uploadCustomAppBackground(file: File) {
  const db = await getDatabase();
  const current = await getAppSettings();
  const asset = await saveFileAsset(APP_SETTINGS_KEY, file, "background");
  const previousCustomBackgroundAssetId = current.customBackgroundAssetId;

  const nextSettings = normalizeAppSettings({
    ...current,
    backgroundMode: "custom",
    customBackgroundAssetId: asset.id,
    updatedAt: new Date().toISOString(),
  });

  try {
    await db.put("appSettings", nextSettings);

    if (previousCustomBackgroundAssetId && previousCustomBackgroundAssetId !== asset.id) {
      await deleteAssetById(previousCustomBackgroundAssetId);
    }

    recordStorageWriteSuccess("upload app background", `Пользовательский фон ${file.name} сохранён.`);
    return nextSettings;
  } catch (error) {
    recordStorageWriteFailure("upload app background", error, "Не удалось сохранить пользовательский фон.");
    throw error;
  }
}

export async function updateAppBackgroundDim(dimAmount: number) {
  const db = await getDatabase();
  const current = await getAppSettings();
  const nextSettings = normalizeAppSettings({
    ...current,
    backgroundDimAmount: dimAmount,
    updatedAt: new Date().toISOString(),
  });

  try {
    await db.put("appSettings", nextSettings);
    recordStorageWriteSuccess("update app background dim", "Затемнение фона обновлено.");
    return nextSettings;
  } catch (error) {
    recordStorageWriteFailure("update app background dim", error, "Не удалось обновить затемнение фона.");
    throw error;
  }
}

export async function updateAppBackgroundBlur(blurAmount: number) {
  const db = await getDatabase();
  const current = await getAppSettings();
  const nextSettings = normalizeAppSettings({
    ...current,
    backgroundBlurAmount: blurAmount,
    updatedAt: new Date().toISOString(),
  });

  try {
    await db.put("appSettings", nextSettings);
    recordStorageWriteSuccess("update app background blur", "Размытие фона обновлено.");
    return nextSettings;
  } catch (error) {
    recordStorageWriteFailure("update app background blur", error, "Не удалось обновить размытие фона.");
    throw error;
  }
}
