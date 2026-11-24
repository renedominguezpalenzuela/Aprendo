/**
 * El data URI de la imagen de una tarjeta, listo para `<Image source={{uri}}>`.
 *
 * Existe por una sola razon: `readImageUri` devuelve una cadena de hasta ~1,33 MB, y
 * llamarla en cada render seria releer un megabyte de SQLite cada vez que la tarjeta
 * se repinta. Aca se lee UNA vez por identificador (DD-020).
 *
 * NO LANZA. Un fallo de lectura devuelve `null` y la tarjeta se pinta sin imagen
 * (REQ-038): una imagen que no se puede leer no puede impedir el giro ni la
 * navegacion.
 *
 * Ver specs/features/main-view/design.md seccion 2.13 y DD-020.
 *
 * @format
 */

import {useMemo} from 'react';

import {readImageUri} from './decksRepo';

/**
 * Cache compartida, y hace falta para que PRECARGAR signifique algo.
 *
 * `useMemo` memoiza por instancia de componente, asi que la precarga de la vecina que
 * pide DD-020 no serviria de nada: cuando esa tarjeta se montara, su hook empezaria de
 * cero. Con un mapa de modulo, precargar de verdad adelanta el trabajo.
 *
 * @type {Map<number, string|null>}
 */
const cache = new Map();

/**
 * Cuantas imagenes se conservan.
 *
 * TRES: la que se ve, la siguiente precargada y una de margen para volver atras. Con
 * hasta 1,33 MB por cadena, una cache generosa es un problema de memoria disfrazado de
 * optimizacion (DD-020).
 */
const MAX_CACHED = 3;

/**
 * @param {number|null|undefined} imageId
 * @returns {string|null}
 */
export function useCardImage(imageId) {
  return useMemo(() => readCardImage(imageId), [imageId]);
}

/**
 * La lectura, fuera del hook para que `CardsView` pueda PRECARGAR la vecina sin
 * montar un hook por tarjeta (DD-020).
 *
 * @param {number|null|undefined} imageId
 * @returns {string|null}
 */
export function readCardImage(imageId) {
  // La inmensa mayoria de las preguntas no traen imagen, asi que se sale antes de
  // tocar la base: es el caso comun, no el excepcional.
  if (imageId == null) {
    return null;
  }

  if (cache.has(imageId)) {
    return cache.get(imageId);
  }

  let uri = null;

  try {
    uri = readImageUri(imageId);
  } catch (error) {
    if (__DEV__) {
      console.warn(`[main-view] no se pudo leer la imagen ${imageId}:`, error);
    }
  }

  // Se cachea TAMBIEN el fallo y el null: una imagen que no esta no mejora releyendola
  // en cada render, y es la misma razon por la que `syncDeck` cachea los fracasos de
  // descarga (deck-sync DD-015).
  cache.set(imageId, uri);

  while (cache.size > MAX_CACHED) {
    // `Map` conserva el orden de insercion, asi que la primera clave es la mas vieja.
    cache.delete(cache.keys().next().value);
  }

  return uri;
}

/** Solo para tests: vacia la cache compartida. */
export function resetCardImageCacheForTests() {
  cache.clear();
}
