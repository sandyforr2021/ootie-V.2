import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  plugins: [vue()],
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
      input: resolve(__dirname, 'index.html')
    }
  },
  server: {
    watch: {
      ignored: ['**/OOTIE-main/OOTIE-main/**']
    }
  }
});
