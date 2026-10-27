import {
  isValidTitle as isValidDomainTitle,
  MAX_TITLE_LENGTH,
} from '@bingogoals/domain';
import { useId } from 'react';
import styles from './TitleField.module.css';

interface TitleFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** Muestra el aviso si el título está vacío. */
  showError: boolean;
  autoFocus?: boolean;
}

/** Lo escrito en el campo, una vez quitados los espacios sobrantes. */
export function isValidTitle(title: string): boolean {
  return isValidDomainTitle(title.trim());
}

/** Campo del título de un tablero, con su aviso de título vacío. */
export function TitleField({
  value,
  onChange,
  showError,
  autoFocus = false,
}: TitleFieldProps) {
  const inputId = useId();
  const errorId = useId();
  const hasError = showError && !isValidTitle(value);

  return (
    <div className={styles.field}>
      <label htmlFor={inputId} className={styles.label}>
        Título del tablero
      </label>
      <input
        id={inputId}
        className={styles.input}
        value={value}
        maxLength={MAX_TITLE_LENGTH}
        placeholder="Mis metas de este año"
        autoFocus={autoFocus}
        required
        aria-invalid={hasError}
        aria-describedby={hasError ? errorId : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {hasError && (
        <p id={errorId} role="alert" className={styles.error}>
          Escribe un título para el tablero.
        </p>
      )}
    </div>
  );
}
