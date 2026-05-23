const CACHE = "kronika-v4";

// Critical static assets — install fails if these cannot be fetched
const PRECACHE_STATIC = [
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
];

// HTML pages to attempt caching on install (best-effort — skipped if user not logged in)
const PRECACHE_PAGES = [
  "/login",
  "/dashboard",
  "/dashboard/new",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      await cache.addAll(PRECACHE_STATIC);
      // Skip pages that redirect (e.g. auth redirects to /login)
      await Promise.allSettled(
        PRECACHE_PAGES.map(async (url) => {
          const res = await fetch(url);
          if (res.ok && !res.redirected) await cache.put(url, res);
        })
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") return;

  // Skip external Firebase / Google endpoints
  if (url.hostname !== location.hostname) {
    if (
      url.hostname.includes("googleapis.com") ||
      url.hostname.includes("firebase") ||
      url.hostname.includes("firebaseio.com") ||
      url.hostname.includes("gstatic.com")
    ) return;
  }

  // Skip Next.js App Router RSC and prefetch requests (client-side navigation payloads)
  if (
    request.headers.get("RSC") === "1" ||
    request.headers.get("Next-Router-Prefetch") === "1"
  ) return;

  // /_next/static/ — cache-first (immutable, content-hashed JS/CSS/fonts)
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((res) => {
            if (res.ok) {
              caches.open(CACHE).then((c) => c.put(request, res.clone()));
            }
            return res;
          })
      )
    );
    return;
  }

  // Other /_next/* (image optimization, HMR, RSC data) — network only
  if (url.pathname.startsWith("/_next/")) return;

  // HTML page navigations — network-first, cache on success, offline fallback to cache
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          // Only cache actual pages, not auth redirects
          if (res.ok && !res.redirected) {
            caches.open(CACHE).then((c) => c.put(request, res.clone()));
          }
          return res;
        })
        .catch(() =>
          caches.match(request).then(
            (cached) =>
              cached ??
              caches.match("/dashboard") ??
              caches.match("/login")
          )
        )
    );
    return;
  }

  // Public static files (icons, images) — stale-while-revalidate
  event.respondWith(
    caches.match(request).then((cached) => {
      const revalidate = fetch(request)
        .then((res) => {
          if (res.ok) {
            caches.open(CACHE).then((c) => c.put(request, res.clone()));
          }
          return res;
        })
        .catch(() => cached);
      return cached ?? revalidate;
    })
  );
});
