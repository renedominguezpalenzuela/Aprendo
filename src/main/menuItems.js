/**
 * Entradas del menu lateral.
 *
 * Ver specs/features/main-view/design.md seccion 3.
 *
 * @format
 */

/**
 * @typedef {Object} MenuItem
 * @property {string}  key        Identificador estable.
 * @property {string}  label      Texto de la entrada, en caja alta al pintarse.
 * @property {boolean} available  false ⇒ atenuada, con el rotulo "pronto", y no
 *                                accionable.
 */

/**
 * `available` es un dato de la entrada y no una rama en el JSX del menu: cuando
 * las vistas Datos y Acerca de existan, el cambio es poner `true`. Ninguna otra
 * linea se toca.
 *
 * @type {MenuItem[]}
 */
export const MENU_ITEMS = [
  {key: 'cards', label: 'Tarjetas', available: true},
  {key: 'data', label: 'Datos', available: true},
  {key: 'about', label: 'Acerca de', available: false},
];
