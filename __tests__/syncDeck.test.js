/**
 * Tests de src/decks/syncDeck.js.
 *
 * La red se INYECTA por `deps.net` (DD-004): estos tests no tocan `fetch` ni
 * `XMLHttpRequest`, que siguen siendo los del guardia de jest.setup.js. La base es
 * `node:sqlite` en memoria, asi que la secuencia se ejercita entera con SQL de
 * verdad.
 *
 * REQ-020, REQ-041 a REQ-047, REQ-052 a REQ-054, REQ-062 a REQ-064.
 *
 * @format
 */

import {openDatabase, resetDatabaseForTests} from '../src/db/database';
import {listQuestions, readImageUri} from '../src/decks/decksRepo';
import {syncDeck} from '../src/decks/syncDeck';
import {makeMemoryDriver} from './support/nodeSqliteDriver';
import {HEADER, REAL_CSV, toCsv} from './support/sheetFixtures';

/** @type {import('../src/db/database').Driver} */
let db;
/** @type {import('../src/sources/sourcesRepo').Source} */
let source;

beforeEach(() => {
  resetDatabaseForTests();
  db = openDatabase(makeMemoryDriver()).db;

  db.executeSync(
    `INSERT INTO sources (name, name_key, url_original, url_csv, is_active, created_at)
     VALUES ('Fisica', 'fisica', 'https://x/orig', 'https://x/csv', 1, 100)`,
  );

  source = {
    id: db.executeSync('SELECT last_insert_rowid() AS id').rows[0].id,
    name: 'Fisica',
    urlOriginal: 'https://x/orig',
    urlCsv: 'https://x/csv',
    isActive: true,
    createdAt: 100,
  };
});

/**
 * Red inyectable: un CSV y un plan de imagenes por URL.
 *
 * @param {{csv?: Object, images?: Object|((url: string) => Object)}} plan
 * @returns {{downloadText: jest.Mock, downloadBytes: jest.Mock}}
 */
function fakeNet(plan = {}) {
  const csv = plan.csv ?? {ok: true, text: REAL_CSV};
  const images = plan.images ?? {ok: true, mime: 'image/png', bytes: new Uint8Array(64)};

  return {
    downloadText: jest.fn(() => Promise.resolve(csv)),
    downloadBytes: jest.fn(url =>
      Promise.resolve(typeof images === 'function' ? images(url) : images),
    ),
  };
}

/**
 * Hoja con `count` preguntas, la tercera con dos imagenes.
 *
 * @param {number} count
 * @returns {string}
 */
function sheetOf(count) {
  const rows = [HEADER];

  for (let i = 0; i < count; i += 1) {
    const withImages = i === 2;

    rows.push([
      `Pregunta ${i}`,
      withImages ? 'https://img/a.png' : '',
      `Respuesta ${i}`,
      '',
      withImages ? 'https://img/b.png' : '',
      '',
    ]);
  }

  return toCsv(rows);
}

/** @returns {{onProgress: jest.Mock, events: Array<Object>}} */
function progressSpy() {
  const events = [];

  return {events, onProgress: jest.fn(update => events.push(update))};
}

describe('syncDeck: el camino bueno con el fichero real', () => {
  it('guarda las DOS preguntas y devuelve un informe de exito', async () => {
    const net = fakeNet();

    const report = await syncDeck(source, {net, now: () => 5000});

    expect(report.outcome).toBe('done');
    expect(report.saved).toBe(2);
    expect(listQuestions(source.id)).toHaveLength(2);
    expect(
      db.executeSync('SELECT last_synced_at FROM sources').rows[0].last_synced_at,
    ).toBe(5000);
  });

  it('descarga la url_csv GUARDADA y no la deriva otra vez (REQ-020)', async () => {
    const net = fakeNet();

    await syncDeck(source, {net});

    expect(net.downloadText).toHaveBeenCalledTimes(1);
    expect(net.downloadText.mock.calls[0][0]).toBe('https://x/csv');
    expect(net.downloadText.mock.calls[0][0]).not.toBe('https://x/orig');
  });

  it('los bytes descargados acaban como data URI, sin perder ni un byte', async () => {
    // LA CADENA COMPLETA, que es lo que ningun otro test recorria: red -> bytes ->
    // codificador -> SQL -> lectura. Si el codificador se rompiera, aqui salta.
    const bytes = new Uint8Array([0, 1, 127, 128, 254, 255]);
    const net = fakeNet({
      csv: {ok: true, text: sheetOf(4)},
      images: {ok: true, mime: 'image/png', bytes},
    });

    await syncDeck(source, {net});

    const third = listQuestions(source.id)[2];
    const uri = readImageUri(third.imageQuestionId);

    expect(uri.startsWith('data:image/png;base64,')).toBe(true);

    const decoded = new Uint8Array(
      global.Buffer.from(uri.slice('data:image/png;base64,'.length), 'base64'),
    );

    // Los mismos seis bytes, con el 0 y el 255 dentro: los que una conversion
    // descuidada estropea.
    expect(Array.from(decoded)).toEqual([0, 1, 127, 128, 254, 255]);
  });

  it('guarda los textos y las imagenes de la segunda pregunta', async () => {
    const net = fakeNet();

    await syncDeck(source, {net});

    const deck = listQuestions(source.id);

    expect(deck[0].question).toBe('Cuántos días tiene una semana');
    expect(deck[0].answer2).toMatch(/^El primer día de la semana/);
    expect(deck[0].imageQuestionId).toBeNull();

    // La segunda fila del fichero real trae las dos imagenes, y la MISMA URL en
    // las dos celdas: una descarga, una fila, dos huecos (REQ-047).
    expect(deck[1].imageQuestionId).not.toBeNull();
    expect(deck[1].imageAnswerId).toBe(deck[1].imageQuestionId);
    expect(net.downloadBytes).toHaveBeenCalledTimes(1);
  });
});

describe('syncDeck: el contador es honesto (REQ-052, REQ-053)', () => {
  it('empieza sin total y lo publica al interpretar el CSV', async () => {
    const {onProgress, events} = progressSpy();

    await syncDeck(source, {net: fakeNet({csv: {ok: true, text: sheetOf(20)}}), onProgress});

    expect(events[0]).toEqual({phase: 'preparing', done: 0, total: null});
    // Ni un cero ni un total inventado antes de saberlo.
    expect(events.filter(e => e.total === 0)).toHaveLength(0);
    expect(events[1]).toEqual({phase: 'working', done: 0, total: 20});
  });

  it('no avanza a la pregunta 3 hasta que sus DOS imagenes estan resueltas', async () => {
    const {onProgress, events} = progressSpy();
    const seen = [];

    const net = fakeNet({
      csv: {ok: true, text: sheetOf(20)},
      images: url => {
        // Lo que el contador dice MIENTRAS se descargan las imagenes de la 3.
        seen.push({url, done: events[events.length - 1].done});
        return {ok: true, mime: 'image/png', bytes: new Uint8Array(32)};
      },
    });

    await syncDeck(source, {net, onProgress});

    // La pregunta 3 es la de indice 2, asi que mientras van sus imagenes el
    // contador tiene que seguir en 2.
    expect(seen).toHaveLength(2);
    seen.forEach(entry => expect(entry.done).toBe(2));
  });

  it('N de N es el ULTIMO evento, nunca uno intermedio', async () => {
    const {onProgress, events} = progressSpy();

    await syncDeck(source, {net: fakeNet({csv: {ok: true, text: sheetOf(6)}}), onProgress});

    const last = events[events.length - 1];

    expect(last).toEqual({phase: 'working', done: 6, total: 6});
    expect(events.filter(e => e.done === 6)).toHaveLength(1);
  });
});

describe('syncDeck: imagenes (REQ-042 a REQ-047)', () => {
  it('una imagen de 1,8 MB se omite y la pregunta se guarda con su texto', async () => {
    const net = fakeNet({
      csv: {ok: true, text: sheetOf(4)},
      images: url =>
        url.endsWith('a.png')
          ? {ok: false, reason: 'TOO_LARGE'}
          : {ok: true, mime: 'image/png', bytes: new Uint8Array(120)},
    });

    const report = await syncDeck(source, {net});

    expect(report.outcome).toBe('done');
    expect(report.saved).toBe(4);
    expect(report.skippedImages).toBe(1);

    const third = listQuestions(source.id)[2];
    expect(third.question).toBe('Pregunta 2');
    expect(third.imageQuestionId).toBeNull();
    // La otra imagen de esa misma pregunta si se guarda.
    expect(third.imageAnswerId).not.toBeNull();
  });

  it('una imagen que falla no aborta nada, y se cuenta aparte (REQ-044)', async () => {
    const net = fakeNet({
      csv: {ok: true, text: sheetOf(5)},
      images: {ok: false, reason: 'INVALID_CONTENT'},
    });

    const report = await syncDeck(source, {net});

    expect(report.outcome).toBe('done');
    expect(report.saved).toBe(5);
    expect(report.failedImages).toBe(2);
    expect(report.skippedImages).toBe(0);
  });

  it('el plazo agotado de una imagen se trata como un fallo (REQ-046)', async () => {
    const net = fakeNet({
      csv: {ok: true, text: sheetOf(4)},
      images: {ok: false, reason: 'TIMEOUT'},
    });

    const report = await syncDeck(source, {net});

    // La actualizacion CONTINUA: el contador llega al final en vez de congelarse.
    expect(report.outcome).toBe('done');
    expect(report.saved).toBe(4);
    expect(report.failedImages).toBe(2);
  });

  it('cinco preguntas con la misma URL: UNA descarga (REQ-047)', async () => {
    const rows = [HEADER];

    for (let i = 0; i < 5; i += 1) {
      rows.push([`P${i}`, 'https://img/repetida.png', `R${i}`, '', '', '']);
    }

    const net = fakeNet({csv: {ok: true, text: toCsv(rows)}});

    await syncDeck(source, {net});

    expect(net.downloadBytes).toHaveBeenCalledTimes(1);

    const deck = listQuestions(source.id);
    const ids = new Set(deck.map(q => q.imageQuestionId));

    expect(deck).toHaveLength(5);
    expect(ids.size).toBe(1);
    expect([...ids][0]).not.toBeNull();
  });

  it('una URL que falla tampoco se reintenta, y se cuenta UNA vez (DD-015)', async () => {
    const rows = [HEADER];

    for (let i = 0; i < 5; i += 1) {
      rows.push([`P${i}`, 'https://img/rota.png', `R${i}`, '', '', '']);
    }

    const net = fakeNet({
      csv: {ok: true, text: toCsv(rows)},
      images: {ok: false, reason: 'TIMEOUT'},
    });

    const report = await syncDeck(source, {net});

    // Sin cachear los fracasos serian CINCO esperas al plazo: dos minutos de
    // contador congelado por una imagen que ya se sabe que no viene.
    expect(net.downloadBytes).toHaveBeenCalledTimes(1);
    expect(report.failedImages).toBe(1);
  });
});

describe('syncDeck: cancelacion (REQ-054)', () => {
  it('cancelar en la pregunta 7 deja LAS 20 anteriores', async () => {
    // Mazo anterior de 20.
    await syncDeck(source, {net: fakeNet({csv: {ok: true, text: sheetOf(20)}})});
    const antes = listQuestions(source.id);
    expect(antes).toHaveLength(20);

    const controller = new AbortController();
    const {onProgress} = progressSpy();

    const net = fakeNet({csv: {ok: true, text: sheetOf(30)}});
    let done = 0;

    const report = await syncDeck(source, {
      net,
      signal: controller.signal,
      onProgress: update => {
        onProgress(update);
        done = update.done;

        if (done === 7) {
          controller.abort();
        }
      },
    });

    expect(report.outcome).toBe('cancelled');

    const despues = listQuestions(source.id);

    // 20, no 7 y no 30. Y las MISMAS de antes, no una mezcla.
    expect(despues).toHaveLength(20);
    expect(despues.map(q => q.question)).toEqual(antes.map(q => q.question));
  });

  it('cancelar durante la descarga de una imagen no deja esa pregunta a medias', async () => {
    const controller = new AbortController();

    const net = fakeNet({
      csv: {ok: true, text: sheetOf(6)},
      images: () => {
        controller.abort();
        return {ok: false, reason: 'ABORTED'};
      },
    });

    const report = await syncDeck(source, {net, signal: controller.signal});

    expect(report.outcome).toBe('cancelled');
    // Ni una fila: no habia mazo anterior, y lo pendiente se tiro entero.
    expect(listQuestions(source.id)).toEqual([]);
    expect(db.executeSync('SELECT COUNT(*) AS n FROM questions').rows[0].n).toBe(0);
    expect(db.executeSync('SELECT COUNT(*) AS n FROM images').rows[0].n).toBe(0);
  });

  it('un signal ya abortado es cancelacion, no error', async () => {
    const controller = new AbortController();
    controller.abort();

    const net = fakeNet({csv: {ok: false, reason: 'ABORTED'}});
    const report = await syncDeck(source, {net, signal: controller.signal});

    // 'cancelled' y no 'error': el usuario hizo lo que queria, no hay nada que
    // reprocharle con un mensaje de fallo.
    expect(report.outcome).toBe('cancelled');
    expect(report.reason).toBeUndefined();
  });

  it('no deja la fecha escrita al cancelar (REQ-012)', async () => {
    const controller = new AbortController();
    controller.abort();

    await syncDeck(source, {
      net: fakeNet({csv: {ok: false, reason: 'ABORTED'}}),
      signal: controller.signal,
      now: () => 9999,
    });

    expect(
      db.executeSync('SELECT last_synced_at FROM sources').rows[0].last_synced_at,
    ).toBeNull();
  });
});

describe('syncDeck: errores que no escriben nada', () => {
  it('sin conexion: motivo NO_CONNECTION y mazo anterior intacto', async () => {
    await syncDeck(source, {net: fakeNet({csv: {ok: true, text: sheetOf(3)}})});

    const report = await syncDeck(source, {
      net: fakeNet({csv: {ok: false, reason: 'NO_CONNECTION'}}),
    });

    expect(report).toMatchObject({outcome: 'error', reason: 'NO_CONNECTION', saved: 0});
    expect(listQuestions(source.id)).toHaveLength(3);
  });

  it('un HTTP_ERROR conserva su status para el mensaje', async () => {
    const report = await syncDeck(source, {
      net: fakeNet({csv: {ok: false, reason: 'HTTP_ERROR', status: 404}}),
    });

    expect(report).toMatchObject({reason: 'HTTP_ERROR', status: 404});
  });

  it('falta una columna obligatoria: se dice CUAL y no se guarda nada (REQ-025)', async () => {
    const net = fakeNet({
      csv: {ok: true, text: toCsv([['Pregunta', 'Notas'], ['P', 'x']])},
    });

    const report = await syncDeck(source, {net});

    expect(report).toMatchObject({
      outcome: 'error',
      reason: 'MISSING_COLUMN',
      missing: 'RESPUESTA1',
    });
    expect(db.executeSync('SELECT COUNT(*) AS n FROM questions').rows[0].n).toBe(0);
  });

  it('hoja sin filas validas: EMPTY_SHEET, distinto de contenido invalido (REQ-062)', async () => {
    const net = fakeNet({csv: {ok: true, text: toCsv([HEADER])}});

    await syncDeck(source, {net: fakeNet({csv: {ok: true, text: sheetOf(2)}})});

    const report = await syncDeck(source, {net});

    expect(report).toMatchObject({outcome: 'error', reason: 'EMPTY_SHEET'});
    expect(listQuestions(source.id)).toHaveLength(2);
  });

  it('informa de las filas descartadas por incompletas (REQ-027)', async () => {
    const net = fakeNet({
      csv: {
        ok: true,
        text: toCsv([
          HEADER,
          ['Uno', '', 'R1', '', '', ''],
          ['Sin respuesta', '', '', '', '', ''],
        ]),
      },
    });

    const report = await syncDeck(source, {net});

    expect(report.outcome).toBe('done');
    expect(report.saved).toBe(1);
    expect(report.warnings).toEqual([{row: 3, reason: 'INCOMPLETE'}]);
  });
});

describe('syncDeck: fallo de escritura inyectado (REQ-063, REQ-064, DD-012)', () => {
  it('el disco que se llena en la pregunta 7 no lanza y no rompe el mazo', async () => {
    await syncDeck(source, {net: fakeNet({csv: {ok: true, text: sheetOf(20)}})});
    const antes = listQuestions(source.id);

    let inserts = 0;
    const original = db.executeSync;

    db.executeSync = (sql, params) => {
      if (sql.includes('INSERT INTO questions')) {
        inserts += 1;

        if (inserts === 7) {
          throw new Error('database or disk is full');
        }
      }

      return original.call(db, sql, params);
    };

    const net = fakeNet({csv: {ok: true, text: sheetOf(30)}});
    let report;

    // No lanza: eso es el contrato de syncDeck, y es lo que evita una excepcion
    // sin capturar en el manejador del boton que la disparo.
    await expect(
      (async () => {
        report = await syncDeck(source, {net});
      })(),
    ).resolves.toBeUndefined();

    db.executeSync = original;

    expect(report).toMatchObject({outcome: 'error', reason: 'DATABASE_ERROR'});

    // El mazo anterior sigue ENTERO, y no hay pendientes colgando.
    expect(listQuestions(source.id).map(q => q.question)).toEqual(
      antes.map(q => q.question),
    );
    expect(db.executeSync('SELECT COUNT(*) AS n FROM questions').rows[0].n).toBe(20);
  });

  it('si tambien falla la limpieza, sigue devolviendo un informe', async () => {
    const original = db.executeSync;

    db.executeSync = (sql, params) => {
      if (sql.includes('INSERT INTO questions') || sql.includes('DELETE FROM questions')) {
        throw new Error('database or disk is full');
      }

      return original.call(db, sql, params);
    };

    const report = await syncDeck(source, {
      net: fakeNet({csv: {ok: true, text: sheetOf(3)}}),
    });

    db.executeSync = original;

    // El `finally` no puede ser el que rompa la promesa: si la base esta rota,
    // discardPending falla tambien, y una excepcion aca sustituiria el informe por
    // una excepcion sin capturar.
    expect(report).toMatchObject({outcome: 'error', reason: 'DATABASE_ERROR'});
  });
});

describe('syncDeck: idempotencia frente a lo pendiente (DD-013)', () => {
  it('barre lo pendiente de una ejecucion anterior antes de empezar', async () => {
    // Lo que deja la app matada por el sistema a mitad de descarga.
    db.executeSync(
      `INSERT INTO questions (source_id, position, question, answer1, is_pending)
       VALUES (?, 0, 'colgada', 'R', 1)`,
      [source.id],
    );

    const report = await syncDeck(source, {
      net: fakeNet({csv: {ok: true, text: sheetOf(2)}}),
    });

    expect(report.outcome).toBe('done');

    const deck = listQuestions(source.id);

    // La colgada no se cuela en el mazo nuevo.
    expect(deck).toHaveLength(2);
    expect(deck.some(q => q.question === 'colgada')).toBe(false);
  });
});
