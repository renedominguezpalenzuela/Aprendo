/**
 * Tests de src/decks/deckSheet.js. REQ-023 a REQ-030 y DD-010.
 *
 * @format
 */

import {parseCsv} from '../src/decks/csv';
import {columnKey, resolveColumns, toQuestions} from '../src/decks/deckSheet';
import {DRIVE_PAGE_URL, HEADER, LONG_ANSWER2, REAL_CSV} from './support/sheetFixtures';

/**
 * Resuelve una hoja completa, como lo hara `syncDeck`.
 *
 * @param {string[][]} rows
 * @returns {{questions: any[], warnings: any[], assumedOrder: boolean}}
 */
function readSheet(rows) {
  const resolved = resolveColumns(rows[0]);

  if (!resolved.ok) {
    throw new Error(`la cabecera no se resolvio: falta ${resolved.missing}`);
  }

  return {...toQuestions(rows, resolved.columns), assumedOrder: resolved.assumedOrder};
}

describe('columnKey', () => {
  it('colapsa espacios, mayusculas y acentos al mismo valor', () => {
    expect(columnKey('Imagen Pregunta')).toBe('imagenpregunta');
    expect(columnKey('IMAGENPREGUNTA')).toBe('imagenpregunta');
    expect(columnKey('imagen  pregunta')).toBe('imagenpregunta');
    expect(columnKey('  Imagen\tPregunta \n')).toBe('imagenpregunta');
  });

  it('normaliza los acentos y respeta los digitos', () => {
    expect(columnKey('FechaActualización')).toBe('fechaactualizacion');
    expect(columnKey('Respuesta 1')).toBe('respuesta1');
    expect(columnKey('RESPUESTA_2')).toBe('respuesta2');
  });

  it('devuelve cadena vacia con lo que no es texto', () => {
    expect(columnKey(null)).toBe('');
    expect(columnKey(undefined)).toBe('');
  });
});

describe('resolveColumns: por nombre (REQ-023)', () => {
  it('resuelve la cabecera del fichero real', () => {
    const resolved = resolveColumns(HEADER);

    expect(resolved.ok).toBe(true);
    expect(resolved.assumedOrder).toBe(false);
    expect(resolved.columns).toMatchObject({
      question: 0,
      imageQuestion: 1,
      answer1: 2,
      answer2: 3,
      imageAnswer: 4,
    });
  });

  it('resuelve una cabecera con espacios, mayusculas y acentos mezclados', () => {
    const resolved = resolveColumns([
      'imagen pregunta',
      'IMAGENRESPUESTA',
      'Respuesta 1',
      'PREGUNTA',
    ]);

    expect(resolved.ok).toBe(true);
    expect(resolved.columns).toMatchObject({
      imageQuestion: 0,
      imageAnswer: 1,
      answer1: 2,
      question: 3,
    });
  });

  it('ignora una columna extra desconocida SIN recurrir al orden (REQ-024)', () => {
    const resolved = resolveColumns([
      'Pregunta',
      'Notas',
      'Imagen Pregunta',
      'Respuesta1',
    ]);

    expect(resolved.ok).toBe(true);
    expect(resolved.assumedOrder).toBe(false);
    // `Notas` ocupa el indice 1; si se hubiera asumido el orden, `imageQuestion`
    // seria 1 y las imagenes saldrian de la columna equivocada.
    expect(resolved.columns.imageQuestion).toBe(2);
    expect(resolved.columns.answer1).toBe(3);
  });

  it('marca ausentes con -1 las columnas opcionales que la hoja no trae', () => {
    const resolved = resolveColumns(['Pregunta', 'Respuesta1']);

    expect(resolved.ok).toBe(true);
    expect(resolved.columns.answer2).toBe(-1);
    expect(resolved.columns.imageQuestion).toBe(-1);
    expect(resolved.columns.imageAnswer).toBe(-1);
  });
});

describe('resolveColumns: la reserva por orden (REQ-024)', () => {
  it('asume el orden con SEIS columnas y ninguna reconocible', () => {
    const resolved = resolveColumns([
      'Question',
      'Image',
      'Answer1',
      'Answer2',
      'Img2',
      'Fecha',
    ]);

    expect(resolved.ok).toBe(true);
    expect(resolved.assumedOrder).toBe(true);
    expect(resolved.columns).toMatchObject({
      question: 0,
      imageQuestion: 1,
      answer1: 2,
      answer2: 3,
      imageAnswer: 4,
    });
  });

  it('NO asume el orden si alguna cabecera si se reconoce (REQ-025)', () => {
    // Seis columnas, pero `Fecha Actualizacion` es conocida: eso basta para que la
    // hoja se resuelva por nombre, y entonces falta `Respuesta1`.
    const resolved = resolveColumns([
      'Question',
      'Image',
      'Answer1',
      'Answer2',
      'Img2',
      'FechaActualizacion',
    ]);

    expect(resolved).toEqual({
      ok: false,
      reason: 'MISSING_COLUMN',
      missing: 'PREGUNTA',
    });
  });

  it('NO asume el orden con un numero de columnas distinto de seis', () => {
    expect(resolveColumns(['a', 'b', 'c', 'd', 'e']).ok).toBe(false);
    expect(resolveColumns(['a', 'b', 'c', 'd', 'e', 'f', 'g']).ok).toBe(false);
  });
});

describe('resolveColumns: columna obligatoria que falta (REQ-025)', () => {
  it('nombra RESPUESTA1 cuando es la que falta', () => {
    const resolved = resolveColumns([
      'Pregunta',
      'Imagen Pregunta',
      'Respuesta2',
      'ImagenRespuesta',
      'FechaActualizacion',
      'Notas',
      'Otra',
    ]);

    expect(resolved).toEqual({
      ok: false,
      reason: 'MISSING_COLUMN',
      missing: 'RESPUESTA1',
    });
  });

  it('nombra PREGUNTA cuando es la que falta', () => {
    const resolved = resolveColumns(['Respuesta1', 'Respuesta2']);

    expect(resolved.ok).toBe(false);
    expect(resolved.missing).toBe('PREGUNTA');
  });

  it('no lanza con una cabecera vacia o ausente', () => {
    expect(() => resolveColumns([])).not.toThrow();
    expect(resolveColumns([]).ok).toBe(false);
    expect(resolveColumns(null).ok).toBe(false);
  });
});

describe('toQuestions: el fichero real', () => {
  it('guarda DOS preguntas con sus textos y sus imagenes', () => {
    const {questions, warnings} = readSheet(parseCsv(REAL_CSV));

    expect(warnings).toEqual([]);
    expect(questions).toHaveLength(2);

    expect(questions[0]).toEqual({
      position: 0,
      question: 'Cuántos días tiene una semana',
      answer1: 'Una Semana Tiene 7 días',
      answer2: LONG_ANSWER2,
      imageQuestionUrl: null,
      imageAnswerUrl: null,
    });

    expect(questions[1]).toMatchObject({
      position: 1,
      question: 'Cómo se llama el planeta donde vivimos',
      answer1: 'La Tierra',
      answer2: null,
    });
  });

  it('convierte los enlaces de Drive a URLs de archivo (REQ-040)', () => {
    const {questions} = readSheet(parseCsv(REAL_CSV));

    expect(questions[1].imageQuestionUrl).toMatch(
      /^https:\/\/drive\.google\.com\/uc\?export=download&id=/,
    );
    expect(questions[1].imageAnswerUrl).toBe(questions[1].imageQuestionUrl);
    expect(questions[1].imageQuestionUrl).not.toBe(DRIVE_PAGE_URL);
  });

  it('no usa FechaActualizacion para nada (REQ-030)', () => {
    const rows = parseCsv(REAL_CSV);

    // Se rellena la columna que en el fichero real viene vacia siempre.
    rows[1][5] = '2026-08-01';
    rows[2][5] = '2026-08-02';

    const {questions} = readSheet(rows);

    expect(questions).toHaveLength(2);
    questions.forEach(question => {
      expect(Object.keys(question)).not.toContain('updatedAt');
      expect(JSON.stringify(question)).not.toContain('2026-08');
    });
  });
});

describe('toQuestions: filas descartadas (REQ-026, REQ-027)', () => {
  const rows = [
    HEADER,
    ['Uno', '', 'R1', '', '', ''],
    ['Dos', '', 'R2', '', '', ''],
    ['Tres', '', 'R3', '', '', ''],
    ['Sin respuesta', '', '', '', '', ''],
    ['', '', '', '', '', ''],
    ['', '', '', '', '', ''],
    ['   ', '', '  ', '', '', ''],
  ];

  it('guarda las tres completas, en orden', () => {
    const {questions} = readSheet(rows);

    expect(questions.map(q => q.question)).toEqual(['Uno', 'Dos', 'Tres']);
    expect(questions.map(q => q.position)).toEqual([0, 1, 2]);
  });

  it('descarta las filas en blanco EN SILENCIO', () => {
    const {warnings} = readSheet(rows);

    // Solo un aviso: el de la incompleta. Las tres en blanco no avisan.
    expect(warnings).toHaveLength(1);
  });

  it('avisa de la incompleta con su numero de fila TAL COMO SE VE en la hoja', () => {
    const {warnings} = readSheet(rows);

    // La cabecera es la fila 1, asi que "Sin respuesta" —cuarta fila de datos—
    // es la fila 5 de la hoja.
    expect(warnings[0]).toEqual({row: 5, reason: 'INCOMPLETE'});
  });

  it('descarta tambien la fila con pregunta y sin respuesta al reves', () => {
    const {questions, warnings} = readSheet([
      HEADER,
      ['', '', 'Solo respuesta', '', '', ''],
    ]);

    expect(questions).toEqual([]);
    expect(warnings).toEqual([{row: 2, reason: 'INCOMPLETE'}]);
  });
});

describe('toQuestions: la primera fila es SIEMPRE cabecera (DD-010)', () => {
  it('no la guarda como pregunta ni con la reserva por orden', () => {
    const rows = [
      ['Question', 'Image', 'Answer1', 'Answer2', 'Img2', 'Fecha'],
      ['Real', '', 'Respuesta', '', '', ''],
    ];

    const {questions, assumedOrder} = readSheet(rows);

    expect(assumedOrder).toBe(true);
    // UNA pregunta, no dos: guardar la cabecera meteria una tarjeta basura que el
    // usuario no puede quitar sin editar su hoja.
    expect(questions).toHaveLength(1);
    expect(questions[0].question).toBe('Real');
  });
});

describe('toQuestions: celdas y filas degeneradas', () => {
  it('recorta los espacios de los textos', () => {
    const {questions} = readSheet([HEADER, ['  Uno  ', '', ' R1 ', ' R2 ', '', '']]);

    expect(questions[0]).toMatchObject({question: 'Uno', answer1: 'R1', answer2: 'R2'});
  });

  it('tolera filas mas cortas que la cabecera', () => {
    const {questions} = readSheet([HEADER, ['Uno', '', 'R1']]);

    expect(questions[0]).toMatchObject({answer2: null, imageAnswerUrl: null});
  });

  it('devuelve vacio sin lanzar con filas ausentes o solo cabecera', () => {
    const {columns} = resolveColumns(HEADER);

    expect(toQuestions([HEADER], columns)).toEqual({questions: [], warnings: []});
    expect(toQuestions([], columns)).toEqual({questions: [], warnings: []});
    expect(() => toQuestions(null, columns)).not.toThrow();
  });
});
