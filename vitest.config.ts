import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  define: {
    __APP_ENV__: JSON.stringify('test'),
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
