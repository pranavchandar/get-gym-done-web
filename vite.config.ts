import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Deployed at https://pranavchandar.github.io/get-gym-done-web/
export default defineConfig({
  base: '/get-gym-done-web/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ttf,woff2,json}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      manifest: {
        name: 'Get Gym Done',
        short_name: 'GymDone',
        description: 'Personal workout logger — local-first, no accounts.',
        theme_color: '#101210',
        background_color: '#101210',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/get-gym-done-web/',
        scope: '/get-gym-done-web/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
