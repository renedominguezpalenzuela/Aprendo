/**
 * Estado y animacion del menu lateral.
 *
 * Ver specs/features/main-view/design.md seccion 2.4 y DD-002.
 *
 * @format
 */

import {useCallback, useMemo, useRef, useState} from 'react';
import {Animated, Easing} from 'react-native';

import {MOTION} from '../theme/masonTheme';

/**
 * @typedef {Object} SideMenuController
 * @property {Animated.Value} progress
 *   0 = cerrado, 1 = abierto. El cajon lo interpola a translateX y el velo a
 *   opacity. Un unico valor para ambos: dos valores independientes pueden
 *   desincronizarse si un render se cuela entre sus dos start(), y la diferencia
 *   de 60 ms que el diseno le da al velo no se percibe (DD-002).
 * @property {boolean} isOpen
 *   Estado de React, NO derivado del valor animado. Hace falta para
 *   `pointerEvents` del velo y para `accessibilityViewIsModal`, que no son
 *   propiedades animables.
 * @property {() => void} open
 * @property {() => void} close
 */

/**
 * @returns {SideMenuController}
 */
export function useSideMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;

  const animateTo = useCallback(
    toValue => {
      Animated.timing(progress, {
        toValue,
        duration: MOTION.drawerMs,
        easing: Easing.bezier(...MOTION.drawerEasing),

        // translateX y opacity son ambas compatibles con el driver nativo, asi
        // que la animacion corre en el hilo de UI: un render lento de JS no la
        // entrecorta.
        useNativeDriver: true,
      }).start();
    },
    [progress],
  );

  // La guarda de idempotencia vive en una ref y no en el updater de setIsOpen:
  // los updaters deben ser funciones puras, y React los invoca dos veces en
  // StrictMode. Lanzar la animacion desde dentro dispararia dos animaciones por
  // cada toque.
  const openRef = useRef(false);

  const open = useCallback(() => {
    // Sin esta guarda, tocar dos veces la hamburguesa encadena dos animaciones
    // hacia el mismo destino, y la segunda reinicia la curva desde donde quedo
    // la primera: se ve un tiron.
    if (openRef.current) {
      return;
    }
    openRef.current = true;
    setIsOpen(true);
    animateTo(1);
  }, [animateTo]);

  const close = useCallback(() => {
    if (!openRef.current) {
      return;
    }
    openRef.current = false;
    setIsOpen(false);
    animateTo(0);
  }, [animateTo]);

  return useMemo(
    () => ({progress, isOpen, open, close}),
    [progress, isOpen, open, close],
  );
}
