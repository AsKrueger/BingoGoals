import { useId, useState, type ChangeEvent, type FormEvent } from 'react';
import type { BingoCell, BingoCellChanges } from '../domain';
import { resizePhoto } from '../photos';
import { CELL_COLORS, CELL_ICONS } from './cellOptions';
import styles from './EditCellDialog.module.css';
import { Modal } from './Modal';

interface EditCellDialogProps {
  cell: BingoCell;
  onSave: (changes: BingoCellChanges) => void;
  onCancel: () => void;
}

export function EditCellDialog({
  cell,
  onSave,
  onCancel,
}: EditCellDialogProps) {
  const titleId = useId();
  const textId = useId();
  const [text, setText] = useState(cell.text);
  const [icon, setIcon] = useState(cell.icon);
  const [imagePath, setImagePath] = useState(cell.imagePath);
  const [color, setColor] = useState(cell.color);

  const [photoError, setPhotoError] = useState(false);

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    // La foto se reduce antes de guardarse para no agotar el espacio.
    resizePhoto(file).then(
      (photo) => {
        setImagePath(photo);
        setPhotoError(false);
      },
      () => setPhotoError(true),
    );
    // Permite volver a elegir el mismo archivo después de quitarlo.
    event.target.value = '';
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSave({ text: text.trim(), icon, imagePath, color });
  }

  return (
    <Modal labelledBy={titleId} onClose={onCancel}>
      <form className={styles.form} onSubmit={handleSubmit}>
        <h2 id={titleId} className={styles.title}>
          {cell.isCentralStar ? 'Personalizar estrella' : 'Editar objetivo'}
        </h2>

        <div className={styles.field}>
          <label htmlFor={textId} className={styles.label}>
            Texto del objetivo
          </label>
          <input
            id={textId}
            className={styles.textInput}
            value={text}
            maxLength={60}
            autoFocus
            onChange={(event) => setText(event.target.value)}
          />
        </div>

        <fieldset className={styles.field}>
          <legend className={styles.label}>Icono</legend>
          <div className={styles.options}>
            <button
              type="button"
              className={styles.option}
              aria-pressed={icon === null}
              onClick={() => setIcon(null)}
            >
              Sin icono
            </button>
            {CELL_ICONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`${styles.option} ${styles.iconOption}`}
                aria-label={option.label}
                aria-pressed={icon === option.value}
                onClick={() => setIcon(option.value)}
              >
                {option.value}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className={styles.field}>
          <legend className={styles.label}>Foto</legend>
          <div className={styles.photoRow}>
            {imagePath && (
              <img
                className={styles.preview}
                src={imagePath}
                alt="Foto elegida"
              />
            )}
            <label className={styles.fileButton}>
              {imagePath ? 'Cambiar foto' : 'Elegir foto'}
              <input
                type="file"
                accept="image/*"
                className={styles.fileInput}
                onChange={handlePhotoChange}
              />
            </label>
            {imagePath && (
              <button
                type="button"
                className={styles.option}
                onClick={() => setImagePath(null)}
              >
                Quitar foto
              </button>
            )}
          </div>
          {photoError && (
            <p role="alert" className={styles.error}>
              No se ha podido leer la foto. Prueba con otra imagen.
            </p>
          )}
        </fieldset>

        <fieldset className={styles.field}>
          <legend className={styles.label}>Color de fondo</legend>
          <div className={styles.options}>
            <button
              type="button"
              className={styles.option}
              aria-pressed={color === null}
              onClick={() => setColor(null)}
            >
              Sin color
            </button>
            {CELL_COLORS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={styles.swatch}
                style={{ backgroundColor: option.value }}
                aria-label={option.label}
                aria-pressed={color === option.value}
                onClick={() => setColor(option.value)}
              />
            ))}
          </div>
        </fieldset>

        <div className={styles.actions}>
          <button type="button" className={styles.cancel} onClick={onCancel}>
            Cancelar
          </button>
          <button type="submit" className={styles.save}>
            Guardar
          </button>
        </div>
      </form>
    </Modal>
  );
}
