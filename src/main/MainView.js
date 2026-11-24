/**
 * Vista principal de Mason. Es la pantalla que se ve al terminar el splash.
 *
 * Ver specs/features/main-view/design.md seccion 2.2.
 *
 * @format
 */

import React, {useCallback} from 'react';
import {StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {COLOR, LAYOUT} from '../theme/masonTheme';
import {CardsView} from '../decks/CardsView';
import {emptyDeckState} from '../decks/decksCopy';
import {SyncProgressModal} from '../decks/SyncProgressModal';
import {useDeck} from '../decks/useDeck';
import {useDeckSync} from '../decks/useDeckSync';
import {useViewRouter} from '../nav/useViewRouter';
import {DataScreen} from '../sources/DataScreen';
import {DATA_VIEW_TITLE} from '../sources/sourcesCopy';
import {useActiveSource} from '../sources/useSources';
import {AppHeader} from './AppHeader';
import {EmptyState} from './EmptyState';
import {Scrim} from './Scrim';
import {SideMenu} from './SideMenu';
import {useSideMenu} from './useSideMenu';
import {DATABASE_ERROR} from '../sources/sourcesCopy';
import {EMPTY_STATE, VIEW_TITLE} from './masonCopy';

/**
 * @returns {React.ReactElement}
 */
export function MainView() {
  const insets = useSafeAreaInsets();
  const menu = useSideMenu();
  const deck = useDeck();
  const activeSource = useActiveSource();
  const sync = useDeckSync();

  const isSyncing =
    sync.state.phase === 'preparing' || sync.state.phase === 'working';

  // El router recibe el estado del menu porque el atras de Android lo repliega
  // ANTES de cambiar de vista (DD-002), y el de la actualizacion porque durante
  // una descarga el atras no hace nada (deck-sync REQ-057, DD-008). Los tres
  // competidores por ese boton, en un solo sitio.
  const {activeView, navigate} = useViewRouter({
    isMenuOpen: menu.isOpen,
    closeMenu: menu.close,
    isSyncing,
  });

  const goToData = useCallback(() => navigate('data'), [navigate]);

  const handleSelect = useCallback(
    key => {
      navigate(key);
      menu.close();
    },
    [menu, navigate],
  );

  return (
    <View style={styles.root}>
      {/*
        La columna se limita al ancho de referencia del diseno y se centra, en
        vez de estirarse en pantallas anchas (REQ-026).
      */}
      <View style={styles.column}>
        <AppHeader
          title={headerTitle(activeView, activeSource)}
          onOpenMenu={menu.open}
          topInset={insets.top}
        />

        <View style={[styles.center, {paddingBottom: insets.bottom}]}>
          {activeView === 'data' ? (
            <DataScreen />
          ) : (
            <CentralZone deck={deck} onAddSource={goToData} />
          )}
        </View>
      </View>

      {/*
        El velo y el cajon van FUERA de la columna, a proposito.

        En una tablet la columna mide 430 dp y el resto de la pantalla es fondo.
        Si el velo viviera dentro, quedaria un marco lateral sin oscurecer por el
        que ademas pasarian los toques al contenido (REQ-005).
      */}
      <Scrim progress={menu.progress} isOpen={menu.isOpen} onPress={menu.close} />
      {/*
        La ventana de progreso, hermana del velo y del cajon y FUERA de la columna,
        por lo mismo que ellos: en una tablet la columna mide 430 dp y el resto es
        fondo, asi que dentro dejaria un marco lateral por el que pasarian los
        toques (REQ-055). No es `Modal` de RN: eso seria un segundo dueno del atras
        (deck-sync DD-009).
      */}
      <SideMenu
        progress={menu.progress}
        isOpen={menu.isOpen}
        onClose={menu.close}
        insets={insets}
        activeView={activeView}
        onSelect={handleSelect}
        // Cumple por fin REQ-006 de main-view, que lo especificaba y quedaba
        // omitido por no haber mazo (deck-sync REQ-073).
        deckCount={deck.status === 'ready' ? deck.questions.length : undefined}
        // El de TARJETAS a proposito, no el de la vista activa: el cajon
        // identifica el mazo con el que se trabaja, no donde estas.
        title={headerTitle('cards', activeSource)}
      />

      <SyncProgressModal state={sync.state} onCancel={sync.cancel} />
    </View>
  );
}

/**
 * Mapea el estado del mazo a lo que ocupa la zona central.
 *
 * Hoy solo hay una rama. Las de carga, error y mazo cargado llegan con los
 * requisitos diferidos (requirements.md seccion 3.2) y entran aca.
 *
 * @param {Object} props\n * @param {import('../decks/useDeck').DeckState} props.deck\n * @param {() => void} props.onAddSource
 * @returns {React.ReactElement | null}
 */
function CentralZone({deck, onAddSource}) {
  if (deck.status === 'unconfigured') {
    // La accion lleva a Datos. Es el primer arranque de todo usuario nuevo: el
    // momento en que mas ayuda un camino directo (REQ-043, DD-011).
    return <EmptyState action={{label: EMPTY_STATE.action, onPress: onAddSource}} />;
  }

  // Hay fuente activa y todavia no tiene preguntas. Texto PROPIO, distinto del de
  // "no hay ninguna fuente": ahi falta registrar una hoja y aca falta descargarla,
  // y decir lo mismo en los dos casos dejaria al usuario buscando un problema que
  // no tiene (REQ-071).
  if (deck.status === 'empty') {
    const copy = emptyDeckState(deck.source.name);

    return (
      <EmptyState
        title={copy.title}
        body={copy.body}
        // El rotulo sale de ESTE estado y no de EMPTY_STATE: alli dice "Añadir una
        // fuente", que a quien ya tiene una le dice que repita el paso que dio.
        action={{label: copy.action, onPress: onAddSource}}
      />
    );
  }

  if (deck.status === 'error') {
    // La base dejo de estar sana. Se dice, en vez de dejar la zona en blanco
    // (REQ-063).
    return <EmptyState title={DATABASE_ERROR.title} body={DATABASE_ERROR.body} />;
  }

  // Y con mazo cargado, LAS TARJETAS. Aca estaba el cartel que decia "N preguntas
  // listas, la vista de tarjetas llega en la siguiente entrega": era un marcador
  // honesto para una entrega que no podia mostrar el mazo, y esta lo muestra.
  if (deck.status === 'ready') {
    return <CardsView deck={deck} />;
  }

  // Se avisa en vez de lanzar: una pantalla en blanco es mala, pero una app que
  // revienta por un estado no contemplado es peor.
  if (__DEV__) {
    console.warn(
      `[main-view] Estado de mazo no contemplado: "${deck.status}". ` +
        'La zona central queda vacia.',
    );
  }

  return null;
}

/**
 * Titulo del header segun la vista activa.
 *
 * Cada vista titula con SU nombre (DD-003): `Datos` dice `Datos`, y la vista de
 * tarjetas dice el nombre de la fuente activa. Si el titulo no cambiara al
 * navegar, el usuario perderia la unica senal de donde esta ademas del menu.
 *
 * @param {string} activeView
 * @param {import('../sources/sourcesRepo').Source | null} activeSource
 * @returns {string}
 */
function headerTitle(activeView, activeSource) {
  if (activeView === 'data') {
    return DATA_VIEW_TITLE;
  }

  // Sin fuente activa se conserva el titulo por defecto de la vista, en vez de
  // dejar un hueco o poner un texto de relleno (REQ-041).
  return activeSource?.name ?? VIEW_TITLE;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,

    // El fondo llega de borde a borde, por debajo de las barras del sistema: los
    // insets se aplican al CONTENIDO, no al fondo (REQ-032).
    backgroundColor: COLOR.background,
  },
  column: {
    flex: 1,
    width: '100%',
    maxWidth: LAYOUT.maxWidth,
    alignSelf: 'center',
  },
  center: {
    flex: 1,
  },
});
