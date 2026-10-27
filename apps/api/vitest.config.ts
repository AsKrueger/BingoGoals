import { defineConfig } from 'vitest/config';

// Tests unitarios: no necesitan base de datos.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.integration.test.ts', 'src/generated/**'],
  },
});
