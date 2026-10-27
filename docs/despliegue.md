# Despliegue

BingoGoals se publica en tres servicios gratuitos:

| Pieza         | Dónde                 | Dirección                                         |
| ------------- | --------------------- | ------------------------------------------------- |
| Web           | GitHub Pages          | https://askrueger.github.io/BingoGoals/           |
| API           | Render, plan gratuito | La que asigne Render al servicio `bingogoals-api` |
| Base de datos | Neon, plan gratuito   | Solo la usa la API                                |

`main` es la rama que se publica; `develop` no despliega nada.

## Cómo se publica una versión

1. Se fusiona `develop` en `main`.
2. La CI se ejecuta sobre `main`.
3. Si pasa, el flujo **Despliegue** (`.github/workflows/deploy.yml`) hace dos cosas a la vez:
   - **Web:** la compila con `VITE_API_URL` apuntando a la API publicada y la sube a GitHub Pages.
   - **API:** pide a Render, con su gancho de despliegue, que despliegue ese commit exacto. Render construye la imagen con `apps/api/Dockerfile`; al arrancar, la API aplica las migraciones pendientes y después acepta peticiones. El flujo espera a que `GET /health` responda `ok` con el commit nuevo en `version`.
4. Quien tenga la web abierta ve el aviso «Hay una versión nueva de BingoGoals».

Si la CI falla, no se despliega nada. Render no despliega por su cuenta (`autoDeployTrigger: off` en `render.yaml`): solo cuando se lo pide este flujo.

## Puesta en marcha (una sola vez)

### 1. Base de datos en Neon

1. En [neon.tech](https://neon.tech), crea un proyecto con PostgreSQL 17 en la región **AWS Europe Central 1 (Frankfurt)**, la misma que la API.
2. En **Connect**, copia la cadena de conexión **directa**: con el selector de pooling desactivado, sin `-pooler` en el host. Las migraciones de Prisma necesitan la conexión directa.
3. No la guardes en ningún archivo del repositorio. Solo va en Render.

### 2. API en Render

1. En [render.com](https://render.com), entra con la cuenta de GitHub y da acceso al repositorio.
2. **New > Blueprint**, elige el repositorio y la rama `main`. Render lee `render.yaml` y propone el servicio `bingogoals-api`.
3. Cuando pida `DATABASE_URL`, pega la cadena de Neon.
4. Crea el servicio. El primer despliegue aplica todas las migraciones sobre la base de datos vacía.
5. Copia la dirección del servicio, del tipo `https://bingogoals-api.onrender.com`, y comprueba `https://…/health`: debe responder `{"status":"ok","database":"ok",…}`.
6. En **Settings > Deploy Hook**, copia la dirección del gancho. Es un secreto: quien la tenga puede desplegar.

### 3. GitHub

En el repositorio, en **Settings**:

1. **Pages > Build and deployment > Source:** GitHub Actions.
2. **Secrets and variables > Actions > Variables:** crea `API_URL` con la dirección de la API, sin barra final.
3. **Secrets and variables > Actions > Secrets:** crea `RENDER_DEPLOY_HOOK_URL` con la dirección del gancho.

El flujo de despliegue solo se activa desde `main`, y se omite mientras no exista `API_URL`. Como Render necesita `render.yaml` en `main` para crear el servicio, el orden es:

1. Fusionar en `main`. El despliegue se omite.
2. Crear la base de datos y el servicio de Render (pasos 1 y 2).
3. Configurar GitHub (este paso).
4. Lanzar a mano **Actions > Despliegue > Run workflow**, sin commit: publica el último de `main`.

## Variables de entorno de producción

| Variable                 | Dónde             | Valor                                                            |
| ------------------------ | ----------------- | ---------------------------------------------------------------- |
| `DATABASE_URL`           | Render (secreto)  | Cadena de conexión directa de Neon.                              |
| `CORS_ORIGINS`           | `render.yaml`     | `https://askrueger.github.io`: el origen de la web, sin la ruta. |
| `TRUST_PROXY`            | `render.yaml`     | `1`: saltos de proxy de Render delante de la API.                |
| `PORT`                   | Render            | Lo pone Render; la API lo lee.                                   |
| `RENDER_GIT_COMMIT`      | Render            | Lo pone Render; `GET /health` lo devuelve en `version`.          |
| `API_URL`                | GitHub (variable) | Dirección de la API; se compila en la web como `VITE_API_URL`.   |
| `RENDER_DEPLOY_HOOK_URL` | GitHub (secreto)  | Gancho de despliegue de Render.                                  |

Ningún secreto va en el repositorio. Si alguno se filtra, se cambia en su proveedor: en Neon, **Reset password**; en Render, **Regenerate** junto al gancho. Después se actualiza donde se usa.

## Comprobaciones tras el primer despliegue

- `GET /health` en producción responde `{"status":"ok","database":"ok","version":"<commit>"}`.
- La web publicada carga, se instala y funciona sin conexión.
- Registrarse, iniciar sesión y crear un tablero en el móvil hace que aparezca en el ordenador con la misma cuenta.
- Con la API dormida, la web funciona y sincroniza cuando despierta.
- **IP real detrás del proxy.** El límite de intentos tiene que contar la IP de cada cliente, no la del proxy, y no dejarse engañar por una cabecera inventada. Desde tu equipo, prueba once registros con un `X-Forwarded-For` distinto cada vez:

  ```bash
  for i in $(seq 1 11); do
    curl -s -o /dev/null -w "%{http_code}\n" -X POST "$API_URL/auth/register" \
      -H 'Content-Type: application/json' -H "X-Forwarded-For: 198.51.100.$i" -d '{}'
  done
  ```

  Tienen que salir diez `400` y un `429`. Después, desde otra red (por ejemplo, el móvil sin wifi), un registro tiene que responder `400`, no `429`. Si la cabecera inventada salta el límite, hay más proxies de los que dice `TRUST_PROXY`; si otra red también recibe `429`, hay menos. Se corrige en `render.yaml`.

## Volver a una versión anterior

### Web y API a la vez

En **Actions > Despliegue > Run workflow**, escribe el commit de la última versión buena y lánzalo. Se publican la web y la API de ese commit. `main` no cambia: corrige el fallo después con un pull request normal.

### Solo la API

En el panel de Render, **Events**, busca el último despliegue bueno y elige **Rollback**.

### Las migraciones no se deshacen

Prisma solo aplica migraciones hacia delante. Volver a una versión anterior de la API no deshace las migraciones de la versión nueva. Por eso, una migración no debe borrar ni renombrar nada que la versión anterior siga usando. Si hay que deshacer un cambio de esquema, se hace con una migración nueva.

### Base de datos

Neon guarda un historial de cambios. Para recuperar los datos de un momento anterior:

1. En Neon, **Branches > Restore**, elige la rama principal y el momento.
2. Neon guarda el estado actual en una rama de respaldo antes de restaurar.

El plan gratuito solo guarda unas horas de historial: el panel de Neon indica cuántas. Pasado ese margen no se puede restaurar.

## Límites del plan gratuito

- **Render** duerme la API tras 15 minutos sin peticiones. La siguiente petición tarda hasta un minuto en despertarla. La web lo muestra como «Conectando con el servidor» y sigue funcionando.
- **Neon** suspende la base de datos sin uso y la despierta en la siguiente consulta, en menos de un segundo. El plan gratuito tiene un límite de almacenamiento: las fotos son lo que más ocupa.
- **GitHub Pages** no permite cabeceras propias. La política de seguridad de contenido de la web va como etiqueta `<meta>`, que no puede impedir que otra página la muestre dentro de un marco.
