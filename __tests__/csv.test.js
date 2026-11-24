/**
 * Tests de src/decks/csv.js.
 *
 * REQ-021 (comillas, comas y saltos dentro de campo) y REQ-022 (fichero sin
 * salto de linea final).
 *
 * @format
 */

import {parseCsv} from '../src/decks/csv';
import {LONG_ANSWER2, REAL_CSV} from './support/sheetFixtures';

describe('parseCsv: el fichero real', () => {
  it('devuelve cabecera y DOS filas, aunque no termine en salto de linea', () => {
    const rows = parseCsv(REAL_CSV);

    // 3 = cabecera + 2 preguntas. Si REQ-022 no se cumpliera, serian 2, y se
    // habria perdido la MITAD del mazo sin ningun error.
    expect(rows).toHaveLength(3);
    expect(rows[0][0]).toBe('Pregunta');
    expect(rows[1][0]).toBe('Cuántos días tiene una semana');
    expect(rows[2][0]).toBe('Cómo se llama el planeta donde vivimos');
  });

  it('cada fila tiene las seis columnas, incluida la ultima celda vacia', () => {
    const rows = parseCsv(REAL_CSV);

    rows.forEach(row => expect(row).toHaveLength(6));

    // `FechaActualizacion` viene vacia en el 100 % de las filas (REQ-030), y la
    // ultima celda vacia de una fila sin salto final es justo lo que se pierde
    // si la fila no se cierra bien.
    expect(rows[1][5]).toBe('');
    expect(rows[2][5]).toBe('');
  });

  it('el Respuesta2 largo llega ENTERO, con sus comas dentro', () => {
    const rows = parseCsv(REAL_CSV);
    const answer2 = rows[1][3];

    expect(answer2).toBe(LONG_ANSWER2);
    expect(answer2).toContain('(ISO 8601)');
    expect(answer2).toContain('Española, mientras');
    expect(answer2).toContain('criterio: el lunes');

    // Trocear por comas sin mirar las comillas partiria esta celda en dos y
    // desplazaria todas las columnas siguientes.
    expect(rows[1]).toHaveLength(6);
  });

  it('un campo de exactamente 255 caracteres se conserva entero', () => {
    // El caso del largo exacto va aparte y construido, porque el spec transcribio
    // la celda real ABREVIADA: ver el comentario de LONG_ANSWER2 en support/.
    const exact255 = 'a,'.repeat(127) + 'z';
    expect(exact255).toHaveLength(255);

    const rows = parseCsv(`"x","${exact255}"`);

    expect(rows[0][1]).toBe(exact255);
    expect(rows[0][1]).toHaveLength(255);
  });
});

describe('parseCsv: comillas', () => {
  it('conserva las comas dentro de un campo entrecomillado', () => {
    expect(parseCsv('"uno,dos","tres"')).toEqual([['uno,dos', 'tres']]);
  });

  it('conserva un salto de linea dentro de un campo entrecomillado', () => {
    const rows = parseCsv('"primera\nsegunda","x"');

    // UNA fila, no dos: el salto esta dentro de las comillas.
    expect(rows).toHaveLength(1);
    expect(rows[0][0]).toBe('primera\nsegunda');
  });

  it('reduce la comilla escapada a una sola', () => {
    expect(parseCsv('"dijo ""hola""","x"')).toEqual([['dijo "hola"', 'x']]);
  });

  it('no lanza con una comilla sin cerrar: devuelve lo que se puede leer', () => {
    expect(() => parseCsv('"sin cerrar')).not.toThrow();
    expect(parseCsv('"sin cerrar')).toEqual([['sin cerrar']]);
  });
});

describe('parseCsv: finales de linea', () => {
  it('trata CRLF, LF y una mezcla de los dos igual', () => {
    const expected = [
      ['a', 'b'],
      ['c', 'd'],
      ['e', 'f'],
    ];

    expect(parseCsv('a,b\r\nc,d\r\ne,f')).toEqual(expected);
    expect(parseCsv('a,b\nc,d\ne,f')).toEqual(expected);
    expect(parseCsv('a,b\r\nc,d\ne,f')).toEqual(expected);
  });

  it('CRLF no produce una fila vacia entre cada dos filas', () => {
    expect(parseCsv('a\r\nb\r\nc')).toHaveLength(3);
  });

  it('un salto de linea FINAL no produce una fila vacia de mas', () => {
    expect(parseCsv('a,b\r\n')).toEqual([['a', 'b']]);
    expect(parseCsv('a,b\n')).toEqual([['a', 'b']]);
  });

  it('una linea en blanco EN MEDIO se conserva como fila vacia', () => {
    // No se descarta aca: quien decide que hacer con ella es deckSheet.js, que
    // es donde vive REQ-026.
    expect(parseCsv('a\n\nb')).toEqual([['a'], [''], ['b']]);
  });
});

describe('parseCsv: BOM y entradas degeneradas', () => {
  it('quita el BOM, para que la primera cabecera se reconozca', () => {
    const rows = parseCsv('﻿"Pregunta","Respuesta1"');

    // Sin esto la cabecera se llamaria "﻿Pregunta", no coincidiria con
    // ningun nombre conocido, y con seis columnas se caeria en la reserva por
    // orden de REQ-024 en silencio (DD-011).
    expect(rows[0][0]).toBe('Pregunta');
    expect(rows[0][0].charCodeAt(0)).not.toBe(0xfeff);
  });

  it('devuelve [] con cadena vacia, null o undefined, sin lanzar', () => {
    expect(parseCsv('')).toEqual([]);
    expect(parseCsv(null)).toEqual([]);
    expect(parseCsv(undefined)).toEqual([]);
  });

  it('no recorta los espacios de las celdas: eso es de otra capa', () => {
    expect(parseCsv('"  hola  "')).toEqual([['  hola  ']]);
  });
});
