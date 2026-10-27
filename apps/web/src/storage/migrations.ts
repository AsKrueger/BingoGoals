import { isRecord } from '@bingogoals/domain';

// Cada paso lleva un registro de una versión a la siguiente. Trabajan sobre
// datos sin validar, así que no dan nada por supuesto: lo que no tenga la
// forma esperada se deja como está y lo rechazará la validación posterior.

/**
 * Lleva un registro guardado hasta la versión actual, paso a paso. Uno que ya
 * es actual, o de una versión que no se sabe migrar, se devuelve tal cual.
 */
export function migrateStoredData(raw: unknown): unknown {
  let current = raw;
  if (isRecord(current) && current.version === 1) {
    current = migrateV1ToV2(current);
  }
  return current;
}

/**
 * Versión 2: el estilo conserva solo el tema (`primaryColor` y `fontFamily`
 * nunca se usaron) y cada tablero lleva `updatedAt`, que empieza igual que
 * `createdAt` porque la versión 1 no anotaba los cambios.
 */
function migrateV1ToV2(raw: Record<string, unknown>): unknown {
  const { collection, history } = raw;

  return {
    ...raw,
    version: 2,
    collection:
      isRecord(collection) && Array.isArray(collection.boards)
        ? { ...collection, boards: collection.boards.map(migrateBoardV1) }
        : collection,
    history: Array.isArray(history)
      ? history.map((entry) =>
          isRecord(entry)
            ? { ...entry, board: migrateBoardV1(entry.board) }
            : entry,
        )
      : history,
  };
}

function migrateBoardV1(board: unknown): unknown {
  if (!isRecord(board)) {
    return board;
  }
  return {
    ...board,
    style: isRecord(board.style) ? { theme: board.style.theme } : board.style,
    updatedAt: board.createdAt,
  };
}
