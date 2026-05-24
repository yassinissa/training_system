/*
 * Minimal service worker for Green Hills Training PWA.
 *
 * Goals:
 *   - Make the site installable on phones/desktops (Add to Home Screen).
 *   - Cache the React shell so users can re-open the app even on a flaky
 *     connection. We DO NOT cache API responses — those stay live so
 *     scores/notifications are always fresh.
 *   - Stay tiny so it never gets in the way; on every deploy a new
 *     CACHE_VERSION clears the old cache automatically.
 */

const CACHE_VERSION = "ghtraining-v2";
const SHELL_ASSETS = [
  "/",
  "/icon-192.png",
  "/icon-512.png",
  "/manifest.webmanifest",
];

// ---- install: pre-cache the shell ----
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(SHELL_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

// ---- activate: wipe old caches ----
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ---- fetch: network-first for navigations, cache fallback for shell ----
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Never touch non-GET or cross-origin or API/admin/media requests.
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/admin/") ||
    url.pathname.startsWith("/media/")
  ) {
    return;
  }

  // For navigations (the SPA shell), try network, fall back to cached "/".
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put("/", copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match("/"))
    );
    return;
  }

  // For static assets (hashed by Vite, so immutable): cache-first.
  if (url.pathname.startsWith("/static/")) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        });
      })
    );
  }
});
