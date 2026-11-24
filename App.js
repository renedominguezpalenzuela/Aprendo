/**
 * Raiz de la app.
 *
 * @format
 */

import React, {useCallback, useState} from 'react';
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from 'react-native-safe-area-context';
import {StatusBar, StyleSheet, View} from 'react-native';

import {MasonSplash} from './src/splash/MasonSplash';
import {MainView} from './src/main/MainView';
import {initDecks} from './src/decks/deckStore';
import {sweepPendingDecks} from './src/decks/decksRepo';
import {initSources} from './src/sources/sourcesStore';

// A NIVEL DE MODULO, no en un efecto: tiene que estar hecho ANTES del primer
// render para que el header muestre el nombre de la fuente activa desde el
// primer frame, en vez de pintar el titulo por defecto y sustituirlo despues
// (REQ-006). Puede hacerse asi porque abrir la base y leer una fila son
// operaciones SINCRONAS con op-sqlite. Ver design.md DD-004.
//
// No lanza nunca: si la base no abre, el store queda en estado de error y la
// pantalla Datos lo pinta (REQ-005).
initSources();

// Lo que quedo a medias de una actualizacion que el sistema mato, y el primer mazo.
//
// El BARRIDO es lo que hace que REQ-085 no necesite decidir si una actualizacion se
// pausa o se reanuda al ir a segundo plano (deck-sync DD-013): si la app muere a
// mitad, las filas pendientes son invisibles para las lecturas y desaparecen aca.
//
// En su propio try: un fallo del barrido NO puede tumbar el arranque. Las filas
// pendientes no las ve nadie, asi que la app funciona igual y se reintenta en el
// arranque siguiente.
try {
  sweepPendingDecks();
} catch (error) {
  if (__DEV__) {
    console.warn('[deck-sync] no se pudo barrer lo pendiente al arrancar:', error);
  }
}

// DESPUES de initSources: necesita la base abierta y la fuente activa ya leida.
// Tambien sincrono y por el mismo motivo que aquel (DD-004 de data-sources): el pie
// del menu y la zona central tienen que salir bien en el primer frame.
initDecks();

function App() {
  const [splashVisible, setSplashVisible] = useState(true);

  const handleSplashFinish = useCallback(() => setSplashVisible(false), []);

  // Dos pantallas con fondos opuestos, asi que dos estilos de barra distintos:
  //
  //   - Splash: fondo hueso claro (REQ-007 de splash-screen) => iconos oscuros.
  //   - Vista principal: fondo oscuro SIEMPRE, con independencia del tema del
  //     sistema (REQ-027) => iconos claros SIEMPRE (REQ-033).
  //
  // Antes esta segunda rama salia de useColorScheme(). Con la vista principal
  // oscura eso pintaba iconos oscuros sobre #131A22 en modo claro: exactamente
  // el fallo que documenta DD-012 de splash-screen, con los colores invertidos.
  // Ver specs/features/main-view/design.md DD-004.
  //
  // La barra de NAVEGACION de Android no la controla este componente: va por el
  // tema, en android/app/src/main/res/values/styles.xml.
  const barStyle = splashVisible ? 'dark-content' : 'light-content';

  return (
    // El provider envuelve el arbol completo, splash incluido, y no solo
    // MainView: mide la ventana una vez para toda la app. Ponerlo mas adentro
    // funcionaria hoy y volveria a fallar en la proxima pantalla que se anada.
    // Ver design.md DD-003.
    //
    // initialMetrics NO es opcional aca. Mirando la implementacion del provider,
    // sus hijos son literalmente `insets != null ? children : null`: sin metricas
    // iniciales espera al primer onLayout, y hasta entonces NO RENDERIZA NADA,
    // ni MainView ni el splash. Eso es un frame vacio, justo lo que prohibe
    // REQ-009 de splash-screen y lo que DD-008 se propuso evitar montando el
    // contenido por debajo. `initialWindowMetrics` sale de constantes nativas y
    // esta disponible de forma sincrona en el arranque. Ver design.md DD-015.
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <View style={styles.container}>
        <StatusBar barStyle={barStyle} />

        {/*
          El contenido se monta SIEMPRE, con el splash superpuesto. Montarlo
          recien al terminar el splash dejaria un frame vacio mientras React
          renderiza el primer arbol, que es justo lo que prohibe REQ-009.
          Ver specs/features/splash-screen/design.md DD-008.
        */}
        <MainView />

        {splashVisible && <MasonSplash onFinish={handleSplashFinish} />}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default App;
