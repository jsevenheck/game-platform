import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

export default defineConfig({
  plugins: [vue()],
  root: __dirname,
  // Reuse the same source and public assets from ui-vue
  publicDir: path.resolve(__dirname, '../ui-vue/public'),
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../core/src'),
      '@': path.resolve(__dirname, '../ui-vue/src'),
    },
    dedupe: ['vue', 'pinia'],
  },
  server: {
    port: 5173,
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
      },
      '/health': 'http://localhost:3001',
    },
  },
  build: {
    outDir: '../dist/standalone-web',
    emptyOutDir: true,
  },
});
