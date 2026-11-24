/**
 * Tests de la vista de tarjetas.
 *
 * REQ-018, REQ-020, REQ-021, REQ-022, DELTA-001 y DELTA-004.
 *
 * Con temporizadores FALSOS: las transiciones son animaciones de varios frames, y sin
 * controlarlas no se puede distinguir "durante" de "despues" — que es justo lo que el
 * cerrojo de REQ-022 exige comprobar.
 *
 * Toda asercion sobre la tarjeta visible va DENTRO de `act()`
 * (docs/solutions/2026-08-18-leer-estado-de-react-fuera-de-act.md).
 *
 * @format
 */

import React from 'react';
import {Animated, Pressable, Text} from 'react-native';
import {act, create} from 'react-test-renderer';

import {CardsView} from '../src/decks/CardsView';
import {CARD} from '../src/decks/decksCopy';
import {openDatabase, resetDatabaseForTests} from '../src/db/database';
import {resetCardImageCacheForTests} from '../src/decks/useCardImage';
import {makeMemoryDriver} from './support/nodeSqliteDriver';
import {readCounter} from './support/deckNav';

/** Duracion de un giro completo (dos tramos de 200 ms) mas margen. */
const TURN_TOTAL = 500;
/** Duracion de un deslizamiento completo (dos tramos de 160 ms) mas margen. */
const SLIDE_TOTAL = 420;

beforeEach(() => {
  jest.useFakeTimers();
  resetDatabaseForTests();
  resetCardImageCacheForTests();
  openDatabase(makeMemoryDriver());
});

afterEach(() => {
  jest.useRealTimers();
});

/**
 * @param {number} count
 * @param {number} [sourceId]
 * @returns {{source: Object, questions: Object[]}}
 */
function makeDeck(count, sourceId = 1) {
  return {
    source: {id: sourceId, name: 'Fisica'},
    questions: Array.from({length: count}, (_, i) => ({
      id: i + 1,
      position: i,
      question: `Pregunta ${i + 1}`,
      answer1: `Respuesta ${i + 1}`,
      answer2: null,
      imageQuestionId: null,
      imageAnswerId: null,
    })),
  };
}

/**
 * @param {{source: Object, questions: Object[]}} deck
 * @returns {{renderer: any, rerender: (next: Object) => void}}
 */
function render(deck) {
  let renderer;

  act(() => {
    renderer = create(<CardsView deck={deck} />);
  });

  return {
    renderer,
    rerender: next =>
      act(() => {
        renderer.update(<CardsView deck={next} />);
      }),
  };
}

/** @param {any} renderer @returns {string[]} */
function texts(renderer) {
  return renderer.root
    .findAllByType(Text)
    .map(node => node.props.children)
    .filter(child => typeof child === 'string');
}

/**
 * @param {any} renderer
 * @param {string} label
 */
function press(renderer, label) {
  const node = renderer.root
    .findAllByType(Pressable)
    .find(pressable => pressable.props.accessibilityLabel === label);

  act(() => {
    node.props.onPress?.();
  });
}

/**
 * Gira la tarjeta activando el boton de su pie.
 *
 * Se localiza por su COPIA VISIBLE, y no por `testID` —que en este repo no se usa ni una vez—
 * ni por la pista de accesibilidad, que es como se buscaba antes: `el Pressable cuyo
 * accessibilityHint dice girar`. Eso dejo de funcionar al dejar la raiz de la tarjeta de ser
 * accionable (DD-030). Ahora la pista vive en una `View` y lo pulsable es el boton del pie,
 * que ademas se oculta al lector a proposito para que siga habiendo UN nodo y no dos.
 *
 * @param {any} renderer
 */
function touchCard(renderer) {
  const turn = renderer.root.findAllByType(Pressable).find(pressable =>
    pressable
      .findAllByType(Text)
      .map(node => node.props.children)
      .some(
        child =>
          child === CARD.turnToAnswer.toUpperCase() ||
          child === CARD.turnToQuestion.toUpperCase(),
      ),
  );

  act(() => {
    turn.props.onPress();
  });
}

/** Deja que las animaciones terminen. */
function settle(ms) {
  act(() => {
    jest.advanceTimersByTime(ms);
  });
}

describe('arranque', () => {
  it('empieza en la primera tarjeta y por su anverso', () => {
    const {renderer} = render(makeDeck(12));
    const shown = texts(renderer);

    expect(shown).toContain('Nº 01');
    expect(shown).toContain('Pregunta 1');
    expect(readCounter(renderer)).toBe('01 DE 12');
    expect(shown).not.toContain('Respuesta 1');
  });
});

describe('el giro (REQ-018)', () => {
  it('tocar muestra la respuesta, y volver a tocar la pregunta', () => {
    const {renderer} = render(makeDeck(3));

    touchCard(renderer);
    settle(TURN_TOTAL);

    expect(texts(renderer)).toContain('Respuesta 1');
    expect(texts(renderer)).toContain(CARD.turnToQuestion.toUpperCase());

    touchCard(renderer);
    settle(TURN_TOTAL);

    expect(texts(renderer)).toContain('Pregunta 1');
    expect(texts(renderer)).toContain(CARD.turnToAnswer.toUpperCase());
  });

  it('la activacion accesible gira DE VERDAD, no solo llama a una prop', () => {
    // La cadena real y no un `jest.fn()`. `QuestionCard.test.js` comprueba que la accion
    // esta declarada y que llama a `onTurn`; eso deja sin ejercitar el tramo que va de ahi
    // al intercambio de cara. Y es justo el que puede romperse en silencio: al dejar la raiz
    // de la tarjeta de ser accionable perdio la activacion por doble toque, y en Android no
    // la devuelve `onAccessibilityTap` porque es solo de iOS (DD-031).
    const {renderer} = render(makeDeck(3));

    const face = renderer.root.find(
      node =>
        String(node.props?.accessibilityLabel ?? '').includes('Nº 01') &&
        typeof node.props?.onAccessibilityAction === 'function',
    );

    act(() => {
      face.props.onAccessibilityAction({nativeEvent: {actionName: 'activate'}});
    });
    settle(TURN_TOTAL);

    expect(texts(renderer)).toContain('Respuesta 1');
  });

  it('el intercambio NO es sincrono con la pulsacion: va en el callback', () => {
    const {renderer} = render(makeDeck(3));

    touchCard(renderer);

    // Sin avanzar ni un tick: la cara sigue siendo la de antes, porque el cambio
    // ocurre en el callback del primer tramo y no al pulsar. Eso es lo que garantiza
    // que se produzca de canto (DD-017).
    expect(texts(renderer)).toContain('Pregunta 1');
    expect(texts(renderer)).not.toContain('Respuesta 1');

    settle(TURN_TOTAL);

    expect(texts(renderer)).toContain('Respuesta 1');
  });

  // NO hay test de "a los 100 ms todavia no ha cambiado": con temporizadores falsos la
  // animacion completa antes, porque el driver nativo esta simulado bajo Jest. Un test
  // asi comprobaria el reloj del entorno de test, no el producto. Que el intercambio
  // se vea de canto lo comprobo el spike de T-101 en dispositivo, y lo revisa T-109.
});

describe('navegacion (REQ-020, REQ-021)', () => {
  it('Siguiente avanza y el contador lo sigue', () => {
    const {renderer} = render(makeDeck(12));

    press(renderer, CARD.next);
    settle(SLIDE_TOTAL);

    expect(texts(renderer)).toContain('Pregunta 2');
    expect(readCounter(renderer)).toBe('02 DE 12');
  });

  it('presenta SIEMPRE el anverso, aunque la anterior estuviera girada', () => {
    const {renderer} = render(makeDeck(12));

    touchCard(renderer);
    settle(TURN_TOTAL);
    expect(texts(renderer)).toContain('Respuesta 1');

    press(renderer, CARD.next);
    settle(SLIDE_TOTAL);

    // La tarjeta 2 aparece por su pregunta, no por su respuesta.
    expect(texts(renderer)).toContain('Pregunta 2');
    expect(texts(renderer)).not.toContain('Respuesta 2');
  });

  it('es CIRCULAR en los dos extremos (REQ-021)', () => {
    const {renderer} = render(makeDeck(3));

    // De la primera hacia atras: a la ultima.
    press(renderer, CARD.previous);
    settle(SLIDE_TOTAL);

    expect(texts(renderer)).toContain('Pregunta 3');
    expect(readCounter(renderer)).toBe('03 DE 03');

    // Y de la ultima hacia delante: a la primera.
    press(renderer, CARD.next);
    settle(SLIDE_TOTAL);

    expect(texts(renderer)).toContain('Pregunta 1');
    expect(readCounter(renderer)).toBe('01 DE 03');
  });
});

describe('el cerrojo de la transicion (REQ-022, DD-019)', () => {
  it('el cerrojo del GIRO evita arrancar un tramo de mas, con su callback suelto', () => {
    // Este test SI cae si se quita la guarda de `flip`, y por eso existe: sin ella el
    // segundo toque cancela el tramo en vuelo, y el callback del cancelado pone
    // `isBusy` a false a mitad del giro.
    const spy = jest.spyOn(Animated, 'timing');
    const {renderer} = render(makeDeck(3));

    touchCard(renderer);
    touchCard(renderer);
    touchCard(renderer);

    // Un giro son DOS tramos. Tres toques seguidos siguen siendo dos animaciones.
    const arrancadasAntesDeAsentar = spy.mock.calls.length;

    settle(TURN_TOTAL);

    expect(arrancadasAntesDeAsentar).toBe(1);
    expect(spy.mock.calls.length).toBe(2);
    expect(texts(renderer)).toContain('Respuesta 1');

    spy.mockRestore();
  });

  it('cinco pulsaciones rapidas dejan la tarjeta y el contador coincidiendo', () => {
    const {renderer} = render(makeDeck(12));

    // Sin dejar terminar ninguna. Lo que las frena NO es un cerrojo en `CardsView`
    // —se comprobo retirandolo y este test seguia pasando— sino los botones
    // desactivados y la cancelacion de `Animated`. Ver DD-019.
    press(renderer, CARD.next);
    press(renderer, CARD.next);
    press(renderer, CARD.next);
    press(renderer, CARD.next);
    press(renderer, CARD.next);

    settle(SLIDE_TOTAL);

    // Una sola tarjeta de avance, y el contador de acuerdo con ella.
    expect(texts(renderer)).toContain('Pregunta 2');
    expect(readCounter(renderer)).toBe('02 DE 12');
    expect(texts(renderer)).not.toContain('Pregunta 3');
  });

  it('durante la transicion los botones estan desactivados', () => {
    const {renderer} = render(makeDeck(12));

    press(renderer, CARD.next);

    const next = renderer.root
      .findAllByType(Pressable)
      .find(p => p.props.accessibilityLabel === CARD.next);

    expect(next.props.disabled).toBe(true);

    settle(SLIDE_TOTAL);

    const after = renderer.root
      .findAllByType(Pressable)
      .find(p => p.props.accessibilityLabel === CARD.next);

    expect(after.props.disabled).toBe(false);
  });

  it('tampoco se puede girar a mitad de un cambio de tarjeta', () => {
    const {renderer} = render(makeDeck(12));

    press(renderer, CARD.next);
    touchCard(renderer);
    settle(SLIDE_TOTAL);

    // Llego a la 2 por su anverso: el giro que se colo no tuvo efecto.
    expect(texts(renderer)).toContain('Pregunta 2');
    expect(texts(renderer)).not.toContain('Respuesta 2');
  });
});

describe('el mazo cambia debajo (DELTA-001)', () => {
  it('al cambiar de fuente activa vuelve a la primera y al anverso', () => {
    const {renderer, rerender} = render(makeDeck(12));

    press(renderer, CARD.next);
    settle(SLIDE_TOTAL);
    touchCard(renderer);
    settle(TURN_TOTAL);

    expect(texts(renderer)).toContain('Respuesta 2');

    rerender(makeDeck(20, 2));

    expect(texts(renderer)).toContain('Nº 01');
    expect(texts(renderer)).toContain('Pregunta 1');
    expect(readCounter(renderer)).toBe('01 DE 20');
  });

  it('al actualizar el mazo y cambiar de tamano, tambien', () => {
    const {renderer, rerender} = render(makeDeck(20));

    press(renderer, CARD.next);
    settle(SLIDE_TOTAL);
    press(renderer, CARD.next);
    settle(SLIDE_TOTAL);

    expect(readCounter(renderer)).toBe('03 DE 20');

    // La misma fuente, ahora con 3 preguntas: la 3 de antes ya no significa nada.
    rerender(makeDeck(3));

    expect(readCounter(renderer)).toBe('01 DE 03');
    expect(texts(renderer)).toContain('Pregunta 1');
  });

  it('un refresco que publica el MISMO mazo no mueve la posicion (DD-018)', () => {
    const {renderer, rerender} = render(makeDeck(12));

    press(renderer, CARD.next);
    settle(SLIDE_TOTAL);
    expect(readCounter(renderer)).toBe('02 DE 12');

    // `useDeck` publica un array NUEVO en cada refresco. Si se comparara por
    // referencia, esto reiniciaria la vista cada vez que se repinta la lista de Datos.
    rerender(makeDeck(12));

    expect(readCounter(renderer)).toBe('02 DE 12');
  });
});

describe('un mazo de una sola tarjeta (DELTA-004)', () => {
  it('dice 01 de 01 y no se mueve ni parpadea', () => {
    const {renderer} = render(makeDeck(1));

    expect(readCounter(renderer)).toBe('01 DE 01');

    press(renderer, CARD.next);
    press(renderer, CARD.previous);
    settle(SLIDE_TOTAL);

    expect(readCounter(renderer)).toBe('01 DE 01');
    expect(texts(renderer)).toContain('Pregunta 1');
  });

  it('pero SI se puede girar', () => {
    const {renderer} = render(makeDeck(1));

    touchCard(renderer);
    settle(TURN_TOTAL);

    expect(texts(renderer)).toContain('Respuesta 1');
  });
});
