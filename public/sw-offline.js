/**
 * Service Worker — Offline-first with intelligent caching
 *
 * Cache strategy:
 * 1. Static assets (CSS/JS) → Cache-first, stale-while-revalidate
 * 2. HTML → Network-first, fallback to cache
 * 3. API calls → Network-first, cache on success
 * 4. Images → Cache-first, long TTL
 */

const CACHE_VERSION = 'winlab-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const API_CACHE = `${CACHE_VERSION}-api`;
const IMAGE_CACHE = `${CACHE_VERSION}-images`;

// Static assets to pre-cache
const STATIC_ASSETS = [
  '/',
  '/index.html',
];

// API routes to cache (GET only)
const CACHEABLE_API = [
  '/api/helpdesk/inbox',
  '/api/helpdesk/sla',
  '/api/helpdesk/metrics',
];

// ═══════════════════════════════════════════
// INSTALL — Pre-cache static assets
// ═══════════════════════════════════════════
self.addEventListener('install', event => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => {
      console.log('[SW] Pre-caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// ═══════════════════════════════════════════
// ACTIVATE — Clean old caches
// ═══════════════════════════════════════════
self.addEventListener('activate', event => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => !key.startsWith(CACHE_VERSION))
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ═══════════════════════════════════════════
// FETCH — Intelligent routing strategy
// ═══════════════════════════════════════════
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin
  if (url.origin !== location.origin) return;

  // Route by resource type
  if (request.method === 'POST') {
    // POST requests: network only, but save to offline queue on failure
    return handlePostRequest(event);
  }

  if (url.pathname.startsWith('/api/')) {
    return handleApiRequest(event);
  }

  if (request.destination === 'image') {
    return handleImageRequest(event);
  }

  if (request.destination === 'style' || request.destination === 'script') {
    return handleStaticRequest(event);
  }

  // Default: HTML → network-first
  return handleHtmlRequest(event);
});

// ═══════════════════════════════════════════
// STRATEGY: API requests (network-first, cache on success)
// ═══════════════════════════════════════════
async function handleApiRequest(event) {
  const { request } = event;

  // Only cache GET requests
  if (request.method !== 'GET') {
    return fetch(request).catch(() => {
      return new Response(
        JSON.stringify({ error: 'Offline — request queued for sync' }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    });
  }

  try {
    // Try network first
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      // Clone and cache successful response
      const cache = await caches.open(API_CACHE);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (err) {
    // Network failed → try cache
    const cachedResponse = await caches.match(request);

    if (cachedResponse) {
      console.log('[SW] Serving from API cache:', request.url);
      return cachedResponse;
    }

    // No cache → return offline indicator
    return new Response(
      JSON.stringify({
        offline: true,
        cached: false,
        message: 'Offline and no cached data available',
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

// ═══════════════════════════════════════════
// STRATEGY: POST requests (network + offline queue)
// ═══════════════════════════════════════════
async function handlePostRequest(event) {
  const { request } = event;

  try {
    return await fetch(request);
  } catch (err) {
    // Network failed — queue for offline sync
    console.log('[SW] Offline — queuing POST:', request.url);

    // Clone request data for later replay
    const clone = request.clone();
    const data = await clone.json().catch(() => null);

    // Save to offline queue (via message to client)
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'QUEUE_ACTION',
          action: {
            url: request.url,
            method: request.method,
            body: data,
            timestamp: Date.now(),
          },
        });
      });
    });

    // Return queued response
    return new Response(
      JSON.stringify({
        queued: true,
        message: 'Request saved — will sync when online',
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// ═══════════════════════════════════════════
// STRATEGY: Static assets (cache-first)
// ═══════════════════════════════════════════
async function handleStaticRequest(event) {
  const cached = await caches.match(event.request);

  if (cached) {
    // Cache hit — serve immediately, revalidate in background
    event.waitUntil(
      fetch(event.request).then(response => {
        if (response.ok) {
          caches.open(STATIC_CACHE).then(cache => cache.put(event.request, response));
        }
      }).catch(() => {})
    );
    return cached;
  }

  // Cache miss → fetch
  return fetch(event.request);
}

// ═══════════════════════════════════════════
// STRATEGY: Images (cache-first, long TTL)
// ═══════════════════════════════════════════
async function handleImageRequest(event) {
  const cached = await caches.match(event.request);

  if (cached) return cached;

  try {
    const response = await fetch(event.request);
    if (response.ok) {
      const cache = await caches.open(IMAGE_CACHE);
      cache.put(event.request, response.clone());
    }
    return response;
  } catch {
    // Return placeholder
    return new Response('', { status: 404 });
  }
}

// ═══════════════════════════════════════════
// STRATEGY: HTML (network-first, fallback cache)
// ═══════════════════════════════════════════
async function handleHtmlRequest(event) {
  try {
    const networkResponse = await fetch(event.request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(event.request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    const cached = await caches.match(event.request);
    if (cached) return cached;

    // Ultimate fallback
    return caches.match('/index.html');
  }
}

// ═══════════════════════════════════════════
// MESSAGE — Handle cache management from client
// ═══════════════════════════════════════════
self.addEventListener('message', event => {
  if (event.data.type === 'CLEAR_CACHE') {
    caches.delete(event.data.cacheName).then(() => {
      event.source.postMessage({ type: 'CACHE_CLEARED', cache: event.data.cacheName });
    });
  }

  if (event.data.type === 'CACHE_STATUS') {
    caches.keys().then(keys => {
      Promise.all(
        keys.map(async key => {
          const cache = await caches.open(key);
          const entries = await cache.keys();
          return { name: key, entries: entries.length };
        })
      ).then(status => {
        event.source.postMessage({ type: 'CACHE_STATUS', status });
      });
    });
  }
});
