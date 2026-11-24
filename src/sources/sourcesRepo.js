/**
 * Lecturas y escrituras de la tabla `sources`.
 *
 * Unica capa que escribe SQL. Fuera de aca nadie ve enteros haciendo de
 * booleanos ni nombres de columna.
 *
 * Los errores ESPERADOS (nombre duplicado, fila que ya no existe) son valores de
 * retorno, no excepciones: son cosas que el usuario provoca y que la interfaz
 * tiene que saber pintar. Un error de SQLite inesperado si se propaga, porque
 * significa que la base dejo de estar sana y eso es REQ-005.
 *
 * Ver specs/features/data-sources/design.md seccion 2.4, 2.11, DD-006 y DD-007.
 *
 * @format
 */

import {getDb} from '../db/database';
import {deleteDeck} from '../decks/decksRepo';
import {nameKey, toCsvUrl} from './sourceUrl';

/**
 * @typedef {Object} Source
 * @property {number}  id
 * @property {string}  name
 * @property {string}  urlOriginal
 * @property {string}  urlCsv
 * @property {boolean} isActive
 * @property {number}  createdAt
 * @property {number|null} lastSyncedAt
 *   Milisegundos epoch de la ultima actualizacion con exito, o `null` si nunca se
 *   ha actualizado (deck-sync REQ-011). NULL y 0 NO son lo mismo.
 */

/** @typedef {{name: string, url: string}} SourceInput */

const COLUMNS =
  'id, name, url_original, url_csv, is_active, created_at, last_synced_at';

/**
 * Detecta el rechazo del indice unico de `name_key`.
 *
 * Se mira el mensaje porque ni op-sqlite ni node:sqlite exponen el codigo
 * extendido de SQLite de forma comun. Se acota al indice concreto para no
 * tragarse el rechazo del indice de la activa, que seria un fallo de verdad.
 *
 * @param {unknown} error
 * @returns {boolean}
 */
function isDuplicateName(error) {
  const message = String(error?.message ?? error);

  return /UNIQUE/i.test(message) && /name_key/i.test(message);
}

/**
 * @param {Record<string, any>} row
 * @returns {Source}
 */
function toSource(row) {
  return {
    id: row.id,
    name: row.name,
    urlOriginal: row.url_original,
    urlCsv: row.url_csv,
    // La conversion 0/1 -> boolean vive SOLO aca.
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    lastSyncedAt: row.last_synced_at ?? null,
  };
}

/**
 * Todas las fuentes: la activa primero, el resto por orden de registro.
 *
 * El orden va en la CONSULTA y no en la vista (DD-006): es una propiedad de los
 * datos, y ordenar en JS obligaria a repetirlo en cada consumidor futuro.
 *
 * @returns {Source[]}
 */
export function listSources() {
  const {rows} = getDb().executeSync(
    `SELECT ${COLUMNS} FROM sources ORDER BY is_active DESC, created_at ASC, id ASC`,
  );

  return rows.map(toSource);
}

/**
 * Solo la fuente activa. La usa el header, que no necesita la lista entera.
 *
 * @returns {Source | null}
 */
export function readActiveSource() {
  const {rows} = getDb().executeSync(
    `SELECT ${COLUMNS} FROM sources WHERE is_active = 1 LIMIT 1`,
  );

  return rows.length === 0 ? null : toSource(rows[0]);
}

/**
 * Anade una fuente.
 *
 * La PRIMERA fuente se inserta ya activa, en la misma transaccion (REQ-017). Va
 * aca y no en la interfaz: si viviera alli, un alta desde cualquier otro sitio
 * dejaria la base sin activa.
 *
 * @param {SourceInput} input   Nombre y URL ya validados por la capa de interfaz.
 * @param {number} [now]        Marca de tiempo; parametrizable para los tests.
 * @returns {{ok: true, id: number} | {ok: false, reason: 'DUPLICATE_NAME'}}
 */
export function addSource(input, now = Date.now()) {
  const db = getDb();

  try {
    let id = 0;

    db.transactionSync(() => {
      const {rows} = db.executeSync('SELECT COUNT(*) AS n FROM sources');
      const isFirst = rows[0].n === 0;

      db.executeSync(
        `INSERT INTO sources (name, name_key, url_original, url_csv, is_active, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          input.name,
          nameKey(input.name),
          input.url,
          toCsvUrl(input.url),
          isFirst ? 1 : 0,
          now,
        ],
      );

      id = db.executeSync('SELECT last_insert_rowid() AS id').rows[0].id;
    });

    return {ok: true, id};
  } catch (error) {
    if (isDuplicateName(error)) {
      return {ok: false, reason: 'DUPLICATE_NAME'};
    }

    throw error;
  }
}

/**
 * Cambia nombre y URL de una fuente.
 *
 * NO toca `is_active`, asi que editar la activa la deja activa sin hacer nada
 * (REQ-033). Y recalcula SIEMPRE `url_csv`, aunque la URL no haya cambiado
 * (REQ-032): recalcular es mas barato que comparar y equivocarse.
 *
 * SI LA HOJA CAMBIA, EL MAZO SE VA (deck-sync REQ-008). Lo que se compara es la
 * `url_csv` —la hoja de la que se descargo el mazo— y no la `url_original`:
 *
 *   - cambiar solo el nombre conserva las preguntas;
 *   - cambiar el `gid` a otra pestana las borra, aunque para el usuario "la URL"
 *     parezca la misma direccion;
 *   - anadir un `?usp=sharing` de mas NO las borra, porque sigue siendo la misma
 *     hoja y castigar una diferencia cosmetica seria hacerle repetir la descarga
 *     por nada.
 *
 * Va DENTRO de la misma transaccion que la edicion: si el borrado falla, la
 * edicion no se aplica, y no queda una fuente apuntando a una hoja con el mazo de
 * otra. Ver deck-sync design.md DD-014.
 *
 * @param {number} id
 * @param {SourceInput} input
 * @returns {{ok: true} | {ok: false, reason: 'DUPLICATE_NAME' | 'NOT_FOUND'}}
 */
export function updateSource(id, input) {
  const db = getDb();

  try {
    let found = false;

    // Se comprueba la existencia y se escribe dentro de la MISMA transaccion, en
    // vez de con `UPDATE ... RETURNING`: `RETURNING` existe en ambos motores,
    // pero que sus filas lleguen a traves de `executeSync` depende de cada
    // envoltorio, y esa es justo la clase de divergencia contra la que avisa
    // DD-014. Aca no hay nada especifico del motor.
    db.transactionSync(() => {
      const exists = db.executeSync('SELECT id, url_csv FROM sources WHERE id = ?', [
        id,
      ]).rows;

      if (exists.length === 0) {
        return;
      }

      found = true;

      const nextCsvUrl = toCsvUrl(input.url);
      const changedSheet = exists[0].url_csv !== nextCsvUrl;

      db.executeSync(
        `UPDATE sources
            SET name = ?, name_key = ?, url_original = ?, url_csv = ?
          WHERE id = ?`,
        [input.name, nameKey(input.name), input.url, nextCsvUrl, id],
      );

      if (changedSheet) {
        // Cambiar la URL es cambiar de hoja: el mazo viejo ya no corresponde a esta
        // fuente, y la fecha tiene que volver a decir que nunca se actualizo
        // (REQ-008).
        deleteDeck(id);
        db.executeSync('UPDATE sources SET last_synced_at = NULL WHERE id = ?', [id]);
      }
    });

    // El indice unico solo se queja de OTRAS filas, asi que dejar el nombre
    // propio sin cambios no se rechaza como duplicado (REQ-031).
    return found ? {ok: true} : {ok: false, reason: 'NOT_FOUND'};
  } catch (error) {
    if (isDuplicateName(error)) {
      return {ok: false, reason: 'DUPLICATE_NAME'};
    }

    throw error;
  }
}

/**
 * Borra una fuente y reasigna la activa si hacia falta (REQ-035).
 *
 * Si se borraba la activa y quedan otras, pasa a activa la mas antigua. Si no
 * queda ninguna, la app se queda sin fuente activa, que es un estado valido.
 *
 * @param {number} id
 */
export function removeSource(id) {
  const db = getDb();

  db.transactionSync(() => {
    db.executeSync('DELETE FROM sources WHERE id = ?', [id]);

    const {rows} = db.executeSync(
      'SELECT COUNT(*) AS n FROM sources WHERE is_active = 1',
    );

    if (rows[0].n > 0) {
      return;
    }

    const next = db.executeSync(
      'SELECT id FROM sources ORDER BY created_at ASC, id ASC LIMIT 1',
    ).rows;

    if (next.length > 0) {
      db.executeSync('UPDATE sources SET is_active = 1 WHERE id = ?', [next[0].id]);
    }
  });
}

/**
 * Hace activa una fuente y desactiva la anterior (REQ-023).
 *
 * DESACTIVA ANTES DE ACTIVAR, y no al reves: SQLite comprueba la unicidad por
 * sentencia, asi que activar primero violaria el indice parcial de `is_active`.
 *
 * @param {number} id
 * @returns {{ok: true} | {ok: false, reason: 'NOT_FOUND'}}
 */
export function activateSource(id) {
  const db = getDb();
  let found = false;

  db.transactionSync(() => {
    const exists = db.executeSync('SELECT id FROM sources WHERE id = ?', [id]).rows;

    if (exists.length === 0) {
      return;
    }

    found = true;
    db.executeSync('UPDATE sources SET is_active = 0 WHERE is_active = 1');
    db.executeSync('UPDATE sources SET is_active = 1 WHERE id = ?', [id]);
  });

  return found ? {ok: true} : {ok: false, reason: 'NOT_FOUND'};
}
