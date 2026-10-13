import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';
import { base } from './vite.config';

export default defineConfig({
  plugins: [vue()],
  test: {
    // Vitest serves tests from "/" whatever `base` says, so the base path from vite.config.ts is
    // passed in here; src/main.test.ts fails if the two ever disagree.
    env: { BASE_URL: base },
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/test/setup.ts'],
    fileParallelism: true,
    isolate: true,
    coverage: {
      provider: 'v8',
      // All of src, so files no test imports still count (as 0%).
      include: ['src/**/*.{ts,vue}'],
      exclude: ['src/**/*.test.ts', 'src/test/**', 'src/**/*.d.ts'],
      reporter: ['text-summary', 'json-summary'],
      reportsDirectory: 'coverage',
    },
  },
});
