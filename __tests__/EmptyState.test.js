/**
 * @format
 */

import React from 'react';
import {Button, Pressable, ScrollView, Text, TouchableOpacity} from 'react-native';
import {act, create} from 'react-test-renderer';

import {EmptyState} from '../src/main/EmptyState';
import {LAYOUT} from '../src/theme/masonTheme';
import {EMPTY_STATE} from '../src/main/masonCopy';

function render(props = {}) {
  let renderer;

  act(() => {
    renderer = create(<EmptyState {...props} />);
  });

  return renderer;
}

function texts(renderer) {
  return renderer.root
    .findAllByType(Text)
    .map(node => node.props.children)
    .filter(child => typeof child === 'string');
}

describe('EmptyState', () => {
  // REQ-011: el mensaje explica que no hay preguntas.
  it('muestra el titular y el cuerpo por defecto', () => {
    const rendered = texts(render());

    expect(rendered).toContain(EMPTY_STATE.title);
    expect(rendered).toContain(EMPTY_STATE.body);
  });

  // REQ-043: el texto lo lee el usuario final, no el desarrollador, asi que no
  // puede nombrar ningun archivo del codigo. Antes decia "src/decks/source.js".
  it('no menciona ningun archivo del codigo', () => {
    const rendered = texts(render()).join(' ');

    expect(rendered).not.toMatch(/src\//);
    expect(rendered).not.toMatch(/\.js\b/);
  });

  // Sin accion se renderiza como antes: los estados diferidos de error y de
  // mazo vacio reutilizan esta composicion y no tienen por que ofrecer ninguna.
  it('sin la prop `action` no pinta ningun boton', () => {
    const renderer = render();

    expect(renderer.root.findAllByType(Pressable)).toHaveLength(0);
    expect(renderer.root.findAllByType(TouchableOpacity)).toHaveLength(0);
    expect(renderer.root.findAllByType(Button)).toHaveLength(0);
  });

  // REQ-043: con fuente por configurar SI hay algo que el usuario puede hacer,
  // a diferencia del "reintentar" que REQ-011 de main-view prohibia. Ver DD-011.
  it('con `action` pinta un boton accionable y anunciado', () => {
    const onPress = jest.fn();
    const renderer = render({action: {label: 'Añadir una fuente', onPress}});
    const boton = renderer.root.findByType(Pressable);

    expect(boton.props.accessibilityRole).toBe('button');
    expect(boton.props.accessibilityLabel).toBe('Añadir una fuente');
    expect(texts(renderer)).toContain('AÑADIR UNA FUENTE');

    act(() => {
      boton.props.onPress();
    });

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  // DELTA-008. La app era enteramente recta antes del delta, y un radio que desaparece no
  // rompe nada: solo se ve peor. Por eso hay que asertarlo, no confiar en que se vea.
  it('el boton tiene las esquinas redondeadas (DELTA-008)', () => {
    const renderer = render({action: {label: 'Añadir una fuente', onPress: () => {}}});
    const style = renderer.root.findByType(Pressable).props.style({pressed: false});

    expect(style.flat().find(item => item?.borderRadius != null).borderRadius).toBe(
      LAYOUT.radiusControl,
    );
  });

  // El texto del estado sin fuente trae su propia etiqueta de accion.
  it('el copy por defecto incluye la etiqueta de la accion', () => {
    expect(typeof EMPTY_STATE.action).toBe('string');
    expect(EMPTY_STATE.action.length).toBeGreaterThan(0);
  });

  // REQ-034 / DD-011: el texto escala con el sistema y se desplaza si no cabe.
  it('permite desplazar el contenido y no congela el escalado tipografico', () => {
    const renderer = render();
    const scroll = renderer.root.findByType(ScrollView);

    expect(scroll.props.contentContainerStyle).toEqual(
      expect.objectContaining({flexGrow: 1, justifyContent: 'center'}),
    );

    // Lo contrario de lo que hizo el splash con el wordmark: aca el texto es
    // contenido, no marca.
    for (const node of renderer.root.findAllByType(Text)) {
      expect(node.props.allowFontScaling).not.toBe(false);
    }
  });

  // Se parametriza porque los estados diferidos de error y de mazo vacio
  // reutilizaran esta composicion.
  it('acepta titulo y cuerpo por props', () => {
    const rendered = texts(
      render({title: 'Sin conexión', body: 'No se pudo cargar el mazo.'}),
    );

    expect(rendered).toContain('Sin conexión');
    expect(rendered).toContain('No se pudo cargar el mazo.');
    expect(rendered).not.toContain(EMPTY_STATE.title);
  });
});
