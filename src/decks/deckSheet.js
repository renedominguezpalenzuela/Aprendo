/**
 * De filas y celdas a preguntas: resolver la cabecera y filtrar.
 *
 * PURO. Lo unico que importa es `imageUrl`, que tambien lo es.
 *
 * Aca viven REQ-023 a REQ-030, que son la mitad de los requisitos de esta feature
 * y la parte donde una hoja real se desvia del ejemplo: cabeceras con espacios,
 * con acentos, en mayusculas, con una columna extra, o con las seis renombradas.
 *
 * Ver specs/features/deck-sync/design.md seccion 2.5, seccion 4.1 y DD-010.
 *
 * @format
 */

import {toImageUrl} from './imageUrl';

/**
 * Nombres conocidos, ya normalizados, y el campo al que va cada uno.
 *
 * `fechaactualizacion` esta en la lista A PROPOSITO aunque no se use (REQ-030):
 * hace falta RECONOCERLA para que una hoja que solo trae esa columna reconocible
 * no se confunda con una hoja de nombres desconocidos y caiga en la reserva por
 * orden. Reconocerla y descartarla son cosas distintas.
 */
const KNOWN_COLUMNS = {
  pregunta: 'question',
  imagenpregunta: 'imageQuestion',
  respuesta1: 'answer1',
  respuesta2: 'answer2',
  imagenrespuesta: 'imageAnswer',
  fechaactualizacion: 'updatedAt',
};

/** El orden del fichero real. Solo se usa como reserva acotada (REQ-024). */
const ASSUMED_ORDER = [
  'question',
  'imageQuestion',
  'answer1',
  'answer2',
  'imageAnswer',
  'updatedAt',
];

/** Cuantas columnas tiene que haber para poder asumir el orden (REQ-024). */
const ASSUMED_ORDER_WIDTH = 6;

/**
 * @typedef {Object} ColumnMap
 * @property {number} question
 * @property {number} answer1
 * @property {number} imageQuestion  -1 si la hoja no la trae
 * @property {number} answer2        -1 si la hoja no la trae
 * @property {number} imageAnswer    -1 si la hoja no la trae
 *
 * @typedef {'PREGUNTA'|'RESPUESTA1'} MissingColumn
 *
 * @typedef {Object} ParsedQuestion
 * @property {number} position
 * @property {string} question
 * @property {string} answer1
 * @property {string|null} answer2
 * @property {string|null} imageQuestionUrl
 * @property {string|null} imageAnswerUrl
 *
 * @typedef {{row: number, reason: 'INCOMPLETE'}} RowWarning
 */

/**
 * Normaliza un nombre de columna para compararlo (REQ-023).
 *
 * Recorta, baja a minusculas, descompone en NFD para separar los diacriticos de
 * su letra, los descarta, y tira todo lo que no sea alfanumerico. Con eso,
 * "Imagen Pregunta", "IMAGENPREGUNTA" e "imagen  pregunta" colapsan al mismo
 * valor, y "FechaActualización" pierde su tilde.
 *
 * @param {string} raw
 * @returns {string}
 */
export function columnKey(raw) {
  if (typeof raw !== 'string') {
    return '';
  }

  return (
    raw
      .normalize('NFD')
      // Los diacriticos van por punto de codigo y no como caracteres literales:
      // en el editor de otro, un acento combinante suelto es invisible.
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
  );
}

/**
 * Resuelve la cabecera a indices de columna.
 *
 * La PRIMERA fila es siempre cabecera, nunca datos (DD-010), incluso cuando no se
 * reconoce ninguno de sus nombres.
 *
 * @param {string[]} header
 * @returns {{ok: true, columns: ColumnMap, assumedOrder: boolean}
 *         | {ok: false, reason: 'MISSING_COLUMN', missing: MissingColumn}}
 */
export function resolveColumns(header) {
  const cells = Array.isArray(header) ? header : [];

  /** @type {Record<string, number>} */
  const byName = {};

  cells.forEach((cell, index) => {
    const field = KNOWN_COLUMNS[columnKey(cell)];

    // El primero gana: con la columna duplicada, la segunda no pisa a la primera.
    if (field != null && byName[field] == null) {
      byName[field] = index;
    }
  });

  const recognized = Object.keys(byName).length > 0;

  // REQ-024, y sus DOS limites: solo si NINGUNA cabecera se reconoce Y hay
  // exactamente seis columnas. Si una sola se reconoce, se resuelve todo por
  // nombre y lo que falte es un error, no una invitacion a adivinar.
  if (!recognized) {
    if (cells.length !== ASSUMED_ORDER_WIDTH) {
      // Con la cabecera irreconocible no se sabe cual falta; se nombra la
      // primera obligatoria, que es la que el usuario tiene que ir a mirar.
      return {ok: false, reason: 'MISSING_COLUMN', missing: 'PREGUNTA'};
    }

    return {
      ok: true,
      assumedOrder: true,
      columns: toColumnMap(
        ASSUMED_ORDER.reduce((map, field, index) => ({...map, [field]: index}), {}),
      ),
    };
  }

  if (byName.question == null) {
    return {ok: false, reason: 'MISSING_COLUMN', missing: 'PREGUNTA'};
  }

  if (byName.answer1 == null) {
    return {ok: false, reason: 'MISSING_COLUMN', missing: 'RESPUESTA1'};
  }

  return {ok: true, assumedOrder: false, columns: toColumnMap(byName)};
}

/**
 * Filas de datos a preguntas, con los avisos de lo descartado.
 *
 * @param {string[][]} rows Todas las filas, INCLUIDA la cabecera.
 * @param {ColumnMap} columns
 * @returns {{questions: ParsedQuestion[], warnings: RowWarning[]}}
 */
export function toQuestions(rows, columns) {
  /** @type {ParsedQuestion[]} */
  const questions = [];
  /** @type {RowWarning[]} */
  const warnings = [];

  const all = Array.isArray(rows) ? rows : [];

  // Se empieza en 1: la fila 0 es la cabecera SIEMPRE (DD-010). Guardarla como
  // pregunta metaria una tarjeta basura en el mazo que el usuario no puede quitar
  // sin editar su hoja; perder una fila de datos solo cuesta una pregunta.
  for (let index = 1; index < all.length; index += 1) {
    const row = all[index];

    if (isBlankRow(row)) {
      // En SILENCIO: cuarenta filas en blanco al final de una hoja son un
      // artefacto normal, no algo que el usuario tenga que arreglar (REQ-026).
      continue;
    }

    const question = cellAt(row, columns.question);
    const answer1 = cellAt(row, columns.answer1);

    if (question === '' || answer1 === '') {
      // Con contenido pero incompleta: se descarta CON aviso, y el aviso dice el
      // numero de fila TAL COMO SE VE en la hoja (REQ-027). `index` es base 0 y
      // la cabecera es la fila 1, asi que la fila del usuario es index + 1.
      warnings.push({row: index + 1, reason: 'INCOMPLETE'});
      continue;
    }

    questions.push({
      position: questions.length,
      question,
      answer1,
      // Vacio es null y no cadena vacia: "no hay continuacion" y "hay una
      // continuacion vacia" no son lo mismo para quien luego la pinte.
      answer2: emptyToNull(cellAt(row, columns.answer2)),
      imageQuestionUrl: toImageUrl(cellAt(row, columns.imageQuestion)),
      imageAnswerUrl: toImageUrl(cellAt(row, columns.imageAnswer)),
    });
  }

  return {questions, warnings};
}

/**
 * @param {Record<string, number>} byName
 * @returns {ColumnMap}
 */
function toColumnMap(byName) {
  return {
    question: byName.question ?? -1,
    answer1: byName.answer1 ?? -1,
    imageQuestion: byName.imageQuestion ?? -1,
    answer2: byName.answer2 ?? -1,
    imageAnswer: byName.imageAnswer ?? -1,
  };
}

/**
 * Celda recortada, tolerando indices ausentes (-1) y filas mas cortas que la
 * cabecera, que es lo que produce una hoja con celdas finales vacias.
 *
 * @param {string[]} row
 * @param {number} index
 * @returns {string}
 */
function cellAt(row, index) {
  if (index < 0 || row == null || index >= row.length) {
    return '';
  }

  return String(row[index] ?? '').trim();
}

/**
 * @param {string[]} row
 * @returns {boolean}
 */
function isBlankRow(row) {
  return row == null || row.every(cell => String(cell ?? '').trim() === '');
}

/**
 * @param {string} value
 * @returns {string|null}
 */
function emptyToNull(value) {
  return value === '' ? null : value;
}
