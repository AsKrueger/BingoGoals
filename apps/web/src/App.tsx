import { photoIdsOf } from '@bingogoals/domain';
import { useEffect, useState } from 'react';
import { useAccount, type AccountServices } from './account/useAccount';
import { Notice, NoticeStack } from './components/Notice';
import { useBoards } from './hooks/useBoards';
import { PhotoContext } from './hooks/usePhotos';
import { useSync } from './hooks/useSync';
import { AccountScreen } from './screens/AccountScreen';
import { AuthScreen } from './screens/AuthScreen';
import { BoardScreen } from './screens/BoardScreen';
import { CollectionScreen } from './screens/CollectionScreen';
import { CreateScreen } from './screens/CreateScreen';
import { HistoryDetailScreen } from './screens/HistoryDetailScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { StatsScreen } from './screens/StatsScreen';
import { WelcomeScreen } from './screens/WelcomeScreen';
import type { BoardStorage } from './storage/storage';
import type { BoardStore } from './store/boardStore';
import { createPhotoStore, type PhotoStore } from './store/photoStore';

type ScreenName =
  | 'board'
  | 'create'
  | 'collection'
  | 'stats'
  | 'settings'
  | 'history'
  | 'account'
  | 'register'
  | 'login';

/**
 * Por qué la web ha arrancado vacía habiendo podido tener datos:
 * - `unreadable`: hay datos guardados, pero están dañados o son de una
 *   versión desconocida.
 * - `unavailable`: el almacenamiento del dispositivo no responde.
 */
export type LoadProblem = 'unreadable' | 'unavailable';

const LOAD_PROBLEM_MESSAGES: Record<LoadProblem, string> = {
  unreadable:
    'Los datos guardados en este dispositivo no se pueden leer: están dañados o son de una versión más reciente de BingoGoals. No se han borrado: si haces cambios, se conservará una copia de esos datos.',
  unavailable:
    'No se han podido leer los datos guardados en este dispositivo. Es posible que los cambios de esta sesión no se guarden.',
};

interface AppProps {
  /** Los tableros, ya cargados del dispositivo. */
  store: BoardStore;
  /** El almacenamiento del dispositivo: fotos y copias de datos ilegibles. */
  storage: BoardStorage;
  /** Las fotos de las casillas. Por defecto, las de `storage`. */
  photos?: PhotoStore;
  /** Las APIs de cuentas y tableros, y dónde se guarda la sesión. */
  accountServices: AccountServices;
  /** Problema al leer los datos guardados, si lo hubo. */
  loadProblem?: LoadProblem | null;
}

export function App({
  store,
  storage,
  photos: givenPhotos,
  accountServices,
  loadProblem = null,
}: AppProps) {
  const [photos] = useState(
    () => givenPhotos ?? createPhotoStore(storage.photos),
  );
  const boards = useBoards(store);
  // La cuenta es opcional: nada de lo demás depende de ella.
  const account = useAccount(accountServices);
  const sync = useSync(store, photos, account, accountServices);

  // Al abrir, se borran del dispositivo las fotos que ya no usa ninguna
  // casilla, de ninguna cuenta.
  useEffect(() => {
    const used = new Set(
      store.localRecords().flatMap((record) => photoIdsOf(record.board)),
    );
    photos.collect(used).catch(() => {});
  }, [store, photos]);
  const { saveError, retrySave } = boards;
  const [showLoadProblem, setShowLoadProblem] = useState(loadProblem !== null);
  const [screen, setScreen] = useState<ScreenName>('board');
  // Pantalla a la que se vuelve desde el historial.
  const [historyOrigin, setHistoryOrigin] = useState<ScreenName>('board');
  const [archivedId, setArchivedId] = useState<string | null>(null);

  function openHistory(origin: ScreenName) {
    setHistoryOrigin(origin);
    setArchivedId(null);
    setScreen('history');
  }

  function renderScreen() {
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

    if (screen === 'account') {
      return (
        <AccountScreen
          account={account}
          sync={sync}
          store={store}
          storage={storage}
          onOpenAuth={setScreen}
          onBack={() => setScreen('board')}
        />
      );
    }

    if (screen === 'register' || screen === 'login') {
      return (
        <AuthScreen
          // Al pasar de registro a inicio de sesión el formulario empieza de cero.
          key={screen}
          mode={screen}
          account={account}
          onDone={() => setScreen('account')}
          onSwitchMode={setScreen}
          onBack={() => setScreen('account')}
        />
      );
    }

    if (screen === 'history') {
      const entry = boards.history.find((item) => item.board.id === archivedId);
      if (entry) {
        return (
          <HistoryDetailScreen
            entry={entry}
            onBack={() => setArchivedId(null)}
          />
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
          onOpenAccount={() => setScreen('account')}
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
        syncStatus={sync.status}
        onOpen={(section) =>
          section === 'history' ? openHistory('board') : setScreen(section)
        }
      />
    );
  }

  return (
    <PhotoContext value={photos}>
      {renderScreen()}
      <NoticeStack>
        {loadProblem && showLoadProblem && (
          <Notice
            kind="error"
            actions={[
              { label: 'Entendido', onClick: () => setShowLoadProblem(false) },
            ]}
          >
            {LOAD_PROBLEM_MESSAGES[loadProblem]}
          </Notice>
        )}
        {saveError && (
          <Notice
            kind="error"
            actions={[{ label: 'Reintentar', onClick: retrySave }]}
          >
            No se han podido guardar los últimos cambios. Puede que el
            dispositivo se haya quedado sin espacio.
          </Notice>
        )}
      </NoticeStack>
    </PhotoContext>
  );
}
