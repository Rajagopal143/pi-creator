import type { MetadataRoute } from 'next';

/**
 * Web app manifest — Next serves this at `/manifest.webmanifest` and
 * auto-injects the `<link rel="manifest">` tag. Together with the service
 * worker (`public/sw.js`) it makes the app installable, so browsers show
 * their native install / download option.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Yakuza DMS',
    short_name: 'Yakuza DMS',
    description:
      'Yakuza Dealer Management System — create proforma invoices, manage dealers and pricing.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f4f4f5',
    theme_color: '#b91c1c',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
