import { useEffect, useState } from "react";

interface PwaStatusSnapshot {
  isOnline: boolean;
  isStandalone: boolean;
  isSecureContext: boolean;
  hasServiceWorker: boolean;
  isControlled: boolean;
  hasOfflineShell: boolean;
  storageQuotaBytes: number | null;
  storageUsageBytes: number | null;
  isPersistentStorage: boolean | null;
}

const STATIC_CACHE = "mybestipadapp-static-v7";

function getStandaloneState() {
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    navigatorWithStandalone.standalone === true
  );
}

async function probeOfflineShell() {
  if (!window.isSecureContext || !("caches" in window)) {
    return false;
  }

  try {
    const baseUrl = new URL(import.meta.env.BASE_URL, window.location.origin);
    const scopeUrl = new URL("./", baseUrl).toString();
    const indexUrl = new URL("./index.html", baseUrl).toString();
    const offlineUrl = new URL("./offline.html", baseUrl).toString();
    const cache = await caches.open(STATIC_CACHE);

    const [shellResponse, indexResponse, offlineResponse] = await Promise.all([
      cache.match(scopeUrl, { ignoreSearch: true }),
      cache.match(indexUrl, { ignoreSearch: true }),
      cache.match(offlineUrl, { ignoreSearch: true }),
    ]);

    return Boolean(shellResponse || indexResponse || offlineResponse);
  } catch {
    return false;
  }
}

function getStatusTone(snapshot: PwaStatusSnapshot) {
  if (snapshot.hasServiceWorker && snapshot.isControlled && snapshot.hasOfflineShell) {
    return "ready";
  }

  if (snapshot.hasServiceWorker) {
    return "partial";
  }

  return "missing";
}

function formatStorageBytes(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return "Недоступно";
  }

  if (value < 1024 * 1024) {
    return `${Math.round(value / 1024)} КБ`;
  }

  if (value < 1024 * 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)} МБ`;
  }

  return `${(value / (1024 * 1024 * 1024)).toFixed(2)} ГБ`;
}

function getStorageUsagePercent(snapshot: PwaStatusSnapshot) {
  if (!snapshot.storageQuotaBytes || !snapshot.storageUsageBytes) {
    return null;
  }

  return Math.min(100, Math.round((snapshot.storageUsageBytes / snapshot.storageQuotaBytes) * 100));
}

function getStorageUsageTone(percent: number | null) {
  if (percent === null) {
    return "neutral";
  }

  if (percent >= 85) {
    return "danger";
  }

  if (percent >= 65) {
    return "warning";
  }

  return "safe";
}

function getStorageRecoverySteps(tone: "neutral" | "safe" | "warning" | "danger") {
  if (tone === "danger") {
    return [
      "Сначала вручную сохраните текущую страницу.",
      "Удалите ненужные блокноты или тяжёлые вложения с изображениями.",
      "Не добавляйте новые крупные файлы, пока запас по памяти не освободится.",
    ];
  }

  if (tone === "warning") {
    return [
      "Проверьте, нет ли лишних изображений и файлов в текущих блокнотах.",
      "Перед длинной офлайн-сессией лучше вручную сохранить страницу.",
      "С крупными вложениями стоит работать осторожнее, особенно на iPad Safari.",
    ];
  }

  return [];
}

export function PwaStatusBadge() {
  const [isOpen, setIsOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<PwaStatusSnapshot>({
    isOnline: navigator.onLine,
    isStandalone: getStandaloneState(),
    isSecureContext: window.isSecureContext,
    hasServiceWorker: "serviceWorker" in navigator,
    isControlled: Boolean(navigator.serviceWorker?.controller),
    hasOfflineShell: false,
    storageQuotaBytes: null,
    storageUsageBytes: null,
    isPersistentStorage: null,
  });

  useEffect(() => {
    let isMounted = true;

    const refresh = async () => {
      let storageQuotaBytes: number | null = null;
      let storageUsageBytes: number | null = null;
      let isPersistentStorage: boolean | null = null;

      if ("storage" in navigator && typeof navigator.storage?.estimate === "function") {
        try {
          const estimate = await navigator.storage.estimate();
          storageQuotaBytes = estimate.quota ?? null;
          storageUsageBytes = estimate.usage ?? null;
        } catch {
          storageQuotaBytes = null;
          storageUsageBytes = null;
        }
      }

      if ("storage" in navigator && typeof navigator.storage?.persisted === "function") {
        try {
          isPersistentStorage = await navigator.storage.persisted();
        } catch {
          isPersistentStorage = null;
        }
      }

      const nextSnapshot: PwaStatusSnapshot = {
        isOnline: navigator.onLine,
        isStandalone: getStandaloneState(),
        isSecureContext: window.isSecureContext,
        hasServiceWorker: "serviceWorker" in navigator,
        isControlled: Boolean(navigator.serviceWorker?.controller),
        hasOfflineShell: await probeOfflineShell(),
        storageQuotaBytes,
        storageUsageBytes,
        isPersistentStorage,
      };

      if (isMounted) {
        setSnapshot(nextSnapshot);
      }
    };

    void refresh();

    const mediaQuery = window.matchMedia("(display-mode: standalone)") as MediaQueryList & {
      addListener?: (listener: (event: MediaQueryListEvent) => void) => void;
      removeListener?: (listener: (event: MediaQueryListEvent) => void) => void;
    };
    const handleVisibility = () => {
      void refresh();
    };
    const handleConnectivity = () => {
      void refresh();
    };
    const handleControllerChange = () => {
      void refresh();
    };

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleVisibility);
    } else if (typeof mediaQuery.addListener === "function") {
      mediaQuery.addListener(handleVisibility);
    }

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("online", handleConnectivity);
    window.addEventListener("offline", handleConnectivity);
    navigator.serviceWorker?.addEventListener("controllerchange", handleControllerChange);

    return () => {
      isMounted = false;
      if (typeof mediaQuery.removeEventListener === "function") {
        mediaQuery.removeEventListener("change", handleVisibility);
      } else if (typeof mediaQuery.removeListener === "function") {
        mediaQuery.removeListener(handleVisibility);
      }

      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("online", handleConnectivity);
      window.removeEventListener("offline", handleConnectivity);
      navigator.serviceWorker?.removeEventListener("controllerchange", handleControllerChange);
    };
  }, []);

  const tone = getStatusTone(snapshot);
  const storageUsagePercent = getStorageUsagePercent(snapshot);
  const storageTone = getStorageUsageTone(storageUsagePercent);
  const storageRecoverySteps = getStorageRecoverySteps(storageTone);

  return (
    <div className="pwa-status">
      <button
        type="button"
        className={`pwa-status__trigger pwa-status__trigger--${tone}`}
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
      >
        <span className="pwa-status__dot" aria-hidden="true" />
        {snapshot.hasServiceWorker && snapshot.isControlled && snapshot.hasOfflineShell
          ? "Офлайн готов"
          : "PWA статус"}
      </button>

      {isOpen ? (
        <div className="pwa-status__panel">
          <div className="pwa-status__row">
            <span>Режим</span>
            <strong>{snapshot.isStandalone ? "Иконка iPad" : "Safari"}</strong>
          </div>
          <div className="pwa-status__row">
            <span>Сеть</span>
            <strong>{snapshot.isOnline ? "Есть" : "Нет"}</strong>
          </div>
          <div className="pwa-status__row">
            <span>Service Worker</span>
            <strong>{snapshot.hasServiceWorker ? "Доступен" : "Нет"}</strong>
          </div>
          <div className="pwa-status__row">
            <span>HTTPS-контекст</span>
            <strong>{snapshot.isSecureContext ? "Да" : "Нет"}</strong>
          </div>
          <div className="pwa-status__row">
            <span>Контроль окна</span>
            <strong>{snapshot.isControlled ? "Активен" : "Не активен"}</strong>
          </div>
          <div className="pwa-status__row">
            <span>Офлайн-оболочка</span>
            <strong>{snapshot.hasOfflineShell ? "В кэше" : "Не прогрета"}</strong>
          </div>
          <div className="pwa-status__row">
            <span>Занято в хранилище</span>
            <strong>{formatStorageBytes(snapshot.storageUsageBytes)}</strong>
          </div>
          <div className="pwa-status__row">
            <span>Лимит хранилища</span>
            <strong>{formatStorageBytes(snapshot.storageQuotaBytes)}</strong>
          </div>
          <div className="pwa-status__row">
            <span>Persistent storage</span>
            <strong>
              {snapshot.isPersistentStorage === null ? "Недоступно" : snapshot.isPersistentStorage ? "Да" : "Нет"}
            </strong>
          </div>
          <div className={`pwa-status__storage-note pwa-status__storage-note--${storageTone}`}>
            {storageUsagePercent === null
              ? "Safari не всегда отдаёт точную quota-оценку, но панель показывает доступные сигналы локального хранилища."
              : storageUsagePercent >= 85
                ? `Локальное хранилище заполнено примерно на ${storageUsagePercent}%. Для iPad Safari это уже зона риска для крупных вложений.`
                : storageUsagePercent >= 65
                  ? `Локальное хранилище занято примерно на ${storageUsagePercent}%. С крупными изображениями и файлами лучше работать осторожнее.`
                  : `Локальное хранилище занято примерно на ${storageUsagePercent}%. Запас по quota пока выглядит нормально.`}
          </div>
          {storageRecoverySteps.length ? (
            <div className="pwa-status__actions">
              <div className="pwa-status__actions-title">Что делать сейчас</div>
              <ul className="pwa-status__actions-list">
                {storageRecoverySteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
