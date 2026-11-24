/**
 * @format
 */

import React from 'react';
import {Text, View} from 'react-native';
import {act, create} from 'react-test-renderer';

import {MasonSplash} from '../src/splash/MasonSplash';
import {
  HANDOFF_TIMEOUT_MS,
  LOGO_WIDTH_DP,
  MIN_VISIBLE_MS,
  WORDMARK_GAP,
  WORDMARK_TEXT,
} from '../src/splash/splashTheme';

const mockState = {
  config: null,
  logoStyle: {width: 100, height: 100},
};

jest.mock('react-native-bootsplash', () => ({
  __esModule: true,
  default: {
    useHideAnimation: jest.fn(config => {
      mockState.config = config;
      return {
        container: {
          style: {position: 'absolute', backgroundColor: '#f4f1ea'},
          onLayout: jest.fn(),
        },
        logo: {source: 1, style: mockState.logoStyle},
      };
    }),
    hide: jest.fn(() => Promise.resolve()),
  },
}));

const BootSplash = require('react-native-bootsplash').default;

async function render(onFinish = jest.fn()) {
  let renderer;

  await act(async () => {
    renderer = create(<MasonSplash onFinish={onFinish} />);
  });

  return {renderer, onFinish};
}

/** Simula el traspaso de la capa nativa a la JS. */
async function handoff() {
  await act(async () => {
    mockState.config.animate();
  });
}

describe('MasonSplash', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockState.config = null;
    BootSplash.hide.mockClear();
    BootSplash.useHideAnimation.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('muestra el wordmark', async () => {
    const {renderer} = await render();

    const texts = renderer.root
      .findAllByType(Text)
      .map(node => node.props.children);

    expect(texts).toContain(WORDMARK_TEXT);
  });

  it('posiciona el wordmark en absoluto para no mover el logo', async () => {
    const {renderer} = await render();

    const wordmark = renderer.root
      .findAllByType(Text)
      .find(node => node.props.children === WORDMARK_TEXT);

    const style = Object.assign({}, ...[].concat(wordmark.props.style));

    // Si el texto estuviera en flujo, el contenedor centrado por flexbox
    // desplazaria el logo hacia arriba y habria un salto en el traspaso.
    expect(style.position).toBe('absolute');
    expect(style.top).toBe('50%');

    // Por marginTop y no por transform: el translateY no se aplicaba en
    // dispositivo y el texto quedaba encima del logo.
    expect(style.marginTop).toBe(LOGO_WIDTH_DP / 2 + WORDMARK_GAP);
    expect(style.transform).toBeUndefined();
  });

  it('se oculta al lector de pantalla y no es interactivo', async () => {
    const {renderer} = await render();

    // REQ-013: el splash no es contenido accionable.
    const container = renderer.root.findAllByType(View)[0];

    expect(container.props.accessibilityElementsHidden).toBe(true);
    expect(container.props.importantForAccessibility).toBe(
      'no-hide-descendants',
    );
  });

  it('no deja que el wordmark escale con la fuente del sistema', async () => {
    const {renderer} = await render();

    const wordmark = renderer.root
      .findAllByType(Text)
      .find(node => node.props.children === WORDMARK_TEXT);

    // REQ-008: con fuente de accesibilidad grande desbordaria la composicion.
    expect(wordmark.props.allowFontScaling).toBe(false);
    expect(wordmark.props.numberOfLines).toBe(1);
  });

  it('no le pasa el flag `ready` al hook de bootsplash', async () => {
    await render();

    // Regresion de DD-004: `ready` retrasa el hide() de la capa nativa, no solo
    // la animacion. Usarlo dejaria el wordmark visible ~0 ms.
    const config = BootSplash.useHideAnimation.mock.calls[0][0];
    expect(config.ready).toBeUndefined();
  });

  it('declara las barras del sistema como translucidas', async () => {
    await render();

    // DD-007: sin esto el hook aplica un margen negativo que desalinea la capa
    // JS respecto de la nativa bajo edge-to-edge.
    const config = BootSplash.useHideAnimation.mock.calls[0][0];
    expect(config.statusBarTranslucent).toBe(true);
    expect(config.navigationBarTranslucent).toBe(true);
  });

  it('no se oculta antes del minimo visible tras el traspaso', async () => {
    const {onFinish} = await render();

    await handoff();

    await act(async () => {
      jest.advanceTimersByTime(MIN_VISIBLE_MS - 1);
    });

    expect(onFinish).not.toHaveBeenCalled();
  });

  it('llama onFinish exactamente una vez', async () => {
    const {onFinish} = await render();

    await handoff();

    await act(async () => {
      jest.advanceTimersByTime(MIN_VISIBLE_MS);
    });

    expect(onFinish).toHaveBeenCalledTimes(1);

    // Dejar correr mas tiempo no debe volver a dispararlo.
    await act(async () => {
      jest.advanceTimersByTime(HANDOFF_TIMEOUT_MS * 2);
    });

    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('fuerza el ocultamiento si el traspaso nunca ocurre', async () => {
    const consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const {onFinish} = await render();

    // Nunca se llama animate(): simula un modulo nativo caido.
    await act(async () => {
      jest.advanceTimersByTime(HANDOFF_TIMEOUT_MS);
    });

    expect(BootSplash.hide).toHaveBeenCalledWith({fade: false});
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(consoleWarn).toHaveBeenCalled();

    consoleWarn.mockRestore();
  });

  it('el respaldo sobrevive a un padre que re-renderiza con otra funcion', async () => {
    const consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const onFinish = jest.fn();

    let renderer;
    await act(async () => {
      renderer = create(<MasonSplash onFinish={() => onFinish()} />);
    });

    // El padre re-renderiza varias veces pasando una funcion nueva cada vez. Si
    // `finish` dependiera de la prop, el timeout de respaldo se reiniciaria en
    // cada render y nunca se dispararia.
    for (let i = 0; i < 3; i++) {
      await act(async () => {
        jest.advanceTimersByTime(HANDOFF_TIMEOUT_MS / 4);
        renderer.update(<MasonSplash onFinish={() => onFinish()} />);
      });
    }

    await act(async () => {
      jest.advanceTimersByTime(HANDOFF_TIMEOUT_MS / 4);
    });

    expect(onFinish).toHaveBeenCalledTimes(1);

    consoleWarn.mockRestore();
  });

  it('no dispara el respaldo si el traspaso ocurrio a tiempo', async () => {
    const {onFinish} = await render();

    await handoff();

    await act(async () => {
      jest.advanceTimersByTime(HANDOFF_TIMEOUT_MS * 2);
    });

    expect(BootSplash.hide).not.toHaveBeenCalled();
    expect(onFinish).toHaveBeenCalledTimes(1);
  });
});
