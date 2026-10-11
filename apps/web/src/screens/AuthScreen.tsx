import { useId, useState, type FormEvent } from 'react';
import { ApiError, NetworkError, type FieldErrors } from '../account/api';
import type { Account } from '../account/useAccount';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import styles from './AuthScreen.module.css';

export type AuthMode = 'register' | 'login';

interface AuthScreenProps {
  mode: AuthMode;
  account: Account;
  /** Se llama cuando la sesión queda iniciada. */
  onDone: () => void;
  onSwitchMode: (mode: AuthMode) => void;
  onBack: () => void;
}

const TEXTS = {
  register: {
    title: 'Crear cuenta',
    submit: 'Crear cuenta',
    pending: 'Creando la cuenta…',
    switchQuestion: '¿Ya tienes cuenta?',
    switchAction: 'Iniciar sesión',
  },
  login: {
    title: 'Iniciar sesión',
    submit: 'Iniciar sesión',
    pending: 'Iniciando sesión…',
    switchQuestion: '¿Todavía no tienes cuenta?',
    switchAction: 'Crear cuenta',
  },
};

/** Formulario de registro o de inicio de sesión, según `mode`. */
export function AuthScreen({
  mode,
  account,
  onDone,
  onSwitchMode,
  onBack,
}: AuthScreenProps) {
  const emailId = useId();
  const passwordId = useId();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [isPending, setIsPending] = useState(false);

  const texts = TEXTS[mode];
  const other: AuthMode = mode === 'register' ? 'login' : 'register';

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    // Lo demás lo valida el servidor, que es quien conoce las reglas.
    const missing: FieldErrors = {
      ...(email.trim() === '' && { email: 'Escribe tu correo.' }),
      ...(password === '' && { password: 'Escribe tu contraseña.' }),
    };
    setFieldErrors(missing);
    setFormError('');
    if (Object.keys(missing).length > 0) {
      return;
    }

    setIsPending(true);
    try {
      await account[mode](email, password);
      onDone();
    } catch (error) {
      setIsPending(false);
      if (error instanceof NetworkError) {
        setFormError(
          'No se puede conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.',
        );
      } else if (error instanceof ApiError) {
        setFieldErrors(error.fieldErrors);
        // Si el error ya se muestra junto a un campo, no se repite arriba.
        setFormError(
          Object.keys(error.fieldErrors).length > 0 ? '' : error.message,
        );
      } else {
        setFormError('Ha ocurrido un error inesperado. Inténtalo de nuevo.');
      }
    }
  }

  return (
    <Screen title={texts.title} onBack={onBack} focusTitle={false}>
      <form className={styles.form} noValidate onSubmit={handleSubmit}>
        {formError && (
          <p role="alert" className={styles.formError}>
            {formError}
          </p>
        )}

        <div className={styles.field}>
          <label htmlFor={emailId} className={styles.label}>
            Correo
          </label>
          <input
            id={emailId}
            className={styles.input}
            type="email"
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus
            required
            value={email}
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={
              fieldErrors.email ? `${emailId}-error` : undefined
            }
            onChange={(event) => setEmail(event.target.value)}
          />
          {fieldErrors.email && (
            <p id={`${emailId}-error`} role="alert" className={styles.error}>
              {fieldErrors.email}
            </p>
          )}
        </div>

        <div className={styles.field}>
          <label htmlFor={passwordId} className={styles.label}>
            Contraseña
          </label>
          <input
            id={passwordId}
            className={styles.input}
            type="password"
            autoComplete={
              mode === 'register' ? 'new-password' : 'current-password'
            }
            required
            value={password}
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={
              [
                mode === 'register' && `${passwordId}-hint`,
                fieldErrors.password && `${passwordId}-error`,
              ]
                .filter(Boolean)
                .join(' ') || undefined
            }
            onChange={(event) => setPassword(event.target.value)}
          />
          {mode === 'register' && (
            <p id={`${passwordId}-hint`} className={styles.hint}>
              Al menos 8 caracteres. No hay forma de recuperarla si la olvidas.
            </p>
          )}
          {fieldErrors.password && (
            <p id={`${passwordId}-error`} role="alert" className={styles.error}>
              {fieldErrors.password}
            </p>
          )}
        </div>

        <Button type="submit" size="large" disabled={isPending}>
          {isPending ? texts.pending : texts.submit}
        </Button>

        <p className={styles.switch}>
          {texts.switchQuestion}{' '}
          <Button variant="ghost" onClick={() => onSwitchMode(other)}>
            {texts.switchAction}
          </Button>
        </p>
      </form>
    </Screen>
  );
}
