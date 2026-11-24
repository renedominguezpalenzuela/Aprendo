/**
 * Tests del repositorio de fuentes.
 *
 * Corren contra `node:sqlite` en memoria con el esquema real (design.md DD-014).
 * NINGUN test comprueba cadenas de SQL: todos comprueban el estado de la base.
 *
 * Cubre REQ-012, REQ-014, REQ-015, REQ-017, REQ-018, REQ-021, REQ-022, REQ-031,
 * REQ-032, REQ-033 y REQ-035.
 *
 * @format
 */

import {getDb, openDatabase, resetDatabaseForTests} from '../src/db/database';
import {
  insertPendingImage,
  insertPendingQuestion,
  listQuestions,
  promoteDeck,
} from '../src/decks/decksRepo';
import {
  activateSource,
  addSource,
  listSources,
  readActiveSource,
  removeSource,
  updateSource,
} from '../src/sources/sourcesRepo';
import {makeMemoryDriver} from './support/nodeSqliteDriver';

const ID = '1Hf36KxLKJtv5Ve6JVkRnbfpn_xYbJx2AnIT9svqbfPk';
const SHEET = `https://docs.google.com/spreadsheets/d/${ID}`;

/** Marca de tiempo creciente, para que el orden de registro sea determinista. */
let clock = 0;

/**
 * @param {string} name
 * @param {string} [url]
 */
function add(name, url = `${SHEET}/edit`) {
  clock += 1000;

  return addSource({name, url}, clock);
}

/** @returns {string[]} nombres en el orden en que los devuelve la lista */
function names() {
  return listSources().map(source => source.name);
}

beforeEach(() => {
  resetDatabaseForTests();
  openDatabase(makeMemoryDriver());
  clock = 0;
});

describe('addSource', () => {
  it('guarda las dos URLs, la original y la derivada (REQ-014)', () => {
    add('Aprendiz', `${SHEET}/edit?gid=123#gid=123`);

    const [source] = listSources();

    expect(source.urlOriginal).toBe(`${SHEET}/edit?gid=123#gid=123`);
    expect(source.urlCsv).toBe(`${SHEET}/gviz/tq?tqx=out:csv&gid=123`);
  });

  it('activa la PRIMERA fuente automaticamente (REQ-017)', () => {
    add('Aprendiz');

    expect(readActiveSource().name).toBe('Aprendiz');
  });

  it('no activa las siguientes (REQ-017)', () => {
    add('Aprendiz');
    add('Companero');

    expect(readActiveSource().name).toBe('Aprendiz');
    expect(listSources().filter(s => s.isActive)).toHaveLength(1);
  });

  it('rechaza el nombre duplicado en distinta caja (REQ-012)', () => {
    add('Aprendiz');

    expect(add('  aprendiz  ')).toEqual({ok: false, reason: 'DUPLICATE_NAME'});
    expect(listSources()).toHaveLength(1);
  });

  it('rechaza el duplicado por el INDICE, no por comprobacion previa (DD-007)', () => {
    // Se inserta a mano saltandose addSource: si la unicidad viviera en JS, esta
    // fila entraria y el segundo add pasaria.
    add('Aprendiz');

    expect(add('APRENDIZ').ok).toBe(false);
  });

  it('acepta la misma URL con otro nombre (REQ-018)', () => {
    // Dos pestanas del mismo documento son fuentes legitimamente distintas.
    add('Hoja uno', `${SHEET}/edit?gid=0#gid=0`);
    const second = add('Hoja dos', `${SHEET}/edit?gid=99#gid=99`);

    expect(second.ok).toBe(true);
    expect(listSources()).toHaveLength(2);
  });

  it('acepta incluso la URL identica con otro nombre (REQ-018)', () => {
    add('Uno');

    expect(add('Dos').ok).toBe(true);
  });
});

describe('listSources', () => {
  it('pone la activa primero y el resto por orden de registro (REQ-021, DD-006)', () => {
    add('A');
    add('B');
    add('C');

    expect(names()).toEqual(['A', 'B', 'C']);

    activateSource(listSources().find(s => s.name === 'C').id);

    expect(names()).toEqual(['C', 'A', 'B']);
  });

  it('devuelve la lista vacia sin fuentes', () => {
    expect(listSources()).toEqual([]);
    expect(readActiveSource()).toBeNull();
  });

  it('expone isActive como booleano, no como 0/1', () => {
    add('A');

    expect(listSources()[0].isActive).toBe(true);
  });
});

describe('updateSource', () => {
  it('no rechaza como duplicado el nombre propio sin cambios (REQ-031)', () => {
    add('Aprendiz');
    const {id} = listSources()[0];

    const result = updateSource(id, {name: 'Aprendiz', url: `${SHEET}/edit?gid=7#gid=7`});

    expect(result).toEqual({ok: true});
  });

  it('rechaza si el nombre nuevo es el de OTRA fuente (REQ-031)', () => {
    add('Aprendiz');
    add('Companero');
    const companero = listSources().find(s => s.name === 'Companero');

    expect(updateSource(companero.id, {name: 'aprendiz', url: `${SHEET}/edit`})).toEqual({
      ok: false,
      reason: 'DUPLICATE_NAME',
    });
    // Y no ha escrito a medias.
    expect(names().sort()).toEqual(['Aprendiz', 'Companero']);
  });

  it('recalcula la URL derivada (REQ-032)', () => {
    add('Aprendiz', `${SHEET}/edit?gid=1#gid=1`);
    const {id} = listSources()[0];

    updateSource(id, {name: 'Aprendiz', url: `${SHEET}/edit?gid=456#gid=456`});

    const [source] = listSources();
    expect(source.urlCsv).toBe(`${SHEET}/gviz/tq?tqx=out:csv&gid=456`);
  });

  it('deja activa la fuente activa (REQ-033)', () => {
    add('Aprendiz');
    const {id} = listSources()[0];

    updateSource(id, {name: 'Primer Grado', url: `${SHEET}/edit`});

    expect(readActiveSource().name).toBe('Primer Grado');
  });

  it('informa si la fila ya no existe', () => {
    expect(updateSource(999, {name: 'X', url: `${SHEET}/edit`})).toEqual({
      ok: false,
      reason: 'NOT_FOUND',
    });
  });
});

describe('activateSource', () => {
  it('desactiva la anterior y activa la nueva (REQ-023)', () => {
    add('A');
    add('B');
    const b = listSources().find(s => s.name === 'B');

    activateSource(b.id);

    expect(readActiveSource().name).toBe('B');
    expect(listSources().filter(s => s.isActive)).toHaveLength(1);
  });

  it('tras cualquier secuencia hay exactamente una activa (REQ-022)', () => {
    add('A');
    add('B');
    add('C');
    const ids = listSources().map(s => s.id);

    // Alternar deprisa entre varias, incluida la que ya esta activa.
    [0, 1, 2, 1, 0, 0, 2].forEach(index => activateSource(ids[index]));

    expect(listSources().filter(s => s.isActive)).toHaveLength(1);
  });

  it('activar la que ya esta activa la deja activa', () => {
    add('A');
    const {id} = listSources()[0];

    expect(activateSource(id)).toEqual({ok: true});
    expect(readActiveSource().id).toBe(id);
  });

  it('informa si la fila ya no existe y no toca la activa', () => {
    add('A');

    expect(activateSource(999)).toEqual({ok: false, reason: 'NOT_FOUND'});
    expect(readActiveSource().name).toBe('A');
  });
});

describe('removeSource', () => {
  it('borra una no activa sin tocar la activa', () => {
    add('A');
    add('B');
    const b = listSources().find(s => s.name === 'B');

    removeSource(b.id);

    expect(names()).toEqual(['A']);
    expect(readActiveSource().name).toBe('A');
  });

  it('al borrar la activa, activa la mas antigua de las restantes (REQ-035)', () => {
    add('A');
    add('B');
    add('C');
    const a = listSources().find(s => s.name === 'A');

    // A es la activa por ser la primera.
    expect(readActiveSource().name).toBe('A');
    removeSource(a.id);

    expect(readActiveSource().name).toBe('B');
    expect(names()).toEqual(['B', 'C']);
  });

  it('al borrar la ultima queda la tabla vacia y sin activa (REQ-035)', () => {
    add('A');
    const {id} = listSources()[0];

    removeSource(id);

    expect(listSources()).toEqual([]);
    expect(readActiveSource()).toBeNull();
  });

  it('borrar una fila que ya no existe no rompe nada', () => {
    add('A');

    expect(() => removeSource(999)).not.toThrow();
    expect(names()).toEqual(['A']);
  });

  it('la invariante aguanta un ciclo completo de altas y borrados (REQ-022)', () => {
    add('A');
    add('B');
    add('C');

    listSources().forEach(source => removeSource(source.id));
    expect(listSources()).toEqual([]);

    add('D');
    expect(readActiveSource().name).toBe('D');
    expect(listSources().filter(s => s.isActive)).toHaveLength(1);
  });
});

// ─── deck-sync ───────────────────────────────────────────────────────────────
//
// REQ-008 y REQ-011 de deck-sync. Ver deck-sync design.md DD-014.

describe('lastSyncedAt (deck-sync REQ-011)', () => {
  it('una fuente nueva nace sin fecha, y es NULL y no 0', () => {
    addSource({name: 'Aprendiz', url: SHEET});

    const [source] = listSources();

    // NULL significa "nunca actualizada"; 0 seria "actualizada en 1970".
    expect(source.lastSyncedAt).toBeNull();
  });

  it('se expone en camelCase, como el resto de los campos', () => {
    addSource({name: 'Aprendiz', url: SHEET});
    getDb().executeSync('UPDATE sources SET last_synced_at = 4242');

    expect(listSources()[0].lastSyncedAt).toBe(4242);
    expect(readActiveSource().lastSyncedAt).toBe(4242);
    expect(Object.keys(listSources()[0])).not.toContain('last_synced_at');
  });
});

describe('editar la URL descarta el mazo (deck-sync REQ-008, DD-014)', () => {
  /**
   * Escribe un mazo promovido para una fuente.
   *
   * @param {number} sourceId
   * @param {number} count
   */
  function seedDeck(sourceId, count) {
    for (let i = 0; i < count; i += 1) {
      insertPendingQuestion(sourceId, {
        position: i,
        question: `P${i}`,
        answer1: `R${i}`,
        answer2: null,
        imageQuestionUrl: null,
        imageAnswerUrl: null,
      });
    }

    insertPendingImage(sourceId, {
      url: 'https://img/x.png',
      mime: 'image/png',
      bytes: new Uint8Array(500),
    });

    promoteDeck(sourceId, 5000);
  }

  it('cambiar de pestana borra las preguntas y las imagenes, y la fecha', () => {
    const {id} = addSource({name: 'Aprendiz', url: `${SHEET}?gid=1#gid=1`});

    seedDeck(id, 20);
    expect(listQuestions(id)).toHaveLength(20);

    const result = updateSource(id, {name: 'Aprendiz', url: `${SHEET}?gid=99#gid=99`});

    expect(result.ok).toBe(true);
    expect(listQuestions(id)).toEqual([]);
    expect(
      getDb().executeSync('SELECT COUNT(*) AS n FROM images').rows[0].n,
    ).toBe(0);
    // Vuelve a figurar como nunca actualizada.
    expect(listSources()[0].lastSyncedAt).toBeNull();
  });

  it('cambiar SOLO el nombre conserva el mazo', () => {
    const {id} = addSource({name: 'Aprendiz', url: SHEET});

    seedDeck(id, 20);

    updateSource(id, {name: 'Maestro', url: SHEET});

    // No ha cambiado de hoja: las preguntas siguen siendo suyas.
    expect(listQuestions(id)).toHaveLength(20);
    expect(listSources()[0].name).toBe('Maestro');
    expect(listSources()[0].lastSyncedAt).toBe(5000);
  });

  it('una URL distinta que deriva a la MISMA hoja conserva el mazo', () => {
    const {id} = addSource({name: 'Aprendiz', url: `${SHEET}?gid=7#gid=7`});

    seedDeck(id, 20);

    // Otra forma de escribir la misma direccion: `url_original` cambia, `url_csv`
    // no. Castigar una diferencia cosmetica seria hacerle repetir la descarga por
    // nada (DD-014).
    updateSource(id, {name: 'Aprendiz', url: `${SHEET}?gid=7&usp=sharing#gid=7`});

    expect(listQuestions(id)).toHaveLength(20);
    expect(listSources()[0].lastSyncedAt).toBe(5000);
  });

  it('no toca el mazo de las OTRAS fuentes', () => {
    const uno = addSource({name: 'Uno', url: `${SHEET}?gid=1#gid=1`}).id;
    const dos = addSource({name: 'Dos', url: `${SHEET}?gid=2#gid=2`}).id;

    seedDeck(uno, 3);
    seedDeck(dos, 4);

    updateSource(uno, {name: 'Uno', url: `${SHEET}?gid=9#gid=9`});

    expect(listQuestions(uno)).toEqual([]);
    expect(listQuestions(dos)).toHaveLength(4);
  });

  it('si el borrado falla, la edicion tampoco se aplica', () => {
    const {id} = addSource({name: 'Aprendiz', url: `${SHEET}?gid=1#gid=1`});

    seedDeck(id, 5);

    const db = getDb();
    const original = db.executeSync;

    db.executeSync = (sql, params) => {
      if (sql.includes('DELETE FROM questions')) {
        throw new Error('database or disk is full');
      }

      return original.call(db, sql, params);
    };

    expect(() =>
      updateSource(id, {name: 'Otro', url: `${SHEET}?gid=99#gid=99`}),
    ).toThrow(/disk is full/);

    db.executeSync = original;

    // Todo o nada: ni la URL nueva, ni el nombre nuevo, ni un mazo a medias. Sin la
    // transaccion compartida quedaria una fuente apuntando a una hoja con el mazo
    // de otra.
    const [source] = listSources();

    expect(source.name).toBe('Aprendiz');
    expect(source.urlOriginal).toContain('gid=1');
    expect(listQuestions(id)).toHaveLength(5);
  });
});
