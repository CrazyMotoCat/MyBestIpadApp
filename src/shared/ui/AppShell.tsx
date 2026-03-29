import { CSSProperties, useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { getAppBackgroundPreset } from "@/shared/config/appBackgroundPresets";
import {
  getAppSettings,
  updateAppBackground,
  updateAppBackgroundBlur,
  updateAppBackgroundDim,
  uploadCustomAppBackground,
} from "@/shared/lib/db/appSettings";
import { useAssetObjectUrl } from "@/shared/lib/useAssetObjectUrl";
import { AppSettings } from "@/shared/types/models";

export interface AppShellContextValue {
  settings: AppSettings;
  updateBackground: (backgroundId: AppSettings["backgroundId"]) => Promise<void>;
  uploadBackground: (file: File) => Promise<void>;
  updateBackgroundDim: (dimAmount: number) => Promise<void>;
  updateBackgroundBlur: (blurAmount: number) => Promise<void>;
}

function buildShellStyle(settings: AppSettings, customBackgroundUrl: string | null): CSSProperties {
  const preset = getAppBackgroundPreset(settings.backgroundId);
  const dimOverlay = `linear-gradient(180deg, rgba(6,8,14,${settings.backgroundDimAmount}), rgba(6,8,14,${Math.min(
    0.96,
    settings.backgroundDimAmount + 0.14,
  )}))`;
  const sceneBackground =
    settings.backgroundMode === "custom" && customBackgroundUrl
      ? `url("${customBackgroundUrl}") center / cover no-repeat`
      : `${preset.overlay}, ${preset.shellBackground}`;

  return {
    "--app-shell-backdrop-image": `${dimOverlay}, ${sceneBackground}`,
    "--app-shell-backdrop-blur": `${settings.backgroundBlurAmount}px`,
    "--app-shell-glow": preset.shellGlow,
    "--app-card-tint": preset.cardTint,
  } as CSSProperties;
}

export function AppShell() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const customBackgroundUrl = useAssetObjectUrl(settings?.customBackgroundAssetId);
  const location = useLocation();
  const isEditorRoute = location.pathname.startsWith("/pages/");

  useEffect(() => {
    void getAppSettings().then(setSettings);
  }, []);

  async function handleUpdateBackground(backgroundId: AppSettings["backgroundId"]) {
    const nextSettings = await updateAppBackground(backgroundId);
    setSettings(nextSettings);
  }

  async function handleUploadBackground(file: File) {
    const nextSettings = await uploadCustomAppBackground(file);
    setSettings(nextSettings);
  }

  async function handleUpdateBackgroundDim(dimAmount: number) {
    const nextSettings = await updateAppBackgroundDim(dimAmount);
    setSettings(nextSettings);
  }

  async function handleUpdateBackgroundBlur(blurAmount: number) {
    const nextSettings = await updateAppBackgroundBlur(blurAmount);
    setSettings(nextSettings);
  }

  const shellClassName = `app-shell ${isEditorRoute ? "app-shell--editor" : ""}`.trim();
  const shellInnerClassName = `app-shell__inner ${isEditorRoute ? "app-shell__inner--editor" : ""}`.trim();

  if (!settings) {
    return (
      <div className={shellClassName}>
        <div className="app-shell__ambient" />
        <div className={shellInnerClassName}>
          <div className="screen-loader">Подготавливаем офлайн-среду...</div>
        </div>
      </div>
    );
  }

  return (
    <div className={shellClassName} style={buildShellStyle(settings, customBackgroundUrl)}>
      <div className="app-shell__backdrop" />
      <div className="app-shell__ambient" />
      <div className="app-shell__grid" />
      <div className={shellInnerClassName}>
        <Outlet
          context={{
            settings,
            updateBackground: handleUpdateBackground,
            uploadBackground: handleUploadBackground,
            updateBackgroundDim: handleUpdateBackgroundDim,
            updateBackgroundBlur: handleUpdateBackgroundBlur,
          } satisfies AppShellContextValue}
        />
      </div>
    </div>
  );
}
