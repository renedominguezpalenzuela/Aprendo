/**
 * Tests de src/decks/useCardImage.js.
 *
 * REQ-038 (una imagen que no se puede leer no rompe la tarjeta), REQ-045 de
 * `deck-sync` (sin red) y DD-020 (se lee una vez por identificador).
 *
 * @format
 */

import React from 'react';
import {Text} from 'react-native';
import TestRenderer, {act} from 'react-test-renderer';

import {openDatabase, resetDatabaseForTests} from '../src/db/database';
import {insertPendingImage, promoteDeck} from '../src/decks/decksRepo';
import {
  readCardImage,
  resetCardImageCacheForTests,
  useCardImage,
} from '../src/decks/useCardImage';
import {makeMemoryDriver} from './support/nodeSqliteDriver';

/** @type {import('../src/db/database').Driver} */
let db;
/** @type {number} */
let imageId;

beforeEach(() => {
  resetDatabaseForTests();
  // La cache es de MODULO, asi que sin esto un test heredaria las imagenes del
  // anterior y los que cuentan lecturas pasarian por el motivo equivocado.
  resetCardImageCacheForTests();
  db = openDatabase(makeMemoryDriver()).db;

  db.executeSync(
    `INSERT INTO sources (name, name_key, url_original, url_csv, is_active, created_at)
     VALUES ('S', 's', 'u', 'c', 1, 1)`,
  );

  imageId = insertPendingImage(1, {
    url: 'https://x/y.png',
    mime: 'image/png',
    bytes: new Uint8Array([1, 2, 3, 4]),
  });

  promoteDeck(1, 1000);
});

/**
 * @param {number|null} id
 * @returns {{box: {current: any, renders: number}, rerender: (next: number|null) => void}}
 */
function renderHook(id) {
  const box = {current: null, renders: 0};

  function Probe({imageId: probeId}) {
    box.current = useCardImage(probeId);
    box.renders += 1;

    return <Text>probe</Text>;
  }

  let tree;
  act(() => {
    tree = TestRenderer.create(<Probe imageId={id} />);
  });

  return {
    box,
    rerender: next =>
      act(() => {
        tree.update(<Probe imageId={next} />);
      }),
  };
}

describe('useCardImage', () => {
  it('devuelve el data URI listo para pintar', () => {
    const {box} = renderHook(imageId);

    expect(box.current.startsWith('data:image/png;base64,')).toBe(true);
  });

  it('con null NO consulta la base: es el caso comun', () => {
    // Se espia el SQL y no el modulo: un espia sobre el import puede no interceptar
    // la llamada directa y entonces "no se llamo" pasaria siendo falso, que es la
    // trampa de docs/solutions/2026-08-16-el-cerrojo-que-no-protegia-nada.md.
    const sqlSeen = [];
    const original = db.executeSync;

    db.executeSync = (sql, params) => {
      sqlSeen.push(sql);
      return original.call(db, sql, params);
    };

    const {box} = renderHook(null);
    const conNull = sqlSeen.filter(sql => sql.includes('data_uri')).length;

    // Y con un id de verdad SI consulta: si esta segunda mitad no se cumpliera, la
    // primera no probaria nada.
    renderHook(imageId);
    const conId = sqlSeen.filter(sql => sql.includes('data_uri')).length;

    db.executeSync = original;

    expect(box.current).toBeNull();
    expect(conNull).toBe(0);
    expect(conId).toBe(1);
  });

  it('devuelve null si la imagen no existe', () => {
    const {box} = renderHook(9999);

    expect(box.current).toBeNull();
  });

  it('MEMOIZA por identificador: dos renders, una lectura (DD-020)', () => {
    const sqlSeen = [];
    const original = db.executeSync;

    db.executeSync = (sql, params) => {
      sqlSeen.push(sql);
      return original.call(db, sql, params);
    };

    const {rerender} = renderHook(imageId);
    const lecturasTrasElPrimero = sqlSeen.filter(sql => sql.includes('data_uri')).length;

    rerender(imageId);
    rerender(imageId);

    const total = sqlSeen.filter(sql => sql.includes('data_uri')).length;
    db.executeSync = original;

    // Tres renders con el mismo id: UNA lectura. Sin esto, cada repintado releeria
    // hasta 1,33 MB de la base.
    expect(lecturasTrasElPrimero).toBe(1);
    expect(total).toBe(1);
  });

  it('vuelve a leer cuando el identificador CAMBIA', () => {
    const otro = insertPendingImage(1, {
      url: 'https://x/z.png',
      mime: 'image/jpeg',
      bytes: new Uint8Array([9, 9]),
    });

    promoteDeck(1, 2000);

    const {box, rerender} = renderHook(imageId);
    const primero = box.current;

    rerender(otro);

    expect(box.current).not.toBe(primero);
    expect(box.current.startsWith('data:image/jpeg;base64,')).toBe(true);
  });
});

describe('un fallo de lectura no rompe la tarjeta (REQ-038)', () => {
  it('devuelve null en vez de propagar', () => {
    const original = db.executeSync;

    db.executeSync = sql => {
      if (sql.includes('data_uri')) {
        throw new Error('database disk image is malformed');
      }
      return original.call(db, sql);
    };

    // Ni lanza ni deja la tarjeta sin pintar: el giro y la navegacion siguen.
    expect(() => readCardImage(imageId)).not.toThrow();
    expect(readCardImage(imageId)).toBeNull();

    db.executeSync = original;
  });
});

describe('sin red (REQ-045 de deck-sync)', () => {
  it('leer una imagen no pide NADA a la red', () => {
    // `fetch` y `XMLHttpRequest` lanzan bajo el guardia de jest.setup.js, asi que una
    // peticion por este camino romperia el test en vez de pasar de largo.
    expect(() => readCardImage(imageId)).not.toThrow();
    expect(() => renderHook(imageId)).not.toThrow();
  });
});

describe('la cache compartida (DD-020)', () => {
  it('dos LECTURAS del mismo id, con hooks distintos, una sola consulta', () => {
    const sqlSeen = [];
    const original = db.executeSync;

    db.executeSync = (sql, params) => {
      sqlSeen.push(sql);
      return original.call(db, sql, params);
    };

    // Dos componentes distintos: `useMemo` no los une, la cache si. Esto es lo que
    // hace que PRECARGAR la vecina signifique algo.
    renderHook(imageId);
    renderHook(imageId);

    db.executeSync = original;

    expect(sqlSeen.filter(sql => sql.includes('data_uri'))).toHaveLength(1);
  });

  it('precargar por adelantado ahorra la lectura al montar la tarjeta', () => {
    readCardImage(imageId);

    const sqlSeen = [];
    const original = db.executeSync;

    db.executeSync = (sql, params) => {
      sqlSeen.push(sql);
      return original.call(db, sql, params);
    };

    renderHook(imageId);
    db.executeSync = original;

    // Cero consultas: el trabajo ya se hizo mientras el usuario leia la anterior.
    expect(sqlSeen.filter(sql => sql.includes('data_uri'))).toHaveLength(0);
  });

  it('no guarda mas de tres: una cache generosa es un problema de memoria', () => {
    const ids = [2, 3, 4].map(n =>
      insertPendingImage(1, {
        url: `https://x/${n}.png`,
        mime: 'image/png',
        bytes: new Uint8Array([n]),
      }),
    );

    promoteDeck(1, 2000);

    // Se leen cuatro en total: la primera tiene que haber caido.
    readCardImage(imageId);
    ids.forEach(id => readCardImage(id));

    const sqlSeen = [];
    const original = db.executeSync;

    db.executeSync = (sql, params) => {
      sqlSeen.push(sql);
      return original.call(db, sql, params);
    };

    readCardImage(imageId);
    db.executeSync = original;

    expect(sqlSeen.filter(sql => sql.includes('data_uri'))).toHaveLength(1);
  });
});
