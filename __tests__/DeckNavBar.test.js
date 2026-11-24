/**
 * Tests de la barra de navegacion del mazo. REQ-019, REQ-028, REQ-034.
 *
 * @format
 */

import React from 'react';
import {Pressable, Text, View} from 'react-native';
import {act, create} from 'react-test-renderer';

import {CARD} from '../src/decks/decksCopy';
import {DeckNavBar} from '../src/decks/DeckNavBar';
import {findCounter, readCounter} from './support/deckNav';

/**
 * @param {Object} [props]
 * @returns {any}
 */
function render(props = {}) {
  let renderer;

  act(() => {
    renderer = create(
      <DeckNavBar
        position={3}
        total={12}
        onPrevious={() => {}}
        onNext={() => {}}
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

/**
 * @param {any} renderer
 * @param {string} label
 * @returns {any}
 */
function button(renderer, label) {
  return renderer.root
    .findAllByType(Pressable)
    .find(node => node.props.accessibilityLabel === label);
}

/** @param {any} style @returns {Record<string, any>} */
function flatten(style) {
  if (Array.isArray(style)) {
    return style.reduce((acc, item) => ({...acc, ...flatten(item)}), {});
  }

  return style ?? {};
}

describe('lo que muestra (REQ-019)', () => {
  it('las dos acciones y el indicador con dos digitos', () => {
    const renderer = render();
    const shown = texts(renderer);

    expect(shown).toContain(CARD.previous.toUpperCase());
    expect(shown).toContain(CARD.next.toUpperCase());
    expect(readCounter(renderer)).toBe('03 DE 12');
  });

  it('los DOS numeros llevan dos digitos', () => {
    expect(readCounter(render({position: 1, total: 9}))).toBe('01 DE 09');
  });

  it('un mazo de una sola tarjeta dice 01 de 01 (DELTA-004)', () => {
    expect(readCounter(render({position: 1, total: 1}))).toBe('01 DE 01');
  });
});

describe('las acciones', () => {
  it('Atras y Siguiente llaman a sus manejadores', () => {
    const onPrevious = jest.fn();
    const onNext = jest.fn();
    const renderer = render({onPrevious, onNext});

    act(() => button(renderer, CARD.previous).props.onPress());
    act(() => button(renderer, CARD.next).props.onPress());

    expect(onPrevious).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('con una transicion en curso NO llaman, y se ATENUAN (DD-019)', () => {
    const onNext = jest.fn();
    const renderer = render({onNext, disabled: true});
    const next = button(renderer, CARD.next);

    expect(next.props.disabled).toBe(true);
    expect(next.props.onPress).toBeUndefined();

    // La atenuacion pasa a estar en el `Pressable` y no en su `Text`: desde DELTA-007 el
    // boton lleva ademas un chevron, y atenuar solo el rotulo dejaria el icono a plena
    // opacidad junto a un texto apagado.
    expect(flatten(next.props.style({pressed: false})).opacity).toBeLessThan(1);
    expect(onNext).not.toHaveBeenCalled();
  });
});

describe('accesibilidad (REQ-028)', () => {
  it('Atras y Siguiente son botones con su estado', () => {
    const renderer = render({disabled: true});

    [CARD.previous, CARD.next].forEach(label => {
      const node = button(renderer, label);

      expect(node.props.accessibilityRole).toBe('button');
      expect(node.props.accessibilityState).toEqual({disabled: true});
    });
  });

  it('el indicador NO es un control, y se anuncia sin los ceros delante', () => {
    const renderer = render();
    const counter = findCounter(renderer);

    expect(counter.props.accessibilityLabel).toBe('Tarjeta 3 de 12');
    expect(counter.props.accessibilityRole).toBeUndefined();

    // Solo dos elementos accionables en la barra: las dos acciones.
    expect(renderer.root.findAllByType(Pressable)).toHaveLength(2);
  });

  // ESTE ES EL RIESGO DE HABER PARTIDO EL CONTADOR EN TRES (DELTA-007). Sin `accessible`
  // en el contenedor, el lector recorreria "cero tres", "de" y "doce" como tres nodos
  // sueltos, que es exactamente lo que prohibe REQ-028.
  it('el contador se anuncia como UNA pieza, no como tres nodos sueltos', () => {
    const renderer = render();
    const counter = findCounter(renderer);

    expect(counter.props.accessible).toBe(true);

    // Y ninguna de las tres piezas se anuncia por su cuenta.
    counter.findAllByType(Text).forEach(piece => {
      expect(piece.props.accessibilityLabel).toBeUndefined();
    });
  });

  it('los chevrones NO se anuncian: son decoracion', () => {
    const renderer = render();

    // Un chevron es una `View` de 9x9 con dos bordes. Ninguna lleva etiqueta ni rol.
    const chevrones = renderer.root
      .findAllByType(View)
      .filter(node => flatten(node.props.style).width === 9);

    expect(chevrones).toHaveLength(2);

    chevrones.forEach(chevron => {
      expect(chevron.props.accessibilityLabel).toBeUndefined();
      expect(chevron.props.accessibilityRole).toBeUndefined();
    });
  });
});

describe('escalado del texto (REQ-034)', () => {
  it('la barra ENVUELVE en vez de comprimir', () => {
    const bar = render().root.findAllByType(View)[0];

    // Con el texto del sistema al maximo, los tres elementos no caben en una linea.
    expect(flatten(bar.props.style).flexWrap).toBe('wrap');
  });
});

// ── Delta: apariencia moderna y legible ───────────────────────────────────────

describe('el contador compuesto (DELTA-007)', () => {
  /** @param {any} renderer @returns {Object[]} los estilos de las tres piezas, en orden */
  function pieces(renderer) {
    const counter = findCounter(renderer);

    return counter.findAllByType(Text).map(node => flatten(node.props.style));
  }

  it('la posicion pesa MAS que el total, y el separador menos que los dos', () => {
    // Es todo el punto del cambio: antes `03` y `12` estaban al mismo tamano y habia que
    // leerlos para saber donde vas.
    const [current, separator, total] = pieces(render());

    expect(current.fontSize).toBeGreaterThan(total.fontSize);
    expect(separator.fontSize).toBeLessThan(total.fontSize);
  });

  it('la posicion es lo mas claro de los tres', () => {
    const [current, separator, total] = pieces(render());

    // Jerarquia por color ademas de por tamano: los dos refuerzos van juntos.
    expect(current.color).not.toBe(total.color);
    expect(current.color).not.toBe(separator.color);
  });

  it('los DOS numeros piden cifras tabulares, para que no bailen', () => {
    const [current, , total] = pieces(render());

    // `tabular-nums` pide la tabla `tnum` a la fuente. Si Barlow Condensed no la trae se
    // ignora EN SILENCIO, y eso solo se ve en un dispositivo: T-209 y DD-027.
    expect(current.fontVariant).toContain('tabular-nums');
    expect(total.fontVariant).toContain('tabular-nums');
  });

  it('las piezas se alinean por su LINEA BASE', () => {
    const counter = findCounter(render());

    // Con `center` el 20 y el 11 flotarian a alturas que no comparten ninguna linea.
    expect(flatten(counter.props.style).alignItems).toBe('baseline');
  });
});

describe('los chevrones (DD-024)', () => {
  /** @param {any} renderer @returns {Object[]} */
  function chevronStyles(renderer) {
    return renderer.root
      .findAllByType(View)
      .map(node => flatten(node.props.style))
      .filter(style => style.width === 9 && style.height === 9);
  }

  it('hay uno por accion, y ni uno mas', () => {
    expect(chevronStyles(render())).toHaveLength(2);
  });

  it('cada uno es UNA vista con dos bordes, no dos barras', () => {
    // El aspa de `SideMenu` usa dos barras en `position: absolute`; para un chevron eso
    // seria el doble de nodos y dos estilos espejo que pueden desincronizarse.
    chevronStyles(render()).forEach(style => {
      expect(style.borderLeftWidth).toBe(1.3);
      expect(style.borderBottomWidth).toBe(1.3);
      expect(style.borderTopWidth).toBeUndefined();
      expect(style.borderRightWidth).toBeUndefined();
      expect(style.position).toBeUndefined();
    });
  });

  it('apuntan a lados OPUESTOS', () => {
    // Lo que garantiza que no queden los dos mirando al mismo sitio: la direccion es UN
    // valor, no dos estilos espejo.
    const [izquierdo, derecho] = chevronStyles(render()).map(
      style => style.transform[0].rotate,
    );

    expect(izquierdo).toBe('45deg');
    expect(derecho).toBe('225deg');
  });
});
