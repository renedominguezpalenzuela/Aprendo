/**
 * Tests de src/decks/decksRepo.js.
 *
 * Contra `node:sqlite` en memoria: SQL de verdad, con las mismas restricciones,
 * los mismos indices y las mismas transacciones que en el telefono
 * (data-sources design.md DD-014). La logica de aca ES SQL, y probarla contra un
 * mock que registra cadenas no probaria nada.
 *
 * Cubre REQ-001 a REQ-004, REQ-007, REQ-014, REQ-029 y REQ-047.
 *
 * @format
 */

import {openDatabase, resetDatabaseForTests} from '../src/db/database';
import {
  attachImage,
  deleteDeck,
  discardPending,
  insertPendingImage,
  insertPendingQuestion,
  listDeckSummaries,
  listQuestions,
  promoteDeck,
  readImageUri,
  sweepPendingDecks,
} from '../src/decks/decksRepo';
import {makeMemoryDriver} from './support/nodeSqliteDriver';

/** @type {import('../src/db/database').Driver} */
let db;

beforeEach(() => {
  resetDatabaseForTests();
  db = openDatabase(makeMemoryDriver()).db;
});

/**
 * @param {string} name
 * @param {{active?: boolean, url?: string}} [options]
 * @returns {number}
 */
function addSource(name, options = {}) {
  db.executeSync(
    `INSERT INTO sources (name, name_key, url_original, url_csv, is_active, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      name,
      name.toLowerCase(),
      options.url ?? `https://x/${name}`,
      options.url ?? `https://x/${name}/csv`,
      options.active ? 1 : 0,
      Date.now(),
    ],
  );

  return db.executeSync('SELECT last_insert_rowid() AS id').rows[0].id;
}

/**
 * @param {number} position
 * @param {string} text
 * @returns {import('../src/decks/deckSheet').ParsedQuestion}
 */
function parsed(position, text) {
  return {
    position,
    question: `¿${text}?`,
    answer1: `Respuesta ${text}`,
    answer2: null,
    imageQuestionUrl: null,
    imageAnswerUrl: null,
  };
}

/**
 * Escribe un mazo COMPLETO (insertado y promovido) para una fuente.
 *
 * @param {number} sourceId
 * @param {number} count
 * @param {number} [now]
 */
function seedDeck(sourceId, count, now = 1000, label = `s${sourceId}`) {
  // El texto lleva la fuente dentro a proposito: con textos identicos en dos
  // mazos, cualquier comprobacion de "no se cruzan" pasaria sin comprobar nada.
  for (let i = 0; i < count; i += 1) {
    insertPendingQuestion(sourceId, parsed(i, `${label}-p${i}`));
  }
  promoteDeck(sourceId, now);
}

/** @param {number} n @returns {Uint8Array} */
function bytesOf(n) {
  return new Uint8Array(n).fill(1);
}

/** @param {string} table @returns {number} */
function countRows(table) {
  return db.executeSync(`SELECT COUNT(*) AS n FROM ${table}`).rows[0].n;
}

describe('listQuestions: aislamiento y orden (REQ-003, REQ-029)', () => {
  it('devuelve solo las preguntas de esa fuente', () => {
    const fisica = addSource('Fisica', {active: true});
    const mates = addSource('Mates');

    seedDeck(fisica, 3, 1000, 'fisica');
    seedDeck(mates, 2, 1000, 'mates');

    expect(listQuestions(fisica)).toHaveLength(3);
    expect(listQuestions(mates)).toHaveLength(2);

    // Ni una cruzada: es el requisito entero. Los textos llevan la fuente dentro,
    // asi que un cruce se ve.
    expect(listQuestions(fisica).every(q => q.question.includes('fisica'))).toBe(true);
    expect(listQuestions(mates).every(q => q.question.includes('mates'))).toBe(true);

    const deMates = listQuestions(mates).map(q => q.question);
    expect(listQuestions(fisica).some(q => deMates.includes(q.question))).toBe(false);
  });

  it('conserva el orden del documento, no el de insercion en la tabla', () => {
    const id = addSource('S');

    // Se insertan DESORDENADAS a proposito.
    insertPendingQuestion(id, parsed(2, 'tercera'));
    insertPendingQuestion(id, parsed(0, 'primera'));
    insertPendingQuestion(id, parsed(1, 'segunda'));
    promoteDeck(id, 1);

    expect(listQuestions(id).map(q => q.position)).toEqual([0, 1, 2]);
    expect(listQuestions(id)[0].question).toContain('primera');
  });

  it('devuelve [] para una fuente sin mazo', () => {
    expect(listQuestions(addSource('Vacia'))).toEqual([]);
  });

  it('no devuelve blobs, solo los IDs de imagen (DD-003)', () => {
    const id = addSource('S');
    const questionId = insertPendingQuestion(id, parsed(0, 'con foto'));
    const imageId = insertPendingImage(id, {
      url: 'https://x/f.png',
      mime: 'image/png',
      bytes: bytesOf(64),
    });

    attachImage(questionId, 'question', imageId);
    promoteDeck(id, 1);

    const question = listQuestions(id)[0];

    expect(question.imageQuestionId).toBe(imageId);
    expect(question.imageAnswerId).toBeNull();
    expect(Object.keys(question)).not.toContain('bytes');
    expect(JSON.stringify(question)).not.toContain('Uint8Array');
  });
});

describe('is_pending: el mazo anterior sobrevive (REQ-007, DD-001)', () => {
  it('con 20 promovidas y 7 pendientes, se leen LAS 20', () => {
    const id = addSource('S');

    seedDeck(id, 20);

    // Una actualizacion a mitad: siete preguntas nuevas ya escritas.
    for (let i = 0; i < 7; i += 1) {
      insertPendingQuestion(id, parsed(i, `nueva${i}`));
    }

    const deck = listQuestions(id);

    // 20, no 7 y no 27. Es LA garantia que hace posibles REQ-054 y REQ-064.
    expect(deck).toHaveLength(20);
    expect(deck.every(q => !q.question.includes('nueva'))).toBe(true);
  });

  it('las imagenes pendientes tampoco se ven en el resumen', () => {
    const id = addSource('S');

    seedDeck(id, 1);
    insertPendingImage(id, {url: 'u', mime: 'image/png', bytes: bytesOf(5000)});

    // El tamano que se muestra es el del mazo VIGENTE, no el de la descarga en
    // curso: si no, la fila crecería a mitad de actualizacion y volveria atras.
    expect(listDeckSummaries()[id].bytes).toBeLessThan(5000);
  });
});

describe('promoteDeck: el cambio atomico (REQ-007, REQ-012)', () => {
  it('sustituye el mazo entero y escribe la fecha', () => {
    const id = addSource('S');

    seedDeck(id, 20, 1000);
    expect(listQuestions(id)).toHaveLength(20);

    for (let i = 0; i < 3; i += 1) {
      insertPendingQuestion(id, parsed(i, `nueva${i}`));
    }
    promoteDeck(id, 2000);

    const deck = listQuestions(id);

    expect(deck).toHaveLength(3);
    expect(deck.every(q => q.question.includes('nueva'))).toBe(true);

    // Ni una fila del mazo viejo queda ocupando espacio.
    expect(countRows('questions')).toBe(3);
    expect(db.executeSync('SELECT last_synced_at FROM sources').rows[0].last_synced_at).toBe(
      2000,
    );
  });

  it('borra tambien las imagenes viejas, sin dejar huerfanas', () => {
    const id = addSource('S');
    const q1 = insertPendingQuestion(id, parsed(0, 'vieja'));
    const i1 = insertPendingImage(id, {
      url: 'https://x/vieja.png',
      mime: 'image/png',
      bytes: bytesOf(100),
    });

    attachImage(q1, 'question', i1);
    promoteDeck(id, 1000);

    const q2 = insertPendingQuestion(id, parsed(0, 'nueva'));
    const i2 = insertPendingImage(id, {
      url: 'https://x/nueva.png',
      mime: 'image/png',
      bytes: bytesOf(200),
    });

    attachImage(q2, 'question', i2);
    promoteDeck(id, 2000);

    expect(countRows('images')).toBe(1);
    expect(readImageUri(i1)).toBeNull();
    expect(readImageUri(i2)).toMatch(/^data:image\/png;base64,/);
  });

  it('no toca el mazo de otras fuentes', () => {
    const a = addSource('A');
    const b = addSource('B');

    seedDeck(a, 4);
    seedDeck(b, 2);

    insertPendingQuestion(a, parsed(0, 'solo una'));
    promoteDeck(a, 3000);

    expect(listQuestions(a)).toHaveLength(1);
    expect(listQuestions(b)).toHaveLength(2);
  });

  it('si la transaccion falla a mitad, el mazo viejo sigue ENTERO', () => {
    const id = addSource('S');

    seedDeck(id, 5, 1000);
    insertPendingQuestion(id, parsed(0, 'nueva'));

    // Se rompe la ultima sentencia de la transaccion: la fecha.
    const original = db.executeSync;
    db.executeSync = (sql, params) => {
      if (sql.includes('UPDATE sources SET last_synced_at')) {
        throw new Error('database or disk is full');
      }
      return original.call(db, sql, params);
    };

    expect(() => promoteDeck(id, 2000)).toThrow(/disk is full/);
    db.executeSync = original;

    // Ni el borrado ni el desmarcado se aplicaron: la transaccion revirtio entera.
    const deck = listQuestions(id);
    expect(deck).toHaveLength(5);
    expect(deck.every(q => !q.question.includes('nueva'))).toBe(true);
    expect(db.executeSync('SELECT last_synced_at FROM sources').rows[0].last_synced_at).toBe(
      1000,
    );
  });
});

describe('discardPending y sweepPendingDecks (REQ-054, REQ-064, REQ-085)', () => {
  it('discardPending deja las promovidas intactas', () => {
    const id = addSource('S');

    seedDeck(id, 20);
    for (let i = 0; i < 7; i += 1) {
      insertPendingQuestion(id, parsed(i, `nueva${i}`));
    }
    insertPendingImage(id, {url: 'u', mime: 'image/png', bytes: bytesOf(10)});

    discardPending(id);

    expect(listQuestions(id)).toHaveLength(20);
    expect(countRows('questions')).toBe(20);
    expect(countRows('images')).toBe(0);
  });

  it('discardPending solo afecta a su fuente', () => {
    const a = addSource('A');
    const b = addSource('B');

    insertPendingQuestion(a, parsed(0, 'de A'));
    insertPendingQuestion(b, parsed(0, 'de B'));

    discardPending(a);

    expect(countRows('questions')).toBe(1);
    expect(
      db.executeSync('SELECT source_id FROM questions').rows[0].source_id,
    ).toBe(b);
  });

  it('sweepPendingDecks limpia TODAS las fuentes y no toca lo promovido', () => {
    const a = addSource('A');
    const b = addSource('B');

    seedDeck(a, 3);
    insertPendingQuestion(a, parsed(0, 'colgada de A'));
    insertPendingQuestion(b, parsed(0, 'colgada de B'));
    insertPendingImage(b, {url: 'u', mime: 'image/png', bytes: bytesOf(10)});

    sweepPendingDecks();

    expect(listQuestions(a)).toHaveLength(3);
    expect(countRows('questions')).toBe(3);
    expect(countRows('images')).toBe(0);
  });
});

describe('borrado en cascada (REQ-004, DD-002)', () => {
  it('borrar la fuente deja 0 filas en las TRES tablas', () => {
    const id = addSource('S');
    const questionId = insertPendingQuestion(id, parsed(0, 'con foto'));
    const imageId = insertPendingImage(id, {
      url: 'https://x/f.png',
      mime: 'image/png',
      bytes: bytesOf(500),
    });

    attachImage(questionId, 'question', imageId);
    promoteDeck(id, 1000);

    expect(countRows('questions')).toBe(1);
    expect(countRows('images')).toBe(1);

    db.executeSync('DELETE FROM sources WHERE id = ?', [id]);

    // ESTE es el test que cae si alguien quita `PRAGMA foreign_keys = ON` de
    // database.js, y solo cae porque el driver de tests las trae APAGADAS: si se
    // quedara con el defecto de node:sqlite, pasaria igual sin el pragma y las
    // filas quedarian huerfanas en el telefono. Ver DD-002.
    expect(countRows('sources')).toBe(0);
    expect(countRows('questions')).toBe(0);
    expect(countRows('images')).toBe(0);
  });

  it('arrastra tambien lo PENDIENTE de esa fuente', () => {
    const id = addSource('S');

    insertPendingQuestion(id, parsed(0, 'a medias'));
    insertPendingImage(id, {url: 'u', mime: 'image/png', bytes: bytesOf(10)});

    db.executeSync('DELETE FROM sources WHERE id = ?', [id]);

    expect(countRows('questions')).toBe(0);
    expect(countRows('images')).toBe(0);
  });

  it('borrar una fuente no toca el mazo de otra', () => {
    const a = addSource('A');
    const b = addSource('B');

    seedDeck(a, 2);
    seedDeck(b, 3);

    db.executeSync('DELETE FROM sources WHERE id = ?', [a]);

    expect(listQuestions(b)).toHaveLength(3);
    expect(countRows('questions')).toBe(3);
  });
});

describe('deleteDeck (REQ-008, DD-014)', () => {
  it('borra el mazo entero de una fuente, pendiente y promovido', () => {
    const id = addSource('S');

    seedDeck(id, 4);
    insertPendingQuestion(id, parsed(0, 'a medias'));
    insertPendingImage(id, {url: 'u', mime: 'image/png', bytes: bytesOf(10)});

    deleteDeck(id);

    expect(listQuestions(id)).toEqual([]);
    expect(countRows('questions')).toBe(0);
    expect(countRows('images')).toBe(0);
    // La fuente NO se borra: cambiar de hoja no es borrar la fuente.
    expect(countRows('sources')).toBe(1);
  });
});

describe('imagenes compartidas (REQ-047, DD-015)', () => {
  it('dos preguntas pueden colgar de la MISMA imagen, y se promueven bien', () => {
    const id = addSource('S');
    const imageId = insertPendingImage(id, {
      url: 'https://x/repetida.png',
      mime: 'image/png',
      bytes: bytesOf(300),
    });

    const ids = [0, 1, 2, 3, 4].map(i => {
      const questionId = insertPendingQuestion(id, parsed(i, `p${i}`));
      attachImage(questionId, 'question', imageId);
      return questionId;
    });

    promoteDeck(id, 1000);

    // UNA fila de imagen para cinco preguntas: es lo que hace REQ-047 observable
    // en la base y no solo en el numero de descargas.
    expect(countRows('images')).toBe(1);
    expect(ids).toHaveLength(5);
    expect(listQuestions(id).every(q => q.imageQuestionId === imageId)).toBe(true);
  });

  it('la misma imagen puede ocupar los dos huecos de una pregunta', () => {
    const id = addSource('S');
    const questionId = insertPendingQuestion(id, parsed(0, 'p'));
    const imageId = insertPendingImage(id, {
      url: 'u',
      mime: 'image/png',
      bytes: bytesOf(10),
    });

    attachImage(questionId, 'question', imageId);
    attachImage(questionId, 'answer', imageId);
    promoteDeck(id, 1);

    const question = listQuestions(id)[0];
    expect(question.imageQuestionId).toBe(imageId);
    expect(question.imageAnswerId).toBe(imageId);
  });

  it('attachImage lanza con un hueco que no existe: es error del programador', () => {
    const id = addSource('S');
    const questionId = insertPendingQuestion(id, parsed(0, 'p'));

    expect(() => attachImage(questionId, 'pie_de_foto', 1)).toThrow(/desconocido/i);
  });
});

describe('readImageUri (REQ-002, REQ-045)', () => {
  it('devuelve un data URI listo para pintar, con los bytes intactos', () => {
    const id = addSource('S');
    const bytes = new Uint8Array([0, 128, 255, 7]);
    const imageId = insertPendingImage(id, {url: 'u', mime: 'image/jpeg', bytes});

    const uri = readImageUri(imageId);

    // Va DIRECTO a <Image source={{uri}}>: eso es lo que compra este formato.
    expect(uri.startsWith('data:image/jpeg;base64,')).toBe(true);

    // Y los bytes originales siguen ahi, incluidos el 0 y el 255.
    const decoded = new Uint8Array(
      global.Buffer.from(uri.slice('data:image/jpeg;base64,'.length), 'base64'),
    );
    expect(Array.from(decoded)).toEqual([0, 128, 255, 7]);
  });

  it('devuelve null si la imagen no existe', () => {
    expect(readImageUri(9999)).toBeNull();
  });
});

describe('listDeckSummaries (REQ-014, REQ-073)', () => {
  it('cuenta preguntas y suma bytes de imagen y de texto', () => {
    const id = addSource('S');
    const questionId = insertPendingQuestion(id, parsed(0, 'con foto'));
    const imageId = insertPendingImage(id, {
      url: 'u',
      mime: 'image/png',
      bytes: bytesOf(1000),
    });

    attachImage(questionId, 'question', imageId);
    promoteDeck(id, 5000);

    const summary = listDeckSummaries()[id];

    expect(summary.count).toBe(1);
    expect(summary.lastSyncedAt).toBe(5000);
    // Mide lo que ocupa en DISCO, y en base64 eso son ~1,33 veces los 1000 bytes de
    // la imagen mas su prefijo y el texto de la pregunta (REQ-014 tras el delta).
    expect(summary.bytes).toBeGreaterThan(1330);
    expect(summary.bytes).toBeLessThan(1500);
  });

  it('mide el texto en BYTES y no en caracteres', () => {
    const id = addSource('S');

    // Diez caracteres, veinte bytes en UTF-8: si se midieran caracteres, esto
    // reportaria la mitad del espacio real.
    insertPendingQuestion(id, {
      position: 0,
      question: 'ñññññ',
      answer1: 'ñññññ',
      answer2: null,
      imageQuestionUrl: null,
      imageAnswerUrl: null,
    });
    promoteDeck(id, 1);

    expect(listDeckSummaries()[id].bytes).toBe(20);
  });

  it('incluye las fuentes SIN preguntas, con cero', () => {
    const vacia = addSource('Vacia');
    const llena = addSource('Llena');

    seedDeck(llena, 2);

    const summaries = listDeckSummaries();

    // La fila necesita saber que tiene cero para no mostrar tamano alguno.
    expect(summaries[vacia]).toEqual({count: 0, bytes: 0, lastSyncedAt: null});
    expect(summaries[llena].count).toBe(2);
  });

  it('no lee ni una imagen para medir', () => {
    const id = addSource('S');
    const questionId = insertPendingQuestion(id, parsed(0, 'p'));
    const imageId = insertPendingImage(id, {
      url: 'u',
      mime: 'image/png',
      bytes: bytesOf(2048),
    });

    attachImage(questionId, 'question', imageId);
    promoteDeck(id, 1);

    const sqlSeen = [];
    const original = db.executeSync;
    db.executeSync = (sql, params) => {
      sqlSeen.push(sql);
      return original.call(db, sql, params);
    };

    listDeckSummaries();
    db.executeSync = original;

    // Ninguna consulta pide `data_uri`: para eso se guarda `stored_bytes`. Y ahora
    // importa mas que antes, porque esa columna es un 33 % mayor que los bytes.
    expect(sqlSeen.join(' ')).not.toMatch(/data_uri/);
    expect(sqlSeen.join(' ')).toMatch(/stored_bytes/);
  });
});
