import { defineConfig, createLogger } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

const isE2E = process.env.E2E_TESTS === '1';
const clientPort = Number(process.env.PORT) || 5173;
const apiBaseUrl = process.env.VITE_API_BASE_URL || 'http://localhost:3001';
const baseLogger = createLogger();
const e2eLogger = {
  ...baseLogger,
  error(msg: string | Error, options?: { clear?: boolean; timestamp?: boolean }) {
    if (isE2E && typeof msg === 'string' && msg.includes('ws proxy')) {
      return;
    }
    baseLogger.error(msg, options);
  },
};

export default defineConfig({
  customLogger: isE2E ? e2eLogger : undefined,
  plugins: [vue()],
  root: __dirname,
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../core/src'),
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: clientPort,
    proxy: {
      '/socket.io': {
        target: apiBaseUrl,
        ws: true,
        configure: (proxy) => {
          if (process.env.E2E_TESTS === '1') {
            proxy.removeAllListeners('error');
            proxy.on('error', () => {});
          }
        },
      },
      '/health': apiBaseUrl,
    },
  },
  build: {
    outDir: '../dist/client',
    emptyOutDir: true,
  },
});
