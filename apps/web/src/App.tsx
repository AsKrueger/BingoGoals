import { createBoard } from './domain';
import { BoardScreen } from './screens/BoardScreen';

// Tablero de ejemplo hasta que exista la pantalla de creación (Issue #3).
function createSampleBoard() {
  return createBoard('Mis metas', '5x5');
}

export function App() {
  return <BoardScreen createInitialBoard={createSampleBoard} />;
}
