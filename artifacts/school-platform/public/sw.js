const CACHE_NAME = 'resa-app-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();

      await Promise.all(
        cacheNames
          .filter((name) => name.startsWith('resa-app-') && name !== CACHE_NAME)
          .map((name) => caches.delete(name)),
      );

      await self.clients.claim();
    })(),
  );
});

// Do not cache Supabase requests, sign-in pages, or personal school records.
self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (
    request.method !== 'GET' ||
    new URL(request.url).origin !== self.location.origin
  ) {
    return;
  }

  const url = new URL(request.url);

  if (
    url.pathname.includes('/auth/') ||
    url.pathname.includes('/rest/v1/') ||
    url.pathname.includes('/functions/v1/')
  ) {
    return;
  }

  // Do not cache pages or data. Let the app load normally online.
  // This service worker enables registration but does not promise offline access.
});

// Display server-sent Web Push messages when a push sender is configured.
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : 'You have a new RESA update.' };
  }
  const title = payload.title || 'RESA · School update';
  const options = {
    body: payload.body || payload.message || 'There is a new update in your parent portal.',
    icon: payload.icon || '/favicon.ico',
    badge: payload.badge || '/favicon.ico',
    tag: payload.tag || 'resa-school-update',
    data: { url: payload.url || '/parent-dashboard' },
    renotify: true,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Open the relevant RESA portal area when a user taps a notification.
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
      const windows = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
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
