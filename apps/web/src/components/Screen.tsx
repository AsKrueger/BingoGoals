import { useEffect, useRef, type ReactNode } from 'react';
import type { BingoTheme } from '@bingogoals/domain';
import styles from './Screen.module.css';

interface ScreenProps {
  title: string;
  theme?: BingoTheme;
  /** Si se indica, la cabecera muestra un botón para volver. */
  onBack?: () => void;
  backLabel?: string;
  /** Botones a la derecha del título. */
  actions?: ReactNode;
  /** Pon false si la pantalla enfoca otro elemento al abrirse. */
  focusTitle?: boolean;
  children: ReactNode;
}

/** Estructura común de las pantallas: cabecera con título y contenido. */
export function Screen({
  title,
  theme = 'classic',
  onBack,
  backLabel = 'Volver',
  actions,
  focusTitle = true,
  children,
}: ScreenProps) {
  const titleRef = useRef<HTMLHeadingElement>(null);

  // Al cambiar de pantalla, el foco pasa al título para no quedarse perdido.
  useEffect(() => {
    if (focusTitle) {
      titleRef.current?.focus();
    }
  }, [focusTitle]);

  return (
    <div className={styles.screen} data-theme={theme}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          {onBack && (
            <button
              type="button"
              className={styles.headerButton}
              aria-label={backLabel}
              onClick={onBack}
            >
              ←
            </button>
          )}
          <h1 ref={titleRef} tabIndex={-1} className={styles.title}>
            {title}
          </h1>
          {actions && <div className={styles.actions}>{actions}</div>}
        </div>
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  );
}

interface HeaderButtonProps {
  label: string;
  icon: string;
  onClick: () => void;
}

/** Botón de icono para la zona de acciones de la cabecera. */
export function HeaderButton({ label, icon, onClick }: HeaderButtonProps) {
  return (
    <button
      type="button"
      className={styles.headerButton}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      <span aria-hidden="true">{icon}</span>
    </button>
  );
}
