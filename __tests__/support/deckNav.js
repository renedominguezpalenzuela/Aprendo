/**
 * Leer el contador de la barra del mazo como lo VE el usuario.
 *
 * Desde DELTA-007 el indicador no es un `Text` con `03 de 12` dentro: son TRES `Text`
 * hermanos a tres tamanos distintos, para que la posicion se lea de un vistazo en vez de
 * pesar lo mismo que el total. Eso dejo a tres suites buscando una cadena que ya no existe.
 *
 * Este ayudante recompone lo que se ve. Vive aca y no repetido en cada suite porque lo
 * consumen `DeckNavBar`, `CardsView` y `MainView`, y una copia por suite significa tres
 * sitios que actualizar la proxima vez que la barra cambie.
 *
 * @format
 */

import {Text, View} from 'react-native';

/**
 * @param {any} style
 * @returns {Record<string, any>}
 */
function flatten(style) {
  if (Array.isArray(style)) {
    return style.reduce((acc, item) => ({...acc, ...flatten(item)}), {});
  }

  return style ?? {};
}

/**
 * El contenedor del contador.
 *
 * Se localiza por `alignItems: 'baseline'`, que es exclusivo suyo en todo el arbol: es la
 * unica fila que alinea por linea base, precisamente porque es la unica que mezcla tres
 * tamanos de texto. Buscarlo por su contenido seria circular —el contenido es lo que se
 * quiere comprobar— y por su posicion en el arbol, fragil.
 *
 * @param {any} renderer
 * @returns {any}
 */
export function findCounter(renderer) {
  const matches = renderer.root
    .findAllByType(View)
    .filter(node => flatten(node.props.style).alignItems === 'baseline');

  if (matches.length !== 1) {
    throw new Error(
      `deckNav: se esperaba UN contador y se encontraron ${matches.length}. ` +
        'Si la barra cambio, actualizar este ayudante.',
    );
  }

  return matches[0];
}

/**
 * El contador como una sola cadena, ya en la caja en que se pinta: `03 DE 12`.
 *
 * @param {any} renderer
 * @returns {string}
 */
export function readCounter(renderer) {
  return findCounter(renderer)
    .findAllByType(Text)
    .map(node => node.props.children)
    .join(' ');
}
