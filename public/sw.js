// Service worker minimal : rend l'app installable (PWA) + secours hors-ligne léger.
// Ne met JAMAIS /api en cache (données live) et ignore les requêtes non-GET.
const CACHE = 'unraid-dash-v1'
const SHELL = ['/', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const { request } = e
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.pathname.startsWith('/api')) return // live → réseau direct

  // Navigations : réseau d'abord, secours sur le cache de l'app
  if (request.mode === 'navigate') {
    e.respondWith(fetch(request).catch(() => caches.match('/')))
    return
  }

  // Assets : cache d'abord, et on rafraîchit en arrière-plan
  e.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res.ok) caches.open(CACHE).then((c) => c.put(request, res.clone()))
          return res
        })
        .catch(() => cached)
      return cached || network
    }),
  )
})
