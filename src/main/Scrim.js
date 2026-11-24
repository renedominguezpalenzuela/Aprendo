/**
 * Velo que cubre la pantalla mientras el menu lateral esta desplegado.
 *
 * Ver specs/features/main-view/design.md seccion 2.5 y DD-002.
 *
 * @format
 */

import React from 'react';
import {Animated, Pressable, StyleSheet} from 'react-native';

import {COLOR} from '../theme/masonTheme';

/**
 * @param {Object} props
 * @param {Animated.Value} props.progress  0 = cerrado, 1 = abierto.
 * @param {boolean} props.isOpen
 * @param {() => void} props.onPress
 * @returns {React.ReactElement}
 */
export function Scrim({progress, isOpen, onPress}) {
  return (
    <Animated.View
      // `pointerEvents` sale de isOpen y NO del valor animado: no es una
      // propiedad animable, y con el menu cerrado el velo tiene que dejar pasar
      // los toques al contenido de debajo.
      pointerEvents={isOpen ? 'auto' : 'none'}
      style={[styles.scrim, {opacity: progress}]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Cerrar menú"
        style={styles.fill}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLOR.scrim,

    // Por encima del contenido y por debajo del cajon.
    zIndex: 40,
  },
  fill: {
    flex: 1,
  },
});
