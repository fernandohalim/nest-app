self.addEventListener('install', (e) => {
  console.log('[service worker] installed');
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  console.log('[service worker] activated');
  return self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  e.respondWith(fetch(e.request).catch(() => new Response("you are offline, but localstorage still works!")));
});