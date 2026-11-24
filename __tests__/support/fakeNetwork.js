/**
 * Dobles de red para los tests de src/net/download.js.
 *
 * Solo los usa esa suite. Todo lo que esta aguas arriba —`syncDeck` y los hooks—
 * inyecta la costura `deps.net` y no toca los globales para nada (DD-004).
 *
 * El resto del proyecto corre con el guardia de jest.setup.js, donde `fetch` y
 * `XMLHttpRequest` LANZAN (REQ-080).
 *
 * @format
 */

/**
 * Cabeceras en minusculas, que es como se consultan.
 *
 * @param {Record<string, string|number>} headers
 * @returns {Record<string, string>}
 */
function lowerKeys(headers) {
  return Object.keys(headers).reduce(
    (acc, key) => ({...acc, [key.toLowerCase()]: String(headers[key])}),
    {},
  );
}

/**
 * Respuesta con la forma que `downloadText` consume de `fetch`.
 *
 * @param {{status?: number, headers?: Record<string, string|number>, text?: string}} plan
 * @returns {Object}
 */
export function fakeResponse(plan = {}) {
  const status = plan.status ?? 200;
  const headers = lowerKeys(plan.headers ?? {});

  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {get: name => headers[String(name).toLowerCase()] ?? null},
    text: () => Promise.resolve(plan.text ?? ''),
  };
}

/**
 * `fetch` que responde una vez con lo que se le diga.
 *
 * @param {{status?: number, headers?: Record<string, string|number>, text?: string}} plan
 * @returns {jest.Mock}
 */
export function fakeFetch(plan) {
  return jest.fn(() => Promise.resolve(fakeResponse(plan)));
}

/**
 * `fetch` que falla como falla una red caida: rechaza con un `TypeError`, que es
 * lo que lanza el polyfill de React Native cuando no hay conexion.
 *
 * @returns {jest.Mock}
 */
export function failingFetch() {
  return jest.fn(() => Promise.reject(new TypeError('Network request failed')));
}

/**
 * `fetch` que NO responde nunca, y solo rechaza si se aborta su `signal`.
 *
 * Es el escenario del servidor que acepta la conexion y se queda callado: el unico
 * en el que el plazo tiene algo que hacer (REQ-046, REQ-060).
 *
 * @returns {jest.Mock}
 */
export function hangingFetch() {
  return jest.fn(
    (url, options) =>
      new Promise((_resolve, reject) => {
        options?.signal?.addEventListener?.('abort', () => {
          const error = new Error('Aborted');
          error.name = 'AbortError';
          reject(error);
        });
      }),
  );
}

/**
 * Instala un `XMLHttpRequest` falso y devuelve la lista de instancias creadas.
 *
 * El plan puede ser un objeto o una funcion de la URL, para escenarios donde cada
 * peticion responde distinto.
 *
 * @param {Object|((url: string) => Object)} scenario
 *   `{status, headers, body, networkError, timeout, hang}`
 * @returns {Array<Object>} las instancias, para poder afirmar sobre ellas
 */
export function installFakeXhr(scenario) {
  const created = [];

  class FakeXhr {
    constructor() {
      this.readyState = 0;
      this.status = 0;
      this.response = null;
      this.timeout = 0;
      this.responseType = '';
      this.aborted = false;
      this.headers = {};
      created.push(this);
    }

    open(method, url) {
      this.method = method;
      this.url = url;
    }

    getResponseHeader(name) {
      return this.headers[String(name).toLowerCase()] ?? null;
    }

    abort() {
      this.aborted = true;
      this.onabort?.();
    }

    send() {
      const plan = typeof scenario === 'function' ? scenario(this.url) : scenario;

      // Asincrono a proposito: en el real, los manejadores se enganchan despues de
      // `send()`, y un doble que responde de forma sincrona probaria otro orden.
      Promise.resolve()
        .then(() => {
          if (this.aborted || plan.hang) {
            return undefined;
          }

          if (plan.networkError) {
            this.onerror?.();
            return undefined;
          }

          if (plan.timeout) {
            this.ontimeout?.();
            return undefined;
          }

          this.status = plan.status ?? 200;
          this.headers = lowerKeys(plan.headers ?? {});
          this.readyState = 2;
          this.onreadystatechange?.();

          return Promise.resolve().then(() => {
            if (this.aborted) {
              return;
            }

            this.readyState = 4;
            this.response = plan.body ?? new Uint8Array(0);
            this.onload?.();
          });
        })
        .catch(() => {});
    }
  }

  global.XMLHttpRequest = FakeXhr;

  return created;
}
