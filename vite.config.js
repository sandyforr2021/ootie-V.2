import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  plugins: [vue({ template: { transformAssetUrls: { includeAbsolute: false } } })],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['src/**/*.spec.js'],
    exclude: ['OOTIE-main/**', 'tests/**', 'dist/**', 'legacy/**', 'node_modules/**'],
    setupFiles: ['./tests/vitest.setup.js'],
    clearMocks: true,
    restoreMocks: true
  },
  build: {
    rollupOptions: {
      input: resolve(__dirname, 'index.html'),
      output: {
        // Keep stable SDK/framework code cached when application screens change.
        // Deferred modals still control what is downloaded on the first visit.
        manualChunks(id) {
          if (id.includes('/node_modules/@supabase/')) return 'vendor-supabase';
          if (/\/node_modules\/(?:@vue\/|vue\/|vue-router\/|pinia\/|vue-demi\/)/.test(id)) return 'vendor-vue';
        }
      }
    }
  },
  server: {
    watch: {
      ignored: ['**/OOTIE-main/OOTIE-main/**']
    }
  }
});
