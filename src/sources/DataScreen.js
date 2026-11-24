/**
 * Pantalla Datos: formulario arriba, lista de fuentes debajo, misma pantalla.
 *
 * El formulario esta oculto tras el boton Anadir mientras haya fuentes, y
 * desplegado mientras no haya ninguna.
 *
 * Ver specs/features/data-sources/design.md seccion 2.8, DD-010 y la ampliacion
 * del delta formulario-plegable (DD-015 a DD-019).
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
import {AddSourceButton, SourceForm} from './SourceForm';
import {SourceRow} from './SourceRow';
import {useSources} from './useSources';

/**
 * Modo del formulario. Un solo estado con tres valores, y no un `isOpen` mas un
 * `editingId`: con dos variables existe "cerrado pero editando la 3", que no
 * significa nada y que cada transicion tendria que acordarse de limpiar (DD-015).
 *
 * @typedef {{kind: 'closed'} | {kind: 'add'} | {kind: 'edit', id: number}} FormMode
 */

/** @type {FormMode} */
const CLOSED = {kind: 'closed'};

/** @type {FormMode} */
const ADD = {kind: 'add'};

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

  // En edicion se guarda el ID y no el objeto: el store publica fuentes nuevas
  // en cada refresco, y quedarse con una vieja mostraria datos rancios.
  const [formMode, setFormMode] = useState(CLOSED);

  const sources = state.status === 'ready' ? state.sources : [];

  // Sin fuentes, lo unico que se puede hacer es anadir una: el formulario sale
  // desplegado. Se DERIVA en cada render y no se escribe en `formMode` con un
  // efecto, que pintaria primero un frame con la pantalla vacia y el boton. Y al
  // anadir la primera, `formMode` sigue en `closed`, asi que se oculta solo
  // (DD-016).
  const isEmpty = sources.length === 0;
  const mode = isEmpty ? ADD : formMode;

  const editingId = mode.kind === 'edit' ? mode.id : null;
  const editing =
    editingId == null
      ? null
      : sources.find(source => source.id === editingId) ?? null;

  const close = useCallback(() => setFormMode(CLOSED), []);

  const handleSubmit = useCallback(
    input => {
      const result = editingId == null ? add(input) : update(editingId, input);

      // Se oculta si fue bien (REQ-016). En edicion, tambien si la fila ya no
      // existe: seguir editando una fuente borrada no lleva a ninguna parte. Con
      // cualquier otro error se queda abierto, con lo escrito y el mensaje.
      if (
        result.ok !== false ||
        (editingId != null && result.reason === 'NOT_FOUND')
      ) {
        setFormMode(CLOSED);
      }

      return result;
    },
    [add, editingId, update],
  );

  const handleRemove = useCallback(
    id => {
      // Si se borra la que se estaba editando, el formulario se cierra o se
      // quedaria editando una fila que ya no existe.
      if (id === editingId) {
        setFormMode(CLOSED);
      }
      remove(id);
    },
    [editingId, remove],
  );

  const handleEdit = useCallback(
    source => setFormMode({kind: 'edit', id: source.id}),
    [],
  );

  const renderItem = useCallback(
    ({item}) => (
      <SourceRow
        source={item}
        onActivate={activate}
        onEdit={handleEdit}
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
    [activate, handleEdit, handleRemove, summaries, sync.dismiss, sync.start, sync.state, syncBusy],
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
          mode.kind === 'add' || editing != null ? (
            <SourceForm
              initial={editing}
              onSubmit={handleSubmit}
              // Sin fuentes no hay Cancelar: ocultarlo solo dejaria una
              // pantalla vacia con un boton para volver a abrirlo (DELTA-004).
              onCancel={isEmpty ? undefined : close}
              // Solo si lo abrio el usuario. Al entrar sin fuentes, abrir el
              // teclado sin que nadie lo pida tapa el texto de lista vacia
              // (DD-018).
              autoFocus={!isEmpty}
            />
          ) : (
            <AddSourceButton onPress={() => setFormMode(ADD)} />
          )
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
