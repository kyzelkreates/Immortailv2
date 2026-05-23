// ================================================================
// IMMORTAIL™ — SERVICE WORKER
// Offline-first caching strategy.
// Uses Workbox via vite-plugin-pwa injectManifest.
// ================================================================

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

const CACHE_NAME = 'immortail-v1';

// ----------------------------------------------------------------
// PRECACHE (injected by vite-plugin-pwa at build time)
// ----------------------------------------------------------------
precacheAndRoute(self.__WB_MANIFEST || []);
cleanupOutdatedCaches();

// ----------------------------------------------------------------
// RUNTIME CACHING
// ----------------------------------------------------------------

// Navigation — network first with offline fallback
registerRoute(
  ({ request }) => request.mode === 'navigate',
  new NetworkFirst({
    cacheName: `${CACHE_NAME}-pages`,
    plugins: [new ExpirationPlugin({ maxEntries: 5 })]
  })
);

// Static assets — cache first
registerRoute(
  ({ request }) => ['style', 'script', 'worker'].includes(request.destination),
  new CacheFirst({
    cacheName: `${CACHE_NAME}-assets`,
    plugins: [new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 })]
  })
);

// Images — stale while revalidate
registerRoute(
  ({ request }) => request.destination === 'image',
  new StaleWhileRevalidate({
    cacheName: `${CACHE_NAME}-images`,
    plugins: [new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 7 * 24 * 60 * 60 })]
  })
);

// ----------------------------------------------------------------
// LIFECYCLE
// ----------------------------------------------------------------

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      // Clean old caches
      caches.keys().then(keys =>
        Promise.all(keys.filter(k => k !== CACHE_NAME && !k.startsWith('immortail-v1')).map(k => caches.delete(k)))
      )
    ])
  );
});

// ----------------------------------------------------------------
// OFFLINE FALLBACK
// ----------------------------------------------------------------
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match('/') || new Response('<h1>IMMORTAIL™ — Offline</h1>', { headers: { 'Content-Type': 'text/html' } })
      )
    );
  }
});
