'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker on the client. Required so the browser
 * recognises the app as a PWA and offers its install / download option.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // ignore — the app still works without it, just isn't installable
      });
    };
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }, []);

  return null;
}
