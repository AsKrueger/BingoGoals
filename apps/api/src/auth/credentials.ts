export const MIN_PASSWORD_LENGTH = 8;
/** Límite alto, solo para no cifrar textos enormes. */
export const MAX_PASSWORD_LENGTH = 200;
const MAX_EMAIL_LENGTH = 254;

export interface Credentials {
  /** Correo sin espacios alrededor y en minúsculas. */
  readonly email: string;
  readonly password: string;
}

/** Mensaje de error de cada campo, para mostrarlo junto a él. */
export type FieldErrors = Partial<Record<keyof Credentials, string>>;

export type CredentialsResult =
  | { readonly ok: true; readonly credentials: Credentials }
  | { readonly ok: false; readonly errors: FieldErrors };

// Una comprobación sencilla: algo, una arroba, algo, un punto y algo. Si el
// correo existe de verdad solo se sabe enviándole un mensaje.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Valida el cuerpo de una petición de registro o de inicio de sesión.
 * `checkPasswordRules` solo se activa al registrarse: al iniciar sesión basta
 * con que haya contraseña, porque las reglas pueden haber cambiado.
 */
export function parseCredentials(
  body: unknown,
  { checkPasswordRules }: { checkPasswordRules: boolean },
): CredentialsResult {
  const { email, password } = (
    typeof body === 'object' && body !== null ? body : {}
  ) as Record<string, unknown>;
  const errors: FieldErrors = {};

  const normalized = typeof email === 'string' ? normalizeEmail(email) : '';
  if (normalized === '') {
    errors.email = 'Escribe tu correo.';
  } else if (normalized.length > MAX_EMAIL_LENGTH || !EMAIL.test(normalized)) {
    errors.email = 'Escribe un correo válido.';
  }

  if (typeof password !== 'string' || password === '') {
    errors.password = 'Escribe tu contraseña.';
  } else if (password.length > MAX_PASSWORD_LENGTH) {
    errors.password = `La contraseña no puede tener más de ${MAX_PASSWORD_LENGTH} caracteres.`;
  } else if (checkPasswordRules && password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    credentials: { email: normalized, password: password as string },
  };
}
