# BingoGoals

BingoGoals convierte tus metas en un cartón de bingo: cada casilla es un objetivo y, al completarlos, cantas línea o bingo.

La aplicación se está reconstruyendo como web con React y una API con NestJS. El prototipo original en Flutter se conserva como referencia de diseño y de reglas del juego en la etiqueta `flutter-prototype-final`:

```bash
git checkout flutter-prototype-final
```

## Stack

- [Node.js](https://nodejs.org/) 24 (ver `.nvmrc`) y workspaces de npm.
- Web: [React](https://react.dev/), [TypeScript](https://www.typescriptlang.org/) y [Vite](https://vite.dev/).
- API: [NestJS](https://nestjs.com/) y TypeScript.
- Tests: [Vitest](https://vitest.dev/), con jsdom y Testing Library en la web.
- Calidad: [ESLint](https://eslint.org/) y [Prettier](https://prettier.io/) desde la raíz, y GitHub Actions en cada pull request.

## Estructura

```text
.
├── .github/workflows/  # Integración continua
├── apps/
│   ├── api/            # @bingogoals/api: API con NestJS
│   └── web/            # @bingogoals/web: aplicación React + Vite
├── docs/
│   └── roadmap.md      # Fases del proyecto
├── scripts/            # Utilidades de desarrollo
├── package.json        # Raíz privada con los workspaces
└── package-lock.json   # Único lockfile del monorepo
```

## Comandos

Todos se ejecutan desde la raíz del repositorio.

| Comando                | Qué hace                                                                 |
| ---------------------- | ------------------------------------------------------------------------ |
| `npm install`          | Instala las dependencias de todos los workspaces.                        |
| `npm run dev`          | Arranca la web (http://localhost:5173) y la API (http://localhost:3000). |
| `npm run lint`         | Analiza el código con ESLint.                                            |
| `npm run format`       | Da formato a todo el repositorio con Prettier.                           |
| `npm run format:check` | Comprueba el formato sin modificar archivos.                             |
| `npm run typecheck`    | Comprueba los tipos de los dos workspaces.                               |
| `npm run test`         | Ejecuta los tests de los dos workspaces.                                 |
| `npm run build`        | Compila los dos workspaces.                                              |

La API expone un endpoint de estado en `GET /health`, que responde `{"status":"ok"}`. El puerto se cambia con la variable de entorno `PORT`.

## Contribuir

El flujo de ramas, el formato de los commits y las comprobaciones de calidad están en [CONTRIBUTING.md](CONTRIBUTING.md). La planificación está en [docs/roadmap.md](docs/roadmap.md).

## Licencia

[MIT](LICENSE)
