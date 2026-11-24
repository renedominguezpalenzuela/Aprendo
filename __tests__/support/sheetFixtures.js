/**
 * Hojas de ejemplo para los tests de la tuberia de datos.
 *
 * Vive en __tests__/support/ porque no es una suite: `jest.config.js` ignora esta
 * carpeta a proposito (el preset de React Native no trae `testMatch`, asi que
 * Jest tomaria por suite cualquier .js de aca y fallaria con "Your test suite
 * must contain at least one test").
 *
 * Ver specs/features/deck-sync/requirements.md seccion 5.
 *
 * @format
 */

/**
 * El `Respuesta2` de la primera fila del fichero real.
 *
 * OJO CON EL NUMERO: el fichero original medía 255 caracteres, y este texto son
 * 218. La diferencia no es un error del test: es que `requirements.md` seccion 5
 * transcribio la celda ABREVIADA, terminandola en `…`, y el fichero real
 * (`~/Downloads/data (5).csv`) no esta en el repositorio.
 *
 * Asi que lo que se asierta es lo que se puede asertar de verdad: que la celda
 * llega ENTERA, con su coma, sus dos puntos y sus parentesis dentro, que es lo
 * que REQ-021 exige y lo unico que el parser puede romper. Para el largo exacto
 * hay un caso aparte, construido a proposito.
 */
export const LONG_ANSWER2 =
  'El primer día de la semana depende del criterio: el lunes es el primer día ' +
  'según la norma internacional (ISO 8601) y la Real Academia Española, ' +
  'mientras que el domingo es considerado el primero por tradición religiosa…';

/** Enlace de pagina de Drive, con el identificador enmascarado como en el spec. */
export const DRIVE_PAGE_URL =
  'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/view?usp=sharing';

/**
 * El fichero real, transcrito de `requirements.md` seccion 5: cabecera y dos
 * filas, entrecomillado entero, y **SIN salto de linea final** — que es
 * exactamente lo que hace existir REQ-022.
 */
export const REAL_CSV =
  '"Pregunta","Imagen Pregunta","Respuesta1","Respuesta2","ImagenRespuesta","FechaActualizacion"\r\n' +
  `"Cuántos días tiene una semana","","Una Semana Tiene 7 días","${LONG_ANSWER2}","",""\r\n` +
  `"Cómo se llama el planeta donde vivimos","${DRIVE_PAGE_URL}","La Tierra","","${DRIVE_PAGE_URL}",""`;

/** Cabecera canonica, en el orden del fichero real. */
export const HEADER = [
  'Pregunta',
  'Imagen Pregunta',
  'Respuesta1',
  'Respuesta2',
  'ImagenRespuesta',
  'FechaActualizacion',
];

/**
 * Construye un CSV a partir de filas, entrecomillando como lo hace Google.
 *
 * @param {string[][]} rows
 * @param {{trailingNewline?: boolean, eol?: string}} [options]
 * @returns {string}
 */
export function toCsv(rows, options = {}) {
  const eol = options.eol ?? '\r\n';
  const body = rows
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join(eol);

  return options.trailingNewline ? `${body}${eol}` : body;
}
