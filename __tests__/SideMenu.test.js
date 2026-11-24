/**
 * @format
 */

import React from 'react';
import {Animated, Pressable, Text} from 'react-native';
import {act, create} from 'react-test-renderer';

import {SideMenu} from '../src/main/SideMenu';
import {Scrim} from '../src/main/Scrim';
import {MENU_ITEMS} from '../src/main/menuItems';
import {SOON_LABEL} from '../src/main/masonCopy';

const {version: APP_VERSION} = require('../package.json');

const INSETS = {top: 47, bottom: 34};

function renderMenu(props = {}) {
  let renderer;

  act(() => {
    renderer = create(
      <SideMenu
        progress={new Animated.Value(0)}
        isOpen={false}
        onClose={() => {}}
        insets={INSETS}
        activeView="cards"
        onSelect={() => {}}
        title="Preguntas y Respuestas"
        {...props}
      />,
    );
  });

  return renderer;
}

function texts(renderer) {
  return renderer.root
    .findAllByType(Text)
    .map(node => node.props.children)
    .filter(child => typeof child === 'string');
}

describe('SideMenu', () => {
  // REQ-007: las tres entradas del diseno estan presentes.
  it('muestra las tres entradas del diseno', () => {
    const rendered = texts(renderMenu());

    for (const item of MENU_ITEMS) {
      expect(rendered).toContain(item.label.toUpperCase());
    }
  });

  // REQ-044: Datos pasa a ser accionable; Acerca de sigue sin serlo.
  it('no envuelve en Pressable las entradas no disponibles', () => {
    const renderer = renderMenu();
    const labels = renderer.root
      .findAllByType(Pressable)
      .map(node => node.props.accessibilityLabel);

    expect(labels).toContain('Cerrar menú');
    expect(labels).toContain('Tarjetas');
    expect(labels).toContain('Datos');
    expect(labels).not.toContain('Acerca de');
  });

  // REQ-007: y llevan el rotulo "pronto", uno por cada entrada no disponible.
  it('marca las entradas no disponibles con el rotulo pronto', () => {
    const rendered = texts(renderMenu());
    const noDisponibles = MENU_ITEMS.filter(item => !item.available).length;

    expect(rendered.filter(t => t === SOON_LABEL)).toHaveLength(noDisponibles);
    expect(noDisponibles).toBeGreaterThan(0);
  });

  // REQ-028: se anuncian como texto proximo, no como boton roto.
  it('anuncia las entradas no disponibles como proximamente', () => {
    const renderer = renderMenu();
    const etiquetas = renderer.root
      .findAll(node => typeof node.props?.accessibilityLabel === 'string')
      .map(node => node.props.accessibilityLabel);

    expect(etiquetas).toContain('Acerca de, próximamente');
    // Datos ya no: es una vista alcanzable (REQ-044).
    expect(etiquetas).not.toContain('Datos, próximamente');
  });

  // REQ-046: se marca la vista que se esta viendo, y SOLO esa.
  it('marca como activa la vista actual y ninguna otra', () => {
    const seleccion = view =>
      renderMenu({activeView: view})
        .root.findAllByType(Pressable)
        .filter(node => node.props.accessibilityState != null)
        .map(node => [node.props.accessibilityLabel, node.props.accessibilityState.selected]);

    expect(seleccion('cards')).toEqual([
      ['Tarjetas', true],
      ['Datos', false],
    ]);
    expect(seleccion('data')).toEqual([
      ['Tarjetas', false],
      ['Datos', true],
    ]);
  });

  // REQ-044: seleccionar una entrada avisa de QUE entrada se selecciono.
  it('onSelect recibe la clave de la entrada', () => {
    const onSelect = jest.fn();
    const renderer = renderMenu({onSelect});
    const datos = renderer.root
      .findAllByType(Pressable)
      .find(node => node.props.accessibilityLabel === 'Datos');

    act(() => {
      datos.props.onPress();
    });

    expect(onSelect).toHaveBeenCalledWith('data');
  });

  // El cajon titula con el MISMO texto que la vista de tarjetas. Con un titulo
  // fijo decia "Preguntas y Respuestas" mientras el header decia el nombre de la
  // fuente activa, y dos titulos distintos a la vez se leen como un fallo.
  it('la cabecera del cajon usa el titulo que se le pasa', () => {
    expect(texts(renderMenu({title: 'Aprendiz'}))).toContain('Aprendiz');
    expect(texts(renderMenu({title: 'Aprendiz'}))).not.toContain(
      'Preguntas y Respuestas',
    );
  });

  // 2026-08-19: el rotulo fijo se retiro tambien aqui, no solo del header.
  it('no pinta ningun rotulo sobre el titulo del cajon', () => {
    expect(texts(renderMenu())).not.toContain('INSTRUCCIÓN');
  });

  // REQ-006: sin mazo, el pie muestra solo la version. Ni un cero ni un hueco.
  it('sin mazo, el pie muestra solo la version', () => {
    const rendered = texts(renderMenu());

    expect(rendered).toContain(`Versión ${APP_VERSION}`);
    expect(rendered.join(' ')).not.toContain('preguntas');
  });

  // REQ-006: y con mazo recupera la linea. Se comprueba desde ahora para que la
  // rama exista y este probada cuando lleguen los datos.
  it('con mazo, el pie anade el numero de preguntas', () => {
    const rendered = texts(renderMenu({deckCount: 12}));

    expect(rendered).toContain(`Versión ${APP_VERSION}`);
    expect(rendered).toContain('12 preguntas');
  });

  // REQ-004: el aspa repliega el menu.
  it('el boton de cerrar dispara onClose', () => {
    const onClose = jest.fn();
    const renderer = renderMenu({onClose});
    const cerrar = renderer.root
      .findAllByType(Pressable)
      .find(node => node.props.accessibilityLabel === 'Cerrar menú');

    act(() => {
      cerrar.props.onPress();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // REQ-005: con el menu cerrado el cajon no puede capturar toques de la banda
  // izquierda de la pantalla, aunque este fuera de vista.
  it('no captura toques con el menu cerrado', () => {
    expect(renderMenu({isOpen: false}).root.findByType(Animated.View).props.pointerEvents).toBe('none');
    expect(renderMenu({isOpen: true}).root.findByType(Animated.View).props.pointerEvents).toBe('auto');
  });

  it('se declara modal para el lector de pantalla solo estando abierto', () => {
    expect(
      renderMenu({isOpen: true}).root.findByType(Animated.View).props
        .accessibilityViewIsModal,
    ).toBe(true);
    expect(
      renderMenu({isOpen: false}).root.findByType(Animated.View).props
        .accessibilityViewIsModal,
    ).toBe(false);
  });
});

describe('Scrim', () => {
  function renderScrim(props = {}) {
    let renderer;

    act(() => {
      renderer = create(
        <Scrim
          progress={new Animated.Value(0)}
          isOpen={false}
          onPress={() => {}}
          {...props}
        />,
      );
    });

    return renderer;
  }

  // REQ-004: tocar el velo repliega el menu.
  it('dispara onPress al tocarlo', () => {
    const onPress = jest.fn();
    const renderer = renderScrim({isOpen: true, onPress});

    act(() => {
      renderer.root.findByType(Pressable).props.onPress();
    });

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  // REQ-005: con el menu abierto, el velo intercepta los toques del contenido.
  it('solo intercepta toques con el menu abierto', () => {
    expect(renderScrim({isOpen: false}).root.findByType(Animated.View).props.pointerEvents).toBe('none');
    expect(renderScrim({isOpen: true}).root.findByType(Animated.View).props.pointerEvents).toBe('auto');
  });
});
