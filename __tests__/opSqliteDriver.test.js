/**
 * Tests del ADAPTADOR de op-sqlite.
 *
 * Esta suite nacio porque `/sdd-verify` encontro un agujero: el adaptador de
 * op-sqlite —el codigo que corre en el TELEFONO— no lo ejecutaba ningun test, porque
 * todos inyectan el driver de `node:sqlite`.
 *
 * El delta de base64 se llevo por delante las conversiones de blobs y con ellas 9 de
 * los 12 tests que habia aqui. LOS TRES QUE QUEDAN SE CONSERVAN A PROPOSITO: el
 * pragma de claves ajenas y las dos transacciones siguen siendo la parte del
 * adaptador que ningun otro test toca, o sea la misma zona ciega que describe
 * docs/solutions/2026-08-18-la-costura-que-deja-sin-probar-el-adaptador.md.
 * Borrarlos "porque ya no hay blobs" seria volver a dejarla sin cubrir.
 *
 * @format
 */

import {open} from '@op-engineering/op-sqlite';

import {openDatabase, resetDatabaseForTests} from '../src/db/database';
import {SCHEMA_VERSION} from '../src/db/schema';

/**
 * Doble de op-sqlite, lo justo para que `openDatabase` complete su camino nativo.
 *
 * @returns {{db: Object, calls: Array<{sql: string, params: Array<any>}>}}
 */
function fakeOpSqlite() {
  const calls = [];
  /** @type {Record<string, any>[]} */
  let nextRows = [];

  const db = {
    executeSync: jest.fn((sql, params) => {
      calls.push({sql, params});

      // La version ya migrada: asi `openDatabase` no ejecuta el DDL, que aca no
      // interesa. Lo que se prueba es lo que el adaptador hace alrededor.
      if (sql === 'PRAGMA user_version') {
        return {rows: [{user_version: SCHEMA_VERSION}]};
      }

      if (sql.startsWith('SELECT')) {
        const rows = nextRows;
        nextRows = [];

        return {rows};
      }

      return {rows: []};
    }),
    /** @param {Record<string, any>[]} rows */
    willReturn: rows => {
      nextRows = rows;
    },
  };

  return {db, calls};
}

/** @type {ReturnType<typeof fakeOpSqlite>} */
let fake;

beforeEach(() => {
  resetDatabaseForTests();
  fake = fakeOpSqlite();

  // El mock global de jest.setup.js LANZA a proposito. Aca se le da un
  // comportamiento, que es la unica forma de ejercitar el camino nativo sin nativo.
  open.mockImplementation(() => fake.db);
});

afterEach(() => {
  open.mockReset();
  open.mockImplementation(() => {
    throw new Error('op-sqlite no esta disponible bajo Jest. Inyecta un driver: ver DD-014.');
  });
});

/** @returns {import('../src/db/database').Driver} */
function openWithOpSqlite() {
  const result = openDatabase();

  expect(result.ok).toBe(true);

  return result.db;
}

describe('el resto del adaptador', () => {
  it('enciende las claves ajenas por este camino tambien (DD-002)', () => {
    openWithOpSqlite();

    // El pragma es por CONEXION: si el adaptador nativo no lo ejecutara, la cascada
    // de REQ-004 no existiria en el telefono aunque los tests de node:sqlite pasen.
    expect(fake.calls.some(entry => entry.sql === 'PRAGMA foreign_keys = ON')).toBe(true);
  });

  it('la transaccion confirma al terminar bien', () => {
    const db = openWithOpSqlite();

    db.transactionSync(() => {
      db.executeSync('DELETE FROM questions');
    });

    const sqls = fake.calls.map(entry => entry.sql);

    expect(sqls).toContain('BEGIN');
    expect(sqls).toContain('COMMIT');
    expect(sqls).not.toContain('ROLLBACK');
  });

  it('la transaccion REVIERTE y propaga si el cuerpo falla', () => {
    const db = openWithOpSqlite();

    expect(() =>
      db.transactionSync(() => {
        throw new Error('database or disk is full');
      }),
    ).toThrow(/disk is full/);

    const sqls = fake.calls.map(entry => entry.sql);

    expect(sqls).toContain('ROLLBACK');
    expect(sqls).not.toContain('COMMIT');
  });
});
