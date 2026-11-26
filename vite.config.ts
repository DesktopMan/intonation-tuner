/// <reference types="vitest/config" />
import vue from '@vitejs/plugin-vue'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  // GitHub Pages serves the app from a sub-path (e.g. /intonation-tuner/); CI sets BASE_PATH.
  base: process.env.BASE_PATH || '/',
  plugins: [
    vue(),
    // HTTPS in dev so the mic works when opened from a phone on the LAN.
    mode !== 'test' && basicSsl(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Intonation Tuner',
        short_name: 'Intonation',
        description: 'Tuner with dynamics and intonation practice for solo instruments',
        theme_color: '#14161a',
        background_color: '#14161a',
        display: 'standalone',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  worker: { format: 'es' },
  // ECharts lives in the lazily-loaded Intonation route chunk.
  build: { chunkSizeWarningLimit: 700 },
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts'],
  },
}))
