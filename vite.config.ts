import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const APP_PATH = '/chess-openings/'

function commitSha() {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return 'unknown'
  }
}

const builtAt = new Date().toISOString().slice(0, 16).replace('T', ' ')

export default defineConfig({
  base: APP_PATH,
  build: {
    // Workers Static Assets looks files up by the full request path and never strips the route
    // prefix, so /chess-openings/* requests only find the build if it sits under dist/chess-openings/.
    outDir: 'dist/chess-openings',
    emptyOutDir: true,
    // The bundled opening list is ~600 kB raw (~90 kB gzipped) and needed on first paint anyway.
    chunkSizeWarningLimit: 800,
  },
  define: {
    __APP_VERSION__: JSON.stringify(`${commitSha()} · built ${builtAt} UTC`),
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      scope: APP_PATH,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        id: APP_PATH,
        name: 'Chess Openings',
        short_name: 'Chess Openings',
        description: 'Chess openings on quiggleson.com',
        start_url: APP_PATH,
        scope: APP_PATH,
        display: 'standalone',
        theme_color: '#7D26CD',
        background_color: '#ffffff',
        icons: [
          { src: 'icons/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
