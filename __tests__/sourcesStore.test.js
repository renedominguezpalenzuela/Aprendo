/**
 * Tests del store de fuentes.
 *
 * Cubre REQ-004, REQ-005 y REQ-006.
 *
 * @format
 */

import {enableExampleSeedForTests, resetDatabaseForTests} from '../src/db/database';
import {seedExampleDeck} from '../src/sources/exampleDeck';
import {
  getSnapshot,
  initSources,
  refresh,
  resetSourcesForTests,
  subscribe,
} from '../src/sources/sourcesStore';
import {addSource} from '../src/sources/sourcesRepo';
import {makeMemoryDriver} from './support/nodeSqliteDriver';

const SHEET = 'https://docs.google.com/spreadsheets/d/1Hf36KxLKJtv5Ve/edit';

beforeEach(() => {
  resetDatabaseForTests();
  resetSourcesForTests();
});

describe('initSources', () => {
  it('es sincrona: el snapshot esta listo al volver de la llamada (REQ-006)', () => {
    initSources(makeMemoryDriver());

    // Sin await, sin acto, sin efecto: el estado ya esta.
    expect(getSnapshot().status).toBe('ready');
  });

  it('publica la fuente activa desde el primer snapshot (REQ-006)', () => {
    const makeDriver = makeMemoryDriver();
    const driver = makeDriver();

    initSources(() => driver);
    addSource({name: 'Aprendiz', url: SHEET});

    // Se simula un arranque nuevo sobre la MISMA base.
    resetDatabaseForTests();
    resetSourcesForTests();
    initSources(() => driver);

    const state = getSnapshot();
    expect(state.active.name).toBe('Aprendiz');
    expect(state.sources).toHaveLength(1);
  });

  it('es idempotente', () => {
    initSources(makeMemoryDriver());

    expect(() =>
      initSources(() => {
        throw new Error('no deberia abrirse otra vez');
      }),
    ).not.toThrow();
  });

  it('deja el snapshot en error si la base no abre, sin lanzar (REQ-005)', () => {
    initSources(() => {
      throw new Error('disco lleno');
    });

    const state = getSnapshot();
    expect(state.status).toBe('error');
    expect(state.error.message).toBe('disco lleno');
  });
});

describe('getSnapshot', () => {
  it('devuelve la MISMA referencia mientras no cambie nada', () => {
    // Devolver un objeto nuevo en cada llamada mete a useSyncExternalStore en
    // bucle de renders. Es el error clasico con esta API, por eso hay un test.
    initSources(makeMemoryDriver());

    expect(getSnapshot()).toBe(getSnapshot());
  });

  it('devuelve una referencia distinta despues de un refresh', () => {
    initSources(makeMemoryDriver());
    const before = getSnapshot();

    addSource({name: 'A', url: SHEET});
    refresh();

    expect(getSnapshot()).not.toBe(before);
  });

  it('la referencia de `active` es estable dentro del mismo snapshot', () => {
    initSources(makeMemoryDriver());
    addSource({name: 'A', url: SHEET});
    refresh();

    expect(getSnapshot().active).toBe(getSnapshot().active);
  });
});

describe('subscribe', () => {
  it('avisa a los suscriptores en cada refresh', () => {
    initSources(makeMemoryDriver());
    const listener = jest.fn();
    subscribe(listener);

    refresh();
    refresh();

    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('la baja de suscripcion deja de recibir avisos', () => {
    initSources(makeMemoryDriver());
    const listener = jest.fn();
    const unsubscribe = subscribe(listener);

    unsubscribe();
    refresh();

    expect(listener).not.toHaveBeenCalled();
  });
});

describe('refresh', () => {
  it('pasa a estado de error si la lectura falla, sin lanzar (REQ-005)', () => {
    initSources(makeMemoryDriver());
    // Se cierra la base por debajo: la siguiente lectura revienta.
    resetDatabaseForTests();

    expect(() => refresh()).not.toThrow();
    expect(getSnapshot().status).toBe('error');
  });
});

describe('la siembra del ejemplo falla al crear la base (DD-020, delta mazo-de-ejemplo)', () => {
  it('el store queda en error, como cualquier fallo de la base (REQ-005)', () => {
    resetDatabaseForTests();
    resetSourcesForTests();

    const makeDriver = makeMemoryDriver();
    const db = makeDriver();
    enableExampleSeedForTests((conn, now) => {
      seedExampleDeck(conn, now);
      throw new Error('disco lleno a mitad de la siembra');
    });

    initSources(() => db);

    // La pantalla Datos pinta su error de almacenamiento, no una lista vacia que
    // aparentaria una instalacion sana sin ejemplo.
    expect(getSnapshot().status).toBe('error');
    // Y la base no quedo a medias: el siguiente arranque la crea entera.
    expect(db.executeSync('PRAGMA user_version').rows[0].user_version).toBe(0);
  });
});

