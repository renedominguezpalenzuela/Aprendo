/**
 * De lo que hay en una celda de imagen a una URL que devuelve LA IMAGEN.
 *
 * Funcion PURA, sin dependencias y sin estado.
 *
 * El problema que resuelve (REQ-040): las celdas del fichero real traen enlaces
 * de Drive en forma de PAGINA (`…/file/d/<ID>/view?usp=sharing`), y esa URL
 * devuelve HTML, no bytes de imagen. Descargarla tal cual guardaria una pagina
 * web donde deberia haber una foto.
 *
 * Ver specs/features/deck-sync/design.md seccion 2.6 y seccion 4.2.
 *
 * @format
 */

/** Endpoint de descarga de Drive. Cuelga siempre de la raiz, con el ID aparte. */
const DRIVE_DOWNLOAD = 'https://drive.google.com/uc?export=download&id=';

/**
 * Identificadores de Drive: letras, digitos, guion y subrayado. Nada mas, y eso
 * es lo que permite reconstruir la URL en vez de recortar la entrada.
 */
const DRIVE_ID = '([A-Za-z0-9_-]+)';

/** `…/file/d/<ID>/…` — la forma de pagina, la del fichero real. */
const FILE_PATH = new RegExp(`/file/d/${DRIVE_ID}`);

/** `?id=<ID>` o `&id=<ID>` — las formas `open` y `uc`. */
const ID_PARAM = new RegExp(`[?&]id=${DRIVE_ID}`);

const DRIVE_HOST = /^https:\/\/drive\.google\.com\//i;

/**
 * @param {string} raw Contenido de la celda; puede venir vacio o con basura.
 * @returns {string|null} URL de descarga, o null si la celda no trae nada
 *   utilizable. `null` es "esta pregunta no lleva imagen" (REQ-044), NUNCA un
 *   error que aborte la actualizacion.
 */
export function toImageUrl(raw) {
  if (typeof raw !== 'string') {
    return null;
  }

  const url = raw.trim();

  // Se exige https explicitamente. Un `http://` no se "arregla" subiendolo a
  // https: seria adivinar por el usuario, y REQ-020 pide HTTPS.
  if (url === '' || !/^https:\/\//i.test(url)) {
    return null;
  }

  const id = driveFileId(url);

  // Una URL que ya es directa se usa SIN transformar (REQ-040, segunda mitad).
  return id == null ? url : `${DRIVE_DOWNLOAD}${id}`;
}

/**
 * Extrae el identificador de un enlace de Drive.
 *
 * La URL de descarga se RECONSTRUYE desde el identificador, no se recorta de la
 * entrada. Es la misma leccion que `toCsvUrl` (data-sources DD-008): recortar por
 * `/view` deja pasar lo que venga detras, y con las formas que no lo llevan
 * produce rutas que no existen.
 *
 * @param {string} url
 * @returns {string|null}
 */
function driveFileId(url) {
  if (!DRIVE_HOST.test(url)) {
    return null;
  }

  const fromPath = url.match(FILE_PATH);

  if (fromPath != null) {
    return fromPath[1];
  }

  const fromQuery = url.match(ID_PARAM);

  if (fromQuery != null) {
    return fromQuery[1];
  }

  // Es de Drive pero no se le ve identificador: una carpeta, un enlace corto, o
  // una forma que Drive haya inventado despues de esto. Se devuelve la URL tal
  // cual en vez de descartarla —no se sabe que este mal— y si resulta ser HTML,
  // `downloadBytes` lo rechaza con INVALID_CONTENT y la pregunta se guarda sin
  // imagen (REQ-044). Adivinar aca seria peor que dejar que falle donde se ve.
  return null;
}
