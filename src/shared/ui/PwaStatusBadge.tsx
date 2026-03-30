import { useEffect, useState } from "react";

interface PwaStatusSnapshot {
  isOnline: boolean;
  isStandalone: boolean;
  isSecureContext: boolean;
  hasServiceWorker: boolean;
  isControlled: boolean;
  hasOfflineShell: boolean;
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

export function PwaStatusBadge() {
  const [isOpen, setIsOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<PwaStatusSnapshot>({
    isOnline: navigator.onLine,
    isStandalone: getStandaloneState(),
    isSecureContext: window.isSecureContext,
    hasServiceWorker: "serviceWorker" in navigator,
    isControlled: Boolean(navigator.serviceWorker?.controller),
    hasOfflineShell: false,
  });

  useEffect(() => {
    let isMounted = true;

    const refresh = async () => {
      const nextSnapshot: PwaStatusSnapshot = {
        isOnline: navigator.onLine,
        isStandalone: getStandaloneState(),
        isSecureContext: window.isSecureContext,
        hasServiceWorker: "serviceWorker" in navigator,
        isControlled: Boolean(navigator.serviceWorker?.controller),
        hasOfflineShell: await probeOfflineShell(),
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
        </div>
      ) : null}
    </div>
  );
}
