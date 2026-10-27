import { useState, type FormEvent } from 'react';
import { Screen } from '../components/Screen';
import { isValidTitle, TitleField } from '../components/TitleField';
import type { BingoSize } from '@bingogoals/domain';
import styles from './CreateScreen.module.css';
import { Button } from '../components/Button';

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
  const [title, setTitle] = useState('');
  const [size, setSize] = useState<BingoSize>('3x3');
  const [showError, setShowError] = useState(false);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!isValidTitle(title)) {
      setShowError(true);
      return;
    }
    onCreate(title.trim(), size);
  }

  return (
    <Screen title="Nuevo tablero" onBack={onCancel} focusTitle={false}>
      <form className={styles.form} noValidate onSubmit={handleSubmit}>
        <TitleField
          value={title}
          onChange={setTitle}
          showError={showError}
          autoFocus
        />

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

        <Button size="large" type="submit">
          Crear tablero
        </Button>
      </form>
    </Screen>
  );
}
