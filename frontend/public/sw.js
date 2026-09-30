// Forge service worker — only shows and handles notifications (rest timer, gym reminders).
// It deliberately caches nothing, so every deploy is picked up as usual.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// Gym reminders, sent by the server as web push (see backend app/services/reminders.py).
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Time to train 💪', {
      body: data.body || 'Open Forge to start today’s workout.',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag || 'forge-gym-reminder',
      data: { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windows) {
        if ('focus' in client) return client.focus();
      }
      return self.clients.openWindow(url);
    })()
  );
});
