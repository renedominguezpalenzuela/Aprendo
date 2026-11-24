/**
 * Barra inferior del mazo: `‹ Atras · NN de NN · Siguiente ›` (REQ-019).
 *
 * Presentacional: la posicion, el total y el cerrojo llegan por props. Quien los tiene
 * es `CardsView` (design.md seccion 2.10).
 *
 * Ver specs/features/main-view/design.md seccion 2.12 y DD-024.
 *
 * @format
 */

import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import {COLOR, TYPE} from '../theme/masonTheme';
import {
  CARD,
  deckPositionAccessibilityLabel,
  deckPositionParts,
} from './decksCopy';

/**
 * @param {Object} props
 * @param {number} props.position   Posicion 1-based.
 * @param {number} props.total
 * @param {() => void} props.onPrevious
 * @param {() => void} props.onNext
 * @param {boolean} [props.disabled]
 *   Hay una transicion en curso (DD-019). Los botones se ATENUAN, no desaparecen.
 * @returns {React.ReactElement}
 */
export function DeckNavBar({position, total, onPrevious, onNext, disabled = false}) {
  const parts = deckPositionParts(position, total);

  return (
    <View style={styles.bar}>
      <NavAction
        label={CARD.previous}
        direction="left"
        onPress={onPrevious}
        disabled={disabled}
      />

      {/*
        El indicador es TEXTO, no un control: no se puede pulsar y no debe anunciarse
        como si se pudiera (REQ-028).

        Y la etiqueta va EN ESTE CONTENEDOR, no en cada pieza. Es el riesgo de haberlo
        partido en tres: sin esto el lector recorreria "cero tres", "de" y "doce" como
        tres nodos sueltos, que es exactamente lo que REQ-028 prohibe. Se dice
        "Tarjeta 3 de 12", porque leer los ceros delante en voz alta suena a codigo.
      */}
      <View
        style={styles.counter}
        accessible
        accessibilityLabel={deckPositionAccessibilityLabel(position, total)}>
        <Text style={styles.counterCurrent}>{parts.current}</Text>
        <Text style={styles.counterSeparator}>{parts.separator.toUpperCase()}</Text>
        <Text style={styles.counterTotal}>{parts.total}</Text>
      </View>

      <NavAction
        label={CARD.next}
        direction="right"
        onPress={onNext}
        disabled={disabled}
      />
    </View>
  );
}

/**
 * @param {Object} props
 * @param {string} props.label
 * @param {'left'|'right'} props.direction
 *   De que lado va el chevron: a la izquierda del rotulo en `Atras`, a la derecha en
 *   `Siguiente`, apuntando cada uno hacia donde lleva.
 * @param {() => void} props.onPress
 * @param {boolean} props.disabled
 * @returns {React.ReactElement}
 */
function NavAction({label, direction, onPress, disabled}) {
  const isLeft = direction === 'left';

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{disabled}}
      // El chevron NO entra aca: es decoracion, y no lleva texto, asi que el lector no lo
      // ve. La etiqueta sigue siendo la de antes.
      accessibilityLabel={label}
      hitSlop={10}
      style={({pressed}) => [
        styles.action,
        disabled && styles.actionDisabled,
        pressed && styles.pressed,
      ]}>
      {isLeft && <Chevron direction="left" />}

      <Text style={styles.actionLabel}>{label.toUpperCase()}</Text>

      {!isLeft && <Chevron direction="right" />}
    </Pressable>
  );
}

/**
 * Un chevron, con UNA sola vista (DD-024).
 *
 * Una caja cuadrada de la que solo se pintan dos bordes es una `L`; girada 45 grados es un
 * `‹`, y a 225 un `›`. El aspa de `SideMenu` usa dos barras en `position: absolute`, que
 * para esto seria el doble de nodos y dos estilos espejo que pueden desincronizarse: aqui
 * la direccion es UN valor, asi que no puede quedar uno bien y el otro al reves.
 *
 * Sin `react-native-svg`: seria una dependencia nativa nueva por dos triangulos.
 *
 * @param {Object} props
 * @param {'left'|'right'} props.direction
 * @returns {React.ReactElement}
 */
function Chevron({direction}) {
  return (
    <View
      style={[
        styles.chevron,
        {transform: [{rotate: direction === 'left' ? '45deg' : '225deg'}]},
      ]}
    />
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 18,

    // Envuelve en vez de comprimir: con el texto del sistema al maximo los tres
    // elementos no caben en una linea (REQ-034). Y ahora menos que antes, porque los
    // rotulos crecieron de 13 con 2.6 dp de tracking a 13 con 1.82 y los botones ganaron
    // un chevron cada uno.
    flexWrap: 'wrap',
    rowGap: 10,
    columnGap: 16,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  actionLabel: {
    ...TYPE.button,
    color: COLOR.inkDim,
  },
  actionDisabled: {
    // Se ATENUA en vez de desaparecer, por lo mismo que el ACTUALIZAR de deck-sync:
    // un boton que se va deja al usuario buscando donde estaba.
    opacity: 0.4,
  },

  // El contador. `baseline` y no `center`: son tres tamanos distintos, y centrados por su
  // eje vertical el `20` y el `11` flotarian a alturas que no comparten ninguna linea.
  counter: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  counterCurrent: TYPE.navCurrent,
  counterSeparator: TYPE.navSeparator,
  counterTotal: TYPE.navTotal,

  chevron: {
    width: 9,
    height: 9,
    borderLeftWidth: 1.3,
    borderBottomWidth: 1.3,

    // El mismo 1.3 dp y el mismo gris que la hamburguesa y el aspa: es lo que hace que
    // los tres iconos parezcan de la misma familia.
    borderColor: COLOR.inkDim,

    // El mismo 1 dp de redondeo que las barras de la hamburguesa y del aspa, para que la
    // punta del chevron no salga afilada.
    borderRadius: 1,
  },
  pressed: {
    opacity: 0.7,
  },
});
