/* SVOJA 360 service worker.
 * - Static build assets: cache first (they are content-hashed).
 * - Client training / nutrition pages: network first, cached copy when offline,
 *   so a planned workout can be opened in the gym without signal.
 * - Every other navigation: network only, offline page as fallback.
 * - Nothing from Supabase (API, storage, signed URLs) is ever cached here.
 * - On sign-out the page posts {type:"CLEAR_USER_CACHE"} and personal pages are dropped.
 */
const VERSION = "v1";
const STATIC_CACHE = `svoja-static-${VERSION}`;
const PAGE_CACHE = `svoja-pages-${VERSION}`;
const OFFLINE_URL = "/offline";
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png", "/manifest.webmanifest"];
const OFFLINE_PAGES = [/^\/klijent\/treninzi(\/|$)/, /^\/klijent\/trcanje(\/|$)/, /^\/klijent\/ishrana(\/|$)/, /^\/klijent\/?$/];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => ![STATIC_CACHE, PAGE_CACHE].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "CLEAR_USER_CACHE") {
    event.waitUntil(caches.delete(PAGE_CACHE));
  }
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase and every other origin: untouched

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(STATIC_CACHE).then((c) => c.put(req, copy)); }
        return res;
      })),
    );
    return;
  }

  if (req.mode === "navigate") {
    const cacheable = OFFLINE_PAGES.some((re) => re.test(url.pathname));
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (cacheable && res.ok && !res.redirected) {
            const copy = res.clone();
            caches.open(PAGE_CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(async () => (cacheable && (await caches.match(req, { cacheName: PAGE_CACHE }))) || (await caches.match(OFFLINE_URL)) || Response.error()),
    );
  }
});
