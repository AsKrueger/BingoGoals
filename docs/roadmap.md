# Hoja de ruta

BingoGoals se reconstruye en cinco fases. El prototipo Flutter, archivado en la etiqueta `flutter-prototype-final`, es la referencia de diseño y de reglas del juego durante todo el proceso.

Cada fase termina con una revisión de código, en `docs/reviews/`, y con la fusión de `develop` en `main`.

Estado: ✅ hecha · 🔄 en curso · ⏳ pendiente. Las fechas son las del plan inicial y están pendientes de reevaluar.

## Fase 0 · Base del monorepo ✅

- ✅ Issue #0 · Base del monorepo: archivo del prototipo Flutter, scaffolds y calidad de código

## Fase 1 · App web en React ✅

Plan inicial: 19 oct–8 nov.

- ✅ Issue #1 · Modelo y reglas del bingo
- ✅ Issue #2 · Tablero y edición de casilla
- ✅ Issue #3 · Creación, colección y temas
- ✅ Issue #4 · Historial, estadísticas y ajustes
- ✅ Issue #5 · Guardado local y web instalable
- ✅ Issue F1 · Cierre de la fase 1: revisión de código y correcciones ([informe](reviews/fase-1.md))

## Fase 2 · Backend y cuentas 🔄

Plan inicial: 9–29 nov.

- ✅ Issue #6 · Base de datos y dominio compartido
- ✅ Issue #7 · Cuentas
- ✅ Issue M1 · Mantenimiento: limpieza del repositorio y dependencias
- ✅ Issue #8 · API de tableros y sincronización
- ✅ Issue #9 · Fotos de las casillas
- ⏳ Issue #10 · Despliegue

## Fase 3 · IA ⏳

Plan inicial: 30 nov–13 dic.

- ⏳ Issue #11 · IA de lenguaje
- ⏳ Issue #12 · IA de voz
- ⏳ Issue #13 · IA de visión
- ⏳ Issue #14 · Límites de uso

## Fase 4 · Móvil y lanzamiento ⏳

Plan inicial: 14–31 dic.

- ⏳ Issue #15 · App Android con Capacitor
- ⏳ Issue #16 · Beta cerrada
- ⏳ Issue #17 · Lanzamiento

## MVP

El MVP es lo mínimo para que alguien de fuera use BingoGoals: la fase 1, las cuentas y las Issues #8 (sincronización), #9 (fotos) y #10 (despliegue). La IA y la app Android llegan después.

## Numeración

Las issues se nombran por su lugar en el roadmap («Issue #8»), que no coincide con el número que les da GitHub. Las que no son del roadmap llevan letra: F para el cierre de una fase y M para el mantenimiento.
