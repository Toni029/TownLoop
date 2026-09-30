/*
 * TownLoop Living Portal - Service Worker
 * Copyright (c) 2026 Antonio Merlano / Seeds4Clix. All rights reserved.
 */

const CACHE_NAME = 'townloop-cache-v3';
const PDF_CACHE_NAME = 'townloop-pdf-cache-v1';
const PRECACHE_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.svg',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/apple-touch-icon.png'
];

/**
 * Checks if a request URL must bypass service worker interception and go straight to network.
 * Strictly excludes all Firebase APIs, Firestore realtime listeners, Google APIs, and backend endpoints.
 */
function shouldBypassServiceWorker(url, req) {
  const hostname = url.hostname.toLowerCase();
  const pathname = url.pathname;

  // 1. Explicit domain bypass: Firebase, Firestore, Google APIs, Storage, Auth, Maps, Weather
  if (
    hostname.endsWith('googleapis.com') ||
    hostname.endsWith('firebaseio.com') ||
    hostname.endsWith('firebasestorage.app') ||
    hostname.endsWith('firebaseapp.com') ||
    hostname.endsWith('google.com') ||
    hostname.endsWith('gstatic.com') ||
    hostname.endsWith('open-meteo.com') ||
    hostname === 'firestore.googleapis.com' ||
    hostname === 'identitytoolkit.googleapis.com' ||
    hostname === 'securetoken.googleapis.com' ||
    hostname === 'firebaseinstallations.googleapis.com' ||
    hostname === 'storage.googleapis.com'
  ) {
    return true;
  }

  // 2. Realtime database, WebChannel, long-polling, Firestore streaming channels & WebSockets
  if (
    pathname.includes('/google.firestore.') ||
    pathname.includes('/channel') ||
    pathname.includes('/ws') ||
    pathname.includes('/hub') ||
    req.headers.get('upgrade') === 'websocket'
  ) {
    return true;
  }

  // 3. Backend API proxy routes and internal server endpoints
  // Note: Newsletter PDF streams (/api/newsletter/pdf/) are permitted through to service worker for offline/reload caching
  if (pathname.startsWith('/api/newsletter/pdf/')) {
    return false;
  }
  if (pathname.startsWith('/api/') || pathname.startsWith('/__/')) {
    return true;
  }

  // 4. Development source code, hot updates, modules, and bundler assets
  if (
    pathname.startsWith('/src/') ||
    pathname.includes('/@vite/') ||
    pathname.includes('/@fs/') ||
    pathname.includes('/@id/') ||
    pathname.includes('vite-hmr') ||
    url.search.includes('t=') ||
    pathname.endsWith('.ts') ||
    pathname.endsWith('.tsx')
  ) {
    return true;
  }

  return false;
}

// Install: precache app shell
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Precache partial error (non-fatal):', err);
      });
    })
  );
});

// Activate: purge older caches and claim clients (preserving dedicated PDF cache)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== PDF_CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: intercept requests while strictly bypassing Firebase, APIs, and non-GET requests
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // 1. Only handle GET requests (Firebase Auth / Firestore writes / uploads use POST/PUT/DELETE/PATCH)
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

  // 3. Strictly bypass all Firebase, Google APIs, Firestore streaming, and backend endpoints
  if (shouldBypassServiceWorker(url, req)) {
    return;
  }

  // 4. Dedicated PDF Document Handling: Network-First with Persistent PDF Cache fallback across app reloads
  if (url.pathname.startsWith('/api/newsletter/pdf/') || url.pathname.endsWith('.pdf')) {
    event.respondWith(
      fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(PDF_CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.open(PDF_CACHE_NAME).then((cache) => {
            return cache.match(req).then((cached) => {
              if (cached) return cached;
              return cache.match('/api/newsletter/pdf/current_newsletter.pdf');
            });
          });
        })
    );
    return;
  }

  // 5. Navigation requests (HTML pages): Network-First, fallback to cached index.html
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

  // 6. Static precached assets: Stale-While-Revalidate
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
          return cachedResponse;
        });

      return cachedResponse || fetchPromise;
    })
  );
});

// Cache invalidation message receiver from main application thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CLEAR_PDF_CACHE') {
    caches.delete(PDF_CACHE_NAME).then(() => {
      console.log('[SW] Newsletter PDF cache cleared on document removal');
    });
  }
});

