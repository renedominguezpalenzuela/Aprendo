/**
 * Tests del estado del mazo.
 *
 * Esta suite se ha REESCRITO: la anterior afirmaba que `useDeck` no descargaba
 * nada y devolvia `'pending'` porque la descarga no existia. Ahora existe, y lo
 * que se comprueba es que el mazo publicado es el de la fuente activa, con sus
 * preguntas de verdad.
 *
 * Lo unico que se conserva de aquella es lo que sigue siendo cierto: montar este
 * hook NO pide red (REQ-080).
 *
 * Cubre REQ-003, REQ-011, REQ-014, REQ-029, REQ-070 a REQ-073.
 *
 * @format
 */

import React from 'react';
import {Text} from 'react-native';
import TestRenderer, {act} from 'react-test-renderer';

import {openDatabase, resetDatabaseForTests} from '../src/db/database';
import {initDecks, refreshDeck, resetDecksForTests} from '../src/decks/deckStore';
import {
  insertPendingImage,
  insertPendingQuestion,
  promoteDeck,
} from '../src/decks/decksRepo';
import {useDeck, useDeckSummary} from '../src/decks/useDeck';
import {activateSource, addSource, removeSource} from '../src/sources/sourcesRepo';
import {initSources, refresh, resetSourcesForTests} from '../src/sources/sourcesStore';
import {makeMemoryDriver} from './support/nodeSqliteDriver';

const SHEET = 'https://docs.google.com/spreadsheets/d/1Hf36KxLKJtv5Ve/edit?gid=5#gid=5';

/**
 * @param {() => any} useHook
 * @returns {{box: {current: any}, unmount: () => void}}
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

/**
 * Escribe y promueve un mazo para una fuente.
 *
 * @param {number} sourceId
 * @param {number} count
 * @param {{withImage?: boolean, label?: string}} [options]
 */
function seedDeck(sourceId, count, options = {}) {
  for (let i = 0; i < count; i += 1) {
    const id = insertPendingQuestion(sourceId, {
      position: i,
      question: `${options.label ?? 'P'}${i}`,
      answer1: `R${i}`,
      answer2: null,
      imageQuestionUrl: null,
      imageAnswerUrl: null,
    });

    if (options.withImage && i === 0) {
      insertPendingImage(sourceId, {
        url: 'https://img/x.png',
        mime: 'image/png',
        bytes: new Uint8Array(1000),
      });
      // El id de la pregunta se usa solo para dejar claro que existe.
      expect(id).toBeGreaterThan(0);
    }
  }

  promoteDeck(sourceId, 7000);
}

beforeEach(() => {
  resetDatabaseForTests();
  resetSourcesForTests();
  resetDecksForTests();
  openDatabase(makeMemoryDriver());
  initSources();
  initDecks();
});

describe('useDeck: sin fuente y sin preguntas', () => {
  it("sin ninguna fuente registrada devuelve 'unconfigured'", () => {
    const {box} = renderHook(useDeck);

    expect(box.current).toEqual({status: 'unconfigured'});
  });

  it("con fuente activa y sin preguntas devuelve 'empty' con su fuente (REQ-071)", () => {
    act(() => {
      addSource({name: 'Fisica', url: SHEET});
      refresh();
    });

    const {box} = renderHook(useDeck);

    // 'empty' y no 'unconfigured': aca hay hoja registrada y falta descargarla, y
    // el texto que lo dice es otro.
    expect(box.current.status).toBe('empty');
    expect(box.current.source.name).toBe('Fisica');
  });
});

describe('useDeck: con mazo (REQ-070, REQ-029)', () => {
  it('devuelve las preguntas de la fuente activa, en orden', () => {
    let id;

    act(() => {
      id = addSource({name: 'Fisica', url: SHEET}).id;
      seedDeck(id, 3);
      refresh();
    });

    const {box} = renderHook(useDeck);

    expect(box.current.status).toBe('ready');
    expect(box.current.questions).toHaveLength(3);
    expect(box.current.questions.map(q => q.position)).toEqual([0, 1, 2]);
    expect(box.current.source.name).toBe('Fisica');
  });

  it('NO trae los bytes de las imagenes, solo sus ids (DD-003)', () => {
    let id;

    act(() => {
      id = addSource({name: 'Fisica', url: SHEET}).id;
      seedDeck(id, 1, {withImage: true});
      refresh();
    });

    const {box} = renderHook(useDeck);

    expect(JSON.stringify(box.current.questions)).not.toContain('bytes');
    expect(Object.keys(box.current.questions[0])).toContain('imageQuestionId');
  });

  it('solo las de la ACTIVA, y cambia al activar otra (REQ-003, REQ-072)', () => {
    let fisica;
    let mates;

    act(() => {
      fisica = addSource({name: 'Fisica', url: SHEET}).id;
      mates = addSource({name: 'Mates', url: `${SHEET}&x=2`}).id;
      seedDeck(fisica, 3, {label: 'fis'});
      seedDeck(mates, 2, {label: 'mat'});
      refresh();
    });

    const {box} = renderHook(useDeck);

    expect(box.current.questions).toHaveLength(3);
    expect(box.current.questions.every(q => q.question.startsWith('fis'))).toBe(true);

    act(() => {
      activateSource(mates);
      refresh();
    });

    // Sin remontar nada: el hook estaba suscrito.
    expect(box.current.questions).toHaveLength(2);
    expect(box.current.questions.every(q => q.question.startsWith('mat'))).toBe(true);
  });

  it('borrar la fuente activa arrastra su mazo y publica el de la nueva activa', () => {
    let fisica;
    let mates;

    act(() => {
      fisica = addSource({name: 'Fisica', url: SHEET}).id;
      mates = addSource({name: 'Mates', url: `${SHEET}&x=2`}).id;
      seedDeck(fisica, 3, {label: 'fis'});
      seedDeck(mates, 2, {label: 'mat'});
      refresh();
    });

    const {box} = renderHook(useDeck);
    expect(box.current.questions).toHaveLength(3);

    act(() => {
      removeSource(fisica);
      refresh();
    });

    expect(box.current.status).toBe('ready');
    expect(box.current.questions).toHaveLength(2);
    expect(box.current.source.name).toBe('Mates');
  });
});

describe('useDeck: estabilidad del snapshot (data-sources DD-005)', () => {
  it('la misma referencia mientras nada cambia, y no entra en bucle', () => {
    act(() => {
      addSource({name: 'Fisica', url: SHEET});
      refresh();
    });

    const {box} = renderHook(useDeck);
    const first = box.current;
    const renders = box.renders;

    act(() => {
      // Refrescar sin cambiar nada NO puede provocar renders infinitos.
      refreshDeck();
      refreshDeck();
    });

    expect(box.current.status).toBe(first.status);
    expect(box.renders).toBeLessThanOrEqual(renders + 2);
  });

  it("'unconfigured' es siempre la misma instancia", () => {
    const {box} = renderHook(useDeck);
    const first = box.current;

    act(() => refreshDeck());

    expect(box.current).toBe(first);
  });
});

describe('useDeckSummary (REQ-011, REQ-014)', () => {
  it('devuelve cuenta, bytes y fecha de esa fuente', () => {
    let id;

    act(() => {
      id = addSource({name: 'Fisica', url: SHEET}).id;
      seedDeck(id, 2, {withImage: true});
      refresh();
    });

    const {box} = renderHook(() => useDeckSummary(id));

    expect(box.current.count).toBe(2);
    expect(box.current.bytes).toBeGreaterThan(1000);
    expect(box.current.lastSyncedAt).toBe(7000);
  });

  it('una fuente sin preguntas trae count 0 y fecha null', () => {
    let id;

    act(() => {
      id = addSource({name: 'Fisica', url: SHEET}).id;
      refresh();
    });

    const {box} = renderHook(() => useDeckSummary(id));

    expect(box.current).toEqual({count: 0, bytes: 0, lastSyncedAt: null});
  });

  it('devuelve null para una fuente que no existe', () => {
    const {box} = renderHook(() => useDeckSummary(999));

    expect(box.current).toBeNull();
  });

  it('el resumen de una fuente NO activa tambien esta disponible', () => {
    // Actualizar una fuente que no es la activa es un caso deseado (spec seccion 6:
    // preparar mazos en casa antes de salir sin cobertura).
    let otra;

    act(() => {
      addSource({name: 'Activa', url: SHEET});
      otra = addSource({name: 'Otra', url: `${SHEET}&x=2`}).id;
      seedDeck(otra, 5);
      refresh();
    });

    const {box} = renderHook(() => useDeckSummary(otra));

    expect(box.current.count).toBe(5);
  });
});

describe('useDeck: errores y ausencia de red', () => {
  it('un fallo de lectura se publica como estado, no lanza (REQ-063)', () => {
    let id;

    act(() => {
      id = addSource({name: 'Fisica', url: SHEET}).id;
      seedDeck(id, 1);
      refresh();
    });

    const db = openDatabase().db;
    const original = db.executeSync;

    db.executeSync = sql => {
      if (sql.includes('FROM questions') || sql.includes('FROM sources s')) {
        throw new Error('database disk image is malformed');
      }

      return original.call(db, sql);
    };

    act(() => refreshDeck());
    db.executeSync = original;

    const {box} = renderHook(useDeck);

    expect(box.current.status).toBe('error');
    expect(box.current.error.message).toMatch(/malformed/);
  });

  it('montar el hook no pide NADA a la red (REQ-080)', () => {
    act(() => {
      const id = addSource({name: 'Fisica', url: SHEET}).id;
      seedDeck(id, 2);
      refresh();
    });

    // `fetch` y `XMLHttpRequest` lanzan bajo el guardia de jest.setup.js, asi que si
    // este hook pidiera algo, este test se caeria en vez de pasar de largo.
    expect(() => renderHook(useDeck)).not.toThrow();
    expect(() => renderHook(() => useDeckSummary(1))).not.toThrow();
  });
});
