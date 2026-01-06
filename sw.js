// Minimal service worker for offline caching
const CACHE_NAME = "denkain-cache-v1";
const CORE = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.json",
  "./data/catalog.json",
  "./data/2025_upper_theory.json",
  "./data/2025_upper_power.json",
  "./data/2025_upper_machine.json",
  "./data/2025_upper_law.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./assets/2025/upper/theory/q1.png",
];

// Install: cache core
self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(CORE);
    self.skipWaiting();
  })());
});

// Activate: cleanup old caches
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k === CACHE_NAME) ? null : caches.delete(k)));
    self.clients.claim();
  })());
});

// Fetch: cache-first for same-origin, network-first for others
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if(url.origin === location.origin){
    event.respondWith((async () => {
      const cached = await caches.match(event.request);
      if(cached) return cached;
      const res = await fetch(event.request);
      const cache = await caches.open(CACHE_NAME);
      cache.put(event.request, res.clone());
      return res;
    })());
  }
});
