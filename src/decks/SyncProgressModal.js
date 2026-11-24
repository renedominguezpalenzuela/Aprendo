/**
 * Ventana de progreso de una actualizacion.
 *
 * NO usa `Modal` de React Native, y no es un descuido (DD-009): `Modal` trae
 * `onRequestClose`, que ES un manejador del atras de Android, o sea un SEGUNDO
 * dueno de ese boton. `data-sources` DD-002 y DD-013 existen para que ese orden
 * este escrito en un solo sitio —`useViewRouter`—, y REQ-057 se cumple alli.
 *
 * Es un overlay hermano de `Scrim` y `SideMenu`, montado FUERA de la columna del
 * chasis: en una tablet la columna mide 430 dp y el resto de la pantalla es fondo,
 * asi que un velo dentro de la columna dejaria un marco lateral sin cubrir por el
 * que pasarian los toques (REQ-055).
 *
 * Ver specs/features/deck-sync/design.md seccion 2.12 y DD-009.
 *
 * @format
 */

import React from 'react';
import {ActivityIndicator, Pressable, StyleSheet, Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {COLOR, LAYOUT, TYPE} from '../theme/masonTheme';
import {progressLabel, SYNC} from './decksCopy';

/**
 * @param {Object} props
 * @param {import('./deckSyncStore').SyncState} props.state
 * @param {() => void} props.onCancel
 * @returns {React.ReactElement|null}
 */
export function SyncProgressModal({state, onCancel}) {
  const insets = useSafeAreaInsets();

  // Solo mientras se descarga. El desenlace —cuantas imagenes se omitieron, o que
  // fallo— lo cuenta la fila, porque REQ-056 manda cerrar ESTA ventana al terminar
  // y REQ-043 manda decir algo: son dos cosas distintas en dos sitios distintos.
  if (state.phase !== 'preparing' && state.phase !== 'working') {
    return null;
  }

  const total = state.phase === 'working' ? state.total : null;
  const done = state.phase === 'working' ? state.done : 0;

  // `null` mientras el total no se conoce: el indicador va sin numeros, y no se
  // muestra un cero ni un total inventado (REQ-053).
  const progress = progressLabel(done, total);

  return (
    <View
      style={[
        styles.veil,
        {
          // El VELO llega de borde a borde —el fondo no se recorta por los insets,
          // igual que en el resto del chasis (REQ-032 de main-view)— pero el CUADRO
          // se centra DENTRO de ellos: con el texto del sistema al maximo crece, y
          // sin esto su contenido se metería bajo la barra de estado o bajo el
          // indicador de inicio (REQ-081, REQ-082).
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
      ]}
      // Un View con fondo por encima de todo absorbe los toques por si mismo: no
      // hacen falta ni `pointerEvents` ni un Pressable vacio. Y NO se cierra al
      // tocar fuera: cancelar tiene su boton (REQ-054, REQ-055).
      accessibilityViewIsModal
      accessibilityLabel={`Actualizando ${state.sourceName}`}>
      <View style={styles.dialog}>
        <Text style={styles.eyebrow}>{SYNC.eyebrow.toUpperCase()}</Text>

        <Text style={styles.name} numberOfLines={2}>
          {state.sourceName}
        </Text>

        <ActivityIndicator size="large" color={COLOR.goldBright} />

        {progress == null ? null : (
          <Text
            style={styles.count}
            // Para que el lector de pantalla anuncie los avances sin que el usuario
            // tenga que ir a buscarlos (REQ-083).
            accessibilityLiveRegion="polite"
            accessibilityLabel={`${progress} preguntas`}>
            {progress}
          </Text>
        )}

        <Pressable
          onPress={onCancel}
          accessibilityRole="button"
          // Con el nombre de la fuente dentro: al oirlo, "Cancelar" a secas no dice
          // que se cancela (REQ-083).
          accessibilityLabel={`${SYNC.cancel} la actualización de ${state.sourceName}`}
          hitSlop={8}
          style={({pressed}) => [styles.cancel, pressed && styles.pressed]}>
          <Text style={styles.cancelLabel}>{SYNC.cancel.toUpperCase()}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  veil: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLOR.scrim,
    alignItems: 'center',
    justifyContent: 'center',

    // Por encima del cajon del menu (zIndex 50) y de su velo (40): mientras se
    // actualiza, esto es lo unico con lo que se puede interactuar.
    zIndex: 60,
  },
  dialog: {
    // El margen lateral va en el cuadro y no en el velo, para que se sume a los
    // insets en vez de competir con ellos.
    marginHorizontal: 24,
    flexShrink: 1,
    width: '100%',
    maxWidth: LAYOUT.dialogMaxWidth,
    backgroundColor: COLOR.dialog,
    borderWidth: 1,
    borderColor: COLOR.dialogBorder,
    borderRadius: LAYOUT.radiusSurface,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',

    // SIN altura fija, ni minima, ni maxima: con el texto del sistema al maximo el
    // cuadro tiene que crecer, no recortar lo que lleva dentro (REQ-082).
    gap: 18,
  },
  eyebrow: TYPE.eyebrow,
  name: {
    ...TYPE.drawerTitle,
    textAlign: 'center',
  },
  count: TYPE.progressCount,
  cancel: {
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderWidth: 1,
    borderColor: COLOR.buttonGhostBorder,
    borderRadius: LAYOUT.radiusControl,
  },
  cancelLabel: {
    ...TYPE.button,
    color: COLOR.inkDim,
  },
  pressed: {
    opacity: 0.7,
  },
});
