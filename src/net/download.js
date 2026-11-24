/**
 * La UNICA puerta de red de la app.
 *
 * Ningun otro archivo de src/ puede nombrar `fetch` ni `XMLHttpRequest`; el
 * guardia de jest.setup.js convierte en test roto cualquier peticion que se cuele
 * por otro sitio (REQ-080).
 *
 * Dos mecanismos distintos a proposito, cada uno donde rinde (DD-005):
 *
 *   - el CSV va con `fetch`, que con `signal` se lee en cuatro lineas;
 *   - los BYTES van con `XMLHttpRequest` y `responseType = 'arraybuffer'`, que en
 *     React Native 0.80.3 pide base64 al nativo y convierte una vez. Ademas es el
 *     unico que da las tres cosas que hacen falta aca: `Content-Length` ANTES de
 *     consumir el cuerpo (DD-017), plazo nativo (REQ-046) y `abort()` (REQ-054).
 *
 * Los dos quedan detras de la misma costura, asi que fuera de este archivo la
 * diferencia no se nota (DD-004).
 *
 * NO LANZA NUNCA. Toda causa es un motivo, y son seis distinguibles: la interfaz
 * tiene que poder decir cosas distintas ante un problema de red y ante una hoja
 * que dejo de estar compartida (REQ-060, REQ-061).
 *
 * Ver specs/features/deck-sync/design.md seccion 2.3, seccion 5, DD-004, DD-005,
 * DD-006 y DD-017.
 *
 * @format
 */

/** Plazo del CSV. Lo fija REQ-060. */
export const CSV_TIMEOUT_MS = 15000;

/**
 * Plazo de una imagen. Mas largo que el del CSV a proposito (REQ-046): el CSV son
 * kilobytes y tardar significa que algo va mal, mientras que 1 MB por una red
 * lenta tarda de verdad.
 */
export const IMAGE_TIMEOUT_MS = 20000;

/**
 * Tope del documento (REQ-031).
 *
 * Los 5 MB salen del fichero real: 656 bytes para cabecera y dos filas, unos 250
 * bytes por pregunta de este formato, asi que esto es del orden de 20.000
 * preguntas. Por encima no es una hoja de repaso, es una URL equivocada.
 */
export const MAX_CSV_BYTES = 5 * 1024 * 1024;

/** Tope de una imagen (REQ-042). 1 MB JUSTO se acepta; el tope es "supera 1 MB". */
export const MAX_IMAGE_BYTES = 1024 * 1024;

/**
 * @typedef {'NO_CONNECTION'|'HTTP_ERROR'|'TIMEOUT'|'TOO_LARGE'|'INVALID_CONTENT'|'ABORTED'} DownloadError
 *
 * @typedef {{ok: true, text: string}
 *         | {ok: true, bytes: Uint8Array, mime: string}
 *         | {ok: false, reason: DownloadError, status?: number}} DownloadResult
 */

/** Estado `HEADERS_RECEIVED` de XMLHttpRequest. */
const HEADERS_RECEIVED = 2;

/**
 * Descarga un documento de texto.
 *
 * @param {string} url
 * @param {{signal?: AbortSignal, timeoutMs?: number, maxBytes?: number}} [options]
 * @returns {Promise<DownloadResult>}
 */
export async function downloadText(url, options = {}) {
  const {
    signal,
    timeoutMs = CSV_TIMEOUT_MS,
    maxBytes = MAX_CSV_BYTES,
  } = options;

  if (signal?.aborted) {
    return {ok: false, reason: 'ABORTED'};
  }

  // Controlador PROPIO para el plazo, ademas del del usuario (DD-006). Con uno
  // solo, `signal.aborted` no diria quien aborto, y el orquestador no podria
  // distinguir "salta esta descarga" de "tira la actualizacion".
  const controller = new AbortController();
  const link = linkAbort(signal, controller);
  const deadline = startDeadline(controller, timeoutMs);

  try {
    const response = await fetch(url, {signal: controller.signal});

    if (!response.ok) {
      return {ok: false, reason: 'HTTP_ERROR', status: response.status};
    }

    const declared = contentLength(response.headers?.get?.('content-length'));

    // El tope se mira ANTES de leer el cuerpo cuando la cabecera viene: ahorra la
    // descarga entera, que para quien tiene datos limitados es la mitad del
    // sentido de este tope (DD-017).
    if (declared != null && declared > maxBytes) {
      return {ok: false, reason: 'TOO_LARGE'};
    }

    if (isHtml(response.headers?.get?.('content-type'))) {
      return {ok: false, reason: 'INVALID_CONTENT'};
    }

    const text = await response.text();

    // Y otra vez despues, porque la cabecera puede faltar o mentir.
    if (utf8ByteLength(text) > maxBytes) {
      return {ok: false, reason: 'TOO_LARGE'};
    }

    // Una hoja que dejo de estar compartida responde 200 con el HTML de login, asi
    // que el codigo de estado no delata nada y hay que mirar el cuerpo (REQ-061).
    if (looksLikeMarkup(text)) {
      return {ok: false, reason: 'INVALID_CONTENT'};
    }

    return {ok: true, text};
  } catch (error) {
    return {ok: false, reason: abortReason(error, deadline, signal)};
  } finally {
    deadline.clear();
    link();
  }
}

/**
 * Descarga bytes binarios.
 *
 * @param {string} url
 * @param {{signal?: AbortSignal, timeoutMs?: number, maxBytes?: number}} [options]
 * @returns {Promise<DownloadResult>}
 */
export function downloadBytes(url, options = {}) {
  const {
    signal,
    timeoutMs = IMAGE_TIMEOUT_MS,
    maxBytes = MAX_IMAGE_BYTES,
  } = options;

  if (signal?.aborted) {
    return Promise.resolve({ok: false, reason: 'ABORTED'});
  }

  return new Promise(resolve => {
    const xhr = new XMLHttpRequest();

    /**
     * Resultado con el que ESTE codigo corto la peticion.
     *
     * Guarda el resultado COMPLETO y no solo su motivo, y esa diferencia importa:
     * `abort()` dispara `onabort` de forma SINCRONA, asi que el manejador entrega
     * el resultado antes de que la linea siguiente a `abort()` llegue a ejecutarse.
     * Con solo el motivo guardado, un 404 se entregaba SIN su codigo de estado, y
     * el mensaje del usuario perdia el unico dato util que traia. Lo encontro el
     * test de "un 404 es HTTP_ERROR con su status".
     *
     * Y hace falta de todas formas porque `onabort` no distingue quien llamo a
     * `abort()`: sin esto, cortar por tamano y cancelar el usuario llegarian igual
     * (DD-006).
     *
     * @type {DownloadResult|null}
     */
    let selfResult = null;
    let settled = false;

    /** @param {DownloadResult} result */
    const finish = result => {
      if (settled) {
        return;
      }

      settled = true;
      unlink();
      resolve(result);
    };

    /** @param {DownloadResult} result */
    const abortWith = result => {
      selfResult = result;
      xhr.abort();
      // Por si el doble o la plataforma no disparan `onabort`: `finish` es
      // idempotente, asi que llamarlo dos veces no entrega dos resultados.
      finish(result);
    };

    const unlink = linkAbort(signal, {abort: () => xhr.abort()});

    xhr.onreadystatechange = () => {
      if (xhr.readyState !== HEADERS_RECEIVED || settled) {
        return;
      }

      if (xhr.status >= 400) {
        abortWith({ok: false, reason: 'HTTP_ERROR', status: xhr.status});
        return;
      }

      const declared = contentLength(header(xhr, 'content-length'));

      if (declared != null && declared > maxBytes) {
        // Se corta AQUI, con las cabeceras y sin cuerpo: una imagen de 4 MB no se
        // descarga entera para tirarla despues (REQ-042, DD-017).
        abortWith({ok: false, reason: 'TOO_LARGE'});
        return;
      }

      const type = header(xhr, 'content-type');

      // Lo que no es una imagen no lo es: el enlace de pagina de Drive devuelve
      // HTML con 200, y guardarlo seria guardar una pagina web donde va una foto.
      if (type != null && !isImage(type)) {
        abortWith({ok: false, reason: 'INVALID_CONTENT'});
      }
    };

    xhr.onload = () => {
      const mime = mimeOf(header(xhr, 'content-type'));

      if (!isImage(mime)) {
        finish({ok: false, reason: 'INVALID_CONTENT'});
        return;
      }

      const bytes = toBytes(xhr.response);

      if (bytes == null || bytes.byteLength === 0) {
        finish({ok: false, reason: 'INVALID_CONTENT'});
        return;
      }

      // El tamano real manda sobre la cabecera, que puede faltar o mentir.
      if (bytes.byteLength > maxBytes) {
        finish({ok: false, reason: 'TOO_LARGE'});
        return;
      }

      finish({ok: true, bytes, mime});
    };

    xhr.onerror = () => finish({ok: false, reason: 'NO_CONNECTION'});
    xhr.ontimeout = () => finish({ok: false, reason: 'TIMEOUT'});
    // Si el aborto lo pidio este codigo, gana SU resultado —con su status y su
    // motivo—; si no, lo pidio el usuario (DD-006).
    xhr.onabort = () => finish(selfResult ?? {ok: false, reason: 'ABORTED'});

    try {
      xhr.open('GET', url);
      xhr.responseType = 'arraybuffer';
      // Plazo NATIVO, no un setTimeout: lo aplica la capa de red, asi que tambien
      // corta una conexion que acepta y no responde nunca (REQ-046).
      xhr.timeout = timeoutMs;
      xhr.send();
    } catch (error) {
      finish({ok: false, reason: 'NO_CONNECTION'});
    }
  });
}

/**
 * Conecta el aborto del usuario con quien de verdad cancela la peticion.
 *
 * A mano y no con `AbortSignal.any()`, que no existe en el polyfill de React
 * Native (comprobado en T-001).
 *
 * @param {AbortSignal|undefined} signal
 * @param {{abort: () => void}} target
 * @returns {() => void} baja de la suscripcion
 */
function linkAbort(signal, target) {
  if (signal == null) {
    return () => {};
  }

  const onAbort = () => target.abort();

  signal.addEventListener?.('abort', onAbort);

  return () => signal.removeEventListener?.('abort', onAbort);
}

/**
 * @param {AbortController} controller
 * @param {number} timeoutMs
 * @returns {{expired: () => boolean, clear: () => void}}
 */
function startDeadline(controller, timeoutMs) {
  let expired = false;

  const timer = setTimeout(() => {
    expired = true;
    controller.abort();
  }, timeoutMs);

  return {
    expired: () => expired,
    clear: () => clearTimeout(timer),
  };
}

/**
 * Traduce una excepcion de `fetch` al motivo que corresponde.
 *
 * El orden importa: un aborto por plazo y uno por cancelacion llegan aca como la
 * MISMA excepcion, y lo unico que los distingue es quien lo provoco (DD-006).
 *
 * @param {unknown} error
 * @param {{expired: () => boolean}} deadline
 * @param {AbortSignal|undefined} signal
 * @returns {DownloadError}
 */
function abortReason(error, deadline, signal) {
  if (deadline.expired()) {
    return 'TIMEOUT';
  }

  if (signal?.aborted) {
    return 'ABORTED';
  }

  const name = error?.name ?? '';

  return name === 'AbortError' ? 'ABORTED' : 'NO_CONNECTION';
}

/**
 * @param {XMLHttpRequest} xhr
 * @param {string} name
 * @returns {string|null}
 */
function header(xhr, name) {
  return xhr.getResponseHeader?.(name) ?? null;
}

/**
 * @param {string|null|undefined} value
 * @returns {number|null}
 */
function contentLength(value) {
  if (value == null || value === '') {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

/**
 * Tipo sin sus parametros: `image/png; charset=binary` es `image/png`.
 *
 * @param {string|null|undefined} contentType
 * @returns {string}
 */
function mimeOf(contentType) {
  return String(contentType ?? '')
    .split(';')[0]
    .trim()
    .toLowerCase();
}

/**
 * @param {string|null|undefined} contentType
 * @returns {boolean}
 */
function isImage(contentType) {
  return mimeOf(contentType).startsWith('image/');
}

/**
 * @param {string|null|undefined} contentType
 * @returns {boolean}
 */
function isHtml(contentType) {
  const mime = mimeOf(contentType);

  return mime === 'text/html' || mime === 'application/xhtml+xml';
}

/**
 * @param {string} text
 * @returns {boolean}
 */
function looksLikeMarkup(text) {
  return text.trimStart().startsWith('<');
}

/**
 * Lo que devuelva el XHR, como `Uint8Array`.
 *
 * @param {unknown} response
 * @returns {Uint8Array|null}
 */
function toBytes(response) {
  if (response instanceof Uint8Array) {
    return response;
  }

  if (response instanceof ArrayBuffer) {
    return new Uint8Array(response);
  }

  return null;
}

/**
 * Bytes que ocupa una cadena en UTF-8.
 *
 * A mano y no con `TextEncoder`: no esta garantizado en Hermes, y aca solo hace
 * falta el TAMANO, no la codificacion. Contar `text.length` seria contar unidades
 * UTF-16, con lo que un documento de acentos y emojis pasaria el tope sin que
 * nadie lo viera.
 *
 * @param {string} text
 * @returns {number}
 */
function utf8ByteLength(text) {
  let bytes = 0;

  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);

    if (code < 0x80) {
      bytes += 1;
    } else if (code < 0x800) {
      bytes += 2;
    } else if (code >= 0xd800 && code <= 0xdbff) {
      // Par subrogado: cuatro bytes entre los dos, y se salta el segundo.
      bytes += 4;
      index += 1;
    } else {
      bytes += 3;
    }
  }

  return bytes;
}
