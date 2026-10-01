const CACHE_NAME = 'samavesh-v1';
const APP_SHELL = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/manifest.webmanifest',
  '/css/tokens.css',
  '/css/base.css',
  '/css/components.css',
  '/css/themes.css',
  '/js/main.js',
  '/js/state.js',
  '/js/i18n.js',
  '/js/ai.js',
  '/js/speech.js',
  '/js/ui.js',
  '/js/a11y-checker.js',
  '/js/tabs/ask.js',
  '/js/tabs/document.js',
  '/js/tabs/photo.js',
  '/js/tabs/captions.js',
  '/js/tabs/webcheck.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // NEVER cache API requests
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Network first with cache fallback for HTML, cache first for static assets
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((res) => {
        if (!res || res.status !== 200 || res.type !== 'basic') return res;
        const clone = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
        return res;
      });
    })
  );
});
