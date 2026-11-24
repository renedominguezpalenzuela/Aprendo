/**
 * Estado del mazo de preguntas.
 *
 * Nacio como la costura por la que entrarian los datos, leyendo una constante
 * `DECK_URL`; luego paso a leer la fuente activa y a decir que la descarga todavia
 * no existia. Esta feature cobra esa promesa: ahora devuelve el mazo REAL, leido de
 * la base local (REQ-070).
 *
 * Lo que sigue SIN hacer, y a proposito: descargar. Nada de aca dispara una
 * peticion, ni al montar ni al cambiar de fuente. La descarga la pide el usuario
 * con `Actualizar` y va por `useDeckSync` (REQ-080).
 *
 * Ver specs/features/deck-sync/design.md seccion 2.11 y DD-003.
 *
 * @format
 */

import {useSyncExternalStore} from 'react';

import {getSnapshot, subscribe} from './deckStore';

/**
 * @typedef {import('./deckStore').DeckState} DeckState
 * @typedef {import('./decksRepo').DeckSummary} DeckSummary
 */

/**
 * El mazo de la fuente activa.
 *
 * Las preguntas traen los IDs de sus imagenes, NO sus bytes (DD-003): un mazo de
 * 40 preguntas ilustradas serian decenas de MB retenidos en el estado de React para
 * mostrar una tarjeta a la vez. La imagen se lee con `readImageUri(id)` cuando
 * haya una tarjeta que pintarlos, que es la vista diferida de `main-view`.
 *
 * @returns {DeckState}
 */
export function useDeck() {
  return useSyncExternalStore(subscribe, getDeck);
}

/**
 * Cuantas preguntas tiene una fuente, cuanto ocupan y cuando se actualizo.
 *
 * Lo consume cada fila de `Datos` (REQ-011, REQ-014). Devuelve `null` si la fuente
 * no tiene resumen todavia, que la fila traduce a "no se muestra tamano alguno".
 *
 * @param {number} sourceId
 * @returns {DeckSummary|null}
 */
export function useDeckSummary(sourceId) {
  const summaries = useSyncExternalStore(subscribe, getSummaries);

  return summaries[sourceId] ?? null;
}

/**
 * Los resumenes de TODAS las fuentes, indexados por su id.
 *
 * Lo consume `DataScreen`, que ya se repinta con la lista y reparte a cada fila lo
 * suyo: la fila es presentacional y recibe su resumen por props, como el resto de
 * lo que pinta (data-sources design.md seccion 2.10).
 *
 * @returns {Record<number, DeckSummary>}
 */
export function useDeckSummaries() {
  return useSyncExternalStore(subscribe, getSummaries);
}

/**
 * Fuera del hook para que sea la MISMA referencia de funcion en cada render, y
 * devolviendo una referencia guardada dentro del snapshot: construir el objeto aca
 * meteria a `useSyncExternalStore` en bucle.
 *
 * @returns {DeckState}
 */
function getDeck() {
  return getSnapshot().deck;
}

/** @returns {Record<number, DeckSummary>} */
function getSummaries() {
  return getSnapshot().summaries;
}
