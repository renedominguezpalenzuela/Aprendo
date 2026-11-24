/**
 * Interprete de CSV.
 *
 * Funcion PURA y sin dependencias: no importa React, ni la base, ni la red. Es
 * la mitad barata de probar de esta feature, y por eso vive sola.
 *
 * Propio y no `papaparse` (design.md DD-011): de esa libreria no se usaria nada
 * —streaming, workers, deteccion de delimitador, conversion de tipos— y el
 * formato de aca esta FIJADO por Google, con sus casos raros enumerados en el
 * spec y un fichero real para probarlos.
 *
 * Ver specs/features/deck-sync/design.md seccion 2.4 y DD-011.
 *
 * @format
 */

/** Marca de orden de bytes que a veces encabeza un UTF-8 exportado. */
const BOM = '﻿';

/**
 * Interpreta un CSV en UTF-8 y devuelve sus filas.
 *
 * Respeta lo que REQ-021 y REQ-022 exigen, que es todo lo que el fichero real
 * obliga a respetar:
 *
 *   - campos entrecomillados con COMAS dentro, que es el caso del `Respuesta2`
 *     de la primera fila;
 *   - saltos de linea DENTRO de un campo entrecomillado;
 *   - comillas escapadas (`""`) reducidas a una;
 *   - `CRLF`, `LF` y una mezcla de ambos;
 *   - un fichero que NO termina en salto de linea. El de ejemplo no lo lleva, y
 *     con dos filas, perder la ultima es la mitad del mazo (REQ-022).
 *
 * NO LANZA. Un CSV mal formado —una comilla sin cerrar— devuelve lo que se pueda
 * leer: si el resultado es utilizable lo deciden `deckSheet.js` (que resuelve las
 * columnas) y `syncDeck` (que comprueba si queda alguna fila valida, REQ-062). Lo
 * que no es CSV en absoluto lo ataja `download.js` antes de llegar aca (REQ-061).
 *
 * @param {string} text
 * @returns {string[][]} Filas en el orden del documento; celdas sin recortar.
 */
export function parseCsv(text) {
  if (typeof text !== 'string' || text.length === 0) {
    return [];
  }

  // El BOM se quita ANTES de partir. Si no, la primera cabecera se llamaria
  // "﻿Pregunta", no se reconoceria, y con seis columnas se caeria en la
  // reserva por orden de REQ-024 SIN AVISAR: los datos acabarian en la columna
  // equivocada y nadie veria un error. Ver DD-011.
  const input = text.startsWith(BOM) ? text.slice(BOM.length) : text;

  /** @type {string[][]} */
  const rows = [];
  /** @type {string[]} */
  let row = [];
  let field = '';
  let inQuotes = false;
  let index = 0;

  while (index < input.length) {
    const char = input[index];

    if (inQuotes) {
      if (char !== '"') {
        // Cualquier cosa entre comillas es texto, incluidos comas y saltos.
        field += char;
        index += 1;
        continue;
      }

      if (input[index + 1] === '"') {
        // Comilla escapada: dos en el fichero, una en el dato.
        field += '"';
        index += 2;
        continue;
      }

      inQuotes = false;
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      index += 1;
      continue;
    }

    if (char === ',') {
      row.push(field);
      field = '';
      index += 1;
      continue;
    }

    if (char === '\r' || char === '\n') {
      row.push(field);
      field = '';
      rows.push(row);
      row = [];

      // `CRLF` cuenta como UN final de fila, no como dos. Google exporta con
      // `CRLF`, asi que tratarlos por separado meteria una fila vacia entre cada
      // dos preguntas.
      index += char === '\r' && input[index + 1] === '\n' ? 2 : 1;
      continue;
    }

    field += char;
    index += 1;
  }

  // La ULTIMA fila, cuando el fichero no termina en salto de linea (REQ-022).
  //
  // La condicion mira tambien `row.length` y no solo `field`: la ultima celda
  // puede estar vacia —el fichero real termina en `,""`— y entonces `field` es
  // la cadena vacia pero la fila si tiene contenido que cerrar.
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}
