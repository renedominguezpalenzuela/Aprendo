/**
 * Estado del mazo de la fuente activa, y el resumen de cada fuente.
 *
 * Store externo con `subscribe`/`getSnapshot`, como `sourcesStore` y por los
 * mismos motivos (data-sources DD-005): el snapshot esta YA construido en el
 * primer render, y `useSyncExternalStore` viene de serie en React 19.
 *
 * Se SUSCRIBE a `sourcesStore` en vez de duplicar su estado. Con eso, activar otra
 * fuente (REQ-072), editar una URL (REQ-008) y borrar una fuente (REQ-004) mueven
 * el mazo sin que nadie tenga que acordarse de avisar: las tres pasan por una
 * mutacion de fuentes, que ya publica.
 *
 * La direccion de la dependencia es decks -> sources, la misma que ya tenia
 * `useDeck` cuando leia la fuente activa.
 *
 * Ver specs/features/deck-sync/design.md seccion 2.11 y DD-003.
 *
 * @format
 */

import {
  getSnapshot as getSourcesSnapshot,
  subscribe as subscribeToSources,
} from '../sources/sourcesStore';
import {listDeckSummaries, listQuestions} from './decksRepo';

/**
 * @typedef {import('../sources/sourcesRepo').Source} Source
 * @typedef {import('./decksRepo').Question} Question
 * @typedef {import('./decksRepo').DeckSummary} DeckSummary
 *
 * Estado de la zona central. Union discriminada por `status`:
 *
 *   - 'unconfigured': no hay ninguna fuente activa (REQ-043 de data-sources).
 *   - 'empty': hay fuente activa pero todavia no tiene preguntas (REQ-071).
 *   - 'ready': hay mazo (REQ-070).
 *   - 'error': la base dejo de estar sana.
 *
 * @typedef {{status: 'unconfigured'}
 *         | {status: 'empty', source: Source}
 *         | {status: 'ready', source: Source, questions: Question[]}
 *         | {status: 'error', error: Error}} DeckState
 *
 * @typedef {{deck: DeckState, summaries: Record<number, DeckSummary>}} DeckStoreState
 */

/**
 * Instancias unicas de los estados sin datos: devolver un objeto nuevo en cada
 * recalculo invalidaria memoizaciones aguas abajo sin que nada haya cambiado.
 */
const UNCONFIGURED = {status: 'unconfigured'};
const NO_SUMMARIES = {};

/**
 * Snapshot actual. DEBE ser estable por referencia mientras nada cambie:
 * `useSyncExternalStore` compara por identidad y un objeto nuevo en cada llamada lo
 * mete en bucle de renders. Es el error clasico de esta API, ya documentado en
 * data-sources DD-005.
 *
 * @type {DeckStoreState}
 */
let snapshot = {deck: UNCONFIGURED, summaries: NO_SUMMARIES};

/** @type {Set<() => void>} */
const listeners = new Set();

/** @type {(() => void) | null} */
let unsubscribeFromSources = null;

/**
 * Empieza a seguir a las fuentes y publica el primer mazo.
 *
 * La llama el arranque, DESPUES de `initSources()`: necesita la base abierta y la
 * fuente activa ya leida.
 *
 * Idempotente: la segunda llamada no vuelve a suscribirse.
 */
export function initDecks() {
  if (unsubscribeFromSources == null) {
    unsubscribeFromSources = subscribeToSources(refreshDeck);
  }

  refreshDeck();
}

/**
 * Relee el mazo y los resumenes, y publica.
 *
 * La llaman: la suscripcion a fuentes (activar, editar, borrar) y el final de una
 * actualizacion con exito.
 */
export function refreshDeck() {
  const next = readState();

  snapshot = next;
  listeners.forEach(listener => listener());
}

/** @returns {DeckStoreState} */
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
export function resetDecksForTests() {
  unsubscribeFromSources?.();
  unsubscribeFromSources = null;
  snapshot = {deck: UNCONFIGURED, summaries: NO_SUMMARIES};
  listeners.clear();
}

/**
 * Construye el estado leyendo la base.
 *
 * NO LANZA: un fallo de lectura se publica como `'error'`, igual que en
 * `sourcesStore`, para que la zona central pueda pintar un aviso en vez de que la
 * excepcion salga por donde nadie la espera (REQ-063).
 *
 * @returns {DeckStoreState}
 */
function readState() {
  const sources = getSourcesSnapshot();

  if (sources.status === 'error') {
    // Sin base no hay mazo ni resumenes que leer. Se arrastra su error en vez de
    // inventar uno.
    return {deck: {status: 'error', error: sources.error}, summaries: NO_SUMMARIES};
  }

  try {
    const summaries = listDeckSummaries();
    const active = sources.active;

    if (active == null) {
      return {deck: UNCONFIGURED, summaries};
    }

    const count = summaries[active.id]?.count ?? 0;

    if (count === 0) {
      // Distinto de 'unconfigured': aca hay hoja registrada y falta descargarla, y
      // el texto que lo dice es otro (REQ-071).
      return {deck: {status: 'empty', source: active}, summaries};
    }

    // Solo las preguntas de la ACTIVA (REQ-003), en el orden del documento
    // (REQ-029), y SIN los bytes de las imagenes (DD-003).
    return {
      deck: {status: 'ready', source: active, questions: listQuestions(active.id)},
      summaries,
    };
  } catch (error) {
    return {
      deck: {
        status: 'error',
        error: error instanceof Error ? error : new Error(String(error)),
      },
      summaries: NO_SUMMARIES,
    };
  }
}
