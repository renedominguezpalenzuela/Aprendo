/**
 * Textos de la actualizacion de mazos.
 *
 * Concentrados aca por lo mismo que sourcesCopy.js y masonCopy.js: cambiar una
 * redaccion no debe obligar a tocar un componente, y verlos juntos es la unica
 * forma de revisar que hablan igual.
 *
 * NINGUN texto nombra un archivo ni un identificador del codigo: los lee el
 * usuario final.
 *
 * Ver specs/features/deck-sync/design.md seccion 2.13.
 *
 * @format
 */

/** Rotulos de la accion de la fila y de la ventana de progreso. */
export const SYNC = {
  action: 'Actualizar',
  cancel: 'Cancelar',
  retry: 'Reintentar',
  dismiss: 'Entendido',
  /** Antebrazo de la ventana, sobre el nombre de la fuente. */
  eyebrow: 'Actualizando',
};

/** Lo que dice la fila cuando la fuente no se ha actualizado nunca (REQ-011). */
export const NEVER_SYNCED = 'Nunca actualizada';

/**
 * Mensajes de error, uno por cada motivo que `syncDeck` puede devolver.
 *
 * Los ocho estan escritos a proposito, y hay `SYNC_ERROR_FALLBACK` para lo que
 * nadie previo: un motivo sin texto deja al usuario ante un boton que
 * aparentemente no hace nada, que es exactamente lo que documenta
 * docs/solutions/2026-08-16-donde-va-el-catch-de-un-error-de-base.md.
 *
 * @type {Record<string, string>}
 */
export const SYNC_ERROR = {
  NO_CONNECTION:
    'No hay conexión. Conéctate a una red y vuelve a intentarlo: las preguntas ' +
    'que ya tenías siguen guardadas.',
  TIMEOUT: 'La hoja tarda demasiado en responder. Inténtalo de nuevo.',
  TOO_LARGE:
    'La hoja es demasiado grande para descargarla. Comprueba que la dirección ' +
    'apunta a tu hoja de preguntas.',
  INVALID_CONTENT:
    'Eso no parece una hoja de preguntas. Comprueba que sigue compartida como ' +
    '«cualquiera con el enlace puede ver».',
  EMPTY_SHEET:
    'La hoja no tiene ninguna pregunta. Añade filas y vuelve a actualizar: tu ' +
    'mazo anterior sigue intacto.',
  DATABASE_ERROR:
    'No se pudo guardar en el teléfono. Puede que no quede espacio libre.',
};

/** Ultimo recurso. Ningun motivo se queda sin texto. */
export const SYNC_ERROR_FALLBACK = 'No se pudo actualizar. Inténtalo de nuevo.';

/**
 * Mensaje de un motivo, con los datos que algunos motivos traen.
 *
 * `HTTP_ERROR` y `MISSING_COLUMN` no estan en el mapa porque no son un texto
 * fijo: uno lleva el codigo de estado y el otro el nombre de la columna, que es
 * justo lo que REQ-025 exige decir.
 *
 * @param {string} reason
 * @param {{status?: number, missing?: string}} [detail]
 * @returns {string}
 */
export function syncErrorMessage(reason, detail = {}) {
  if (reason === 'HTTP_ERROR') {
    const status = detail.status == null ? '' : ` (error ${detail.status})`;

    return `La hoja no responde${status}. Comprueba la dirección y vuelve a intentarlo.`;
  }

  if (reason === 'MISSING_COLUMN') {
    const column = detail.missing ?? 'Pregunta';

    return `A la hoja le falta la columna «${column}». Añádela y vuelve a actualizar.`;
  }

  return SYNC_ERROR[reason] ?? SYNC_ERROR_FALLBACK;
}

/**
 * Progreso de la ventana.
 *
 * Devuelve `null` mientras el total no se conoce: la ventana muestra entonces el
 * indicador SIN numeros, y no un total inventado ni un cero (REQ-053).
 *
 * @param {number} done
 * @param {number|null} total
 * @returns {string|null}
 */
export function progressLabel(done, total) {
  if (total == null) {
    return null;
  }

  return `${done} de ${total}`;
}

/**
 * Desenlace de una actualizacion que fue bien.
 *
 * Dice CUANTAS imagenes se omitieron por tamano (REQ-043): sin eso, el usuario ve
 * tarjetas sin foto y cree que su hoja esta mal. Las fallidas se cuentan aparte
 * porque no son lo mismo —una es un limite conocido, la otra un problema— y
 * mezclarlas le haria buscar el fallo en el sitio equivocado.
 *
 * @param {{saved: number, skippedImages: number, failedImages: number}} report
 * @returns {string}
 */
export function syncResultMessage({saved, skippedImages, failedImages}) {
  const parts = [`${saved} ${saved === 1 ? 'pregunta' : 'preguntas'} guardadas`];

  if (skippedImages > 0) {
    parts.push(
      skippedImages === 1
        ? 'se omitió 1 imagen por ser demasiado grande'
        : `se omitieron ${skippedImages} imágenes por ser demasiado grandes`,
    );
  }

  if (failedImages > 0) {
    parts.push(
      failedImages === 1
        ? 'no se pudo descargar 1 imagen'
        : `no se pudieron descargar ${failedImages} imágenes`,
    );
  }

  return `${parts.join('; ')}.`;
}

/**
 * Aviso de las filas que se descartaron por estar incompletas (REQ-027).
 *
 * @param {Array<{row: number}>} warnings
 * @returns {string|null} `null` si no hubo ninguna: no se dice nada.
 */
export function rowWarningsMessage(warnings) {
  if (warnings == null || warnings.length === 0) {
    return null;
  }

  const rows = warnings.map(warning => warning.row).join(', ');

  return warnings.length === 1
    ? `Se descartó la fila ${rows}: le falta la pregunta o la respuesta.`
    : `Se descartaron ${warnings.length} filas (${rows}): les falta la pregunta o la respuesta.`;
}

/**
 * Fecha de ultima actualizacion, para la fila (REQ-011).
 *
 * @param {number|null} lastSyncedAt Milisegundos epoch, o null si nunca.
 * @returns {string}
 */
export function lastSyncedLabel(lastSyncedAt) {
  if (lastSyncedAt == null) {
    // Se DICE que nunca, en vez de dejar el hueco vacio o poner una fecha falsa.
    return NEVER_SYNCED;
  }

  const date = new Date(lastSyncedAt);

  // Formato explicito y no `toLocaleDateString`: el resultado de ese depende de
  // los datos de localizacion del dispositivo, que en Android varian entre
  // fabricantes y en los tests no son los del usuario.
  const day = String(date.getDate()).padStart(2, '0');
  const month = MONTHS[date.getMonth()];
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  // CON el ano, aunque alargue la linea. Sin el, un mazo actualizado hace catorce
  // meses se lee igual que uno de esta semana, y decidir si hay que volver a
  // descargar es lo UNICO para lo que sirve esta fecha (REQ-011).
  return `Actualizada el ${day} ${month} ${year}, ${hours}:${minutes}`;
}

const MONTHS = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

/**
 * Tamano legible de un mazo (REQ-014).
 *
 * En base 1024, que es lo que el usuario ve en los ajustes del sistema. Sin
 * decimales por debajo de 1 KB —"0,3 KB" no informa de nada— y con una por
 * encima.
 *
 * @param {number} bytes
 * @returns {string}
 */
export function formatBytes(bytes) {
  const value = typeof bytes === 'number' && bytes > 0 ? bytes : 0;

  if (value < 1024) {
    return `${Math.round(value)} B`;
  }

  const kb = value / 1024;

  if (kb < 1024) {
    return `${round1(kb)} KB`;
  }

  return `${round1(kb / 1024)} MB`;
}

/**
 * Tamano del mazo tal como se lee en la fila. `null` si la fuente no tiene
 * preguntas: entonces no se muestra tamano alguno (REQ-014).
 *
 * @param {{count: number, bytes: number}|null} summary
 * @returns {string|null}
 */
export function deckSizeLabel(summary) {
  if (summary == null || summary.count === 0) {
    return null;
  }

  const questions = `${summary.count} ${summary.count === 1 ? 'pregunta' : 'preguntas'}`;

  return `${questions} · ${formatBytes(summary.bytes)}`;
}

/**
 * Estado de la zona central cuando la fuente activa no tiene preguntas todavia.
 *
 * Distinto del de "no hay ninguna fuente configurada" (REQ-071): ahi falta
 * registrar una hoja, y aca falta descargarla. Decir lo mismo en los dos casos
 * dejaria al usuario buscando un problema que no tiene.
 *
 * @param {string} sourceName
 * @returns {{title: string, body: string}}
 */
export function emptyDeckState(sourceName) {
  return {
    title: 'Aún no has descargado las preguntas',
    body:
      `«${sourceName}» está configurada, pero sus preguntas todavía no están en ` +
      'el teléfono. Ve a Datos y pulsa Actualizar en esa fuente.',
    // Rotulo PROPIO, y no el de "no hay ninguna fuente".
    //
    // Reutilizar aquel decia "Añadir una fuente" a quien acababa de añadir una: el
    // cuerpo del mensaje le mandaba a Datos y el boton le mandaba a repetir el paso
    // que ya habia dado, con lo que parecia que no habia pasado nada. Un boton tiene
    // que decir lo que hace, y este lleva a Datos.
    action: 'Ir a Datos',
  };
}

/**
 * Rotulos de la tarjeta y de su barra de navegacion.
 *
 * `Nº` con la ordinal volada, como el diseno de referencia.
 */
export const CARD = {
  question: 'Nº',
  answer: 'Respuesta Nº',
  turnToAnswer: 'Toca para ver la respuesta',
  turnToQuestion: 'Toca para volver a la pregunta',
  previous: 'Atrás',
  next: 'Siguiente',
};

/**
 * Numero de tarjeta con DOS digitos (REQ-017, REQ-019).
 *
 * Sin recortar por arriba: un mazo de 120 preguntas mostrara `120`, que es mas
 * honesto que `20`. Los dos digitos son un minimo, no un maximo.
 *
 * @param {number} value
 * @returns {string}
 */
export function twoDigits(value) {
  return String(Math.max(0, Math.trunc(value ?? 0))).padStart(2, '0');
}

/**
 * El encabezado de una cara: `Nº 01` o `Respuesta Nº 01`.
 *
 * @param {number} position   Posicion 1-based.
 * @param {'question'|'answer'} face
 * @returns {string}
 */
export function cardNumberLabel(position, face) {
  const prefix = face === 'answer' ? CARD.answer : CARD.question;

  return `${prefix} ${twoDigits(position)}`;
}

/**
 * Las TRES PIEZAS del indicador de la barra (REQ-019, DELTA-007).
 *
 * Aqui vivia tambien `deckPositionLabel`, que devolvia `01 de 12` de una pieza. Se retiro
 * al comprobar el impacto de este delta: cuando la barra paso a pintar cada pieza a un
 * tamano distinto —antes `03` y `12` pesaban igual y habia que LEERLOS para saber donde
 * vas— se quedo sin un solo consumidor, y solo lo llamaba su propio test. Codigo muerto con
 * test es peor que no tenerlo, porque parece mantenido.
 *
 * Lo que se lee en voz alta NO sale de aqui: sale de `deckPositionAccessibilityLabel`, que
 * dice "Tarjeta 3 de 12" sin los ceros delante.
 *
 * @param {number} position
 * @param {number} total
 * @returns {{current: string, separator: string, total: string}}
 */
export function deckPositionParts(position, total) {
  return {
    current: twoDigits(position),
    separator: 'de',
    total: twoDigits(total),
  };
}

/**
 * Lo que el lector de pantalla oye al enfocar una cara (REQ-028).
 *
 * Se COMPONE en una sola frase a proposito: la cara es un unico elemento accionable,
 * asi que oir "Nº 01", luego la pregunta y luego "toca para ver la respuesta" como
 * tres nodos sueltos seria peor que no anunciar nada.
 *
 * @param {number} position
 * @param {'question'|'answer'} face
 * @param {{question: string, answer1: string, answer2: string|null}} content
 * @returns {string}
 */
export function cardAccessibilityLabel(position, face, content) {
  const header = cardNumberLabel(position, face);

  if (face === 'answer') {
    const continuation = content.answer2 == null ? '' : ` ${content.answer2}`;

    return `${header}. ${content.answer1}${continuation}`;
  }

  return `${header}. ${content.question}`;
}

/** La pista que se le da al lector sobre lo que hace tocar la tarjeta (REQ-028). */
export const CARD_TURN_HINT = 'Toca dos veces para girar la tarjeta';

/**
 * Lo que el lector oye del indicador de posicion.
 *
 * Se dice "tarjeta 3 de 12" y no "03 de 12": leer los ceros delante en voz alta
 * suena a codigo, no a posicion.
 *
 * @param {number} position
 * @param {number} total
 * @returns {string}
 */
export function deckPositionAccessibilityLabel(position, total) {
  return `Tarjeta ${position} de ${total}`;
}

/**
 * @param {number} value
 * @returns {string}
 */
function round1(value) {
  // Coma decimal, que es la de aca. `toFixed` da punto.
  return (Math.round(value * 10) / 10).toString().replace('.', ',');
}
