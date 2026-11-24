/**
 * Tests de la ventana de progreso.
 *
 * REQ-050 a REQ-056, REQ-082 y REQ-083.
 *
 * @format
 */

import React from 'react';
import {ActivityIndicator, Modal, Pressable, Text, View} from 'react-native';
import {act, create} from 'react-test-renderer';
import {SafeAreaProvider} from 'react-native-safe-area-context';

import {SyncProgressModal} from '../src/decks/SyncProgressModal';
import {COLOR, LAYOUT} from '../src/theme/masonTheme';
import {SYNC} from '../src/decks/decksCopy';

const PREPARING = {phase: 'preparing', sourceId: 1, sourceName: 'Física'};
const WORKING = {
  phase: 'working',
  sourceId: 1,
  sourceName: 'Física',
  done: 7,
  total: 20,
};

/** Medidas con muesca arriba e indicador de inicio abajo. */
const METRICS = {
  frame: {x: 0, y: 0, width: 430, height: 932},
  insets: {top: 59, left: 0, right: 0, bottom: 34},
};

/**
 * @param {Object} state
 * @param {() => void} [onCancel]
 * @returns {any}
 */
function renderModal(state, onCancel = () => {}) {
  let renderer;

  // Con proveedor de areas seguras: la ventana las respeta (REQ-081), asi que sin
  // el no se renderiza igual que en la app.
  act(() => {
    renderer = create(
      <SafeAreaProvider initialMetrics={METRICS}>
        <SyncProgressModal state={state} onCancel={onCancel} />
      </SafeAreaProvider>,
    );
  });

  return renderer;
}

/**
 * @param {any} renderer
 * @returns {string[]}
 */
function texts(renderer) {
  return renderer.root
    .findAllByType(Text)
    .map(node => node.props.children)
    .filter(child => typeof child === 'string');
}

/**
 * No hay ventana: ni velo, ni indicador, ni un solo texto.
 *
 * Se comprueba asi y no con `toJSON() === null` porque el arbol lleva ahora el
 * proveedor de areas seguras envolviendo: su View existe siempre, y el `null` seria
 * de la ventana o del proveedor sin poder distinguirlos.
 *
 * @param {any} renderer
 */
function expectNoWindow(renderer) {
  expect(veilOf(renderer)).toBeUndefined();
  expect(renderer.root.findAllByType(ActivityIndicator)).toHaveLength(0);
  expect(texts(renderer)).toEqual([]);
}

describe('cuando NO se muestra (REQ-056)', () => {
  it("en 'idle' no pinta nada", () => {
    expectNoWindow(renderModal({phase: 'idle'}));
  });

  it("en 'result' y en 'error' tampoco: la ventana se cierra al terminar", () => {
    // El desenlace lo cuenta la fila. REQ-056 manda cerrar ESTA ventana; REQ-043
    // manda decir cuantas imagenes se omitieron. Son dos sitios distintos (DD-009).
    expectNoWindow(
      renderModal({
        phase: 'result',
        sourceId: 1,
        sourceName: 'Física',
        saved: 20,
        skippedImages: 1,
        failedImages: 0,
        warnings: [],
      }),
    );

    expectNoWindow(
      renderModal({
        phase: 'error',
        sourceId: 1,
        sourceName: 'Física',
        reason: 'NO_CONNECTION',
      }),
    );
  });
});

describe("fase 'preparing': indicador sin numeros (REQ-053)", () => {
  it('muestra el indicador de actividad y el nombre de la fuente', () => {
    const renderer = renderModal(PREPARING);

    expect(renderer.root.findAllByType(ActivityIndicator)).toHaveLength(1);
    expect(texts(renderer)).toContain('Física');
  });

  it('NO muestra ningun numero, ni un cero, ni un total inventado', () => {
    const shown = texts(renderModal(PREPARING)).join(' ');

    expect(shown).not.toMatch(/\d/);
    expect(shown).not.toContain('de');
  });

  it('ofrece Cancelar ya, antes de conocer el total (REQ-050)', () => {
    const shown = texts(renderModal(PREPARING));

    expect(shown).toContain(SYNC.cancel.toUpperCase());
  });
});

describe("fase 'working': el contador (REQ-051)", () => {
  it('muestra completadas sobre total', () => {
    expect(texts(renderModal(WORKING))).toContain('7 de 20');
  });

  it('sigue mostrando el indicador de actividad', () => {
    expect(renderModal(WORKING).root.findAllByType(ActivityIndicator)).toHaveLength(1);
  });
});

describe('cancelar (REQ-054)', () => {
  it('el boton llama a onCancel', () => {
    const onCancel = jest.fn();
    const renderer = renderModal(WORKING, onCancel);

    const button = renderer.root
      .findAllByType(Pressable)
      .find(node =>
        String(node.props.accessibilityLabel ?? '').startsWith(SYNC.cancel),
      );

    act(() => button.props.onPress());

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('el UNICO Pressable es el de cancelar: tocar fuera no cierra nada', () => {
    const renderer = renderModal(WORKING);

    // Sin Pressable en el velo: la ventana no se cierra tocando fuera, porque
    // cancelar una descarga larga tiene que ser un acto deliberado.
    expect(renderer.root.findAllByType(Pressable)).toHaveLength(1);
  });
});

describe('bloqueo de toques y capas (REQ-055, DD-009)', () => {
  it('el velo cubre la pantalla entera', () => {
    const veil = veilOf(renderModal(WORKING));
    const style = flatten(veil.props.style);

    expect(style.position).toBe('absolute');
    expect(style.top).toBe(0);
    expect(style.bottom).toBe(0);
  });

  it('no deja pasar los toques: el velo NO es pointerEvents none', () => {
    const veil = veilOf(renderModal(WORKING));

    // Un View con fondo por encima de todo absorbe los toques. Lo que romperia
    // REQ-055 es marcarlo como transparente a ellos.
    expect(veil.props.pointerEvents).toBeUndefined();
  });

  it('esta por encima del cajon del menu y de su velo', () => {
    const veil = veilOf(renderModal(WORKING));

    // El cajon usa 50 y su velo 40 (main-view design.md seccion 2.5).
    expect(flatten(veil.props.style).zIndex).toBeGreaterThan(50);
  });

  it('NO usa Modal de React Native (DD-009)', () => {
    // `Modal` trae `onRequestClose`, que es un manejador del atras de Android: un
    // segundo dueno de ese boton. REQ-057 se cumple en useViewRouter, y esto
    // asegura que nadie lo mueva de sitio sin darse cuenta.
    expect(renderModal(WORKING).root.findAllByType(Modal)).toHaveLength(0);
  });
});

describe('accesibilidad y escalado (REQ-082, REQ-083)', () => {
  it('el contenedor se anuncia como modal, con la fuente en su etiqueta', () => {
    const veil = veilOf(renderModal(WORKING));

    expect(veil.props.accessibilityViewIsModal).toBe(true);
    expect(veil.props.accessibilityLabel).toContain('Física');
  });

  it('el contador es una region viva, para que el lector anuncie los avances', () => {
    const count = renderModal(WORKING)
      .root.findAllByType(Text)
      .find(node => node.props.children === '7 de 20');

    expect(count.props.accessibilityLiveRegion).toBe('polite');
  });

  it('la etiqueta de cancelar dice QUE se cancela', () => {
    const button = renderModal(WORKING)
      .root.findAllByType(Pressable)
      .find(node => node.props.accessibilityRole === 'button');

    // "Cancelar" a secas, al oirlo, no dice que se cancela.
    expect(button.props.accessibilityLabel).toContain('Física');
  });

  it('ninguna medida del cuadro fija una altura (REQ-082)', () => {
    const style = flatten(dialogOf(renderModal(WORKING)).props.style);

    // Con el texto del sistema al maximo, el cuadro tiene que CRECER en vez de
    // recortar lo que lleva dentro.
    expect(style.height).toBeUndefined();
    expect(style.minHeight).toBeUndefined();
    expect(style.maxHeight).toBeUndefined();
    // Y su ancho esta acotado, que es lo que si se limita.
    expect(style.maxWidth).toBeGreaterThan(0);
  });

  it('el nombre de la fuente no desborda: dos lineas como maximo', () => {
    const name = renderModal(WORKING)
      .root.findAllByType(Text)
      .find(node => node.props.children === 'Física');

    expect(name.props.numberOfLines).toBe(2);
  });
});

/**
 * El velo: el View que se anuncia como modal.
 *
 * Se busca por su papel y no por su posicion en el arbol: `findAllByType(View)[0]`
 * dependia de que el proveedor de areas seguras no metiera ninguno por delante, y
 * al anadirlo dejo de ser cierto.
 *
 * @param {any} renderer
 * @returns {any}
 */
function veilOf(renderer) {
  return renderer.root
    .findAllByType(View)
    .find(node => node.props.accessibilityViewIsModal === true);
}

/**
 * @param {any} renderer
 * @returns {any}
 */
function dialogOf(renderer) {
  const veil = veilOf(renderer);

  return veil.findAllByType(View).find(node => node !== veil);
}

/**
 * @param {any} style
 * @returns {Record<string, any>}
 */
function flatten(style) {
  if (Array.isArray(style)) {
    return style.reduce((acc, item) => ({...acc, ...flatten(item)}), {});
  }

  return style ?? {};
}

describe('acabado (DELTA-008)', () => {
  it('el cuadro tiene las esquinas redondeadas', () => {
    const renderer = renderModal(PREPARING);

    // El cuadro: la unica vista con el fondo del dialogo.
    const dialogo = renderer.root
      .findAllByType(View)
      .map(node => flatten(node.props.style))
      .find(style => style.backgroundColor === COLOR.dialog);

    expect(dialogo.borderRadius).toBe(LAYOUT.radiusSurface);
  });
});
