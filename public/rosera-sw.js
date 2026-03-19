/* تسجيل من main.tsx — اسم ملف مميز لأن vite-plugin-pwa يستبدل /sw.js */
const SHELL = ['/', '/index.html']
const IMAGE_EXT = /\.(png|jpg|jpeg|webp|gif|svg|ico)(\?|$)/i

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open('rosera-shell-v1').then((c) => c.addAll(SHELL).catch(() => {})))
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (e) => {
  const { request } = e
  const url = new URL(request.url)
  if (request.method !== 'GET') return

  if (url.pathname.includes('/rest/v1/') || url.hostname.includes('supabase')) {
    e.respondWith(fetch(request).catch(() => caches.match(request)))
    return
  }

  if (IMAGE_EXT.test(url.pathname)) {
    e.respondWith(
      caches.match(request).then((hit) => {
        if (hit) return hit
        return fetch(request).then((res) => {
          const copy = res.clone()
          caches.open('rosera-img-v1').then((c) => c.put(request, copy))
          return res
        })
      })
    )
    return
  }

  if (url.origin === self.location.origin && (request.mode === 'navigate' || SHELL.some((p) => url.pathname === p || url.pathname.endsWith('.html')))) {
    e.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone()
          caches.open('rosera-shell-v1').then((c) => c.put(request, copy))
          return res
        })
        .catch(() => caches.match('/index.html') || caches.match(request))
    )
    return
  }

  e.respondWith(fetch(request))
})
