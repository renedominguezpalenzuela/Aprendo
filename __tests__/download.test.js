/**
 * Tests de src/net/download.js.
 *
 * REQ-031, REQ-042, REQ-044, REQ-046, REQ-054, REQ-060, REQ-061 y DD-006, DD-017.
 *
 * @format
 */

import {
  CSV_TIMEOUT_MS,
  downloadBytes,
  downloadText,
  IMAGE_TIMEOUT_MS,
  MAX_CSV_BYTES,
  MAX_IMAGE_BYTES,
} from '../src/net/download';
import {
  failingFetch,
  fakeFetch,
  hangingFetch,
  installFakeXhr,
} from './support/fakeNetwork';

const URL = 'https://docs.google.com/spreadsheets/d/ID/gviz/tq?tqx=out:csv';
const IMAGE_URL = 'https://drive.google.com/uc?export=download&id=ID';

const originalFetch = global.fetch;
const originalXhr = global.XMLHttpRequest;

afterEach(() => {
  // Se devuelven los globales al guardia de jest.setup.js: si un test los dejara
  // sustituidos, los demas dejarian de comprobar REQ-080.
  global.fetch = originalFetch;
  global.XMLHttpRequest = originalXhr;
  jest.useRealTimers();
});

/** @param {number} n @returns {Uint8Array} */
function imageBytes(n) {
  return new Uint8Array(n).fill(200);
}

describe('downloadText: camino bueno', () => {
  it('devuelve el texto y pide la URL que se le da', async () => {
    global.fetch = fakeFetch({text: '"Pregunta","Respuesta1"', headers: {'content-type': 'text/csv'}});

    const result = await downloadText(URL);

    expect(result).toEqual({ok: true, text: '"Pregunta","Respuesta1"'});
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch.mock.calls[0][0]).toBe(URL);
  });

  it('acepta un CSV sin content-type', async () => {
    global.fetch = fakeFetch({text: 'a,b'});

    expect((await downloadText(URL)).ok).toBe(true);
  });
});

describe('downloadText: errores distinguibles (REQ-060, REQ-061)', () => {
  it('sin conexion es NO_CONNECTION', async () => {
    global.fetch = failingFetch();

    expect(await downloadText(URL)).toEqual({ok: false, reason: 'NO_CONNECTION'});
  });

  it('un codigo de error es HTTP_ERROR CON su status', async () => {
    global.fetch = fakeFetch({status: 404});

    expect(await downloadText(URL)).toEqual({
      ok: false,
      reason: 'HTTP_ERROR',
      status: 404,
    });
  });

  it('el HTML de login con 200 es INVALID_CONTENT, no NO_CONNECTION', async () => {
    // El caso real de una hoja que dejo de estar compartida: responde 200 y sirve
    // la pagina de login. El codigo de estado no delata nada (REQ-061).
    global.fetch = fakeFetch({
      status: 200,
      headers: {'content-type': 'text/html; charset=utf-8'},
      text: '<!DOCTYPE html><html><head><title>Iniciar sesión</title>',
    });

    expect(await downloadText(URL)).toEqual({ok: false, reason: 'INVALID_CONTENT'});
  });

  it('detecta el HTML por el CUERPO aunque el content-type mienta', async () => {
    global.fetch = fakeFetch({
      headers: {'content-type': 'text/csv'},
      text: '\n  <html><body>Nope</body></html>',
    });

    expect(await downloadText(URL)).toEqual({ok: false, reason: 'INVALID_CONTENT'});
  });
});

describe('downloadText: tope de tamano (REQ-031, DD-017)', () => {
  it('rechaza por content-length SIN leer el cuerpo', async () => {
    const text = jest.fn(() => Promise.resolve('x'));

    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        headers: {get: name => (name === 'content-length' ? '99999999' : null)},
        text,
      }),
    );

    expect(await downloadText(URL)).toEqual({ok: false, reason: 'TOO_LARGE'});
    // La mitad del sentido del tope: no gastar los datos del usuario en algo que
    // se va a tirar.
    expect(text).not.toHaveBeenCalled();
  });

  it('rechaza por tamano real cuando no hay content-length', async () => {
    global.fetch = fakeFetch({text: 'a'.repeat(MAX_CSV_BYTES + 1)});

    expect(await downloadText(URL)).toEqual({ok: false, reason: 'TOO_LARGE'});
  });

  it('mide BYTES y no caracteres', async () => {
    // Cada 'ñ' son dos bytes en UTF-8. Con la mitad + 1 de caracteres se pasa el
    // tope, y contando `length` no se veria.
    const chars = Math.floor(MAX_CSV_BYTES / 2) + 1;

    global.fetch = fakeFetch({text: 'ñ'.repeat(chars)});

    expect(await downloadText(URL)).toEqual({ok: false, reason: 'TOO_LARGE'});
  });

  it('acepta justo el tope', async () => {
    global.fetch = fakeFetch({text: 'a'.repeat(MAX_CSV_BYTES)});

    expect((await downloadText(URL)).ok).toBe(true);
  });
});

describe('downloadText: plazo y cancelacion NO se confunden (DD-006)', () => {
  it('el plazo agotado es TIMEOUT', async () => {
    jest.useFakeTimers();
    global.fetch = hangingFetch();

    const pending = downloadText(URL);

    jest.advanceTimersByTime(CSV_TIMEOUT_MS);

    expect(await pending).toEqual({ok: false, reason: 'TIMEOUT'});
  });

  it('la cancelacion del usuario es ABORTED, con el mismo fetch colgado', async () => {
    global.fetch = hangingFetch();

    const controller = new AbortController();
    const pending = downloadText(URL, {signal: controller.signal});

    controller.abort();

    // MISMO escenario que el anterior, motivo DISTINTO. Si los dos llegaran igual,
    // el orquestador no podria decidir entre saltar una imagen y tirar la
    // actualizacion entera.
    expect(await pending).toEqual({ok: false, reason: 'ABORTED'});
  });

  it('un signal ya abortado no llega a pedir nada a la red', async () => {
    global.fetch = fakeFetch({text: 'a,b'});

    const controller = new AbortController();
    controller.abort();

    expect(await downloadText(URL, {signal: controller.signal})).toEqual({
      ok: false,
      reason: 'ABORTED',
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('no deja temporizadores vivos tras terminar bien', async () => {
    jest.useFakeTimers();
    global.fetch = fakeFetch({text: 'a,b'});

    await downloadText(URL);

    // Sin el clearTimeout del `finally`, cada descarga dejaria un temporizador
    // pendiente que aborta un controlador que ya no le importa a nadie.
    expect(jest.getTimerCount()).toBe(0);
  });
});

describe('downloadBytes: camino bueno', () => {
  it('devuelve los bytes y el mime', async () => {
    installFakeXhr({
      status: 200,
      headers: {'content-type': 'image/png', 'content-length': 120 * 1024},
      body: imageBytes(120 * 1024),
    });

    const result = await downloadBytes(IMAGE_URL);

    expect(result.ok).toBe(true);
    expect(result.mime).toBe('image/png');
    expect(result.bytes).toBeInstanceOf(Uint8Array);
    expect(result.bytes.byteLength).toBe(120 * 1024);
  });

  it('pide arraybuffer y fija el plazo nativo', async () => {
    const created = installFakeXhr({
      headers: {'content-type': 'image/jpeg'},
      body: imageBytes(10),
    });

    await downloadBytes(IMAGE_URL);

    expect(created[0].responseType).toBe('arraybuffer');
    expect(created[0].timeout).toBe(IMAGE_TIMEOUT_MS);
    expect(created[0].method).toBe('GET');
  });

  it('normaliza el mime quitando sus parametros', async () => {
    installFakeXhr({
      headers: {'content-type': 'IMAGE/PNG; charset=binary'},
      body: imageBytes(10),
    });

    expect((await downloadBytes(IMAGE_URL)).mime).toBe('image/png');
  });

  it('convierte un ArrayBuffer a Uint8Array', async () => {
    installFakeXhr({
      headers: {'content-type': 'image/png'},
      body: imageBytes(8).buffer,
    });

    const result = await downloadBytes(IMAGE_URL);

    expect(result.bytes).toBeInstanceOf(Uint8Array);
    expect(result.bytes.byteLength).toBe(8);
  });
});

describe('downloadBytes: tope de 1 MB (REQ-042, DD-017)', () => {
  it('corta por content-length y NO descarga el cuerpo', async () => {
    const created = installFakeXhr({
      headers: {'content-type': 'image/jpeg', 'content-length': 1_800_000},
      body: imageBytes(1_800_000),
    });

    expect(await downloadBytes(IMAGE_URL)).toEqual({ok: false, reason: 'TOO_LARGE'});
    // Abortada con las cabeceras: 1,8 MB de datos del usuario que no se gastan.
    expect(created[0].aborted).toBe(true);
  });

  it('corta por tamano real si el content-length falta', async () => {
    installFakeXhr({
      headers: {'content-type': 'image/jpeg'},
      body: imageBytes(MAX_IMAGE_BYTES + 1),
    });

    expect(await downloadBytes(IMAGE_URL)).toEqual({ok: false, reason: 'TOO_LARGE'});
  });

  it('1 MB JUSTO se acepta: el tope es "supera 1 MB"', async () => {
    installFakeXhr({
      headers: {'content-type': 'image/png', 'content-length': MAX_IMAGE_BYTES},
      body: imageBytes(MAX_IMAGE_BYTES),
    });

    const result = await downloadBytes(IMAGE_URL);

    expect(result.ok).toBe(true);
    expect(result.bytes.byteLength).toBe(MAX_IMAGE_BYTES);
  });

  it('1 MB + 1 byte no', async () => {
    installFakeXhr({
      headers: {'content-type': 'image/png', 'content-length': MAX_IMAGE_BYTES + 1},
      body: imageBytes(MAX_IMAGE_BYTES + 1),
    });

    expect((await downloadBytes(IMAGE_URL)).ok).toBe(false);
  });
});

describe('downloadBytes: lo que no es una imagen (REQ-040, REQ-044)', () => {
  it('el HTML de una pagina de Drive es INVALID_CONTENT', async () => {
    installFakeXhr({
      status: 200,
      headers: {'content-type': 'text/html; charset=utf-8'},
      body: imageBytes(500),
    });

    expect(await downloadBytes(IMAGE_URL)).toEqual({
      ok: false,
      reason: 'INVALID_CONTENT',
    });
  });

  it('una respuesta vacia tambien', async () => {
    installFakeXhr({
      headers: {'content-type': 'image/png'},
      body: new Uint8Array(0),
    });

    expect(await downloadBytes(IMAGE_URL)).toEqual({
      ok: false,
      reason: 'INVALID_CONTENT',
    });
  });

  it('un 404 es HTTP_ERROR con su status', async () => {
    installFakeXhr({status: 404, headers: {'content-type': 'text/html'}});

    expect(await downloadBytes(IMAGE_URL)).toEqual({
      ok: false,
      reason: 'HTTP_ERROR',
      status: 404,
    });
  });

  it('un fallo de red es NO_CONNECTION', async () => {
    installFakeXhr({networkError: true});

    expect(await downloadBytes(IMAGE_URL)).toEqual({
      ok: false,
      reason: 'NO_CONNECTION',
    });
  });
});

describe('downloadBytes: plazo y cancelacion (REQ-046, REQ-054, DD-006)', () => {
  it('el plazo nativo es TIMEOUT', async () => {
    installFakeXhr({timeout: true});

    expect(await downloadBytes(IMAGE_URL)).toEqual({ok: false, reason: 'TIMEOUT'});
  });

  it('la cancelacion del usuario es ABORTED, no TIMEOUT', async () => {
    const created = installFakeXhr({hang: true});

    const controller = new AbortController();
    const pending = downloadBytes(IMAGE_URL, {signal: controller.signal});

    // Se espera un turno para que el XHR exista antes de abortarlo.
    await Promise.resolve();
    controller.abort();

    expect(await pending).toEqual({ok: false, reason: 'ABORTED'});
    expect(created[0].aborted).toBe(true);
  });

  it('cortar por tamano NO se confunde con una cancelacion del usuario', async () => {
    // Los dos llaman a `abort()`, asi que `onabort` no puede distinguirlos por si
    // solo: es exactamente el bug silencioso que DD-006 existe para evitar.
    installFakeXhr({
      headers: {'content-type': 'image/png', 'content-length': 5_000_000},
      body: imageBytes(10),
    });

    expect((await downloadBytes(IMAGE_URL)).reason).toBe('TOO_LARGE');
  });

  it('un signal ya abortado no crea ninguna peticion', async () => {
    const created = installFakeXhr({headers: {'content-type': 'image/png'}});

    const controller = new AbortController();
    controller.abort();

    expect(await downloadBytes(IMAGE_URL, {signal: controller.signal})).toEqual({
      ok: false,
      reason: 'ABORTED',
    });
    expect(created).toHaveLength(0);
  });

  it('resuelve UNA sola vez aunque lleguen varios eventos', async () => {
    const created = installFakeXhr({
      headers: {'content-type': 'image/png'},
      body: imageBytes(10),
    });

    const result = await downloadBytes(IMAGE_URL);

    // Un evento posterior no puede cambiar un resultado ya entregado.
    created[0].onabort?.();
    created[0].onerror?.();

    expect(result.ok).toBe(true);
  });
});

// ─── Huecos encontrados por la cobertura en /sdd-verify ──────────────────────

describe('el tamano en bytes de los caracteres que no son ASCII (REQ-031)', () => {
  it('cuenta 3 bytes los caracteres altos, como los puntos suspensivos del fichero real', async () => {
    // '…' (U+2026) son TRES bytes en UTF-8, y aparece literalmente en el
    // `Respuesta2` de la hoja de ejemplo. Contando `length` seria uno.
    const chars = Math.floor(MAX_CSV_BYTES / 3) + 1;

    global.fetch = fakeFetch({text: '…'.repeat(chars)});

    expect(await downloadText(URL)).toEqual({ok: false, reason: 'TOO_LARGE'});
  });

  it('cuenta 4 bytes un emoji, que son DOS unidades UTF-16', async () => {
    // Un par subrogado: si se contaran las dos unidades por separado saldrian 6
    // bytes en vez de 4, y el tope se aplicaria antes de lo debido.
    const chars = Math.floor(MAX_CSV_BYTES / 4) - 10;

    global.fetch = fakeFetch({text: '🧠'.repeat(chars)});

    // Justo por debajo del tope: pasa.
    expect((await downloadText(URL)).ok).toBe(true);

    global.fetch = fakeFetch({text: '🧠'.repeat(Math.floor(MAX_CSV_BYTES / 4) + 1)});

    expect(await downloadText(URL)).toEqual({ok: false, reason: 'TOO_LARGE'});
  });
});

describe('caminos de error del XHR que quedaban sin cubrir', () => {
  it('una respuesta SIN content-type se rechaza al leer el cuerpo', async () => {
    // Sin cabecera no se puede decidir en HEADERS_RECEIVED, asi que la decision cae
    // en `onload`: lo que no se sabe que es una imagen, no se guarda como imagen.
    installFakeXhr({status: 200, headers: {}, body: imageBytes(100)});

    expect(await downloadBytes(IMAGE_URL)).toEqual({
      ok: false,
      reason: 'INVALID_CONTENT',
    });
  });

  it('si el propio open/send lanza, es NO_CONNECTION y no una excepcion', async () => {
    installFakeXhr({headers: {'content-type': 'image/png'}, body: imageBytes(10)});

    // Una URL que el nativo rechaza de entrada: `open` lanza de forma sincrona, y
    // eso no puede salir como excepcion de una funcion que promete no lanzar.
    global.XMLHttpRequest = class {
      open() {
        throw new Error('Invalid URL');
      }
    };

    expect(await downloadBytes('no-es-una-url')).toEqual({
      ok: false,
      reason: 'NO_CONNECTION',
    });
  });
});

describe('nada del usuario sale del dispositivo (REQ-084)', () => {
  it('el CSV se pide con un GET desnudo: sin cuerpo y sin cabeceras propias', async () => {
    global.fetch = fakeFetch({text: 'a,b'});

    await downloadText(URL);

    const [url, options] = global.fetch.mock.calls[0];

    expect(url).toBe(URL);
    // Lo unico que se pasa es el `signal` de la cancelacion. Ni `body`, ni
    // `headers`, ni `credentials`: las unicas peticiones salientes son LECTURAS de
    // lo que el propio usuario registro.
    expect(Object.keys(options)).toEqual(['signal']);
    expect(options.method).toBeUndefined();
  });

  it('la imagen se pide con GET y send() sin cuerpo', async () => {
    const sends = [];

    global.XMLHttpRequest = class {
      open(method, url) {
        this.method = method;
        this.url = url;
      }

      getResponseHeader() {
        return 'image/png';
      }

      abort() {}

      send(...args) {
        sends.push(args);
        this.status = 200;
        this.readyState = 4;
        this.response = imageBytes(10);
        this.onload?.();
      }
    };

    await downloadBytes(IMAGE_URL);

    expect(sends).toEqual([[]]);
  });
});
