const CACHE_NAME = "startpage-cache-v3";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/style.css",
  "./js/app.js",
  "./js/storage.js",
  "./js/registry.js",
  "./js/render.js",
  "./js/inline-markdown.js",
  "./js/widgets/datetime.js",
  "./js/widgets/ipinfo.js",
  "./js/widgets/links.js",
  "./js/widgets/markdown.js",
  "./js/widgets/feed.js",
  "./js/widgets/todo.js",
  "./icons/icon.svg"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const { request } = event;
  if(request.method !== "GET") return;

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;

  if(isSameOrigin){
    // stale-while-revalidate: serve cached copy instantly, refresh cache in the
    // background so the next load picks up changes without a manual cache-version bump.
    // The background update is wrapped in waitUntil so the browser doesn't kill the
    // worker before the cache.put() completes once respondWith already resolved.
    event.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(request).then(cached => {
          const networkFetch = fetch(request).then(res => {
            cache.put(request, res.clone());
            return res;
          }).catch(() => cached);
          event.waitUntil(networkFetch);
          return cached || networkFetch;
        })
      )
    );
  }
  // cross-origin requests (IP lookup, feeds, favicons, background image URLs) go straight to network
});
