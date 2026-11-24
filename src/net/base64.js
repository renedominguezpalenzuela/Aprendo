/**
 * Codificador base64.
 *
 * PROPIO y no una libreria, y ni siquiera `base64-js`, que React Native trae como
 * dependencia TRANSITIVA: apoyarse en la transitiva de otro es peor que anadir una
 * propia, porque desaparece sin aviso en cualquier subida de version y el
 * `package.json` no la menciona. La regla de no anadir dependencias viene de
 * docs/solutions/2026-08-16-op-sqlite-xcode-15-2-y-ndk.md.
 *
 * Y hace falta a mano porque React Native NO EXPONE la cadena base64 que su propia
 * capa nativa produce: al pedir `arraybuffer`, el nativo devuelve base64 y el
 * envoltorio lo decodifica a bytes (`XMLHttpRequest.js:611`), pero
 * `responseType = 'base64'` no esta en `SUPPORTED_RESPONSE_TYPES`
 * (`XMLHttpRequest.js:76-83`). Asi que el camino corto no existe por API publica, y
 * `xhr._response` es privado.
 *
 * Ver specs/features/deck-sync/design.md seccion 2.13b y
 * specs/features/deck-sync/deltas/delta-imagenes-en-base64.md.
 *
 * @format
 */

/*
 * Los operadores de bits son LA definicion de base64: tres bytes se reparten en
 * cuatro grupos de seis bits. Escribirlo con divisiones y modulos daria el mismo
 * resultado siendo mas lento y bastante menos reconocible para quien venga a
 * revisarlo con el RFC 4648 al lado. Se acota la regla a este archivo y solo esa.
 */
/* eslint-disable no-bitwise */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Cuantos grupos de tres bytes se convierten antes de cerrar un trozo de cadena.
 *
 * Concatenar 1,33 millones de caracteres de uno en uno deja al motor haciendo
 * malabares con cadenas intermedias. Con trozos de este tamano son unas 350
 * concatenaciones por MB en vez de 350.000, y un `join` al final.
 */
const CHUNK_TRIPLETS = 1024;

/**
 * Un `Uint8Array` como base64 estandar, con relleno `=`.
 *
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export function toBase64(bytes) {
  if (bytes == null || bytes.byteLength === 0) {
    return '';
  }

  const length = bytes.byteLength;
  const remainder = length % 3;
  const complete = length - remainder;

  /** @type {string[]} */
  const chunks = [];
  let chunk = '';
  let triplets = 0;

  for (let i = 0; i < complete; i += 3) {
    const value = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];

    chunk +=
      ALPHABET[(value >> 18) & 63] +
      ALPHABET[(value >> 12) & 63] +
      ALPHABET[(value >> 6) & 63] +
      ALPHABET[value & 63];

    triplets += 1;

    if (triplets === CHUNK_TRIPLETS) {
      chunks.push(chunk);
      chunk = '';
      triplets = 0;
    }
  }

  // La cola: uno o dos bytes sueltos se completan con ceros y se marcan con `=`.
  // Es el caso que rompe un codificador escrito de memoria, y el que tiene test.
  if (remainder === 1) {
    const value = bytes[complete] << 16;

    chunk += `${ALPHABET[(value >> 18) & 63]}${ALPHABET[(value >> 12) & 63]}==`;
  } else if (remainder === 2) {
    const value = (bytes[complete] << 16) | (bytes[complete + 1] << 8);

    chunk += `${ALPHABET[(value >> 18) & 63]}${ALPHABET[(value >> 12) & 63]}${
      ALPHABET[(value >> 6) & 63]
    }=`;
  }

  chunks.push(chunk);

  return chunks.join('');
}

/**
 * Un data URI listo para `<Image source={{uri}}>`.
 *
 * @param {string} mime
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export function toDataUri(mime, bytes) {
  return `data:${mime};base64,${toBase64(bytes)}`;
}
