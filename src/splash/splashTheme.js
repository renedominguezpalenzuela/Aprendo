/**
 * Valores visuales y de tiempo del splash screen.
 *
 * Unica fuente de verdad compartida entre el componente JS y el comando de
 * generacion de assets nativos.
 *
 * Ver specs/features/splash-screen/design.md seccion 3.
 *
 * @format
 */

/**
 * Fondo hueso calido. Debe coincidir con el `--background` pasado al CLI de
 * react-native-bootsplash, o habra un cambio de color perceptible entre la capa
 * nativa y la capa JS (REQ-011).
 *
 * @type {string}
 */
export const SPLASH_BACKGROUND = '#F4F1EA';

/**
 * Granate del logo, medido directamente del PNG. Sobre SPLASH_BACKGROUND da un
 * contraste aproximado de 16:1.
 *
 * @type {string}
 */
export const SPLASH_INK = '#2F0101';

/**
 * Tiempo minimo que el wordmark debe permanecer visible, contado desde que la
 * capa JS reemplaza a la nativa (REQ-004, enmendado segun DD-003).
 *
 * @type {number}
 */
export const MIN_VISIBLE_MS = 1000;

/**
 * Respaldo por si el traspaso de la capa nativa a la JS nunca ocurre (modulo
 * nativo caido, imagen que no carga). Sin esto el overlay quedaria montado para
 * siempre. Ver design.md seccion 2.2.
 *
 * No confundir con el timeout de seguridad de la carga de datos, que quedo
 * fuera de alcance en requirements seccion 4.
 *
 * @type {number}
 */
export const HANDOFF_TIMEOUT_MS = 3000;

/**
 * Ancho del logo en dp. DEBE coincidir con el `--logo-width` usado al generar
 * los assets nativos (ver design.md seccion 2.1); si difieren, el logo cambia de
 * tamano en el traspaso.
 *
 * 192 dp es el MAXIMO que acepta Android: por encima el CLI de bootsplash se
 * niega a generar el drawable ("Logo exceeds 192x192dp and will be cropped by
 * Android"). Poner 240 hizo exactamente eso y la advertencia paso inadvertida,
 * con lo que Android quedo mostrando un drawable viejo de 52 dp mientras la capa
 * JS mostraba 125 dp.
 *
 * Este es el ancho de la IMAGEN, no del dibujo: el asset de origen lleva padding
 * transparente (ver scripts/make-padded-logo.py). Con el padding actual, 192 dp
 * de imagen dan ~140 dp de arte visible.
 *
 * @type {number}
 */
export const LOGO_WIDTH_DP = 192;

/**
 * Separacion vertical entre el borde inferior de la IMAGEN del logo y el
 * wordmark, en dp. Como la imagen incluye el padding transparente, la separacion
 * que se percibe respecto del dibujo es mayor que este numero.
 *
 * @type {number}
 */
export const WORDMARK_GAP = 40;

/** @type {string} */
export const WORDMARK_TEXT = 'APRENDO';

/**
 * Estilo del wordmark.
 *
 * `fontFamily` usa el nombre PostScript de Cinzel, que coincide con el nombre
 * del archivo. Eso permite un unico valor para iOS (resuelve por nombre
 * PostScript) y Android (resuelve por nombre de archivo).
 *
 * No se declara `fontWeight` a proposito: la familia ya es la variante Bold, y
 * pedir un peso encima produce sintetizado inconsistente entre plataformas
 * (design.md DD-006).
 */
export const WORDMARK_STYLE = {
  fontFamily: 'Cinzel-Bold',
  fontSize: 20,
  letterSpacing: 4,
  color: SPLASH_INK,
};
