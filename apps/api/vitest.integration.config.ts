import { existsSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

// Tests de integración: usan el PostgreSQL de DATABASE_URL, con las
// migraciones ya aplicadas. En local la variable sale de .env.
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

export default defineConfig({
  test: {
    include: ['src/**/*.integration.test.ts'],
    // Los archivos comparten la misma base de datos: de uno en uno.
    fileParallelism: false,
    testTimeout: 15_000,
    hookTimeout: 30_000,
  },
});
