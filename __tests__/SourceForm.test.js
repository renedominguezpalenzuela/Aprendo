/**
 * Tests del formulario de fuentes.
 *
 * Cubre REQ-010, REQ-011, REQ-011b, REQ-013b, REQ-016 y REQ-055.
 *
 * @format
 */

import React from 'react';
import {Pressable, Text, TextInput} from 'react-native';
import {act, create} from 'react-test-renderer';

import {AddSourceButton, SourceForm} from '../src/sources/SourceForm';
import {
  FORM,
  NAME_ERROR,
  SUBMIT_ERROR,
  SUBMIT_ERROR_FALLBACK,
  URL_ERROR,
} from '../src/sources/sourcesCopy';
import {MAX_NAME_LENGTH, MAX_URL_LENGTH} from '../src/sources/sourceUrl';

const SHEET = 'https://docs.google.com/spreadsheets/d/1Hf36KxLKJtv5Ve/edit?gid=0#gid=0';

function render(props = {}) {
  let renderer;

  act(() => {
    renderer = create(<SourceForm onSubmit={() => ({ok: true})} {...props} />);
  });

  return renderer;
}

/** Los dos campos, en orden: nombre y URL. */
function inputs(renderer) {
  return renderer.root.findAllByType(TextInput);
}

function texts(renderer) {
  return renderer.root
    .findAllByType(Text)
    .map(node => node.props.children)
    .filter(child => typeof child === 'string');
}

function press(renderer, label) {
  const button = renderer.root
    .findAllByType(Pressable)
    .find(node => node.props.accessibilityLabel === label);

  act(() => {
    button.props.onPress();
  });
}

function fill(renderer, {name, url}) {
  const [nameInput, urlInput] = inputs(renderer);

  act(() => {
    if (name != null) {
      nameInput.props.onChangeText(name);
    }
    if (url != null) {
      urlInput.props.onChangeText(url);
    }
  });
}

describe('SourceForm', () => {
  it('muestra los dos campos y la accion de anadir (REQ-010)', () => {
    const renderer = render();

    expect(inputs(renderer)).toHaveLength(2);
    expect(texts(renderer)).toContain(FORM.submit.toUpperCase());
  });

  it('el campo de URL no capitaliza ni autocorrige (REQ-013b)', () => {
    const [, urlInput] = inputs(render());

    expect(urlInput.props.keyboardType).toBe('url');
    expect(urlInput.props.autoCapitalize).toBe('none');
    expect(urlInput.props.autoCorrect).toBe(false);
    expect(urlInput.props.spellCheck).toBe(false);
  });

  it('acota la longitud de los dos campos (REQ-011b, REQ-013b)', () => {
    const [nameInput, urlInput] = inputs(render());

    expect(nameInput.props.maxLength).toBe(MAX_NAME_LENGTH);
    expect(urlInput.props.maxLength).toBe(MAX_URL_LENGTH);
  });

  it('envia nombre y URL ya recortados cuando todo es valido', () => {
    const onSubmit = jest.fn(() => ({ok: true}));
    const renderer = render({onSubmit});

    fill(renderer, {name: '  Aprendiz ', url: `  ${SHEET}  `});
    press(renderer, FORM.submit);

    expect(onSubmit).toHaveBeenCalledWith({name: 'Aprendiz', url: SHEET});
  });

  it('no llama a onSubmit si algo no valida', () => {
    const onSubmit = jest.fn();
    const renderer = render({onSubmit});

    fill(renderer, {name: '', url: 'hola'});
    press(renderer, FORM.submit);

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('muestra los dos errores a la vez, no de uno en uno', () => {
    const renderer = render();

    fill(renderer, {name: '   ', url: 'hola'});
    press(renderer, FORM.submit);

    const rendered = texts(renderer);
    expect(rendered).toContain(NAME_ERROR.EMPTY);
    expect(rendered).toContain(URL_ERROR.NOT_A_SHEET);
  });

  it('el error de URL publicada es el suyo propio (REQ-013c)', () => {
    const renderer = render();

    fill(renderer, {
      name: 'Aprendiz',
      url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ7/pubhtml',
    });
    press(renderer, FORM.submit);

    expect(texts(renderer)).toContain(URL_ERROR.PUBLISHED_URL);
  });

  it('el error queda asociado a SU campo para el lector de pantalla (REQ-055)', () => {
    const renderer = render();

    fill(renderer, {name: 'Aprendiz', url: 'hola'});
    press(renderer, FORM.submit);

    const [nameInput, urlInput] = inputs(renderer);
    expect(nameInput.props.accessibilityLabel).toBe(FORM.nameLabel);
    expect(urlInput.props.accessibilityLabel).toContain(URL_ERROR.NOT_A_SHEET);
  });

  it('vacia los campos tras un alta correcta (REQ-016)', () => {
    const renderer = render({onSubmit: () => ({ok: true})});

    fill(renderer, {name: 'Aprendiz', url: SHEET});
    press(renderer, FORM.submit);

    const [nameInput, urlInput] = inputs(renderer);
    expect(nameInput.props.value).toBe('');
    expect(urlInput.props.value).toBe('');
  });

  it('CONSERVA lo escrito si el alta falla (REQ-016)', () => {
    // Perder la URL pegada por un nombre repetido seria castigar al usuario por
    // un error que se arregla cambiando una palabra.
    const renderer = render({
      onSubmit: () => ({ok: false, reason: 'DUPLICATE_NAME'}),
    });

    fill(renderer, {name: 'Aprendiz', url: SHEET});
    press(renderer, FORM.submit);

    const [nameInput, urlInput] = inputs(renderer);
    expect(nameInput.props.value).toBe('Aprendiz');
    expect(urlInput.props.value).toBe(SHEET);
    expect(texts(renderer)).toContain(NAME_ERROR.DUPLICATE_NAME);
  });
});

describe('SourceForm: motivos que no se pueden anticipar', () => {
  // Un fallo mudo deja al usuario pulsando un boton que aparentemente no hace
  // nada, que es peor que un error.
  it.each([
    ['NOT_FOUND', SUBMIT_ERROR.NOT_FOUND],
    ['DATABASE_ERROR', SUBMIT_ERROR.DATABASE_ERROR],
  ])('muestra un mensaje para %s', (reason, expected) => {
    const renderer = render({onSubmit: () => ({ok: false, reason})});

    fill(renderer, {name: 'Aprendiz', url: SHEET});
    press(renderer, FORM.submit);

    expect(texts(renderer)).toContain(expected);
  });

  it('tiene un mensaje de ultimo recurso para un motivo desconocido', () => {
    const renderer = render({
      onSubmit: () => ({ok: false, reason: 'MOTIVO_QUE_NADIE_PREVIO'}),
    });

    fill(renderer, {name: 'Aprendiz', url: SHEET});
    press(renderer, FORM.submit);

    expect(texts(renderer)).toContain(SUBMIT_ERROR_FALLBACK);
  });
});

describe('SourceForm en modo edicion', () => {
  const initial = {
    id: 7,
    name: 'Aprendiz',
    urlOriginal: SHEET,
    urlCsv: 'x',
    isActive: true,
    createdAt: 1,
  };

  it('arranca relleno y la accion dice Guardar (REQ-030)', () => {
    const renderer = render({initial});
    const [nameInput, urlInput] = inputs(renderer);

    expect(nameInput.props.value).toBe('Aprendiz');
    expect(urlInput.props.value).toBe(SHEET);
    expect(texts(renderer)).toContain(FORM.submit.toUpperCase());
  });

  it('ofrece cancelar si y solo si llega onCancel, tambien en alta (DELTA-003)', () => {
    const cancel = FORM.cancel.toUpperCase();

    expect(texts(render({initial, onCancel: () => {}}))).toContain(cancel);
    expect(texts(render({onCancel: () => {}}))).toContain(cancel);
    expect(texts(render({initial}))).not.toContain(cancel);
    expect(texts(render())).not.toContain(cancel);
  });

  it('cancelar llama a onCancel y no envia nada', () => {
    const onCancel = jest.fn();
    const onSubmit = jest.fn(() => ({ok: true}));
    const renderer = render({onCancel, onSubmit});

    fill(renderer, {name: 'Aprendiz', url: SHEET});
    press(renderer, FORM.cancel);

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('no vacia los campos al guardar: se sigue editando lo mismo', () => {
    const renderer = render({initial, onSubmit: () => ({ok: true})});

    press(renderer, FORM.submit);

    expect(inputs(renderer)[0].props.value).toBe('Aprendiz');
  });

  it('al cambiar a OTRA fuente recarga los campos', () => {
    let renderer;
    act(() => {
      renderer = create(<SourceForm initial={initial} onSubmit={() => ({ok: true})} />);
    });

    act(() => {
      renderer.update(
        <SourceForm
          initial={{...initial, id: 8, name: 'Companero'}}
          onSubmit={() => ({ok: true})}
        />,
      );
    });

    expect(inputs(renderer)[0].props.value).toBe('Companero');
  });

  it('un refresco del store con la MISMA fuente no borra lo que se escribe', () => {
    // El store publica objetos nuevos en cada refresco. Si el efecto dependiera
    // del objeto y no del id, esto borraria lo que el usuario esta tecleando.
    let renderer;
    act(() => {
      renderer = create(<SourceForm initial={initial} onSubmit={() => ({ok: true})} />);
    });

    fill(renderer, {name: 'Aprendiz editado'});

    act(() => {
      renderer.update(
        <SourceForm initial={{...initial}} onSubmit={() => ({ok: true})} />,
      );
    });

    expect(inputs(renderer)[0].props.value).toBe('Aprendiz editado');
  });
});

describe('SourceForm: accion y foco (delta formulario-plegable)', () => {
  it('en alta la accion tambien dice Guardar, no Añadir (DELTA-002)', () => {
    const shown = texts(render());

    expect(shown).toContain(FORM.submit.toUpperCase());
    expect(shown).not.toContain(FORM.open.toUpperCase());
  });

  it('enfoca el nombre solo si se pide (DD-018)', () => {
    const [nameWith, urlWith] = inputs(render({autoFocus: true}));
    const [nameWithout] = inputs(render());

    expect(nameWith.props.autoFocus).toBe(true);
    expect(urlWith.props.autoFocus).toBeFalsy();
    expect(nameWithout.props.autoFocus).toBe(false);
  });
});

describe('AddSourceButton', () => {
  function renderButton(onPress = () => {}) {
    let renderer;
    act(() => {
      renderer = create(<AddSourceButton onPress={onPress} />);
    });
    return renderer;
  }

  it('dice Añadir y no pinta ningun campo (DELTA-001)', () => {
    const renderer = renderButton();

    expect(texts(renderer)).toEqual([FORM.open.toUpperCase()]);
    expect(renderer.root.findAllByType(TextInput)).toHaveLength(0);
  });

  it('se anuncia como boton que despliega, con su pista (DELTA-006)', () => {
    const button = renderButton().root.findByType(Pressable);

    expect(button.props.accessibilityRole).toBe('button');
    expect(button.props.accessibilityLabel).toBe(FORM.open);
    expect(button.props.accessibilityHint).toBe(FORM.openHint);
    expect(button.props.accessibilityState).toEqual({expanded: false});
  });

  it('pulsarlo llama a onPress', () => {
    const onPress = jest.fn();

    press(renderButton(onPress), FORM.open);

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
