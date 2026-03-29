import { defaultAppBackgroundId } from "@/shared/config/appBackgroundPresets";
import { saveFileAsset } from "@/shared/lib/db/assets";
import { getDatabase } from "@/shared/lib/db/database";
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
    await db.put("appSettings", defaults);
    return defaults;
  }

  return normalizeAppSettings(record as LegacyAppSettings);
}

export async function updateAppBackground(backgroundId: AppSettings["backgroundId"]) {
  const db = await getDatabase();
  const current = await getAppSettings();
  const nextSettings = normalizeAppSettings({
    ...current,
    backgroundMode: "preset",
    backgroundId,
    updatedAt: new Date().toISOString(),
  });

  await db.put("appSettings", nextSettings);
  return nextSettings;
}

export async function uploadCustomAppBackground(file: File) {
  const db = await getDatabase();
  const current = await getAppSettings();
  const asset = await saveFileAsset(APP_SETTINGS_KEY, file, "background");

  const nextSettings = normalizeAppSettings({
    ...current,
    backgroundMode: "custom",
    customBackgroundAssetId: asset.id,
    updatedAt: new Date().toISOString(),
  });

  await db.put("appSettings", nextSettings);
  return nextSettings;
}

export async function updateAppBackgroundDim(dimAmount: number) {
  const db = await getDatabase();
  const current = await getAppSettings();
  const nextSettings = normalizeAppSettings({
    ...current,
    backgroundDimAmount: dimAmount,
    updatedAt: new Date().toISOString(),
  });

  await db.put("appSettings", nextSettings);
  return nextSettings;
}

export async function updateAppBackgroundBlur(blurAmount: number) {
  const db = await getDatabase();
  const current = await getAppSettings();
  const nextSettings = normalizeAppSettings({
    ...current,
    backgroundBlurAmount: blurAmount,
    updatedAt: new Date().toISOString(),
  });

  await db.put("appSettings", nextSettings);
  return nextSettings;
}
