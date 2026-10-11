import { useId } from 'react';
import styles from './TitleField.module.css';

interface TitleFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** Muestra el aviso si el título está vacío. */
  showError: boolean;
  autoFocus?: boolean;
}

export function isValidTitle(title: string): boolean {
  return title.trim() !== '';
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
        maxLength={40}
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
