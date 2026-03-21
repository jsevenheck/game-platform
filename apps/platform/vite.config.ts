import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

const GAMES_ROOT = resolve(__dirname, '../../games');

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: [
      // Platform source alias
      { find: '@platform', replacement: resolve(__dirname, 'src') },
      // Game UI aliases — allow importing game adapters by short name
      { find: '@blackout-ui', replacement: resolve(GAMES_ROOT, 'blackout/ui-vue/src') },
      { find: '@imposter-ui', replacement: resolve(GAMES_ROOT, 'imposter/ui-vue/src') },
      { find: '@secret-signals-ui', replacement: resolve(GAMES_ROOT, 'secret-signals/ui-vue/src') },
      // Context-sensitive @shared alias: resolve to the correct game's core/src
      // based on which game's directory the importing file lives in.
      {
        find: '@shared',
        replacement: '',
        customResolver(source, importer) {
          if (!importer) return null;
          const subpath = source.replace(/^@shared\/?/, '');
          if (importer.includes('/games/blackout/')) {
            return resolve(GAMES_ROOT, 'blackout/core/src', subpath);
          }
          if (importer.includes('/games/imposter/')) {
            return resolve(GAMES_ROOT, 'imposter/core/src', subpath);
          }
          if (importer.includes('/games/secret-signals/')) {
            return resolve(GAMES_ROOT, 'secret-signals/core/src', subpath);
          }
          return null;
        },
      },
    ],
  },
  server: {
    port: 5173,
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true,
        changeOrigin: true,
      },
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
  },
});
