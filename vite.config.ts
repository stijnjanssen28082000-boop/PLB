import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  // Deel D.4: the target environment comes from the build configuration, never
  // from code. `vite build --mode production` reads .env.production, everything
  // else falls back to the test environment.
  const appEnv = env.VITE_APP_ENV ?? (mode === 'production' ? 'production' : 'test');

  return {
    plugins: [react()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    define: {
      __APP_ENV__: JSON.stringify(appEnv),
    },
    optimizeDeps: {
      exclude: ['jeep-sqlite'],
    },
    server: { port: 5173, host: true },
  };
});
