/**
 * Tests del router de vistas.
 *
 * Cubre REQ-047, REQ-048 y REQ-049 de data-sources, y REQ-057 de deck-sync.
 *
 * @format
 */

import React from 'react';
import {BackHandler, Platform, Text} from 'react-native';
import TestRenderer, {act} from 'react-test-renderer';

import {useViewRouter} from '../src/nav/useViewRouter';

/**
 * Monta el router y captura el manejador que registra en BackHandler.
 *
 * @param {{isMenuOpen?: boolean, closeMenu?: () => void, isSyncing?: boolean}} menu
 */
function renderRouter(menu = {}) {
  const props = {
    isMenuOpen: menu.isMenuOpen ?? false,
    closeMenu: menu.closeMenu ?? jest.fn(),
    isSyncing: menu.isSyncing ?? false,
  };
  const box = {current: null};

  function Probe({isMenuOpen, closeMenu, isSyncing}) {
    box.current = useViewRouter({isMenuOpen, closeMenu, isSyncing});

    return <Text>probe</Text>;
  }

  let tree;
  act(() => {
    tree = TestRenderer.create(<Probe {...props} />);
  });

  return {
    box,
    closeMenu: props.closeMenu,
    /** Ultimo manejador registrado. */
    back: () => {
      const calls = BackHandler.addEventListener.mock.calls;
      return calls[calls.length - 1][1];
    },
    rerender: next =>
      act(() => {
        tree.update(<Probe {...props} {...next} />);
      }),
    unmount: () => act(() => tree.unmount()),
  };
}

const remove = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  Platform.OS = 'android';
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation(() => ({remove}));
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('useViewRouter', () => {
  it('arranca en la vista de tarjetas', () => {
    const {box} = renderRouter();

    expect(box.current.activeView).toBe('cards');
  });

  it('navigate cambia de vista (REQ-049)', () => {
    const {box} = renderRouter();

    act(() => box.current.navigate('data'));

    expect(box.current.activeView).toBe('data');
  });
});

describe('atras de Android', () => {
  it('registra UNA sola suscripcion (DD-002)', () => {
    renderRouter();

    expect(BackHandler.addEventListener).toHaveBeenCalledTimes(1);
    expect(BackHandler.addEventListener).toHaveBeenCalledWith(
      'hardwareBackPress',
      expect.any(Function),
    );
  });

  it('con el menu abierto lo repliega y NO cambia de vista (REQ-048)', () => {
    const {box, back, closeMenu, rerender} = renderRouter({isMenuOpen: true});

    act(() => box.current.navigate('data'));
    rerender({isMenuOpen: true});

    let consumed;
    act(() => {
      consumed = back()();
    });

    expect(consumed).toBe(true);
    expect(closeMenu).toHaveBeenCalledTimes(1);
    expect(box.current.activeView).toBe('data');
  });

  it('en Datos con el menu cerrado, vuelve a Tarjetas (REQ-047)', () => {
    const {box, back, closeMenu} = renderRouter();

    act(() => box.current.navigate('data'));

    let consumed;
    act(() => {
      consumed = back()();
    });

    expect(consumed).toBe(true);
    expect(box.current.activeView).toBe('cards');
    expect(closeMenu).not.toHaveBeenCalled();
  });

  it('en Tarjetas con el menu cerrado, deja actuar al sistema (REQ-047)', () => {
    const {back} = renderRouter();

    let consumed;
    act(() => {
      consumed = back()();
    });

    // false = la app se va a segundo plano, que es lo que hace Android siempre.
    expect(consumed).toBe(false);
  });

  it('el menu tiene prioridad sobre la vista (DD-002)', () => {
    // Estando en Datos Y con el menu abierto, atras repliega el menu primero.
    const {box, back, closeMenu, rerender} = renderRouter();

    act(() => box.current.navigate('data'));
    rerender({isMenuOpen: true});

    act(() => back()());

    expect(closeMenu).toHaveBeenCalledTimes(1);
    expect(box.current.activeView).toBe('data');
  });

  it('da de baja la suscripcion al desmontar', () => {
    const {unmount} = renderRouter();

    unmount();

    expect(remove).toHaveBeenCalled();
  });
});

describe('en iOS', () => {
  it('no registra ninguna suscripcion', () => {
    Platform.OS = 'ios';

    renderRouter();

    expect(BackHandler.addEventListener).not.toHaveBeenCalled();
  });

  it('navigate sigue funcionando', () => {
    Platform.OS = 'ios';
    const {box} = renderRouter();

    act(() => box.current.navigate('data'));

    expect(box.current.activeView).toBe('data');
  });
});

// ─── deck-sync ───────────────────────────────────────────────────────────────

describe('el atras durante una actualizacion (deck-sync REQ-057, DD-008)', () => {
  beforeEach(() => {
    Platform.OS = 'android';
    BackHandler.addEventListener.mockClear();
  });

  it('no hace NADA: ni cierra, ni cambia de vista, ni sale de la app', () => {
    const closeMenu = jest.fn();
    const router = renderRouter({isSyncing: true, closeMenu});

    act(() => router.box.current.navigate('data'));

    let consumed;

    // DENTRO de act: si el manejador cambiara de vista, el render tiene que haberse
    // vaciado antes de mirar `activeView`. Leyendolo sin vaciar, esta asercion
    // pasaria aunque la regla de REQ-057 no existiera.
    act(() => {
      consumed = router.back()();
    });

    // `true` = consumido: el sistema tampoco manda la app a segundo plano, que
    // dejaria una descarga larga corriendo detras de una pantalla que no se ve.
    expect(consumed).toBe(true);
    expect(router.box.current.activeView).toBe('data');
    expect(closeMenu).not.toHaveBeenCalled();
  });

  it('gana a las otras dos reglas: ni el menu ni la vista se mueven', () => {
    const closeMenu = jest.fn();
    const router = renderRouter({isSyncing: true, isMenuOpen: true, closeMenu});

    act(() => router.box.current.navigate('data'));

    let consumed;

    act(() => {
      consumed = router.back()();
    });

    expect(consumed).toBe(true);
    // Con el menu abierto y en Datos, sin actualizacion se replegaria el menu.
    // Durante una actualizacion, nada.
    expect(closeMenu).not.toHaveBeenCalled();
    expect(router.box.current.activeView).toBe('data');
  });

  it('en cuanto la actualizacion termina, el atras vuelve a funcionar', () => {
    const closeMenu = jest.fn();
    const router = renderRouter({isSyncing: true, closeMenu});

    act(() => router.box.current.navigate('data'));

    act(() => {
      router.back()();
    });

    expect(router.box.current.activeView).toBe('data');

    router.rerender({isSyncing: false});

    act(() => {
      router.back()();
    });

    expect(router.box.current.activeView).toBe('cards');
  });

  it('sigue habiendo UNA sola suscripcion a BackHandler', () => {
    renderRouter({isSyncing: true});

    // Es la mitad del sentido de DD-008: la ventana de progreso NO se suscribe por
    // su cuenta. Dos suscripciones se ejecutan en orden inverso al de registro, y
    // ese orden depende de donde se monte cada componente.
    expect(BackHandler.addEventListener).toHaveBeenCalledTimes(1);
  });
});
