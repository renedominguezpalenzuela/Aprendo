/**
 * Zona central cuando no hay preguntas que mostrar.
 *
 * Esta composicion NO existe en el diseno de referencia, cuya zona central es
 * siempre una tarjeta. Se construye con su lenguaje visual: regla corta en oro,
 * titular en serif y cuerpo en gris.
 *
 * Se parametriza por props aunque hoy solo haya un texto posible, porque al
 * retomar los requisitos diferidos (requirements.md seccion 3.2) los estados de
 * error y de mazo vacio reutilizan esta misma composicion cambiando el texto.
 *
 * Ver specs/features/main-view/design.md seccion 2.6 y DD-011.
 *
 * @format
 */

import React from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';

import {COLOR, LAYOUT, TYPE} from '../theme/masonTheme';
import {EMPTY_STATE} from './masonCopy';

/**
 * @param {Object} props
 * @param {string} [props.title]
 * @param {string} [props.body]
 * @param {{label: string, onPress: () => void}} [props.action]
 *   Accion opcional bajo el cuerpo. Sin ella el componente se renderiza
 *   exactamente como antes: los estados de error y de mazo vacio que llegaran
 *   con los requisitos diferidos no tienen por que ofrecer ninguna.
 * @returns {React.ReactElement}
 */
export function EmptyState({
  title = EMPTY_STATE.title,
  body = EMPTY_STATE.body,
  action,
}) {
  return (
    // El ScrollView es lo que hace compatible respetar el tamano de fuente del
    // sistema con no desbordar la pantalla (REQ-034). Con el tamano por defecto
    // no hay nada que desplazar y `flexGrow: 1` mas `justifyContent: 'center'`
    // dejan el bloque centrado, igual que si fuera un View. Con el tamano
    // maximo, el texto crece y se puede desplazar.
    //
    // Aca NO se usa allowFontScaling={false}, a diferencia del wordmark del
    // splash (DD-013 de aquella feature): alli era un lockup de marca sin nada
    // que leer, y aca es la unica informacion de la pantalla, justo la que un
    // usuario con dificultad visual necesita poder agrandar. Ver DD-011.
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      // Sin contenido desbordado no hay nada que desplazar, y el indicador
      // parpadeando al tocar seria ruido.
      showsVerticalScrollIndicator={false}>
      <View style={styles.rule} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>

      {action != null && (
        <Pressable
          onPress={action.onPress}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          style={({pressed}) => [styles.action, pressed && styles.actionPressed]}>
          <Text style={styles.actionLabel}>{action.label.toUpperCase()}</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 30,
    gap: 14,
  },
  rule: {
    width: LAYOUT.ruleWidth,
    height: 1,
    backgroundColor: COLOR.goldDim,
  },
  title: TYPE.emptyTitle,
  body: TYPE.emptyBody,
  action: {
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingVertical: 13,
    paddingHorizontal: 22,
    backgroundColor: COLOR.buttonPrimary,
    borderRadius: LAYOUT.radiusControl,
  },
  actionPressed: {
    opacity: 0.85,
  },
  actionLabel: {
    ...TYPE.button,
    color: COLOR.buttonPrimaryInk,
  },
});
