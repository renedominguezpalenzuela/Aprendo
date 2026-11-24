/**
 * Tests de la pantalla Datos.
 *
 * Corre contra la base real de `node:sqlite`: la pantalla, el store y el
 * repositorio en la misma cadena, sin mockear ninguna capa intermedia.
 *
 * Cubre REQ-005, REQ-010, REQ-019, REQ-021, REQ-024 y REQ-025 de data-sources, el
 * delta formulario-plegable (DELTA-001 a DELTA-005, REQ-016 modificado) y el
 * cableado de la actualizacion de deck-sync (REQ-010 a REQ-014).
 *
 * @format
 */

import React from 'react';
import {Alert, FlatList, Pressable, ScrollView, Text, TextInput} from 'react-native';
import {act, create} from 'react-test-renderer';

import {DataScreen} from '../src/sources/DataScreen';
import {resetDatabaseForTests} from '../src/db/database';
import {
  initSources,
  refresh,
  resetSourcesForTests,
} from '../src/sources/sourcesStore';
import {addSource} from '../src/sources/sourcesRepo';
import {DATABASE_ERROR, EMPTY_LIST, FORM, ROW} from '../src/sources/sourcesCopy';
import {initDecks, resetDecksForTests} from '../src/decks/deckStore';
import {resetDeckSyncForTests, startSync} from '../src/decks/deckSyncStore';
import {insertPendingQuestion, promoteDeck} from '../src/decks/decksRepo';
import {NEVER_SYNCED, SYNC} from '../src/decks/decksCopy';
import {makeMemoryDriver} from './support/nodeSqliteDriver';

const SHEET = 'https://docs.google.com/spreadsheets/d/1Hf36KxLKJtv5Ve/edit';

function render() {
  let renderer;

  act(() => {
    renderer = create(<DataScreen />);
  });

  return renderer;
}

function texts(renderer) {
  return renderer.root
    .findAllByType(Text)
    .map(node => node.props.children)
    .filter(child => typeof child === 'string');
}

function press(renderer, matcher) {
  const button = renderer.root
    .findAllByType(Pressable)
    .find(node => matcher(node.props.accessibilityLabel ?? ''));

  act(() => {
    button.props.onPress();
  });
}

function fill(renderer, {name, url}) {
  const [nameInput, urlInput] = renderer.root.findAllByType(TextInput);

  act(() => {
    nameInput.props.onChangeText(name);
    urlInput.props.onChangeText(url);
  });
}

beforeEach(() => {
  // VirtualizedList programa un repintado por temporizador que cae fuera de
  // `act` y llena la salida de avisos. Con temporizadores falsos ese trabajo no
  // llega a dispararse y los avisos que queden seran de verdad.
  jest.useFakeTimers();
  resetDatabaseForTests();
  resetSourcesForTests();
  resetDecksForTests();
  resetDeckSyncForTests();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('DataScreen', () => {
  beforeEach(() => {
    initSources(makeMemoryDriver());
  });

  it('muestra el formulario arriba y la lista debajo (REQ-010)', () => {
    const renderer = render();

    expect(renderer.root.findAllByType(TextInput)).toHaveLength(2);
    expect(renderer.root.findAllByType(FlatList)).toHaveLength(1);
  });

  it('un solo contenedor desplazable, sin lista dentro de ScrollView (DD-010)', () => {
    // Una lista virtualizada dentro de un ScrollView se comporta mal y React
    // Native avisa por consola.
    const renderer = render();

    expect(renderer.root.findAllByType(ScrollView)).toHaveLength(1);
    expect(renderer.root.findAllByType(FlatList)).toHaveLength(1);
  });

  it('sin fuentes explica que aun no hay ninguna, con el formulario usable (REQ-024)', () => {
    const renderer = render();
    const rendered = texts(renderer);

    expect(rendered).toContain(EMPTY_LIST.title);
    expect(rendered).toContain(EMPTY_LIST.body);
    // El formulario sigue ahi: es lo unico que puede sacar al usuario de aqui.
    expect(renderer.root.findAllByType(TextInput)).toHaveLength(2);
  });

  it('anadir desde el formulario mete la fuente en la lista', () => {
    const renderer = render();

    fill(renderer, {name: 'Aprendiz', url: SHEET});
    press(renderer, l => l === FORM.submit);

    expect(texts(renderer)).toContain('Aprendiz');
    expect(texts(renderer)).not.toContain(EMPTY_LIST.title);
  });

  it('la primera fuente entra ya activa (REQ-017)', () => {
    const renderer = render();

    fill(renderer, {name: 'Aprendiz', url: SHEET});
    press(renderer, l => l === FORM.submit);

    expect(texts(renderer)).toContain(ROW.active.toUpperCase());
  });

  it('la fuente activa se pinta la primera (REQ-021)', () => {
    addSource({name: 'A', url: SHEET}, 1);
    addSource({name: 'B', url: SHEET}, 2);
    refresh();
    const renderer = render();

    press(renderer, l => l === 'Activar el test B');

    const nombres = texts(renderer).filter(t => t === 'A' || t === 'B');
    expect(nombres[0]).toBe('B');
  });

  it('activar NO navega a ninguna otra vista (REQ-023)', () => {
    addSource({name: 'A', url: SHEET}, 1);
    addSource({name: 'B', url: SHEET}, 2);
    refresh();
    const renderer = render();

    press(renderer, l => l === 'Activar el test B');

    // La pantalla sigue siendo esta: el boton Anadir y la lista intactos.
    expect(texts(renderer)).toContain(FORM.open.toUpperCase());
    expect(texts(renderer)).toContain('A');
  });

  it('editar rellena el formulario con esa fuente (REQ-030)', () => {
    addSource({name: 'Aprendiz', url: SHEET}, 1);
    refresh();
    const renderer = render();

    press(renderer, l => l === `${ROW.edit} Aprendiz`);

    const [nameInput] = renderer.root.findAllByType(TextInput);
    expect(nameInput.props.value).toBe('Aprendiz');
    expect(texts(renderer)).toContain(FORM.cancel.toUpperCase());
  });

  it('guardar la edicion con exito oculta el formulario (REQ-016)', () => {
    addSource({name: 'Aprendiz', url: SHEET}, 1);
    refresh();
    const renderer = render();

    press(renderer, l => l === `${ROW.edit} Aprendiz`);
    fill(renderer, {name: 'Primer Grado', url: SHEET});
    press(renderer, l => l === FORM.submit);

    expect(texts(renderer)).toContain('Primer Grado');
    expect(renderer.root.findAllByType(TextInput)).toHaveLength(0);
    expect(texts(renderer)).toContain(FORM.open.toUpperCase());
  });

  it('cancelar la edicion oculta el formulario sin tocar nada', () => {
    addSource({name: 'Aprendiz', url: SHEET}, 1);
    refresh();
    const renderer = render();

    press(renderer, l => l === `${ROW.edit} Aprendiz`);
    press(renderer, l => l === FORM.cancel);

    expect(renderer.root.findAllByType(TextInput)).toHaveLength(0);
    expect(texts(renderer)).toContain(FORM.open.toUpperCase());
    expect(texts(renderer)).toContain('Aprendiz');
  });

  it('no permite que los toques se pierdan con el teclado abierto (REQ-019)', () => {
    const lista = render().root.findByType(FlatList);

    expect(lista.props.keyboardShouldPersistTaps).toBe('handled');
  });
});

describe('DataScreen: formulario plegable (delta formulario-plegable)', () => {
  beforeEach(() => {
    initSources(makeMemoryDriver());
  });

  function withSources(...names) {
    names.forEach((name, i) => addSource({name, url: SHEET}, i + 1));
    refresh();
    return render();
  }

  const inputs = renderer => renderer.root.findAllByType(TextInput);
  const shown = (renderer, label) => texts(renderer).includes(label.toUpperCase());

  it('con fuentes arranca oculto: solo el boton Añadir (DELTA-001)', () => {
    const renderer = withSources('Aprendiz');

    expect(inputs(renderer)).toHaveLength(0);
    expect(shown(renderer, FORM.open)).toBe(true);
    expect(shown(renderer, FORM.submit)).toBe(false);
    // La lista sigue debajo.
    expect(texts(renderer)).toContain('Aprendiz');
  });

  it('Añadir despliega el formulario vacio con Guardar, Cancelar y el foco (DELTA-002)', () => {
    const renderer = withSources('Aprendiz');

    press(renderer, l => l === FORM.open);

    const [nameInput, urlInput] = inputs(renderer);
    expect(nameInput.props.value).toBe('');
    expect(urlInput.props.value).toBe('');
    expect(nameInput.props.autoFocus).toBe(true);
    expect(shown(renderer, FORM.submit)).toBe(true);
    expect(shown(renderer, FORM.cancel)).toBe(true);
    expect(shown(renderer, FORM.open)).toBe(false);
  });

  it('Cancelar oculta, no guarda, y al reabrir esta vacio (DELTA-003)', () => {
    const renderer = withSources('Aprendiz');

    press(renderer, l => l === FORM.open);
    fill(renderer, {name: 'Companero', url: SHEET});
    press(renderer, l => l === FORM.cancel);

    expect(inputs(renderer)).toHaveLength(0);
    expect(texts(renderer)).not.toContain('Companero');

    press(renderer, l => l === FORM.open);
    expect(inputs(renderer)[0].props.value).toBe('');
    expect(inputs(renderer)[1].props.value).toBe('');
  });

  it('sin fuentes sale desplegado, sin Cancelar y sin foco (DELTA-004, DD-018)', () => {
    const renderer = render();

    expect(inputs(renderer)).toHaveLength(2);
    expect(shown(renderer, FORM.submit)).toBe(true);
    expect(shown(renderer, FORM.cancel)).toBe(false);
    expect(shown(renderer, FORM.open)).toBe(false);
    expect(inputs(renderer)[0].props.autoFocus).toBe(false);
    expect(texts(renderer)).toContain(EMPTY_LIST.title);
  });

  it('al borrar la ultima fuente se despliega solo (DELTA-004, DD-016)', () => {
    const renderer = withSources('Aprendiz');
    expect(inputs(renderer)).toHaveLength(0);

    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    press(renderer, l => l === `${ROW.remove} Aprendiz`);
    const destructive = alert.mock.calls[0][2].find(b => b.style === 'destructive');
    act(() => {
      destructive.onPress();
    });
    alert.mockRestore();

    expect(texts(renderer)).toContain(EMPTY_LIST.title);
    expect(inputs(renderer)).toHaveLength(2);
    expect(shown(renderer, FORM.cancel)).toBe(false);
  });

  it('al añadir la primera fuente se oculta (DD-016)', () => {
    const renderer = render();

    fill(renderer, {name: 'Aprendiz', url: SHEET});
    press(renderer, l => l === FORM.submit);

    expect(texts(renderer)).toContain('Aprendiz');
    expect(inputs(renderer)).toHaveLength(0);
    expect(shown(renderer, FORM.open)).toBe(true);
  });

  it('guardar un alta con exito la mete en la lista y oculta (REQ-016)', () => {
    const renderer = withSources('Aprendiz');

    press(renderer, l => l === FORM.open);
    fill(renderer, {name: 'Companero', url: SHEET});
    press(renderer, l => l === FORM.submit);

    expect(texts(renderer)).toContain('Companero');
    expect(inputs(renderer)).toHaveLength(0);
    expect(shown(renderer, FORM.open)).toBe(true);
  });

  it('si el alta falla sigue desplegado, con lo escrito y el error (REQ-016)', () => {
    const renderer = withSources('Aprendiz');

    press(renderer, l => l === FORM.open);
    fill(renderer, {name: 'aprendiz', url: SHEET});
    press(renderer, l => l === FORM.submit);

    const [nameInput, urlInput] = inputs(renderer);
    expect(nameInput.props.value).toBe('aprendiz');
    expect(urlInput.props.value).toBe(SHEET);
    expect(shown(renderer, FORM.submit)).toBe(true);
    // El mensaje de nombre en uso queda asociado al campo (REQ-055).
    expect(nameInput.props.accessibilityLabel).not.toBe(FORM.nameLabel);
  });

  it('Editar despliega relleno, con Cancelar y el foco (DELTA-005)', () => {
    const renderer = withSources('Aprendiz');

    press(renderer, l => l === `${ROW.edit} Aprendiz`);

    const [nameInput, urlInput] = inputs(renderer);
    expect(nameInput.props.value).toBe('Aprendiz');
    expect(urlInput.props.value).toBe(SHEET);
    expect(nameInput.props.autoFocus).toBe(true);
    expect(shown(renderer, FORM.cancel)).toBe(true);
  });

  it('Editar con un alta a medias descarta lo escrito (DELTA-005)', () => {
    const renderer = withSources('Aprendiz');

    press(renderer, l => l === FORM.open);
    fill(renderer, {name: 'Companero', url: SHEET});
    press(renderer, l => l === `${ROW.edit} Aprendiz`);

    expect(inputs(renderer)[0].props.value).toBe('Aprendiz');
  });

  it('borrar la fuente en edicion cierra el formulario', () => {
    const renderer = withSources('Aprendiz', 'Companero');

    press(renderer, l => l === `${ROW.edit} Companero`);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    press(renderer, l => l === `${ROW.remove} Companero`);
    const destructive = alert.mock.calls[0][2].find(b => b.style === 'destructive');
    act(() => {
      destructive.onPress();
    });
    alert.mockRestore();

    expect(texts(renderer)).not.toContain('Companero');
    expect(inputs(renderer)).toHaveLength(0);
    expect(shown(renderer, FORM.open)).toBe(true);
  });
});

describe('DataScreen con la base rota', () => {
  it('muestra el error de almacenamiento y ningun formulario (REQ-005)', () => {
    initSources(() => {
      throw new Error('disco lleno');
    });

    const renderer = render();
    const rendered = texts(renderer);

    expect(rendered).toContain(DATABASE_ERROR.title);
    expect(rendered).toContain(DATABASE_ERROR.body);
    // Un formulario que no puede guardar nada seria una trampa.
    expect(renderer.root.findAllByType(TextInput)).toHaveLength(0);
  });
});

// ─── deck-sync ───────────────────────────────────────────────────────────────

describe('cableado de la actualizacion (deck-sync REQ-010 a REQ-014)', () => {
  beforeEach(() => {
    initSources(makeMemoryDriver());
    initDecks();
  });

  it('cada fila trae su accion Actualizar (REQ-010)', () => {
    act(() => {
      addSource({name: 'Fisica', url: SHEET});
      addSource({name: 'Mates', url: `${SHEET}?gid=2`});
      refresh();
    });

    const renderer = render();
    const acciones = texts(renderer).filter(
      text => text === SYNC.action.toUpperCase(),
    );

    // Una por fila, esten activas o no.
    expect(acciones).toHaveLength(2);
  });

  it('las fuentes sin actualizar lo dicen (REQ-011)', () => {
    act(() => {
      addSource({name: 'Fisica', url: SHEET});
      refresh();
    });

    expect(texts(render())).toContain(NEVER_SYNCED);
  });

  it('reparte a cada fila SU resumen, no el de otra (REQ-014)', () => {
    act(() => {
      const fisica = addSource({name: 'Fisica', url: SHEET}).id;
      addSource({name: 'Mates', url: `${SHEET}?gid=2`});

      for (let i = 0; i < 3; i += 1) {
        insertPendingQuestion(fisica, {
          position: i,
          question: `P${i}`,
          answer1: `R${i}`,
          answer2: null,
          imageQuestionUrl: null,
          imageAnswerUrl: null,
        });
      }

      promoteDeck(fisica, new Date(2026, 7, 18, 9, 5).getTime());
      refresh();
      initDecks();
    });

    const shown = texts(render()).join(' | ');

    // Fisica tiene tres preguntas y fecha; Mates sigue sin actualizar.
    expect(shown).toContain('3 preguntas');
    expect(shown).toContain('18 ago 2026');
    expect(shown).toContain(NEVER_SYNCED);
  });

  it('el aviso de desenlace sale en UNA sola fila, no en todas', async () => {
    let fisica;

    act(() => {
      fisica = addSource({name: 'Fisica', url: SHEET}).id;
      addSource({name: 'Mates', url: `${SHEET}?gid=2`});
      addSource({name: 'Quimica', url: `${SHEET}?gid=3`});
      refresh();
    });

    // Se ESPERA la actualizacion: sin el await, el estado de error no ha llegado
    // cuando se pinta y el test no comprueba nada.
    await act(async () => {
      await startSync(
        {id: fisica, name: 'Fisica', urlCsv: 'https://x/csv'},
        {
          net: {
            downloadText: () =>
              Promise.resolve({ok: false, reason: 'NO_CONNECTION'}),
            downloadBytes: () => Promise.resolve({ok: false, reason: 'ABORTED'}),
          },
        },
      );
    });

    const renderer = render();
    const reintentos = texts(renderer).filter(
      text => text === SYNC.retry.toUpperCase(),
    );

    // Sin filtrar por `sourceId`, el aviso de una actualizacion apareceria repetido
    // en las tres filas de la lista.
    expect(reintentos).toHaveLength(1);
  });
});
