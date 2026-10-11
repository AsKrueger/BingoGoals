import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { App } from '../App';
import { createMemoryStorage } from '../storage/memoryStorage';
import { EMPTY_DATA } from '../storage/storage';
import { button, heading, submitCreateForm } from '../test/helpers';
import { ApiError, createAccountApi, NetworkError } from './api';
import { createFakeAccountApi, type FakeAccountApi } from './fakeApi';
import {
  createLocalSessionStore,
  createMemorySessionStore,
} from './sessionStore';

afterEach(cleanup);

const ANA = { email: 'ana@example.com', password: 'correcta-caballo' };

interface Setup {
  api: FakeAccountApi;
  sessionStore: ReturnType<typeof createMemorySessionStore>;
}

/** Abre la web con un servidor de cuentas en memoria. */
function open(setup: Partial<Setup> = {}): Setup {
  const services = {
    api: setup.api ?? createFakeAccountApi(),
    sessionStore: setup.sessionStore ?? createMemorySessionStore(),
  };
  render(
    <App
      initialData={EMPTY_DATA}
      storage={createMemoryStorage()}
      accountServices={services}
    />,
  );
  return services;
}

/** Cierra la web y la vuelve a abrir con la misma sesión guardada. */
function reload(setup: Setup) {
  cleanup();
  return open(setup);
}

function fill(email: string, password: string) {
  fireEvent.change(screen.getByLabelText('Correo'), {
    target: { value: email },
  });
  fireEvent.change(screen.getByLabelText('Contraseña'), {
    target: { value: password },
  });
}

/** Envía el formulario pulsando su botón, que se llama igual que la pantalla. */
function submit(name: 'Crear cuenta' | 'Iniciar sesión') {
  fireEvent.click(
    within(screen.getByRole('main')).getByRole('button', { name }),
  );
}

async function registerAna(setup?: Partial<Setup>) {
  const services = open(setup);
  fireEvent.click(button('Cuenta'));
  fireEvent.click(button('Crear cuenta'));
  fill(ANA.email, ANA.password);
  submit('Crear cuenta');
  await screen.findByText('Sesión iniciada');
  return services;
}

describe('sin cuenta', () => {
  test('la web funciona como antes: se puede crear un tablero y jugar', () => {
    const { api } = open();
    api.isDown = true;

    fireEvent.click(button('Empezar ahora'));
    submitCreateForm('Metas', '3x3');
    fireEvent.click(button('Objetivo 1'));

    expect(screen.getByText('1 de 9 conseguidos')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  test('la cuenta se abre desde la bienvenida y explica que es opcional', () => {
    open();

    fireEvent.click(button('Cuenta'));

    expect(heading('Cuenta')).toBeTruthy();
    expect(screen.getByText(/La cuenta es opcional/)).toBeTruthy();
    expect(button('Crear cuenta')).toBeTruthy();
    expect(button('Iniciar sesión')).toBeTruthy();
  });

  test('la cuenta se abre también desde la barra de secciones del tablero', () => {
    open();
    fireEvent.click(button('Empezar ahora'));
    submitCreateForm('Metas', '3x3');

    fireEvent.click(button('Cuenta'));
    expect(heading('Cuenta')).toBeTruthy();

    fireEvent.click(button('Volver'));
    expect(heading('Metas')).toBeTruthy();
  });

  test('sin sesión guardada no se llama al servidor al abrir la web', () => {
    const api = createFakeAccountApi();
    const me = vi.spyOn(api, 'me');

    open({ api });

    expect(me).not.toHaveBeenCalled();
  });
});

describe('registro', () => {
  test('con un correo nuevo inicia sesión y la cuenta muestra el correo', async () => {
    const { api, sessionStore } = await registerAna();

    expect(heading('Cuenta')).toBeTruthy();
    expect(screen.getByText('ana@example.com')).toBeTruthy();
    expect(api.emails()).toEqual(['ana@example.com']);
    expect(sessionStore.current).toMatchObject({
      user: { email: 'ana@example.com' },
    });
  });

  test('el formulario tiene etiquetas y enfoca el correo', () => {
    open();
    fireEvent.click(button('Cuenta'));
    fireEvent.click(button('Crear cuenta'));

    const email = screen.getByLabelText<HTMLInputElement>('Correo');
    const password = screen.getByLabelText<HTMLInputElement>('Contraseña');
    expect(document.activeElement).toBe(email);
    expect(email.type).toBe('email');
    expect(email.autocomplete).toBe('email');
    expect(password.type).toBe('password');
    expect(password.autocomplete).toBe('new-password');
  });

  test('con un correo ya usado muestra el error junto al campo y no crea nada', async () => {
    const setup = await registerAna();
    fireEvent.click(button('Cerrar sesión'));
    await screen.findByText('Sin cuenta');

    fireEvent.click(button('Crear cuenta'));
    fill('ANA@example.com', 'otra-contraseña');
    submit('Crear cuenta');

    const error = await screen.findByRole('alert');
    expect(error.textContent).toBe('Ya existe una cuenta con ese correo.');
    const email = screen.getByLabelText('Correo');
    expect(email.getAttribute('aria-invalid')).toBe('true');
    expect(email.getAttribute('aria-describedby')).toBe(error.id);
    expect(setup.api.emails()).toHaveLength(1);
    expect(heading('Crear cuenta')).toBeTruthy();
  });

  test('con una contraseña corta muestra el error junto a la contraseña', async () => {
    open();
    fireEvent.click(button('Cuenta'));
    fireEvent.click(button('Crear cuenta'));
    fill(ANA.email, 'corta');

    submit('Crear cuenta');

    const error = await screen.findByRole('alert');
    expect(error.textContent).toBe(
      'La contraseña debe tener al menos 8 caracteres.',
    );
    expect(
      screen.getByLabelText('Contraseña').getAttribute('aria-describedby'),
    ).toContain(error.id);
  });

  test('con los campos vacíos avisa en cada uno sin llamar al servidor', () => {
    const api = createFakeAccountApi();
    const register = vi.spyOn(api, 'register');
    open({ api });
    fireEvent.click(button('Cuenta'));
    fireEvent.click(button('Crear cuenta'));

    submit('Crear cuenta');

    expect(
      screen.getAllByRole('alert').map((alert) => alert.textContent),
    ).toEqual(['Escribe tu correo.', 'Escribe tu contraseña.']);
    expect(register).not.toHaveBeenCalled();
  });

  test('con el servidor apagado avisa de que no hay conexión', async () => {
    const { api } = open();
    api.isDown = true;
    fireEvent.click(button('Cuenta'));
    fireEvent.click(button('Crear cuenta'));
    fill(ANA.email, ANA.password);

    submit('Crear cuenta');

    expect((await screen.findByRole('alert')).textContent).toContain(
      'No se puede conectar con el servidor.',
    );
    // El formulario sigue relleno para volver a intentarlo.
    expect(screen.getByLabelText<HTMLInputElement>('Correo').value).toBe(
      ANA.email,
    );
  });

  test('se puede pasar del registro al inicio de sesión y volver', () => {
    open();
    fireEvent.click(button('Cuenta'));
    fireEvent.click(button('Crear cuenta'));

    fireEvent.click(button('Iniciar sesión'));
    expect(heading('Iniciar sesión')).toBeTruthy();
    expect(
      screen.getByLabelText<HTMLInputElement>('Contraseña').autocomplete,
    ).toBe('current-password');

    fireEvent.click(button('Volver'));
    expect(heading('Cuenta')).toBeTruthy();
  });
});

describe('inicio de sesión', () => {
  async function loggedOut() {
    const setup = await registerAna();
    fireEvent.click(button('Cerrar sesión'));
    await screen.findByText('Sin cuenta');
    fireEvent.click(button('Iniciar sesión'));
    return setup;
  }

  test('con el correo y la contraseña correctos entra', async () => {
    await loggedOut();

    fill(ANA.email, ANA.password);
    submit('Iniciar sesión');

    expect(await screen.findByText('Sesión iniciada')).toBeTruthy();
    expect(screen.getByText('ana@example.com')).toBeTruthy();
  });

  test('una contraseña incorrecta y un correo inexistente dan el mismo mensaje', async () => {
    await loggedOut();

    fill(ANA.email, 'incorrecta-incorrecta');
    submit('Iniciar sesión');
    const wrongPassword = (await screen.findByRole('alert')).textContent;

    fill('nadie@example.com', ANA.password);
    submit('Iniciar sesión');
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    const unknownEmail = screen.getByRole('alert').textContent;

    expect(wrongPassword).toBe('El correo o la contraseña no son correctos.');
    expect(unknownEmail).toBe(wrongPassword);
    expect(heading('Iniciar sesión')).toBeTruthy();
  });

  test('mientras se envía, el botón lo indica y no se puede repetir', async () => {
    await loggedOut();
    fill(ANA.email, ANA.password);

    submit('Iniciar sesión');

    const pending = button('Iniciando sesión…');
    expect(pending).toHaveProperty('disabled', true);
    await screen.findByText('Sesión iniciada');
  });
});

describe('sesión', () => {
  test('se conserva al recargar', async () => {
    const setup = await registerAna();

    reload(setup);
    fireEvent.click(button('Cuenta'));

    expect(screen.getByText('Sesión iniciada')).toBeTruthy();
    expect(screen.getByText('ana@example.com')).toBeTruthy();
  });

  test('si el servidor ya no la reconoce, se cierra sola al abrir la web', async () => {
    const setup = await registerAna();
    setup.api.expire(setup.sessionStore.current!.token);

    reload(setup);
    fireEvent.click(button('Cuenta'));

    expect(await screen.findByText('Sin cuenta')).toBeTruthy();
    expect(setup.sessionStore.current).toBeNull();
  });

  test('con el servidor apagado se conserva y la cuenta avisa de que no hay conexión', async () => {
    const setup = await registerAna();
    setup.api.isDown = true;

    reload(setup);
    fireEvent.click(button('Cuenta'));

    expect((await screen.findByRole('status')).textContent).toContain(
      'No hay conexión con el servidor.',
    );
    expect(screen.getByText('ana@example.com')).toBeTruthy();
    expect(setup.sessionStore.current).not.toBeNull();
  });

  test('al volver la conexión, reintentar quita el aviso', async () => {
    const setup = await registerAna();
    setup.api.isDown = true;
    reload(setup);
    fireEvent.click(button('Cuenta'));
    await screen.findByRole('status');

    setup.api.isDown = false;
    fireEvent.click(button('Reintentar'));

    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
    expect(screen.getByText('Sesión iniciada')).toBeTruthy();
  });

  test('con el servidor apagado la web sigue funcionando entera', async () => {
    const setup = await registerAna();
    setup.api.isDown = true;
    reload(setup);

    fireEvent.click(button('Empezar ahora'));
    submitCreateForm('Metas', '3x3');
    fireEvent.click(button('Objetivo 1'));

    expect(screen.getByText('1 de 9 conseguidos')).toBeTruthy();
  });
});

describe('cerrar sesión', () => {
  test('invalida la sesión en el servidor y la borra del dispositivo', async () => {
    const { api, sessionStore } = await registerAna();
    const token = sessionStore.current!.token;

    fireEvent.click(button('Cerrar sesión'));

    expect(await screen.findByText('Sin cuenta')).toBeTruthy();
    expect(api.activeTokens()).toEqual([]);
    expect(sessionStore.current).toBeNull();
    await expect(api.me(token)).rejects.toMatchObject({ status: 401 });
  });

  test('con el servidor apagado avisa y la sesión no se cierra', async () => {
    const { api, sessionStore } = await registerAna();
    api.isDown = true;

    fireEvent.click(button('Cerrar sesión'));

    expect((await screen.findByRole('alert')).textContent).toContain(
      'No hay conexión con el servidor.',
    );
    expect(screen.getByText('Sesión iniciada')).toBeTruthy();
    expect(sessionStore.current).not.toBeNull();
  });
});

describe('borrar la cuenta', () => {
  test('pide confirmación y cancelar no borra nada', async () => {
    const { api } = await registerAna();

    fireEvent.click(button('Borrar cuenta'));

    const dialog = within(
      screen.getByRole('dialog', { name: '¿Borrar tu cuenta?' }),
    );
    expect(dialog.getByText(/ana@example\.com/)).toBeTruthy();
    fireEvent.click(dialog.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(api.emails()).toEqual(['ana@example.com']);
    expect(screen.getByText('Sesión iniciada')).toBeTruthy();
  });

  test('al confirmar borra la cuenta del servidor y cierra la sesión', async () => {
    const { api, sessionStore } = await registerAna();

    fireEvent.click(button('Borrar cuenta'));
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Borrar cuenta',
      }),
    );

    expect(await screen.findByText('Sin cuenta')).toBeTruthy();
    expect(api.emails()).toEqual([]);
    expect(api.activeTokens()).toEqual([]);
    expect(sessionStore.current).toBeNull();
  });

  test('los tableros del dispositivo se conservan', async () => {
    const storage = createMemoryStorage();
    const services = {
      api: createFakeAccountApi(),
      sessionStore: createMemorySessionStore(),
    };
    render(
      <App
        initialData={EMPTY_DATA}
        storage={storage}
        accountServices={services}
      />,
    );
    fireEvent.click(button('Empezar ahora'));
    submitCreateForm('Metas', '3x3');
    fireEvent.click(button('Objetivo 1'));
    fireEvent.click(button('Cuenta'));
    fireEvent.click(button('Crear cuenta'));
    fill(ANA.email, ANA.password);
    submit('Crear cuenta');
    await screen.findByText('Sesión iniciada');

    fireEvent.click(button('Borrar cuenta'));
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Borrar cuenta',
      }),
    );
    await screen.findByText('Sin cuenta');
    fireEvent.click(button('Volver'));

    expect(heading('Metas')).toBeTruthy();
    expect(screen.getByText('1 de 9 conseguidos')).toBeTruthy();
  });

  test('con el servidor apagado avisa y no cierra la sesión', async () => {
    const { api, sessionStore } = await registerAna();
    api.isDown = true;

    fireEvent.click(button('Borrar cuenta'));
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Borrar cuenta',
      }),
    );

    expect((await screen.findByRole('alert')).textContent).toContain(
      'No hay conexión con el servidor.',
    );
    expect(sessionStore.current).not.toBeNull();
  });
});

describe('cliente de la API', () => {
  function client(reply: () => Response | Promise<Response>) {
    const fetchFn = vi.fn(async () => reply());
    return {
      api: createAccountApi('http://api.test/', fetchFn as typeof fetch),
      fetchFn,
    };
  }

  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });

  test('registra con el correo y la contraseña en el cuerpo', async () => {
    const session = {
      token: 't'.repeat(43),
      user: { id: '1', email: ANA.email },
    };
    const { api, fetchFn } = client(() => json(201, session));

    expect(await api.register(ANA.email, ANA.password)).toEqual(session);

    const [url, init] = fetchFn.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe('http://api.test/auth/register');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual(ANA);
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
  });

  test('envía la sesión en la cabecera Authorization, no en cookies', async () => {
    const { api, fetchFn } = client(() =>
      json(200, { user: { id: '1', email: ANA.email } }),
    );

    expect(await api.me('mi-sesion')).toEqual({ id: '1', email: ANA.email });

    const [url, init] = fetchFn.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe('http://api.test/auth/me');
    expect(init.headers).toEqual({ Authorization: 'Bearer mi-sesion' });
    expect(init.credentials).toBeUndefined();
  });

  test('una respuesta sin cuerpo, como la de cerrar sesión, no falla', async () => {
    const { api } = client(() => new Response(null, { status: 204 }));

    await expect(api.logout('mi-sesion')).resolves.toBeNull();
  });

  test('un error de la API conserva el estado, el mensaje y los campos', async () => {
    const { api } = client(() =>
      json(409, {
        message: 'Ya existe una cuenta con ese correo.',
        errors: { email: 'Ya existe una cuenta con ese correo.' },
      }),
    );

    const error = await api.register(ANA.email, ANA.password).catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 409,
      message: 'Ya existe una cuenta con ese correo.',
      fieldErrors: { email: 'Ya existe una cuenta con ese correo.' },
    });
  });

  test('un error sin cuerpo JSON da un mensaje genérico', async () => {
    const { api } = client(
      () => new Response('<html>502</html>', { status: 502 }),
    );

    const error = await api.login(ANA.email, ANA.password).catch((e) => e);

    expect(error).toMatchObject({
      status: 502,
      message: 'El servidor ha respondido con un error.',
      fieldErrors: {},
    });
  });

  test('si no hay red, lanza NetworkError', async () => {
    const { api } = client(() => {
      throw new TypeError('Failed to fetch');
    });

    await expect(api.me('mi-sesion')).rejects.toBeInstanceOf(NetworkError);
  });
});

describe('sesión guardada en el dispositivo', () => {
  const session = { token: 'mi-sesion', user: { id: '1', email: ANA.email } };

  test('guarda, carga y borra la sesión en localStorage', () => {
    localStorage.clear();
    const store = createLocalSessionStore();
    expect(store.load()).toBeNull();

    store.save(session);
    expect(createLocalSessionStore().load()).toEqual(session);

    store.clear();
    expect(store.load()).toBeNull();
  });

  test.each([
    'no es json',
    '{"token":5}',
    '{"token":"","user":{}}',
    'null',
    '[]',
  ])('con un valor guardado sin sentido (%s) no hay sesión', (value) => {
    localStorage.setItem('bingogoals.session', value);

    expect(createLocalSessionStore().load()).toBeNull();
  });

  test('si el almacenamiento no está disponible, no falla', () => {
    const broken = {
      getItem() {
        throw new Error('bloqueado');
      },
      setItem() {
        throw new Error('bloqueado');
      },
      removeItem() {
        throw new Error('bloqueado');
      },
    };
    const store = createLocalSessionStore(broken);

    expect(store.load()).toBeNull();
    expect(() => store.save(session)).not.toThrow();
    expect(() => store.clear()).not.toThrow();
  });
});
