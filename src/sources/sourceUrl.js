/**
 * Validacion y derivacion de la URL de una fuente de datos.
 *
 * FUNCION PURA: no importa React, ni la base, ni `fetch`. Es la unica logica de
 * esta feature con casos de verdad, y por eso vive aislada y se prueba sola.
 *
 * Ver specs/features/data-sources/design.md seccion 2.3, seccion 4 y DD-008.
 *
 * @format
 */

/**
 * Longitud maxima del nombre.
 *
 * El nombre titula el header de la vista de tarjetas (REQ-040), que mide 430 dp
 * de ancho de referencia menos dos columnas de 46, escala hasta x1.4 y va a dos
 * lineas como mucho. Un nombre sin tope entra en el header, no en la
 * composicion. Ver design.md DD-003.
 */
export const MAX_NAME_LENGTH = 60;

/**
 * Longitud maxima de la URL.
 *
 * 2048 es el limite practico que respetan navegadores y servidores. No protege
 * de nada tecnico aca dentro; evita que un pegado accidental de media pagina
 * acabe en la base.
 */
export const MAX_URL_LENGTH = 2048;

/**
 * Motivos por los que una URL se rechaza. Cada uno tiene su propio texto en
 * sourcesCopy.js: un mensaje generico obligaria al usuario a adivinar.
 *
 * @typedef {'EMPTY'|'TOO_LONG'|'NOT_HTTPS'|'NOT_A_SHEET'|'PUBLISHED_URL'} UrlError
 */

/** @typedef {{ok: true, url: string} | {ok: false, reason: UrlError}} UrlResult */

/**
 * Hoja publicada en la web: `/spreadsheets/d/e/2PACX-.../pubhtml`.
 *
 * Se comprueba ANTES que SHEET_URL porque tambien la cumple: sin este atajo el
 * usuario recibiria "no es una hoja de calculo" sobre una URL que si lo es, y
 * no sabria que lo que falla es haber usado "Publicar en la web" en vez de
 * "Compartir". El endpoint gviz no funciona sobre esta forma (REQ-013c).
 */
const PUBLISHED_URL = /^https:\/\/docs\.google\.com\/spreadsheets\/d\/e\//i;

/**
 * Forma valida: el identificador del documento va justo detras de `/d/`.
 *
 * El identificador tiene que tener al menos un caracter: `/d//edit` cumpliria un
 * patron mas laxo y no apunta a ningun sitio.
 */
const SHEET_URL =
  /^https:\/\/docs\.google\.com\/spreadsheets\/d\/([A-Za-z0-9_-]+)(?:\/|\?|#|$)/;

/** Cualquier esquema al principio de la cadena, para distinguir NOT_HTTPS. */
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;

/**
 * Normaliza y valida la URL introducida por el usuario.
 *
 * Recortar no es cosmetico: pegar desde el navegador o desde una app de
 * mensajeria arrastra espacios y saltos de linea con frecuencia, y sin recortar
 * la URL entra en la base con basura que despues rompe la descarga (REQ-013b).
 *
 * @param {string} raw
 * @returns {UrlResult}
 */
export function validateSheetUrl(raw) {
  const url = typeof raw === 'string' ? raw.trim() : '';

  if (url === '') {
    return {ok: false, reason: 'EMPTY'};
  }

  // El tope se comprueba sobre la cadena YA recortada: rechazar por longitud una
  // URL que sobra solo en espacios seria absurdo.
  if (url.length > MAX_URL_LENGTH) {
    return {ok: false, reason: 'TOO_LONG'};
  }

  // Un `http://` por lo demas correcto merece su propio mensaje: el usuario
  // tiene la URL buena y le falta una letra.
  if (HAS_SCHEME.test(url) && !url.toLowerCase().startsWith('https://')) {
    return {ok: false, reason: 'NOT_HTTPS'};
  }

  if (PUBLISHED_URL.test(url)) {
    return {ok: false, reason: 'PUBLISHED_URL'};
  }

  if (!SHEET_URL.test(url)) {
    return {ok: false, reason: 'NOT_A_SHEET'};
  }

  return {ok: true, url};
}

/**
 * Deriva la URL de exportacion a CSV.
 *
 * Presupone una URL ya validada por `validateSheetUrl`.
 *
 * La URL de edicion NO sirve: un fetch sobre ella devuelve el HTML de la
 * aplicacion de Sheets. Se sustituye todo lo que va desde `/edit` por el
 * endpoint gviz.
 *
 * El `gid` SE CONSERVA. Sin el, Google exporta la primera hoja del documento, y
 * con un documento de varias pestanas eso significa cargar preguntas que no son
 * las del usuario SIN NINGUN ERROR VISIBLE. Ver design.md DD-008.
 *
 * @param {string} url
 * @returns {string}
 */
export function toCsvUrl(url) {
  const match = SHEET_URL.exec(url.trim());

  if (match == null) {
    // Contrato roto: se llamo con una URL sin validar. Se avisa en vez de
    // devolver una cadena rota en silencio, que acabaria guardada en la base.
    throw new Error('toCsvUrl requiere una URL ya validada por validateSheetUrl');
  }

  // La base se RECONSTRUYE desde el identificador, no se recorta de la entrada.
  // Recortar por `/edit` deja pasar lo que venga detras en las formas que no lo
  // llevan: `.../d/<ID>/view` produciria `.../d/<ID>/view/gviz/...`, que no
  // existe. El endpoint gviz cuelga siempre de la raiz del documento.
  const base = `https://docs.google.com/spreadsheets/d/${match[1]}`;
  const csv = `${base}/gviz/tq?tqx=out:csv`;
  const gid = readGid(url);

  return gid == null ? csv : `${csv}&gid=${gid}`;
}

/**
 * Extrae el `gid` de la URL, o `null` si no lo trae.
 *
 * Puede venir en la query (`?gid=`) o en el fragmento (`#gid=`). Si vienen los
 * dos y DIFIEREN manda el del fragmento: al copiar el enlace, el navegador deja
 * ahi la pestana que estaba abierta, mientras que el de la query puede venir de
 * una navegacion anterior.
 *
 * @param {string} url
 * @returns {string | null}
 */
function readGid(url) {
  const hashIndex = url.indexOf('#');
  const fragment = hashIndex === -1 ? '' : url.slice(hashIndex + 1);
  const query = hashIndex === -1 ? url : url.slice(0, hashIndex);

  return matchGid(fragment) ?? matchGid(query);
}

/**
 * @param {string} part
 * @returns {string | null}
 */
function matchGid(part) {
  const match = /[?&#]?gid=(\d+)/.exec(part);

  return match == null ? null : match[1];
}

/**
 * Clave de comparacion del nombre.
 *
 * Es lo que se guarda en `sources.name_key` y lo que hace unica la comparacion
 * sin distinguir mayusculas ni espacios de los extremos (REQ-012).
 *
 * Se usa `toLocaleLowerCase` y no `toLowerCase` ni el `lower()` de SQLite: el de
 * SQLite solo baja ASCII, asi que "APRENDÍZ" y "aprendíz" le pareceran nombres
 * distintos. Por eso la clave se calcula aca y no en una columna generada.
 *
 * @param {string} name
 * @returns {string}
 */
export function nameKey(name) {
  return typeof name === 'string' ? name.trim().toLocaleLowerCase() : '';
}

/**
 * Valida el nombre.
 *
 * @param {string} raw
 * @returns {{ok: true, name: string} | {ok: false, reason: 'EMPTY'|'TOO_LONG'}}
 */
export function validateName(raw) {
  const name = typeof raw === 'string' ? raw.trim() : '';

  if (name === '') {
    return {ok: false, reason: 'EMPTY'};
  }

  if (name.length > MAX_NAME_LENGTH) {
    return {ok: false, reason: 'TOO_LONG'};
  }

  return {ok: true, name};
}
