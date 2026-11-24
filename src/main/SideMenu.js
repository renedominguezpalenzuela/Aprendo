/**
 * Menu lateral: cabecera, entradas y pie.
 *
 * Ver specs/features/main-view/design.md seccion 2.5 y DD-010.
 *
 * @format
 */

import React from 'react';
import {Animated, Pressable, StyleSheet, Text, View} from 'react-native';

import {COLOR, LAYOUT, MAX_CHROME_FONT_SCALE, TYPE} from '../theme/masonTheme';
import {MENU_ITEMS} from './menuItems';
import {SOON_LABEL, soonAccessibilityLabel} from './masonCopy';

const {version: APP_VERSION} = require('../../package.json');

/** El menu es chrome, igual que el header: escalado con tope (DD-016). */
const CHROME = MAX_CHROME_FONT_SCALE;

/**
 * @param {Object} props
 * @param {Animated.Value} props.progress   0 = cerrado, 1 = abierto.
 * @param {boolean} props.isOpen
 * @param {() => void} props.onClose
 * @param {{top: number, bottom: number}} props.insets
 * @param {number} [props.deckCount]
 *   Numero de preguntas del mazo cargado. Sin mazo se omite la linea entera, en
 *   vez de mostrar un cero o dejar un hueco (REQ-006 de main-view).
 * @param {string} props.activeView
 *   Clave de la vista que se esta viendo. Marca UNA entrada, no todas las
 *   disponibles (REQ-046 de data-sources).
 * @param {(key: string) => void} props.onSelect
 * @param {string} props.title
 *   Titulo de la cabecera del cajon. Es el MISMO que titula la vista de
 *   tarjetas —el nombre de la fuente activa— y no el de la vista que se este
 *   viendo: con un titulo fijo, el cajon decia "Preguntas y Respuestas"
 *   mientras el header decia el nombre de la fuente, y dos titulos distintos a
 *   la vez, uno en cada sitio, se leen como un fallo.
 * @returns {React.ReactElement}
 */
export function SideMenu({
  progress,
  isOpen,
  onClose,
  insets,
  deckCount,
  activeView,
  onSelect,
  title,
}) {
  // El cajon entra desde fuera de la pantalla. Se desplaza su ancho completo mas
  // un margen, para que la sombra tampoco asome con el menu cerrado.
  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-(LAYOUT.drawerWidth + 30), 0],
  });

  return (
    <Animated.View
      accessibilityViewIsModal={isOpen}
      // Sin esto, con el menu cerrado el cajon sigue capturando los toques de la
      // banda izquierda de la pantalla aunque este fuera de vista.
      pointerEvents={isOpen ? 'auto' : 'none'}
      style={[
        styles.drawer,
        {paddingTop: insets.top, transform: [{translateX}]},
      ]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title} maxFontSizeMultiplier={CHROME} numberOfLines={2}>
            {title}
          </Text>
        </View>

        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Cerrar menú"
          hitSlop={10}
          style={styles.close}>
          <CloseIcon />
        </Pressable>
      </View>

      <View style={styles.items}>
        {MENU_ITEMS.map(item => (
          <MenuEntry
            key={item.key}
            item={item}
            isActive={item.key === activeView}
            onSelect={onSelect}
          />
        ))}
      </View>

      <View style={[styles.footer, {paddingBottom: insets.bottom + 30}]}>
        <Text style={styles.footerLine} maxFontSizeMultiplier={CHROME}>
          {`Versión ${APP_VERSION}`}
        </Text>
        {deckCount != null && (
          <Text style={styles.footerLine} maxFontSizeMultiplier={CHROME}>
            {`${deckCount} preguntas`}
          </Text>
        )}
      </View>
    </Animated.View>
  );
}

/**
 * Una entrada del menu.
 *
 * Las no disponibles NO son un Pressable deshabilitado: son texto. Un boton
 * deshabilitado se anuncia al lector de pantalla como un boton que no funciona,
 * que un usuario interpreta como aplicacion rota; un texto con la etiqueta
 * "Datos, proximamente" comunica que la funcion aun no existe. Ademas elimina la
 * posibilidad de que un onPress olvidado cierre el menu sin llevar a nada.
 * Ver design.md DD-010.
 *
 * @param {Object} props
 * @param {import('./menuItems').MenuItem} props.item
 * @param {boolean} props.isActive
 * @param {(key: string) => void} props.onSelect
 * @returns {React.ReactElement}
 */
function MenuEntry({item, isActive, onSelect}) {
  const label = item.label.toUpperCase();

  if (!item.available) {
    return (
      <View
        style={styles.entry}
        accessibilityRole="text"
        accessibilityLabel={soonAccessibilityLabel(item.label)}>
        <Text
          style={[styles.entryLabel, styles.entryUnavailable]}
          maxFontSizeMultiplier={CHROME}
          numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.badge} maxFontSizeMultiplier={CHROME} numberOfLines={1}>
          {SOON_LABEL}
        </Text>
      </View>
    );
  }

  // `selected` sale de la vista que se esta viendo, no de que la entrada este
  // disponible. Con dos vistas alcanzables, el `selected: true` fijo que habia
  // aca marcaba las dos a la vez (REQ-046).
  return (
    <Pressable
      onPress={() => onSelect(item.key)}
      accessibilityRole="button"
      accessibilityLabel={item.label}
      accessibilityState={{selected: isActive}}
      style={[styles.entry, isActive && styles.entryActive]}>
      <Text
        style={[styles.entryLabel, isActive && styles.entryActiveLabel]}
        maxFontSizeMultiplier={CHROME}
        numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Aspa. Dos vistas rotadas, por lo mismo que la hamburguesa: sin SVG. */
function CloseIcon() {
  return (
    <View style={styles.closeIcon}>
      <View style={[styles.closeBar, styles.closeBarA]} />
      <View style={[styles.closeBar, styles.closeBarB]} />
    </View>
  );
}

const styles = StyleSheet.create({
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: LAYOUT.drawerWidth,
    backgroundColor: COLOR.drawer,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: COLOR.border,

    // Por encima del velo.
    zIndex: 50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingTop: 28,
    paddingHorizontal: 22,
    paddingBottom: 22,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLOR.rule,
  },
  headerText: {
    // El `flex: 1` es lo que empuja el boton de cerrar al canto derecho: sin el,
    // un titulo corto lo arrastraria hacia el centro.
    flex: 1,
  },
  title: {
    ...TYPE.drawerTitle,
    color: COLOR.inkWarm,
  },
  close: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -4,
    marginRight: -6,
  },
  items: {
    flex: 1,
    paddingVertical: 14,
  },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: LAYOUT.menuItemHeight,
    paddingHorizontal: 22,

    // La marca de seleccion es este borde: siempre esta, y solo cambia de color.
    // Asi la entrada activa no se desplaza 2 dp respecto de las demas.
    borderLeftWidth: 2,
    borderLeftColor: 'transparent',
  },
  entryActive: {
    borderLeftColor: COLOR.goldBright,
    backgroundColor: 'rgba(176,141,85,0.09)',
  },
  entryLabel: {
    ...TYPE.menuItem,

    // Color por defecto de una entrada DISPONIBLE que no es la vista actual. Ese
    // caso no existia mientras Tarjetas era la unica vista alcanzable, asi que
    // el estilo se quedaba sin color y el texto caia al negro por defecto.
    color: COLOR.inkDim,
  },
  entryActiveLabel: {
    color: COLOR.ink,
  },
  entryUnavailable: {
    color: COLOR.inkFaint,
  },
  badge: TYPE.menuBadge,
  footer: {
    paddingTop: 20,
    paddingHorizontal: 22,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLOR.rule,
    gap: 4,
  },
  footerLine: TYPE.menuFooter,
  closeIcon: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBar: {
    position: 'absolute',
    width: 16,
    height: 1.3,
    borderRadius: 1,
    backgroundColor: COLOR.inkFaint,
  },
  closeBarA: {
    transform: [{rotate: '45deg'}],
  },
  closeBarB: {
    transform: [{rotate: '-45deg'}],
  },
});
