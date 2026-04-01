import { CSSProperties, useEffect, useMemo, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { getAppBackgroundPreset } from "@/shared/config/appBackgroundPresets";
import {
  getAppSettings,
  updateAppBackground,
  updateAppBackgroundBlur,
  updateAppBackgroundDim,
  uploadCustomAppBackground,
} from "@/shared/lib/db/appSettings";
import { getOfflineReadinessView, getStandaloneState, OfflineReadinessSnapshot } from "@/shared/lib/pwa/offlineReadiness";
import { useAssetObjectUrl } from "@/shared/lib/useAssetObjectUrl";
import { AppSettings } from "@/shared/types/models";
import { PwaStatusBadge } from "@/shared/ui/PwaStatusBadge";

export interface AppShellContextValue {
  settings: AppSettings;
  updateBackground: (backgroundId: AppSettings["backgroundId"]) => Promise<void>;
  uploadBackground: (file: File) => Promise<void>;
  updateBackgroundDim: (dimAmount: number) => Promise<void>;
  updateBackgroundBlur: (blurAmount: number) => Promise<void>;
}

interface ServiceWorkerRuntimeStatus {
  cacheVersion: string | null;
  checkedAt: string | null;
  hasOfflineShell: boolean | null;
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

function getOfflineCoachSnapshot(swRuntimeStatus: ServiceWorkerRuntimeStatus): OfflineReadinessSnapshot {
  return {
    isSecureContext: window.isSecureContext,
    hasServiceWorker: "serviceWorker" in navigator,
    isControlled: Boolean(navigator.serviceWorker?.controller),
    isStandalone: getStandaloneState(),
    hasOfflineShell: swRuntimeStatus.hasOfflineShell === true,
  };
}

export function AppShell() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [swRuntimeStatus, setSwRuntimeStatus] = useState<ServiceWorkerRuntimeStatus>({
    cacheVersion: null,
    checkedAt: null,
    hasOfflineShell: null,
  });
  const [isOfflineCoachDismissed, setIsOfflineCoachDismissed] = useState(false);
  const [isUpdateReloadDismissed, setIsUpdateReloadDismissed] = useState(false);
  const [hasPendingShellReload, setHasPendingShellReload] = useState(false);
  const customBackgroundUrl = useAssetObjectUrl(settings?.customBackgroundAssetId);
  const location = useLocation();
  const isEditorRoute = location.pathname.startsWith("/pages/");

  useEffect(() => {
    void getAppSettings().then(setSettings);
  }, []);

  useEffect(() => {
    const handleWorkerMessage = (event: MessageEvent) => {
      const payload = event.data as
        | {
            type?: string;
            cacheVersion?: string;
            checkedAt?: string;
            hasOfflineShell?: boolean;
          }
        | undefined;

      if (payload?.type !== "SW_STATUS") {
        return;
      }

      setSwRuntimeStatus({
        cacheVersion: payload.cacheVersion ?? null,
        checkedAt: payload.checkedAt ?? null,
        hasOfflineShell: payload.hasOfflineShell ?? null,
      });
    };

    navigator.serviceWorker?.addEventListener("message", handleWorkerMessage);
    navigator.serviceWorker?.controller?.postMessage({ type: "REQUEST_STATUS" });

    return () => {
      navigator.serviceWorker?.removeEventListener("message", handleWorkerMessage);
    };
  }, []);

  useEffect(() => {
    setIsOfflineCoachDismissed(false);
    setIsUpdateReloadDismissed(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!hasPendingShellReload || isUpdateReloadDismissed) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setIsUpdateReloadDismissed(true);
    }, 7000);

    return () => window.clearTimeout(timeoutId);
  }, [hasPendingShellReload, isUpdateReloadDismissed]);

  useEffect(() => {
    const handleUpdateAvailable = () => {
      setHasPendingShellReload(true);
      setIsUpdateReloadDismissed(false);
    };

    const handleControllerUpdated = () => {
      setHasPendingShellReload(true);
      setIsUpdateReloadDismissed(false);
    };

    window.addEventListener("mybestipadapp:pwa-update-available", handleUpdateAvailable);
    window.addEventListener("mybestipadapp:pwa-controller-updated", handleControllerUpdated);

    return () => {
      window.removeEventListener("mybestipadapp:pwa-update-available", handleUpdateAvailable);
      window.removeEventListener("mybestipadapp:pwa-controller-updated", handleControllerUpdated);
    };
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
  const offlineReadiness = useMemo(() => getOfflineReadinessView(getOfflineCoachSnapshot(swRuntimeStatus)), [swRuntimeStatus]);
  const showOfflineCoach = !offlineReadiness.isReady && !isOfflineCoachDismissed && !hasPendingShellReload;
  const showUpdateReloadBanner = hasPendingShellReload && !isUpdateReloadDismissed;

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
      <PwaStatusBadge />
      {showUpdateReloadBanner ? (
        <div className="offline-update-banner" role="status" aria-live="polite">
          <div className="offline-update-banner__copy">
            <strong>Новая офлайн-оболочка готова</strong>
            <p>
              Service Worker уже подхватил новую версию shell. Лучше перезагрузить приложение сейчас, чтобы экран и кэш
              работали в одном состоянии.
            </p>
          </div>
          <div className="offline-update-banner__actions">
            <button type="button" className="offline-update-banner__button" onClick={() => window.location.reload()}>
              Перезагрузить
            </button>
            <button
              type="button"
              className="offline-update-banner__button offline-update-banner__button--ghost"
              onClick={() => setIsUpdateReloadDismissed(true)}
            >
              Позже
            </button>
          </div>
        </div>
      ) : null}
      {showOfflineCoach ? (
        <div className="offline-coach" role="status" aria-live="polite">
          <div className="offline-coach__copy">
            <strong>{offlineReadiness.title}</strong>
            <p>{offlineReadiness.description}</p>
            <ul>
              {offlineReadiness.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
          </div>
          <button type="button" className="offline-coach__dismiss" onClick={() => setIsOfflineCoachDismissed(true)}>
            Понятно
          </button>
        </div>
      ) : null}
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
