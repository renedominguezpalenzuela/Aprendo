/**
 * Tests de una cara de la tarjeta.
 *
 * REQ-017, REQ-018, REQ-028, REQ-034b, REQ-038 y REQ-039.
 *
 * @format
 */

import React from 'react';
import {Image, Pressable, ScrollView, Text, View} from 'react-native';
import {act, create} from 'react-test-renderer';

import {openDatabase, resetDatabaseForTests} from '../src/db/database';
import {insertPendingImage, promoteDeck} from '../src/decks/decksRepo';
import {CARD} from '../src/decks/decksCopy';
import {QuestionCard} from '../src/decks/QuestionCard';
import {CARD_TEXT_STEPS, COLOR, LAYOUT} from '../src/theme/masonTheme';
import {makeMemoryDriver} from './support/nodeSqliteDriver';

/** @type {import('../src/db/database').Driver} */
let db;

/** Una pregunta sin imágenes ni continuación: el caso de la fila 1 del fichero real. */
const SIMPLE = {
  id: 1,
  position: 0,
  question: 'Cuántos días tiene una semana',
  answer1: 'Una Semana Tiene 7 días',
  answer2: null,
  imageQuestionId: null,
  imageAnswerId: null,
};

beforeEach(() => {
  resetDatabaseForTests();
  db = openDatabase(makeMemoryDriver()).db;

  db.executeSync(
    `INSERT INTO sources (name, name_key, url_original, url_csv, is_active, created_at)
     VALUES ('S', 's', 'u', 'c', 1, 1)`,
  );
});

/** @returns {number} el id de una imagen guardada */
function seedImage(mime = 'image/png') {
  const id = insertPendingImage(1, {
    url: 'https://x/y.png',
    mime,
    bytes: new Uint8Array([1, 2, 3, 4]),
  });

  promoteDeck(1, 1000);

  return id;
}

/**
 * @param {Object} [props]
 * @returns {any}
 */
function render(props = {}) {
  let renderer;

  act(() => {
    renderer = create(
      <QuestionCard
        position={1}
        face="question"
        question={SIMPLE}
        onTurn={() => {}}
        {...props}
      />,
    );
  });

  return renderer;
}

/** @param {any} renderer @returns {string[]} */
function texts(renderer) {
  return renderer.root
    .findAllByType(Text)
    .map(node => node.props.children)
    .filter(child => typeof child === 'string');
}

/** @param {any} style @returns {Record<string, any>} */
function flatten(style) {
  if (Array.isArray(style)) {
    return style.reduce((acc, item) => ({...acc, ...flatten(item)}), {});
  }

  return style ?? {};
}

/**
 * LA RAIZ DE LA TARJETA: el nodo que expone la cara entera al lector de pantalla.
 *
 * Se busca por la ETIQUETA y no por el tipo, y eso es deliberado: hasta el delta del gesto
 * era el `Pressable` de la tarjeta, y ahora es una `View` —la raiz dejo de ser accionable,
 * ver DD-030—. Buscar por etiqueta es lo que hace que estas pruebas no dependan de cual de
 * los dos sea.
 *
 * `{deep: false}` devuelve el mas EXTERNO y no sus hijos, que heredan las props al pintarse.
 *
 * @param {any} renderer
 * @returns {any}
 */
function faceNode(renderer) {
  const [outermost] = renderer.root.findAll(
    node => String(node.props?.accessibilityLabel ?? '').includes('Nº 01'),
    {deep: false},
  );

  return outermost;
}

/**
 * EL BOTON DE GIRAR, en el pie. El unico elemento accionable de la cara (GESTO-002).
 *
 * @param {any} renderer
 * @returns {any}
 */
function turnButton(renderer) {
  return renderer.root.findByType(Pressable);
}

describe('anverso (REQ-017)', () => {
  it('muestra el numero con dos digitos, la pregunta y la indicacion', () => {
    const shown = texts(render());

    expect(shown).toContain('Nº 01');
    expect(shown).toContain('Cuántos días tiene una semana');
    expect(shown).toContain(CARD.turnToAnswer.toUpperCase());
  });

  it('NO muestra rotulo de grado ni hueco donde estaria', () => {
    const shown = texts(render()).join(' ');

    expect(shown).not.toMatch(/grado|nivel|dificultad/i);
    // Tres textos exactos —numero, pregunta e indicacion— y ninguno vacio.
    expect(texts(render())).toHaveLength(3);
  });

  it('no muestra la respuesta', () => {
    expect(texts(render()).join(' ')).not.toContain('Una Semana Tiene 7 días');
  });
});

describe('reverso (REQ-018)', () => {
  it('muestra Respuesta Nº, la respuesta y la indicacion de volver', () => {
    const shown = texts(render({face: 'answer'}));

    expect(shown.join(' ')).toContain('RESPUESTA Nº 01');
    expect(shown).toContain('Una Semana Tiene 7 días');
    expect(shown).toContain(CARD.turnToQuestion.toUpperCase());
  });

  it('muestra la continuacion DEBAJO cuando la hay', () => {
    const question = {...SIMPLE, answer2: 'El primer día depende del criterio'};
    const shown = texts(render({face: 'answer', question}));

    const principal = shown.indexOf('Una Semana Tiene 7 días');
    const continuacion = shown.indexOf('El primer día depende del criterio');

    expect(continuacion).toBeGreaterThan(principal);
  });

  it('sin continuacion NO renderiza un texto vacio', () => {
    const renderer = render({face: 'answer'});

    // Un parrafo en blanco se lee como si faltara algo.
    expect(texts(renderer).filter(t => t.trim() === '')).toHaveLength(0);
  });

  it('la continuacion se distingue de la respuesta principal', () => {
    const question = {...SIMPLE, answer2: 'Continuación'};
    const renderer = render({face: 'answer', question});

    const nodes = renderer.root.findAllByType(Text);
    const principal = nodes.find(n => n.props.children === 'Una Semana Tiene 7 días');
    const continuacion = nodes.find(n => n.props.children === 'Continuación');

    // `deck-sync` REQ-028: es continuacion, no una respuesta alternativa, y la
    // jerarquia tiene que decirlo sin que haya que leerlo.
    expect(flatten(continuacion.props.style).fontSize).toBeLessThan(
      flatten(principal.props.style).fontSize,
    );
  });

  it('NO muestra rotulo de fuente', () => {
    expect(texts(render({face: 'answer'})).join(' ')).not.toMatch(/fuente|origen/i);
  });
});

describe('el giro (REQ-018)', () => {
  it('activar el boton del pie llama a onTurn una sola vez', () => {
    const onTurn = jest.fn();
    const renderer = render({onTurn});

    act(() => turnButton(renderer).props.onPress());

    expect(onTurn).toHaveBeenCalledTimes(1);
  });

  it('la cara NO lleva transformaciones propias: el giro es del contenedor (DD-017)', () => {
    // La raiz ya no es accionable, asi que su `style` es un objeto y no una funcion de
    // `{pressed}`: el estado de pulsacion se fue con ella (GESTO-006).
    const style = flatten(faceNode(render()).props.style);

    expect(style.transform).toBeUndefined();
  });
});

describe('imagenes (REQ-038, REQ-039)', () => {
  it('pinta la imagen del anverso cuando la hay', () => {
    const imageId = seedImage();
    const renderer = render({question: {...SIMPLE, imageQuestionId: imageId}});

    const image = renderer.root.findByType(Image);

    expect(image.props.source.uri.startsWith('data:image/png;base64,')).toBe(true);
  });

  it('usa la imagen del REVERSO en el reverso, no la del anverso', () => {
    const anverso = seedImage('image/png');
    const reverso = insertPendingImage(1, {
      url: 'https://x/z.jpg',
      mime: 'image/jpeg',
      bytes: new Uint8Array([9]),
    });

    promoteDeck(1, 2000);

    const renderer = render({
      face: 'answer',
      question: {...SIMPLE, imageQuestionId: anverso, imageAnswerId: reverso},
    });

    expect(renderer.root.findByType(Image).props.source.uri).toMatch(/image\/jpeg/);
  });

  it('sin imagen NO pinta nada: ni icono de error ni hueco (REQ-038)', () => {
    const renderer = render();

    expect(renderer.root.findAllByType(Image)).toHaveLength(0);
    // Y el boton de girar sigue ahi: la ausencia de imagen no bloquea el giro.
    expect(renderer.root.findAllByType(Pressable)).toHaveLength(1);
  });

  it('respeta la proporcion y acota el alto (REQ-039)', () => {
    const imageId = seedImage();
    const renderer = render({question: {...SIMPLE, imageQuestionId: imageId}});
    const image = renderer.root.findByType(Image);
    const style = flatten(image.props.style);

    expect(image.props.resizeMode).toBe('contain');
    expect(style.width).toBe('100%');
    expect(style.height).toBe(LAYOUT.cardImageMaxHeight);
  });
});

describe('accesibilidad (REQ-028)', () => {
  it('la cara es UN solo elemento accionable, con su contenido en la etiqueta', () => {
    const face = faceNode(render());

    expect(face.props.accessible).toBe(true);
    expect(face.props.accessibilityRole).toBe('button');
    expect(face.props.accessibilityLabel).toContain('Nº 01');
    expect(face.props.accessibilityLabel).toContain('Cuántos días tiene una semana');
  });

  it('el boton del pie NO se expone como un segundo nodo', () => {
    // Es lo unico pulsable, y aun asi se oculta al lector: la raiz ya expone la cara entera
    // como boton, y dejar este visible daria DOS nodos donde REQ-028 exige uno.
    const button = turnButton(render());

    expect(button.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(button.props.accessibilityElementsHidden).toBe(true);
  });

  it('la pista dice que se GIRA', () => {
    expect(faceNode(render()).props.accessibilityHint).toMatch(/girar/i);
  });

  it('los textos interiores quedan ocultos al lector, para no oirlos sueltos', () => {
    const scroll = render().root.findByType(ScrollView);

    expect(scroll.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(scroll.props.accessibilityElementsHidden).toBe(true);
  });
});

describe('escalado del texto (REQ-034b)', () => {
  it('el cuerpo va en un ScrollView y el numero y la indicacion quedan FUERA', () => {
    const renderer = render();
    const scroll = renderer.root.findByType(ScrollView);
    const dentro = scroll
      .findAllByType(Text)
      .map(n => n.props.children)
      .filter(c => typeof c === 'string');

    // El numero y la indicacion tienen que seguir viendose con el texto al maximo,
    // asi que no pueden estar en el area que se desplaza.
    expect(dentro).toContain('Cuántos días tiene una semana');
    expect(dentro).not.toContain(CARD.turnToAnswer.toUpperCase());
    expect(dentro.some(t => t.includes('01'))).toBe(false);
  });

  it('la tarjeta NO fija altura', () => {
    // Se lee de la RAIZ, no del primer `Pressable` que aparezca: el boton del pie SI fija
    // `minHeight: 36` (DD-032), y leerlo por error hacia pasar esta prueba por lo contrario
    // de lo que dice.
    const style = flatten(faceNode(render()).props.style);

    expect(style.height).toBeUndefined();
    expect(style.minHeight).toBeUndefined();
    expect(style.maxHeight).toBeUndefined();
  });
});

// ── Delta: apariencia moderna y legible ───────────────────────────────────────

const [GRANDE, MEDIO, PEQUENO] = CARD_TEXT_STEPS;

/** @returns {Object} el estilo aplanado de la tarjeta */
function cardStyle(renderer) {
  return flatten(faceNode(renderer).props.style);
}

/**
 * El filete: la unica `View` de 34 dp de ancho que hay dentro de la tarjeta.
 *
 * @returns {Object} su estilo aplanado
 */
function ruleStyle(renderer) {
  const rules = renderer.root
    .findAllByType(View)
    .map(node => flatten(node.props.style))
    .filter(style => style?.width === LAYOUT.ruleWidth);

  expect(rules).toHaveLength(1);

  return rules[0];
}

describe('la superficie de papel (DELTA-001)', () => {
  // ESTA ES LA ASERCION QUE FALTABA. Sin ella se borraron `COLOR.card` y `COLOR.cardBorder`
  // y la suite entera siguio en verde con la tarjeta pintando `backgroundColor: undefined`:
  // React Native acepta undefined en un estilo sin protestar. Es DD-014 de `splash-screen`.
  // El canto YA NO es el mismo en las dos caras: el reverso lo lleva en dorado claro y mas
  // grueso. Va como parametro del caso, no como valor comun, para que siga siendo UNA prueba
  // y no se pierda la aserción de superficie —la que faltaba cuando se borro `COLOR.card` y
  // la suite entera siguio verde con la tarjeta sin fondo—.
  it.each([
    ['question', COLOR.paperBorder],
    ['answer', COLOR.goldBright],
  ])('la cara %s se pinta sobre papel, con su canto y su radio', (face, canto) => {
    const style = cardStyle(render({face}));

    expect(style.backgroundColor).toBe(COLOR.paper);
    expect(style.borderColor).toBe(canto);
    expect(style.borderRadius).toBe(LAYOUT.radiusCard);
  });

  it('la tarjeta esta ELEVADA en las dos plataformas', () => {
    const style = cardStyle(render());

    // REQ-024 tolera que la sombra DIFIERA entre iOS y Android (DD-026); lo que no tolera
    // es que falte en una. `elevation` es lo unico que lee Android y `shadowOpacity` lo
    // unico que lee iOS, asi que se exigen los dos.
    expect(style.elevation).toBeGreaterThan(0);
    expect(style.shadowOpacity).toBeGreaterThan(0);
  });

  it('NINGUNA medida de la tarjeta fija su altura (REQ-034b)', () => {
    const style = cardStyle(render());

    for (const key of ['height', 'minHeight', 'maxHeight']) {
      expect(style[key]).toBeUndefined();
    }
  });
});

describe('el filete distingue la cara (DELTA-002, DD-023)', () => {
  it('en la pregunta es gris calido y fino', () => {
    const style = ruleStyle(render({face: 'question'}));

    expect(style.backgroundColor).toBe(COLOR.paperRule);
    expect(style.height).toBe(1);
  });

  it('en la respuesta es oro y MAS GRUESO', () => {
    const style = ruleStyle(render({face: 'answer'}));

    expect(style.backgroundColor).toBe(COLOR.paperRuleAnswer);
    expect(style.height).toBe(LAYOUT.ruleHeightAnswer);
  });

  it('la diferencia NO es solo de color: tambien de grosor', () => {
    // Los dos filetes casi no se distinguen por luminosidad —lo prueba
    // masonTheme.contrast.test.js—, asi que el grosor es lo que evita que la senal dependa
    // de distinguir el oro del gris calido. Si alguien igualara las alturas, cae este test.
    const pregunta = ruleStyle(render({face: 'question'}));
    const respuesta = ruleStyle(render({face: 'answer'}));

    expect(respuesta.height).not.toBe(pregunta.height);
  });

  it('el ENCABEZADO sigue diciendo la cara sin ayuda del filete', () => {
    // La senal accesible principal (DD-023). Se comprueba que el texto basta: es lo que
    // queda para quien no distingue los dos matices.
    expect(texts(render({face: 'question'})).join(' ')).toContain('Nº 01');
    expect(texts(render({face: 'answer'})).join(' ')).toContain('RESPUESTA Nº 01');
  });
});

describe('el texto se adapta a su longitud (DELTA-003)', () => {
  /**
   * @param {string} text
   * @returns {string} un texto de exactamente `length` caracteres
   */
  function ofLength(length, filler = 'a') {
    return filler.repeat(length);
  }

  /** @returns {Object} el estilo del texto principal de la cara */
  function bodyStyle(renderer, content) {
    const node = renderer.root
      .findAllByType(Text)
      .find(n => n.props.children === content);

    return flatten(node.props.style);
  }

  it.each([
    [40, GRANDE, 'grande'],
    [120, MEDIO, 'medio'],
    [400, PEQUENO, 'pequeno'],
  ])('una pregunta de %i caracteres usa el escalon %#: %s', (length, expected) => {
    const question = {...SIMPLE, question: ofLength(length)};
    const style = bodyStyle(render({question}), ofLength(length));

    expect(style.fontSize).toBe(expected.text.fontSize);
  });

  it('el reverso mide la SUMA de las dos respuestas, no solo la primera', () => {
    // 60 + 60 = 120 caracteres: `answer1` sola caeria en el escalon GRANDE y el cuerpo
    // entero cae en el MEDIO. Es el caso que distingue sumar de no sumar.
    const answer1 = ofLength(60, 'a');
    const answer2 = ofLength(60, 'b');
    const question = {...SIMPLE, answer1, answer2};

    const style = bodyStyle(render({face: 'answer', question}), answer1);

    expect(style.fontSize).toBe(MEDIO.text.fontSize);
    expect(style.fontSize).not.toBe(GRANDE.text.fontSize);
  });

  it('la continuacion baja de escalon CON la respuesta', () => {
    // Contenido DISTINTO y longitud IGUAL: si fueran identicos, `bodyStyle` encontraria el
    // mismo nodo las dos veces y la asercion se compararia consigo misma. Costo un fallo.
    const answer1 = ofLength(60, 'a');
    const answer2 = ofLength(60, 'b');
    const question = {...SIMPLE, answer1, answer2};
    const renderer = render({face: 'answer', question});

    const principal = bodyStyle(renderer, answer1);
    const continuacion = bodyStyle(renderer, answer2);

    // Sigue siendo menor que la principal —es continuacion, no alternativa— Y esta en el
    // mismo escalon que ella, no en un tamano absoluto.
    expect(continuacion.fontSize).toBeLessThan(principal.fontSize);
    expect(continuacion.fontSize).toBe(MEDIO.secondary.fontSize);
  });

  it('el escalon lo decide el TEXTO, no el ajuste de tamano del sistema (DD-022)', () => {
    // El `fontSize` que se declara es el BASE: el sistema multiplica encima, en tiempo de
    // pintado. Si algun dia se eligiera el escalon a partir del tamano ya escalado, habria
    // realimentacion y este test caeria.
    const question = {...SIMPLE, question: ofLength(40)};
    const style = bodyStyle(render({question}), ofLength(40));

    expect(style.fontSize).toBe(GRANDE.text.fontSize);
    expect(style.allowFontScaling).toBeUndefined();
  });
});

// ── Delta: el gesto de la tarjeta ─────────────────────────────────────────────
//
// LAS TRES ASERCIONES QUE SUJETAN EL ARREGLO, y son lo unico de ese delta que un test puede
// sujetar. El resto —que el arrastre desplace— no lo puede ver ninguna asercion de arbol, y
// por eso el defecto vivio con esta suite EN VERDE: los tests decian que el `ScrollView`
// existe y que el encabezado y el pie quedan fuera, y las dos cosas eran ciertas con el
// desplazamiento inalcanzable. Es DD-014 de `splash-screen`.

describe('el gesto: el cuerpo se desplaza y el pie gira (GESTO-001, GESTO-002)', () => {
  it('la raiz que expone la cara NO es accionable (DD-030)', () => {
    const renderer = render();
    const face = faceNode(renderer);

    // Mientras la raiz sea accionable, su rectangulo de pulsacion es la tarjeta ENTERA y el
    // `ScrollView` no llega a ver el arrastre. Esta asercion ES el arreglo, y es la que
    // alguien deshara sin querer al «arreglar» que la tarjeta no responda al toque.
    expect(face.props.onPress).toBeUndefined();
    expect(renderer.root.findAllByType(Pressable).includes(face)).toBe(false);
  });

  it('el UNICO elemento accionable es el del pie, y activarlo gira', () => {
    const onTurn = jest.fn();
    const renderer = render({onTurn});

    const actionables = renderer.root.findAllByType(Pressable);

    expect(actionables).toHaveLength(1);

    // Localizado por su COPIA VISIBLE y no por `testID`: en este repo `testID` no se usa ni
    // una vez. Y se exige que lleve SOLO la indicacion: si arrastra consigo la pregunta y el
    // numero, es que el accionable sigue siendo la tarjeta entera.
    const inside = actionables[0]
      .findAllByType(Text)
      .map(node => node.props.children)
      .filter(child => typeof child === 'string');

    expect(inside).toEqual([CARD.turnToAnswer.toUpperCase()]);

    act(() => actionables[0].props.onPress());

    expect(onTurn).toHaveBeenCalledTimes(1);
  });

  it('la activacion por lector de pantalla esta declarada y gira (DD-031)', () => {
    const onTurn = jest.fn();
    const renderer = render({onTurn});
    const face = faceNode(renderer);

    // Al dejar de ser `Pressable` la raiz PERDIO la activacion por doble toque, y
    // `onAccessibilityTap` no la devuelve: es solo de iOS. Sin esto, Android se queda sin
    // girar y ninguna otra asercion se enteraria.
    expect(face.props.accessibilityActions).toEqual([{name: 'activate'}]);

    act(() =>
      face.props.onAccessibilityAction({nativeEvent: {actionName: 'activate'}}),
    );

    expect(onTurn).toHaveBeenCalledTimes(1);
  });

  it('y NO gira con una accion que no sea activate', () => {
    // El filtro por `actionName` existe porque el sistema puede enviar otras acciones
    // —`increment`, `escape`, las que declare el sistema operativo— y girar la tarjeta con
    // cualquiera de ellas seria un giro que el usuario no pidio. Sin esta prueba la rama
    // negativa del `if` no se ejecuta nunca: la cobertura de ramas se quedaba en el 95%.
    const onTurn = jest.fn();
    const face = faceNode(render({onTurn}));

    act(() =>
      face.props.onAccessibilityAction({nativeEvent: {actionName: 'increment'}}),
    );

    expect(onTurn).not.toHaveBeenCalled();
  });
});

describe('el boton de girar: discreto a la vista, comodo al dedo (GESTO-003, GESTO-004)', () => {
  it('se ve pulsable: canto fino y radio de control', () => {
    const style = flatten(turnButton(render()).props.style({pressed: false}));

    expect(style.borderWidth).toBe(1);
    expect(style.borderColor).toBe(COLOR.paperBorder);
    expect(style.borderRadius).toBe(LAYOUT.radiusControl);
  });

  it('y DISCRETO: sin relleno de color y sin sombra propia', () => {
    const style = flatten(turnButton(render()).props.style({pressed: false}));

    // El texto de la tarjeta sigue siendo el elemento dominante (REQ-039). Y dos elevaciones
    // anidadas —la tarjeta y el boton— se leen como un error de pintado, no como jerarquia.
    expect(style.backgroundColor).toBeUndefined();
    expect(style.elevation).toBeUndefined();
    expect(style.shadowOpacity).toBeUndefined();
  });

  it('el area de toque llega a 48 dp aunque se vean 36', () => {
    const button = turnButton(render());
    const style = flatten(button.props.style({pressed: false}));

    // Son DOS medidas distintas a proposito (DD-032): un canto de 48 dp de alto sobre papel
    // no seria discreto. El resto lo pone el `hitSlop`.
    expect(style.minHeight).toBe(36);
    expect(style.minHeight + button.props.hitSlop.bottom).toBeGreaterThanOrEqual(48);
  });

  it('el hitSlop NO crece hacia ARRIBA, y esta es la guardia de eso', () => {
    // Arriba esta el `ScrollView`. Un `hitSlop` simetrico —o el escalar `12` que alguien
    // pondra por parecerse a los otros tres de la app— se quedaria con los arrastres que
    // empiezan cerca del borde inferior del cuerpo: el defecto de este delta, en miniatura y
    // mucho mas dificil de encontrar. Ver DD-032.
    const {hitSlop} = turnButton(render()).props;

    expect(hitSlop.top).toBe(0);
    expect(typeof hitSlop).toBe('object');
  });

  it('el rotulo se centra, para cuando envuelve en varias lineas', () => {
    // Encontrado en emulador a `font_scale` 3.0 (T-303): el rotulo envuelve en tres lineas y
    // sin esto las tres se alinean a la IZQUIERDA dentro del canto. A escala normal no se ve,
    // porque es una sola linea y la caja se cine a ella: es justo el tipo de defecto que solo
    // aparece mirando la pantalla.
    const node = render()
      .root.findAllByType(Text)
      .find(n => n.props.children === CARD.turnToAnswer.toUpperCase());

    expect(flatten(node.props.style).textAlign).toBe('center');
  });

  it('al pulsar el canto OSCURECE, y no se atenua', () => {
    const style = flatten(turnButton(render()).props.style({pressed: true}));

    // Con 1 dp de borde, bajarle la opacidad lo hace desaparecer y se lee como que el boton
    // se ha ido, no como que lo estas pulsando.
    expect(style.borderColor).toBe(COLOR.paperRule);
    expect(style.opacity).toBeUndefined();
  });
});

describe('lo que el diseno de referencia trae y NO se implementa', () => {
  // UNA GUARDIA SOBRE EL CODIGO FUENTE, no sobre el render (T-208).
  //
  // Los tests de render de mas abajo solo miran los casos que se les ocurre montar: un
  // rotulo de grado anadido bajo una condicion que no se renderiza aqui pasaria limpio.
  // Esto lee el fuente y busca los literales prohibidos, que es lo que no se le puede
  // escapar.
  //
  // Acotado a `src/decks/`, que es la tarjeta. En `src/sources/sourcesCopy.js` hay un
  // 'Aprendiz' legitimo: es el PLACEHOLDER del campo «Nombre» del formulario de Datos, un
  // ejemplo de como llamar a tu fuente. Ampliar la guardia a todo `src/` lo marcaria y la
  // convertiria en ruido que nadie mira.
  //
  // Se miran solo LITERALES DE CADENA y no el archivo entero: los comentarios de
  // `CardsView` hablan de «grados» de rotacion, y los de `QuestionCard` explican por que el
  // grado NO se pinta. Contarlos seria contar justo la documentacion de la prohibicion.
  it('ningun literal de texto de src/decks/ menciona grado ni un nombre de grado', () => {
    const fs = require('fs');
    const path = require('path');

    const dir = path.join(__dirname, '..', 'src', 'decks');
    const prohibido = /grado|aprendiz|compa[nñ]ero|maestro/i;
    const literal = /'([^'\\\n]*)'|"([^"\\\n]*)"|`([^`\\\n]*)`/g;

    const hallazgos = [];

    for (const file of fs.readdirSync(dir).filter(name => name.endsWith('.js'))) {
      const source = fs
        .readFileSync(path.join(dir, file), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');

      for (const match of source.matchAll(literal)) {
        const text = match.slice(1).find(group => group !== undefined);

        if (prohibido.test(text)) {
          hallazgos.push(`${file}: ${JSON.stringify(text)}`);
        }
      }
    }

    expect(hallazgos).toEqual([]);
  });

  it('la guardia de arriba SI encuentra algo cuando hay algo', () => {
    // Una guardia que nunca ha encontrado nada no prueba nada
    // (docs/solutions/2026-08-16-el-cerrojo-que-no-protegia-nada.md). Se comprueba con la
    // misma expresion contra un fuente falso que si lleva el rotulo del diseno.
    const prohibido = /grado|aprendiz|compa[nñ]ero|maestro/i;

    expect(prohibido.test("<Text>{'APRENDIZ'}</Text>")).toBe(true);
    expect(prohibido.test("<Text>{cardNumberLabel(position, face)}</Text>")).toBe(false);
  });

  // REQ-017 y REQ-018 lo prohiben: el CSV no trae ni la columna de grado ni la de origen.
  // Son las dos cosas que alguien anadira al comparar con el diseno creyendo que faltaban.
  it('NO hay rotulo de grado en el encabezado', () => {
    const shown = texts(render()).join(' ');

    expect(shown).not.toMatch(/aprendiz|compa[nñ]ero|maestro|grado/i);
  });

  it('el encabezado del anverso lleva SOLO el numero', () => {
    const shown = texts(render());

    // Una sola pieza de texto arriba, no dos columnas como en el diseno.
    expect(shown.filter(t => t.includes('Nº'))).toHaveLength(1);
  });

  it('NO hay linea de atribucion bajo la respuesta', () => {
    const question = {...SIMPLE, source: 'Definición general', src: 'Definición general'};
    const shown = texts(render({face: 'answer', question})).join(' ');

    // Aunque la pregunta traiga el campo, no se pinta.
    expect(shown).not.toContain('Definición general');
  });
});
