/**
 * Estado de la actualizacion en curso, y el cerrojo que impide dos a la vez.
 *
 * Es un store de MODULO, no un `useRef` de componente, y esa eleccion ES el
 * requisito: REQ-013 prohibe lanzar otra actualizacion «incluida la de otra fuente
 * distinta», y con el cerrojo dentro de un hook cada fila montada tendria el suyo.
 * Aca hay uno solo para toda la app.
 *
 * SOBRE EL CERROJO, y por que aca si: `data-sources` DD-009 QUITO un cerrojo por
 * inutil, y docs/solutions/2026-08-16-el-cerrojo-que-no-protegia-nada.md explica
 * por que. La leccion de aquello no es «los cerrojos no sirven», es «comprobar la
 * premisa, no el parecido». Alli la premisa era falsa: la mutacion era una
 * transaccion sincrona que terminaba antes de devolver, asi que la segunda
 * pulsacion siempre lo encontraba libre. Aca es verdadera y con margen: una
 * actualizacion dura decenas de segundos y hace `await` en cada imagen. Entre
 * `startSync` y su final caben todas las pulsaciones que el usuario quiera dar.
 *
 * Ver specs/features/deck-sync/design.md seccion 2.9 y DD-007.
 *
 * @format
 */

import {refresh as refreshSources} from '../sources/sourcesStore';
import {refreshDeck} from './deckStore';
import {syncDeck} from './syncDeck';

/**
 * @typedef {import('../sources/sourcesRepo').Source} Source
 * @typedef {import('./syncDeck').SyncReport} SyncReport
 *
 * @typedef {{phase: 'idle'}
 *         | {phase: 'preparing', sourceId: number, sourceName: string}
 *         | {phase: 'working', sourceId: number, sourceName: string,
 *            done: number, total: number}
 *         | {phase: 'result', sourceId: number, sourceName: string, saved: number,
 *            skippedImages: number, failedImages: number,
 *            warnings: Array<{row: number, reason: string}>}
 *         | {phase: 'error', sourceId: number, sourceName: string,
 *            reason: string, missing?: string, status?: number}} SyncState
 */

/** Instancia unica: el reposo no cambia, asi que su objeto tampoco. */
const IDLE = {phase: 'idle'};

/**
 * @type {SyncState}
 *
 * DEBE ser estable por referencia mientras nada cambie (data-sources DD-005).
 */
let snapshot = IDLE;

/** @type {Set<() => void>} */
const listeners = new Set();

/**
 * El controlador de la actualizacion en curso. `null` cuando no hay ninguna.
 *
 * @type {AbortController|null}
 */
let controller = null;

/** @returns {SyncState} */
export function getSnapshot() {
  return snapshot;
}

/**
 * @param {() => void} listener
 * @returns {() => void}
 */
export function subscribe(listener) {
  listeners.add(listener);

  return () => listeners.delete(listener);
}

/**
 * Hay una actualizacion corriendo ahora mismo.
 *
 * Lo consultan el cerrojo de REQ-013 y el atras de Android de REQ-057. `'result'` y
 * `'error'` NO cuentan: son el desenlace, la descarga ya termino.
 *
 * @returns {boolean}
 */
export function isSyncing() {
  return snapshot.phase === 'preparing' || snapshot.phase === 'working';
}

/**
 * Lanza la actualizacion de una fuente.
 *
 * NO LANZA y no hay que esperarla: quien la llama es el `onPress` de una fila.
 *
 * @param {Source} source
 * @param {Object} [deps] Costuras para los tests (red, reloj).
 * @returns {Promise<{ok: boolean, report?: SyncReport}>}
 */
export async function startSync(source, deps = {}) {
  // EL CERROJO. Sin `await` por delante a proposito: entre esta comprobacion y la
  // publicacion no cede el hilo, asi que dos pulsaciones no pueden colarse las dos.
  if (isSyncing()) {
    return {ok: false};
  }

  controller = new AbortController();

  publish({
    phase: 'preparing',
    sourceId: source.id,
    sourceName: source.name,
  });

  const report = await syncDeck(source, {
    ...deps,
    signal: controller.signal,
    onProgress: update => publishProgress(source, update),
  });

  controller = null;

  if (report.outcome === 'done') {
    // El orden importa: primero la base publica sus datos nuevos y luego se anuncia
    // el desenlace. Al reves, la fila mostraria "20 preguntas guardadas" mientras
    // sigue diciendo que nunca se actualizo (REQ-012).
    refreshSources();
    refreshDeck();
  }

  publishReport(source, report);

  return {ok: true, report};
}

/**
 * Interrumpe la actualizacion en curso (REQ-054).
 *
 * Solo aborta: quien decide que el mazo anterior sigue intacto es `syncDeck`, y lo
 * hace en su `finally`.
 */
export function cancelSync() {
  controller?.abort();
}

/** Cierra el aviso de desenlace y vuelve al reposo. */
export function dismiss() {
  if (snapshot.phase !== 'idle') {
    publish(IDLE);
  }
}

/** Solo para tests. */
export function resetDeckSyncForTests() {
  controller?.abort();
  controller = null;
  snapshot = IDLE;
  listeners.clear();
}

/**
 * @param {Source} source
 * @param {{phase: 'preparing'|'working', done: number, total: number|null}} update
 */
function publishProgress(source, update) {
  // Mientras el total no se conoce se sigue en 'preparing': la ventana muestra el
  // indicador SIN numeros, y no un cero ni un total inventado (REQ-053).
  if (update.total == null) {
    if (snapshot.phase !== 'preparing') {
      publish({phase: 'preparing', sourceId: source.id, sourceName: source.name});
    }

    return;
  }

  publish({
    phase: 'working',
    sourceId: source.id,
    sourceName: source.name,
    done: update.done,
    total: update.total,
  });
}

/**
 * @param {Source} source
 * @param {SyncReport} report
 */
function publishReport(source, report) {
  if (report.outcome === 'cancelled') {
    // No se dice nada: el usuario pulso Cancelar y ya sabe lo que hizo. Ensenarle un
     // mensaje seria reprocharle haber hecho lo que queria.
    publish(IDLE);
    return;
  }

  if (report.outcome === 'error') {
    publish({
      phase: 'error',
      sourceId: source.id,
      sourceName: source.name,
      reason: report.reason,
      ...(report.missing == null ? {} : {missing: report.missing}),
      ...(report.status == null ? {} : {status: report.status}),
    });
    return;
  }

  publish({
    phase: 'result',
    sourceId: source.id,
    sourceName: source.name,
    saved: report.saved,
    skippedImages: report.skippedImages,
    failedImages: report.failedImages,
    warnings: report.warnings,
  });
}

/** @param {SyncState} next */
function publish(next) {
  snapshot = next;
  listeners.forEach(listener => listener());
}
