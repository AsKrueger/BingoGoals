import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    // themes.test.ts lee los colores de los temas directamente del CSS.
    css: true,
  },
});
