import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// When deploying to GitHub Pages the app is served from /<repo>/.
// Override with BASE_PATH env if your repo name differs.
const base = process.env.BASE_PATH || '/benefitoffers/'

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  // Use the Pages sub-path for production builds, root for local dev.
  base: command === 'build' ? base : '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Card Perks Tracker',
        short_name: 'Perks',
        description: 'Track credit card benefits, credits, and offers before they reset or expire.',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        // Relative scope/start so it works under the Pages sub-path automatically.
        scope: '.',
        start_url: '.',
        icons: [
          { src: 'icons/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,json}'],
        navigateFallback: 'index.html'
      },
      devOptions: {
        enabled: false
      }
    })
  ]
}))
