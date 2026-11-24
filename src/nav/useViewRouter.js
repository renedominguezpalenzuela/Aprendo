/**
 * Que vista esta activa y como se vuelve.
 *
 * SIN librería de navegacion (design.md DD-001): son dos vistas hermanas, sin
 * pila, sin parametros de ruta y sin historial. `react-navigation` arrastraria
 * react-native-screens, gesture-handler y reanimated: tres dependencias nativas
 * mas bajo el techo de Xcode 15.2, que esta feature ya ha visto morder.
 *
 * Ver specs/features/data-sources/design.md seccion 2.7, DD-001 y DD-002.
 *
 * @format
 */

import {useCallback, useEffect, useState} from 'react';
import {BackHandler, Platform} from 'react-native';

/**
 * @typedef {'cards' | 'data'} ViewKey
 *
 * @typedef {Object} ViewRouter
 * @property {ViewKey} activeView
 * @property {(key: ViewKey) => void} navigate
 */

/** Vista de arranque. */
export const INITIAL_VIEW = 'cards';

/**
 * @param {Object} options
 * @param {boolean} options.isMenuOpen
 * @param {() => void} options.closeMenu
 *   El router necesita saber del menu porque el atras de Android lo repliega
 *   ANTES de cambiar de vista (REQ-048).
 * @param {boolean} [options.isSyncing]
 *   Hay una actualizacion de mazo en curso. Va aca, y no en una suscripcion
 *   propia de la ventana de progreso, porque el atras tiene UN dueno y este es
 *   (deck-sync REQ-057, DD-008).
 * @returns {ViewRouter}
 */
export function useViewRouter({isMenuOpen, closeMenu, isSyncing = false}) {
  const [activeView, setActiveView] = useState(INITIAL_VIEW);

  const navigate = useCallback(key => setActiveView(key), []);

  useEffect(() => {
    // En iOS no hay boton ni gesto de atras que atender. `BackHandler` existe en
    // ambas plataformas pero en iOS no dispara nunca, asi que suscribirse seria
    // ruido.
    if (Platform.OS !== 'android') {
      return undefined;
    }

    /**
     * UNA sola suscripcion que decide en orden (DD-002).
     *
     * Dos suscripciones independientes —una del menu, otra del router— se
     * ejecutan en orden INVERSO al de registro, y ese orden depende de en que
     * punto del arbol se monte cada componente: funcionaria hasta que alguien
     * reordene el JSX. Aca el orden es un `if` escrito a la vista.
     *
     * @returns {boolean} true = consumido; false = que siga el sistema.
     */
    const onBack = () => {
      // PRIMERO la actualizacion en curso: mientras la ventana de progreso esta
      // visible, atras no hace NADA (deck-sync REQ-057). Se consume el evento para
      // que el sistema tampoco mande la app a segundo plano, que dejaria una
      // descarga larga corriendo detras de una pantalla que el usuario no ve.
      //
      // Se ignora en vez de cancelar a proposito: una descarga de dos minutos no
      // puede morir por un gesto reflejo. Cancelar tiene su boton.
      if (isSyncing) {
        return true;
      }

      if (isMenuOpen) {
        closeMenu();
        return true;
      }

      if (activeView !== INITIAL_VIEW) {
        setActiveView(INITIAL_VIEW);
        return true;
      }

      // En la vista de tarjetas con el menu cerrado, atras hace lo que hace
      // siempre en Android: mandar la app a segundo plano.
      return false;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBack);

    return () => subscription.remove();
  }, [activeView, closeMenu, isMenuOpen, isSyncing]);

  return {activeView, navigate};
}
