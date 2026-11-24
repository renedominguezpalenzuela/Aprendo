/**
 * Lo que consumen la pantalla Datos y el header.
 *
 * Ver specs/features/data-sources/design.md seccion 2.6 y DD-009.
 *
 * @format
 */

import {useCallback, useSyncExternalStore} from 'react';

import {
  activateSource,
  addSource,
  removeSource,
  updateSource,
} from './sourcesRepo';
import {getSnapshot, refresh, reportFailure, subscribe} from './sourcesStore';

/**
 * @typedef {import('./sourcesRepo').Source} Source
 * @typedef {import('./sourcesStore').SourcesState} SourcesState
 */

/**
 * Estado completo de las fuentes, con las mutaciones.
 *
 * @typedef {Object} SourcesController
 * @property {SourcesState} state
 * @property {(input: {name: string, url: string}) => {ok: boolean, reason?: string}} add
 * @property {(id: number, input: {name: string, url: string}) => {ok: boolean, reason?: string}} update
 * @property {(id: number) => void} remove
 * @property {(id: number) => void} activate
 *
 * @returns {SourcesController}
 */
export function useSources() {
  const state = useSyncExternalStore(subscribe, getSnapshot);

  /**
   * NO hay cerrojo de mutacion, y eso es deliberado.
   *
   * El diseno preveia uno (DD-009), copiando la solucion que REQ-022 de
   * main-view uso para la navegacion entre tarjetas. Alli hacia falta porque la
   * transicion era ASINCRONA y duraba varios frames. Aca no: la mutacion abre
   * una transaccion de SQLite, escribe y refresca, todo sincrono, antes de
   * devolver. Un cerrojo puesto y soltado dentro de la misma llamada no puede
   * bloquear a nadie: la segunda pulsacion siempre lo encuentra libre.
   *
   * Lo que si protege de la doble pulsacion (REQ-023b):
   *
   *   - cada mutacion es ATOMICA, asi que dos no pueden entrelazarse;
   *   - el indice unico rechaza el alta repetida (DD-007);
   *   - borrar o activar una fila que ya no existe es una operacion nula.
   *
   * Ver design.md DD-009.
   */
  const run = useCallback(operation => {
    try {
      const result = operation();
      refresh();

      return result ?? {ok: true};
    } catch (error) {
      // El repositorio propaga a proposito los errores INESPERADOS de SQLite:
      // significan que la base dejo de estar sana (disco lleno al escribir,
      // archivo corrupto). Sin este catch, la excepcion sale del manejador del
      // boton que la disparo y queda sin capturar. REQ-005 exige que eso se vea
      // como un estado de la pantalla, no que tumbe la app.
      reportFailure(error);

      return {ok: false, reason: 'DATABASE_ERROR'};
    }
  }, []);

  const add = useCallback(input => run(() => addSource(input)), [run]);

  const update = useCallback(
    (id, input) => run(() => updateSource(id, input)),
    [run],
  );

  const remove = useCallback(id => run(() => removeSource(id)), [run]);

  const activate = useCallback(id => run(() => activateSource(id)), [run]);

  return {state, add, update, remove, activate};
}

/**
 * Solo la fuente activa. La usa el header.
 *
 * Se suscribe al mismo store, pero devuelve la fuente y no el estado entero, asi
 * que quien lo consume no se repinta por cambios en el resto de la lista.
 *
 * @returns {Source | null}
 */
export function useActiveSource() {
  return useSyncExternalStore(subscribe, getActive);
}

/**
 * Fuera del hook para que sea la misma referencia de funcion en cada render.
 *
 * Devuelve `state.active`, que es una referencia guardada dentro del snapshot y
 * por tanto estable mientras el snapshot no cambie. Construir el objeto aca
 * meteria a `useSyncExternalStore` en bucle.
 *
 * @returns {Source | null}
 */
function getActive() {
  const state = getSnapshot();

  return state.status === 'ready' ? state.active : null;
}
