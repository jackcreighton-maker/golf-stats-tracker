import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Deployed to GitHub Pages under /golf-stats-tracker/
export default defineConfig({
  base: process.env.GITHUB_PAGES ? '/golf-stats-tracker/' : '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'Golf Stats Tracker',
        short_name: 'Golf Stats',
        description: 'Personal golf round and stats tracker',
        theme_color: '#1a5c38',
        background_color: '#f4f4ef',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,json,woff2}'],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
