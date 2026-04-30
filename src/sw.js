/* eslint-disable no-restricted-globals */
import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { registerRoute, setCatchHandler } from 'workbox-routing';
import { CacheFirst, NetworkFirst, NetworkOnly, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
clientsClaim();
self.skipWaiting();

const STATIC_CACHE = 'winlab-static-v1';
const IMAGE_CACHE = 'winlab-images-v1';
const MARKETING_PREFIXES = ['/', '/blog', '/contact', '/feedback', '/how-it-works', '/privacy', '/profile', '/security', '/status', '/terms'];
const offlineHandler = createHandlerBoundToURL('/offline.html');

function isSameOrigin({ url }) {
  return url.origin === self.location.origin;
}

function isApiRequest({ url }) {
  return isSameOrigin({ url }) && url.pathname.startsWith('/api/');
}

function isRealtimeRequest({ url }) {
  return isSameOrigin({ url }) && (/^\/ws(\/|$)/.test(url.pathname) || /^\/lab(\/|$)/.test(url.pathname));
}

function isNonCacheableShellRequest({ url }) {
  return isSameOrigin({ url }) && (
    isApiRequest({ url }) ||
    isRealtimeRequest({ url }) ||
    /^\/checkout(\/|$)/.test(url.pathname) ||
    /^\/billing(\/|$)/.test(url.pathname) ||
    /^\/stripe(\/|$)/.test(url.pathname)
  );
}

function isMarketingPath(pathname) {
  return MARKETING_PREFIXES.some((prefix) => pathname === prefix || (prefix !== '/' && pathname.startsWith(`${prefix}/`)));
}

registerRoute(
  ({ url }) => isApiRequest({ url }),
  new NetworkOnly()
);

registerRoute(
  ({ url }) => isRealtimeRequest({ url }),
  new NetworkOnly()
);

registerRoute(
  ({ request, url }) => (
    isSameOrigin({ url }) &&
    ['style', 'script', 'worker', 'font'].includes(request.destination)
  ),
  new StaleWhileRevalidate({
    cacheName: STATIC_CACHE,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);

registerRoute(
  ({ request, url }) => isSameOrigin({ url }) && request.destination === 'image',
  new CacheFirst({
    cacheName: IMAGE_CACHE,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 48,
        maxAgeSeconds: 60 * 60 * 24 * 30,
      }),
    ],
  })
);

registerRoute(
  ({ request, url }) => request.mode === 'navigate' && isSameOrigin({ url }) && !isNonCacheableShellRequest({ url }),
  async ({ event }) => {
    const strategy = new NetworkFirst({
      cacheName: 'winlab-pages-v1',
      networkTimeoutSeconds: 4,
      plugins: [
        new CacheableResponsePlugin({ statuses: [200] }),
      ],
    });

    try {
      return await strategy.handle({ event, request: event.request });
    } catch {
      const pathname = new URL(event.request.url).pathname;
      if (isMarketingPath(pathname)) {
        return offlineHandler({ event, request: event.request });
      }
      return Response.error();
    }
  }
);

setCatchHandler(async ({ event }) => {
  if (event.request.mode === 'navigate') {
    const pathname = new URL(event.request.url).pathname;
    if (isMarketingPath(pathname)) {
      return offlineHandler({ event, request: event.request });
    }
  }
  return Response.error();
});
