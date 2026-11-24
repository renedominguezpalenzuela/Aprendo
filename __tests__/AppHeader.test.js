/**
 * @format
 */

import React from 'react';
import {Pressable, Text} from 'react-native';
import {act, create} from 'react-test-renderer';

import {AppHeader} from '../src/main/AppHeader';
import {MAX_CHROME_FONT_SCALE} from '../src/theme/masonTheme';

function render(props = {}) {
  let renderer;

  act(() => {
    renderer = create(
      <AppHeader title="Preguntas y Respuestas" onOpenMenu={() => {}} {...props} />,
    );
  });

  return renderer;
}

/** Todos los textos renderizados, en orden. */
function texts(renderer) {
  return renderer.root
    .findAllByType(Text)
    .map(node => node.props.children)
    .filter(child => typeof child === 'string');
}

/** El bloque central: el unico View con flex 1. */
function titleBlock(renderer) {
  return renderer.root.findAll(
    node =>
      node.props?.style?.flex === 1 ||
      (Array.isArray(node.props?.style) &&
        node.props.style.some(s => s?.flex === 1)),
  )[0];
}

describe('AppHeader', () => {
  // REQ-002: el titulo de la vista activa, y NADA sobre el.
  it('muestra el titulo recibido', () => {
    expect(texts(render())).toContain('Preguntas y Respuestas');
  });

  // REQ-002 (2026-08-19): el rotulo fijo se retiro. La asercion es de AUSENCIA
  // porque el rotulo venia del diseno de referencia y volveria solo con releerlo:
  // sin esto, reaparece sin que nada avise.
  it('no pinta ningun rotulo sobre el titulo', () => {
    const rendered = texts(render());

    expect(rendered).not.toContain('INSTRUCCIÓN');
    expect(rendered).toHaveLength(1);
  });

  // REQ-028: el boton tiene que anunciarse como tal al lector de pantalla.
  it('expone el boton de menu con rol y etiqueta', () => {
    const button = render().root.findByType(Pressable);

    expect(button.props.accessibilityRole).toBe('button');
    expect(button.props.accessibilityLabel).toBe('Abrir menú');
  });

  // REQ-003: pulsar la hamburguesa es lo que abre el menu.
  it('dispara onOpenMenu al pulsar', () => {
    const onOpenMenu = jest.fn();
    const renderer = render({onOpenMenu});

    act(() => {
      renderer.root.findByType(Pressable).props.onPress();
    });

    expect(onOpenMenu).toHaveBeenCalledTimes(1);
  });

  // REQ-002 / DD-008: el centrado no puede depender de la longitud del titulo.
  // La tercera columna vacia es lo que lo garantiza, asi que se comprueba que
  // exista y que mida lo mismo que el boton.
  it('mantiene la columna de equilibrio del mismo ancho que el boton', () => {
    const renderer = render();
    const button = renderer.root.findByType(Pressable);
    const buttonWidth = button.props.style.width;

    // Vistas con ancho fijo igual al del boton: la del boton y la de equilibrio.
    const fixedWidth = renderer.root.findAll(
      node => node.props?.style?.width === buttonWidth,
    );

    expect(buttonWidth).toBeGreaterThan(0);
    expect(fixedWidth.length).toBeGreaterThanOrEqual(2);
  });

  it('centra el bloque del titulo con independencia de su longitud', () => {
    const corto = titleBlock(render({title: 'Datos'}));
    const largo = titleBlock(
      render({title: 'Preguntas y Respuestas de Instrucción Masónica'}),
    );

    expect(corto.props.style.alignItems).toBe('center');
    expect(largo.props.style.alignItems).toBe('center');
    expect(corto.props.style.flex).toBe(largo.props.style.flex);
  });

  // REQ-002 / DD-016: verificado en simulador que con el tamano de texto de
  // accesibilidad maximo (~3.1x) el titulo sin tope invade las columnas
  // laterales y tapa la hamburguesa. El tope es lo que lo impide, asi que se
  // blinda con un test.
  it('acota el escalado tipografico del header', () => {
    const renderer = render();

    for (const node of renderer.root.findAllByType(Text)) {
      expect(node.props.maxFontSizeMultiplier).toBe(MAX_CHROME_FONT_SCALE);
      expect(node.props.numberOfLines).toBeGreaterThan(0);
    }
  });

  // Pero acotar no es desoir: el texto sigue creciendo con la preferencia del
  // usuario, solo que hasta un limite.
  it('no desactiva el escalado, solo lo limita', () => {
    for (const node of render().root.findAllByType(Text)) {
      expect(node.props.allowFontScaling).not.toBe(false);
    }
  });

  // REQ-008: el inset del sistema se suma al padding, no lo sustituye.
  it('suma el inset superior al padding del header', () => {
    const sinInset = render().root.findByProps({accessibilityRole: 'button'});
    expect(sinInset).toBeTruthy();

    const conInset = render({topInset: 59});
    const header = conInset.root.findAll(
      node =>
        Array.isArray(node.props?.style) &&
        node.props.style.some(s => s?.paddingTop != null),
    )[0];
    const paddingTop = header.props.style.find(s => s?.paddingTop != null).paddingTop;

    // 26 dp de diseno + 59 dp de isla dinamica.
    expect(paddingTop).toBe(85);
  });
});
