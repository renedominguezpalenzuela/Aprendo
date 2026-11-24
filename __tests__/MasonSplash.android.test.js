/**
 * En Android el splash es UNICAMENTE la capa nativa: no hay overlay JS ni
 * wordmark. Estos tests fijan ese contrato, porque es una divergencia
 * deliberada respecto de iOS y sin ellos alguien podria "unificar" el
 * componente sin saber que rompe algo medido.
 *
 * @format
 */

import React from 'react';
import {Text, View} from 'react-native';
import {act, create} from 'react-test-renderer';

// El modulo exporta el objeto como `default`; sin el envoltorio, `Platform`
// llega como undefined al importarse desde 'react-native'.
jest.mock('react-native/Libraries/Utilities/Platform', () => ({
  __esModule: true,
  default: {
    OS: 'android',
    select: objs => objs.android ?? objs.default,
  },
}));

const mockState = {config: null};

jest.mock('react-native-bootsplash', () => ({
  __esModule: true,
  default: {
    useHideAnimation: jest.fn(config => {
      mockState.config = config;
      return {
        container: {style: {}, onLayout: jest.fn()},
        logo: {source: 1, style: {width: 192, height: 192}},
      };
    }),
    hide: jest.fn(() => Promise.resolve()),
  },
}));

const BootSplash = require('react-native-bootsplash').default;
const {MasonSplash} = require('../src/splash/MasonSplash');

async function render(onFinish = jest.fn()) {
  let renderer;

  await act(async () => {
    renderer = create(<MasonSplash onFinish={onFinish} />);
  });

  return {renderer, onFinish};
}

describe('MasonSplash en Android', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockState.config = null;
    BootSplash.hide.mockClear();
    BootSplash.useHideAnimation.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('no renderiza ningun overlay', async () => {
    const {renderer} = await render();

    expect(renderer.root.findAllByType(View)).toHaveLength(0);
    expect(renderer.root.findAllByType(Text)).toHaveLength(0);
  });

  it('no muestra el wordmark', async () => {
    const {renderer} = await render();

    // El wordmark no entra junto al logo en la mascara circular de Android.
    expect(renderer.root.findAllByType(Text)).toHaveLength(0);
  });

  it('no usa useHideAnimation', async () => {
    await render();

    // Ese hook existe para alinear la capa JS con la nativa. En Android no hay
    // capa JS que alinear.
    expect(BootSplash.useHideAnimation).not.toHaveBeenCalled();
  });

  it('oculta la capa nativa y termina', async () => {
    // Si nadie llama a hide(), el splash nativo se queda para siempre.
    const {onFinish} = await render();

    await act(async () => {
      jest.runAllTimers();
    });

    expect(BootSplash.hide).toHaveBeenCalledWith({fade: false});
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('termina igual si hide() falla, sin atrapar al usuario', async () => {
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    BootSplash.hide.mockRejectedValueOnce(new Error('modulo caido'));

    const {onFinish} = await render();

    await act(async () => {
      jest.runAllTimers();
    });

    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalled();

    consoleError.mockRestore();
  });
});
