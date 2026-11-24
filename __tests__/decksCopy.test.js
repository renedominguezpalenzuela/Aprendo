/**
 * Tests de src/decks/decksCopy.js.
 *
 * REQ-011 (fecha), REQ-014 (tamano), REQ-025, REQ-031, REQ-043, REQ-053,
 * REQ-060 a REQ-063 y REQ-071.
 *
 * @format
 */

import {
  CARD_TURN_HINT,
  cardAccessibilityLabel,
  cardNumberLabel,
  deckPositionAccessibilityLabel,
  deckPositionParts,
  deckSizeLabel,
  emptyDeckState,
  formatBytes,
  lastSyncedLabel,
  NEVER_SYNCED,
  progressLabel,
  rowWarningsMessage,
  syncErrorMessage,
  SYNC_ERROR,
  SYNC_ERROR_FALLBACK,
  syncResultMessage,
  twoDigits,
} from '../src/decks/decksCopy';

/** Los ocho motivos que `syncDeck` puede devolver (design.md seccion 2.8). */
const ALL_REASONS = [
  'NO_CONNECTION',
  'HTTP_ERROR',
  'TIMEOUT',
  'TOO_LARGE',
  'INVALID_CONTENT',
  'MISSING_COLUMN',
  'EMPTY_SHEET',
  'DATABASE_ERROR',
];

describe('syncErrorMessage: ningun motivo se queda sin texto', () => {
  it('los ocho motivos producen un mensaje propio y distinto', () => {
    const messages = ALL_REASONS.map(reason =>
      syncErrorMessage(reason, {status: 404, missing: 'Respuesta1'}),
    );

    messages.forEach(message => {
      expect(typeof message).toBe('string');
      expect(message.length).toBeGreaterThan(10);
      expect(message).not.toBe(SYNC_ERROR_FALLBACK);
    });

    // Distintos entre si: si dos motivos dicen lo mismo, uno de los dos no sirve.
    expect(new Set(messages).size).toBe(ALL_REASONS.length);
  });

  it('un motivo que nadie previo cae en el ultimo recurso, no en undefined', () => {
    // La leccion literal de donde-va-el-catch-de-un-error-de-base: un motivo mudo
    // deja al usuario ante un boton que aparentemente no hace nada.
    expect(syncErrorMessage('ALGO_QUE_NADIE_PREVIO')).toBe(SYNC_ERROR_FALLBACK);
    expect(syncErrorMessage(undefined)).toBe(SYNC_ERROR_FALLBACK);
  });

  it('MISSING_COLUMN nombra la columna que falta (REQ-025)', () => {
    expect(syncErrorMessage('MISSING_COLUMN', {missing: 'Respuesta1'})).toContain(
      'Respuesta1',
    );
    expect(syncErrorMessage('MISSING_COLUMN', {missing: 'Pregunta'})).toContain(
      'Pregunta',
    );
  });

  it('HTTP_ERROR incluye el codigo de estado, y aguanta sin el', () => {
    expect(syncErrorMessage('HTTP_ERROR', {status: 404})).toContain('404');
    expect(syncErrorMessage('HTTP_ERROR')).not.toContain('undefined');
  });

  it('el de sin conexion y el de contenido invalido no se confunden (REQ-061)', () => {
    // Son dos causas distintas y el spec exige que el usuario las distinga: una es
    // su red, la otra es que su hoja dejo de estar compartida.
    expect(SYNC_ERROR.NO_CONNECTION).not.toBe(SYNC_ERROR.INVALID_CONTENT);
    expect(SYNC_ERROR.INVALID_CONTENT).toMatch(/compartida/i);
    expect(SYNC_ERROR.NO_CONNECTION).toMatch(/conexión/i);
  });

  it('los mensajes que pueden asustar dicen que el mazo anterior sigue ahi', () => {
    expect(SYNC_ERROR.NO_CONNECTION).toMatch(/siguen guardadas/i);
    expect(SYNC_ERROR.EMPTY_SHEET).toMatch(/intacto/i);
  });
});

describe('progressLabel (REQ-051, REQ-053)', () => {
  it('devuelve null mientras el total no se conoce', () => {
    // Sin esto la ventana mostraria "0 de 0" antes de interpretar el CSV, que es
    // exactamente el total inventado que REQ-053 prohibe.
    expect(progressLabel(0, null)).toBeNull();
  });

  it('dice completadas sobre total', () => {
    expect(progressLabel(7, 20)).toBe('7 de 20');
    expect(progressLabel(20, 20)).toBe('20 de 20');
  });
});

describe('syncResultMessage (REQ-043)', () => {
  it('dice cuantas preguntas se guardaron, en singular y plural', () => {
    expect(syncResultMessage({saved: 1, skippedImages: 0, failedImages: 0})).toContain(
      '1 pregunta ',
    );
    expect(syncResultMessage({saved: 20, skippedImages: 0, failedImages: 0})).toContain(
      '20 preguntas',
    );
  });

  it('dice CUANTAS imagenes se omitieron por tamano', () => {
    expect(syncResultMessage({saved: 2, skippedImages: 1, failedImages: 0})).toMatch(
      /omitió 1 imagen/,
    );
    expect(syncResultMessage({saved: 9, skippedImages: 3, failedImages: 0})).toMatch(
      /omitieron 3 imágenes/,
    );
  });

  it('cuenta aparte las que fallaron: no es lo mismo que omitir por tamano', () => {
    const message = syncResultMessage({saved: 5, skippedImages: 2, failedImages: 1});

    expect(message).toMatch(/omitieron 2/);
    expect(message).toMatch(/no se pudo descargar 1/);
  });

  it('no menciona imagenes cuando no hubo ninguna omitida ni fallida', () => {
    const message = syncResultMessage({saved: 4, skippedImages: 0, failedImages: 0});

    expect(message).toBe('4 preguntas guardadas.');
  });
});

describe('rowWarningsMessage (REQ-027)', () => {
  it('devuelve null sin avisos: no se dice nada', () => {
    expect(rowWarningsMessage([])).toBeNull();
    expect(rowWarningsMessage(null)).toBeNull();
  });

  it('nombra la fila descartada', () => {
    expect(rowWarningsMessage([{row: 5}])).toContain('fila 5');
  });

  it('enumera las filas cuando son varias', () => {
    const message = rowWarningsMessage([{row: 5}, {row: 9}, {row: 12}]);

    expect(message).toContain('3 filas');
    expect(message).toContain('5, 9, 12');
  });
});

describe('lastSyncedLabel (REQ-011)', () => {
  it('DICE que nunca, en vez de dejar el hueco vacio', () => {
    expect(lastSyncedLabel(null)).toBe(NEVER_SYNCED);
    expect(lastSyncedLabel(undefined)).toBe(NEVER_SYNCED);
    expect(NEVER_SYNCED).not.toBe('');
  });

  it('formatea la fecha con dia, mes, ANO y hora', () => {
    const label = lastSyncedLabel(new Date(2026, 7, 18, 9, 5).getTime());

    expect(label).toBe('Actualizada el 18 ago 2026, 09:05');
  });

  it('lleva el ano, para que hace catorce meses no se lea como esta semana', () => {
    const reciente = lastSyncedLabel(new Date(2026, 7, 18).getTime());
    const vieja = lastSyncedLabel(new Date(2025, 5, 18).getTime());

    // Es lo UNICO para lo que sirve esta fecha: decidir si hay que volver a
    // descargar.
    expect(reciente).toContain('2026');
    expect(vieja).toContain('2025');
    expect(reciente).not.toBe(vieja);
  });

  it('rellena con cero el dia y la hora de una cifra', () => {
    const label = lastSyncedLabel(new Date(2026, 0, 3, 7, 4).getTime());

    expect(label).toContain('03 ene');
    expect(label).toContain('07:04');
  });
});

describe('formatBytes y deckSizeLabel (REQ-014)', () => {
  it('usa base 1024, que es la que el usuario ve en los ajustes', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1536)).toBe('1,5 KB');
    expect(formatBytes(1024 * 1024)).toBe('1 MB');
    expect(formatBytes(1024 * 1024 * 2.5)).toBe('2,5 MB');
  });

  it('usa coma decimal y no notacion cientifica', () => {
    const big = formatBytes(1024 * 1024 * 123.456);

    expect(big).not.toMatch(/e\+/i);
    expect(big).not.toContain('.');
  });

  it('aguanta valores absurdos sin lanzar', () => {
    expect(formatBytes(-5)).toBe('0 B');
    expect(formatBytes(null)).toBe('0 B');
    expect(formatBytes(undefined)).toBe('0 B');
  });

  it('no muestra tamano alguno si la fuente no tiene preguntas', () => {
    expect(deckSizeLabel(null)).toBeNull();
    expect(deckSizeLabel({count: 0, bytes: 0})).toBeNull();
  });

  it('dice preguntas y tamano cuando si las hay', () => {
    expect(deckSizeLabel({count: 1, bytes: 900})).toBe('1 pregunta · 900 B');
    expect(deckSizeLabel({count: 20, bytes: 1024 * 1024})).toBe('20 preguntas · 1 MB');
  });
});

describe('emptyDeckState (REQ-071)', () => {
  it('nombra la fuente y manda a Datos', () => {
    const copy = emptyDeckState('Física');

    expect(copy.body).toContain('Física');
    expect(copy.body).toMatch(/Datos/);
    expect(copy.body).toMatch(/Actualizar/);
  });

  it('no dice que falte una fuente: eso es el otro estado vacio', () => {
    const copy = emptyDeckState('Física');

    expect(copy.title).not.toMatch(/no hay ninguna fuente/i);
    expect(copy.body).not.toMatch(/añade una fuente/i);
  });

  it('su accion NO invita a anadir otra fuente: el usuario ya anadio una', () => {
    const copy = emptyDeckState('Física');

    // El fallo que esto evita: el boton decia "Añadir una fuente" justo despues de
    // que el usuario anadiera una, mientras el cuerpo del mensaje le mandaba a
    // Datos. Parecia que no habia pasado nada.
    expect(copy.action).toBeDefined();
    expect(copy.action).not.toMatch(/añadir/i);
    expect(copy.action).toMatch(/datos/i);
  });

  it('ningun texto nombra archivos ni identificadores del codigo', () => {
    const all = [
      ...Object.values(SYNC_ERROR),
      SYNC_ERROR_FALLBACK,
      NEVER_SYNCED,
      emptyDeckState('X').title,
      emptyDeckState('X').body,
      syncResultMessage({saved: 1, skippedImages: 1, failedImages: 1}),
    ].join(' ');

    expect(all).not.toMatch(/\.js\b/);
    expect(all).not.toMatch(/useDeck|syncDeck|sqlite|REQ-/i);
  });
});

// ─── delta de la vista de tarjetas ───────────────────────────────────────────

describe('numeros de dos digitos (REQ-017, REQ-019)', () => {
  it('rellena con cero por debajo de diez', () => {
    expect(twoDigits(1)).toBe('01');
    expect(twoDigits(9)).toBe('09');
    expect(twoDigits(10)).toBe('10');
  });

  it('NO recorta por arriba: 120 preguntas son 120, no 20', () => {
    // Los dos digitos son un minimo, no un maximo. Recortar mentiria sobre el mazo.
    expect(twoDigits(120)).toBe('120');
  });

  it('aguanta valores absurdos sin lanzar', () => {
    expect(twoDigits(0)).toBe('00');
    expect(twoDigits(-3)).toBe('00');
    expect(twoDigits(null)).toBe('00');
    expect(twoDigits(2.7)).toBe('02');
  });
});

describe('encabezado de la cara (REQ-017, REQ-018)', () => {
  it('el anverso dice Nº y el reverso dice Respuesta Nº', () => {
    expect(cardNumberLabel(1, 'question')).toBe('Nº 01');
    expect(cardNumberLabel(1, 'answer')).toBe('Respuesta Nº 01');
    expect(cardNumberLabel(12, 'answer')).toBe('Respuesta Nº 12');
  });
});

describe('indicador de la barra (REQ-019)', () => {
  it('los DOS numeros con dos digitos', () => {
    expect(deckPositionParts(1, 12)).toMatchObject({current: '01', total: '12'});
    expect(deckPositionParts(3, 9)).toMatchObject({current: '03', total: '09'});
  });

  it('un mazo de una sola tarjeta dice 01 de 01 (DELTA-004)', () => {
    expect(deckPositionParts(1, 1)).toMatchObject({current: '01', total: '01'});
  });

  it('deckPositionParts da las tres piezas, y deckPositionLabel se compone de ellas', () => {
    // Un solo dueno del relleno a dos digitos y del separador: si manana el separador deja
    // de ser "de", cambia en un sitio y las dos funciones lo siguen.
    expect(deckPositionParts(3, 12)).toEqual({
      current: '03',
      separator: 'de',
      total: '12',
    });

    // El separador es UN valor y no una cadena repetida en la barra: si manana deja de ser
    // "de", cambia aqui y la barra lo sigue sin tocarse.
    expect(deckPositionParts(3, 12).separator).toBe('de');
  });
});

describe('accesibilidad de la tarjeta (REQ-028)', () => {
  const content = {
    question: '¿Cuántos días tiene una semana?',
    answer1: 'Una semana tiene 7 días',
    answer2: 'El primer día depende del criterio',
  };

  it('COMPONE el numero y el texto en UNA frase, no tres nodos', () => {
    expect(cardAccessibilityLabel(1, 'question', content)).toBe(
      'Nº 01. ¿Cuántos días tiene una semana?',
    );
  });

  it('en el reverso incluye la continuacion si la hay', () => {
    const label = cardAccessibilityLabel(1, 'answer', content);

    expect(label).toContain('Respuesta Nº 01');
    expect(label).toContain('7 días');
    expect(label).toContain('depende del criterio');
  });

  it('sin continuacion no deja un espacio colgando', () => {
    const label = cardAccessibilityLabel(1, 'answer', {...content, answer2: null});

    expect(label).toBe('Respuesta Nº 01. Una semana tiene 7 días');
    expect(label).not.toMatch(/\s$/);
  });

  it('el indicador se dice sin los ceros delante', () => {
    // "cero tres de doce" suena a codigo; "tarjeta 3 de 12" suena a posicion.
    expect(deckPositionAccessibilityLabel(3, 12)).toBe('Tarjeta 3 de 12');
    expect(deckPositionAccessibilityLabel(3, 12)).not.toContain('03');
  });

  it('la pista dice que se gira, no que se abre ni que se pulsa', () => {
    expect(CARD_TURN_HINT).toMatch(/girar/i);
  });
});
