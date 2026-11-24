/**
 * Apertura y migracion de la base local.
 *
 * Es el UNICO archivo del proyecto que importa @op-engineering/op-sqlite. Todo
 * lo demas habla con la interfaz `Driver` de aca abajo, que es lo que permite
 * que los tests corran contra `node:sqlite` con SQL de verdad en vez de contra
 * un mock que solo registra cadenas. Ver design.md DD-014.
 *
 * Ver specs/features/data-sources/design.md seccion 2.2.
 *
 * @format
 */

import {seedExampleDeck} from '../sources/exampleDeck';
import {MIGRATIONS, SCHEMA_VERSION} from './schema';

/** Nombre del archivo de base en el almacenamiento privado de la app. */
export const DATABASE_NAME = 'mason.sqlite';

/**
 * Lo minimo que database.js y los repositorios necesitan de un motor SQLite.
 *
 * SINCRONA a proposito: el arranque lee la fuente activa antes del primer
 * render y no puede esperar a una promesa (REQ-006, data-sources design.md
 * DD-004).
 *
 * SOLO ESCALARES. Hubo un tiempo en que esta costura llevaba blobs como
 * `Uint8Array` y cada adaptador convertia (deck-sync DD-016, hoy superada): desde
 * que las imagenes se guardan como data URI en base64 no hay nada binario que
 * cruzar, y las dos funciones de conversion se borraron.
 *
 * @typedef {string|number|null} Value
 *
 * @typedef {Object} Driver
 * @property {(sql: string, params?: Value[]) => {rows: Array<Record<string, any>>}} executeSync
 * @property {(fn: () => void) => void} transactionSync
 *   Ejecuta `fn` dentro de una transaccion. Si `fn` lanza, revierte y propaga.
 */

/** @type {Driver | null} */
let driver = null;

/**
 * Lo que se siembra al crear la base desde cero (EJEMPLO-001).
 *
 * Vive en una variable de modulo y no en un parametro para que `initSources` y
 * sus llamadores no cambien. En produccion es siempre `seedExampleDeck`; los
 * tests la apagan con `resetDatabaseForTests()` y la encienden con
 * `enableExampleSeedForTests()` (DD-023).
 *
 * @type {((db: Driver, now: number) => void) | null}
 */
let seed = seedExampleDeck;

/**
 * Driver por defecto: op-sqlite.
 *
 * El import es perezoso a proposito. Bajo Jest, importar un modulo nativo lanza
 * en el propio import, asi que un import estatico romperia hasta los tests que
 * inyectan su propio driver y no tocan op-sqlite para nada.
 *
 * @returns {Driver}
 */
function makeOpSqliteDriver() {
  const {open} = require('@op-engineering/op-sqlite');
  const db = open({name: DATABASE_NAME});

  return {
    executeSync: (sql, params) => db.executeSync(sql, params ?? []),
    transactionSync: fn => {
      db.executeSync('BEGIN');
      try {
        fn();
        db.executeSync('COMMIT');
      } catch (error) {
        db.executeSync('ROLLBACK');
        throw error;
      }
    },
  };
}

/**
 * Enciende las claves ajenas.
 *
 * SQLite las trae DESACTIVADAS por defecto, y el ajuste es por CONEXION, no una
 * propiedad del archivo. Sin esto, el `ON DELETE CASCADE` de `questions` e
 * `images` es un comentario decorativo: borrar una fuente se ejecutaria sin error
 * y dejaria sus preguntas y sus imagenes ahi para siempre (REQ-004).
 *
 * Va FUERA de transaccion: dentro, SQLite lo ignora en silencio.
 *
 * Ver deck-sync design.md DD-002. Y hay un test de la cascada que falla si esta
 * linea desaparece, que es la unica forma de que esto no se pierda.
 *
 * @param {Driver} db
 */
function enableForeignKeys(db) {
  db.executeSync('PRAGMA foreign_keys = ON');
}

/**
 * Abre la base y la migra. Idempotente: la segunda llamada devuelve la conexion
 * ya abierta sin volver a migrar.
 *
 * NO LANZA. Un fallo al abrir (disco lleno, base corrupta) es REQ-005 y tiene
 * que poder pintarse como un estado de la pantalla, no tumbar la app.
 *
 * @param {() => Driver} [makeDriver]
 * @returns {{ok: true, db: Driver} | {ok: false, error: Error}}
 */
export function openDatabase(makeDriver = makeOpSqliteDriver) {
  if (driver != null) {
    return {ok: true, db: driver};
  }

  try {
    const opened = makeDriver();

    // ANTES de migrar: la migracion 2 crea tablas con claves ajenas, y las
    // escrituras posteriores dependen de que esten encendidas (DD-002).
    enableForeignKeys(opened);
    migrate(opened);
    driver = opened;

    return {ok: true, db: opened};
  } catch (error) {
    return {ok: false, error: error instanceof Error ? error : new Error(String(error))};
  }
}

/**
 * La conexion ya abierta.
 *
 * LANZA si se llama antes de `openDatabase`. Eso es un error del programador, no
 * una situacion que el usuario pueda provocar, asi que no se disfraza de estado.
 *
 * @returns {Driver}
 */
export function getDb() {
  if (driver == null) {
    throw new Error('getDb() antes de openDatabase()');
  }

  return driver;
}

/**
 * Devuelve la base al estado de "sin abrir". Solo para tests: cada uno abre la
 * suya y no puede heredar la del anterior.
 */
export function resetDatabaseForTests() {
  driver = null;
  // Sin ejemplo: los tests que abren una base nueva dan por hecho que esta vacia,
  // y lo que prueban no es el ejemplo (DD-023).
  seed = null;
}

/**
 * Enciende la siembra en los tests, con el ejemplo real o con la funcion que se
 * pase (por ejemplo, una que falla, para probar DD-020).
 *
 * @param {(db: Driver, now: number) => void} [fn]
 */
export function enableExampleSeedForTests(fn = seedExampleDeck) {
  seed = fn;
}


/**
 * Lleva la base de su version actual a SCHEMA_VERSION.
 *
 * Cada salto va en su propia transaccion: si una sentencia falla, esa version no
 * se aplica y `user_version` no avanza, asi que la base queda en la anterior en
 * vez de a medias. El siguiente arranque reintenta desde donde se quedo.
 *
 * @param {Driver} db
 */
function migrate(db) {
  const current = readUserVersion(db);

  if (current === 0) {
    createFromScratch(db);
    return;
  }

  for (let version = current + 1; version <= SCHEMA_VERSION; version += 1) {
    const statements = MIGRATIONS[version];

    if (statements == null) {
      throw new Error(`No hay migracion definida para la version ${version}`);
    }

    db.transactionSync(() => {
      statements.forEach(sql => db.executeSync(sql));

      // `PRAGMA user_version` no admite parametros vinculados, asi que va
      // interpolado. El valor es un entero del propio codigo, nunca entrada del
      // usuario.
      db.executeSync(`PRAGMA user_version = ${version}`);
    });
  }
}

/**
 * Crea una base nueva: todas las migraciones, la siembra y la version, en UNA
 * transaccion (DD-020).
 *
 * Si la siembra fuera aparte, un fallo entre las migraciones y la siembra dejaria
 * `user_version` al dia y sin ejemplo, y el siguiente arranque ya no veria una
 * base nueva: el ejemplo no llegaria nunca. Asi, o queda todo, o la base sigue en
 * 0 y el proximo arranque lo reintenta entero. El error sigue hasta el `try` de
 * `openDatabase`, que lo convierte en el estado de REQ-005.
 *
 * @param {Driver} db
 */
function createFromScratch(db) {
  db.transactionSync(() => {
    for (let version = 1; version <= SCHEMA_VERSION; version += 1) {
      const statements = MIGRATIONS[version];

      if (statements == null) {
        throw new Error(`No hay migracion definida para la version ${version}`);
      }

      statements.forEach(sql => db.executeSync(sql));
    }

    if (seed != null) {
      seed(db, Date.now());
    }

    db.executeSync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  });
}

/**
 * @param {Driver} db
 * @returns {number}
 */
function readUserVersion(db) {
  const {rows} = db.executeSync('PRAGMA user_version');
  const value = rows.length > 0 ? Object.values(rows[0])[0] : 0;

  return typeof value === 'number' ? value : Number(value ?? 0);
}
