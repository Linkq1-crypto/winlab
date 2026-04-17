// WINLAB Service Worker – PWA offline support
const CACHE = "winlab-v1";
const PRECACHE = ["/", "/index.html", "/manifest.json"];

// ── Install: pre-cache shell ──────────────────
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)));
  self.skipWaiting();
});

// ── Activate: purge old caches ────────────────
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch strategy ────────────────────────────
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // Never cache API calls (real-time data)
  if (url.pathname.startsWith("/api/")) return;

  // Static assets: cache-first with network fallback
  e.respondWith(
    caches.match(e.request).then((hit) => {
      if (hit) return hit;

      return fetch(e.request)
        .then((res) => {
          // Cache successful GET responses for static assets
          if (e.request.method === "GET" && res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => {
          // Offline fallback: return cached index.html for nav requests
          if (e.request.mode === "navigate") {
            return caches.match("/index.html");
          }
        });
    })
  );
});
