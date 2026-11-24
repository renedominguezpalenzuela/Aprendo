/**
 * Tests de useSources y useActiveSource.
 *
 * Cubre REQ-023b (doble pulsacion) y REQ-045.
 *
 * @format
 */

import React from 'react';
import {Text} from 'react-native';
import TestRenderer, {act} from 'react-test-renderer';

import {resetDatabaseForTests} from '../src/db/database';
import {initSources, resetSourcesForTests} from '../src/sources/sourcesStore';
import {useActiveSource, useSources} from '../src/sources/useSources';
import {makeMemoryDriver} from './support/nodeSqliteDriver';

const SHEET = 'https://docs.google.com/spreadsheets/d/1Hf36KxLKJtv5Ve/edit';

/**
 * Monta un hook y devuelve un objeto cuyo `.current` es su ultimo valor.
 *
 * @param {() => any} useHook
 */
function renderHook(useHook) {
  const box = {current: null, renders: 0};

  function Probe() {
    box.current = useHook();
    box.renders += 1;

    return <Text>probe</Text>;
  }

  let tree;
  act(() => {
    tree = TestRenderer.create(<Probe />);
  });

  return {box, unmount: () => act(() => tree.unmount())};
}

beforeEach(() => {
  resetDatabaseForTests();
  resetSourcesForTests();
  initSources(makeMemoryDriver());
});

describe('useSources', () => {
  it('expone el estado del store', () => {
    const {box} = renderHook(useSources);

    expect(box.current.state).toEqual({status: 'ready', sources: [], active: null});
  });

  it('add refresca el estado sin recargar nada a mano', () => {
    const {box} = renderHook(useSources);

    act(() => {
      box.current.add({name: 'Aprendiz', url: SHEET});
    });

    expect(box.current.state.sources).toHaveLength(1);
    expect(box.current.state.active.name).toBe('Aprendiz');
  });

  it('devuelve el motivo del nombre duplicado', () => {
    const {box} = renderHook(useSources);

    act(() => {
      box.current.add({name: 'Aprendiz', url: SHEET});
    });

    let result;
    act(() => {
      result = box.current.add({name: 'aprendiz', url: SHEET});
    });

    expect(result).toEqual({ok: false, reason: 'DUPLICATE_NAME'});
    expect(box.current.state.sources).toHaveLength(1);
  });

  it('cinco pulsaciones seguidas de add producen UNA fuente (REQ-023b)', () => {
    const {box} = renderHook(useSources);

    act(() => {
      // Es lo que hace una doble pulsacion rapida: el manejador de la segunda
      // se ejecuta con el estado del formulario de antes de vaciarse, asi que
      // reintenta el MISMO nombre. Lo para el indice unico (DD-007), no un
      // cerrojo. Ver DD-009.
      for (let i = 0; i < 5; i += 1) {
        box.current.add({name: 'Aprendiz', url: SHEET});
      }
    });

    expect(box.current.state.sources).toHaveLength(1);
  });

  it('borrar dos veces la misma fila no rompe el estado (REQ-023b)', () => {
    const {box} = renderHook(useSources);

    act(() => {
      box.current.add({name: 'A', url: SHEET});
    });
    act(() => {
      box.current.add({name: 'B', url: SHEET});
    });

    const b = box.current.state.sources.find(s => s.name === 'B');

    act(() => {
      box.current.remove(b.id);
      box.current.remove(b.id);
    });

    // La segunda es una operacion nula: la fila ya no esta.
    expect(box.current.state.sources.map(s => s.name)).toEqual(['A']);
    expect(box.current.state.active.name).toBe('A');
  });

  it('una rafaga de mutaciones deja la lista y la activa coherentes (REQ-023b)', () => {
    const {box} = renderHook(useSources);

    act(() => {
      box.current.add({name: 'A', url: SHEET});
    });
    act(() => {
      box.current.add({name: 'B', url: SHEET});
    });
    act(() => {
      box.current.add({name: 'C', url: SHEET});
    });

    const ids = Object.fromEntries(
      box.current.state.sources.map(s => [s.name, s.id]),
    );

    act(() => {
      // Todo en el mismo tick, como si el usuario aporrease la pantalla. Cada
      // mutacion es atomica, asi que no pueden entrelazarse.
      box.current.activate(ids.B);
      box.current.activate(ids.C);
      box.current.remove(ids.A);
      box.current.activate(ids.B);
    });

    const state = box.current.state;
    expect(state.sources.map(s => s.name)).toEqual(['B', 'C']);
    expect(state.active.name).toBe('B');
    expect(state.sources.filter(s => s.isActive)).toHaveLength(1);
  });

  it('activar la fuente que se acaba de borrar no deja la lista sin activa', () => {
    const {box} = renderHook(useSources);

    act(() => {
      box.current.add({name: 'A', url: SHEET});
    });
    act(() => {
      box.current.add({name: 'B', url: SHEET});
    });

    const b = box.current.state.sources.find(s => s.name === 'B');

    act(() => {
      box.current.remove(b.id);
      box.current.activate(b.id);
    });

    expect(box.current.state.active.name).toBe('A');
  });

  it('activate reordena: la activa pasa a primera (REQ-021)', () => {
    const {box} = renderHook(useSources);

    act(() => {
      box.current.add({name: 'A', url: SHEET});
    });
    act(() => {
      box.current.add({name: 'B', url: SHEET});
    });

    const b = box.current.state.sources.find(s => s.name === 'B');
    act(() => {
      box.current.activate(b.id);
    });

    expect(box.current.state.sources.map(s => s.name)).toEqual(['B', 'A']);
  });

  it('remove de la activa reasigna (REQ-035)', () => {
    const {box} = renderHook(useSources);

    act(() => {
      box.current.add({name: 'A', url: SHEET});
    });
    act(() => {
      box.current.add({name: 'B', url: SHEET});
    });

    const a = box.current.state.sources.find(s => s.name === 'A');
    act(() => {
      box.current.remove(a.id);
    });

    expect(box.current.state.active.name).toBe('B');
  });
});

describe('useSources con la base rota a mitad de sesion', () => {
  /**
   * Rompe las escrituras de la base ya abierta, como haria un disco que se
   * llena con la app en marcha.
   *
   * @returns {{box: {current: any}}}
   */
  function renderWithBrokenWrites() {
    resetDatabaseForTests();
    resetSourcesForTests();
    const driver = makeMemoryDriver()();
    initSources(() => driver);

    const rendered = renderHook(useSources);

    const original = driver.executeSync;
    driver.executeSync = (sql, params) => {
      if (/INSERT|UPDATE|DELETE/i.test(sql)) {
        throw new Error('database or disk is full');
      }
      return original(sql, params);
    };

    return rendered;
  }

  it('NO deja escapar la excepcion al manejador del boton (REQ-005)', () => {
    // Sin esto, la excepcion sale del onPress que la disparo y queda sin
    // capturar: en produccion, la app se cae.
    const {box} = renderWithBrokenWrites();

    expect(() => {
      act(() => {
        box.current.add({name: 'A', url: SHEET});
      });
    }).not.toThrow();
  });

  it('publica el fallo como estado de la pantalla (REQ-005)', () => {
    const {box} = renderWithBrokenWrites();

    act(() => {
      box.current.add({name: 'A', url: SHEET});
    });

    expect(box.current.state.status).toBe('error');
    expect(box.current.state.error.message).toMatch(/disk is full/);
  });

  it('devuelve un motivo que la interfaz puede traducir', () => {
    const {box} = renderWithBrokenWrites();

    let result;
    act(() => {
      result = box.current.add({name: 'A', url: SHEET});
    });

    expect(result).toEqual({ok: false, reason: 'DATABASE_ERROR'});
  });

  it('lo mismo para borrar y activar, no solo para anadir', () => {
    const {box} = renderWithBrokenWrites();

    expect(() => {
      act(() => {
        box.current.remove(1);
      });
    }).not.toThrow();
    expect(box.current.state.status).toBe('error');
  });
});

describe('useActiveSource', () => {
  it('devuelve null sin fuentes', () => {
    const {box} = renderHook(useActiveSource);

    expect(box.current).toBeNull();
  });

  it('refleja el cambio de fuente activa sin reiniciar nada (REQ-045)', () => {
    const {box: sources} = renderHook(useSources);
    const {box: active} = renderHook(useActiveSource);

    act(() => {
      sources.current.add({name: 'Aprendiz', url: SHEET});
    });

    expect(active.current.name).toBe('Aprendiz');

    act(() => {
      sources.current.add({name: 'Companero', url: SHEET});
    });
    const companero = sources.current.state.sources.find(s => s.name === 'Companero');
    act(() => {
      sources.current.activate(companero.id);
    });

    expect(active.current.name).toBe('Companero');
  });

  it('no entra en bucle de renders (DD-005)', () => {
    // Si getSnapshot devolviera un objeto nuevo en cada llamada,
    // useSyncExternalStore repintaria sin parar y este contador se disparia.
    const {box} = renderHook(useActiveSource);

    expect(box.renders).toBeLessThan(5);
  });
});
