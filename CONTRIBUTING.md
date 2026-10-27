# Cómo contribuir

## Preparación

Hace falta Node.js 24 (la versión está en `.nvmrc`) y npm.

```bash
nvm use
npm install
```

## Flujo de ramas

- Ninguna rama se crea sin aprobación previa.
- El trabajo de cada Issue va en una rama `feature/issue<número>`. Por ejemplo, `feature/issue0`.
- Las correcciones van en una rama `bugfix/<descripción>`. Por ejemplo, `bugfix/health-endpoint`.
- Los cambios llegan a las ramas compartidas mediante pull request, con la integración continua en verde.

- La rama se crea desde `develop` antes de empezar a trabajar, y se borra al fusionar su pull request.
- `main` solo recibe `develop` al cerrar cada fase.

## Formato de los commits

El mensaje empieza con el nombre de la rama, seguido de dos puntos y de lo que se hizo:

```text
feature/issue0: añade el workspace de la API
bugfix/health-endpoint: corrige el código de estado
```

Los mensajes no llevan líneas de coautoría ni pies añadidos por herramientas.

## Issues y pull requests

- Cada trabajo empieza con una issue creada con la plantilla de `.github/ISSUE_TEMPLATE/issue.md`: Resumen, Entregables, Dependencias, Decisiones técnicas, Flujo de trabajo, Verificación, Criterios de aceptación y Fuera de alcance.
- Las issues del roadmap se titulan por su lugar en él («Issue #8 — …»); las demás llevan letra: F para el cierre de una fase y M para el mantenimiento. Ver `docs/roadmap.md`.
- El pull request sigue la plantilla de `.github/pull_request_template.md` y enlaza su issue con `Closes #<número de GitHub>`.
- Al cerrar una issue se documenta en un comentario de cierre: qué se entregó, dependencias, decisiones, verificación con su salida real, estado del remoto tras la fusión y criterios de aceptación marcados.
- Toda issue queda asignada a su responsable.

## Comprobaciones de calidad

Antes de abrir un pull request, estos comandos deben terminar sin errores desde la raíz:

```bash
npm run lint
npm run format:check
npm run typecheck
npm run test
npm run build
```

`npm run format` corrige el formato automáticamente.

Si el cambio toca la API o la base de datos, ejecuta también los tests de integración, con PostgreSQL en marcha (`npm run db:up` y `npm run db:migrate`):

```bash
npm run test:integration
```

Si toca la web, ejecuta también la prueba de humo, que abre la versión compilada en un navegador real:

```bash
npm run test:e2e
```

La integración continua ejecuta todas estas comprobaciones en cada pull request.

## Dependencias

- Solo se añaden dependencias de código abierto y gratuitas.
- Se instalan desde la raíz, indicando el workspace: `npm install <paquete> --workspace @bingogoals/web`.
- Hay un único `package-lock.json`, en la raíz. No se crean lockfiles dentro de `apps/`.
