/**
 * Tokens visuales de la vista principal.
 *
 * Unica fuente de verdad de color, tipografia, medida y tiempo, en unidades de
 * React Native.
 *
 * @format
 */

/**
 * Paleta.
 *
 * Los nombres describen el papel, no el color: si manana el fondo deja de ser
 * casi negro, `background` sigue siendo el nombre correcto.
 */
export const COLOR = {
  /**
   * Fondo de la vista.
   *
   * El diseno usa un degradado `linear-gradient(180deg, #151C25, #10151C 70%)`.
   * React Native no tiene degradados nativos y traerse una dependencia con
   * codigo nativo por 5 puntos de luminosidad no compensa, asi que se usa el
   * punto medio plano. Ver design.md DD-005.
   *
   * OJO: este valor esta DUPLICADO en android/app/src/main/res/values/colors.xml
   * como `mason_background`, porque el tema nativo lo necesita antes de que
   * exista React Native (DD-006). Si cambia aca, cambiar alla.
   */
  background: '#131A22',

  /** Fondo del cajon del menu lateral. */
  drawer: '#131920',

  /** Velo que cubre la pantalla con el menu desplegado. */
  scrim: 'rgba(6,9,13,0.68)',

  /** Separadores horizontales: pie del header, borde del pie del menu. */
  rule: '#1E2530',

  /** Borde derecho del cajon. */
  border: '#232B36',

  /**
   * Oro vivo: marca de la entrada activa del menu, Y TODO ROTULO EN ORO.
   *
   * Se hizo cargo de los rotulos que antes llevaba `goldDim` cuando la prueba de contraste
   * demostro que aquel daba 3.51:1 sobre el fondo. Este da 5.66:1. Ver DD-021 y DELTA-005.
   * Hoy son las etiquetas de campo y el rotulo de la ventana de progreso: el del header se
   * retiro (DD-029).
   */
  goldBright: '#B08D55',

  /**
   * Oro apagado: SOLO filetes y bordes. NO es un color de texto.
   *
   * A 3.51:1 sobre el fondo falla el minimo de 4.5:1 que exige DELTA-005 para texto, y
   * pasa de sobra el de 3:1 de los elementos no textuales. Es por eso que sigue vivo: es
   * un buen filete y era un mal rotulo.
   *
   * Si vuelve a aparecer en un `TYPE`, la prueba de contraste no lo cazara —la tabla mira
   * pares declarados, no usos reales—, asi que la regla vive aca en forma de comentario.
   */
  goldDim: '#8A6A3B',

  /** Texto primario. */
  ink: '#E9E3D8',

  /** Cuerpo de texto secundario. */
  inkMuted: '#9AA2AE',

  /** Entradas de menu inactivas pero disponibles. 5.65:1. */
  inkDim: '#8B939F',

  /** Gris calido del icono de hamburguesa y del titulo de la cabecera del menu. 7.89:1. */
  inkWarm: '#B6AD9D',

  /**
   * Entradas no disponibles y su rotulo "pronto".
   *
   * Era #6F7885, que daba 3.92:1 y FALLABA el minimo de 4.5:1. Ahora 5.45:1.
   */
  inkFaint: '#8A9099',

  /**
   * Pie del menu lateral, URL de una fuente y su meta.
   *
   * Era #55606E, que daba 2.74:1 y era el peor de la paleta. Ahora 4.82:1.
   *
   * SIGUE SIENDO UN NOMBRE DISTINTO de `inkFaint`, con un valor distinto, aunque los dos
   * subieran a la vez: son dos papeles, y darles el mismo valor haria que mover uno
   * moviera el otro sin querer. Es la regla que declara la cabecera de este bloque, y la
   * luminosidad distinta mantiene la jerarquia visible. Ver DD-027.
   */
  inkFooter: '#7E8794',

  // ── Pantalla Datos ──────────────────────────────────────────────────────
  // Anadidos para el formulario y la lista de fuentes. Todos salen de la paleta
  // de arriba: son el mismo fondo y los mismos grises, movidos lo justo para
  // separar plano de campo del plano de pantalla. Ver design.md seccion 2.12.

  /** Fondo de un campo de texto. Un peldano por encima del fondo de la vista. */
  field: '#1A222C',

  /** Borde del campo en reposo. Mismo gris que los separadores. */
  fieldBorder: '#232B36',

  /** Borde del campo con el foco puesto: el oro apagado, sin llegar al vivo. */
  fieldBorderFocus: '#8A6A3B',

  /** Borde del campo con error. */
  fieldBorderError: '#8C4A43',

  /**
   * Texto del marcador de posicion. Mas apagado que inkMuted, no es contenido.
   *
   * Era #6F7885 —el mismo valor que el viejo `inkFaint`— y arrastraba su mismo 3.92:1 sin
   * que nadie lo hubiera mirado: el delta contaba tres colores que fallaban y eran cuatro.
   * Lo encontro la prueba de contraste de T-201, que es exactamente para lo que existe.
   * Ahora 5.45:1.
   */
  placeholder: '#8A9099',

  /** Texto de un mensaje de error de validacion. */
  danger: '#C4736A',

  /** Fondo del boton principal. El oro vivo del diseno. */
  buttonPrimary: '#B08D55',

  /** Texto sobre el boton principal: el fondo de la vista, para maximo contraste. */
  buttonPrimaryInk: '#131A22',

  /** Borde de un boton secundario, que no lleva fondo. */
  buttonGhostBorder: '#2C3540',

  /** Separador entre filas de la lista de fuentes. */
  rowRule: '#1E2530',

  /** Fondo de la fila de la fuente activa. Mismo tinte que la entrada de menu activa. */
  rowActive: 'rgba(176,141,85,0.07)',

  /**
   * Fondo del cuadro de la ventana de progreso.
   *
   * Mas claro que `background` y que `drawer`: el cuadro tiene que despegarse del
   * velo, que ya oscurece la pantalla entera por debajo.
   */
  dialog: '#1A222C',

  /** Borde del cuadro de la ventana de progreso. */
  dialogBorder: '#2C3540',

  // ── La tarjeta: superficie de PAPEL ─────────────────────────────────────
  //
  // El prefijo `paper` no es decorativo: TODO lo demas en este archivo es oscuro, y
  // quien lea `cardInk` supondra lo contrario de lo que es.
  //
  // Y esto NO contradice REQ-027. Aquel requisito gobierna DE QUE depende la paleta —del
  // diseno, no del tema del sistema—, no que claridad tiene cada superficie. La app no
  // ofrece tema claro, no consulta useColorScheme, y la barra de estado sigue en
  // light-content siempre. La tarjeta es un objeto claro sobre una mesa oscura, igual que
  // el splash es claro y nadie lo llamo tema claro. Ver design.md DD-021.

  // Aqui vivian `card: '#1A222C'` y `cardBorder: '#8A6A3B'`, la tarjeta oscura de antes.
  //
  // Merece la pena contar como se fueron: al borrarlos, la suite entera SIGUIO EN VERDE
  // —604 de 604— con la tarjeta pintando `backgroundColor: undefined`, porque
  // `QuestionCard.test.js` nunca aserto su superficie y React Native acepta `undefined` en
  // un estilo sin protestar. Es DD-014 de `splash-screen` otra vez. La asercion que faltaba
  // existe ahora; si vuelve a faltar, el siguiente borrado tampoco se notara.

  /** El papel. Anverso Y reverso: las dos caras son la misma superficie. */
  paper: '#F4EFE4',

  /**
   * El canto del papel.
   *
   * Era oro. El oro se retiro de aca y quedo SOLO en el filete de la respuesta y en la
   * marca del menu activo: tres oros con tres significados distintos no son un sistema,
   * son un accidente (DD-021).
   */
  paperBorder: '#D8CFBB',

  /** El texto de la tarjeta. 13.60:1 sobre el papel. */
  paperInk: '#1F242C',

  /**
   * `Respuesta2`, que CONTINUA a la principal (deck-sync REQ-028). 6.24:1.
   *
   * Mas apagado que `paperInk` para que la jerarquia diga «esto sigue» sin leerlo, y no
   * tanto como para bajar del minimo.
   */
  paperInkSec: '#5C5750',

  /** El `Nº NN` del encabezado. 5.17:1. */
  paperLabel: '#7C5F35',

  /** La indicacion «TOCA PARA…» del pie. 5.00:1. */
  paperHint: '#6F6553',

  /**
   * Filete de 34 dp de la cara de PREGUNTA. 3.38:1.
   *
   * El diseno de referencia usa #c9bda3, que sobre este papel da 1.62:1: es casi
   * invisible, y el minimo para un elemento no textual que INFORMA es 3:1. El filete
   * informa desde que DELTA-002 le dio el papel de distinguir la cara, asi que se
   * oscurecio. Ver DD-023.
   */
  paperRule: '#8A8072',

  /**
   * Filete de la cara de RESPUESTA. 4.35:1.
   *
   * OJO con lo que este color NO hace: se distingue de `paperRule` por MATIZ —oro contra
   * gris calido— y casi no por luminosidad (0.16 contra 0.22). Para quien no distingue
   * esos matices, los dos filetes son el mismo filete.
   *
   * Por eso la senal accesible de en que cara estas NO es el filete: es el ENCABEZADO,
   * que es texto y ya dice `Nº 01` en una cara y `RESPUESTA Nº 01` en la otra. El filete
   * es un refuerzo rapido y redundante, y ademas lleva una diferencia no cromatica: 2 dp
   * de grosor contra 1 dp (LAYOUT.ruleHeightAnswer). Ver DD-023.
   */
  paperRuleAnswer: '#8A6A3B',
};

/**
 * Familias tipograficas.
 *
 * Se referencian por nombre PostScript, que coincide con el nombre de archivo:
 * eso permite un unico valor para iOS (resuelve por nombre PostScript) y Android
 * (resuelve por nombre de archivo).
 *
 * Son instancias ESTATICAS, no las fuentes variables que sirve Google Fonts:
 * React Native no expone ejes variables de forma fiable en ambas plataformas.
 * Ver design.md DD-007 y splash-screen design.md DD-006.
 *
 * AMBAS EN REGULAR, y no en Medium como se propuso al disenar: el diseno de
 * referencia carga los pesos 400/500/600 en su <link> pero no declara
 * `font-weight` en ningun estilo, asi que todo su texto se renderiza en 400.
 * Usar Regular es a la vez mas fiel y mas ligero. Ver design.md DD-014.
 */
export const FONT = {
  serif: 'EBGaramond-Regular',
  label: 'BarlowCondensed-Regular',
};

/**
 * Estilos de texto.
 *
 * Dos conversiones que es facil hacer mal, y que aca ya estan hechas:
 *
 *   - `letterSpacing` va en dp, no en em. Cada valor es (em del diseno x
 *     fontSize). Un 0.34em a 10 px son 3.4 dp.
 *   - `lineHeight` va en dp absolutos. React Native NO acepta multiplicadores,
 *     asi que el 1.6 del diseno sobre 18 px son 29 dp.
 *
 * No se declara `fontWeight` en ninguno: la familia ya trae el peso, y pedir un
 * peso encima produce sintetizado inconsistente entre plataformas (DD-007).
 */
export const TYPE = {
  /**
   * Rotulo en caja alta sobre un titulo. 0.14em sobre 13.
   *
   * Nacio para el rotulo INSTRUCCION del header y del cajon, que se retiro el 2026-08-19
   * (DD-029). Sigue viva porque la usa el rotulo ACTUALIZANDO de la ventana de progreso:
   * el token no era del header, era de la forma.
   *
   * Era 10 px con 3.4 dp de tracking (0.34em), que es la peor combinacion posible para
   * leer: condensada, diminuta y muy espaciada. Y en `goldDim`, que daba 3.51:1.
   *
   * El `letterSpacing` de React Native va en DP y no en em, asi que 0.14em sobre 13 son
   * 1.82 dp. Poner 0.14 daria un tracking imperceptible; poner 14, ilegible.
   */
  eyebrow: {
    fontFamily: FONT.label,
    fontSize: 13,
    letterSpacing: 1.82,
    color: COLOR.goldBright,
  },

  /** Titulo de la vista activa, en el header. */
  headerTitle: {
    fontFamily: FONT.serif,
    fontSize: 19,
    lineHeight: 19,
    color: COLOR.ink,
  },

  /** Titulo de la cabecera del menu lateral. */
  drawerTitle: {
    fontFamily: FONT.serif,
    fontSize: 21,
    lineHeight: 23,
    color: COLOR.ink,
  },

  /**
   * Entrada del menu. Sin color: lo pone el estado de la entrada. 0.14em sobre 15.
   *
   * El tamano NO cambia —15 px ya era legible—, solo el tracking: de 3.0 a 2.1 dp.
   */
  menuItem: {
    fontFamily: FONT.label,
    fontSize: 15,
    letterSpacing: 2.1,
  },

  /** Rotulo "pronto" de las entradas no disponibles. 0.14em sobre 13. */
  menuBadge: {
    fontFamily: FONT.label,
    fontSize: 13,
    letterSpacing: 1.82,
    color: COLOR.inkFaint,
  },

  /**
   * Pie del menu lateral. 0.10em sobre 12.
   *
   * Es el unico rotulo que no llega a 13: es el texto menos importante de la app —version
   * y numero de preguntas— y a 13 competiria con las entradas del menu, que estan justo
   * encima. Tracking mas corto que los demas por lo mismo.
   */
  menuFooter: {
    fontFamily: FONT.label,
    fontSize: 12,
    letterSpacing: 1.2,
    color: COLOR.inkFooter,
  },

  /** Titular del estado sin preguntas. 1.24 sobre 30. */
  emptyTitle: {
    fontFamily: FONT.serif,
    fontSize: 30,
    lineHeight: 37,
    color: COLOR.ink,
  },

  /** Cuerpo del estado sin preguntas. 1.6 sobre 18. */
  emptyBody: {
    fontFamily: FONT.serif,
    fontSize: 18,
    lineHeight: 29,
    color: COLOR.inkMuted,
  },

  // ── Pantalla Datos ──────────────────────────────────────────────────────

  /** Etiqueta de un campo del formulario. 0.14em sobre 13. */
  fieldLabel: {
    fontFamily: FONT.label,
    fontSize: 13,
    letterSpacing: 1.82,
    color: COLOR.goldBright,
  },

  /** Texto que el usuario escribe en un campo. */
  fieldText: {
    fontFamily: FONT.serif,
    fontSize: 17,
    lineHeight: 23,
    color: COLOR.ink,
  },

  /** Mensaje de error bajo un campo. */
  fieldError: {
    fontFamily: FONT.serif,
    fontSize: 14,
    lineHeight: 20,
    color: COLOR.danger,
  },

  /** Texto de un boton. 0.14em sobre 13. El tamano ya era 13; baja el tracking. */
  button: {
    fontFamily: FONT.label,
    fontSize: 13,
    letterSpacing: 1.82,
  },

  /** Nombre de una fuente en la lista. */
  rowName: {
    fontFamily: FONT.serif,
    fontSize: 19,
    lineHeight: 24,
    color: COLOR.ink,
  },

  /**
   * URL de una fuente, bajo su nombre.
   *
   * Deliberadamente pequena (REQ-020): es un dato de comprobacion, no algo que
   * se lea. A 12 sobre un nombre de 19 la jerarquia queda clara.
   */
  rowUrl: {
    fontFamily: FONT.serif,
    fontSize: 13,
    lineHeight: 18,
    color: COLOR.inkFooter,
  },

  /** Texto del estado de lista vacia y del error de base. */
  notice: {
    fontFamily: FONT.serif,
    fontSize: 16,
    lineHeight: 25,
    color: COLOR.inkMuted,
  },

  /**
   * Fecha de ultima actualizacion y tamano del mazo, en la fila de una fuente.
   *
   * Mas apagada que `rowUrl`: son metadatos de apoyo, y el nombre de la fuente
   * tiene que seguir siendo lo primero que se lee de la fila.
   */
  rowMeta: {
    fontFamily: FONT.label,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.6,
    color: COLOR.inkFooter,
  },

  /** Contador de la ventana de progreso: "7 de 20". */
  progressCount: {
    fontFamily: FONT.label,
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: 2,
    color: COLOR.inkWarm,
  },

  /**
   * El "Nº 01" del encabezado de la tarjeta.
   *
   * Y la SENAL ACCESIBLE de en que cara estas: dice `Nº 01` en el anverso y
   * `RESPUESTA Nº 01` en el reverso. El filete solo la refuerza (DD-023).
   *
   * En tinta de papel, no en oro: la tarjeta dejo de ser oscura.
   */
  cardNumber: {
    fontFamily: FONT.label,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 1.82,
    color: COLOR.paperLabel,
  },

  // `cardText` y `cardTextSecondary` YA NO ESTAN AQUI, y no es un olvido: el texto de la
  // tarjeta no tiene UN tamano, tiene tres, y lo elige `cardTextStep()` por la longitud
  // del texto. Ver mas abajo y DD-022.

  /** "Toca para ver la respuesta" y su vuelta. 0.14em sobre 13, en tinta de papel. */
  cardHint: {
    fontFamily: FONT.label,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 1.82,
    color: COLOR.paperHint,
  },

  // ── El contador de la barra inferior, en TRES piezas (DELTA-007) ──────────
  //
  // Era un solo `navCounter` a 14 px para "01 de 12", donde el `01` y el `12` pesaban
  // igual y habia que leerlos para saber donde vas. Ahora la jerarquia lo dice sola.
  //
  // `fontVariant: ['tabular-nums']` pide a la fuente su tabla `tnum`, para que las cifras
  // no bailen al pasar de `01` a `11`. NO ESTA GARANTIZADO que Barlow Condensed Regular la
  // traiga, y si no la trae el ajuste se ignora EN SILENCIO. Como comprobarlo y cual es el
  // respaldo: DD-027 y T-209. Se decide mirando, no suponiendo.

  /** La posicion actual: lo que se lee de un vistazo. */
  navCurrent: {
    fontFamily: FONT.label,
    fontSize: 20,
    lineHeight: 24,
    color: COLOR.ink,
    fontVariant: ['tabular-nums'],
  },

  /**
   * El "de". Lo mas apagado de los tres: es gramatica, no dato.
   *
   * Estuvo a 11 px con 2.42 dp de tracking —0.22 em—, que es lo que dice el diseno de
   * referencia. Lo cazo la regla de rotulos de `masonTheme.test.js`: ese valor viola el
   * propio DELTA-006 de este delta, escrito tres commits antes. Copiar el diseno sin
   * pasarlo por la regla que el delta establecio es exactamente el fallo que la regla
   * existe para encontrar, y lo encontro en codigo ya commiteado como hecho.
   *
   * A 12 px con 0.14 em la jerarquia se conserva de sobra: 20 para la posicion, 14 para el
   * total, 12 para esto.
   */
  navSeparator: {
    fontFamily: FONT.label,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.68,
    color: COLOR.inkFooter,
  },

  /** El total. Presente pero sin competir con la posicion. */
  navTotal: {
    fontFamily: FONT.label,
    fontSize: 14,
    lineHeight: 18,
    color: COLOR.inkDim,
    fontVariant: ['tabular-nums'],
  },
};

/**
 * Longitud maxima de texto de cada escalon, en caracteres.
 *
 * Constante con nombre y no literales repartidos por el archivo: son LO PRIMERO que habra
 * que retocar cuando se vea el mazo real, que hoy no conocemos —el CSV de ejemplo trae dos
 * filas cortas—. El ultimo escalon no tiene tope, asi que hay un umbral menos que escalones.
 *
 * De donde salen: con el ancho util del texto en ~346 dp y EB Garamond a ~0.42 em de ancho
 * medio, 36 px dan ~23 caracteres por linea y 26 px dan ~32. Los umbrales son los puntos
 * donde el texto deja de caber sin desplazarse.
 */
const STEP_MAX_CHARS = [80, 160];

/**
 * Los tres escalones del texto de la tarjeta, del mas grande al mas pequeno.
 *
 * `secondary` acompana a `text` en el MISMO escalon, y eso es lo importante de esta
 * estructura: `Respuesta2` CONTINUA a `Respuesta1` (deck-sync REQ-028), asi que su
 * jerarquia es relativa. Fijarla en un tamano absoluto haria que en el escalon pequeno la
 * continuacion saliera MAS GRANDE que la respuesta a la que continua.
 *
 * `lineHeight` en dp absolutos en los tres: React Native NO acepta multiplicadores.
 */
export const CARD_TEXT_STEPS = [
  {
    text: {fontFamily: FONT.serif, fontSize: 36, lineHeight: 43, color: COLOR.paperInk},
    secondary: {
      fontFamily: FONT.serif,
      fontSize: 24,
      lineHeight: 34,
      color: COLOR.paperInkSec,
    },
  },
  {
    text: {fontFamily: FONT.serif, fontSize: 30, lineHeight: 39, color: COLOR.paperInk},
    secondary: {
      fontFamily: FONT.serif,
      fontSize: 21,
      lineHeight: 30,
      color: COLOR.paperInkSec,
    },
  },
  {
    text: {fontFamily: FONT.serif, fontSize: 26, lineHeight: 36, color: COLOR.paperInk},
    secondary: {
      fontFamily: FONT.serif,
      fontSize: 18,
      lineHeight: 27,
      color: COLOR.paperInkSec,
    },
  },
];

/**
 * El escalon tipografico que le toca a un texto por su LONGITUD.
 *
 * Recibe UN NUMERO y no la tarjeta ni el texto, y eso es deliberado: asi se prueba con una
 * tabla de enteros —79, 80, 81, 159, 160, 161— sin montar un componente ni fabricar una
 * `Question`. Los saltos entre escalones son justo lo que hay que probar, y probarlos a
 * traves del render los enterraria. Ver DD-022.
 *
 * EL ORDEN IMPORTA, y es lo que hace compatible esto con REQ-034b: el escalon se elige
 * sobre el texto BASE, y el ajuste de tamano del sistema multiplica DESPUES, sobre el
 * escalon ya elegido. Al reves habria realimentacion —texto mas grande, menos caracteres
 * por linea, otro escalon— y el resultado dependeria del orden de evaluacion. Asi, dos
 * usuarios con ajustes distintos ven el MISMO escalon, uno escalado y el otro no.
 *
 * La longitud en caracteres es un PROXY del espacio ocupado, no una medida: "WWWWWWWW"
 * ocupa mucho mas que "iiiiiiii". Se acepta porque medir de verdad exigiria `onTextLayout`
 * y un ciclo de layout por tarjeta, y porque el `ScrollView` de REQ-034b esta debajo como
 * red de seguridad.
 *
 * @param {number} length  Caracteres del texto de la cara. Para el REVERSO es la SUMA de
 *   `Respuesta1` y `Respuesta2`: las dos son un solo cuerpo de texto, no dos.
 * @returns {{text: Object, secondary: Object}}
 */
export function cardTextStep(length) {
  const smallest = CARD_TEXT_STEPS[CARD_TEXT_STEPS.length - 1];

  // La guarda es EXPLICITA y no se deja al azar de la comparacion, porque al azar sale
  // mal: `-1 <= 80` es cierto, asi que sin esto un negativo caeria en el escalon GRANDE.
  // `NaN` si cae bien por accidente —toda comparacion con NaN es falsa—, y apoyarse en
  // dos accidentes de signo contrario es como se escriben los fallos que nadie encuentra.
  //
  // El degradado es al escalon PEQUENO: texto mas chico cabe siempre. Y no se lanza, que
  // es lo que corresponde a un modulo de presentacion.
  if (!Number.isFinite(length) || length < 0) {
    return smallest;
  }

  const index = STEP_MAX_CHARS.findIndex(max => length <= max);

  return index === -1 ? smallest : CARD_TEXT_STEPS[index];
}

/** Medidas en dp. */
export const LAYOUT = {
  /**
   * Ancho de referencia del diseno. En pantallas mas anchas el contenido se
   * limita a esto y se centra, en vez de estirarse (REQ-026).
   */
  maxWidth: 430,

  /** Ancho del cajon del menu lateral. */
  drawerWidth: 292,

  /**
   * Ancho de las columnas laterales del header. La derecha va vacia y existe
   * solo para equilibrar, de modo que el titulo quede centrado respecto de la
   * PANTALLA y no del espacio sobrante. Ver design.md DD-008.
   */
  headerSide: 46,

  /** Alto minimo de una entrada del menu. */
  menuItemHeight: 52,

  /** Ancho de la regla corta que encabeza el estado vacio, y del filete de la tarjeta. */
  ruleWidth: 34,

  /**
   * Grosor del filete de la cara de RESPUESTA, contra 1 dp en la de pregunta.
   *
   * Es una diferencia NO CROMATICA, y por eso existe: `paperRule` y `paperRuleAnswer` se
   * distinguen por matiz y casi no por luminosidad, asi que sin esto la senal seria solo
   * de color. Ver DD-023.
   */
  ruleHeightAnswer: 2,

  // ── Radios ────────────────────────────────────────────────────────────────
  // Tres escalones y no uno: un radio unico aplicado a una tarjeta de 300 dp y a un boton
  // de 40 se ve grande en el boton y timido en la tarjeta.

  /** La tarjeta. */
  radiusCard: 10,

  /** Superficies de contenido y campos de texto. */
  radiusSurface: 8,

  /** Botones. */
  radiusControl: 6,

  /**
   * Alto maximo de la imagen de una tarjeta.
   *
   * REQ-039 exige que el TEXTO siga dominando, asi que la imagen se acota por alto y
   * se ajusta al ancho respetando su proporcion. Sin este tope, una foto vertical
   * empujaria el texto fuera de la vista.
   */
  cardImageMaxHeight: 200,

  /**
   * Ancho maximo del cuadro de la ventana de progreso.
   *
   * ANCHO y no alto: el alto lo decide su contenido, para que con el texto del
   * sistema al maximo el cuadro CREZCA en vez de recortar lo que lleva dentro
   * (REQ-082). Ninguna medida de la ventana fija una altura.
   */
  dialogMaxWidth: 340,
};

/**
 * Sombras.
 *
 * Una sola entrada, y a proposito: la tarjeta es el UNICO objeto que flota. Si manana algo
 * mas necesita sombra, que se anada aca con su nombre, no que reutilice la de la tarjeta.
 */
export const ELEVATION = {
  /**
   * La sombra de la tarjeta.
   *
   * El diseno pide `box-shadow: 0 26px 56px -20px rgba(0,0,0,0.75)`. El cuarto valor, el
   * `-20px`, ESTRECHA la sombra, y React Native NO tiene ese parametro en ninguna
   * plataforma. Asi que esto es una APROXIMACION deliberada y no una traduccion: se
   * rebajan el desplazamiento (26 -> 18) y la opacidad (0.75 -> 0.5) precisamente porque
   * no se puede estrechar, y sin rebajarlos el halo saldria mucho mas ancho que el del
   * diseno.
   *
   * En Android NADA de lo anterior se lee: `elevation` es un solo numero del que el
   * sistema deriva su propia sombra. Es la divergencia iOS/Android que REQ-024 tolera
   * explicitamente desde este delta. El criterio no es «la misma sombra» sino «elevada en
   * las dos»; lo inaceptable es con sombra en una y sin sombra en la otra.
   *
   * RIESGO DECLARADO, a comprobar en dispositivo (T-209): la tarjeta vive dentro de un
   * `Animated.View` con `rotateY`, y en Android la sombra de `elevation` se calcula sobre
   * los limites de la vista, asi que durante el giro puede verse raro. Si molesta, la
   * salida es poner la sombra en un hermano que no rote, NO quitarla.
   *
   * Ver design.md DD-026.
   */
  card: {
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 18},
    shadowOpacity: 0.5,
    shadowRadius: 26,
    elevation: 14,
  },
};

/**
 * Tope de escalado tipografico para el chrome de la app.
 *
 * REQ-034 acota el respeto a la preferencia de tamano de texto del sistema a la
 * ZONA CENTRAL, que es donde esta el contenido legible. El header y el menu son
 * chrome: con el tamano de accesibilidad maximo (~3.1x en iOS) su texto invade
 * las columnas laterales, tapa la hamburguesa y rompe el centrado que exige
 * REQ-002. Verificado en simulador, ver design.md DD-016.
 *
 * 1.4 deja el texto notablemente mas grande sin desarmar la composicion. NO se
 * usa allowFontScaling={false}: eso ignoraria la preferencia por completo, y una
 * cosa es acotarla y otra desoirla.
 */
export const MAX_CHROME_FONT_SCALE = 1.4;

/** Tiempos y curvas de animacion. */
export const MOTION = {
  /**
   * Duracion de la apertura y el cierre del menu.
   *
   * El velo del diseno se funde en 260 ms, pero comparte este valor: un unico
   * valor animado evita que ambos se desincronicen, y 60 ms de diferencia sobre
   * un fundido de opacidad no se perciben. Ver design.md DD-002.
   */
  drawerMs: 320,

  /** Puntos de control de la cubic-bezier del diseno, para `Easing.bezier`. */
  drawerEasing: [0.22, 0.8, 0.2, 1],
};
