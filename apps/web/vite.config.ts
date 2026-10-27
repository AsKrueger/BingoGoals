import react from '@vitejs/plugin-react';
import { configDefaults, defineConfig } from 'vitest/config';
import { contentSecurityPolicyPlugin } from './pwa/contentSecurityPolicy.ts';
import { serviceWorker } from './pwa/serviceWorkerPlugin.ts';

export default defineConfig({
  // Rutas relativas: la web se sirve desde una subcarpeta en GitHub Pages
  // (/BingoGoals/) y desde la raíz en local.
  base: './',
  plugins: [react(), contentSecurityPolicyPlugin(), serviceWorker()],
  test: {
    environment: 'jsdom',
    // La carpeta e2e es de Playwright, no de Vitest.
    exclude: [...configDefaults.exclude, 'e2e/**'],
    setupFiles: ['./src/test/setup.ts'],
    // themes.test.ts lee los colores de los temas directamente del CSS.
    css: true,
  },
});
