import { useState } from 'react';
import { useBoards } from './hooks/useBoards';
import { BoardScreen } from './screens/BoardScreen';
import { CollectionScreen } from './screens/CollectionScreen';
import { CreateScreen } from './screens/CreateScreen';
import { WelcomeScreen } from './screens/WelcomeScreen';

type ScreenName = 'board' | 'create' | 'collection';

export function App() {
  const boards = useBoards();
  const [screen, setScreen] = useState<ScreenName>('board');

  if (screen === 'create') {
    return (
      <CreateScreen
        onCreate={(title, size) => {
          boards.create(title, size);
          setScreen('board');
        }}
        onCancel={() => setScreen(boards.board ? 'collection' : 'board')}
      />
    );
  }

  // Sin tableros no hay nada que mostrar: toca dar la bienvenida.
  if (!boards.board) {
    return <WelcomeScreen onStart={() => setScreen('create')} />;
  }

  if (screen === 'collection') {
    return (
      <CollectionScreen
        boards={boards.boards}
        activeBoardId={boards.board.id}
        onOpen={(boardId) => {
          boards.activate(boardId);
          setScreen('board');
        }}
        onDelete={boards.remove}
        onCreate={() => setScreen('create')}
        onBack={() => setScreen('board')}
      />
    );
  }

  return (
    <BoardScreen
      board={boards.board}
      win={boards.win}
      onToggle={boards.toggle}
      onUpdate={boards.update}
      onThemeChange={boards.setTheme}
      onDismissWin={boards.dismissWin}
      onOpenCollection={() => setScreen('collection')}
    />
  );
}
