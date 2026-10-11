import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { serviceWorker } from './pwa/serviceWorkerPlugin.ts';

export default defineConfig({
  plugins: [react(), serviceWorker()],
  test: {
    environment: 'jsdom',
    // themes.test.ts lee los colores de los temas directamente del CSS.
    css: true,
  },
});
