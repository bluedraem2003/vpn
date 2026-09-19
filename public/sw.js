/* PostYar SW: never cache API. Network-first for pages. */
const CACHE = 'postyar-v3'

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  let url
  try {
    url = new URL(request.url)
  } catch {
    return
  }

  // Always hit the network for API / auth / live data
  if (url.pathname.startsWith('/api/')) return

  const isNavigate =
    request.mode === 'navigate' ||
    request.destination === 'document' ||
    url.pathname === '/' ||
    url.pathname.endsWith('.html')

  if (isNavigate) {
    event.respondWith(fetch(request).catch(() => caches.match('/index.html')))
    return
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && shouldCacheAsset(url.pathname)) {
          const copy = response.clone()
          caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {})
        }
        return response
      })
      .catch(() => caches.match(request)),
  )
})

function shouldCacheAsset(pathname) {
  return (
    pathname.startsWith('/assets/') ||
    /\.(?:js|css|png|svg|woff2|webmanifest)$/.test(pathname)
  )
}
