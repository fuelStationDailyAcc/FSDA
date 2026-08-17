import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget = env.VITE_BACKEND_URL || 'http://localhost:8000'

  const proxy = {
    '/api': {
      target: proxyTarget,
      changeOrigin: true,
      secure: true,
    },
  }

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'prompt',
        injectRegister: false,
        devOptions: {
          enabled: true,
          type: 'module',
        },
        includeAssets: [
          'favicon-32x32.png',
          'apple-touch-icon.png',
          'pwa-192x192.png',
          'pwa-512x512.png',
          'pwa-512x512-maskable.png',
          'logo-mark.png',
          'robots.txt',
        ],
        manifest: {
          id: '/',
          name: 'PetroBook',
          short_name: 'PetroBook',
          description: 'Ledger, meters, and station operations for PetroBook.',
          lang: 'en',
          dir: 'ltr',
          start_url: '/dashboard',
          scope: '/',
          display: 'standalone',
          orientation: 'any',
          background_color: '#000000',
          theme_color: '#000000',
          categories: ['business', 'finance', 'productivity'],
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'pwa-512x512-maskable.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
          globIgnores: ['**/logo.png'],
          maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
          navigateFallback: 'index.html',
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [
            {
              urlPattern: /\/api\//,
              handler: 'NetworkOnly',
            },
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'google-fonts-stylesheets',
                expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 * 365 },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-webfonts',
                expiration: { maxEntries: 16, maxAgeSeconds: 60 * 60 * 24 * 365 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
      }),
    ],
    server: { proxy },
    preview: { proxy },
  }
})
