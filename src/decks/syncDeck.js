/**
 * Actualizar el mazo de una fuente, de principio a fin.
 *
 * Es la unica funcion del proyecto con la secuencia entera escrita de arriba
 * abajo, y esta escrita para poder leerse asi: descargar, interpretar, y luego un
 * bucle de preguntas donde cada una guarda su texto, resuelve sus imagenes y
 * avanza el contador.
 *
 * NO LANZA NUNCA. Todo desemboca en un informe, incluidos los fallos de la base:
 * un `try/catch` envuelve la funcion ENTERA y su `finally` garantiza que lo
 * pendiente se tira si no se llego a promover (DD-012). Que el `catch` este en el
 * CAMINO de la excepcion y no al lado es la leccion literal de
 * docs/solutions/2026-08-16-donde-va-el-catch-de-un-error-de-base.md, donde el
 * `catch` existia... envolviendo la relectura en vez de la escritura.
 *
 * Ver specs/features/deck-sync/design.md seccion 2.8, DD-001, DD-006, DD-012 y
 * DD-015.
 *
 * @format
 */

import * as defaultNet from '../net/download';
import {parseCsv} from './csv';
import {resolveColumns, toQuestions} from './deckSheet';
import {
  attachImage,
  discardPending,
  insertPendingImage,
  insertPendingQuestion,
  promoteDeck,
} from './decksRepo';

/**
 * Los dos huecos de imagen de una pregunta, y de donde sale la URL de cada uno.
 *
 * En este orden: primero la del anverso, que es la que el usuario ve antes.
 */
const IMAGE_SLOTS = [
  {slot: 'question', field: 'imageQuestionUrl'},
  {slot: 'answer', field: 'imageAnswerUrl'},
];

/**
 * @typedef {import('../net/download').DownloadError} DownloadError
 * @typedef {'MISSING_COLUMN'|'EMPTY_SHEET'|'DATABASE_ERROR'} SyncOwnError
 * @typedef {DownloadError|SyncOwnError} SyncErrorReason
 *
 * @typedef {Object} SyncReport
 * @property {'done'|'cancelled'|'error'} outcome
 * @property {number} saved
 * @property {number} skippedImages
 * @property {number} failedImages
 * @property {Array<{row: number, reason: string}>} warnings
 * @property {SyncErrorReason} [reason]
 * @property {string} [missing]
 * @property {number} [status]
 */

/**
 * @param {import('../sources/sourcesRepo').Source} source
 * @param {Object} deps
 * @param {AbortSignal} [deps.signal] Cancelacion del usuario (REQ-054).
 * @param {(update: {phase: 'preparing'|'working', done: number, total: number|null}) => void} [deps.onProgress]
 * @param {typeof import('../net/download')} [deps.net] Costura de red (DD-004).
 * @param {() => number} [deps.now]
 * @returns {Promise<SyncReport>}
 */
export async function syncDeck(source, deps = {}) {
  const {signal, onProgress = () => {}, net = defaultNet, now = Date.now} = deps;

  const counters = {saved: 0, skippedImages: 0, failedImages: 0};
  /** @type {Array<{row: number, reason: string}>} */
  let warnings = [];
  let promoted = false;

  /** @param {Partial<SyncReport>} extra @returns {SyncReport} */
  const report = extra => ({...counters, warnings, ...extra});

  try {
    // Lo PRIMERO, por si una ejecucion anterior murio sin barrer: la app matada
    // por el sistema a mitad de descarga deja filas pendientes (DD-013).
    discardPending(source.id);

    // La ventana aparece ya, sin numeros: el total no se conoce hasta interpretar
    // el CSV, y un cero o un total inventado son justo lo que REQ-053 prohibe.
    onProgress({phase: 'preparing', done: 0, total: null});

    const downloaded = await net.downloadText(source.urlCsv, {signal});

    if (!downloaded.ok) {
      return report(fromDownloadError(downloaded));
    }

    const rows = parseCsv(downloaded.text);
    const resolved = resolveColumns(rows[0] ?? []);

    if (!resolved.ok) {
      // Se dice QUE columna falta (REQ-025). Y no se ha escrito nada.
      return report({
        outcome: 'error',
        reason: 'MISSING_COLUMN',
        missing: resolved.missing,
      });
    }

    const parsedSheet = toQuestions(rows, resolved.columns);
    warnings = parsedSheet.warnings;

    if (parsedSheet.questions.length === 0) {
      // Distinto de INVALID_CONTENT: el documento se entendio, simplemente no hay
      // preguntas. Y el mazo anterior se queda donde esta (REQ-062).
      return report({outcome: 'error', reason: 'EMPTY_SHEET'});
    }

    const total = parsedSheet.questions.length;

    onProgress({phase: 'working', done: 0, total});

    /**
     * Lo que ya se sabe de cada URL de imagen EN ESTA ejecucion (REQ-047, DD-015).
     *
     * Cachea tambien los fracasos: cinco preguntas con la misma URL rota serian, si
     * no, cinco esperas al plazo, dos minutos de contador congelado por una imagen
     * que ya se sabe que no viene.
     *
     * @type {Map<string, {imageId: number|null}>}
     */
    const seenImages = new Map();

    for (const parsed of parsedSheet.questions) {
      if (signal?.aborted) {
        return report({outcome: 'cancelled'});
      }

      const questionId = insertPendingQuestion(source.id, parsed);

      for (const {slot, field} of IMAGE_SLOTS) {
        const url = parsed[field];

        if (url == null) {
          continue;
        }

        const image = await resolveImage(url, {
          sourceId: source.id,
          net,
          signal,
          seenImages,
          counters,
        });

        if (image.aborted) {
          // Se comprueba DESPUES del await y antes de escribir: cancelar durante la
          // imagen de la pregunta 7 no puede dejar la pregunta 7 a medias.
          return report({outcome: 'cancelled'});
        }

        if (image.imageId != null) {
          attachImage(questionId, slot, image.imageId);
        }
      }

      // El contador avanza AQUI, con las imagenes de esta pregunta ya resueltas
      // (REQ-052): asi `N de N` solo aparece cuando de verdad ha terminado todo, y
      // no hace falta ninguna segunda fase.
      counters.saved += 1;
      onProgress({phase: 'working', done: counters.saved, total});
    }

    if (signal?.aborted) {
      return report({outcome: 'cancelled'});
    }

    // EL cambio atomico. Hasta esta linea, el mazo que se lee es el anterior.
    promoteDeck(source.id, now());
    promoted = true;

    return report({outcome: 'done'});
  } catch (error) {
    // Cualquier excepcion de la base acaba aca: disco lleno al escribir, archivo
    // corrupto. El detalle va al aviso de desarrollo; para el usuario, "no se pudo
    // guardar" es la informacion util (REQ-063).
    if (__DEV__) {
      console.warn('[deck-sync] la actualizacion fallo:', error);
    }

    return report({outcome: 'error', reason: 'DATABASE_ERROR'});
  } finally {
    if (!promoted) {
      // Cancelar y fallar son lo mismo desde el punto de vista de la base: lo
      // pendiente se tira y el mazo anterior sigue intacto (REQ-054, REQ-064).
      //
      // En su propio try: si la base esta rota, ESTO tambien falla, y una excepcion
      // aca sustituiria el informe que la funcion ya tenia listo por una excepcion
      // sin capturar. El `finally` no puede ser el que rompa la promesa.
      try {
        discardPending(source.id);
      } catch (cleanupError) {
        if (__DEV__) {
          console.warn('[deck-sync] no se pudo limpiar lo pendiente:', cleanupError);
        }
      }
    }
  }
}

/**
 * Descarga y guarda una imagen, o decide que esta pregunta se queda sin ella.
 *
 * Una imagen NUNCA aborta la actualizacion (REQ-044): lo unico que la aborta es la
 * cancelacion del usuario, que llega como `ABORTED` y se distingue del plazo
 * gracias a DD-006.
 *
 * @param {string} url
 * @param {Object} context
 * @param {number} context.sourceId
 * @param {typeof import('../net/download')} context.net
 * @param {AbortSignal|undefined} context.signal
 * @param {Map<string, {imageId: number|null}>} context.seenImages
 * @param {{skippedImages: number, failedImages: number}} context.counters
 * @returns {Promise<{imageId: number|null, aborted?: boolean}>}
 */
async function resolveImage(url, context) {
  const {sourceId, net, signal, seenImages, counters} = context;

  // Segunda aparicion de la misma URL: se reutiliza lo que se sepa, acierto o
  // fracaso, y no se vuelve a la red (REQ-047).
  const known = seenImages.get(url);

  if (known != null) {
    return known;
  }

  const downloaded = await net.downloadBytes(url, {signal});

  if (downloaded.ok) {
    const imageId = insertPendingImage(sourceId, {
      url,
      mime: downloaded.mime,
      bytes: downloaded.bytes,
    });
    const result = {imageId};

    seenImages.set(url, result);

    return result;
  }

  if (downloaded.reason === 'ABORTED') {
    // No se cachea: no se sabe nada de esta URL, solo que el usuario corto.
    return {imageId: null, aborted: true};
  }

  if (downloaded.reason === 'TOO_LARGE') {
    // Se cuenta UNA vez por URL, que es lo que el usuario entiende por "se omitio
    // 1 imagen" (REQ-043).
    counters.skippedImages += 1;
  } else {
    counters.failedImages += 1;
  }

  const failure = {imageId: null};

  seenImages.set(url, failure);

  return failure;
}

/**
 * Traduce el fallo de una descarga de CSV al informe correspondiente.
 *
 * `ABORTED` no es un error: es que el usuario pulso Cancelar, y el informe tiene
 * que decir `cancelled` para que la interfaz no le ensene un mensaje de fallo por
 * haber hecho lo que queria (DD-006).
 *
 * @param {{reason: DownloadError, status?: number}} downloaded
 * @returns {Partial<SyncReport>}
 */
function fromDownloadError(downloaded) {
  if (downloaded.reason === 'ABORTED') {
    return {outcome: 'cancelled'};
  }

  return {
    outcome: 'error',
    reason: downloaded.reason,
    ...(downloaded.status == null ? {} : {status: downloaded.status}),
  };
}
