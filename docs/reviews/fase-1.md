# Revisión de código de la fase 1

Revisión de todo `apps/web/` tal como estaba en `develop` (`3130131`) al terminar la fase 1, hecha el 11 de octubre de 2026 en la rama `bugfix/revision-fase1`.

## Resumen

- Los ocho hallazgos de partida están **confirmados**; ninguno se descarta.
- La revisión añade **veinte hallazgos nuevos**: cuatro de gravedad media y dieciséis de gravedad baja.
- En esta rama se corrigen **seis**: los hallazgos 1, 2, 5 y 7 de partida, y los nuevos 9 y 10.
- Los demás quedan asignados a una issue futura o a la reevaluación del roadmap.
- No cambia el formato de los datos guardados ni se añade ninguna función. El único cambio visible es el aviso de datos ilegibles.

Lo más importante que deja esta revisión para las fases siguientes: hasta que existan cuentas y sincronización, el dispositivo guarda la única copia de los datos, y hay dos formas de perderla que no se corrigen aquí (hallazgos 11 y 12).

## Cómo se revisó

- Lectura completa del código: unas 6.300 líneas de TypeScript, de las que 3.300 son tests, y 1.500 de CSS.
- Los hallazgos 1 y 2 se reprodujeron con tests antes de corregirlos: ocho tests fallaban con el código de `3130131` y pasan con las correcciones.
- Las correcciones se comprobaron además en Chrome real, manejado con un script: con `npm run dev` para el foco y sobre la versión compilada para los datos ilegibles, el manifiesto y los iconos.
- La instalación real en escritorio y en Android no se puede comprobar con un script; queda pendiente de Alonso.

## Hallazgos de partida

| #   | Gravedad            | Hallazgo                                                                                   | Estado     | Decisión                           |
| --- | ------------------- | ------------------------------------------------------------------------------------------ | ---------- | ---------------------------------- |
| 1   | Alta                | Datos ilegibles arrancan la web vacía sin aviso, y el primer cambio los sobrescribe        | Confirmado | Corregido aquí                     |
| 2   | Media               | Con `npm run dev` los diálogos abren con el foco fuera y Escape no los cierra              | Confirmado | Corregido aquí                     |
| 3   | Alta para la fase 2 | Todo el estado va en un único registro reescrito en cada cambio, con las fotos incrustadas | Confirmado | Issues #6 y #9                     |
| 4   | Baja                | `primaryColor` y `fontFamily` del estilo no se usan                                        | Confirmado | Issue #6                           |
| 5   | Baja                | `imagePath` acepta cualquier cadena al validar                                             | Confirmado | Corregido aquí                     |
| 6   | Baja                | El service worker se registraría dentro de Capacitor; `index.html` usa rutas absolutas     | Confirmado | Issue #15                          |
| 7   | Baja                | Los iconos de 512 px pesan 320 KB y 189 KB                                                 | Confirmado | Corregido aquí                     |
| 8   | Proceso             | Ningún test usa un navegador real                                                          | Confirmado | Reevaluación del roadmap (ver #22) |

### 1. Datos ilegibles — corregido

**Qué pasaba.** `parseStoredData` devolvía `null` tanto si no había registro como si el registro estaba corrupto o era de otra versión, y `AppLoader` trataba los dos casos igual: arrancar vacía. El usuario veía la bienvenida como si nunca hubiera usado la web, y al crear su primer tablero el guardado sustituía el registro anterior. El caso más probable no es la corrupción, sino abrir una versión antigua de la web (por ejemplo, una pestaña que lleva días abierta) sobre datos guardados por una más nueva.

**Qué se ha hecho.**

- `BoardStorage.load()` devuelve ahora uno de tres resultados: `empty`, `loaded` o `unreadable`.
- Con `unreadable`, la web arranca vacía pero muestra un aviso que explica que hay datos que no se pueden leer y que no se han borrado.
- `save()` comprueba, dentro de la misma transacción, si el registro que va a sustituir es ilegible. Si lo es, antes lo copia tal cual a una clave `unreadable-<fecha ISO>` del mismo almacén.
- La copia se hace una sola vez y no se borra nunca de forma automática. Abrir la web no modifica nada.

**Límite conocido.** La copia se conserva, pero todavía no hay forma de recuperarla desde la interfaz. Hacerlo sería una función nueva; se asigna a la Issue #8, donde se escribirán las migraciones de formato.

### 2. Foco de los diálogos — corregido

**Qué pasaba.** `Modal` devolvía el foco al botón que lo abrió en la limpieza de un efecto. El modo estricto de React, activo con `npm run dev`, monta, desmonta y vuelve a montar cada efecto: la limpieza se ejecutaba nada más abrir el diálogo y sacaba el foco. Como Escape y Tab se escuchan dentro del diálogo, dejaban de funcionar. En la versión compilada no ocurría.

**Qué se ha hecho.** Al montarse, el efecto comprueba que el foco esté dentro del diálogo y, si no, lo lleva al elemento que lo tenía, al primero enfocable o al propio diálogo.

**Por qué no se detectó.** Los tests renderizaban sin modo estricto, y la comprobación en navegador de la Issue #3 dio un falso positivo: comprobaba que el foco estaba en el botón tras pulsar Escape, y lo estaba porque nunca había salido de él. Los tests nuevos de `Modal.test.tsx` se ejecutan con y sin modo estricto.

### 3. Un único registro con las fotos incrustadas — Issues #6 y #9

Confirmado. Cada cambio, aunque sea marcar una casilla, reescribe todos los tableros, el historial y todas las fotos. Con las fotos reducidas a unos 85 KB funciona, pero el coste crece con cada foto y el formato no sirve para sincronizar: no se puede enviar a la API «ha cambiado esta casilla». La Issue #6 define el esquema por tablero y la Issue #9 saca las fotos a un almacén propio.

### 4. Campos de estilo sin uso — Issue #6

Confirmado. `primaryColor` y `fontFamily` vienen del prototipo; los colores salen hoy del tema y no hay tipografías por tablero. Solo aparecen en el tipo, en el estilo por defecto y en la validación. Quitarlos cambia el formato guardado, así que se hace al definir el esquema de la fase 2.

### 5. Validación de `imagePath` — corregido

Confirmado, y con más alcance del previsto: el valor se inserta en un `url("…")` de CSS en la casilla. Un registro manipulado podía hacer que la web pidiera una imagen a un servidor externo. Ahora solo se admite `null` o una URL de datos `data:image/(jpeg|png|webp|gif);base64,…` con caracteres de base64. Un registro que no lo cumpla se trata como ilegible, con su aviso y su copia.

### 6. Service worker y rutas absolutas en Capacitor — Issue #15

Confirmado. `registerServiceWorker` se activa en cualquier versión compilada con soporte de service worker, y `index.html` enlaza el manifiesto y los iconos desde la raíz (`/`). Dentro de Capacitor el service worker sobra y las rutas tienen que ser relativas.

### 7. Peso de los iconos — corregido

Los dos iconos de 512 px pasan a PNG de paleta, sin cambiar de tamaño ni de aspecto apreciable:

| Icono                   | Antes  | Después | Colores |
| ----------------------- | ------ | ------- | ------- |
| `icon-512.png`          | 320 KB | 87 KB   | 32      |
| `icon-maskable-512.png` | 189 KB | 61 KB   | 96      |

El icono adaptable necesita más colores: con 32, el amarillo de la marca de verificación viraba a naranja. Chrome sigue sin encontrar impedimentos para instalar la web.

### 8. Sin tests en navegador real — reevaluación del roadmap

Confirmado. Se trata junto con el hallazgo 22.

## Hallazgos nuevos

| #   | Área           | Gravedad | Hallazgo                                                                                      | Decisión                 |
| --- | -------------- | -------- | --------------------------------------------------------------------------------------------- | ------------------------ |
| 9   | Datos          | Media    | Dos guardados seguidos podían solaparse sin orden garantizado                                 | Corregido aquí           |
| 10  | Accesibilidad  | Baja     | Un diálogo sin `autoFocus` no recibía el foco al abrirse                                      | Corregido aquí           |
| 11  | Datos          | Media    | Con dos pestañas abiertas, la última que guarda pisa los cambios de la otra                   | Issue #8                 |
| 12  | Datos          | Media    | El navegador puede borrar los datos guardados y no hay otra copia                             | Issue #10                |
| 13  | Datos          | Baja     | La copia de un registro ilegible no se puede recuperar desde la interfaz                      | Issue #8                 |
| 14  | Datos          | Baja     | Si IndexedDB no responde, la pantalla de carga no termina nunca                               | Issue #8                 |
| 15  | Datos          | Baja     | No hay límite para el archivo de foto de entrada                                              | Issue #9                 |
| 16  | Corrección     | Baja     | `useBoards` calcula cada cambio a partir del estado del último render                         | Issue #8                 |
| 17  | Corrección     | Baja     | El dominio no valida los títulos; solo lo hace la interfaz                                    | Issue #8                 |
| 18  | Corrección     | Baja     | «Días desde su creación» cuenta periodos de 24 horas, no días naturales                       | Issue #16                |
| 19  | Accesibilidad  | Baja     | Con un diálogo abierto, el resto de la página no queda inerte ni se bloquea su desplazamiento | Issue #16                |
| 20  | Accesibilidad  | Baja     | La celebración de línea se cierra sola a los 4 segundos                                       | Issue #16                |
| 21  | Accesibilidad  | Baja     | `Modal` solo considera enfocables los botones y los campos de texto                           | Issue #7                 |
| 22  | Tests          | Media    | El service worker y su plugin no tienen ningún test automático                                | Reevaluación del roadmap |
| 23  | Sin conexión   | Baja     | El alojamiento debe servir `sw.js` sin caché larga                                            | Issue #10                |
| 24  | Seguridad      | Baja     | La web no declara una política de seguridad de contenido                                      | Issue #10                |
| 25  | Sin conexión   | Baja     | El manifiesto fija la orientación vertical                                                    | Issue #15                |
| 26  | Mantenibilidad | Baja     | `imagePath` contiene una URL de datos, no una ruta                                            | Issue #9                 |
| 27  | Mantenibilidad | Baja     | Los estilos de botón están repetidos en cuatro módulos de CSS                                 | Issue #7                 |
| 28  | Mantenibilidad | Baja     | `scripts/parallel.mjs` puede dejar procesos huérfanos en Windows (sin verificar)              | Issue #6                 |

### 9. Carrera al guardar — corregido

Cada cambio lanzaba un guardado independiente, con su propia conexión a IndexedDB, sin esperar al anterior. El orden en que terminaban no estaba garantizado por el código: si el más antiguo acababa el último, quedaba guardado el estado viejo hasta el siguiente cambio. Ahora `createSaveQueue` guarda de uno en uno y, de los que esperan, solo el último, que es el que contiene el estado actual. No se observó el fallo en la práctica; se corrige porque el coste es pequeño y la consecuencia es perder un cambio sin aviso.

### 10. Diálogo sin `autoFocus` — corregido

Si un diálogo no marcaba ningún elemento con `autoFocus`, el foco se quedaba en la página de detrás, también en la versión compilada. Hoy todos los diálogos lo marcan, así que no afectaba a nadie; quedó corregido con el mismo cambio del hallazgo 2.

### 11. Dos pestañas abiertas — Issue #8

Cada pestaña carga todo el estado al abrirse y lo reescribe entero en cada cambio. Con dos pestañas abiertas, o con la app instalada y una pestaña del navegador, la segunda no ve lo que hace la primera y, al guardar, lo pisa. Se pueden perder tableros enteros. La solución de fondo es la misma que pide la sincronización: guardar por tablero y detectar cambios ajenos. No se parchea aquí porque cualquier arreglo parcial se desharía en la Issue #8, y la web aún no está publicada.

### 12. El navegador puede borrar los datos — Issue #10

IndexedDB no es permanente. El navegador puede vaciarlo si el dispositivo se queda sin espacio, y Safari borra los datos de las webs no instaladas tras siete días sin uso. La web no pide almacenamiento persistente (`navigator.storage.persist()`) ni avisa de este riesgo. Hasta que las cuentas (Issue #7) y la sincronización (Issue #8) den una copia en el servidor, esta es la única. Se asigna a la Issue #10 porque es el momento en que la web se publica y el riesgo pasa a ser real.

### 13 a 28. Resto de hallazgos

- **13.** Ver el límite conocido del hallazgo 1.
- **14.** `AppLoader` espera a `storage.load()` sin tiempo límite. Si la base de datos queda bloqueada sin dar error, el usuario ve «Cargando tus tableros…» para siempre.
- **15.** Una imagen muy grande puede agotar la memoria al decodificarse, antes de reducirla. Conviene rechazar archivos por encima de un tamaño.
- **16.** Dos acciones en el mismo ciclo de render perderían la primera. Hoy no ocurre, porque cada acción responde a un evento distinto; la sincronización añadirá cambios que llegan del servidor, y entonces sí importará.
- **17.** `createBoard` y `renameBoard` aceptan un título vacío o de cualquier longitud. Cuando la API reutilice el dominio, la validación tiene que estar en él y no solo en el formulario.
- **18.** Un tablero creado a las 23:00 marca «0 días» a la 1:00 del día siguiente. Está documentado y probado así; se revisa si confunde en la beta.
- **19.** El diálogo declara `aria-modal`, pero un lector de pantalla puede seguir leyendo la página de detrás, y la página se puede desplazar con el diálogo abierto.
- **20.** Quien necesite más tiempo para leer la celebración de línea no lo tiene. Además, su temporizador se reinicia si `App` se vuelve a renderizar.
- **21.** Un diálogo con un desplegable, un área de texto o un enlace dejaría escapar el foco con Tab. El primero previsible es el formulario de cuenta.
- **22.** `pwa/sw.js` y `pwa/serviceWorkerPlugin.ts` solo se han probado a mano con un script. Tampoco tienen test directo `registerServiceWorker` ni la comprobación de que nada se desborda a 360 px. Es el mismo problema que el hallazgo 8.
- **23.** Si `sw.js` se sirve con caché larga, los usuarios tardan en recibir versiones nuevas.
- **24.** Una política de seguridad de contenido limitaría el daño de un fallo como el del hallazgo 5.
- **25.** `orientation: portrait` impide girar la app instalada en una tableta Android.
- **26.** El nombre viene del prototipo, donde sí era una ruta de archivo.
- **27.** Los botones con forma de píldora se definen por separado en `BoardScreen`, `CreateScreen`, `SettingsScreen` y `WelcomeScreen`. Conviene un componente `Button` antes de añadir más pantallas.
- **28.** Con `shell: true`, `kill()` termina el intérprete de órdenes y no necesariamente sus hijos. No se ha comprobado qué ocurre al cerrar `npm run dev` con Ctrl+C en Windows.

## Lo que se revisó y está bien

- **Dominio:** todas las funciones son puras e inmutables, con tests en 3×3 y 5×5. No se encontraron estados imposibles alcanzables desde la interfaz.
- **Validación al cargar:** tamaño, número de casillas, tema, fechas y tablero activo se comprueban antes de usar los datos.
- **Texto del usuario:** títulos y textos de casilla se muestran siempre a través de React, que los escapa.
- **Contraste:** un test lee los colores de `themes.css` y exige 4,5:1 en los seis temas.
- **Teclado:** todas las acciones son botones o campos nativos, con nombre accesible; el foco pasa al título al cambiar de pantalla.
- **Código sin uso:** no hay ninguna exportación sin uso en el código de producción, más allá de los campos del hallazgo 4.
- **Actualización de versiones:** una versión nueva espera a que el usuario la acepte y, al aplicarla, se borra la caché anterior.

## Preparación para la fase 2

Lo que habrá que cambiar para sincronizar con la API, ordenado por dependencia:

1. **Mover el dominio a un paquete compartido.** Hoy vive en `apps/web/src/domain`; la API tiene que usar las mismas reglas y la misma validación (hallazgo 17).
2. **Guardar por tablero, no todo junto.** Lo exigen la sincronización, las dos pestañas y el tamaño de los datos (hallazgos 3 y 11).
3. **Añadir fecha de modificación a cada tablero.** Sin ella no se puede decidir qué versión gana cuando hay dos.
4. **Sacar las fotos del tablero** a un almacén propio, referenciadas por identificador (hallazgos 3 y 26).
5. **Ampliar `BoardStorage`.** La interfaz actual solo sabe cargar y guardar todo; hará falta crear, cambiar y borrar un tablero, y recibir cambios ajenos (hallazgo 16).
6. **Escribir la primera migración de formato,** de la versión 1 a la 2, y con ella la recuperación de las copias ilegibles (hallazgo 13).

Lo que ya está preparado: los identificadores son UUID generados en el cliente, las fechas son ISO 8601, los datos llevan número de versión y ninguna pantalla conoce IndexedDB.

## Verificación

```text
npm run lint            exit 0
npm run format:check    All matched files use Prettier code style!
npm run typecheck       exit 0
npm run test            api: 1 test · web: 330 tests, todos en verde
npm run build           exit 0
npm audit               found 0 vulnerabilities
```

Tests que fallaban con el código de `3130131` y pasan con las correcciones:

```text
Modal (con modo estricto) › al abrirse, el foco entra en el elemento con autoFocus
Modal (con modo estricto) › sin autoFocus, el foco entra en el primer elemento del diálogo
Modal (con modo estricto) › Escape lo cierra desde el elemento enfocado
Modal (sin modo estricto) › sin autoFocus, el foco entra en el primer elemento del diálogo
IndexedDB › guardar sobre un registro corrupto conserva una copia
IndexedDB › guardar sobre un registro de una versión más nueva conserva una copia
carga inicial › con datos corruptos avisa de que no se pueden leer
carga inicial › con datos de una versión más nueva avisa de que no se pueden leer
```

Comprobación en Chrome real:

| Comprobación                        | Resultado                                                                                     |
| ----------------------------------- | --------------------------------------------------------------------------------------------- |
| Abrir un diálogo con `npm run dev`  | El foco entra en el diálogo; Tab no sale de él; Escape lo cierra y el foco vuelve a su origen |
| Guardar a mano un registro inválido | La web avisa; el registro no se toca, tampoco al recargar                                     |
| Cambiar algo tras ese aviso         | El registro ilegible queda copiado, idéntico, en `unreadable-<fecha>`; solo se copia una vez  |
| Manifiesto e iconos optimizados     | Sin errores; Chrome no encuentra impedimentos para instalar                                   |
| Instalar la web en escritorio       | Pendiente de Alonso                                                                           |
| Instalar la web en un Android       | Pendiente de Alonso                                                                           |

La comprobación del foco cubrió el selector de tema, la edición de casilla, la confirmación de borrado y la celebración.

## Pendiente

- Instalar la web en escritorio y en un Android, y comprobar que se abre en ventana propia con su icono.
- Decidir, en la reevaluación del roadmap, si se añade una prueba de humo con navegador a la integración continua (hallazgos 8 y 22).
- Tener en cuenta los hallazgos 11 y 12 al fijar las fechas de las Issues #8 y #10: son los dos que pueden hacer perder datos a un usuario real.

## Seguimiento

Estado de los hallazgos no corregidos en esta revisión, actualizado en la Issue M1 (27 de octubre de 2026).

| #   | Hallazgo                                               | Estado                                                                                                                                            |
| --- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3   | Un único registro con las fotos incrustadas            | En parte: la base de datos ya guarda por tablero (#6). El dispositivo pasa a guardar por tablero en la #8 y las fotos salen del tablero en la #9. |
| 4   | Campos de estilo sin uso                               | Resuelto en la #6: el estilo solo guarda el tema y los datos pasan a la versión 2.                                                                |
| 6   | Service worker y rutas absolutas en Capacitor          | Pendiente: #15.                                                                                                                                   |
| 8   | Sin tests en navegador real                            | Resuelto en la #6: prueba de humo con Playwright en la CI.                                                                                        |
| 11  | Dos pestañas abiertas se pisan                         | Pendiente: entregable de la #8.                                                                                                                   |
| 12  | El navegador puede borrar los datos                    | Pendiente: #10.                                                                                                                                   |
| 13  | Las copias ilegibles no se recuperan desde la interfaz | Pendiente: entregable de la #8.                                                                                                                   |
| 14  | La carga inicial no tiene tiempo límite                | Pendiente: entregable de la #8.                                                                                                                   |
| 15  | Sin límite para el archivo de foto                     | Pendiente: #9.                                                                                                                                    |
| 16  | `useBoards` parte del estado del último render         | Pendiente: entregable de la #8.                                                                                                                   |
| 17  | El dominio no valida los títulos                       | En parte: el dominio compartido valida los tableros desde la #6; los títulos, en la #8.                                                           |
| 18  | «Días desde su creación» cuenta periodos de 24 horas   | Pendiente: #16.                                                                                                                                   |
| 19  | La página no queda inerte detrás de un diálogo         | Pendiente: #16.                                                                                                                                   |
| 20  | La celebración de línea se cierra sola                 | Pendiente: #16.                                                                                                                                   |
| 21  | `Modal` solo enfocaba botones y campos de texto        | Resuelto en la #7.                                                                                                                                |
| 22  | El service worker no tenía tests automáticos           | Resuelto en la #6: la prueba de humo abre la web sin conexión. Encontró un fallo de la caché con `Vary: Origin`, corregido allí.                  |
| 23  | `sw.js` necesita servirse sin caché larga              | Pendiente: #10.                                                                                                                                   |
| 24  | Sin política de seguridad de contenido                 | Pendiente: #10.                                                                                                                                   |
| 25  | El manifiesto fija la orientación vertical             | Pendiente: #15.                                                                                                                                   |
| 26  | `imagePath` contiene una URL de datos                  | Pendiente: #9.                                                                                                                                    |
| 27  | Estilos de botón repetidos                             | Resuelto en la #7: componente `Button`.                                                                                                           |
| 28  | `scripts/parallel.mjs` podía dejar procesos huérfanos  | Resuelto en la #6: detiene el árbol de procesos; comprobado con Ctrl+C en Windows.                                                                |
