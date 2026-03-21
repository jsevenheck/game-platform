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
      name: 'BlackoutGame',
      fileName: (format) => `blackout-game.${format}.js`,
      cssFileName: 'blackout-game',
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
