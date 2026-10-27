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

La web no necesita la API ni la base de datos para funcionar: guarda los tableros en el dispositivo, y la cuenta es opcional. Si solo vas a tocar la web, basta con `npm install` y `npm run dev`; la API arrancará igualmente y `GET /health` avisará de que no tiene base de datos.

### Configuración

| Variable                         | Dónde                 | Para qué                                                                                                 |
| -------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                   | `apps/api/.env`       | Conexión con PostgreSQL.                                                                                 |
| `PORT`                           | `apps/api/.env`       | Puerto de la API. Por defecto, 3000.                                                                     |
| `CORS_ORIGINS`                   | `apps/api/.env`       | Orígenes desde los que la web puede llamar a la API, separados por comas. Sin ella no se admite ninguno. |
| `AUTH_RATE_LIMIT_MAX`            | `apps/api/.env`       | Intentos de registro o de inicio de sesión permitidos por ventana. Por defecto, 10.                      |
| `AUTH_RATE_LIMIT_WINDOW_MINUTES` | `apps/api/.env`       | Duración de esa ventana. Por defecto, 15 minutos.                                                        |
| `VITE_API_URL`                   | `apps/web/.env.local` | Dirección de la API. Se fija al compilar la web. Por defecto, `http://localhost:3000`.                   |

Los archivos `.env` no se suben al repositorio; `apps/api/.env.example` y `apps/web/.env.example` son las plantillas.

### Cuentas

Un usuario puede registrarse con correo y contraseña, iniciar y cerrar sesión, y borrar su cuenta. Con la sesión iniciada, sus tableros se sincronizan entre dispositivos.

| Ruta                   | Qué hace                                                             |
| ---------------------- | -------------------------------------------------------------------- |
| `POST /auth/register`  | Crea la cuenta e inicia sesión. Devuelve el identificador de sesión. |
| `POST /auth/login`     | Inicia sesión. Devuelve el identificador de sesión.                  |
| `GET /auth/me`         | Devuelve el usuario de la sesión, o un 401 si no es válida.          |
| `POST /auth/logout`    | Cierra la sesión: su identificador deja de valer.                    |
| `DELETE /auth/account` | Borra el usuario con sus tableros y sus sesiones.                    |

- La sesión viaja en la cabecera `Authorization: Bearer <identificador>`, no en cookies, y caduca a los 30 días.
- La contraseña se guarda cifrada con scrypt y sal propia. Del identificador de sesión solo se guarda su resumen SHA-256.
- Para proteger una ruta nueva, añádele `@UseGuards(AuthGuard)` y recibe la sesión con `@CurrentSession()`.
- No hay recuperación de contraseña: exige enviar correos, y eso se decide al desplegar.

### Sincronización

Primero el dispositivo: cada cambio se guarda al momento en IndexedDB, un registro por tablero, y se sincroniza después en segundo plano. Sin conexión no se pierde nada.

| Ruta                                   | Qué hace                                                                                                                                         |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /boards?since=<cursor>`           | Tableros de la cuenta cambiados desde el cursor, borrados incluidos, y el cursor nuevo.                                                          |
| `PUT /boards/:id`                      | Crea o sustituye un tablero. Responde con las fotos del tablero que faltan en el servidor, o 409 con la versión guardada si esa es más reciente. |
| `DELETE /boards/:id?deletedAt=<fecha>` | Borra el tablero de forma lógica. Responde 409 si tiene un cambio posterior.                                                                     |
| `PUT /photos/:id`                      | Sube una foto, con el archivo tal cual como cuerpo. Subirla dos veces no cambia nada.                                                            |
| `GET /photos/:id`                      | Descarga una foto.                                                                                                                               |

- La unidad de sincronización es el tablero completo. Ante dos versiones gana la de `updatedAt` más reciente; un borrado cuenta como versión con su fecha.
- La API rechaza fechas adelantadas más de 5 minutos respecto a su reloj.
- `GET /boards` pide los cambios por la hora del servidor (`syncedAt`), no por las fechas de los dispositivos.
- La web sincroniza al abrirse, al volver a primer plano, al recuperar la conexión, un segundo después de cada cambio y cada minuto. Si el servidor no responde, reintenta cada vez más tarde, hasta un minuto.
- Los tableros creados sin cuenta pasan a la primera cuenta que inicie sesión. Los de una cuenta no se ven ni se suben con otra.
- Las pestañas del mismo navegador se avisan de cada cambio con un `BroadcastChannel`.

### Fotos

La foto de una casilla se guarda aparte del tablero: la casilla solo lleva su identificador (`photoId`). Así, guardar un cambio en un tablero no reescribe sus fotos.

- La web reduce cada foto a 1.024 px de lado, en JPEG, antes de guardarla. Rechaza archivos de más de 20 MB sin intentar reducirlos.
- En el dispositivo, las fotos van en su propio almacén de IndexedDB, como archivo. En el servidor, en la tabla `photos` de PostgreSQL.
- Una foto no cambia nunca: elegir otra para una casilla crea una foto nueva, con otro identificador. Por eso no hay conflictos que resolver.
- La sincronización sube las fotos de un tablero justo antes que el tablero, y descarga las que faltan en el dispositivo. Mientras una foto no llega, la casilla muestra un hueco.
- La API admite JPEG, PNG y WebP de hasta 2 MB, y decide el tipo por el contenido del archivo, no por la cabecera.
- El servidor borra una foto en cuanto ninguna casilla la usa, y las que nadie llegó a usar al cabo de un día. El dispositivo borra al abrir la web las que ninguna casilla usa desde hace más de un día.

### Base de datos

- `compose.yaml` arranca un PostgreSQL 17 accesible solo desde tu equipo, en el puerto 5432. Sus credenciales (`bingogoals` / `bingogoals`) son solo para desarrollo local.
- La API lee la conexión de `DATABASE_URL`, en `apps/api/.env`. Ese archivo no se sube al repositorio; `apps/api/.env.example` es la plantilla.
- El esquema está en `apps/api/prisma/schema.prisma`. Tras cambiarlo, `npm run db:migrate:dev --workspace @bingogoals/api` crea la migración, la aplica y regenera el cliente de Prisma. Necesita una terminal interactiva.
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

La prueba de humo arranca la web compilada y la API, así que necesita PostgreSQL en marcha y migrado (`npm run db:up` y `npm run db:migrate`). La primera vez hay que descargar su navegador: `npx playwright install chromium`.

El dominio se usa compilado. `typecheck`, `test` y `dev` lo compilan antes de empezar; si ejecutas el script de un solo workspace, compílalo antes con `npm run build:domain`.

## Contribuir

El flujo de ramas, el formato de los commits y las comprobaciones de calidad están en [CONTRIBUTING.md](CONTRIBUTING.md). La planificación está en [docs/roadmap.md](docs/roadmap.md).

## Licencia

[MIT](LICENSE)
