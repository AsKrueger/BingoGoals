# BingoGoals

BingoGoals convierte tus metas en un cartón de bingo: cada casilla es un objetivo y, al completarlos, cantas línea o bingo.

La aplicación es una web instalable hecha con React, que guarda los tableros en el propio dispositivo y funciona sin conexión, y una API con NestJS y PostgreSQL que le dará cuentas y sincronización. El prototipo original en Flutter se conserva como referencia de diseño y de reglas del juego en la etiqueta `flutter-prototype-final`:

```bash
git checkout flutter-prototype-final
```

## Stack

- [Node.js](https://nodejs.org/) 24 (ver `.nvmrc`) y workspaces de npm.
- Web: [React](https://react.dev/), [TypeScript](https://www.typescriptlang.org/) y [Vite](https://vite.dev/).
- API: [NestJS](https://nestjs.com/), [Prisma](https://www.prisma.io/) y [PostgreSQL](https://www.postgresql.org/).
- Dominio: las reglas del bingo, en un paquete que comparten la web y la API.
- Tests: [Vitest](https://vitest.dev/), con jsdom y Testing Library en la web, y [Playwright](https://playwright.dev/) para la prueba de humo en un navegador real.
- Calidad: [ESLint](https://eslint.org/) y [Prettier](https://prettier.io/) desde la raíz, y GitHub Actions en cada pull request.

## Estructura

```text
.
├── .github/workflows/  # Integración continua
├── apps/
│   ├── api/            # @bingogoals/api: API con NestJS y Prisma
│   │   └── prisma/     # Esquema y migraciones de la base de datos
│   └── web/            # @bingogoals/web: aplicación React + Vite
│       └── e2e/        # Prueba de humo con Playwright
├── packages/
│   └── domain/         # @bingogoals/domain: modelo y reglas del bingo
├── docs/
│   ├── reviews/        # Revisiones de código de cada fase
│   └── roadmap.md      # Fases del proyecto
├── scripts/            # Utilidades de desarrollo
├── compose.yaml        # PostgreSQL para desarrollo local
├── package.json        # Raíz privada con los workspaces
└── package-lock.json   # Único lockfile del monorepo
```

## Puesta en marcha

Hace falta Node.js 24 y, para la API, [Docker](https://www.docker.com/) con Docker Compose.

```bash
npm install                                # dependencias y cliente de Prisma
cp apps/api/.env.example apps/api/.env     # configuración local de la API
npm run db:up                              # arranca PostgreSQL en Docker
npm run db:migrate                         # crea las tablas
npm run dev                                # web, API y dominio, recompilando al guardar
```

Con eso quedan en marcha la web en http://localhost:5173 y la API en http://localhost:3000.

La web no necesita la API ni la base de datos para funcionar: todavía guarda todo en el dispositivo. Si solo vas a tocar la web, basta con `npm install` y `npm run dev`; la API arrancará igualmente y `GET /health` avisará de que no tiene base de datos.

### Base de datos

- `compose.yaml` arranca un PostgreSQL 17 accesible solo desde tu equipo, en el puerto 5432. Sus credenciales (`bingogoals` / `bingogoals`) son solo para desarrollo local.
- La API lee la conexión de `DATABASE_URL`, en `apps/api/.env`. Ese archivo no se sube al repositorio; `apps/api/.env.example` es la plantilla.
- El esquema está en `apps/api/prisma/schema.prisma`. Tras cambiarlo, `npm run db:migrate:dev --workspace @bingogoals/api` crea la migración y la aplica.
- `npm run db:down` detiene la base de datos y conserva sus datos. Para borrarlos, `docker compose down --volumes`.

### Estado de la API

`GET /health` responde `{"status":"ok","database":"ok"}`. Si la base de datos no responde, devuelve un 503 con `{"status":"error","database":"unavailable"}` en unos segundos, sin quedarse esperando. El puerto se cambia con la variable de entorno `PORT`.

## Comandos

Todos se ejecutan desde la raíz del repositorio.

| Comando                    | Qué hace                                                                          |
| -------------------------- | --------------------------------------------------------------------------------- |
| `npm install`              | Instala las dependencias de todos los workspaces y genera el cliente de Prisma.   |
| `npm run dev`              | Arranca la web y la API, y recompila el dominio al guardar.                       |
| `npm run lint`             | Analiza el código con ESLint.                                                     |
| `npm run format`           | Da formato a todo el repositorio con Prettier.                                    |
| `npm run format:check`     | Comprueba el formato sin modificar archivos.                                      |
| `npm run typecheck`        | Comprueba los tipos del dominio, la API y la web.                                 |
| `npm run test`             | Ejecuta los tests unitarios del dominio, la API y la web. No necesita Docker.     |
| `npm run test:integration` | Ejecuta los tests de la API contra PostgreSQL. Necesita la base de datos migrada. |
| `npm run test:e2e`         | Compila todo y ejecuta la prueba de humo de la web en un navegador real.          |
| `npm run build`            | Compila el dominio, la API y la web.                                              |
| `npm run db:up`            | Arranca PostgreSQL en Docker y espera a que esté listo.                           |
| `npm run db:migrate`       | Aplica las migraciones pendientes.                                                |
| `npm run db:down`          | Detiene PostgreSQL.                                                               |

La primera vez que ejecutes la prueba de humo hay que descargar su navegador: `npx playwright install chromium`.

El dominio se usa compilado. `typecheck`, `test` y `dev` lo compilan antes de empezar; si ejecutas el script de un solo workspace, compílalo antes con `npm run build:domain`.

## Contribuir

El flujo de ramas, el formato de los commits y las comprobaciones de calidad están en [CONTRIBUTING.md](CONTRIBUTING.md). La planificación está en [docs/roadmap.md](docs/roadmap.md).

## Licencia

[MIT](LICENSE)
