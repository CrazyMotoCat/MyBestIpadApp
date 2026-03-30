export function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || !window.isSecureContext) {
    return;
  }

  const STATIC_CACHE = "mybestipadapp-static-v7";
  const baseUrl = new URL(import.meta.env.BASE_URL, window.location.origin);
  const serviceWorkerUrl = new URL("sw.js", baseUrl).toString();

  const collectWarmUrls = () => {
    const urls = new Set<string>([
      window.location.href,
      new URL("./", baseUrl).toString(),
      new URL("./index.html", baseUrl).toString(),
      new URL("./manifest.webmanifest", baseUrl).toString(),
      new URL("./offline.html", baseUrl).toString(),
    ]);

    const addUrl = (value?: string | null) => {
      if (!value) {
        return;
      }

      try {
        const url = new URL(value, window.location.href);

        if (url.origin === window.location.origin) {
          urls.add(url.toString());
        }
      } catch {
        // ignore malformed URLs
      }
    };

    document.querySelectorAll("script[src], link[href], img[src]").forEach((node) => {
      if (node instanceof HTMLScriptElement) {
        addUrl(node.src);
        return;
      }

      if (node instanceof HTMLLinkElement) {
        addUrl(node.href);
        return;
      }

      if (node instanceof HTMLImageElement) {
        addUrl(node.src);
      }
    });

    try {
      performance.getEntriesByType("resource").forEach((entry) => {
        addUrl(entry.name);
      });
    } catch {
      // ignore unsupported performance entries
    }

    return [...urls];
  };

  const register = () => {
    navigator.serviceWorker
      .register(serviceWorkerUrl, { scope: baseUrl.pathname })
      .then((registration) => {
        const primeWindowCache = async () => {
          if (!("caches" in window)) {
            return;
          }

          const cache = await caches.open(STATIC_CACHE);

          await Promise.all(
            collectWarmUrls().map(async (url) => {
              try {
                const response = await fetch(url, { cache: "no-cache", credentials: "same-origin" });

                if (response.ok || response.type === "opaque") {
                  await cache.put(url, response.clone());
                }
              } catch {
                // ignore failed warm-up fetches
              }
            }),
          );
        };

        const warmAppShell = () => {
          const payload = {
            type: "WARM_APP_SHELL",
            urls: collectWarmUrls(),
          };

          void primeWindowCache();
          registration.active?.postMessage(payload);
          registration.waiting?.postMessage(payload);
        };

        registration.addEventListener("updatefound", () => {
          const installingWorker = registration.installing;

          if (!installingWorker) {
            return;
          }

          installingWorker.addEventListener("statechange", () => {
            if (installingWorker.state === "installed" && registration.waiting) {
              registration.waiting.postMessage({ type: "SKIP_WAITING" });
            }
          });
        });

        if (registration.waiting) {
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
        }

        void navigator.serviceWorker.ready.then((readyRegistration) => {
          void primeWindowCache();
          readyRegistration.active?.postMessage({
            type: "WARM_APP_SHELL",
            urls: collectWarmUrls(),
          });
        });

        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") {
            void registration.update();
            warmAppShell();
          }
        });

        window.addEventListener("online", () => {
          void registration.update();
          warmAppShell();
        });
      })
      .catch((error) => {
        console.error("Service worker registration failed", error);
      });
  };

  if (document.readyState === "complete") {
    register();
    return;
  }

  window.addEventListener("load", register, { once: true });
}
