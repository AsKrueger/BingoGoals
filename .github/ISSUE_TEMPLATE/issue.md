---
name: Issue
about: Una tarea del roadmap, una corrección o un mantenimiento
title: 'Issue #N — '
assignees: AsKrueger
---

## Resumen

<!-- Qué cambia para el usuario o para el proyecto, en un párrafo. -->

## Entregables

-

## Dependencias

<!-- Paquetes añadidos, actualizados o retirados, o «Ninguna dependencia nueva prevista». -->

| Cambio | Paquete | Ámbito |
| ------ | ------- | ------ |
|        |         |        |

## Decisiones técnicas

- **Decisión.** Motivo.

## Flujo de trabajo

- Rama `feature/issueN` (o `bugfix/<descripción>`), creada desde `develop` por Alonso antes de empezar.
- Commits: `feature/issueN: <lo que se hizo>`, hechos por Alonso.
- Pull request hacia `develop`.

## Verificación

Salida esperada al cerrar la Issue:

```text
npm run lint               exit 0
npm run format:check       All matched files use Prettier code style!
npm run typecheck          exit 0
npm run test               dominio, api y web en verde
npm run build              exit 0
npm run test:integration   api en verde contra PostgreSQL
prueba de humo             en verde en local y en la CI
```

Salida pendiente de adjuntar tras la fusión:

```text
git status
git log --oneline
```

## Criterios de aceptación

- [ ] Rama creada desde `develop` antes de empezar.
- [ ] `lint`, `format:check`, `typecheck`, `test` y `build` sin errores.
- [ ] Integración continua en verde en el pull request.
- [ ] Todos los commits con el formato de la rama.
- [ ] Pull request fusionado en `develop`.
- [ ] Worktree limpio.

## Fuera de alcance

-
