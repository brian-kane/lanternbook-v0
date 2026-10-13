import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// The site is served from https://<owner>.github.io/lanternbook/. This is the only place the base
// path is set: vitest.config.ts and the scripts/check-*.mjs build checks read it from here.
export const base = '/lanternbook/';

export default defineConfig({
  base,
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'lanternbook',
        short_name: 'lanternbook',
        display: 'standalone',
        background_color: '#1b1b1f',
        theme_color: '#1b1b1f',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' }],
      },
    }),
  ],
});
