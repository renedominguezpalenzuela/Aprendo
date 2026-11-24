/**
 * Tests del codificador base64.
 *
 * Es codigo propio y pequeno, o sea el sitio exacto donde un error se cuela sin que
 * nada lo note: una imagen mal codificada no lanza, simplemente no se pinta. Asi que
 * se comprueba contra vectores conocidos Y contra el decodificador de Node, que hace
 * de segunda opinion independiente.
 *
 * Ver specs/features/deck-sync/design.md seccion 2.13b.
 *
 * @format
 */

import {toBase64, toDataUri} from '../src/net/base64';

/**
 * @param {string} text
 * @returns {Uint8Array}
 */
function bytesOf(text) {
  return new Uint8Array(global.Buffer.from(text, 'utf8'));
}

describe('toBase64: los tres rellenos posibles', () => {
  it('sin relleno: longitud multiplo de tres', () => {
    // "Man" son 3 bytes -> 4 caracteres, sin "=".
    expect(toBase64(bytesOf('Man'))).toBe('TWFu');
    expect(toBase64(bytesOf('sure.'))).toBe('c3VyZS4=');
  });

  it('un byte de cola: DOS signos de igual', () => {
    expect(toBase64(bytesOf('M'))).toBe('TQ==');
    expect(toBase64(bytesOf('any carnal pleasure.'))).toBe(
      'YW55IGNhcm5hbCBwbGVhc3VyZS4=',
    );
  });

  it('dos bytes de cola: UN signo de igual', () => {
    expect(toBase64(bytesOf('Ma'))).toBe('TWE=');
    expect(toBase64(bytesOf('any carnal pleasur'))).toBe('YW55IGNhcm5hbCBwbGVhc3Vy');
  });

  it('los vectores clasicos de la especificacion, los cinco', () => {
    // Del RFC 4648 §10: cubren los tres rellenos en orden.
    expect(toBase64(bytesOf('f'))).toBe('Zg==');
    expect(toBase64(bytesOf('fo'))).toBe('Zm8=');
    expect(toBase64(bytesOf('foo'))).toBe('Zm9v');
    expect(toBase64(bytesOf('foob'))).toBe('Zm9vYg==');
    expect(toBase64(bytesOf('fooba'))).toBe('Zm9vYmE=');
    expect(toBase64(bytesOf('foobar'))).toBe('Zm9vYmFy');
  });
});

describe('toBase64: contra el decodificador de Node', () => {
  it('los 256 valores de un byte, ida y vuelta exacta', () => {
    const bytes = new Uint8Array(256);

    for (let i = 0; i < 256; i += 1) {
      bytes[i] = i;
    }

    const encoded = toBase64(bytes);
    const decoded = new Uint8Array(global.Buffer.from(encoded, 'base64'));

    // Cada valor posible de un byte, incluidos 0 y 255, que son los que una
    // conversion descuidada convierte en otra cosa.
    expect(decoded.byteLength).toBe(256);
    expect(Array.from(decoded)).toEqual(Array.from(bytes));
    expect(encoded).toBe(global.Buffer.from(bytes).toString('base64'));
  });

  it('coincide con Node para longitudes de 0 a 100 bytes', () => {
    // Barre los tres restos de la division por tres muchas veces: si el caso de la
    // cola estuviera mal, aqui salta.
    for (let length = 0; length <= 100; length += 1) {
      const bytes = new Uint8Array(length);

      for (let i = 0; i < length; i += 1) {
        bytes[i] = (i * 7 + 13) % 256;
      }

      expect(toBase64(bytes)).toBe(global.Buffer.from(bytes).toString('base64'));
    }
  });

  it('cruza el limite del troceado interno sin costura', () => {
    // El codificador cierra un trozo cada 1024 grupos de tres bytes. Se prueba justo
    // por encima para que el corte caiga en medio.
    const length = 1024 * 3 + 5;
    const bytes = new Uint8Array(length);

    for (let i = 0; i < length; i += 1) {
      bytes[i] = (i * 31) % 256;
    }

    expect(toBase64(bytes)).toBe(global.Buffer.from(bytes).toString('base64'));
  });

  it('una imagen del tamano del tope, sin desviarse ni un caracter', () => {
    const bytes = new Uint8Array(1024 * 1024);

    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = (i * 17 + 3) % 256;
    }

    const encoded = toBase64(bytes);

    expect(encoded).toBe(global.Buffer.from(bytes).toString('base64'));
    // 1 MB codificado son ~1,33 MB: el 33 % que este delta paga a cambio de no
    // codificar nunca al pintar.
    expect(encoded.length).toBeGreaterThan(1024 * 1024 * 1.33);
    expect(encoded.length).toBeLessThan(1024 * 1024 * 1.34);
  });
});

describe('toBase64: entradas degeneradas', () => {
  it('un array vacio da cadena vacia', () => {
    expect(toBase64(new Uint8Array(0))).toBe('');
  });

  it('null y undefined no lanzan', () => {
    expect(() => toBase64(null)).not.toThrow();
    expect(toBase64(null)).toBe('');
    expect(toBase64(undefined)).toBe('');
  });
});

describe('toDataUri', () => {
  it('construye el prefijo que espera <Image>', () => {
    const uri = toDataUri('image/jpeg', bytesOf('Man'));

    expect(uri).toBe('data:image/jpeg;base64,TWFu');
    expect(uri.startsWith('data:image/')).toBe(true);
  });

  it('el mime viaja dentro, asi que la cadena se explica sola', () => {
    expect(toDataUri('image/png', new Uint8Array([1, 2, 3]))).toMatch(
      /^data:image\/png;base64,/,
    );
  });
});
