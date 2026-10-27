import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

type ButtonVariant =
  /** Acción principal de la pantalla o del diálogo. */
  | 'primary'
  /** Acción alternativa. Con `aria-pressed` sirve de interruptor. */
  | 'secondary'
  /** Acción que borra algo. */
  | 'danger'
  /** Acción discreta, como cancelar. */
  | 'ghost'
  /** Para añadir un elemento a una lista. */
  | 'dashed'
  /** Sobre el fondo de color de la bienvenida. */
  | 'inverse'
  | 'inverseOutline';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'medium' | 'large';
}

/**
 * Botón de la aplicación. Es un `<button>` normal: admite todas sus
 * propiedades, y por defecto no envía formularios (`type="button"`).
 */
export function Button({
  variant = 'primary',
  size = 'medium',
  type = 'button',
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`${styles.button} ${styles[variant]} ${styles[size]} ${className}`}
      {...props}
    />
  );
}
