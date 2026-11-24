/**
 * Contraste de la paleta. DELTA-005 de delta-apariencia-moderna-y-legible.
 *
 * Esta suite se escribio ANTES de corregir un solo color, y se commiteo EN ROJO (T-201).
 * El motivo esta en design.md DD-025: escrita despues, se habria escrito para bendecir
 * los valores que ya hubieramos puesto.
 *
 * La tabla de pares es EXPLICITA y NO se deriva de los `StyleSheet` de los componentes.
 * Eso es deliberado: si se derivase, un error en los estilos se propagaria a la tabla y
 * el test lo bendeciria. Duplicar a proposito el mapa «que texto va sobre que superficie»
 * es lo que hace que esto sea una segunda opinion y no un eco.
 *
 * @format
 */

import {COLOR} from '../src/theme/masonTheme';
import {contrastRatio, luminance} from './support/contrast';

/**
 * Minimo de WCAG 2.1 AA para texto de tamano normal.
 *
 * No se usa el 3:1 de «texto grande» en ningun sitio, ni para el titular del estado
 * vacio: el umbral relajado exige 24 px o 18.66 px en negrita, y la paleta se comparte
 * entre tamanos. Un color que solo pasa en el titular acabaria en un rotulo de 13.
 */
const TEXT_MIN = 4.5;

/**
 * Minimo para un elemento NO textual que transmite informacion.
 *
 * Aplica a los dos filetes de la tarjeta: distinguen la cara, asi que informan. Un
 * filete puramente decorativo estaria exento, y el del diseno de referencia lo era
 * hasta que DELTA-002 le dio un significado. Ver DD-023.
 */
const NON_TEXT_MIN = 3;

/**
 * Las superficies sobre las que se pinta algo.
 *
 * `dialog` y `card` comparten valor a proposito (son la misma superficie levantada), asi
 * que se nombran las dos: si manana una se mueve, el par de la otra sigue cubierto.
 */
const SURFACE = {
  view: COLOR.background,
  drawer: COLOR.drawer,
  dialog: COLOR.dialog,
  paper: COLOR.paper,
};

/**
 * Pares (texto, superficie, minimo). Uno por cada sitio donde un color se pinta encima
 * de otro, con el nombre del papel que cumple para que el fallo diga QUE se rompio.
 *
 * La tabla CRECIO en T-202 con el bloque del papel. Crecer es lo que tiene que hacer; lo
 * que no puede hacer es ablandarse: ningun minimo se baja para que un color pase.
 */
const PAIRS = [
  // ── Sobre el fondo de la vista ────────────────────────────────────────────
  ['ink — texto primario', COLOR.ink, SURFACE.view, TEXT_MIN],
  ['inkMuted — cuerpo secundario', COLOR.inkMuted, SURFACE.view, TEXT_MIN],
  ['inkWarm — titulo del cajon', COLOR.inkWarm, SURFACE.view, TEXT_MIN],
  ['inkDim — accion de la barra', COLOR.inkDim, SURFACE.view, TEXT_MIN],
  ['inkFaint — indicacion de girar', COLOR.inkFaint, SURFACE.view, TEXT_MIN],
  ['inkFooter — meta de una fuente', COLOR.inkFooter, SURFACE.view, TEXT_MIN],
  // Era el rotulo INSTRUCCION del header hasta que se retiro (2026-08-19). El par
  // sigue existiendo porque `fieldLabel` de la pantalla Datos usa el mismo color
  // sobre la misma superficie.
  ['goldBright — etiqueta de campo', COLOR.goldBright, SURFACE.view, TEXT_MIN],
  ['danger — error de validacion', COLOR.danger, SURFACE.view, TEXT_MIN],
  ['placeholder — marcador de campo', COLOR.placeholder, SURFACE.view, TEXT_MIN],

  // ── Sobre el cajon del menu ───────────────────────────────────────────────
  ['ink — entrada activa', COLOR.ink, SURFACE.drawer, TEXT_MIN],
  ['inkDim — entrada disponible', COLOR.inkDim, SURFACE.drawer, TEXT_MIN],
  ['inkFaint — entrada no disponible', COLOR.inkFaint, SURFACE.drawer, TEXT_MIN],
  ['inkFooter — pie del cajon', COLOR.inkFooter, SURFACE.drawer, TEXT_MIN],
  // Aqui goldBright dejo de ser TEXTO al retirarse el rotulo del cajon (2026-08-19):
  // lo que queda es la marca de la entrada activa, que informa sin ser texto. El par
  // no se borra, cambia de minimo: borrarlo dejaria el color sin vigilar sobre esta
  // superficie.
  ['goldBright — marca de la entrada activa', COLOR.goldBright, SURFACE.drawer, NON_TEXT_MIN],

  // ── Sobre la ventana de progreso ──────────────────────────────────────────
  ['inkWarm — contador de progreso', COLOR.inkWarm, SURFACE.dialog, TEXT_MIN],
  ['inkDim — cancelar', COLOR.inkDim, SURFACE.dialog, TEXT_MIN],
  ['goldBright — rotulo ACTUALIZANDO', COLOR.goldBright, SURFACE.dialog, TEXT_MIN],

  // ── Sobre el PAPEL de la tarjeta ──────────────────────────────────────────
  ['paperInk — el texto de la tarjeta', COLOR.paperInk, SURFACE.paper, TEXT_MIN],
  ['paperInkSec — la continuacion', COLOR.paperInkSec, SURFACE.paper, TEXT_MIN],
  ['paperLabel — el Nº NN', COLOR.paperLabel, SURFACE.paper, TEXT_MIN],
  ['paperHint — TOCA PARA…', COLOR.paperHint, SURFACE.paper, TEXT_MIN],

  // ── No textuales que informan ─────────────────────────────────────────────
  ['goldBright — marca del menu activo', COLOR.goldBright, SURFACE.drawer, NON_TEXT_MIN],
  ['goldDim — filete del estado vacio', COLOR.goldDim, SURFACE.view, NON_TEXT_MIN],
  ['paperRule — filete de la pregunta', COLOR.paperRule, SURFACE.paper, NON_TEXT_MIN],
  ['paperRuleAnswer — filete de la respuesta', COLOR.paperRuleAnswer, SURFACE.paper, NON_TEXT_MIN],
  ['paperBorder — el canto del papel', COLOR.paperBorder, SURFACE.view, NON_TEXT_MIN],
];

/**
 * El filete gris del diseno de referencia, que NO se adopto.
 *
 * Este caso es el que justifica DD-023, y se prueba porque una decision de diseno sin
 * numero es una opinion. Si alguien vuelve a poner #c9bda3 «para ser fiel al diseno», este
 * test es lo que le explica por que no.
 */
const DISENO_RULE_RECHAZADO = '#c9bda3';

describe('contrastRatio', () => {
  // Una formula sin caso conocido no esta probada, esta escrita.
  it('da 21:1 para negro sobre blanco', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
  });

  it('da 1:1 para un color contra si mismo', () => {
    expect(contrastRatio('#8A9099', '#8A9099')).toBeCloseTo(1, 10);
  });

  // El gris medio de referencia de WCAG: #767676 sobre blanco es el valor limite
  // publicado que pasa AA por los pelos.
  it('da 4.54:1 para #767676 sobre blanco, el limite publicado de AA', () => {
    expect(contrastRatio('#767676', '#FFFFFF')).toBeCloseTo(4.54, 2);
  });

  it('es simetrica: el orden de los argumentos no cambia el resultado', () => {
    expect(contrastRatio('#131A22', '#E9E3D8')).toBeCloseTo(
      contrastRatio('#E9E3D8', '#131A22'),
      10,
    );
  });

  it('rechaza lo que no sea #RRGGBB, en vez de devolver un numero plausible', () => {
    expect(() => luminance('#FFF')).toThrow(/RRGGBB/);
    expect(() => luminance('rgba(0,0,0,0.5)')).toThrow(/RRGGBB/);
  });
});

describe('la paleta cumple WCAG AA', () => {
  it.each(PAIRS)('%s', (role, foreground, surface, minimum) => {
    const ratio = contrastRatio(foreground, surface);

    // El mensaje NOMBRA el par y su razon: `expected true to be false` no sirve de nada
    // a quien lo lea en un fallo de CI seis meses despues.
    expect({
      role,
      foreground,
      surface,
      ratio: Number(ratio.toFixed(2)),
      minimum,
    }).toEqual({
      role,
      foreground,
      surface,
      ratio: expect.any(Number),
      minimum,
    });

    if (ratio < minimum) {
      throw new Error(
        `${role}: ${foreground} sobre ${surface} da ${ratio.toFixed(2)}:1, ` +
          `y el minimo es ${minimum}:1`,
      );
    }
  });
});

describe('las dos desviaciones del diseno de referencia estan justificadas', () => {
  // DD-023, primera mitad: el filete del diseno es casi invisible sobre su propio papel.
  it('el filete #c9bda3 del diseno no llega a 3:1 sobre el papel', () => {
    const ratio = contrastRatio(DISENO_RULE_RECHAZADO, COLOR.paper);

    expect(ratio).toBeLessThan(NON_TEXT_MIN);
    expect(Number(ratio.toFixed(2))).toBe(1.62);
  });

  // DD-023, segunda mitad: los dos filetes se distinguen por MATIZ y casi no por
  // luminosidad, asi que el color no puede ser la unica senal de cara. Lo que garantiza
  // que hay otra es este test mas los de QuestionCard (grosor) y el encabezado.
  it('los dos filetes casi no se distinguen por luminosidad', () => {
    const ratioEntreFiletes = contrastRatio(COLOR.paperRule, COLOR.paperRuleAnswer);

    // Por debajo de 1.5:1 son practicamente el mismo tono. Si algun dia sube de 3:1, el
    // color SI seria senal suficiente y este test habria que replantearlo — con DD-023.
    expect(ratioEntreFiletes).toBeLessThan(1.5);
  });
});
