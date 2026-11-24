/**
 * @format
 */

import React from 'react';
import {Text} from 'react-native';
import {act, create} from 'react-test-renderer';

import {initializeApp} from '../src/bootstrap/initializeApp';
import {MIN_VISIBLE_MS} from '../src/splash/splashTheme';
import {useSplashGate} from '../src/splash/useSplashGate';

jest.mock('../src/bootstrap/initializeApp', () => ({
  initializeApp: jest.fn(),
}));

function Harness({handoffAt}) {
  const open = useSplashGate(handoffAt);
  return <Text>{String(open)}</Text>;
}

function readGate(renderer) {
  return renderer.root.findByType(Text).props.children;
}

/** Renderiza el harness y deja que las promesas pendientes se resuelvan. */
async function render(handoffAt) {
  let renderer;

  await act(async () => {
    renderer = create(<Harness handoffAt={handoffAt} />);
  });

  return renderer;
}

describe('useSplashGate', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    initializeApp.mockReset();
    initializeApp.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('permanece cerrado mientras no hubo traspaso a la capa JS', async () => {
    const renderer = await render(null);

    // La inicializacion ya termino, pero sin traspaso no hay wordmark que leer.
    await act(async () => {
      jest.advanceTimersByTime(MIN_VISIBLE_MS * 5);
    });

    expect(readGate(renderer)).toBe('false');
  });

  it('permanece cerrado si la inicializacion termino pero falta el minimo', async () => {
    const renderer = await render(Date.now());

    await act(async () => {
      jest.advanceTimersByTime(MIN_VISIBLE_MS - 1);
    });

    expect(readGate(renderer)).toBe('false');
  });

  it('permanece cerrado si paso el minimo pero la inicializacion no termino', async () => {
    initializeApp.mockReturnValue(new Promise(() => {}));

    const renderer = await render(Date.now());

    await act(async () => {
      jest.advanceTimersByTime(MIN_VISIBLE_MS * 3);
    });

    expect(readGate(renderer)).toBe('false');
  });

  it('abre cuando se cumplen ambas condiciones', async () => {
    const renderer = await render(Date.now());

    await act(async () => {
      jest.advanceTimersByTime(MIN_VISIBLE_MS);
    });

    expect(readGate(renderer)).toBe('true');
  });

  it('abre igual si la inicializacion falla, sin atrapar al usuario', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    initializeApp.mockRejectedValue(new Error('sin red'));

    const renderer = await render(Date.now());

    await act(async () => {
      jest.advanceTimersByTime(MIN_VISIBLE_MS);
    });

    expect(readGate(renderer)).toBe('true');
    expect(consoleError).toHaveBeenCalled();

    consoleError.mockRestore();
  });

  it('descuenta el tiempo ya transcurrido desde el traspaso', async () => {
    // El traspaso ocurrio hace MIN_VISIBLE_MS - 50: solo deberian faltar 50 ms.
    const renderer = await render(Date.now() - (MIN_VISIBLE_MS - 50));

    await act(async () => {
      jest.advanceTimersByTime(50);
    });

    expect(readGate(renderer)).toBe('true');
  });

  it('limpia el timeout al desmontar', async () => {
    // No sirve mirar jest.getTimerCount(): React y el preset de React Native
    // dejan timers propios, asi que el contador global no dice nada sobre los
    // nuestros. Se rastrea el id concreto del timeout del minimo visible.
    const setSpy = jest.spyOn(global, 'setTimeout');
    const clearSpy = jest.spyOn(global, 'clearTimeout');

    const renderer = await render(Date.now());

    const ourCall = setSpy.mock.calls.findIndex(
      ([, delay]) => delay === MIN_VISIBLE_MS,
    );
    expect(ourCall).toBeGreaterThanOrEqual(0);
    const ourTimeoutId = setSpy.mock.results[ourCall].value;

    await act(async () => {
      renderer.unmount();
    });

    expect(clearSpy).toHaveBeenCalledWith(ourTimeoutId);

    setSpy.mockRestore();
    clearSpy.mockRestore();
  });
});
