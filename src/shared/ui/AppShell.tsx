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
import {
  EMPTY_SERVICE_WORKER_RUNTIME_STATUS,
  parseServiceWorkerRuntimeStatus,
  requestServiceWorkerRuntimeStatus,
  ServiceWorkerRuntimeStatus,
} from "@/shared/lib/pwa/runtimeStatus";
import {
  applyServiceWorkerUpdate,
  PWA_CONTROLLER_UPDATED_EVENT,
  PWA_UPDATE_AVAILABLE_EVENT,
  PwaControllerUpdatedReason,
} from "@/shared/lib/pwa/registerServiceWorker";
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
  const [swRuntimeStatus, setSwRuntimeStatus] = useState<ServiceWorkerRuntimeStatus>(EMPTY_SERVICE_WORKER_RUNTIME_STATUS);
  const [isOfflineCoachDismissed, setIsOfflineCoachDismissed] = useState(false);
  const [hasUpdateAvailable, setHasUpdateAvailable] = useState(false);
  const [hasPendingShellReload, setHasPendingShellReload] = useState(false);
  const [isApplyingUpdate, setIsApplyingUpdate] = useState(false);
  const customBackgroundUrl = useAssetObjectUrl(settings?.customBackgroundAssetId);
  const location = useLocation();
  const isEditorRoute = location.pathname.startsWith("/pages/");

  useEffect(() => {
    void getAppSettings().then(setSettings);
  }, []);

  useEffect(() => {
    const handleWorkerMessage = (event: MessageEvent) => {
      const nextStatus = parseServiceWorkerRuntimeStatus(event.data);

      if (!nextStatus) {
        return;
      }

      setSwRuntimeStatus(nextStatus);
    };

    navigator.serviceWorker?.addEventListener("message", handleWorkerMessage);
    void requestServiceWorkerRuntimeStatus();

    return () => {
      navigator.serviceWorker?.removeEventListener("message", handleWorkerMessage);
    };
  }, []);

  useEffect(() => {
    setIsOfflineCoachDismissed(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleUpdateAvailable = () => {
      setHasUpdateAvailable(true);
    };

    const handleControllerUpdated = (event: Event) => {
      const reason = (event as CustomEvent<{ reason?: PwaControllerUpdatedReason }>).detail?.reason;

      if (reason !== "update") {
        return;
      }

      setHasUpdateAvailable(false);
      setHasPendingShellReload(true);
      setIsApplyingUpdate(false);
      void requestServiceWorkerRuntimeStatus();
    };

    window.addEventListener(PWA_UPDATE_AVAILABLE_EVENT, handleUpdateAvailable);
    window.addEventListener(PWA_CONTROLLER_UPDATED_EVENT, handleControllerUpdated);

    return () => {
      window.removeEventListener(PWA_UPDATE_AVAILABLE_EVENT, handleUpdateAvailable);
      window.removeEventListener(PWA_CONTROLLER_UPDATED_EVENT, handleControllerUpdated);
    };
  }, []);

  async function handleApplyUpdate() {
    try {
      setIsApplyingUpdate(true);
      const updateApplied = await applyServiceWorkerUpdate();

      if (!updateApplied) {
        setIsApplyingUpdate(false);
        void requestServiceWorkerRuntimeStatus();
      }
    } catch {
      setIsApplyingUpdate(false);
    }
  }

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
      {hasUpdateAvailable ? (
        <div className="offline-update-banner" role="status" aria-live="polite">
          <div className="offline-update-banner__copy">
            <strong>Доступно обновление офлайн-оболочки</strong>
            <p>
              Новая версия Service Worker уже ожидает применения. Сначала примените обновление, затем перезагрузите
              приложение, чтобы экран и кэш работали по одному контракту.
            </p>
          </div>
          <div className="offline-update-banner__actions">
            <button type="button" className="offline-update-banner__button" onClick={() => void handleApplyUpdate()}>
              {isApplyingUpdate ? "Применяем..." : "Применить обновление"}
            </button>
          </div>
        </div>
      ) : null}
      {hasPendingShellReload ? (
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
