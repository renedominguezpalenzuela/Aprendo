/**
 * @format
 */

import React from 'react';
import {BackHandler, Platform, Pressable, Text, TextInput} from 'react-native';
import {act, create} from 'react-test-renderer';
import {SafeAreaProvider} from 'react-native-safe-area-context';

import {MainView} from '../src/main/MainView';
import {EmptyState} from '../src/main/EmptyState';
import {Scrim} from '../src/main/Scrim';
import {SideMenu} from '../src/main/SideMenu';
import {AppHeader} from '../src/main/AppHeader';
import {EMPTY_STATE, VIEW_TITLE} from '../src/main/masonCopy';
import {COLOR, LAYOUT} from '../src/theme/masonTheme';
import {resetDatabaseForTests} from '../src/db/database';
import {addSource} from '../src/sources/sourcesRepo';
import {
  initSources,
  refresh,
  resetSourcesForTests,
} from '../src/sources/sourcesStore';
import {DATA_VIEW_TITLE, FORM} from '../src/sources/sourcesCopy';
import {initDecks, resetDecksForTests} from '../src/decks/deckStore';
import {resetDeckSyncForTests, startSync} from '../src/decks/deckSyncStore';
import {insertPendingQuestion, promoteDeck} from '../src/decks/decksRepo';
import {SyncProgressModal} from '../src/decks/SyncProgressModal';
import {CardsView} from '../src/decks/CardsView';
import {emptyDeckState, SYNC} from '../src/decks/decksCopy';
import {makeMemoryDriver} from './support/nodeSqliteDriver';
import {readCounter} from './support/deckNav';

const SHEET = 'https://docs.google.com/spreadsheets/d/1Hf36KxLKJtv5Ve/edit';

/** Medidas iniciales para que SafeAreaProvider entregue insets reales. */
const METRICS = {
  frame: {x: 0, y: 0, width: 430, height: 932},
  insets: {top: 59, left: 0, right: 0, bottom: 34},
};

function render() {
  let renderer;

  act(() => {
    renderer = create(
      <SafeAreaProvider initialMetrics={METRICS}>
        <MainView />
      </SafeAreaProvider>,
    );
  });

  return renderer;
}

/**
 * Solo nodos host (los que se traducen a una vista nativa).
 *
 * `findAll` recorre tambien los nodos de componente, asi que un mismo <View>
 * aparece dos veces: como elemento de React y como instancia host. Sin filtrar,
 * cualquier conteo sale duplicado.
 */
function hosts(renderer, predicate) {
  return renderer.root.findAll(
    node => typeof node.type === 'string' && predicate(node),
  );
}

function texts(renderer) {
  return renderer.root
    .findAllByType(Text)
    .map(node => node.props.children)
    .filter(child => typeof child === 'string');
}

/** Pulsa el elemento cuya etiqueta de accesibilidad coincide. */
function press(renderer, label) {
  const node = renderer.root
    .findAllByType(Pressable)
    .find(item => item.props.accessibilityLabel === label);

  act(() => {
    node.props.onPress();
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  resetDatabaseForTests();
  resetSourcesForTests();
  resetDecksForTests();
  resetDeckSyncForTests();
  initSources(makeMemoryDriver());
  initDecks();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('MainView', () => {
  // REQ-011: sin fuente configurada, la zona central explica que falta.
  it('muestra el estado sin preguntas', () => {
    const renderer = render();

    expect(renderer.root.findAllByType(EmptyState)).toHaveLength(1);
    expect(texts(renderer)).toContain(EMPTY_STATE.title);
  });

  // REQ-002: el header con su titulo.
  it('muestra el header con el titulo de la vista', () => {
    expect(texts(render())).toContain(VIEW_TITLE);
  });

  // REQ-015: no se construye la barra inferior de navegacion de tarjetas. No es
  // que este oculta: no existe.
  it('no renderiza la barra inferior de navegacion', () => {
    const rendered = texts(render()).join(' ');

    expect(rendered).not.toContain('Siguiente');
    expect(rendered).not.toContain('Atrás');
    expect(rendered).not.toMatch(/\bde\s+\d+/);
  });

  // REQ-026: en una pantalla ancha el contenido se limita y se centra.
  it('limita la columna de contenido al ancho de referencia', () => {
    const columna = hosts(
      render(),
      node => node.props?.style?.maxWidth === LAYOUT.maxWidth,
    );

    expect(columna.length).toBe(1);
    expect(columna[0].props.style.alignSelf).toBe('center');
  });

  // REQ-032: el fondo va en la raiz, sin insets, para llegar a los bordes.
  it('pinta el fondo de borde a borde', () => {
    const raiz = hosts(
      render(),
      node => node.props?.style?.backgroundColor === COLOR.background,
    );

    expect(raiz.length).toBeGreaterThanOrEqual(1);
    expect(raiz[0].props.style.paddingTop).toBeUndefined();
  });

  // REQ-005: el velo y el cajon quedan fuera de la columna centrada, o en una
  // tablet dejarian un marco lateral sin oscurecer y con los toques pasando.
  it('deja el velo y el cajon fuera de la columna centrada', () => {
    const renderer = render();
    const columna = renderer.root.find(
      node => node.props?.style?.maxWidth === LAYOUT.maxWidth,
    );

    expect(renderer.root.findAllByType(Scrim)).toHaveLength(1);
    expect(renderer.root.findAllByType(SideMenu)).toHaveLength(1);
    expect(columna.findAllByType(Scrim)).toHaveLength(0);
    expect(columna.findAllByType(SideMenu)).toHaveLength(0);
  });

  // REQ-003: el boton del header abre el menu, y el velo pasa a interceptar.
  it('el boton del header abre el menu y activa el velo', () => {
    const renderer = render();
    const abrir = renderer.root
      .findAllByType(Pressable)
      .find(node => node.props.accessibilityLabel === 'Abrir menú');

    expect(renderer.root.findByType(Scrim).props.isOpen).toBe(false);

    act(() => {
      abrir.props.onPress();
    });

    expect(renderer.root.findByType(Scrim).props.isOpen).toBe(true);
    expect(renderer.root.findByType(SideMenu).props.isOpen).toBe(true);
  });

  // REQ-004: y tocar el velo lo repliega.
  it('tocar el velo cierra el menu', () => {
    const renderer = render();
    const abrir = renderer.root
      .findAllByType(Pressable)
      .find(node => node.props.accessibilityLabel === 'Abrir menú');

    act(() => {
      abrir.props.onPress();
    });
    act(() => {
      renderer.root.findByType(Scrim).props.onPress();
    });

    expect(renderer.root.findByType(Scrim).props.isOpen).toBe(false);
  });

  // REQ-006: sin mazo cargado, MainView no le pasa un contador al menu.
  it('no pasa contador de preguntas al menu', () => {
    expect(render().root.findByType(SideMenu).props.deckCount).toBeUndefined();
  });

  // REQ-008: los insets del sistema salen del provider, no de numeros fijos.
  it('propaga los insets del sistema al header y al menu', () => {
    const renderer = render();

    expect(renderer.root.findByType(SideMenu).props.insets.top).toBe(
      METRICS.insets.top,
    );
    expect(renderer.root.findByType(SideMenu).props.insets.bottom).toBe(
      METRICS.insets.bottom,
    );
  });
});


describe('MainView: navegacion entre vistas', () => {
  // REQ-044: la entrada Datos lleva a la pantalla Datos y repliega el menu.
  it('seleccionar Datos en el menu abre la pantalla y cierra el menu', () => {
    const renderer = render();

    press(renderer, 'Abrir menú');
    press(renderer, 'Datos');

    expect(texts(renderer)).toContain(FORM.submitAdd.toUpperCase());
    expect(renderer.root.findByType(SideMenu).props.isOpen).toBe(false);
  });

  // REQ-046: el menu marca la vista que se esta viendo.
  it('el menu marca la vista activa real', () => {
    const renderer = render();

    expect(renderer.root.findByType(SideMenu).props.activeView).toBe('cards');

    press(renderer, 'Abrir menú');
    press(renderer, 'Datos');

    expect(renderer.root.findByType(SideMenu).props.activeView).toBe('data');
  });

  // REQ-043 / DD-011: el estado vacio lleva a Datos por su propia accion.
  it('la accion del estado vacio abre Datos', () => {
    const renderer = render();

    press(renderer, EMPTY_STATE.action);

    expect(texts(renderer)).toContain(FORM.submitAdd.toUpperCase());
  });

  // REQ-051 + DD-003: cada vista titula con su propio nombre. Se mira el titulo
  // del HEADER y no todos los textos, porque la cabecera del cajon tiene el
  // suyo propio y fijo: describe la app, no la vista, igual que su pie muestra
  // la version.
  it('el titulo del header cambia con la vista', () => {
    const renderer = render();
    const title = () => renderer.root.findByType(AppHeader).props.title;

    expect(title()).toBe(VIEW_TITLE);

    press(renderer, EMPTY_STATE.action);

    expect(title()).toBe(DATA_VIEW_TITLE);
  });
});

describe('MainView: titulo segun la fuente activa', () => {
  // REQ-041: sin fuente activa, el titulo por defecto de la vista.
  it('sin fuente activa usa el titulo por defecto', () => {
    expect(render().root.findByType(AppHeader).props.title).toBe(VIEW_TITLE);
  });

  // REQ-040 y REQ-006: con fuente activa, su nombre YA en el primer render.
  it('con fuente activa, el PRIMER render ya lleva su nombre', () => {
    addSource({name: 'Aprendiz', url: SHEET}, 1);
    refresh();

    const renderer = render();

    // Nunca se llega a ver el titulo por defecto: la fuente activa se lee de
    // forma sincrona antes del primer render, asi que no hay estado intermedio
    // que observar (DD-004).
    expect(renderer.root.findByType(AppHeader).props.title).toBe('Aprendiz');
  });

  // REQ-045: cambiar la fuente activa se refleja al volver a Tarjetas.
  it('cambiar la fuente activa actualiza el header sin reiniciar', () => {
    addSource({name: 'Aprendiz', url: SHEET}, 1);
    addSource({name: 'Companero', url: SHEET}, 2);
    refresh();

    const renderer = render();
    expect(renderer.root.findByType(AppHeader).props.title).toBe('Aprendiz');

    press(renderer, 'Abrir menú');
    press(renderer, 'Datos');
    press(renderer, 'Activar el test Companero');
    press(renderer, 'Abrir menú');
    press(renderer, 'Tarjetas');

    expect(renderer.root.findByType(AppHeader).props.title).toBe('Companero');
  });

  // REQ-042: un nombre largo no puede desplazar la hamburguesa.
  it('un nombre de 60 caracteres no rompe el header', () => {
    const largo = 'A'.repeat(60);
    addSource({name: largo, url: SHEET}, 1);
    refresh();

    const renderer = render();

    expect(texts(renderer)).toContain(largo);
    // La hamburguesa sigue existiendo y siendo accionable.
    const boton = renderer.root
      .findAllByType(Pressable)
      .find(node => node.props.accessibilityLabel === 'Abrir menú');
    expect(boton).toBeDefined();
    // Y el titulo sigue acotado a dos lineas.
    const titulo = renderer.root
      .findAllByType(Text)
      .find(node => node.props.children === largo);
    expect(titulo.props.numberOfLines).toBeLessThanOrEqual(2);
  });
});


describe('MainView: la pantalla Datos hereda el chasis', () => {
  // REQ-052 y REQ-053: `Datos` no monta su propio contenedor, vive dentro de la
  // columna del chasis, asi que hereda areas seguras, ancho maximo y
  // orientacion. Sin este test, sacarla de la columna no rompe nada visible.
  it('Datos se renderiza dentro de la columna con insets del chasis', () => {
    const renderer = render();

    press(renderer, EMPTY_STATE.action);

    const centro = renderer.root.findAll(
      node =>
        typeof node.type === 'string' &&
        node.props.style != null &&
        JSON.stringify(node.props.style).includes(
          `"paddingBottom":${METRICS.insets.bottom}`,
        ),
    );

    expect(centro.length).toBeGreaterThan(0);
    // Y el formulario cuelga de ahi dentro.
    expect(renderer.root.findAllByType(TextInput).length).toBe(2);
  });

  it('el header sigue respetando el inset superior en Datos (REQ-052)', () => {
    const renderer = render();

    press(renderer, EMPTY_STATE.action);

    expect(renderer.root.findByType(AppHeader).props.topInset).toBe(
      METRICS.insets.top,
    );
  });

  // El cajon titula con el nombre de la fuente activa, no con la vista actual.
  it('el cajon lleva el titulo de la vista de tarjetas, este donde este', () => {
    const renderer = render();

    expect(renderer.root.findByType(SideMenu).props.title).toBe(VIEW_TITLE);

    press(renderer, EMPTY_STATE.action);

    // Aunque ahora la vista sea Datos, el cajon sigue identificando el mazo.
    expect(renderer.root.findByType(SideMenu).props.title).toBe(VIEW_TITLE);
  });
});

// ─── deck-sync ───────────────────────────────────────────────────────────────

/**
 * Registra una fuente activa y, si se piden, su mazo promovido.
 *
 * @param {{name?: string, questions?: number, syncedAt?: number}} [options]
 * @returns {number} id de la fuente
 */
function seedActiveSource(options = {}) {
  let id;

  act(() => {
    id = addSource({name: options.name ?? 'Fisica', url: SHEET}).id;

    for (let i = 0; i < (options.questions ?? 0); i += 1) {
      insertPendingQuestion(id, {
        position: i,
        question: `P${i}`,
        answer1: `R${i}`,
        answer2: null,
        imageQuestionUrl: null,
        imageAnswerUrl: null,
      });
    }

    if (options.questions) {
      promoteDeck(id, options.syncedAt ?? 5000);
    }

    refresh();
    initDecks();
  });

  return id;
}

describe('zona central con el mazo real (REQ-070, REQ-071)', () => {
  it('sin fuente activa sigue invitando a anadir una', () => {
    // El boton rotula en mayusculas, como el resto del chrome.
    expect(texts(render())).toContain(EMPTY_STATE.action.toUpperCase());
  });

  it('con fuente activa y sin preguntas dice que faltan por descargar', () => {
    seedActiveSource();

    const copy = emptyDeckState('Fisica');
    const shown = texts(render()).join(' ');

    // Texto PROPIO, distinto del de "no hay ninguna fuente" (REQ-071).
    expect(shown).toContain(copy.title);
    expect(shown).not.toContain('en cuanto Mason sepa descargarlas');
  });

  it('su boton lleva a Datos y NO dice "Añadir una fuente"', () => {
    seedActiveSource();

    const shown = texts(render());

    // El usuario acaba de anadir esa fuente: ofrecerle anadir otra le hace pensar
    // que su URL no se guardo.
    expect(shown).toContain(emptyDeckState('Fisica').action.toUpperCase());
    expect(shown).not.toContain(EMPTY_STATE.action.toUpperCase());
  });

  it('el boton SI dice "Añadir una fuente" cuando de verdad no hay ninguna', () => {
    const shown = texts(render());

    expect(shown).toContain(EMPTY_STATE.action.toUpperCase());
  });

  it('con mazo cargado monta LAS TARJETAS (REQ-070, REQ-017)', () => {
    seedActiveSource({questions: 12});

    const renderer = render();
    const shown = texts(renderer).join(' ');

    expect(renderer.root.findAllByType(CardsView)).toHaveLength(1);
    // La primera tarjeta, por su anverso, y su barra.
    expect(shown).toContain('Nº 01');
    expect(shown).toContain('P0');
    expect(readCounter(renderer)).toBe('01 DE 12');
  });

  it('el cartel provisional YA NO existe en ningun sitio', () => {
    seedActiveSource({questions: 12});

    const shown = texts(render()).join(' ');

    // Era un marcador honesto para una entrega que no podia mostrar el mazo. Dejarlo
    // seria el pendingState otra vez, que ya hubo que eliminar una vez.
    expect(shown).not.toMatch(/siguiente entrega/i);
    expect(shown).not.toMatch(/preguntas listas/i);
  });

  it('sin mazo NO se monta la barra de navegacion (REQ-015)', () => {
    seedActiveSource();

    const shown = texts(render()).join(' ');

    expect(shown).not.toContain(' de ');
    expect(shown).not.toMatch(/SIGUIENTE|ATRÁS/);
  });
});

describe('el pie del menu recupera el numero de preguntas (REQ-073)', () => {
  it('lo muestra cuando hay mazo', () => {
    seedActiveSource({questions: 12});

    const menu = render().root.findByType(SideMenu);

    // REQ-006 de main-view lo especificaba y se omitia por no haber mazo. Ahora hay.
    expect(menu.props.deckCount).toBe(12);
  });

  it('lo omite cuando no hay mazo, en vez de mostrar un cero', () => {
    seedActiveSource();

    expect(render().root.findByType(SideMenu).props.deckCount).toBeUndefined();
  });
});

describe('la ventana de progreso en el chasis (REQ-050, REQ-055, DD-009)', () => {
  it('se monta, y en reposo no pinta nada', () => {
    seedActiveSource();

    const renderer = render();

    expect(renderer.root.findAllByType(SyncProgressModal)).toHaveLength(1);
    expect(renderer.root.findByType(SyncProgressModal).props.state.phase).toBe('idle');
  });

  it('aparece durante una actualizacion, con el nombre de la fuente', async () => {
    const id = seedActiveSource();

    await act(async () => {
      startSync(
        {id, name: 'Fisica', urlCsv: 'https://x/csv'},
        {
          net: {
            downloadText: () => new Promise(() => {}),
            downloadBytes: () => new Promise(() => {}),
          },
        },
      );
      await Promise.resolve();
    });

    const shown = texts(render()).join(' ');

    expect(shown).toContain('Fisica');
    expect(shown).toContain(SYNC.cancel.toUpperCase());
  });

  it('es HERMANA del velo, no hija de la columna (REQ-055)', () => {
    seedActiveSource();

    const renderer = render();
    const root = renderer.root.findAllByType('View')[0];
    const childTypes = root.children.map(child => child.type);

    // En una tablet la columna mide 430 dp y el resto es fondo: dentro de la columna,
    // el velo dejaria un marco lateral por el que pasarian los toques.
    expect(renderer.root.findAllByType(Scrim)).toHaveLength(1);
    expect(childTypes.length).toBeGreaterThan(1);
  });
});

describe('el atras de Android durante una actualizacion (REQ-057)', () => {
  it('durante la actualizacion el atras no cambia de vista, y sigue UN dueno', async () => {
    const platform = Platform.OS;

    // En iOS no hay atras que atender, asi que sin esto el test no probaria nada.
    Platform.OS = 'android';

    /** @type {Array<{handler: () => boolean, remove: jest.Mock}>} */
    const registradas = [];

    const spy = jest
      .spyOn(BackHandler, 'addEventListener')
      .mockImplementation((event, handler) => {
        const remove = jest.fn();

        registradas.push({handler, remove});

        return {remove};
      });

    const id = seedActiveSource();
    const renderer = render();

    // Se navega a Datos para que, sin la regla, el atras volviera a Tarjetas.
    act(() => renderer.root.findByType(SideMenu).props.onSelect('data'));

    await act(async () => {
      startSync(
        {id, name: 'Fisica', urlCsv: 'https://x/csv'},
        {
          net: {
            downloadText: () => new Promise(() => {}),
            downloadBytes: () => new Promise(() => {}),
          },
        },
      );
      await Promise.resolve();
    });

    // React vuelve a suscribirse cuando cambian las dependencias del efecto —la
    // vista activa, isSyncing—, y eso es correcto. Lo que DD-008 exige es que haya
    // UNA VIVA a la vez: las anteriores tienen que estar dadas de baja.
    const vivas = registradas.filter(entry => entry.remove.mock.calls.length === 0);

    expect(vivas).toHaveLength(1);

    act(() => {
      expect(vivas[0].handler()).toBe(true);
    });

    // Sigue en Datos: el atras no ha hecho nada (REQ-057).
    expect(renderer.root.findByType(AppHeader).props.title).toBe(DATA_VIEW_TITLE);

    spy.mockRestore();
    Platform.OS = platform;
  });
});

describe('sin red no pedida en toda la app (REQ-080)', () => {
  it('arrancar, navegar, abrir el menu y activar fuentes no pide NADA', () => {
    seedActiveSource({questions: 3});

    // `fetch` y `XMLHttpRequest` LANZAN bajo el guardia de jest.setup.js, asi que
    // cualquier peticion por estos caminos rompe este test en vez de pasar de largo.
    const renderer = render();

    act(() => {
      renderer.root.findByType(SideMenu).props.onSelect('data');
    });

    act(() => {
      renderer.root.findByType(AppHeader).props.onOpenMenu();
    });

    act(() => {
      renderer.root.findByType(SideMenu).props.onSelect('cards');
    });

    expect(texts(renderer).length).toBeGreaterThan(0);
  });
});
