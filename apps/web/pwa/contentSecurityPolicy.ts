import type { Plugin } from 'vite';

/** La API a la que llama la web si no se indica otra con VITE_API_URL. */
export const DEFAULT_API_URL = 'http://localhost:3000';

/**
 * Política de seguridad de contenido de la web: solo ejecuta sus propios
 * scripts y solo se conecta consigo misma y con la API.
 *
 * - Las fotos se muestran como `blob:`; `data:` queda para imágenes pequeñas
 *   que Vite incrusta en el CSS.
 * - Los estilos de React (`style={...}`) se aplican desde JavaScript y no
 *   cuentan como estilos en línea.
 */
export function contentSecurityPolicy(apiUrl: string): string {
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' blob: data:",
    `connect-src 'self' ${new URL(apiUrl).origin}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

/**
 * Añade la política a index.html al compilar, como etiqueta `<meta>`: GitHub
 * Pages no permite cabeceras propias. Con `<meta>` no se puede impedir que
 * otra página muestre la web dentro de un marco (`frame-ancestors`).
 *
 * Solo al compilar: el servidor de desarrollo necesita scripts en línea.
 */
export function contentSecurityPolicyPlugin(): Plugin {
  let apiUrl = DEFAULT_API_URL;

  return {
    name: 'bingogoals-content-security-policy',
    apply: 'build',
    configResolved(config) {
      apiUrl = config.env.VITE_API_URL || DEFAULT_API_URL;
    },
    transformIndexHtml() {
      return [
        {
          tag: 'meta',
          attrs: {
            'http-equiv': 'Content-Security-Policy',
            content: contentSecurityPolicy(apiUrl),
          },
          injectTo: 'head-prepend',
        },
      ];
    },
  };
}
