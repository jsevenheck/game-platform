import { defineConfig, createLogger } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

const isE2E = process.env.E2E_TESTS === '1';
const devPort = Number(process.env.VITE_PORT ?? 5173);
const apiPort = Number(process.env.VITE_API_PORT ?? 3001);
const baseLogger = createLogger();
const e2eLogger = {
  ...baseLogger,
  error(msg: string | Error, options?: { clear?: boolean; timestamp?: boolean }) {
    const text = msg instanceof Error ? msg.message : msg;
    if (isE2E && text.includes('ws proxy')) {
      return;
    }
    baseLogger.error(text, options);
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
    port: devPort,
    proxy: {
      '/socket.io': {
        target: `http://localhost:${apiPort}`,
        ws: true,
        configure: (proxy) => {
          if (process.env.E2E_TESTS === '1') {
            proxy.removeAllListeners('error');
            proxy.on('error', () => {});
          }
        },
      },
      '/health': `http://localhost:${apiPort}`,
    },
  },
  build: {
    outDir: '../dist/client',
    emptyOutDir: true,
  },
});
