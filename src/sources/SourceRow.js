/**
 * Una fila de la lista de fuentes.
 *
 * Presentacional: TODO lo que pinta llega por props, incluido el estado de la
 * actualizacion. Quien la conecta con los hooks es `DataScreen` (deck-sync
 * design.md seccion 2.15).
 *
 * Ver specs/features/data-sources/design.md seccion 2.10 y DD-013, y
 * specs/features/deck-sync/design.md seccion 2.12 y seccion 2.13.
 *
 * @format
 */

import React from 'react';
import {Alert, Pressable, StyleSheet, Text, View} from 'react-native';

import {
  deckSizeLabel,
  lastSyncedLabel,
  rowWarningsMessage,
  SYNC,
  syncErrorMessage,
  syncResultMessage,
} from '../decks/decksCopy';
import {COLOR, LAYOUT, TYPE} from '../theme/masonTheme';
import {ROW, activationAccessibilityLabel, removeConfirmation} from './sourcesCopy';

/**
 * @param {Object} props
 * @param {import('./sourcesRepo').Source} props.source
 * @param {(id: number) => void} props.onActivate
 * @param {(source: import('./sourcesRepo').Source) => void} props.onEdit
 * @param {(id: number) => void} props.onRemove
 * @param {(source: import('./sourcesRepo').Source) => void} props.onSync
 * @param {() => void} props.onDismissSync
 * @param {import('../decks/decksRepo').DeckSummary|null} [props.summary]
 *   Cuantas preguntas tiene el mazo de ESTA fuente y cuanto ocupa (REQ-014).
 * @param {import('../decks/deckSyncStore').SyncState|null} [props.syncState]
 *   El estado de la actualizacion SOLO si es la de esta fuente; `null` si no.
 * @param {boolean} [props.syncBusy]
 *   Hay una actualizacion en curso, de esta fuente o de otra (REQ-013).
 * @returns {React.ReactElement}
 */
export function SourceRow({
  source,
  onActivate,
  onEdit,
  onRemove,
  onSync,
  onDismissSync,
  summary = null,
  syncState = null,
  syncBusy = false,
}) {
  const {isActive} = source;

  // El mazo de ejemplo viene dentro de la app: no tiene hoja, asi que no hay URL
  // que mostrar, nada que actualizar ni que editar, y "Nunca actualizada" seria
  // falso. Se activa y se borra como cualquiera (EJEMPLO-003).
  const isExample = source.isExample === true;

  // La fecha sale del resumen si lo hay, y si no de la propia fuente: las dos la
  // traen, y el resumen es el que esta recien releido tras una actualizacion.
  const lastSyncedAt = summary?.lastSyncedAt ?? source.lastSyncedAt ?? null;
  const size = deckSizeLabel(summary);
  const notice = isExample ? null : syncNotice(syncState);

  const confirmRemove = () => {
    const copy = removeConfirmation(source.name, {isExample});

    // Alert del sistema y no un modal propio (DD-013). Dos motivos, y el
    // segundo pesa mas que el estetico: es una confirmacion destructiva, donde
    // reconocer el boton que destruye vale mas que la coherencia de marca; y un
    // modal propio seria una TERCERA capa compitiendo por el atras de Android,
    // junto al menu lateral y al router, que es justo el orden que DD-002 existe
    // para mantener escrito en un solo sitio.
    Alert.alert(copy.title, copy.message, [
      {text: copy.cancel, style: 'cancel'},
      {text: copy.confirm, style: 'destructive', onPress: () => onRemove(source.id)},
    ]);
  };

  return (
    <View style={[styles.row, isActive && styles.rowActive]}>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={2}>
          {source.name}
        </Text>
        <Text
          style={styles.url}
          numberOfLines={1}
          // Por el MEDIO y no por el final: el `gid` del final es lo que
          // distingue dos fuentes del mismo documento, y truncarlo por la cola
          // las dejaria identicas en pantalla (REQ-026).
          ellipsizeMode="middle">
          {isExample ? ROW.exampleLabel : source.urlOriginal}
        </Text>

        {/*
          Fecha y tamano. La fecha SIEMPRE se muestra —"Nunca actualizada" incluido,
          en vez de dejar el hueco vacio (REQ-011)—, y el tamano solo si hay mazo
          (REQ-014). Van juntas en una linea con `flexWrap` porque con el texto del
          sistema al maximo no caben en una (REQ-082).
        */}
        <View style={styles.meta}>
          {isExample ? null : (
            <Text style={styles.metaText}>{lastSyncedLabel(lastSyncedAt)}</Text>
          )}
          {size == null ? null : <Text style={styles.metaText}>{size}</Text>}
        </View>
      </View>

      {notice == null ? null : (
        <View style={styles.notice}>
          <Text
            style={[styles.noticeText, notice.isError && styles.noticeError]}
            // Para que el lector anuncie el desenlace sin tener que ir a buscarlo.
            accessibilityLiveRegion="polite">
            {notice.message}
          </Text>

          <View style={styles.noticeActions}>
            {notice.isError ? (
              <Pressable
                onPress={() => onSync(source)}
                disabled={syncBusy}
                accessibilityRole="button"
                accessibilityState={{disabled: syncBusy}}
                accessibilityLabel={`${SYNC.retry} la actualización de ${source.name}`}
                hitSlop={8}
                style={({pressed}) => pressed && styles.pressed}>
                <Text style={styles.secondaryLabel}>{SYNC.retry.toUpperCase()}</Text>
              </Pressable>
            ) : null}

            <Pressable
              onPress={onDismissSync}
              accessibilityRole="button"
              accessibilityLabel={`${SYNC.dismiss}: ${notice.message}`}
              hitSlop={8}
              style={({pressed}) => pressed && styles.pressed}>
              <Text style={styles.secondaryLabel}>{SYNC.dismiss.toUpperCase()}</Text>
            </Pressable>
          </View>
        </View>
      )}

      <View style={styles.actions}>
        <Pressable
          onPress={isActive ? undefined : () => onActivate(source.id)}
          disabled={isActive}
          accessibilityRole="button"
          accessibilityState={{selected: isActive, disabled: isActive}}
          // "Test Activo" y "Activar Test" se parecen demasiado al oirlos, asi
          // que la etiqueta dice el estado con todas las letras (REQ-055).
          accessibilityLabel={activationAccessibilityLabel(source.name, isActive)}
          style={({pressed}) => [
            styles.activate,
            isActive && styles.activateOn,
            pressed && styles.pressed,
          ]}>
          <Text style={[styles.activateLabel, isActive && styles.activateOnLabel]}>
            {(isActive ? ROW.active : ROW.activate).toUpperCase()}
          </Text>
        </Pressable>

        <View style={styles.secondary}>
          {/*
            En TODAS las filas, activa esa fuente o no (REQ-010): actualizar una
            fuente que no es la activa es un caso deseado —preparar mazos en casa
            antes de salir sin cobertura—.
          */}
          {isExample ? null : (
            <Pressable
              onPress={() => onSync(source)}
              disabled={syncBusy}
              accessibilityRole="button"
              accessibilityState={{disabled: syncBusy}}
              accessibilityLabel={`${SYNC.action} ${source.name}`}
              hitSlop={8}
              style={({pressed}) => pressed && styles.pressed}>
              <Text style={[styles.secondaryLabel, syncBusy && styles.disabledLabel]}>
                {SYNC.action.toUpperCase()}
              </Text>
            </Pressable>
          )}

          {isExample ? null : (
            <Pressable
              onPress={() => onEdit(source)}
              accessibilityRole="button"
              accessibilityLabel={`${ROW.edit} ${source.name}`}
              hitSlop={8}
              style={({pressed}) => pressed && styles.pressed}>
              <Text style={styles.secondaryLabel}>{ROW.edit.toUpperCase()}</Text>
            </Pressable>
          )}

          <Pressable
            onPress={confirmRemove}
            accessibilityRole="button"
            accessibilityLabel={`${ROW.remove} ${source.name}`}
            hitSlop={8}
            style={({pressed}) => pressed && styles.pressed}>
            <Text style={[styles.secondaryLabel, styles.removeLabel]}>
              {ROW.remove.toUpperCase()}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/**
 * El aviso de desenlace de una actualizacion, o `null` si no hay nada que decir.
 *
 * Vive en la FILA y no en la ventana de progreso porque REQ-056 manda cerrar la
 * ventana al terminar y REQ-043 manda decir cuantas imagenes se omitieron: son dos
 * cosas distintas, y en la misma capa una impide la otra (deck-sync DD-009).
 *
 * @param {import('../decks/deckSyncStore').SyncState|null} syncState
 * @returns {{message: string, isError: boolean}|null}
 */
function syncNotice(syncState) {
  if (syncState == null) {
    return null;
  }

  if (syncState.phase === 'error') {
    return {
      message: syncErrorMessage(syncState.reason, {
        status: syncState.status,
        missing: syncState.missing,
      }),
      isError: true,
    };
  }

  if (syncState.phase !== 'result') {
    return null;
  }

  const warnings = rowWarningsMessage(syncState.warnings);
  const result = syncResultMessage(syncState);

  return {
    message: warnings == null ? result : `${result} ${warnings}`,
    isError: false,
  };
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLOR.rowRule,
    gap: 14,
  },
  rowActive: {
    backgroundColor: COLOR.rowActive,
  },
  info: {
    gap: 4,
  },
  name: TYPE.rowName,
  url: TYPE.rowUrl,
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,

    // Envuelve en vez de comprimir: con el texto del sistema al maximo, las dos
    // columnas no caben en una linea (REQ-054).
    flexWrap: 'wrap',
  },
  activate: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: COLOR.buttonGhostBorder,
    borderRadius: LAYOUT.radiusControl,
  },
  activateOn: {
    borderColor: COLOR.buttonPrimary,
    backgroundColor: COLOR.buttonPrimary,
  },
  activateLabel: {
    ...TYPE.button,
    color: COLOR.inkDim,
  },
  activateOnLabel: {
    color: COLOR.buttonPrimaryInk,
  },
  secondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  secondaryLabel: {
    ...TYPE.button,
    fontSize: 11,
    letterSpacing: 2.2,
    color: COLOR.inkFooter,
  },
  removeLabel: {
    color: COLOR.danger,
  },
  disabledLabel: {
    // Se ATENUA en vez de desaparecer: un boton que se va deja al usuario buscando
    // donde estaba (REQ-013).
    opacity: 0.4,
  },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 12,
    rowGap: 2,
  },
  metaText: TYPE.rowMeta,
  notice: {
    gap: 8,
    paddingTop: 2,
  },
  noticeText: TYPE.notice,
  noticeError: {
    color: COLOR.danger,
  },
  noticeActions: {
    flexDirection: 'row',
    gap: 18,
  },
  pressed: {
    opacity: 0.7,
  },
});
