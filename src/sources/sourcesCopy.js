/**
 * Textos de la pantalla Datos.
 *
 * Concentrados aca por lo mismo que masonCopy.js: cambiar una redaccion no debe
 * obligar a tocar un componente, y verlos todos juntos es la unica forma de
 * revisar que hablan igual.
 *
 * NINGUN texto de este archivo nombra un archivo del codigo. Los lee el usuario
 * final, no el desarrollador.
 *
 * Ver specs/features/data-sources/design.md seccion 2.9.
 *
 * @format
 */

/** Titulo de la vista en el header (design.md DD-003). */
export const DATA_VIEW_TITLE = 'Datos';

/** Etiquetas de los campos y del formulario. */
export const FORM = {
  nameLabel: 'Nombre',
  namePlaceholder: 'Aprendiz',
  urlLabel: 'Dirección de la hoja',
  urlPlaceholder: 'https://docs.google.com/spreadsheets/...',
  // Despliega el formulario de alta (DELTA-001, DELTA-002). No guarda nada.
  open: 'Añadir',
  openHint: 'Despliega el formulario para añadir una fuente',
  // La accion que guarda, en alta y en edicion: `Añadir` ya es el boton que
  // despliega, y dos palabras para lo mismo confundian.
  submit: 'Guardar',
  cancel: 'Cancelar',
};

/** Botones de la fila. Literales de REQ-021. */
export const ROW = {
  active: 'Test Activo',
  activate: 'Activar Test',
  edit: 'Editar',
  remove: 'Borrar',
  // Lo que dice la fila del mazo de ejemplo en lugar de la URL, que no tiene
  // (EJEMPLO-003).
  exampleLabel: 'Ejemplo incluido en la app',
};

/**
 * Ejemplo de URL correcta.
 *
 * REQ-013 exige mostrarlo al rechazar por formato: sin un ejemplo, "no es una
 * hoja de calculo de Google" no le dice al usuario que tiene que hacer.
 */
export const URL_EXAMPLE =
  'https://docs.google.com/spreadsheets/d/1AbC.../edit?gid=0#gid=0';

/**
 * Mensajes de error del nombre, por motivo de `validateName`.
 *
 * @type {Record<string, string>}
 */
export const NAME_ERROR = {
  EMPTY: 'Ponle un nombre: es como identificarás este test dentro de la app.',
  TOO_LONG: 'El nombre es demasiado largo. Prueba con uno más corto.',
  DUPLICATE_NAME: 'Ya tienes un test con ese nombre. Elige otro.',
};

/**
 * Fallos que el formulario NO puede anticipar validando, porque dependen del
 * estado de la base en el momento de guardar.
 *
 * Existe un texto para cada uno a proposito: un fallo sin mensaje deja al
 * usuario pulsando un boton que no hace nada, que es peor que un error.
 *
 * @type {Record<string, string>}
 */
export const SUBMIT_ERROR = {
  NOT_FOUND: 'Esa fuente ya no existe. Puede que la hayas borrado.',
  DATABASE_ERROR: 'No se pudo guardar: falló el almacenamiento del dispositivo.',
};

/** Ultimo recurso, si llega un motivo que nadie previo. */
export const SUBMIT_ERROR_FALLBACK = 'No se pudo guardar. Inténtalo de nuevo.';

/**
 * Mensajes de error de la URL, por motivo de `validateSheetUrl`.
 *
 * Cada motivo tiene el suyo a proposito: un mensaje generico obligaria al
 * usuario a adivinar cual de las cuatro cosas hizo mal.
 *
 * @type {Record<string, string>}
 */
export const URL_ERROR = {
  EMPTY: 'Pega aquí la dirección de tu hoja de cálculo de Google.',
  TOO_LONG: 'Esa dirección es demasiado larga para ser un enlace de Google Sheets.',
  NOT_HTTPS: 'La dirección tiene que empezar por https://',
  NOT_A_SHEET: `Eso no parece una hoja de cálculo de Google. Tiene que ser así:\n${URL_EXAMPLE}`,
  // REQ-013c: el fallo no es la URL, es de donde la copio.
  PUBLISHED_URL:
    'Ese es el enlace de «Publicar en la web», y no sirve para leer las ' +
    'preguntas. Abre la hoja, pulsa «Compartir» y copia el enlace de ahí.',
};

/** Estado de lista vacia (REQ-024). */
export const EMPTY_LIST = {
  title: 'Todavía no has añadido ninguna fuente',
  body:
    'Añade arriba la dirección de tu hoja de cálculo de Google y aparecerá ' +
    'aquí. Puedes tener varias y elegir cuál está activa.',
};

/**
 * Estado de error de la base local (REQ-005).
 *
 * No ofrece reintentar: si la base no abre, volver a intentarlo en el acto da
 * el mismo resultado. Se dice lo unico que puede ayudar.
 */
export const DATABASE_ERROR = {
  title: 'No se pudo abrir el almacenamiento',
  body:
    'Aprendo no ha podido acceder a los datos guardados en este dispositivo. ' +
    'Comprueba que te queda espacio libre y vuelve a abrir la app.',
};

/**
 * Etiqueta para el lector de pantalla del boton de activacion.
 *
 * Se anuncia el estado ademas del texto, porque "Test Activo" y "Activar Test"
 * se parecen demasiado al oirlos (REQ-055).
 *
 * @param {string} name
 * @param {boolean} isActive
 * @returns {string}
 */
export function activationAccessibilityLabel(name, isActive) {
  return isActive
    ? `${name}, es el test activo`
    : `Activar el test ${name}`;
}

/**
 * Aviso de confirmacion al borrar (REQ-034).
 *
 * Nombra la fuente: un "¿Seguro?" a secas no deja comprobar que se va a borrar
 * la que se queria.
 *
 * @param {string} name
 * @returns {{title: string, message: string, confirm: string, cancel: string}}
 */
export function removeConfirmation(name) {
  return {
    title: 'Borrar fuente',
    message: `Se eliminará «${name}» de la lista. Tu hoja de cálculo no se toca.`,
    confirm: 'Borrar',
    cancel: 'Cancelar',
  };
}
