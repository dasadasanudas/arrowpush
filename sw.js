// Cache the app + chemistry engine so links open offline after the first visit.
const C = 'arrowpush-v1';
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  const cdn = /unpkg\.com|jsdelivr\.net/.test(u.host);
  if (cdn) { // cache-first
    e.respondWith(caches.open(C).then(async c => { const hit = await c.match(e.request); if (hit) return hit; const r = await fetch(e.request); if (r.ok) c.put(e.request, r.clone()); return r; }));
  } else if (u.origin === location.origin) { // network-first
    e.respondWith(fetch(e.request).then(r => { const cl = r.clone(); caches.open(C).then(c => c.put(e.request, cl)); return r; }).catch(() => caches.match(e.request, { ignoreSearch: true })));
  }
});
