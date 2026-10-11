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

## Formato de los commits

El mensaje empieza con el nombre de la rama, seguido de dos puntos y de lo que se hizo:

```text
feature/issue0: añade el workspace de la API
bugfix/health-endpoint: corrige el código de estado
```

## Comprobaciones de calidad

Antes de abrir un pull request, estos comandos deben terminar sin errores desde la raíz:

```bash
npm run lint
npm run format:check
npm run typecheck
npm run test
npm run build
```

`npm run format` corrige el formato automáticamente. La integración continua ejecuta las mismas comprobaciones en cada pull request.

## Dependencias

- Solo se añaden dependencias de código abierto y gratuitas.
- Se instalan desde la raíz, indicando el workspace: `npm install <paquete> --workspace @bingogoals/web`.
- Hay un único `package-lock.json`, en la raíz. No se crean lockfiles dentro de `apps/`.
