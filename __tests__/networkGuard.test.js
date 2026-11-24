/**
 * Tests del guardia de red de `jest.setup.js`. REQ-080.
 *
 * Un guardia sin test es lo mismo que el cerrojo que no protegia nada: parece una
 * salvaguarda y nadie ha comprobado que actue. Esta suite comprueba que actua.
 *
 * @format
 */

describe('guardia de red (REQ-080)', () => {
  it('fetch LANZA, y su mensaje dice que hacer', () => {
    expect(() => fetch('https://ejemplo.org/x.csv')).toThrow(/REQ-080/);
    expect(() => fetch('https://ejemplo.org/x.csv')).toThrow(/deps\.net/);
  });

  it('instanciar XMLHttpRequest LANZA', () => {
    expect(() => new XMLHttpRequest()).toThrow(/REQ-080/);
  });

  it('el prototipo de XMLHttpRequest se puede INSPECCIONAR sin lanzar', () => {
    // El polyfill de `fetch` de React Native mira `'responseType' in xhr` y
    // similares. Si el global reventara al mirarlo y no al instanciarlo,
    // romperia modulos que no hacen ninguna peticion.
    expect(() => 'responseType' in XMLHttpRequest.prototype).not.toThrow();
    expect(typeof XMLHttpRequest).toBe('function');
  });

  it('un test puede sustituir el global cuando la peticion SI es esperada', () => {
    const original = global.fetch;

    global.fetch = jest.fn(() => Promise.resolve({ok: true}));

    expect(() => global.fetch('https://ejemplo.org')).not.toThrow();

    global.fetch = original;
    expect(() => fetch('https://ejemplo.org')).toThrow(/REQ-080/);
  });
});
