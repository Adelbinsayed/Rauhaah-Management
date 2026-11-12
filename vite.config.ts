import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const host = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
  ?.env?.TAURI_DEV_HOST;

const srcPath = decodeURIComponent(
  new URL('./src', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': srcPath,
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
  build: {
    outDir: 'E:/.rauhaah-cache/dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: 'index.html',
        splash: 'splash.html',
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
