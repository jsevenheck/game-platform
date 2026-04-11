import { defineConfig, type Plugin, type PluginOption } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

const GAMES_ROOT = resolve(__dirname, '../../games');

/**
 * Resolves `@shared/*` imports to the correct game's `core/src/` directory
 * based on which game directory the importing file lives in.
 */
function sharedAliasPlugin(): Plugin {
  return {
    name: 'shared-alias',
    async resolveId(source, importer) {
      if (!source.startsWith('@shared')) return null;
      if (!importer) return null;
      const normalized = importer.replace(/\\/g, '/');
      const subpath = source.replace(/^@shared\/?/, '');
      let baseDir: string | undefined;
      if (normalized.includes('/games/blackout/')) {
        baseDir = resolve(GAMES_ROOT, 'blackout/core/src');
      } else if (normalized.includes('/games/imposter/')) {
        baseDir = resolve(GAMES_ROOT, 'imposter/core/src');
      } else if (normalized.includes('/games/secret-signals/')) {
        baseDir = resolve(GAMES_ROOT, 'secret-signals/core/src');
      } else if (normalized.includes('/games/flip7/')) {
        baseDir = resolve(GAMES_ROOT, 'flip7/core/src');
      }
      if (!baseDir) return null;
      // Delegate to Vite's resolver so .ts / index.ts extensions are handled
      const resolved = await this.resolve('./' + subpath, resolve(baseDir, '_placeholder.ts'), {
        skipSelf: true,
      });
      return resolved;
    },
  };
}

export default defineConfig({
  plugins: [sharedAliasPlugin(), ...(tailwindcss() as PluginOption[]), vue()],
  resolve: {
    alias: [
      // Platform source alias
      { find: '@platform', replacement: resolve(__dirname, 'src') },
      // Game UI aliases — allow importing game adapters by short name
      { find: '@blackout-ui', replacement: resolve(GAMES_ROOT, 'blackout/ui-vue/src') },
      { find: '@imposter-ui', replacement: resolve(GAMES_ROOT, 'imposter/ui-vue/src') },
      { find: '@secret-signals-ui', replacement: resolve(GAMES_ROOT, 'secret-signals/ui-vue/src') },
      { find: '@flip7-ui', replacement: resolve(GAMES_ROOT, 'flip7/ui-vue/src') },
    ],
    // Force a single copy of shared framework deps across platform + game code
    dedupe: ['vue', 'pinia', 'vue-router'],
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
    rollupOptions: {
      output: {
        manualChunks: {
          pinia: ['pinia'],
        },
      },
    },
  },
});
