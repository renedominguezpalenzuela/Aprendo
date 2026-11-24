/**
 * Pantalla Datos: formulario arriba, lista de fuentes debajo, misma pantalla.
 *
 * Ver specs/features/data-sources/design.md seccion 2.8 y DD-010.
 *
 * @format
 */

import React, {useCallback, useState} from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {useDeckSummaries} from '../decks/useDeck';
import {useDeckSync, useIsSyncing} from '../decks/useDeckSync';
import {COLOR, TYPE} from '../theme/masonTheme';
import {DATABASE_ERROR, EMPTY_LIST} from './sourcesCopy';
import {SourceForm} from './SourceForm';
import {SourceRow} from './SourceRow';
import {useSources} from './useSources';

/**
 * @returns {React.ReactElement}
 */
export function DataScreen() {
  const {state, add, update, remove, activate} = useSources();

  // La pantalla es quien conecta las filas con la actualizacion: `SourceRow` es
  // presentacional y recibe lo suyo por props (deck-sync design.md seccion 2.15).
  const summaries = useDeckSummaries();
  const sync = useDeckSync();
  const syncBusy = useIsSyncing();

  // Fuente en edicion. Se guarda el ID y no el objeto: el store publica fuentes
  // nuevas en cada refresco, y quedarse con una vieja mostraria datos rancios.
  const [editingId, setEditingId] = useState(null);

  const sources = state.status === 'ready' ? state.sources : [];
  const editing = sources.find(source => source.id === editingId) ?? null;

  const handleSubmit = useCallback(
    input => {
      if (editingId == null) {
        return add(input);
      }

      const result = update(editingId, input);

      // Se sale del modo edicion tanto si fue bien como si la fila ya no
      // existe: seguir editando una fuente borrada no lleva a ninguna parte.
      if (result.ok !== false || result.reason === 'NOT_FOUND') {
        setEditingId(null);
      }

      return result;
    },
    [add, editingId, update],
  );

  const handleRemove = useCallback(
    id => {
      // Si se borra la que se estaba editando, el formulario tiene que volver a
      // modo alta o se quedaria editando una fila que ya no existe.
      if (id === editingId) {
        setEditingId(null);
      }
      remove(id);
    },
    [editingId, remove],
  );

  const renderItem = useCallback(
    ({item}) => (
      <SourceRow
        source={item}
        onActivate={activate}
        onEdit={source => setEditingId(source.id)}
        onRemove={handleRemove}
        onSync={sync.start}
        onDismissSync={sync.dismiss}
        summary={summaries[item.id] ?? null}
        // Solo el de ESTA fila: si se pasara el estado entero, el aviso de una
        // actualizacion aparecería repetido en todas las filas de la lista.
        syncState={sync.state.sourceId === item.id ? sync.state : null}
        syncBusy={syncBusy}
      />
    ),
    [activate, handleRemove, summaries, sync.dismiss, sync.start, sync.state, syncBusy],
  );

  if (state.status === 'error') {
    // Sin base no hay nada que listar ni donde guardar, asi que tampoco se
    // pinta el formulario: seria un formulario que no puede funcionar (REQ-005).
    return (
      <View style={styles.notice}>
        <View style={styles.rule} />
        <Text style={styles.noticeTitle}>{DATABASE_ERROR.title}</Text>
        <Text style={styles.noticeBody}>{DATABASE_ERROR.body}</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      // En Android, `adjustResize` del manifiesto ya redimensiona la ventana;
      // anadir padding encima desplazaria el contenido el doble.
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FlatList
        data={sources}
        keyExtractor={source => String(source.id)}
        renderItem={renderItem}
        // El formulario va como CABECERA de la lista y no fijo encima (DD-010):
        // asi hay un unico contenedor desplazable —una lista virtualizada dentro
        // de un ScrollView se comporta mal y React Native avisa— y el formulario
        // deja de robar altura en cuanto estorba, que es justo donde REQ-019
        // aprieta.
        ListHeaderComponent={
          <SourceForm
            initial={editing}
            onSubmit={handleSubmit}
            onCancel={editing ? () => setEditingId(null) : undefined}
          />
        }
        ListEmptyComponent={
          <View style={styles.notice}>
            <View style={styles.rule} />
            <Text style={styles.noticeTitle}>{EMPTY_LIST.title}</Text>
            <Text style={styles.noticeBody}>{EMPTY_LIST.body}</Text>
          </View>
        }
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingBottom: 30,
  },
  notice: {
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 30,
    gap: 12,
  },
  rule: {
    width: 34,
    height: 1,
    backgroundColor: COLOR.goldDim,
  },
  noticeTitle: TYPE.emptyTitle,
  noticeBody: TYPE.notice,
});
