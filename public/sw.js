const STATIC_CACHE = "mybestipadapp-static-v7";
const RUNTIME_CACHE = "mybestipadapp-runtime-v7";
const CACHE_VERSION = "v7";
const SCOPE_URL = new URL(self.registration.scope);
const SCOPE_PATH = SCOPE_URL.pathname.endsWith("/") ? SCOPE_URL.pathname : `${SCOPE_URL.pathname}/`;
const INDEX_HTML_URL = new URL("./index.html", SCOPE_URL).toString();
const SHELL_URL = new URL("./", SCOPE_URL).toString();
const MANIFEST_URL = new URL("./manifest.webmanifest", SCOPE_URL).toString();
const ICON_URL = new URL("./icons/app-icon.svg", SCOPE_URL).toString();
const OFFLINE_HTML_URL = new URL("./offline.html", SCOPE_URL).toString();
const READY_MARKER_URL = new URL("./__sw_ready__", SCOPE_URL).toString();
const STATIC_URL_PATTERNS = [/^assets\//, /^icons\//, /^manifest\.webmanifest$/, /^offline\.html$/, /^index\.html$/];
const INITIAL_URLS = [SHELL_URL, INDEX_HTML_URL, MANIFEST_URL, ICON_URL, OFFLINE_HTML_URL];

function isCacheableResponse(response) {
  return Boolean(response) && (response.ok || response.type === "opaque");
}

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isWithinScope(url) {
  return isSameOrigin(url) && url.pathname.startsWith(SCOPE_PATH);
}

function toRelativeScopePath(url) {
  if (!isWithinScope(url)) {
    return "";
  }

  return url.pathname.slice(SCOPE_PATH.length).replace(/^\/+/, "");
}

function isStaticAsset(url) {
  const relativePath = toRelativeScopePath(url);
  return STATIC_URL_PATTERNS.some((pattern) => pattern.test(relativePath));
}

function normalizeUrl(value) {
  try {
    const url = new URL(value, SCOPE_URL);
    return isSameOrigin(url) ? url.toString() : null;
  } catch {
    return null;
  }
}

function uniqueUrls(values) {
  return [...new Set(values.map(normalizeUrl).filter((value) => Boolean(value)))];
}

function extractAssetUrlsFromHtml(html) {
  const matches = Array.from(html.matchAll(/(?:src|href)="([^"]+)"/g)).map((match) => match[1]);
  return uniqueUrls(matches);
}

async function cacheResponse(cache, request, response) {
  if (!isCacheableResponse(response)) {
    return;
  }

  await cache.put(request, response.clone());
}

async function warmStaticCache(seedUrls = []) {
  const cache = await caches.open(STATIC_CACHE);
  const urls = uniqueUrls([...INITIAL_URLS, ...seedUrls]);

  try {
    const indexResponse = await fetch(INDEX_HTML_URL, { cache: "no-cache" });

    if (isCacheableResponse(indexResponse)) {
      await cacheResponse(cache, INDEX_HTML_URL, indexResponse.clone());
      await cacheResponse(cache, SHELL_URL, indexResponse.clone());

      const html = await indexResponse.text();
      urls.push(...extractAssetUrlsFromHtml(html));
    }
  } catch {
    // ignore and continue with the best available warm-up set
  }

  await Promise.all(
    uniqueUrls(urls).map(async (url) => {
      try {
        const response = await fetch(url, { cache: "no-cache" });
        await cacheResponse(cache, url, response);
      } catch {
        // ignore failed warm-up fetches
      }
    }),
  );

  await cache.put(
    READY_MARKER_URL,
    new Response(
      JSON.stringify({
        cacheVersion: CACHE_VERSION,
        checkedAt: new Date().toISOString(),
        shellUrls: uniqueUrls(urls),
      }),
      {
        headers: {
          "content-type": "application/json",
        },
      },
    ),
  );
}

async function getRuntimeStatusPayload() {
  const cache = await caches.open(STATIC_CACHE);
  const [shellResponse, indexResponse, offlineResponse] = await Promise.all([
    cache.match(SHELL_URL, { ignoreSearch: true }),
    cache.match(INDEX_HTML_URL, { ignoreSearch: true }),
    cache.match(OFFLINE_HTML_URL, { ignoreSearch: true }),
  ]);
  const readyMarkerResponse = await cache.match(READY_MARKER_URL, { ignoreSearch: true });
  let checkedAt = null;

  if (readyMarkerResponse) {
    try {
      const markerPayload = await readyMarkerResponse.clone().json();
      checkedAt = typeof markerPayload?.checkedAt === "string" ? markerPayload.checkedAt : null;
    } catch {
      checkedAt = null;
    }
  }

  return {
    type: "SW_STATUS",
    cacheVersion: CACHE_VERSION,
    hasOfflineShell: Boolean(readyMarkerResponse) && Boolean(shellResponse || indexResponse || offlineResponse),
    checkedAt,
  };
}

async function notifyClientsStatus() {
  const payload = await getRuntimeStatusPayload();
  const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  await Promise.all(
    clients.map(async (client) => {
      client.postMessage(payload);
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
      await warmStaticCache();
      await notifyClientsStatus();
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
      await notifyClientsStatus();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }

  if (event.data?.type === "WARM_APP_SHELL" || event.data?.type === "WARM_URLS") {
    const urls = Array.isArray(event.data?.urls) ? event.data.urls : [];
    event.waitUntil(
      (async () => {
        await warmStaticCache(urls);
        await notifyClientsStatus();
      })(),
    );
    return;
  }

  if (event.data?.type === "REQUEST_STATUS") {
    event.waitUntil(
      (async () => {
        const payload = await getRuntimeStatusPayload();
        event.source?.postMessage(payload);
      })(),
    );
  }
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(event.request.url);

  if (!isSameOrigin(requestUrl)) {
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC_CACHE);

        try {
          const networkResponse = await fetch(event.request);

          if (isCacheableResponse(networkResponse)) {
            await cache.put(event.request, networkResponse.clone());
            await cache.put(INDEX_HTML_URL, networkResponse.clone());
            await cache.put(SHELL_URL, networkResponse.clone());
          }

          return networkResponse;
        } catch {
          return (
            (await cache.match(event.request, { ignoreSearch: true })) ||
            (await cache.match(SHELL_URL, { ignoreSearch: true })) ||
            (await cache.match(INDEX_HTML_URL, { ignoreSearch: true })) ||
            (await cache.match(OFFLINE_HTML_URL, { ignoreSearch: true })) ||
            offlineErrorResponse()
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
        const cachedResponse = await cache.match(event.request, { ignoreSearch: true });

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
      const cachedResponse = await cache.match(event.request, { ignoreSearch: true });

      if (cachedResponse) {
        void revalidateIntoCache(event.request, RUNTIME_CACHE);
        return cachedResponse;
      }

      const networkResponse = await revalidateIntoCache(event.request, RUNTIME_CACHE);
      return networkResponse || cachedResponse || offlineErrorResponse();
    })(),
  );
});
