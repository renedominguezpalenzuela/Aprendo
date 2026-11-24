/**
 * Tests de src/decks/imageUrl.js. REQ-040.
 *
 * @format
 */

import {toImageUrl} from '../src/decks/imageUrl';

const ID = '1AbCdEfGhIjKlMnOpQrStUvWxYz';
const EXPECTED = `https://drive.google.com/uc?export=download&id=${ID}`;

describe('toImageUrl: enlaces de Drive en forma de pagina', () => {
  it('convierte la forma del fichero real', () => {
    expect(toImageUrl(`https://drive.google.com/file/d/${ID}/view?usp=sharing`)).toBe(
      EXPECTED,
    );
  });

  it('convierte /file/d/<ID>/view sin parametros y con otros', () => {
    expect(toImageUrl(`https://drive.google.com/file/d/${ID}/view`)).toBe(EXPECTED);
    expect(toImageUrl(`https://drive.google.com/file/d/${ID}/preview?x=1`)).toBe(
      EXPECTED,
    );
  });

  it('convierte las formas open?id= y uc?id=', () => {
    expect(toImageUrl(`https://drive.google.com/open?id=${ID}`)).toBe(EXPECTED);
    expect(toImageUrl(`https://drive.google.com/uc?id=${ID}&export=download`)).toBe(
      EXPECTED,
    );
  });

  it('RECONSTRUYE desde el identificador, no recorta la entrada', () => {
    // Con basura detras del /view, recortar por "/view" produciria
    // ".../view/basura/gviz/..." o similar. Reconstruir da lo mismo siempre.
    const messy = `https://drive.google.com/file/d/${ID}/view/basura/mas?usp=sharing#x`;

    expect(toImageUrl(messy)).toBe(EXPECTED);
  });

  it('acepta el host en mayusculas', () => {
    expect(toImageUrl(`HTTPS://DRIVE.GOOGLE.COM/file/d/${ID}/view`)).toBe(EXPECTED);
  });

  it('recorta espacios y saltos de linea de los extremos', () => {
    expect(toImageUrl(`  https://drive.google.com/file/d/${ID}/view\n`)).toBe(EXPECTED);
  });
});

describe('toImageUrl: URLs que ya son directas', () => {
  it('las devuelve SIN transformar', () => {
    const direct = 'https://ejemplo.org/diagramas/ciclo-del-agua.png';

    expect(toImageUrl(direct)).toBe(direct);
  });

  it('deja pasar una URL de Drive sin identificador reconocible', () => {
    // No se sabe que este mal, asi que no se descarta aca: si resulta ser HTML,
    // downloadBytes lo rechaza y la pregunta se guarda sin imagen (REQ-044).
    const folder = 'https://drive.google.com/drive/folders/abc';

    expect(toImageUrl(folder)).toBe(folder);
  });
});

describe('toImageUrl: celdas sin nada utilizable', () => {
  it('devuelve null, y no lanza, ante todo lo que no sea una URL https', () => {
    const rejected = [
      '',
      '   ',
      'pendiente',
      'ver el libro',
      `http://drive.google.com/file/d/${ID}/view`,
      'ftp://ejemplo.org/x.png',
      null,
      undefined,
      42,
      {},
    ];

    rejected.forEach(value => {
      expect(() => toImageUrl(value)).not.toThrow();
      expect(toImageUrl(value)).toBeNull();
    });
  });
});
