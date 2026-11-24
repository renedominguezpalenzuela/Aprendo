/**
 * @format
 */

import React from 'react';
import {StatusBar, useColorScheme} from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

import App from '../App';
import {MainView} from '../src/main/MainView';
import {MasonSplash} from '../src/splash/MasonSplash';
import {MIN_VISIBLE_MS} from '../src/splash/splashTheme';

jest.mock('react-native/Libraries/Utilities/useColorScheme');

// El modulo nativo de safe-area-context no existe bajo Jest, asi que
// initialWindowMetrics seria null y el provider no renderizaria a sus hijos.
// Se le dan metricas de un telefono con isla dinamica.
jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  return {
    ...actual,
    initialWindowMetrics: {
      frame: {x: 0, y: 0, width: 430, height: 932},
      insets: {top: 59, left: 0, right: 0, bottom: 34},
    },
  };
});

const BootSplash = require('react-native-bootsplash').default;

// MasonSplash arma un timeout de respaldo de HANDOFF_TIMEOUT_MS. Con timers
// reales ese timer mantiene vivo el worker de Jest despues de terminar los
// tests, asi que se usan timers falsos y se desmonta cada arbol.
let mounted = [];

beforeEach(() => {
  jest.useFakeTimers();
  BootSplash.useHideAnimation.mockClear();
  BootSplash.hide.mockClear();
  useColorScheme.mockReturnValue('light');
});

afterEach(async () => {
  await ReactTestRenderer.act(() => {
    mounted.forEach(renderer => renderer.unmount());
  });
  mounted = [];
  jest.useRealTimers();
});

async function render() {
  let renderer;

  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<App />);
  });

  mounted.push(renderer);

  return renderer;
}

test('renders correctly', async () => {
  const renderer = await render();

  expect(renderer.root).toBeTruthy();
});

test('monta el contenido debajo del splash, no despues', async () => {
  const renderer = await render();

  // DD-008 / REQ-009: si el contenido se montara recien al terminar el splash,
  // habria un frame vacio mientras React renderiza el primer arbol.
  expect(renderer.root.findAllByType(MainView)).toHaveLength(1);
  expect(renderer.root.findAllByType(MasonSplash)).toHaveLength(1);
});

test('desmonta el splash cuando termina, dejando el contenido', async () => {
  const renderer = await render();

  const splash = renderer.root.findByType(MasonSplash);

  await ReactTestRenderer.act(() => {
    splash.props.onFinish();
  });

  expect(renderer.root.findAllByType(MasonSplash)).toHaveLength(0);
  expect(renderer.root.findAllByType(MainView)).toHaveLength(1);
});

test('tras el splash las barras del sistema van claras aunque el tema sea claro', async () => {
  // REQ-033 / DD-004. Se prueba con el sistema en modo CLARO a proposito: es el
  // caso que fallaba cuando barStyle salia de useColorScheme(), y el que un
  // repaso del codigo pasa por alto porque "en modo oscuro se ve bien".
  useColorScheme.mockReturnValue('light');

  const renderer = await render();

  // Con el splash visible el fondo es hueso: iconos oscuros.
  expect(renderer.root.findByType(StatusBar).props.barStyle).toBe('dark-content');

  const splash = renderer.root.findByType(MasonSplash);
  await ReactTestRenderer.act(() => {
    splash.props.onFinish();
  });

  // Ya en la vista principal, que es oscura: iconos claros.
  expect(renderer.root.findByType(StatusBar).props.barStyle).toBe('light-content');
});

test('el estilo de las barras no depende del tema del sistema', async () => {
  for (const scheme of ['light', 'dark', null]) {
    useColorScheme.mockReturnValue(scheme);

    const renderer = await render();
    await ReactTestRenderer.act(() => {
      renderer.root.findByType(MasonSplash).props.onFinish();
    });

    expect(renderer.root.findByType(StatusBar).props.barStyle).toBe(
      'light-content',
    );
  }
});

test('flujo completo: montaje -> traspaso -> minimo visible -> desmontaje', async () => {
  // Este es el unico test que recorre el cableado real de punta a punta: App
  // monta MasonSplash, que usa el useSplashGate real, que espera al
  // initializeApp real. Lo unico simulado es el modulo nativo.
  const renderer = await render();

  expect(renderer.root.findAllByType(MasonSplash)).toHaveLength(1);

  // La capa nativa entrega el control a la JS.
  const config = BootSplash.useHideAnimation.mock.calls.at(-1)[0];
  await ReactTestRenderer.act(async () => {
    config.animate();
  });

  // Todavia no: el wordmark tiene que estar visible el minimo exigido.
  await ReactTestRenderer.act(async () => {
    jest.advanceTimersByTime(MIN_VISIBLE_MS - 1);
  });
  expect(renderer.root.findAllByType(MasonSplash)).toHaveLength(1);

  await ReactTestRenderer.act(async () => {
    jest.advanceTimersByTime(1);
  });

  expect(renderer.root.findAllByType(MasonSplash)).toHaveLength(0);
  expect(renderer.root.findAllByType(MainView)).toHaveLength(1);
});


test('las fuentes se inicializan ANTES del primer render (REQ-006)', async () => {
  // App.js llama a initSources() a nivel de MODULO, no en un efecto: el header
  // tiene que poder mostrar el nombre de la fuente activa desde el primer
  // frame, en vez de pintar el titulo por defecto y sustituirlo despues.
  //
  // Se comprueba sobre el modulo ya importado: si la llamada viviera en un
  // efecto, el store seguiria sin inicializar hasta el primer render.
  const {getSnapshot} = require('../src/sources/sourcesStore');

  expect(getSnapshot()).toBeDefined();
  expect(['ready', 'error']).toContain(getSnapshot().status);

  // Y montar la app no lanza aunque la base no exista bajo Jest: openDatabase
  // devuelve el error en vez de propagarlo (REQ-005).
  const renderer = await render();
  expect(renderer.root.findAllByType(MainView)).toHaveLength(1);
});
