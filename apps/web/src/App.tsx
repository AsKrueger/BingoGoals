import { useState } from 'react';
import { useBoards } from './hooks/useBoards';
import { BoardScreen } from './screens/BoardScreen';
import { CollectionScreen } from './screens/CollectionScreen';
import { CreateScreen } from './screens/CreateScreen';
import { HistoryDetailScreen } from './screens/HistoryDetailScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { StatsScreen } from './screens/StatsScreen';
import { WelcomeScreen } from './screens/WelcomeScreen';

type ScreenName =
  'board' | 'create' | 'collection' | 'stats' | 'settings' | 'history';

export function App() {
  const boards = useBoards();
  const [screen, setScreen] = useState<ScreenName>('board');
  // Pantalla a la que se vuelve desde el historial.
  const [historyOrigin, setHistoryOrigin] = useState<ScreenName>('board');
  const [archivedId, setArchivedId] = useState<string | null>(null);

  function openHistory(origin: ScreenName) {
    setHistoryOrigin(origin);
    setArchivedId(null);
    setScreen('history');
  }

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

  if (screen === 'history') {
    const entry = boards.history.find((item) => item.board.id === archivedId);
    if (entry) {
      return (
        <HistoryDetailScreen entry={entry} onBack={() => setArchivedId(null)} />
      );
    }
    return (
      <HistoryScreen
        history={boards.history}
        onOpen={setArchivedId}
        onDelete={boards.removeArchived}
        onBack={() => setScreen(historyOrigin)}
      />
    );
  }

  // Sin tableros no hay nada que mostrar: toca dar la bienvenida.
  if (!boards.board) {
    return (
      <WelcomeScreen
        onStart={() => setScreen('create')}
        onOpenHistory={
          boards.history.length > 0 ? () => openHistory('board') : undefined
        }
      />
    );
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
        onOpenHistory={() => openHistory('collection')}
        onBack={() => setScreen('board')}
      />
    );
  }

  if (screen === 'stats') {
    return (
      <StatsScreen board={boards.board} onBack={() => setScreen('board')} />
    );
  }

  if (screen === 'settings') {
    return (
      <SettingsScreen
        // Si cambia el tablero activo, el formulario empieza de cero.
        key={boards.board.id}
        board={boards.board}
        onRename={boards.rename}
        onThemeChange={boards.setTheme}
        onReset={() => {
          boards.reset();
          setScreen('board');
        }}
        onArchive={() => {
          boards.archive();
          setScreen('board');
        }}
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
      onOpen={(section) =>
        section === 'history' ? openHistory('board') : setScreen(section)
      }
    />
  );
}
