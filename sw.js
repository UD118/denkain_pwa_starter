// sw.js（全文）
// 重要：ここを更新すると、古いキャッシュを捨てて新しいファイルを取りに行く
const CACHE_VERSION = "fe58e21";
const CACHE_NAME = `denkain-cache-${CACHE_VERSION}`;

const CORE_ASSETS = [
  "./",
  "./index.html",
  `./styles.css?v=${CACHE_VERSION}`,
  `./app.js?v=${CACHE_VERSION}`,
  "./manifest.json",
  "./data/catalog.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

// Install: 先にキャッシュして即反映
self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(CORE_ASSETS);
    await self.skipWaiting();
  })());
});

// Activate: 古いキャッシュを削除して制御を奪う
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => k.startsWith("denkain-cache-") && k !== CACHE_NAME)
        .map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

// Fetch: HTMLはnetwork-first（更新優先）
//       それ以外はcache-firstで高速化（ただし新キャッシュ名で更新される）
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 同一オリジンのみ対象
  if (url.origin !== location.origin) return;

  // ナビゲーション（ページ遷移）は常に最新を取りに行く
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE_NAME);
        cache.put("./index.html", fresh.clone());
        return fresh;
      } catch {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match("./index.html")) || Response.error();
      }
    })());
    return;
  }

  // それ以外はキャッシュ優先
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req);
    if (cached) return cached;

    const fresh = await fetch(req);
    // GETだけキャッシュ
    if (req.method === "GET" && fresh && fresh.status === 200) {
      cache.put(req, fresh.clone());
    }
    return fresh;
  })());
});
