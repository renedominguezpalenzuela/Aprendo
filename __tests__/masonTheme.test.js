/**
 * Tests de los tokens visuales. DELTA-003 y DD-022.
 *
 * El contraste de la paleta se prueba aparte, en `masonTheme.contrast.test.js`.
 *
 * @format
 */

import {
  CARD_TEXT_STEPS,
  cardTextStep,
  FONT,
  LAYOUT,
  TYPE,
} from '../src/theme/masonTheme';

const [GRANDE, MEDIO, PEQUENO] = CARD_TEXT_STEPS;

describe('cardTextStep', () => {
  // La tabla mira LOS SALTOS y no los medios: un test en 40 y otro en 200 pasaria con los
  // umbrales puestos en cualquier sitio entre medias.
  it.each([
    [0, GRANDE, 'un texto vacio cae en el grande'],
    [1, GRANDE, 'un caracter'],
    [79, GRANDE, 'justo por debajo del primer umbral'],
    [80, GRANDE, 'EN el primer umbral: cae en el grande, no en el medio'],
    [81, MEDIO, 'justo por encima del primer umbral'],
    [159, MEDIO, 'justo por debajo del segundo umbral'],
    [160, MEDIO, 'EN el segundo umbral: cae en el medio, no en el pequeno'],
    [161, PEQUENO, 'justo por encima del segundo umbral'],
    [5000, PEQUENO, 'un texto absurdamente largo'],
  ])('cardTextStep(%i) → %#: %s', (length, expected) => {
    expect(cardTextStep(length)).toBe(expected);
  });

  // Degradado seguro: texto mas chico cabe siempre, asi que ante una entrada absurda se
  // elige el pequeno en vez de lanzar. Es un modulo de presentacion, no un validador.
  it.each([
    [NaN, 'NaN'],
    [-1, 'un negativo'],
    [-Infinity, 'menos infinito'],
  ])('devuelve el escalon pequeno para %p (%s), sin lanzar', length => {
    expect(cardTextStep(length)).toBe(PEQUENO);
  });

  it('devuelve SIEMPRE la misma referencia, no un objeto nuevo por llamada', () => {
    // Si devolviera un objeto nuevo, cada render de QuestionCard crearia un estilo
    // distinto y React Native no podria reconocerlo como el mismo.
    expect(cardTextStep(10)).toBe(cardTextStep(20));
  });
});

describe('CARD_TEXT_STEPS', () => {
  it('tiene tres escalones', () => {
    expect(CARD_TEXT_STEPS).toHaveLength(3);
  });

  it('va de mayor a menor, sin empates', () => {
    const sizes = CARD_TEXT_STEPS.map(step => step.text.fontSize);

    expect(sizes).toEqual([...sizes].sort((a, b) => b - a));
    expect(new Set(sizes).size).toBe(sizes.length);
  });

  // LO IMPORTANTE de la estructura: `Respuesta2` CONTINUA a `Respuesta1`, asi que en NINGUN
  // escalon puede salir mas grande que ella. Con `secondary` fijado en un tamano absoluto
  // —como estaba antes del delta— en el escalon pequeno se invertiria la jerarquia.
  it.each([
    ['grande', GRANDE],
    ['medio', MEDIO],
    ['pequeno', PEQUENO],
  ])('en el escalon %s la continuacion es mas pequena que el texto', (_name, step) => {
    expect(step.secondary.fontSize).toBeLessThan(step.text.fontSize);
  });

  it('la continuacion tambien decrece de escalon en escalon', () => {
    const sizes = CARD_TEXT_STEPS.map(step => step.secondary.fontSize);

    expect(sizes).toEqual([...sizes].sort((a, b) => b - a));
  });

  it.each([
    ['grande', GRANDE],
    ['medio', MEDIO],
    ['pequeno', PEQUENO],
  ])('el escalon %s lleva lineHeight en dp ABSOLUTOS, no un multiplicador', (_name, step) => {
    // React Native no acepta multiplicadores. Un 1.2 aqui se interpretaria como 1.2 dp de
    // alto de linea y el texto se solaparia consigo mismo.
    for (const style of [step.text, step.secondary]) {
      expect(style.lineHeight).toBeGreaterThan(style.fontSize);
    }
  });

  it('no declara fontWeight en ninguno', () => {
    // La familia ya trae el peso; pedir un peso encima produce sintetizado inconsistente
    // entre plataformas (DD-007).
    for (const step of CARD_TEXT_STEPS) {
      expect(step.text.fontWeight).toBeUndefined();
      expect(step.secondary.fontWeight).toBeUndefined();
    }
  });
});

describe('los tokens que el delta retiro', () => {
  it('`cardText` y `cardTextSecondary` ya no son estilos fijos', () => {
    // Si alguien los reintroduce, `QuestionCard` podria volver a un tamano unico sin que
    // nada avisara. Este test es lo que avisa.
    expect(TYPE.cardText).toBeUndefined();
    expect(TYPE.cardTextSecondary).toBeUndefined();
  });
});

describe('LAYOUT', () => {
  it('tiene los tres radios, de mayor a menor', () => {
    expect(LAYOUT.radiusCard).toBeGreaterThan(LAYOUT.radiusSurface);
    expect(LAYOUT.radiusSurface).toBeGreaterThan(LAYOUT.radiusControl);
  });

  it('el filete de la respuesta es mas GRUESO que el de la pregunta', () => {
    // Es la diferencia no cromatica de DD-023: sin ella, la senal de cara seria solo de
    // color, y los dos filetes casi no se distinguen por luminosidad.
    expect(LAYOUT.ruleHeightAnswer).toBeGreaterThan(1);
  });
});

describe('los rotulos condensados (DELTA-006)', () => {
  // Una REGLA, no una foto de los valores de hoy. La foto se actualiza sin pensar cuando
  // rompe; la regla obliga a justificar por que un rotulo vuelve a ser ilegible.
  //
  // El problema que arregla el delta no era de contraste sino de FORMA: condensada +
  // diminuta + muy espaciada es la peor combinacion para leer, y era el texto que mas se
  // repite en la app. Sin esto, nada impide que el proximo rotulo nazca a 10 px con 0.34 em.
  const labels = Object.entries(TYPE).filter(
    ([, style]) => style.fontFamily === FONT.label,
  );

  it('hay rotulos que comprobar', () => {
    // Si el filtro deja de encontrar nada —porque cambia el nombre de la familia, por
    // ejemplo— los `it.each` de abajo pasarian vacios y en verde sin comprobar nada.
    expect(labels.length).toBeGreaterThan(5);
  });

  it.each(labels)('%s no baja de 12 px', (_name, style) => {
    expect(style.fontSize).toBeGreaterThanOrEqual(12);
  });

  it.each(labels)('%s no pasa de 0.16 em de tracking', (_name, style) => {
    // `letterSpacing` va en dp, asi que el em se recupera dividiendo por el tamano. El
    // tope de 0.16 deja pasar los 0.14 em del delta con margen y corta los 0.34 de antes.
    const em = (style.letterSpacing ?? 0) / style.fontSize;

    expect(em).toBeLessThanOrEqual(0.16);
  });
});

describe('los radios (DELTA-008)', () => {
  it('los tres existen y ninguno es cero', () => {
    // Las esquinas rectas eran el aspecto de antes del delta. Si alguien pone un radio a 0
    // «para simplificar», esto lo dice.
    for (const key of ['radiusCard', 'radiusSurface', 'radiusControl']) {
      expect(LAYOUT[key]).toBeGreaterThan(0);
    }
  });
});
