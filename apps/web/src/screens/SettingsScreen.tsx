import { useState, type FormEvent } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Screen } from '../components/Screen';
import { ThemeDialog } from '../components/ThemeDialog';
import { isValidTitle, TitleField } from '../components/TitleField';
import type { BingoBoard, BingoTheme } from '@bingogoals/domain';
import { THEMES } from '../themes';
import styles from './SettingsScreen.module.css';
import { Button } from '../components/Button';

interface SettingsScreenProps {
  board: BingoBoard;
  onRename: (title: string) => void;
  onThemeChange: (theme: BingoTheme) => void;
  onReset: () => void;
  onArchive: () => void;
  onBack: () => void;
}

type Dialog = 'theme' | 'reset' | 'archive' | null;

export function SettingsScreen({
  board,
  onRename,
  onThemeChange,
  onReset,
  onArchive,
  onBack,
}: SettingsScreenProps) {
  const [title, setTitle] = useState(board.title);
  const [showError, setShowError] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);

  const theme = board.style.theme;
  const isSaved = title.trim() === board.title;

  function handleRename(event: FormEvent) {
    event.preventDefault();
    if (!isValidTitle(title)) {
      setShowError(true);
      return;
    }
    setTitle(title.trim());
    onRename(title.trim());
    setJustSaved(true);
  }

  return (
    <Screen
      title="Ajustes"
      theme={theme}
      onBack={onBack}
      backLabel="Volver al tablero"
    >
      <form className={styles.card} noValidate onSubmit={handleRename}>
        <TitleField
          value={title}
          onChange={(value) => {
            setTitle(value);
            setJustSaved(false);
          }}
          showError={showError}
        />
        <div className={styles.row}>
          <p className={styles.status} role="status">
            {justSaved && 'Nombre guardado.'}
          </p>
          <Button type="submit" disabled={isSaved}>
            Guardar nombre
          </Button>
        </div>
      </form>

      <section className={styles.card} aria-labelledby="settings-theme">
        <h2 id="settings-theme" className={styles.heading}>
          Tema
        </h2>
        <div className={styles.row}>
          <p className={styles.description}>
            <span aria-hidden="true">{THEMES[theme].emoji}</span>{' '}
            {THEMES[theme].label}
          </p>
          <Button
            variant="secondary"
            className={styles.action}
            onClick={() => setDialog('theme')}
          >
            Cambiar tema
          </Button>
        </div>
      </section>

      <section className={styles.card} aria-labelledby="settings-reset">
        <h2 id="settings-reset" className={styles.heading}>
          Reiniciar
        </h2>
        <p className={styles.description}>
          Desmarca todas las casillas. Conserva textos, iconos y fotos.
        </p>
        <Button
          variant="secondary"
          className={styles.action}
          onClick={() => setDialog('reset')}
        >
          Reiniciar tablero
        </Button>
      </section>

      <section className={styles.card} aria-labelledby="settings-archive">
        <h2 id="settings-archive" className={styles.heading}>
          Archivar
        </h2>
        <p className={styles.description}>
          Guarda el tablero en el historial y lo saca de tus tableros. Un
          tablero archivado ya no se puede marcar ni editar.
        </p>
        <Button
          variant="secondary"
          className={styles.action}
          onClick={() => setDialog('archive')}
        >
          Archivar tablero
        </Button>
      </section>

      {dialog === 'theme' && (
        <ThemeDialog
          theme={theme}
          onSelect={onThemeChange}
          onClose={() => setDialog(null)}
        />
      )}

      {dialog === 'reset' && (
        <ConfirmDialog
          title="¿Reiniciar tablero?"
          message={`Se desmarcarán todas las casillas de «${board.title}».`}
          confirmLabel="Reiniciar"
          onCancel={() => setDialog(null)}
          onConfirm={onReset}
        />
      )}

      {dialog === 'archive' && (
        <ConfirmDialog
          title="¿Archivar tablero?"
          message={`«${board.title}» pasará al historial y quedará en solo lectura.`}
          confirmLabel="Archivar"
          onCancel={() => setDialog(null)}
          onConfirm={onArchive}
        />
      )}
    </Screen>
  );
}
