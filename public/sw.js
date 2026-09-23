/*
 * Cecil Pines Living Portal - Service Worker
 * Copyright (c) 2026 Antonio Merlano / Seeds4Clix. All rights reserved.
 */

const CACHE_NAME = 'cecil-pines-cache-v1';
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/apple-touch-icon.png'
];

// Domains that MUST NEVER be intercepted or cached by the service worker
const BYPASS_DOMAINS = [
  'firestore.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'firebaseinstallations.googleapis.com',
  'firebase.googleapis.com',
  'firebaseio.com',
  'firebasestorage.app',
  'storage.googleapis.com',
  'accounts.google.com',
  'apis.google.com',
  'generativelanguage.googleapis.com',
  'translation.googleapis.com',
  'maps.googleapis.com'
];

// Install: precache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Precache partial error (non-fatal):', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate: purge older caches and claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: intercept requests while strictly bypassing Firebase, APIs, and non-GET requests
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // 1. Only handle GET requests (Firebase Auth/Firestore writes/uploads use POST/PUT/DELETE)
  if (req.method !== 'GET') {
    return;
  }

  let url;
  try {
    url = new URL(req.url);
  } catch (e) {
    return;
  }

  // 2. Ignore non-HTTP/HTTPS schemes (e.g. chrome-extension, blob, data)
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // 3. Strictly bypass all Firebase, Google APIs, and auth endpoints
  const isBypassDomain = BYPASS_DOMAINS.some(
    (domain) => url.hostname === domain || url.hostname.endsWith('.' + domain)
  );
  if (isBypassDomain) {
    return;
  }

  // 4. Bypass backend API routes (/api/*) and internal server endpoints
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/__/')) {
    return;
  }

  // 5. Bypass Vite development server internals if running in dev
  if (url.pathname.includes('/@vite/') || url.pathname.includes('/@fs/') || url.pathname.includes('vite-hmr')) {
    return;
  }

  // 6. Navigation requests (HTML pages): Network-First, fallback to cached index.html
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match('/index.html').then((cached) => cached || caches.match('/'));
        })
    );
    return;
  }

  // 7. Same-origin or static assets: Stale-While-Revalidate
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      const fetchPromise = fetch(req)
        .then((networkResponse) => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            (networkResponse.type === 'basic' || networkResponse.type === 'cors')
          ) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return networkResponse;
        })
        .catch(() => {
          // If offline and not in cache, fallback
          return cachedResponse;
        });

      return cachedResponse || fetchPromise;
    })
  );
});
