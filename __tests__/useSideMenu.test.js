/**
 * @format
 */

import React from 'react';
import {Animated, Text} from 'react-native';
import {act, create} from 'react-test-renderer';

import {MOTION} from '../src/theme/masonTheme';
import {useSideMenu} from '../src/main/useSideMenu';

let controller;

function Harness() {
  controller = useSideMenu();
  return <Text>{String(controller.isOpen)}</Text>;
}

function render() {
  let renderer;

  act(() => {
    renderer = create(<Harness />);
  });

  return renderer;
}

/**
 * Los tests NO comprueban el valor de `progress` despues de animar.
 *
 * Con useNativeDriver la animacion corre del lado nativo, que bajo Jest esta
 * mockeado: el Animated.Value de JS se queda en su valor inicial pase lo que
 * pase. Un `expect(progress).toBe(1)` fallaria con la implementacion correcta,
 * y —peor— pasaria si alguien quitara useNativeDriver, premiando el cambio
 * equivocado.
 *
 * Se comprueba el contrato observable: `isOpen` y los argumentos con los que se
 * lanza Animated.timing. Que el cajon se desplace de verdad se verifica en
 * dispositivo (T-012), que es la leccion de DD-014 de splash-screen.
 */

describe('useSideMenu', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    controller = undefined;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // REQ-003: arranca replegado.
  it('empieza cerrado', () => {
    render();

    expect(controller.isOpen).toBe(false);
  });

  // REQ-003: la apertura pide la animacion hacia 1 y marca el menu abierto.
  it('open() abre el menu y anima progress hacia 1', () => {
    const timing = jest.spyOn(Animated, 'timing');
    render();

    act(() => {
      controller.open();
      jest.advanceTimersByTime(MOTION.drawerMs);
    });

    expect(controller.isOpen).toBe(true);
    expect(timing).toHaveBeenCalledWith(
      controller.progress,
      expect.objectContaining({toValue: 1}),
    );

    timing.mockRestore();
  });

  // REQ-004: el cierre pide la animacion de vuelta a 0.
  it('close() cierra el menu y anima progress hacia 0', () => {
    render();
    act(() => {
      controller.open();
      jest.advanceTimersByTime(MOTION.drawerMs);
    });

    // El espia se instala DESPUES de abrir, para que solo vea la animacion de
    // cierre y la asercion no pueda pasar por la de apertura.
    const timing = jest.spyOn(Animated, 'timing');
    act(() => {
      controller.close();
      jest.advanceTimersByTime(MOTION.drawerMs);
    });

    expect(controller.isOpen).toBe(false);
    expect(timing).toHaveBeenCalledWith(
      controller.progress,
      expect.objectContaining({toValue: 0}),
    );

    timing.mockRestore();
  });

  // Idempotencia: dos toques seguidos en la hamburguesa no deben encadenar dos
  // animaciones. Se comprueba sobre Animated.timing, no sobre el resultado
  // final, porque el resultado final seria el mismo aunque hubiera dos.
  it('open() repetido no lanza una segunda animacion', () => {
    const timing = jest.spyOn(Animated, 'timing');
    render();

    act(() => {
      controller.open();
      controller.open();
      controller.open();
      jest.advanceTimersByTime(MOTION.drawerMs);
    });

    expect(timing).toHaveBeenCalledTimes(1);
    expect(controller.isOpen).toBe(true);

    timing.mockRestore();
  });

  it('close() con el menu ya cerrado no lanza ninguna animacion', () => {
    const timing = jest.spyOn(Animated, 'timing');
    render();

    act(() => {
      controller.close();
      jest.advanceTimersByTime(MOTION.drawerMs);
    });

    expect(timing).not.toHaveBeenCalled();
    expect(controller.isOpen).toBe(false);

    timing.mockRestore();
  });

  // DD-002: la animacion debe correr en el hilo de UI, o un render lento de JS
  // la entrecorta.
  it('anima con el driver nativo y la curva del diseno', () => {
    const timing = jest.spyOn(Animated, 'timing');
    render();

    act(() => {
      controller.open();
      jest.advanceTimersByTime(MOTION.drawerMs);
    });

    expect(timing).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        toValue: 1,
        duration: MOTION.drawerMs,
        useNativeDriver: true,
      }),
    );

    timing.mockRestore();
  });
});
