/**
 * Lecturas y escrituras de `questions` e `images`.
 *
 * Unica capa que escribe SQL del mazo. Fuera de aca nadie sabe que existe una
 * columna `is_pending`, igual que nadie ve `is_active` como entero.
 *
 * NO HAY ERRORES ESPERADOS en este archivo, y eso es deliberado: aca no hay
 * nombres duplicados ni filas que el usuario pueda pedir por su cuenta. Cualquier
 * fallo de SQLite se PROPAGA, y su dueno escrito es el `try/catch` que envuelve
 * `syncDeck` entero (design.md DD-012). Un error que se decide propagar necesita
 * un dueno escrito, que es la leccion literal de
 * docs/solutions/2026-08-16-donde-va-el-catch-de-un-error-de-base.md.
 *
 * Ver specs/features/deck-sync/design.md seccion 2.7, seccion 3 y DD-001.
 *
 * @format
 */

import {getDb} from '../db/database';
import {toDataUri} from '../net/base64';

/**
 * @typedef {Object} Question
 * @property {number} id
 * @property {number} position
 * @property {string} question
 * @property {string} answer1
 * @property {string|null} answer2
 * @property {number|null} imageQuestionId
 * @property {number|null} imageAnswerId
 *
 * @typedef {{count: number, bytes: number, lastSyncedAt: number|null}} DeckSummary
 *
 * @typedef {import('./deckSheet').ParsedQuestion} ParsedQuestion
 */

const QUESTION_COLUMNS =
  'id, position, question, answer1, answer2, image_question_id, image_answer_id';

/**
 * Columna de cada hueco de imagen.
 *
 * El nombre de columna sale de ESTE mapa y nunca del parametro: es lo unico de una
 * consulta que no puede ir vinculado, asi que la unica forma de que no se cuele
 * nada es que los valores posibles esten enumerados aca.
 */
const IMAGE_SLOTS = {
  question: 'image_question_id',
  answer: 'image_answer_id',
};

/**
 * @param {Record<string, any>} row
 * @returns {Question}
 */
function toQuestion(row) {
  return {
    id: row.id,
    position: row.position,
    question: row.question,
    answer1: row.answer1,
    answer2: row.answer2 ?? null,
    imageQuestionId: row.image_question_id ?? null,
    imageAnswerId: row.image_answer_id ?? null,
  };
}

/**
 * El mazo de una fuente: SOLO lo promovido, SOLO de esa fuente, en el orden del
 * documento (REQ-003, REQ-029).
 *
 * `is_pending = 0` es lo que hace que una actualizacion en curso sea invisible: a
 * mitad de descarga, esto sigue devolviendo el mazo anterior entero (REQ-007).
 *
 * SIN IMAGENES (DD-003): se devuelven sus IDs, no su contenido. Un mazo de 40
 * preguntas ilustradas serian decenas de MB retenidos en el estado de React para
 * mostrar una tarjeta a la vez, y en base64 un 33 % mas.
 *
 * @param {number} sourceId
 * @returns {Question[]}
 */
export function listQuestions(sourceId) {
  const {rows} = getDb().executeSync(
    `SELECT ${QUESTION_COLUMNS}
       FROM questions
      WHERE source_id = ? AND is_pending = 0
      ORDER BY position ASC, id ASC`,
    [sourceId],
  );

  return rows.map(toQuestion);
}

/**
 * Cuantas preguntas y cuanto ocupa el mazo de cada fuente (REQ-014, REQ-073).
 *
 * Se calcula EN SQL y sin leer una sola imagen: para eso se guarda `stored_bytes`.
 * Traer las cadenas para medirlas seria cargar el mazo entero en memoria cada vez
 * que se repinta una fila, y ahora esas cadenas son un 33 % mayores que los bytes.
 *
 * `LENGTH(CAST(x AS BLOB))` y no `LENGTH(x)`: sobre TEXT, `LENGTH` cuenta
 * CARACTERES, y con acentos eso no son bytes. El casteo es dialecto comun de los
 * dos motores, que es la regla de no depender de extensiones.
 *
 * Aparecen TODAS las fuentes, tambien las que no tienen preguntas: la fila
 * necesita saber que tiene cero para no mostrar tamano alguno (REQ-014).
 *
 * @returns {Record<number, DeckSummary>}
 */
export function listDeckSummaries() {
  const {rows} = getDb().executeSync(
    `SELECT s.id             AS source_id,
            s.last_synced_at AS last_synced_at,
            (SELECT COUNT(*)
               FROM questions q
              WHERE q.source_id = s.id AND q.is_pending = 0) AS count,
            (SELECT COALESCE(SUM(i.stored_bytes), 0)
               FROM images i
              WHERE i.source_id = s.id AND i.is_pending = 0) AS image_bytes,
            (SELECT COALESCE(SUM(LENGTH(CAST(q.question AS BLOB))
                               + LENGTH(CAST(q.answer1 AS BLOB))
                               + LENGTH(CAST(COALESCE(q.answer2, '') AS BLOB))), 0)
               FROM questions q
              WHERE q.source_id = s.id AND q.is_pending = 0) AS text_bytes
       FROM sources s`,
  );

  /** @type {Record<number, DeckSummary>} */
  const summaries = {};

  rows.forEach(row => {
    summaries[row.source_id] = {
      count: row.count,
      bytes: row.image_bytes + row.text_bytes,
      lastSyncedAt: row.last_synced_at ?? null,
    };
  });

  return summaries;
}

/**
 * El data URI de una imagen, por ID: `data:image/jpeg;base64,...`.
 *
 * Va DIRECTO a `<Image source={{uri}}>` sin transformarlo, que es todo lo que este
 * formato compra. La usara la vista de tarjetas, que esta diferida (DD-003): es el
 * otro extremo de no meter imagenes en el estado del mazo. Se lee una cuando hay UNA
 * tarjeta que pintarla.
 *
 * @param {number} imageId
 * @returns {string|null}
 */
export function readImageUri(imageId) {
  const {rows} = getDb().executeSync(
    'SELECT data_uri FROM images WHERE id = ? LIMIT 1',
    [imageId],
  );

  return rows.length === 0 ? null : rows[0].data_uri;
}

/**
 * Inserta una pregunta PENDIENTE y devuelve su ID (REQ-041).
 *
 * Pendiente quiere decir invisible: no forma parte del mazo hasta que
 * `promoteDeck` la desmarca (DD-001).
 *
 * @param {number} sourceId
 * @param {ParsedQuestion} parsed
 * @returns {number}
 */
export function insertPendingQuestion(sourceId, parsed) {
  const db = getDb();

  db.executeSync(
    `INSERT INTO questions
       (source_id, position, question, answer1, answer2, is_pending)
     VALUES (?, ?, ?, ?, ?, 1)`,
    [sourceId, parsed.position, parsed.question, parsed.answer1, parsed.answer2 ?? null],
  );

  return lastInsertId(db);
}

/**
 * Inserta una imagen PENDIENTE y devuelve su ID.
 *
 * CONSERVA su firma a proposito —sigue recibiendo los bytes— y construye el data URI
 * POR DENTRO. Como se guarda una imagen es asunto de esta capa, y gracias a eso el
 * orquestador, la costura de red, los tres stores y toda la interfaz no se enteraron
 * del cambio de formato: ni un archivo suyo se toco.
 *
 * `stored_bytes` mide la CADENA, no los bytes: es lo que la base ocupa en disco y lo
 * que la fila muestra (REQ-014). Se guarda aunque se pueda calcular con
 * `length(data_uri)`, para poder sumar el tamano de un mazo sin leer la columna
 * grande.
 *
 * @param {number} sourceId
 * @param {{url: string, mime: string, bytes: Uint8Array}} image
 * @returns {number}
 */
export function insertPendingImage(sourceId, {url, mime, bytes}) {
  const db = getDb();
  const dataUri = toDataUri(mime, bytes);

  db.executeSync(
    `INSERT INTO images (source_id, url, mime, stored_bytes, data_uri, is_pending)
     VALUES (?, ?, ?, ?, ?, 1)`,
    [sourceId, url, mime, dataUri.length, dataUri],
  );

  return lastInsertId(db);
}

/**
 * Cuelga una imagen ya insertada de una pregunta ya insertada.
 *
 * Dos preguntas pueden colgar de la MISMA imagen: es lo que hace posible
 * descargar una vez una URL repetida (REQ-047, DD-015).
 *
 * @param {number} questionId
 * @param {'question'|'answer'} slot
 * @param {number} imageId
 */
export function attachImage(questionId, slot, imageId) {
  const column = IMAGE_SLOTS[slot];

  if (column == null) {
    // Error del programador, no situacion del usuario: se lanza en vez de
    // disfrazarse de estado.
    throw new Error(`Hueco de imagen desconocido: "${slot}"`);
  }

  getDb().executeSync(`UPDATE questions SET ${column} = ? WHERE id = ?`, [
    imageId,
    questionId,
  ]);
}

/**
 * EL CAMBIO ATOMICO (DD-001).
 *
 * En UNA transaccion: borra el mazo anterior de esa fuente, desmarca el nuevo y
 * escribe la fecha. Hasta la ultima sentencia, cualquier lectura sigue viendo el
 * mazo viejo completo; despues, el nuevo completo. Nunca una mezcla (REQ-007).
 *
 * @param {number} sourceId
 * @param {number} now Milisegundos epoch. Parametrizable para los tests.
 */
export function promoteDeck(sourceId, now) {
  const db = getDb();

  db.transactionSync(() => {
    // Las preguntas viejas PRIMERO y las imagenes viejas despues: al reves, el
    // ON DELETE SET NULL vaciaria los huecos de imagen de las preguntas viejas
    // antes de borrarlas. Da igual para el resultado, pero el orden que no
    // depende de un efecto colateral es el que se lee sin pensar.
    db.executeSync('DELETE FROM questions WHERE source_id = ? AND is_pending = 0', [
      sourceId,
    ]);
    db.executeSync('DELETE FROM images WHERE source_id = ? AND is_pending = 0', [
      sourceId,
    ]);

    db.executeSync('UPDATE questions SET is_pending = 0 WHERE source_id = ?', [sourceId]);
    db.executeSync('UPDATE images SET is_pending = 0 WHERE source_id = ?', [sourceId]);

    // La fecha se escribe DENTRO de la misma transaccion (REQ-012): una fecha
    // nueva con un mazo a medias seria mentir al usuario sobre lo que tiene.
    db.executeSync('UPDATE sources SET last_synced_at = ? WHERE id = ?', [now, sourceId]);
  });
}

/**
 * Tira lo pendiente de una fuente y deja su mazo como estaba.
 *
 * Es el otro extremo de DD-001: cancelar (REQ-054) y fallar (REQ-064) son lo
 * mismo desde el punto de vista de la base.
 *
 * @param {number} sourceId
 */
export function discardPending(sourceId) {
  const db = getDb();

  db.transactionSync(() => {
    db.executeSync('DELETE FROM questions WHERE source_id = ? AND is_pending = 1', [
      sourceId,
    ]);
    db.executeSync('DELETE FROM images WHERE source_id = ? AND is_pending = 1', [
      sourceId,
    ]);
  });
}

/**
 * Tira lo pendiente de TODAS las fuentes. Se llama al arrancar (DD-013).
 *
 * Es lo que hace que REQ-085 no necesite decidir si una actualizacion se pausa o
 * se reanuda al ir a segundo plano: si el sistema mata la app a mitad, lo
 * pendiente queda invisible en la base y desaparece en el siguiente arranque.
 */
export function sweepPendingDecks() {
  const db = getDb();

  db.transactionSync(() => {
    db.executeSync('DELETE FROM questions WHERE is_pending = 1');
    db.executeSync('DELETE FROM images WHERE is_pending = 1');
  });
}

/**
 * Borra el mazo ENTERO de una fuente, pendiente y promovido.
 *
 * La llama `updateSource` cuando la URL de exportacion cambia: cambiar la URL es
 * cambiar de hoja, y el mazo viejo ya no corresponde a esa fuente (REQ-008,
 * DD-014).
 *
 * NO abre transaccion propia: la llama alguien que ya esta dentro de una, y
 * anidar `BEGIN` en SQLite es un error. Quien la use fuera de una transaccion la
 * envuelve.
 *
 * @param {number} sourceId
 */
export function deleteDeck(sourceId) {
  const db = getDb();

  db.executeSync('DELETE FROM questions WHERE source_id = ?', [sourceId]);
  db.executeSync('DELETE FROM images WHERE source_id = ?', [sourceId]);
}

/**
 * @param {import('../db/database').Driver} db
 * @returns {number}
 */
function lastInsertId(db) {
  return db.executeSync('SELECT last_insert_rowid() AS id').rows[0].id;
}
