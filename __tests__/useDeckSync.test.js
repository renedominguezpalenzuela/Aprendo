/**
 * Tests de deckSyncStore y useDeckSync.
 *
 * REQ-012, REQ-013 (el cerrojo), REQ-050, REQ-053, REQ-054, REQ-056.
 *
 * La red se inyecta por `deps.net` y la base es `node:sqlite` en memoria: la
 * secuencia se ejercita entera sin tocar los globales de red (DD-004).
 *
 * @format
 */

import React from 'react';
import {Text} from 'react-native';
import TestRenderer, {act} from 'react-test-renderer';

import {openDatabase, resetDatabaseForTests} from '../src/db/database';
import {initDecks, resetDecksForTests} from '../src/decks/deckStore';
import {
  getSnapshot,
  isSyncing,
  resetDeckSyncForTests,
  startSync,
  subscribe,
} from '../src/decks/deckSyncStore';
import {listQuestions} from '../src/decks/decksRepo';
import {useDeckSync, useIsSyncing} from '../src/decks/useDeckSync';
import {addSource} from '../src/sources/sourcesRepo';
import {initSources, refresh, resetSourcesForTests} from '../src/sources/sourcesStore';
import {makeMemoryDriver} from './support/nodeSqliteDriver';
import {HEADER, toCsv} from './support/sheetFixtures';

const SHEET = 'https://docs.google.com/spreadsheets/d/1Hf36KxLKJtv5Ve/edit';

/** @type {import('../src/sources/sourcesRepo').Source} */
let fisica;
/** @type {import('../src/sources/sourcesRepo').Source} */
let mates;

beforeEach(() => {
  resetDatabaseForTests();
  resetSourcesForTests();
  resetDecksForTests();
  resetDeckSyncForTests();
  openDatabase(makeMemoryDriver());
  initSources();
  initDecks();

  addSource({name: 'Fisica', url: SHEET});
  addSource({name: 'Mates', url: `${SHEET}?gid=2`});
  refresh();

  const db = openDatabase().db;
  const rows = db.executeSync(
    'SELECT id, name, url_csv FROM sources ORDER BY id',
  ).rows;

  fisica = {id: rows[0].id, name: rows[0].name, urlCsv: rows[0].url_csv};
  mates = {id: rows[1].id, name: rows[1].name, urlCsv: rows[1].url_csv};
});

/**
 * @param {number} count
 * @returns {string}
 */
function sheetOf(count) {
  const rows = [HEADER];

  for (let i = 0; i < count; i += 1) {
    rows.push([`P${i}`, '', `R${i}`, '', '', '']);
  }

  return toCsv(rows);
}

/**
 * @param {{text?: string, delayMs?: number}} [plan]
 * @returns {{downloadText: jest.Mock, downloadBytes: jest.Mock}}
 */
function fakeNet(plan = {}) {
  return {
    downloadText: jest.fn(
      () =>
        new Promise(resolve => {
          const result = {ok: true, text: plan.text ?? sheetOf(3)};

          if (plan.delayMs == null) {
            resolve(result);
            return;
          }

          setTimeout(() => resolve(result), plan.delayMs);
        }),
    ),
    downloadBytes: jest.fn(() =>
      Promise.resolve({ok: true, mime: 'image/png', bytes: new Uint8Array(16)}),
    ),
  };
}

/**
 * @param {() => any} useHook
 * @returns {{box: {current: any, renders: number}}}
 */
function renderHook(useHook) {
  const box = {current: null, renders: 0};

  function Probe() {
    box.current = useHook();
    box.renders += 1;

    return <Text>probe</Text>;
  }

  act(() => {
    TestRenderer.create(<Probe />);
  });

  return {box};
}

describe('el cerrojo: una sola actualizacion a la vez (REQ-013, DD-007)', () => {
  it('la segunda no se lanza, ni siquiera de OTRA fuente', async () => {
    const net = fakeNet({delayMs: 20});

    const first = startSync(fisica, {net});
    const second = await startSync(mates, {net});

    // La de Mates no arranca: ni una peticion suya.
    expect(second).toEqual({ok: false});
    expect(net.downloadText).toHaveBeenCalledTimes(1);

    await act(async () => {
      await first;
    });

    expect(net.downloadText).toHaveBeenCalledTimes(1);
  });

  it('cinco pulsaciones seguidas producen UNA actualizacion', async () => {
    const net = fakeNet({delayMs: 20});

    const running = startSync(fisica, {net});

    await Promise.all([
      startSync(fisica, {net}),
      startSync(fisica, {net}),
      startSync(mates, {net}),
      startSync(fisica, {net}),
    ]);

    await act(async () => {
      await running;
    });

    expect(net.downloadText).toHaveBeenCalledTimes(1);
    expect(listQuestions(fisica.id)).toHaveLength(3);
  });

  it('al terminar, el cerrojo queda libre para la siguiente', async () => {
    const net = fakeNet();

    await act(async () => {
      await startSync(fisica, {net});
    });

    expect(isSyncing()).toBe(false);

    await act(async () => {
      await startSync(mates, {net});
    });

    expect(net.downloadText).toHaveBeenCalledTimes(2);
  });

  it('un fallo NO deja el cerrojo echado', async () => {
    const failing = {
      downloadText: jest.fn(() =>
        Promise.resolve({ok: false, reason: 'NO_CONNECTION'}),
      ),
      downloadBytes: jest.fn(),
    };

    await act(async () => {
      await startSync(fisica, {net: failing});
    });

    expect(isSyncing()).toBe(false);

    const net = fakeNet();

    await act(async () => {
      await startSync(fisica, {net});
    });

    expect(net.downloadText).toHaveBeenCalledTimes(1);
  });
});

describe('fases del estado (REQ-050, REQ-053, REQ-056)', () => {
  it("empieza en 'idle' y pasa a 'preparing' sin numeros", async () => {
    expect(getSnapshot()).toEqual({phase: 'idle'});

    const net = fakeNet({delayMs: 20});
    const running = startSync(fisica, {net});

    // Antes de interpretar el CSV: ni total ni contador.
    expect(getSnapshot()).toEqual({
      phase: 'preparing',
      sourceId: fisica.id,
      sourceName: 'Fisica',
    });
    expect(getSnapshot().total).toBeUndefined();

    await act(async () => {
      await running;
    });
  });

  it("pasa por 'preparing', 'working' con contador, y acaba en 'result'", async () => {
    /** @type {Array<Object>} */
    const phases = [];
    const unsubscribe = subscribe(() => phases.push(getSnapshot()));

    const {box} = renderHook(useDeckSync);

    await act(async () => {
      await startSync(fisica, {net: fakeNet({text: sheetOf(4)})});
    });

    unsubscribe();

    // La SECUENCIA, no solo el estado final: un test que dice comprobar el paso por
    // 'working' y solo mira el desenlace pasaria igual sin que 'working' existiera.
    expect(phases.map(state => state.phase)).toEqual([
      'preparing',
      'working',
      'working',
      'working',
      'working',
      'working',
      'result',
    ]);

    // Y el contador avanza 0,1,2,3,4 sobre un total de 4.
    const counts = phases
      .filter(state => state.phase === 'working')
      .map(state => `${state.done}/${state.total}`);

    expect(counts).toEqual(['0/4', '1/4', '2/4', '3/4', '4/4']);

    expect(box.current.state).toMatchObject({
      phase: 'result',
      saved: 4,
      skippedImages: 0,
      failedImages: 0,
    });
  });

  it("una cancelacion vuelve a 'idle' sin mensaje que reprochar", async () => {
    const net = fakeNet({delayMs: 20});
    const {box} = renderHook(useDeckSync);

    await act(async () => {
      const running = startSync(fisica, {net});

      box.current.cancel();
      await running;
    });

    // 'idle', no 'error': el usuario hizo lo que queria.
    expect(box.current.state).toEqual({phase: 'idle'});
  });

  it("un fallo pasa a 'error' con su motivo, y dismiss lo cierra", async () => {
    const failing = {
      downloadText: jest.fn(() =>
        Promise.resolve({ok: false, reason: 'HTTP_ERROR', status: 404}),
      ),
      downloadBytes: jest.fn(),
    };

    const {box} = renderHook(useDeckSync);

    await act(async () => {
      await startSync(fisica, {net: failing});
    });

    expect(box.current.state).toMatchObject({
      phase: 'error',
      reason: 'HTTP_ERROR',
      status: 404,
      sourceName: 'Fisica',
    });

    act(() => box.current.dismiss());

    expect(box.current.state).toEqual({phase: 'idle'});
  });

  it('isSyncing es true solo mientras se descarga, no en el desenlace', async () => {
    const net = fakeNet({delayMs: 20});
    const running = startSync(fisica, {net});

    expect(isSyncing()).toBe(true);

    await act(async () => {
      await running;
    });

    // 'result' NO cuenta como en curso: la descarga ya termino, y el atras de
    // Android tiene que volver a funcionar (REQ-057).
    expect(getSnapshot().phase).toBe('result');
    expect(isSyncing()).toBe(false);
  });
});

describe('refresco de los otros stores al terminar (REQ-012)', () => {
  it('la fecha y el mazo estan publicados ANTES de anunciar el desenlace', async () => {
    const {box} = renderHook(useDeckSync);
    /** @type {Array<{phase: string, lastSyncedAt: number|null}>} */
    const observed = [];

    const db = openDatabase().db;

    // Se observa la base en el momento EXACTO en que se anuncia cada fase.
    const unsubscribe = subscribe(() => {
      observed.push({
        phase: getSnapshot().phase,
        lastSyncedAt: db.executeSync(
          'SELECT last_synced_at FROM sources WHERE id = ?',
          [fisica.id],
        ).rows[0].last_synced_at,
      });
    });

    await act(async () => {
      await startSync(fisica, {net: fakeNet(), now: () => 4242});
    });

    unsubscribe();

    const result = observed.find(entry => entry.phase === 'result');

    // Si se anunciara antes de refrescar, la fila diria "3 preguntas guardadas"
    // mientras sigue mostrando que nunca se actualizo.
    expect(result.lastSyncedAt).toBe(4242);
    expect(box.current.state.phase).toBe('result');
  });
});

describe('useIsSyncing', () => {
  it('sigue el estado del modulo, no uno propio del componente', async () => {
    const {box} = renderHook(useIsSyncing);

    expect(box.current).toBe(false);

    const net = fakeNet({delayMs: 20});
    let running;

    await act(async () => {
      running = startSync(fisica, {net});
      await Promise.resolve();
    });

    expect(box.current).toBe(true);

    await act(async () => {
      await running;
    });

    expect(box.current).toBe(false);
  });

  it('dos componentes distintos ven el MISMO estado', async () => {
    // Es lo que hace que REQ-013 cubra "otra fuente distinta": si el cerrojo
    // viviera en un useRef, cada fila tendria el suyo.
    const a = renderHook(useIsSyncing);
    const b = renderHook(useIsSyncing);

    const net = fakeNet({delayMs: 20});
    let running;

    await act(async () => {
      running = startSync(fisica, {net});
      await Promise.resolve();
    });

    expect(a.box.current).toBe(true);
    expect(b.box.current).toBe(true);

    await act(async () => {
      await running;
    });

    expect(a.box.current).toBe(false);
    expect(b.box.current).toBe(false);
  });
});

describe('estabilidad del snapshot (data-sources DD-005)', () => {
  it("'idle' es siempre la misma instancia", () => {
    const first = getSnapshot();

    expect(getSnapshot()).toBe(first);
  });

  it('no repinta de mas mientras el total no se conoce', async () => {
    const net = fakeNet({delayMs: 20});
    const {box} = renderHook(useDeckSync);

    const before = box.renders;
    const running = startSync(fisica, {net});

    await act(async () => {
      await running;
    });

    // 'preparing' se publica una vez, no una por cada aviso sin total.
    expect(box.renders - before).toBeLessThan(6);
  });
});
