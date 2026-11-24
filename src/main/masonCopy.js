/**
 * Textos de la interfaz.
 *
 * Concentrados aca para que cambiar una redaccion no obligue a tocar un
 * componente, y para que se vean todos juntos al revisarlos.
 *
 * @format
 */

/** Titulo del header. */
export const VIEW_TITLE = 'Preguntas y Respuestas';

/**
 * Estado sin preguntas.
 *
 * ANTES nombraba `src/decks/source.js`, porque la fuente era una constante del
 * codigo y el unico que podia arreglarlo era un desarrollador con el repo
 * delante. Ahora la configura el usuario desde la pantalla Datos, asi que el
 * texto le habla a el y NO menciona ningun archivo (REQ-043 de data-sources).
 *
 * Y ofrece una accion, que REQ-011 de main-view prohibia. Aquella prohibicion
 * tenia un motivo concreto: "reintentar" no arreglaba nada porque lo que
 * faltaba era codigo. Aca la accion si resuelve el problema, y es lo primero
 * que tiene que hacer todo usuario nuevo. Ver data-sources design.md DD-011.
 */
export const EMPTY_STATE = {
  title: 'Aún no hay preguntas',
  body:
    'Para ver preguntas necesitas indicarle a Aprendo de dónde sacarlas: una ' +
    'hoja de cálculo de Google con tus preguntas y respuestas.',
  action: 'Añadir una fuente',
};

/** Entradas del menu que aun no llevan a ninguna parte. */
export const SOON_LABEL = 'pronto';

/**
 * Etiqueta para el lector de pantalla de una entrada no disponible.
 *
 * @param {string} label
 * @returns {string}
 */
export function soonAccessibilityLabel(label) {
  return `${label}, próximamente`;
}
