import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../core/src'),
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: 'Imposter',
      fileName: (format) => `imposter.${format}.js`,
      cssFileName: 'imposter',
      formats: ['es', 'umd'],
    },
    rollupOptions: {
      external: ['vue', 'pinia', 'socket.io-client'],
      output: {
        globals: {
          vue: 'Vue',
          pinia: 'Pinia',
          'socket.io-client': 'io',
        },
      },
    },
    outDir: 'dist-lib',
    emptyOutDir: true,
  },
});
