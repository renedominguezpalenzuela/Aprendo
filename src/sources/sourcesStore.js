/**
 * Estado de las fuentes, compartido entre el header y la pantalla Datos.
 *
 * Es un store externo con `subscribe`/`getSnapshot`, no un Context. Dos motivos
 * (design.md DD-005):
 *
 *   - `getSnapshot()` devuelve el estado YA inicializado en el primer render,
 *     sin efecto ni segundo pase. Eso es lo que hace posible que el header
 *     muestre el nombre de la fuente activa desde el primer frame (REQ-006).
 *   - React 19 trae `useSyncExternalStore` de serie, asi que no anade ninguna
 *     dependencia.
 *
 * Fuera de src/sources/ nadie importa este archivo: se consume por
 * `useSources()` y `useActiveSource()`.
 *
 * @format
 */

import {openDatabase} from '../db/database';
import {listSources, readActiveSource} from './sourcesRepo';

/**
 * @typedef {import('./sourcesRepo').Source} Source
 *
 * @typedef {{status: 'ready', sources: Source[], active: Source | null}
 *         | {status: 'error', error: Error}} SourcesState
 */

/**
 * Snapshot actual.
 *
 * DEBE ser estable por referencia mientras no cambie nada: `useSyncExternalStore`
 * compara por identidad, y devolver un objeto nuevo en cada llamada lo mete en
 * bucle de renders. Por eso el estado se guarda ya construido y no se calcula al
 * pedirlo. Es el error clasico con esta API.
 *
 * @type {SourcesState}
 */
let snapshot = {status: 'ready', sources: [], active: null};

/** @type {Set<() => void>} */
const listeners = new Set();

/** @type {boolean} */
let initialized = false;

/**
 * Abre la base y publica el primer snapshot.
 *
 * SINCRONA a proposito (DD-004): la llama el arranque antes del primer render,
 * mientras el splash sigue superpuesto, para que el header no muestre primero el
 * titulo por defecto y lo sustituya despues (REQ-006).
 *
 * Idempotente: la segunda llamada no hace nada.
 *
 * @param {() => import('../db/database').Driver} [makeDriver]
 */
export function initSources(makeDriver) {
  if (initialized) {
    return;
  }

  initialized = true;

  const opened = openDatabase(makeDriver);

  if (!opened.ok) {
    // Un fallo al abrir es REQ-005: se pinta como estado de la pantalla Datos,
    // y el header cae al titulo por defecto (REQ-041).
    snapshot = {status: 'error', error: opened.error};
    return;
  }

  refresh();
}

/**
 * Relee del repositorio y publica. La llaman las mutaciones de `useSources`.
 */
export function refresh() {
  try {
    snapshot = {
      status: 'ready',
      sources: listSources(),
      active: readActiveSource(),
    };
  } catch (error) {
    snapshot = {
      status: 'error',
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }

  listeners.forEach(listener => listener());
}

/**
 * Publica un fallo de la base como estado.
 *
 * Lo llaman las mutaciones cuando el repositorio propaga un error inesperado de
 * SQLite: la base dejo de estar sana a mitad de sesion (disco lleno al escribir,
 * archivo corrupto). Sin esto, la excepcion sale del manejador del boton que la
 * disparo y se convierte en una excepcion sin capturar (REQ-005).
 *
 * @param {unknown} error
 */
export function reportFailure(error) {
  snapshot = {
    status: 'error',
    error: error instanceof Error ? error : new Error(String(error)),
  };

  listeners.forEach(listener => listener());
}

/** @returns {SourcesState} */
export function getSnapshot() {
  return snapshot;
}

/**
 * @param {() => void} listener
 * @returns {() => void} baja de la suscripcion
 */
export function subscribe(listener) {
  listeners.add(listener);

  return () => listeners.delete(listener);
}

/** Solo para tests: devuelve el store al estado de recien cargado. */
export function resetSourcesForTests() {
  snapshot = {status: 'ready', sources: [], active: null};
  listeners.clear();
  initialized = false;
}
