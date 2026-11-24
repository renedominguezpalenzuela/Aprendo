/**
 * Header de la vista principal: hamburguesa y titulo de la vista activa.
 *
 * Ver specs/features/main-view/design.md seccion 2.3 y DD-008.
 *
 * El rotulo fijo INSTRUCCION que iba sobre el titulo se retiro el 2026-08-19:
 * era marca repetida en cada pantalla y no decia nada de la vista. El bloque
 * central sigue siendo un bloque —no un Text suelto— porque su `flex: 1` entre
 * las dos columnas de 46 dp es lo que centra el titulo en la PANTALLA y no en
 * el espacio sobrante (REQ-002, DD-008).
 *
 * @format
 */

import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import {COLOR, LAYOUT, MAX_CHROME_FONT_SCALE, TYPE} from '../theme/masonTheme';

/**
 * Padding superior del header, en dp, antes de sumarle el inset del sistema.
 *
 * Es una constante y no se lee de `styles.header`: leer un valor del objeto que
 * StyleSheet.create devuelve funciona hoy, pero ata el componente a un detalle
 * de implementacion de React Native que no es contrato publico.
 */
const HEADER_PADDING_TOP = 26;

/**
 * @param {Object} props
 * @param {string} props.title       Titulo de la vista activa.
 * @param {() => void} props.onOpenMenu
 * @param {number} [props.topInset]  Inset superior del sistema, en dp.
 * @returns {React.ReactElement}
 */
export function AppHeader({title, onOpenMenu, topInset = 0}) {
  return (
    <View style={[styles.header, {paddingTop: topInset + HEADER_PADDING_TOP}]}>
      <Pressable
        onPress={onOpenMenu}
        accessibilityRole="button"
        accessibilityLabel="Abrir menú"
        hitSlop={8}
        style={styles.button}>
        <MenuIcon />
      </Pressable>

      {/*
        El texto del header escala con el sistema pero con tope (REQ-002): sin
        el, con el tamano de accesibilidad maximo el titulo invade las columnas
        laterales y tapa la hamburguesa. REQ-034 acota el escalado sin tope a la
        zona central, que es donde esta el contenido. Ver design.md DD-016.
      */}
      <View style={styles.titleBlock}>
        <Text
          style={styles.title}
          maxFontSizeMultiplier={MAX_CHROME_FONT_SCALE}
          numberOfLines={2}>
          {title}
        </Text>
      </View>

      {/*
        Tercera columna vacia, a proposito.

        Es la traduccion del `grid-template-columns: 46px 1fr 46px` del diseno.
        Sin ella el bloque central se centraria en el espacio SOBRANTE y no en la
        pantalla, asi que su posicion dependeria del ancho del boton: exactamente
        lo que prohibe REQ-002. Ver design.md DD-008.
      */}
      <View style={styles.spacer} />
    </View>
  );
}

/**
 * Tres trazos horizontales. Se dibuja con vistas y no con un SVG porque
 * react-native-svg seria una dependencia nativa nueva para tres rectangulos.
 *
 * @returns {React.ReactElement}
 */
function MenuIcon() {
  return (
    <View style={styles.icon}>
      <View style={styles.iconBar} />
      <View style={styles.iconBar} />
      <View style={styles.iconBar} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 14,
    paddingLeft: 12,
    paddingRight: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLOR.rule,
  },
  button: {
    width: LAYOUT.headerSide,
    height: LAYOUT.headerSide,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  titleBlock: {
    flex: 1,
    alignItems: 'center',
  },
  spacer: {
    width: LAYOUT.headerSide,
  },
  title: {
    ...TYPE.headerTitle,
    textAlign: 'center',
  },
  icon: {
    width: 19,
    height: 13,
    justifyContent: 'space-between',
  },
  iconBar: {
    height: 1.3,
    borderRadius: 1,
    backgroundColor: COLOR.inkWarm,
  },
});
