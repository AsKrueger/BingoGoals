# Imagen de la API. Se construye desde la raíz del repositorio, porque la API
# usa el paquete del dominio:
#
#   docker build --file apps/api/Dockerfile --tag bingogoals-api .
#
# Al arrancar aplica las migraciones pendientes y después levanta la API.
# Necesita DATABASE_URL y CORS_ORIGINS; ver docs/despliegue.md.

# --- Compilación: con las herramientas de desarrollo ---
FROM node:24-slim AS build

# OpenSSL lo necesita el motor de migraciones de Prisma, que se descarga al
# generar el cliente para la versión de OpenSSL que encuentre.
RUN apt-get update   && apt-get install --yes --no-install-recommends openssl   && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Primero solo las dependencias, para que Docker las reutilice mientras no
# cambien. Se instalan las del dominio y la API, no las de la web.
COPY package.json package-lock.json ./
COPY packages/domain/package.json packages/domain/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --ignore-scripts \
  --workspace @bingogoals/domain --workspace @bingogoals/api

COPY packages/domain packages/domain
COPY apps/api apps/api
RUN npm run db:generate --workspace @bingogoals/api \
  && npm run build --workspace @bingogoals/domain \
  && npm run build --workspace @bingogoals/api

# --- Ejecución: solo lo que hace falta para arrancar ---
FROM node:24-slim

# La misma versión de OpenSSL que en la compilación.
RUN apt-get update \
  && apt-get install --yes --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY packages/domain/package.json packages/domain/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
# Prisma va en las dependencias de ejecución: aplica las migraciones.
RUN npm ci --omit=dev --ignore-scripts \
  --workspace @bingogoals/domain --workspace @bingogoals/api \
  && npm cache clean --force

# El motor de migraciones, que Prisma descargó al generar el cliente.
COPY --from=build /app/node_modules/@prisma/engines node_modules/@prisma/engines
COPY --from=build /app/packages/domain/dist packages/domain/dist
COPY --from=build /app/apps/api/dist apps/api/dist
COPY apps/api/prisma apps/api/prisma
COPY apps/api/prisma.config.ts apps/api/

USER node
WORKDIR /app/apps/api
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && exec node dist/main.js"]
