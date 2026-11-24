/**
 * Tests de la validacion y derivacion de URLs de Google Sheets.
 *
 * Cubre REQ-011b, REQ-012, REQ-013, REQ-013b, REQ-013c, REQ-014 y REQ-015.
 *
 * @format
 */

import {
  MAX_NAME_LENGTH,
  MAX_URL_LENGTH,
  nameKey,
  toCsvUrl,
  validateName,
  validateSheetUrl,
} from '../src/sources/sourceUrl';

const ID = '1Hf36KxLKJtv5Ve6JVkRnbfpn_xYbJx2AnIT9svqbfPk';
const SHEET = `https://docs.google.com/spreadsheets/d/${ID}`;

describe('validateSheetUrl', () => {
  it('acepta la forma de edicion con gid (REQ-013)', () => {
    const result = validateSheetUrl(`${SHEET}/edit?gid=0#gid=0`);

    expect(result).toEqual({ok: true, url: `${SHEET}/edit?gid=0#gid=0`});
  });

  it('recorta espacios y saltos de linea de los extremos (REQ-013b)', () => {
    // Pegar desde una app de mensajeria arrastra esto con frecuencia.
    const result = validateSheetUrl(`  \n${SHEET}/edit\n `);

    expect(result).toEqual({ok: true, url: `${SHEET}/edit`});
  });

  it('rechaza la cadena vacia y la que solo tiene espacios', () => {
    expect(validateSheetUrl('')).toEqual({ok: false, reason: 'EMPTY'});
    expect(validateSheetUrl('   ')).toEqual({ok: false, reason: 'EMPTY'});
  });

  it('rechaza http:// aunque el resto sea correcto (REQ-013b)', () => {
    const result = validateSheetUrl(`http://docs.google.com/spreadsheets/d/${ID}/edit`);

    expect(result).toEqual({ok: false, reason: 'NOT_HTTPS'});
  });

  it('rechaza la hoja publicada en la web con su propio motivo (REQ-013c)', () => {
    // Pasa la comprobacion generica de "es una URL de Sheets" pero el endpoint
    // gviz no funciona sobre ella. Sin motivo propio, el usuario no sabria que
    // el problema es haber usado "Publicar en la web".
    const result = validateSheetUrl(
      'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ7x9/pubhtml',
    );

    expect(result).toEqual({ok: false, reason: 'PUBLISHED_URL'});
  });

  it('rechaza una URL de Drive (REQ-013)', () => {
    const result = validateSheetUrl(`https://drive.google.com/file/d/${ID}/view`);

    expect(result).toEqual({ok: false, reason: 'NOT_A_SHEET'});
  });

  it('rechaza texto que no es una URL', () => {
    expect(validateSheetUrl('hola')).toEqual({ok: false, reason: 'NOT_A_SHEET'});
  });

  it('rechaza un documento sin identificador', () => {
    const result = validateSheetUrl('https://docs.google.com/spreadsheets/d//edit');

    expect(result).toEqual({ok: false, reason: 'NOT_A_SHEET'});
  });

  it('rechaza por longitud, midiendo la cadena ya recortada (REQ-013b)', () => {
    const long = `${SHEET}/edit?x=${'a'.repeat(MAX_URL_LENGTH)}`;

    expect(validateSheetUrl(long)).toEqual({ok: false, reason: 'TOO_LONG'});
    // Justo en el limite, con espacios que no deben contar.
    const exact = `${SHEET}/edit`.padEnd(MAX_URL_LENGTH, 'x');
    expect(validateSheetUrl(`  ${exact}  `).ok).toBe(true);
  });
});

describe('toCsvUrl', () => {
  it('sustituye desde /edit por el endpoint gviz (REQ-014)', () => {
    expect(toCsvUrl(`${SHEET}/edit`)).toBe(`${SHEET}/gviz/tq?tqx=out:csv`);
  });

  it('conserva el gid de la query (REQ-015)', () => {
    expect(toCsvUrl(`${SHEET}/edit?gid=123`)).toBe(
      `${SHEET}/gviz/tq?tqx=out:csv&gid=123`,
    );
  });

  it('conserva el gid del fragmento (REQ-015)', () => {
    expect(toCsvUrl(`${SHEET}/edit#gid=456`)).toBe(
      `${SHEET}/gviz/tq?tqx=out:csv&gid=456`,
    );
  });

  it('con gid en ambos y distintos, manda el del fragmento (DD-008)', () => {
    // El navegador deja en el fragmento la pestana que estaba abierta al copiar;
    // el de la query puede venir de una navegacion anterior.
    expect(toCsvUrl(`${SHEET}/edit?gid=111#gid=222`)).toBe(
      `${SHEET}/gviz/tq?tqx=out:csv&gid=222`,
    );
  });

  it('con el mismo gid en ambos, lo conserva una sola vez', () => {
    expect(toCsvUrl(`${SHEET}/edit?gid=0#gid=0`)).toBe(
      `${SHEET}/gviz/tq?tqx=out:csv&gid=0`,
    );
  });

  it('sin gid, la derivada NO lleva el parametro (REQ-015)', () => {
    const csv = toCsvUrl(`${SHEET}/edit`);

    expect(csv).not.toContain('gid');
  });

  it('reconstruye la base desde el identificador, no recortando la cola', () => {
    // Todas estas formas apuntan al mismo documento y tienen que derivar en la
    // MISMA URL. Recortar por `/edit` dejaria `.../<ID>/view/gviz/...` en el
    // tercer caso, que no existe.
    expect(toCsvUrl(`${SHEET}`)).toBe(`${SHEET}/gviz/tq?tqx=out:csv`);
    expect(toCsvUrl(`${SHEET}/`)).toBe(`${SHEET}/gviz/tq?tqx=out:csv`);
    expect(toCsvUrl(`${SHEET}/view?usp=sharing`)).toBe(
      `${SHEET}/gviz/tq?tqx=out:csv`,
    );
    expect(toCsvUrl(`${SHEET}/edit?usp=sharing`)).toBe(
      `${SHEET}/gviz/tq?tqx=out:csv`,
    );
  });

  it('avisa si se le pasa una URL sin validar, en vez de devolver basura', () => {
    // Devolver una cadena rota en silencio acabaria guardandola en la base.
    expect(() => toCsvUrl('hola')).toThrow(/ya validada/);
  });

  it('el gid con varios digitos se conserva entero', () => {
    expect(toCsvUrl(`${SHEET}/edit?gid=871234#gid=871234`)).toBe(
      `${SHEET}/gviz/tq?tqx=out:csv&gid=871234`,
    );
  });
});

describe('nameKey', () => {
  it('recorta y baja a minusculas (REQ-012)', () => {
    expect(nameKey('  Aprendiz ')).toBe('aprendiz');
    expect(nameKey('APRENDIZ')).toBe('aprendiz');
  });

  it('respeta los acentos, que el lower() de SQLite no baja', () => {
    expect(nameKey('  Aprendíz ')).toBe(nameKey('APRENDÍZ'));
    expect(nameKey('APRENDÍZ')).toBe('aprendíz');
  });

  it('devuelve cadena vacia ante una entrada que no es texto', () => {
    expect(nameKey(undefined)).toBe('');
    expect(nameKey(null)).toBe('');
  });
});

describe('validateName', () => {
  it('acepta un nombre normal y lo devuelve recortado (REQ-011)', () => {
    expect(validateName('  Aprendiz ')).toEqual({ok: true, name: 'Aprendiz'});
  });

  it('rechaza el nombre vacio o solo con espacios (REQ-011)', () => {
    expect(validateName('')).toEqual({ok: false, reason: 'EMPTY'});
    expect(validateName('   ')).toEqual({ok: false, reason: 'EMPTY'});
  });

  it('rechaza por encima del limite (REQ-011b)', () => {
    expect(validateName('a'.repeat(MAX_NAME_LENGTH))).toEqual({
      ok: true,
      name: 'a'.repeat(MAX_NAME_LENGTH),
    });
    expect(validateName('a'.repeat(MAX_NAME_LENGTH + 1))).toEqual({
      ok: false,
      reason: 'TOO_LONG',
    });
  });
});

describe('aislamiento del modulo', () => {
  it('no depende de React, de la base ni de la red', () => {
    // El modulo se importa arriba sin mockear nada. Si algun dia importara
    // op-sqlite o React Native, este archivo dejaria de poder cargarse solo.
    expect(typeof validateSheetUrl).toBe('function');
    expect(typeof toCsvUrl).toBe('function');
  });
});
