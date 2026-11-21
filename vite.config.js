var _a, _b;
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
var host = (_b = (_a = globalThis.process) === null || _a === void 0 ? void 0 : _a.env) === null || _b === void 0 ? void 0 : _b.TAURI_DEV_HOST;
var srcPath = decodeURIComponent(new URL('./src', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
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
                host: host,
                port: 1421,
            }
            : undefined,
        watch: {
            ignored: ['**/src-tauri/**'],
        },
    },
    build: {
        rollupOptions: {
            input: {
                main: 'index.html',
                splash: 'splash.html',
            },
            output: {
                manualChunks: function (id) {
                    if (id.indexOf('node_modules/lucide-react') !== -1) {
                        return 'vendor-icons';
                    }
                    if (id.indexOf('node_modules/@tauri-apps') !== -1) {
                        return 'vendor-tauri';
                    }
                },
            },
        },
        chunkSizeWarningLimit: 800,
    },
    test: {
        environment: 'node',
        include: ['src/**/*.test.ts'],
    },
});
