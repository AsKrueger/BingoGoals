const DATE_FORMAT = new Intl.DateTimeFormat('es-ES', { dateStyle: 'long' });

/** Fecha en español a partir de una cadena ISO 8601: «11 de octubre de 2026». */
export function formatDate(iso: string): string {
  return DATE_FORMAT.format(new Date(iso));
}
