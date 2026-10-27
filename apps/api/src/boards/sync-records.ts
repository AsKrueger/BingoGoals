import {
  isBingoBoard,
  isDateString,
  isRecord,
  isValidTitle,
  type BingoBoard,
} from '@bingogoals/domain';

/**
 * Un tablero tal como viaja entre la API y los dispositivos: el tablero del
 * dominio con su fecha de archivo y, si se borró, su fecha de borrado.
 */
export interface BoardRecord {
  readonly board: BingoBoard;
  readonly archivedAt: string | null;
  readonly deletedAt: string | null;
}

/** Cuánto se admite que el reloj de un dispositivo vaya adelantado. */
export const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

export type ParseResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly message: string };

function isNullableDate(value: unknown): value is string | null {
  return value === null || isDateString(value);
}

/** Una fecha no puede ir por delante del reloj del servidor más del margen. */
function isTooFarAhead(date: string, now: Date): boolean {
  return Date.parse(date) > now.getTime() + MAX_CLOCK_SKEW_MS;
}

/** Valida el cuerpo de `PUT /boards/:id`. */
export function parseBoardUpload(
  id: string,
  body: unknown,
  now: Date = new Date(),
): ParseResult<{ board: BingoBoard; archivedAt: string | null }> {
  if (!isRecord(body) || !isBingoBoard(body.board)) {
    return { ok: false, message: 'El tablero no es válido.' };
  }
  const { board } = body;
  const archivedAt = body.archivedAt ?? null;
  if (board.id !== id) {
    return {
      ok: false,
      message: 'El identificador del tablero no coincide con la dirección.',
    };
  }
  if (!isValidTitle(board.title)) {
    return {
      ok: false,
      message: 'El título no puede estar vacío ni tener más de 40 caracteres.',
    };
  }
  if (!isNullableDate(archivedAt)) {
    return { ok: false, message: 'La fecha de archivo no es válida.' };
  }
  if (
    isTooFarAhead(board.updatedAt, now) ||
    isTooFarAhead(board.createdAt, now) ||
    (archivedAt !== null && isTooFarAhead(archivedAt, now))
  ) {
    return {
      ok: false,
      message:
        'Las fechas del tablero van por delante de la hora del servidor. Revisa la hora del dispositivo.',
    };
  }
  return { ok: true, value: { board, archivedAt } };
}

/** Valida la fecha de borrado de `DELETE /boards/:id?deletedAt=…`. */
export function parseDeletion(
  deletedAt: unknown,
  now: Date = new Date(),
): ParseResult<string> {
  if (!isDateString(deletedAt)) {
    return { ok: false, message: 'Falta la fecha de borrado.' };
  }
  if (isTooFarAhead(deletedAt, now)) {
    return {
      ok: false,
      message:
        'La fecha de borrado va por delante de la hora del servidor. Revisa la hora del dispositivo.',
    };
  }
  return { ok: true, value: new Date(deletedAt).toISOString() };
}

/** Valida `since` de `GET /boards?since=…`; sin él se piden todos. */
export function parseSince(since: unknown): ParseResult<Date | null> {
  if (since === undefined || since === '') {
    return { ok: true, value: null };
  }
  if (!isDateString(since)) {
    return { ok: false, message: 'La fecha «since» no es válida.' };
  }
  return { ok: true, value: new Date(since) };
}
