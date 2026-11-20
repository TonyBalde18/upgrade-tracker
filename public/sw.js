/*
 * Service worker: makes the app installable and lets it open without a connection.
 *  - The page itself (index.html): network first, so a new version is used as soon
 *    as it is published; the cached copy only when offline.
 *  - Built files (assets/…, their names change with every version): cache first.
 *  - Anything else, and every other site (Google sign-in, the database): not touched.
 * Your data is never stored here; Firestore keeps its own offline copy.
 */
const CACHE = 'upgrade-tracker-v1'
const SCOPE = new URL(self.registration.scope)

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

async function networkFirst(request) {
  const cache = await caches.open(CACHE)
  try {
    const response = await fetch(request)
    if (response.ok) cache.put(SCOPE.href, response.clone())
    return response
  } catch {
    return (await cache.match(SCOPE.href)) || Response.error()
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE)
  const hit = await cache.match(request)
  if (hit) return hit
  const response = await fetch(request)
  if (response.ok) cache.put(request, response.clone())
  return response
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== SCOPE.origin || !url.pathname.startsWith(SCOPE.pathname)) return
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request))
  } else if (url.pathname.startsWith(`${SCOPE.pathname}assets/`)) {
    event.respondWith(cacheFirst(request))
  }
})
