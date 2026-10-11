import { useId } from 'react';
import { BINGO_THEMES, type BingoTheme } from '../domain';
import { THEMES } from '../themes';
import { Modal } from './Modal';
import styles from './ThemeDialog.module.css';

interface ThemeDialogProps {
  theme: BingoTheme;
  onSelect: (theme: BingoTheme) => void;
  onClose: () => void;
}

/** Selector de tema: el cambio se aplica al momento, sin botón de guardar. */
export function ThemeDialog({ theme, onSelect, onClose }: ThemeDialogProps) {
  const titleId = useId();

  return (
    <Modal labelledBy={titleId} onClose={onClose} className={styles.dialog}>
      <h2 id={titleId} className={styles.title}>
        Elige tu estilo
      </h2>
      <div className={styles.themes}>
        {BINGO_THEMES.map((option) => (
          <button
            key={option}
            type="button"
            className={styles.theme}
            data-theme={option}
            aria-pressed={option === theme}
            autoFocus={option === theme}
            onClick={() => onSelect(option)}
          >
            <span className={styles.swatch} aria-hidden="true">
              {THEMES[option].emoji}
            </span>
            {THEMES[option].label}
          </button>
        ))}
      </div>
      <button type="button" className={styles.close} onClick={onClose}>
        Cerrar
      </button>
    </Modal>
  );
}
