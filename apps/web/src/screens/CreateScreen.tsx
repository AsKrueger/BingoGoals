import { useId, useState, type FormEvent } from 'react';
import { Screen } from '../components/Screen';
import type { BingoSize } from '../domain';
import styles from './CreateScreen.module.css';

interface CreateScreenProps {
  onCreate: (title: string, size: BingoSize) => void;
  onCancel: () => void;
}

const SIZES: { value: BingoSize; name: string; description: string }[] = [
  { value: '3x3', name: '3 × 3', description: 'Modo rápido · 9 casillas' },
  {
    value: '5x5',
    name: '5 × 5',
    description: 'Modo épico · 25 casillas con estrella central',
  },
];

export function CreateScreen({ onCreate, onCancel }: CreateScreenProps) {
  const titleId = useId();
  const errorId = useId();
  const [title, setTitle] = useState('');
  const [size, setSize] = useState<BingoSize>('3x3');
  const [showError, setShowError] = useState(false);

  const hasError = showError && title.trim() === '';

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (title.trim() === '') {
      setShowError(true);
      return;
    }
    onCreate(title.trim(), size);
  }

  return (
    <Screen title="Nuevo tablero" onBack={onCancel} focusTitle={false}>
      <form className={styles.form} noValidate onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label htmlFor={titleId} className={styles.label}>
            Título del tablero
          </label>
          <input
            id={titleId}
            className={styles.input}
            value={title}
            maxLength={40}
            placeholder="Mis metas de este año"
            autoFocus
            required
            aria-invalid={hasError}
            aria-describedby={hasError ? errorId : undefined}
            onChange={(event) => setTitle(event.target.value)}
          />
          {hasError && (
            <p id={errorId} role="alert" className={styles.error}>
              Escribe un título para el tablero.
            </p>
          )}
        </div>

        <fieldset className={styles.field}>
          <legend className={styles.label}>Tamaño</legend>
          <div className={styles.sizes}>
            {SIZES.map((option) => (
              <label key={option.value} className={styles.size}>
                <input
                  type="radio"
                  name="size"
                  className={styles.radio}
                  value={option.value}
                  checked={size === option.value}
                  onChange={() => setSize(option.value)}
                />
                <span className={styles.sizeName}>{option.name}</span>
                <span className={styles.sizeDescription}>
                  {option.description}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <button type="submit" className={styles.submit}>
          Crear tablero
        </button>
      </form>
    </Screen>
  );
}
