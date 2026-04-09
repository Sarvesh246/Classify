const APP_SHELL_CACHE = "classify-shell-v3";
const RUNTIME_CACHE = "classify-runtime-v3";
const API_CACHE = "classify-api-v3";
const APP_SHELL_URLS = [
  "/",
  "/search",
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

async function networkFirst(request, cacheName, fallbackResponse, timeoutMs = 9000) {
  const cache = await caches.open(cacheName);

  try {
    const response = await Promise.race([
      fetch(request),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error("network timeout")), timeoutMs);
      }),
    ]);
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

function isNextStreamingRequest(request, url) {
  return (
    url.searchParams.has("_rsc") ||
    request.headers.get("rsc") === "1" ||
    request.headers.get("next-router-state-tree") != null ||
    request.headers.get("accept")?.includes("text/x-component")
  );
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

  // Never intercept streamed App Router payloads or Next internals.
  // Caching/replaying these responses breaks the RSC stream and causes
  // "Error in input stream" navigation failures on deployed builds.
  if (isNextStreamingRequest(request, url) || url.pathname.startsWith("/_next/")) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      networkFirst(
        request,
        RUNTIME_CACHE,
        caches.match("/offline").then((response) => response || Response.error()),
        5500,
      ),
    );
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    // Search suggestions should always use direct network requests.
    // SW timeout/caching adds noticeable lag on mobile Safari/PWA.
    if (url.pathname === "/api/search") {
      return;
    }

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
        url.pathname === "/api/search" ? 15000 : 9000,
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
        5500,
      ),
    );
  }
});
