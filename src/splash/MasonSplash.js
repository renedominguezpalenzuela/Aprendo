/**
 * Capa JS del splash: dibuja la composicion final (fondo + logo + wordmark) y
 * decide cuando desaparecer.
 *
 * Se monta POR DEBAJO de la capa nativa, replicando su fondo, logo y posicion.
 * Cuando el layout esta listo y el logo cargo, bootsplash oculta la capa nativa
 * y este overlay queda a la vista: lo unico que cambia en ese instante es la
 * aparicion del texto (REQ-011).
 *
 * Ver specs/features/splash-screen/design.md seccion 2.2.
 *
 * @format
 */

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Image, Platform, StyleSheet, Text, View} from 'react-native';
import BootSplash from 'react-native-bootsplash';

import {
  HANDOFF_TIMEOUT_MS,
  LOGO_WIDTH_DP,
  SPLASH_BACKGROUND,
  WORDMARK_GAP,
  WORDMARK_STYLE,
  WORDMARK_TEXT,
} from './splashTheme';
import {initializeApp} from '../bootstrap/initializeApp';
import {useSplashGate} from './useSplashGate';

const manifest = require('../../assets/bootsplash/manifest.json');
const logoSource = require('../../assets/bootsplash/logo.png');

// Los assets nativos se generan por CLI con argumentos que deben coincidir con
// estas constantes. Si divergen, el fondo o el tamano del logo cambian en el
// traspaso de la capa nativa a la JS (REQ-011) y nada mas lo detecta.
if (__DEV__) {
  if (manifest.background.toLowerCase() !== SPLASH_BACKGROUND.toLowerCase()) {
    console.warn(
      `[splash] El fondo generado (${manifest.background}) no coincide con ` +
        `SPLASH_BACKGROUND (${SPLASH_BACKGROUND}). Habra un cambio de color ` +
        `perceptible al pasar de la capa nativa a la JS. Regenera los assets ` +
        `con --background=${SPLASH_BACKGROUND.replace('#', '')}.`,
    );
  }

  if (manifest.logo.width !== LOGO_WIDTH_DP) {
    console.warn(
      `[splash] El ancho del logo generado (${manifest.logo.width}) no coincide ` +
        `con LOGO_WIDTH_DP (${LOGO_WIDTH_DP}). El logo cambiara de tamano en el ` +
        `traspaso. Regenera los assets con --logo-width=${LOGO_WIDTH_DP}.`,
    );
  }
}

/**
 * Splash de la app.
 *
 * En iOS dibuja la composicion completa (logo + wordmark). En Android NO dibuja
 * nada: alla el splash es unicamente la capa nativa, con el logo solo.
 *
 * El motivo es medido, no estetico. La splash que impone Android 12+ recorta su
 * icono con una mascara CIRCULAR de 186 dp (verificado en un Pixel_9a con
 * Android 15). El wordmark "MASON INSTRUCCION" son 17 caracteres: para que
 * entrara junto al logo en ese circulo habria que bajarlo a 10 dp, ilegible, y a
 * 14 dp ya no queda lugar para ningun logo. Mostrar el texto solo en la capa JS
 * significaba que apareciera despues que el logo, que es justo lo que se quiso
 * evitar. Entre un texto ilegible y un texto que aparece tarde, en Android se
 * opta por no mostrarlo.
 *
 * Esto rompe a proposito la paridad iOS/Android de REQ-006.
 *
 * @param {{onFinish: () => void}} props
 * @returns {React.ReactElement | null}
 */
export function MasonSplash({onFinish}) {
  if (Platform.OS === 'android') {
    return <AndroidNativeSplash onFinish={onFinish} />;
  }

  return <SplashOverlay onFinish={onFinish} />;
}

/**
 * Android: no hay overlay JS. Solo hay que ocultar la capa nativa cuando la app
 * este lista, porque si nadie llama a hide() el splash nativo se queda para
 * siempre.
 *
 * No se aplica el minimo visible: ese minimo existe para que el wordmark alcance
 * a leerse (DD-003), y aca no hay wordmark. La capa nativa ya estuvo visible
 * desde el primer frame.
 *
 * @param {{onFinish: () => void}} props
 * @returns {null}
 */
function AndroidNativeSplash({onFinish}) {
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  useEffect(() => {
    let cancelled = false;

    initializeApp()
      .catch(error => {
        console.error('[splash] initializeApp fallo, se continua igual', error);
      })
      .then(() => BootSplash.hide({fade: false}))
      .catch(error => {
        console.error('[splash] hide() fallo en Android', error);
      })
      .then(() => {
        if (!cancelled) {
          onFinishRef.current();
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}

/**
 * iOS: composicion completa, logo + wordmark, sobre la capa nativa.
 *
 * @param {{onFinish: () => void}} props
 * @returns {React.ReactElement}
 */
function SplashOverlay({onFinish}) {
  const [handoffAt, setHandoffAt] = useState(null);
  const finished = useRef(false);

  const shouldHide = useSplashGate(handoffAt);

  // onFinish se guarda en una ref para que `finish` tenga identidad estable. Si
  // `finish` dependiera de la prop, un padre que pase una funcion nueva en cada
  // render reiniciaria el timeout de respaldo una y otra vez, y nunca llegaria a
  // dispararse.
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  /** Desmonta el splash. Idempotente: solo el primer llamado tiene efecto. */
  const finish = useCallback(() => {
    if (finished.current) {
      return;
    }
    finished.current = true;
    onFinishRef.current();
  }, []);

  // No se le pasa `ready` al hook a proposito. Mirando su implementacion, ese
  // flag no retrasa solo la animacion: retrasa el hide() de la capa nativa. Si
  // lo usaramos como puerta de "app lista", la capa nativa taparia este overlay
  // durante toda la espera y el texto se veria durante ~0 ms, incumpliendo
  // REQ-005. Ver design.md DD-004.
  const {container, logo} = BootSplash.useHideAnimation({
    manifest,
    logo: logoSource,

    // Con targetSdkVersion 35 Android fuerza edge-to-edge. Declararlo evita que
    // el hook aplique un margen negativo que desalinearia esta capa respecto de
    // la nativa (DD-007).
    statusBarTranslucent: true,
    navigationBarTranslucent: true,

    animate: () => setHandoffAt(Date.now()),
  });

  useEffect(() => {
    if (shouldHide) {
      finish();
    }
  }, [shouldHide, finish]);

  // Respaldo: si el traspaso nunca ocurre (modulo nativo caido, logo que no
  // carga), el overlay quedaria montado para siempre. Ver design.md seccion 2.2.
  useEffect(() => {
    if (handoffAt != null) {
      return undefined;
    }

    const timeout = setTimeout(() => {
      console.warn(
        '[splash] El traspaso de la capa nativa no ocurrio en ' +
          `${HANDOFF_TIMEOUT_MS} ms; se fuerza el ocultamiento.`,
      );
      // Se registra el fallo en vez de tragarlo: esta es la ruta que ya sabemos
      // anomala, y si ademas hide() falla el usuario se queda mirando un splash
      // colgado. Es justo el momento en que hace falta la senal.
      BootSplash.hide({fade: false}).catch(error => {
        console.error('[splash] hide() fallo en la ruta de respaldo', error);
      });
      finish();
    }, HANDOFF_TIMEOUT_MS);

    return () => clearTimeout(timeout);
  }, [handoffAt, finish]);

  return (
    <View
      {...container}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <Image {...logo} />

      {/*
        El texto va en absoluto a proposito. El contenedor que entrega el hook
        centra con flexbox: si el <Text> fuera un hijo en flujo, el logo se
        desplazaria hacia arriba para hacerle sitio y habria un salto visible
        justo en el traspaso, rompiendo REQ-011.
      */}
      {/*
        allowFontScaling en false y una sola linea: es un lockup de marca, no
        contenido. Con un tamano de fuente de accesibilidad grande el texto
        desbordaria o se partiria en dos lineas, rompiendo la composicion que
        exige REQ-008.
      */}
      <Text allowFontScaling={false} numberOfLines={1} style={styles.wordmark}>
        {WORDMARK_TEXT}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wordmark: {
    ...WORDMARK_STYLE,
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    textAlign: 'center',

    // El desplazamiento va por marginTop y NO por transform/translateY: probado
    // en simulador, el translateY no se aplicaba y el texto quedaba pegado al
    // 50%, encima del logo.
    //
    // Se usa LOGO_WIDTH_DP en vez de medir el alto real que devuelve el hook: es
    // determinista, no depende de las internals de la libreria, y si el asset
    // generado dejara de coincidir con la constante el aviso de __DEV__ de mas
    // arriba lo detecta.
    marginTop: LOGO_WIDTH_DP / 2 + WORDMARK_GAP,
  },
});
