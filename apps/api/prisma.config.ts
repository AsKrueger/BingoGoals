import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

// Prisma no lee .env por su cuenta. En local se carga aquí; en la CI y en
// producción DATABASE_URL llega como variable de entorno.
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // `prisma generate` no necesita la base de datos, así que la variable
    // puede faltar; las órdenes que sí conectan fallan con un error claro.
    url: process.env.DATABASE_URL ?? '',
  },
});
