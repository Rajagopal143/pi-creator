/*
 * Service worker for Yakuza DMS.
 *
 * Its job is to make the app installable (browsers require a service worker
 * with a fetch handler before they offer the install / download option).
 * It deliberately does NOT cache responses — the app is data-driven and
 * server-rendered, so a pass-through handler keeps every page fresh.
 */

const SW_VERSION = 'v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
  // Pass-through: let the browser handle the request normally.
  // The handler's presence is what keeps the app installable.
});
