/**
 * Tests del esquema y del ejecutor de migraciones.
 *
 * Corren contra `node:sqlite` en memoria (design.md DD-014): SQL de verdad, con
 * las mismas restricciones e indices que en el telefono.
 *
 * Cubre REQ-001, REQ-002, REQ-003 y REQ-005, y la migracion 4 y la siembra del
 * delta mazo de ejemplo (EJEMPLO-001, DD-020, DD-023).
 *
 * @format
 */

import {
  currentSeedForTests,
  enableExampleSeedForTests,
  getDb,
  openDatabase,
  resetDatabaseForTests,
} from '../src/db/database';
import {EXAMPLE_NAME, seedExampleDeck} from '../src/sources/exampleDeck';
import {MIGRATIONS, SCHEMA_VERSION} from '../src/db/schema';
import {makeMemoryDriver} from './support/nodeSqliteDriver';

beforeEach(() => {
  resetDatabaseForTests();
});

/** @param {import('../src/db/database').Driver} db */
function userVersion(db) {
  return db.executeSync('PRAGMA user_version').rows[0].user_version;
}

describe('openDatabase', () => {
  it('crea el esquema sobre una base vacia y deja la version puesta (REQ-002, REQ-003)', () => {
    const result = openDatabase(makeMemoryDriver());

    expect(result.ok).toBe(true);
    expect(userVersion(result.db)).toBe(SCHEMA_VERSION);

    // La tabla existe y tiene las columnas del diseno.
    const columns = result.db
      .executeSync('PRAGMA table_info(sources)')
      .rows.map(row => row.name);

    expect(columns).toEqual([
      'id',
      'name',
      'name_key',
      'url_original',
      'url_csv',
      'is_active',
      'created_at',
      // Llega con la migracion 2 (deck-sync REQ-011). Una base recien creada
      // aplica las dos migraciones seguidas, asi que tambien la tiene.
      'last_synced_at',
      // Migracion 4 (delta mazo de ejemplo).
      'kind',
    ]);
  });

  it('es idempotente: la segunda llamada no vuelve a migrar (REQ-002)', () => {
    const first = openDatabase(makeMemoryDriver());
    first.db.executeSync(
      "INSERT INTO sources (name, name_key, url_original, url_csv, is_active, created_at) VALUES ('A','a','u','c',1,1)",
    );

    // Una fabrica que lanzaria si se la llegara a invocar: la segunda apertura
    // no debe abrir nada nuevo.
    const second = openDatabase(() => {
      throw new Error('no deberia abrirse otra vez');
    });

    expect(second.ok).toBe(true);
    expect(second.db.executeSync('SELECT COUNT(*) AS n FROM sources').rows[0].n).toBe(1);
  });

  it('sobre una base ya migrada no ejecuta el DDL ni pierde filas (REQ-004)', () => {
    // Se simula "reabrir la misma base": mismo driver, proceso nuevo.
    const makeDriver = makeMemoryDriver();
    const driver = makeDriver();

    openDatabase(() => driver);
    driver.executeSync(
      "INSERT INTO sources (name, name_key, url_original, url_csv, is_active, created_at) VALUES ('A','a','u','c',1,1)",
    );

    resetDatabaseForTests();
    const reopened = openDatabase(() => driver);

    expect(reopened.ok).toBe(true);
    expect(userVersion(driver)).toBe(SCHEMA_VERSION);
    expect(driver.executeSync('SELECT COUNT(*) AS n FROM sources').rows[0].n).toBe(1);
  });

  it('devuelve el error en vez de lanzarlo si el driver falla al abrir (REQ-005)', () => {
    const result = openDatabase(() => {
      throw new Error('disco lleno');
    });

    expect(result.ok).toBe(false);
    expect(result.error.message).toBe('disco lleno');
  });

  it('no deja la base a medias si una sentencia de la migracion falla (REQ-003)', () => {
    const makeDriver = makeMemoryDriver();
    const driver = makeDriver();
    const original = driver.executeSync;

    // La ultima sentencia de la migracion 1 revienta.
    driver.executeSync = (sql, params) => {
      if (sql.includes('sources_one_active')) {
        throw new Error('fallo a mitad de la migracion');
      }
      return original(sql, params);
    };

    const result = openDatabase(() => driver);
    driver.executeSync = original;

    expect(result.ok).toBe(false);
    // La version NO avanza, asi que el proximo arranque reintenta desde cero en
    // vez de dar por buena media migracion.
    expect(userVersion(driver)).toBe(0);
    expect(driver.executeSync("SELECT name FROM sqlite_master WHERE name='sources'").rows)
      .toHaveLength(0);
  });
});

describe('getDb', () => {
  it('lanza si se llama antes de abrir: es error del programador', () => {
    expect(() => getDb()).toThrow(/antes de openDatabase/);
  });

  it('devuelve la conexion abierta', () => {
    const result = openDatabase(makeMemoryDriver());

    expect(getDb()).toBe(result.db);
  });
});

describe('esquema', () => {
  it('hay una migracion por cada version hasta SCHEMA_VERSION', () => {
    for (let v = 1; v <= SCHEMA_VERSION; v += 1) {
      expect(Array.isArray(MIGRATIONS[v])).toBe(true);
    }
  });

  it('el indice de name_key rechaza el nombre repetido (REQ-012, DD-007)', () => {
    const {db} = openDatabase(makeMemoryDriver());
    const insert = key =>
      db.executeSync(
        `INSERT INTO sources (name, name_key, url_original, url_csv, is_active, created_at) VALUES ('N', '${key}', 'u', 'c', 0, 1)`,
      );

    insert('aprendiz');

    expect(() => insert('aprendiz')).toThrow(/UNIQUE/i);
  });

  it('el indice parcial admite varias inactivas y una sola activa (REQ-022, DD-007)', () => {
    const {db} = openDatabase(makeMemoryDriver());
    const insert = (key, active) =>
      db.executeSync(
        `INSERT INTO sources (name, name_key, url_original, url_csv, is_active, created_at) VALUES ('N', '${key}', 'u', 'c', ${active}, 1)`,
      );

    insert('a', 0);
    insert('b', 0);
    insert('c', 0);
    insert('d', 1);

    // Tres ceros conviven sin problema; el segundo uno lo rechaza el ESQUEMA.
    expect(() => insert('e', 1)).toThrow(/UNIQUE/i);
  });
});

// ─── deck-sync ───────────────────────────────────────────────────────────────
//
// Migracion 2, claves ajenas y blobs. Ver deck-sync design.md seccion 2.1,
// seccion 2.2, DD-002 y DD-016.

/**
 * Abre una base en el estado de la version 1: solo la migracion 1 aplicada, como
 * la que tiene en el telefono quien instalo la app antes de esta feature.
 *
 * @returns {{db: import('../src/db/database').Driver, makeDriver: () => import('../src/db/database').Driver}}
 */
function openAtVersion1() {
  const makeDriver = makeMemoryDriver();
  // El mismo driver para las dos aperturas: si cada una abriera su :memory:, la
  // segunda no veria nada de la primera y el test no probaria una migracion.
  const db = makeDriver();

  db.executeSync('PRAGMA foreign_keys = ON');
  db.transactionSync(() => {
    MIGRATIONS[1].forEach(sql => db.executeSync(sql));
    db.executeSync('PRAGMA user_version = 1');
  });

  return {db, makeDriver: () => db};
}

describe('migracion 2: sobre una base v1 con datos (REQ-005)', () => {
  it('conserva las fuentes registradas y sube la version', () => {
    const {db, makeDriver} = openAtVersion1();

    db.executeSync(
      `INSERT INTO sources (name, name_key, url_original, url_csv, is_active, created_at)
       VALUES ('Aprendiz', 'aprendiz', 'u', 'c', 1, 100)`,
    );

    const opened = openDatabase(makeDriver);

    expect(opened.ok).toBe(true);
    expect(userVersion(opened.db)).toBe(SCHEMA_VERSION);

    // LA fila sigue ahi. Es el requisito entero: actualizar la app no puede
    // costarle al usuario sus fuentes.
    const rows = opened.db.executeSync('SELECT name, is_active FROM sources').rows;
    expect(rows).toEqual([{name: 'Aprendiz', is_active: 1}]);
  });

  it('anade last_synced_at como NULL, que significa "nunca" (REQ-011)', () => {
    const {db, makeDriver} = openAtVersion1();

    db.executeSync(
      `INSERT INTO sources (name, name_key, url_original, url_csv, is_active, created_at)
       VALUES ('Aprendiz', 'aprendiz', 'u', 'c', 1, 100)`,
    );

    const {db: migrated} = openDatabase(makeDriver);
    const row = migrated.executeSync('SELECT last_synced_at FROM sources').rows[0];

    // NULL y no 0: "nunca actualizada" no es "actualizada en 1970".
    expect(row.last_synced_at).toBeNull();
  });

  it('crea las tablas del mazo vacias, con sus columnas', () => {
    const {makeDriver} = openAtVersion1();
    const {db} = openDatabase(makeDriver);

    const columnsOf = table =>
      db.executeSync(`PRAGMA table_info(${table})`).rows.map(row => row.name);

    expect(columnsOf('questions')).toEqual([
      'id',
      'source_id',
      'position',
      'question',
      'answer1',
      'answer2',
      'image_question_id',
      'image_answer_id',
      'is_pending',
    ]);

    // Tras la migracion 3 la imagen se guarda como data URI, no como blob.
    expect(columnsOf('images')).toEqual([
      'id',
      'source_id',
      'url',
      'mime',
      'stored_bytes',
      'data_uri',
      'is_pending',
    ]);

    expect(db.executeSync('SELECT COUNT(*) AS n FROM questions').rows[0].n).toBe(0);
    expect(db.executeSync('SELECT COUNT(*) AS n FROM images').rows[0].n).toBe(0);
  });

  it('crea los indices de lectura del mazo', () => {
    const {makeDriver} = openAtVersion1();
    const {db} = openDatabase(makeDriver);

    const indexes = db
      .executeSync("SELECT name FROM sqlite_master WHERE type = 'index'")
      .rows.map(row => row.name);

    expect(indexes).toContain('questions_deck');
    expect(indexes).toContain('images_deck');
  });
});

describe('claves ajenas (DD-002)', () => {
  it('estan ENCENDIDAS tras abrir', () => {
    const {db} = openDatabase(makeMemoryDriver());

    expect(db.executeSync('PRAGMA foreign_keys').rows[0].foreign_keys).toBe(1);
  });

  it('el driver de tests las trae apagadas: el pragma es lo que las enciende', () => {
    // Este test es el que da valor a todos los de cascada. Si el driver de tests
    // se quedara con el defecto de node:sqlite —que las trae ENCENDIDAS—, borrar
    // `enableForeignKeys()` de database.js no rompería ningun test, y en el
    // telefono las filas quedarian huerfanas (REQ-004). Ver el comentario de
    // __tests__/support/nodeSqliteDriver.js.
    const raw = makeMemoryDriver()();

    expect(raw.executeSync('PRAGMA foreign_keys').rows[0].foreign_keys).toBe(0);
  });
});

describe('migracion 3: la imagen pasa a data URI (delta de base64)', () => {
  /**
   * Deja una base en el estado de la version 2, CON un mazo dentro: es el caso que
   * la migracion 3 tiene que resolver, y el unico que puede perder datos.
   *
   * @returns {{db: import('../src/db/database').Driver, makeDriver: () => import('../src/db/database').Driver}}
   */
  function openAtVersion2WithDeck() {
    const makeDriver = makeMemoryDriver();
    const db = makeDriver();

    db.executeSync('PRAGMA foreign_keys = ON');
    db.transactionSync(() => {
      MIGRATIONS[1].forEach(sql => db.executeSync(sql));
      MIGRATIONS[2].forEach(sql => db.executeSync(sql));
      db.executeSync('PRAGMA user_version = 2');
    });

    db.executeSync(
      `INSERT INTO sources (name, name_key, url_original, url_csv, is_active, created_at, last_synced_at)
       VALUES ('Aprendiz', 'aprendiz', 'u', 'c', 1, 100, 5000)`,
    );
    db.executeSync(
      `INSERT INTO images (source_id, url, mime, byte_size, bytes, is_pending)
       VALUES (1, 'https://x/y.png', 'image/png', 3, ?, 0)`,
      [new Uint8Array([1, 2, 3])],
    );
    db.executeSync(
      `INSERT INTO questions (source_id, position, question, answer1, image_question_id, is_pending)
       VALUES (1, 0, 'P', 'R', 1, 0)`,
    );

    return {db, makeDriver: () => db};
  }

  it('CONSERVA las fuentes y tira el mazo, que es el precio escrito de este cambio', () => {
    const {makeDriver} = openAtVersion2WithDeck();
    const {db} = openDatabase(makeDriver);

    // Llega a la ultima version, que ya no es la 3: lo que importa aqui es que
    // la 3 se aplico, y eso lo dicen las aserciones de abajo.
    expect(userVersion(db)).toBe(SCHEMA_VERSION);

    // Las fuentes sobreviven con su nombre y su URL: perderlas si seria un fallo.
    const sources = db.executeSync('SELECT name, url_csv FROM sources').rows;
    expect(sources).toEqual([{name: 'Aprendiz', url_csv: 'c'}]);

    // El mazo no: el formato de la columna cambio y el ejecutor solo corre SQL.
    expect(db.executeSync('SELECT COUNT(*) AS n FROM questions').rows[0].n).toBe(0);
    expect(db.executeSync('SELECT COUNT(*) AS n FROM images').rows[0].n).toBe(0);
  });

  it('deja la fuente diciendo "nunca actualizada", que es la verdad', () => {
    const {makeDriver} = openAtVersion2WithDeck();
    const {db} = openDatabase(makeDriver);

    // Sin mazo, conservar la fecha seria mentirle al usuario sobre lo que tiene.
    expect(db.executeSync('SELECT last_synced_at FROM sources').rows[0].last_synced_at).toBeNull();
  });

  it('la tabla nueva no tiene columna binaria, y si el indice de lectura', () => {
    const {makeDriver} = openAtVersion2WithDeck();
    const {db} = openDatabase(makeDriver);

    const columns = db.executeSync('PRAGMA table_info(images)').rows.map(r => r.name);

    expect(columns).toContain('data_uri');
    expect(columns).toContain('stored_bytes');
    expect(columns).not.toContain('bytes');
    expect(columns).not.toContain('byte_size');

    // El indice se va con la tabla al hacer DROP, asi que la migracion lo recrea.
    const indexes = db
      .executeSync("SELECT name FROM sqlite_master WHERE type = 'index'")
      .rows.map(r => r.name);

    expect(indexes).toContain('images_deck');
  });

  it('una cadena larga cruza la costura intacta', () => {
    const {db} = openDatabase(makeMemoryDriver());

    db.executeSync(
      `INSERT INTO sources (name, name_key, url_original, url_csv, is_active, created_at)
       VALUES ('S', 's', 'u', 'c', 1, 1)`,
    );

    // Un data URI de verdad ronda el MB. Se prueba con 100 KB, que ya excede
    // cualquier limite de parametro que un motor pudiera imponer sin avisar.
    const dataUri = `data:image/png;base64,${'QUJD'.repeat(25000)}`;

    db.executeSync(
      'INSERT INTO images (source_id, url, mime, stored_bytes, data_uri) VALUES (1, ?, ?, ?, ?)',
      ['https://x/y.png', 'image/png', dataUri.length, dataUri],
    );

    const row = db
      .executeSync('SELECT data_uri, stored_bytes, length(data_uri) AS medido FROM images')
      .rows[0];

    expect(row.data_uri).toBe(dataUri);
    expect(row.stored_bytes).toBe(dataUri.length);
    // Lo declarado y lo que el motor mide coinciden: es el heredero honesto del
    // test de DD-016, que comparaba byte_size con length(bytes).
    expect(row.medido).toBe(row.stored_bytes);
  });
});

describe('migracion 4 y mazo de ejemplo (delta mazo-de-ejemplo)', () => {
  /** Base en la version 3 con una fuente propia, como la de quien actualiza la app. */
  function openAtVersion3WithSource() {
    const makeDriver = makeMemoryDriver();
    const db = makeDriver();

    db.executeSync('PRAGMA foreign_keys = ON');
    db.transactionSync(() => {
      [1, 2, 3].forEach(v => MIGRATIONS[v].forEach(sql => db.executeSync(sql)));
      db.executeSync('PRAGMA user_version = 3');
    });
    db.executeSync(
      `INSERT INTO sources (name, name_key, url_original, url_csv, is_active, created_at)
       VALUES ('Geografia', 'geografia', 'u', 'c', 1, 100)`,
    );

    return () => db;
  }

  const examples = db =>
    db.executeSync("SELECT * FROM sources WHERE kind = 'example'").rows;

  it('en produccion la siembra es seedExampleDeck (DD-023)', () => {
    // `resetDatabaseForTests` del beforeEach la apaga; este test lee el valor con
    // el que nace el modulo, que es el que vera la app.
    jest.isolateModules(() => {
      const fresh = require('../src/db/database');
      const {seedExampleDeck: real} = require('../src/sources/exampleDeck');

      expect(fresh.currentSeedForTests()).toBe(real);
    });
  });

  it('resetDatabaseForTests la apaga: una base nueva de test nace vacia', () => {
    expect(currentSeedForTests()).toBeNull();

    const {db} = openDatabase(makeMemoryDriver());

    expect(db.executeSync('SELECT COUNT(*) AS n FROM sources').rows[0].n).toBe(0);
  });

  it('una base nueva trae el ejemplo, inactivo, con 20 preguntas visibles (EJEMPLO-001)', () => {
    enableExampleSeedForTests();

    const {ok, db} = openDatabase(makeMemoryDriver());

    expect(ok).toBe(true);
    expect(userVersion(db)).toBe(SCHEMA_VERSION);

    const [example] = examples(db);
    expect(example).toMatchObject({
      name: EXAMPLE_NAME,
      is_active: 0,
      url_original: '',
      url_csv: '',
      last_synced_at: null,
    });

    const questions = db.executeSync(
      'SELECT position, is_pending FROM questions WHERE source_id = ? ORDER BY position',
      [example.id],
    ).rows;
    expect(questions).toHaveLength(20);
    expect(questions.every((q, i) => q.position === i && q.is_pending === 0)).toBe(true);
  });

  it('sobre una base existente migra a 4 SIN ejemplo y conserva todo (EJEMPLO-001)', () => {
    enableExampleSeedForTests();

    const {db} = openDatabase(openAtVersion3WithSource());

    expect(userVersion(db)).toBe(SCHEMA_VERSION);
    expect(examples(db)).toHaveLength(0);
    expect(db.executeSync('SELECT name, is_active, kind FROM sources').rows).toEqual([
      {name: 'Geografia', is_active: 1, kind: 'sheet'},
    ]);
  });

  it('reabrir una base que ya tiene el ejemplo no lo duplica', () => {
    enableExampleSeedForTests();
    const makeDriver = makeMemoryDriver();
    const db = makeDriver();

    openDatabase(() => db);
    resetDatabaseForTests();
    enableExampleSeedForTests();
    openDatabase(() => db);

    expect(examples(db)).toHaveLength(1);
  });

  it('si la siembra falla, no queda NADA y user_version sigue en 0 (DD-020)', () => {
    const makeDriver = makeMemoryDriver();
    const db = makeDriver();

    enableExampleSeedForTests((conn, now) => {
      seedExampleDeck(conn, now);
      throw new Error('disco lleno a mitad de la siembra');
    });
    const failed = openDatabase(() => db);

    expect(failed.ok).toBe(false);
    expect(userVersion(db)).toBe(0);
    expect(
      db.executeSync("SELECT name FROM sqlite_master WHERE name='sources'").rows,
    ).toHaveLength(0);

    // El siguiente arranque, con la siembra sana, crea la base entera.
    resetDatabaseForTests();
    enableExampleSeedForTests();
    const retried = openDatabase(() => db);

    expect(retried.ok).toBe(true);
    expect(examples(retried.db)).toHaveLength(1);
  });

  it('el esquema rechaza un segundo ejemplo (sources_one_example)', () => {
    enableExampleSeedForTests();
    const {db} = openDatabase(makeMemoryDriver());

    expect(() =>
      db.executeSync(
        `INSERT INTO sources (name, name_key, url_original, url_csv, is_active, created_at, kind)
         VALUES ('Otro', 'otro', '', '', 0, 1, 'example')`,
      ),
    ).toThrow(/UNIQUE/i);
  });

  it('el esquema rechaza un kind desconocido', () => {
    const {db} = openDatabase(makeMemoryDriver());

    expect(() =>
      db.executeSync(
        `INSERT INTO sources (name, name_key, url_original, url_csv, is_active, created_at, kind)
         VALUES ('X', 'x', 'u', 'c', 0, 1, 'otro')`,
      ),
    ).toThrow(/CHECK/i);
  });
});
