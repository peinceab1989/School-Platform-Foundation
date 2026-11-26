const CACHE_NAME = 'resa-offline-v3';
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_URL)),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((name) => name.startsWith('resa-') && name !== CACHE_NAME)
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

// Only the static offline notice is cached. Authentication, Supabase requests,
// portal pages, student records, and other personal data are never cached.
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  const url = new URL(request.url);
  if (
    url.pathname.includes('/auth/') ||
    url.pathname.includes('/rest/v1/') ||
    url.pathname.includes('/functions/v1/')
  ) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match(OFFLINE_URL)) || Response.error();
      }),
    );
  }
});

// Display server-sent Web Push messages when a push sender is configured.
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : 'You have a new RESA update.' };
  }
  const grouped = payload.grouped === true && typeof payload.tag === 'string';
  const tag = payload.tag || 'resa-school-update';
  event.waitUntil((async () => {
    const openClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (openClients.some(client => client.visibilityState === 'visible')) return;
    let count = 1;
    if (grouped) {
      const existing = await self.registration.getNotifications({ tag });
      count = Math.max(1, Number(existing[0]?.data?.count || 0) + 1);
    }
    const sender = String(payload.sender || payload.title || 'RESA member');
    const title = grouped
      ? count === 1 ? sender + ' · New message' : 'RESA · ' + count + ' new messages'
      : payload.title || 'RESA · School update';
    const body = grouped
      ? count === 1 ? (payload.body || 'You have received a new message.')
        : count + ' new messages. Latest: ' + sender + (payload.preview ? ' · ' + String(payload.preview).slice(0, 100) : '')
      : payload.body || payload.message || 'There is a new update in your RESA portal.';
    const options = {
      body,
      icon: payload.icon || '/media/logo/resa-logo.jpg?v=20261125',
      badge: payload.badge || '/media/logo/resa-logo.jpg?v=20261125',
      tag,
      data: { url: payload.url || '/notifications', count, grouped },
      renotify: grouped,
      silent: payload.silent === true,
      vibrate: Array.isArray(payload.vibrate) ? payload.vibrate : [180, 90, 180],
    };
    await self.registration.showNotification(title, options);
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(
    event.notification.data && event.notification.data.url
      ? event.notification.data.url
      : '/notifications',
    self.location.origin,
  ).href;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windows) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          await client.focus();
          if ('navigate' in client) await client.navigate(target);
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});