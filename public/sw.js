const APP_SHELL_CACHE = "classify-shell-v1";
const RUNTIME_CACHE = "classify-runtime-v1";
const API_CACHE = "classify-api-v1";
const APP_SHELL_URLS = [
  "/offline",
  "/manifest.webmanifest",
  "/pwa/icon.svg",
  "/pwa/icon-maskable.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL_URLS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => ![APP_SHELL_CACHE, RUNTIME_CACHE, API_CACHE].includes(key))
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

async function networkFirst(request, cacheName, fallbackResponse) {
  const cache = await caches.open(cacheName);

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    return fallbackResponse;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") {
    return;
  }

  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      networkFirst(
        request,
        RUNTIME_CACHE,
        caches.match("/offline").then((response) => response || Response.error()),
      ),
    );
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    if (/(\/me\/|\/auth\/)/.test(url.pathname)) {
      return;
    }

    event.respondWith(
      networkFirst(
        request,
        API_CACHE,
        new Response(
          JSON.stringify({
            error: "offline",
            message: "This action needs a network connection.",
          }),
          {
            status: 503,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ),
    );
    return;
  }

  if (
    url.pathname === "/" ||
    url.pathname.startsWith("/search") ||
    url.pathname.startsWith("/compare") ||
    url.pathname.startsWith("/saved") ||
    url.pathname.startsWith("/schools/")
  ) {
    event.respondWith(
      networkFirst(
        request,
        RUNTIME_CACHE,
        caches.match(request).then((response) => response || caches.match("/offline")),
      ),
    );
  }
});
