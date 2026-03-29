const STATIC_CACHE = "mybestipadapp-static-v4";
const RUNTIME_CACHE = "mybestipadapp-runtime-v4";
const OFFLINE_HTML = "/offline.html";
const SHELL_URL = "/";
const STATIC_URL_PATTERNS = [/^\/assets\//, /^\/icons\//, /^\/manifest\.webmanifest$/];
const INITIAL_URLS = [SHELL_URL, "/index.html", "/manifest.webmanifest", "/icons/app-icon.svg", OFFLINE_HTML];

function isCacheableResponse(response) {
  return Boolean(response) && (response.ok || response.type === "opaque");
}

function isStaticAsset(url) {
  return STATIC_URL_PATTERNS.some((pattern) => pattern.test(url.pathname));
}

async function cacheIndexAndAssets(cache) {
  const indexResponse = await fetch("/index.html", { cache: "no-cache" });

  if (!isCacheableResponse(indexResponse)) {
    return;
  }

  await cache.put("/index.html", indexResponse.clone());
  await cache.put("/", indexResponse.clone());

  const html = await indexResponse.text();
  const assetMatches = Array.from(html.matchAll(/(?:src|href)="([^"]+)"/g))
    .map((match) => match[1])
    .filter((value) => Boolean(value))
    .map((value) => new URL(value, self.location.origin))
    .filter((url) => url.origin === self.location.origin)
    .map((url) => url.pathname);

  const uniqueUrls = [...new Set([...INITIAL_URLS, ...assetMatches])];

  await Promise.all(
    uniqueUrls.map(async (url) => {
      try {
        const response = await fetch(url, { cache: "no-cache" });

        if (isCacheableResponse(response)) {
          await cache.put(url, response);
        }
      } catch {
        // ignore failed warm-up fetches
      }
    }),
  );
}

async function revalidateIntoCache(request, cacheName) {
  try {
    const response = await fetch(request);

    if (isCacheableResponse(response)) {
      const cache = await caches.open(cacheName);
      await cache.put(request, response.clone());
    }

    return response;
  } catch {
    return null;
  }
}

function offlineErrorResponse() {
  return new Response("", {
    status: 503,
    statusText: "Offline",
  });
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);

      try {
        await cacheIndexAndAssets(cache);
      } catch {
        await cache.addAll(INITIAL_URLS);
      }

      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();

      await Promise.all(
        keys
          .filter((key) => ![STATIC_CACHE, RUNTIME_CACHE].includes(key))
          .map((key) => caches.delete(key)),
      );

      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }

  if (event.data?.type === "WARM_APP_SHELL") {
    event.waitUntil?.(caches.open(STATIC_CACHE).then((cache) => cacheIndexAndAssets(cache)));
  }
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(event.request.url);

  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(event.request);

          if (isCacheableResponse(networkResponse)) {
            const cache = await caches.open(STATIC_CACHE);
            await cache.put("/index.html", networkResponse.clone());
            await cache.put("/", networkResponse.clone());
          }

          return networkResponse;
        } catch {
          const cache = await caches.open(STATIC_CACHE);

          return (
            (await cache.match("/index.html")) ||
            (await cache.match("/")) ||
            (await cache.match(OFFLINE_HTML))
          );
        }
      })(),
    );

    return;
  }

  if (isStaticAsset(requestUrl)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC_CACHE);
        const cachedResponse = await cache.match(event.request);

        if (cachedResponse) {
          void revalidateIntoCache(event.request, STATIC_CACHE);
          return cachedResponse;
        }

        const networkResponse = await revalidateIntoCache(event.request, STATIC_CACHE);
        return networkResponse || offlineErrorResponse();
      })(),
    );

    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(RUNTIME_CACHE);
      const cachedResponse = await cache.match(event.request);

      if (cachedResponse) {
        void revalidateIntoCache(event.request, RUNTIME_CACHE);
        return cachedResponse;
      }

      const networkResponse = await revalidateIntoCache(event.request, RUNTIME_CACHE);
      return networkResponse || cachedResponse || offlineErrorResponse();
    })(),
  );
});
