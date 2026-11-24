/**
 * Lo que consumen la fila de `Datos` y la ventana de progreso.
 *
 * El estado y el cerrojo viven en el MODULO `deckSyncStore`, no aca (DD-007): este
 * hook solo se suscribe y expone acciones. Es lo que permite que la ventana de
 * progreso —montada en el chasis— y la fila que lanzo la actualizacion —montada
 * dentro de una lista— hablen de la misma operacion.
 *
 * Ver specs/features/deck-sync/design.md seccion 2.10.
 *
 * @format
 */

import {useCallback, useSyncExternalStore} from 'react';

import {
  cancelSync,
  dismiss as dismissResult,
  getSnapshot,
  isSyncing,
  startSync,
  subscribe,
} from './deckSyncStore';

/**
 * @typedef {import('./deckSyncStore').SyncState} SyncState
 *
 * @typedef {Object} DeckSyncController
 * @property {SyncState} state
 * @property {(source: import('../sources/sourcesRepo').Source) => void} start
 * @property {() => void} cancel
 * @property {() => void} dismiss
 */

/**
 * @returns {DeckSyncController}
 */
export function useDeckSync() {
  const state = useSyncExternalStore(subscribe, getSnapshot);

  const start = useCallback(source => {
    // Deliberadamente SIN esperar la promesa: quien llama es el `onPress` de un
    // boton, y una actualizacion dura decenas de segundos. `startSync` no lanza, y
    // si hay otra en curso devuelve `{ok: false}` sin efecto (REQ-013).
    startSync(source);
  }, []);

  const cancel = useCallback(() => cancelSync(), []);

  const dismiss = useCallback(() => dismissResult(), []);

  return {state, start, cancel, dismiss};
}

/**
 * Solo si hay una actualizacion corriendo.
 *
 * Para quien no necesita repintarse con cada avance del contador: el atras de
 * Android (REQ-057) y la atenuacion de los botones de las demas filas (REQ-013).
 *
 * @returns {boolean}
 */
export function useIsSyncing() {
  return useSyncExternalStore(subscribe, isSyncing);
}
