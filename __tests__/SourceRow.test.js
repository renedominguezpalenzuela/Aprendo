/**
 * Tests de la fila de la lista de fuentes.
 *
 * Cubre REQ-020, REQ-021, REQ-026, REQ-030, REQ-034 y REQ-055 de data-sources, y
 * REQ-010 a REQ-014, REQ-043, REQ-060 y REQ-083 de deck-sync.
 *
 * @format
 */

import React from 'react';
import {Alert, Pressable, Text} from 'react-native';
import {act, create} from 'react-test-renderer';

import {NEVER_SYNCED, SYNC} from '../src/decks/decksCopy';
import {SourceRow} from '../src/sources/SourceRow';
import {ROW, removeConfirmation} from '../src/sources/sourcesCopy';
import {TYPE} from '../src/theme/masonTheme';

const SOURCE = {
  id: 3,
  name: 'Aprendiz',
  urlOriginal:
    'https://docs.google.com/spreadsheets/d/1Hf36KxLKJtv5Ve6JVkRnbfpn/edit?gid=871234#gid=871234',
  urlCsv: 'https://docs.google.com/spreadsheets/d/1Hf36KxLKJtv5Ve6JVkRnbfpn/gviz/tq?tqx=out:csv&gid=871234',
  isActive: false,
  createdAt: 1,
  lastSyncedAt: null,
};

function render(props = {}) {
  let renderer;

  act(() => {
    renderer = create(
      <SourceRow
        source={SOURCE}
        onActivate={() => {}}
        onEdit={() => {}}
        onRemove={() => {}}
        onSync={() => {}}
        onDismissSync={() => {}}
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

function button(renderer, matcher) {
  return renderer.root
    .findAllByType(Pressable)
    .find(node => matcher(node.props.accessibilityLabel ?? ''));
}

describe('SourceRow', () => {
  it('muestra el nombre y la URL (REQ-020)', () => {
    const rendered = texts(render());

    expect(rendered).toContain(SOURCE.name);
    expect(rendered).toContain(SOURCE.urlOriginal);
  });

  it('pinta la URL en tipografia MENOR que el nombre (REQ-020)', () => {
    expect(TYPE.rowUrl.fontSize).toBeLessThan(TYPE.rowName.fontSize);
  });

  it('trunca la URL por el MEDIO, para no perder el gid (REQ-026)', () => {
    // El gid del final es lo que distingue dos fuentes del mismo documento.
    const renderer = render();
    const url = renderer.root
      .findAllByType(Text)
      .find(node => node.props.children === SOURCE.urlOriginal);

    expect(url.props.numberOfLines).toBe(1);
    expect(url.props.ellipsizeMode).toBe('middle');
  });
});

describe('boton de activacion', () => {
  it('dice "Activar Test" si no es la activa (REQ-021)', () => {
    expect(texts(render())).toContain(ROW.activate.toUpperCase());
    expect(texts(render())).not.toContain(ROW.active.toUpperCase());
  });

  it('dice "Test Activo" si lo es (REQ-021)', () => {
    const rendered = texts(render({source: {...SOURCE, isActive: true}}));

    expect(rendered).toContain(ROW.active.toUpperCase());
    expect(rendered).not.toContain(ROW.activate.toUpperCase());
  });

  it('expone el estado al lector de pantalla (REQ-055)', () => {
    const inactive = button(render(), l => l.includes('Activar el test'));
    expect(inactive.props.accessibilityState.selected).toBe(false);

    const active = button(
      render({source: {...SOURCE, isActive: true}}),
      l => l.includes('es el test activo'),
    );
    expect(active.props.accessibilityState.selected).toBe(true);
  });

  it('activa al pulsarlo', () => {
    const onActivate = jest.fn();
    const renderer = render({onActivate});

    act(() => {
      button(renderer, l => l.includes('Activar el test')).props.onPress();
    });

    expect(onActivate).toHaveBeenCalledWith(SOURCE.id);
  });

  it('no hace nada si ya es la activa', () => {
    const onActivate = jest.fn();
    const renderer = render({source: {...SOURCE, isActive: true}, onActivate});
    const activo = button(renderer, l => l.includes('es el test activo'));

    expect(activo.props.disabled).toBe(true);
    expect(activo.props.onPress).toBeUndefined();
    expect(onActivate).not.toHaveBeenCalled();
  });
});

describe('editar y borrar', () => {
  it('editar avisa con la fuente entera (REQ-030)', () => {
    const onEdit = jest.fn();
    const renderer = render({onEdit});

    act(() => {
      button(renderer, l => l.startsWith(ROW.edit)).props.onPress();
    });

    expect(onEdit).toHaveBeenCalledWith(SOURCE);
  });

  it('borrar pide confirmacion NOMBRANDO la fuente (REQ-034)', () => {
    const spy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const onRemove = jest.fn();
    const renderer = render({onRemove});

    act(() => {
      button(renderer, l => l.startsWith(ROW.remove)).props.onPress();
    });

    const copy = removeConfirmation(SOURCE.name);
    expect(spy).toHaveBeenCalledWith(copy.title, copy.message, expect.any(Array));
    expect(spy.mock.calls[0][1]).toContain(SOURCE.name);
    // Nada se borra hasta confirmar.
    expect(onRemove).not.toHaveBeenCalled();

    spy.mockRestore();
  });

  it('solo borra al confirmar (REQ-034)', () => {
    let buttons;
    const spy = jest
      .spyOn(Alert, 'alert')
      .mockImplementation((title, message, options) => {
        buttons = options;
      });
    const onRemove = jest.fn();
    const renderer = render({onRemove});

    act(() => {
      button(renderer, l => l.startsWith(ROW.remove)).props.onPress();
    });

    const cancel = buttons.find(b => b.style === 'cancel');
    const confirm = buttons.find(b => b.style === 'destructive');

    // El de cancelar no lleva accion: cerrar el dialogo es todo lo que hace.
    expect(cancel.onPress).toBeUndefined();

    act(() => {
      confirm.onPress();
    });

    expect(onRemove).toHaveBeenCalledWith(SOURCE.id);

    spy.mockRestore();
  });
});

// ─── deck-sync ───────────────────────────────────────────────────────────────

describe('accion Actualizar (REQ-010, REQ-013)', () => {
  it('esta en la fila aunque la fuente NO sea la activa', () => {
    expect(texts(render())).toContain(SYNC.action.toUpperCase());
    expect(texts(render({source: {...SOURCE, isActive: true}}))).toContain(
      SYNC.action.toUpperCase(),
    );
  });

  it('llama a onSync con la fuente', () => {
    const onSync = jest.fn();
    const renderer = render({onSync});

    act(() => button(renderer, label => label.startsWith(SYNC.action)).props.onPress());

    expect(onSync).toHaveBeenCalledWith(SOURCE);
  });

  it('con otra actualizacion en curso queda desactivada y atenuada', () => {
    const renderer = render({syncBusy: true});
    const action = button(renderer, label => label.startsWith(SYNC.action));

    expect(action.props.disabled).toBe(true);
    expect(action.props.accessibilityState).toEqual({disabled: true});
  });

  it('su etiqueta de lector nombra la fuente (REQ-083)', () => {
    // "Actualizar" a secas, en una lista de tres fuentes, no dice cual.
    expect(button(render(), label => label.startsWith(SYNC.action)).props.accessibilityLabel).toContain(
      'Aprendiz',
    );
  });
});

describe('fecha de ultima actualizacion (REQ-011, REQ-012)', () => {
  it('sin actualizar lo DICE, en vez de dejar el hueco vacio', () => {
    expect(texts(render())).toContain(NEVER_SYNCED);
  });

  it('con fecha la muestra, y ya no dice que nunca', () => {
    const summary = {
      count: 3,
      bytes: 900,
      lastSyncedAt: new Date(2026, 7, 18, 9, 5).getTime(),
    };

    const shown = texts(render({summary}));

    expect(shown.join(' ')).toContain('18 ago');
    expect(shown).not.toContain(NEVER_SYNCED);
  });

  it('el resumen manda sobre la fuente: es el recien releido', () => {
    const source = {...SOURCE, lastSyncedAt: new Date(2020, 0, 1).getTime()};
    const summary = {count: 1, bytes: 10, lastSyncedAt: new Date(2026, 7, 18).getTime()};

    const shown = texts(render({source, summary})).join(' ');

    expect(shown).toContain('18 ago 2026');
    expect(shown).not.toContain('2020');
  });
});

describe('tamano del mazo (REQ-014)', () => {
  it('se muestra cuando hay preguntas', () => {
    const shown = texts(render({summary: {count: 20, bytes: 1024 * 1024, lastSyncedAt: 1}}));

    expect(shown.join(' ')).toContain('20 preguntas');
    expect(shown.join(' ')).toContain('1 MB');
  });

  it('NO se muestra ningun tamano si la fuente no tiene preguntas', () => {
    const shown = texts(render({summary: {count: 0, bytes: 0, lastSyncedAt: null}}));

    expect(shown.join(' ')).not.toMatch(/\bB\b|KB|MB/);
  });

  it('tampoco cuando no hay resumen todavia', () => {
    expect(texts(render({summary: null})).join(' ')).not.toMatch(/\bB\b|KB|MB/);
  });
});

describe('aviso de desenlace (REQ-043, REQ-060)', () => {
  const RESULT = {
    phase: 'result',
    sourceId: SOURCE.id,
    sourceName: SOURCE.name,
    saved: 20,
    skippedImages: 1,
    failedImages: 0,
    warnings: [],
  };

  it('dice cuantas preguntas y cuantas imagenes se omitieron', () => {
    const shown = texts(render({syncState: RESULT})).join(' ');

    expect(shown).toContain('20 preguntas');
    expect(shown).toMatch(/omitió 1 imagen/);
  });

  it('anade las filas descartadas cuando las hubo (REQ-027)', () => {
    const shown = texts(
      render({syncState: {...RESULT, warnings: [{row: 5, reason: 'INCOMPLETE'}]}}),
    ).join(' ');

    expect(shown).toContain('fila 5');
  });

  it('se puede descartar', () => {
    const onDismissSync = jest.fn();
    const renderer = render({syncState: RESULT, onDismissSync});

    act(() => button(renderer, label => label.startsWith(SYNC.dismiss)).props.onPress());

    expect(onDismissSync).toHaveBeenCalledTimes(1);
  });

  it('un exito NO ofrece reintentar: no hay nada que reintentar', () => {
    expect(texts(render({syncState: RESULT}))).not.toContain(SYNC.retry.toUpperCase());
  });

  it('un error dice su motivo y SI ofrece reintentar (REQ-060)', () => {
    const renderer = render({
      syncState: {
        phase: 'error',
        sourceId: SOURCE.id,
        sourceName: SOURCE.name,
        reason: 'NO_CONNECTION',
      },
    });

    expect(texts(renderer).join(' ')).toMatch(/conexión/i);
    expect(texts(renderer)).toContain(SYNC.retry.toUpperCase());
  });

  it('reintentar vuelve a llamar a onSync', () => {
    const onSync = jest.fn();
    const renderer = render({
      syncState: {phase: 'error', sourceId: SOURCE.id, sourceName: 'Aprendiz', reason: 'TIMEOUT'},
      onSync,
    });

    act(() => button(renderer, label => label.startsWith(SYNC.retry)).props.onPress());

    expect(onSync).toHaveBeenCalledWith(SOURCE);
  });

  it('el error de columna que falta NOMBRA la columna (REQ-025)', () => {
    const shown = texts(
      render({
        syncState: {
          phase: 'error',
          sourceId: SOURCE.id,
          sourceName: 'Aprendiz',
          reason: 'MISSING_COLUMN',
          missing: 'RESPUESTA1',
        },
      }),
    ).join(' ');

    expect(shown).toContain('RESPUESTA1');
  });

  it('mientras se descarga NO hay aviso: eso lo dice la ventana', () => {
    const working = {
      phase: 'working',
      sourceId: SOURCE.id,
      sourceName: 'Aprendiz',
      done: 7,
      total: 20,
    };

    const shown = texts(render({syncState: working})).join(' ');

    expect(shown).not.toContain('7 de 20');
    expect(shown).not.toContain(SYNC.dismiss.toUpperCase());
  });

  it('el aviso es una region viva para el lector de pantalla (REQ-083)', () => {
    const notice = render({syncState: RESULT})
      .root.findAllByType(Text)
      .find(node => String(node.props.children).includes('20 preguntas'));

    expect(notice.props.accessibilityLiveRegion).toBe('polite');
  });
});

describe('SourceRow: el mazo de ejemplo (EJEMPLO-003)', () => {
  const EXAMPLE = {
    id: 9,
    name: 'Ejemplo: El sistema solar',
    urlOriginal: null,
    urlCsv: null,
    isActive: false,
    isExample: true,
    createdAt: 0,
    lastSyncedAt: null,
  };

  /** Un desenlace real de actualizacion, el mismo que pinta una fila normal. */
  const RESULT = {
    phase: 'result',
    sourceId: EXAMPLE.id,
    sourceName: EXAMPLE.name,
    saved: 20,
    skippedImages: 0,
    failedImages: 0,
    warnings: [],
  };

  const renderExample = (props = {}) => render({source: EXAMPLE, ...props});

  it('dice "Ejemplo incluido en la app" en lugar de la URL', () => {
    const shown = texts(renderExample());

    expect(shown).toContain(EXAMPLE.name);
    expect(shown).toContain(ROW.exampleLabel);
  });

  it('no dice "Nunca actualizada" ni una fecha', () => {
    const summary = {count: 20, bytes: 2048, lastSyncedAt: null};

    // La misma fila sin marcar como ejemplo SI lo diria: el test mira la regla.
    expect(texts(renderExample({source: {...EXAMPLE, isExample: false}, summary})))
      .toContain(NEVER_SYNCED);
    expect(texts(renderExample({summary}))).not.toContain(NEVER_SYNCED);
  });

  it('no ofrece Actualizar ni Editar', () => {
    const renderer = renderExample();

    expect(button(renderer, l => l === `${SYNC.action} ${EXAMPLE.name}`)).toBeUndefined();
    expect(button(renderer, l => l === `${ROW.edit} ${EXAMPLE.name}`)).toBeUndefined();
  });

  it('se activa y se borra con confirmacion, como cualquiera', () => {
    const onActivate = jest.fn();
    const onRemove = jest.fn();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const renderer = renderExample({onActivate, onRemove});

    expect(texts(renderer)).toContain(ROW.activate.toUpperCase());

    act(() => {
      button(
        renderer,
        l => l.includes(EXAMPLE.name) && l !== `${ROW.remove} ${EXAMPLE.name}`,
      ).props.onPress();
    });
    expect(onActivate).toHaveBeenCalledWith(EXAMPLE.id);

    act(() => {
      button(renderer, l => l === `${ROW.remove} ${EXAMPLE.name}`).props.onPress();
    });
    // El aviso no habla de una hoja que no existe, y dice que no vuelve.
    const message = alert.mock.calls[0][1];
    expect(message).toBe(
      'Se eliminará «Ejemplo: El sistema solar» de la lista y no volverá a aparecer.',
    );
    expect(message).not.toMatch(/hoja/i);

    const destructive = alert.mock.calls[0][2].find(b => b.style === 'destructive');
    destructive.onPress();
    alert.mockRestore();

    expect(onRemove).toHaveBeenCalledWith(EXAMPLE.id);
  });

  it('activo dice Test Activo', () => {
    expect(texts(renderExample({source: {...EXAMPLE, isActive: true}}))).toContain(
      ROW.active.toUpperCase(),
    );
  });

  it('sigue mostrando el tamano del mazo (deck-sync REQ-014)', () => {
    const shown = texts(
      renderExample({summary: {count: 20, bytes: 1024 * 1024, lastSyncedAt: null}}),
    ).join(' ');

    expect(shown).toContain('20 preguntas');
    expect(shown).toContain('1 MB');
  });

  it('no muestra avisos de actualizacion aunque le llegue un desenlace', () => {
    // Con la fila normal, este mismo estado SI pinta el aviso.
    expect(
      texts(renderExample({source: {...EXAMPLE, isExample: false}, syncState: RESULT})).join(' '),
    ).toContain('20 preguntas');
    expect(texts(renderExample({syncState: RESULT}))).not.toContain(
      SYNC.dismiss.toUpperCase(),
    );
    expect(texts(renderExample({syncState: RESULT})).join(' ')).not.toContain('guardadas');
  });
});
