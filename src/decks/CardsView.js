/**
 * La zona central cuando hay mazo: la tarjeta y su barra de navegacion.
 *
 * Es la duena de tres cosas y de nada mas: en que tarjeta estamos, que cara se ve, y
 * si hay una transicion en curso. Las caras las pinta `QuestionCard` —una sola, ver
 * DD-017— y la barra `DeckNavBar`.
 *
 * Ver specs/features/main-view/design.md seccion 2.10, DD-017, DD-018, DD-019 y
 * DD-020.
 *
 * @format
 */

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Animated, Easing, StyleSheet, View} from 'react-native';

import {DeckNavBar} from './DeckNavBar';
import {QuestionCard} from './QuestionCard';
import {readCardImage} from './useCardImage';

/**
 * Duracion de CADA TRAMO del giro. El giro completo son dos, asi que 400 ms.
 *
 * El spike de T-101 lo midio en dispositivo con estos numeros.
 */
const TURN_MS = 200;

/** Duracion de cada tramo del deslizamiento entre tarjetas. */
const SLIDE_MS = 160;

/**
 * Cuanto se desplaza la tarjeta al salir y al entrar, en dp.
 *
 * Un desplazamiento corto con desvanecido, no un barrido de pantalla completa: la
 * tarjeta esta dentro de una columna de 430 dp y sacarla del todo dejaria la zona
 * central vacia a mitad de la transicion.
 */
const SLIDE_DP = 44;

/**
 * @param {Object} props
 * @param {{source: import('../sources/sourcesRepo').Source, questions: import('./decksRepo').Question[]}} props.deck
 * @returns {React.ReactElement|null}
 */
export function CardsView({deck}) {
  const {source, questions} = deck;
  const total = questions.length;

  const [position, setPosition] = useState(0);
  const [face, setFace] = useState('question');
  const [isBusy, setIsBusy] = useState(false);

  /** Grados de giro de la tarjeta. */
  const turn = useRef(new Animated.Value(0)).current;
  /** Desplazamiento horizontal, en dp. */
  const slide = useRef(new Animated.Value(0)).current;

  /**
   * Identidad del mazo, y NO el array (DD-018).
   *
   * `useDeck()` publica un array nuevo en cada refresco, asi que comparar por
   * referencia reiniciaria la vista cada vez que se repinta la lista de `Datos`.
   */
  const identity = `${source.id}:${total}`;

  useEffect(() => {
    // Al cambiar el mazo o la fuente activa, vuelta a la primera y por el anverso
    // (DELTA-001): tras actualizar, "la 7" puede ser otra pregunta, asi que conservar
    // el numero conservaria el numero y perderia el contenido.
    setPosition(0);
    setFace('question');
    setIsBusy(false);
    turn.setValue(0);
    slide.setValue(0);
  }, [identity, slide, turn]);

  // Precarga de la SIGUIENTE, y solo esa (DD-020). Va en un efecto para que ocurra
  // despues de pintar: la tarjeta actual no debe esperar por la vecina.
  useEffect(() => {
    if (total < 2) {
      return;
    }

    const next = questions[(position + 1) % total];

    readCardImage(next?.imageQuestionId);
  }, [position, questions, total]);

  /**
   * El giro, en DOS TRAMOS (DD-017, verificado en el spike de T-101).
   *
   * A 180 grados el texto sale ESPEJADO, asi que en vez de girar de una se va a 90,
   * se intercambia la cara —de canto no se ve nada— y se entra desde -90. La tarjeta
   * siempre reposa a 0.
   */
  const flip = useCallback(() => {
    // ESTE cerrojo SI hace falta, al contrario que el de `go`, y la diferencia esta
    // comprobada: la tarjeta NO se deshabilita mientras gira —seguir pudiendo tocarla
    // es parte de que se sienta viva— asi que un segundo toque llegaria aqui. Sin la
    // guarda, ese toque arranca un tramo nuevo sobre el mismo valor, el tramo en vuelo
    // se cancela y su callback pone `isBusy` a false A MITAD del giro, reactivando los
    // botones de la barra. Hay un test que cuenta las animaciones arrancadas.
    if (isBusy) {
      return;
    }

    setIsBusy(true);

    Animated.timing(turn, {
      toValue: 90,
      duration: TURN_MS,
      easing: Easing.in(Easing.ease),
      useNativeDriver: true,
    }).start(({finished}) => {
      if (!finished) {
        setIsBusy(false);
        return;
      }

      turn.setValue(-90);
      setFace(current => (current === 'question' ? 'answer' : 'question'));

      Animated.timing(turn, {
        toValue: 0,
        duration: TURN_MS,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start(() => setIsBusy(false));
    });
  }, [isBusy, turn]);

  /**
   * Cambiar de tarjeta.
   *
   * @param {1|-1} delta
   */
  const go = useCallback(
    delta => {
      // AQUI NO HAY CERROJO, y es deliberado.
      //
      // Lo hubo, y al comprobarlo retirandolo —como exige DD-019— resulto inalcanzable:
      // `DeckNavBar` deshabilita sus botones con el MISMO `isBusy`, asi que la segunda
      // pulsacion no llega a esta funcion. Un `if` que nunca se cumple hace creer al
      // siguiente que lee el archivo que el problema esta resuelto aqui, cuando lo
      // resuelve el boton. Es la leccion de
      // docs/solutions/2026-08-16-el-cerrojo-que-no-protegia-nada.md, y esta vez el
      // diseno obligo a mirarla antes de commitear.
      //
      // Lo que SI garantiza REQ-022, y esta probado: los botones desactivados durante
      // la transicion, y la cancelacion de `Animated` —arrancar una animacion sobre el
      // mismo valor interrumpe la anterior, cuyo callback llega con `finished: false` y
      // no toca la posicion—.
      if (total === 0) {
        return;
      }

      // Un mazo de una sola tarjeta no se mueve, y sobre todo no PARPADEA (DELTA-004).
      if (total === 1) {
        return;
      }

      setIsBusy(true);

      Animated.timing(slide, {
        toValue: -delta * SLIDE_DP,
        duration: SLIDE_MS,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }).start(({finished}) => {
        if (!finished) {
          setIsBusy(false);
          return;
        }

        // Circular en los dos extremos (REQ-021). El `+ total` es para que el modulo
        // de un negativo no devuelva negativo.
        setPosition(current => (current + delta + total) % total);

        // SIEMPRE por el anverso, aunque la anterior estuviera girada (REQ-020).
        setFace('question');
        turn.setValue(0);

        // Entra por el lado contrario al que salio.
        slide.setValue(delta * SLIDE_DP);

        Animated.timing(slide, {
          toValue: 0,
          duration: SLIDE_MS,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }).start(() => setIsBusy(false));
      });
    },
    // `isBusy` YA NO esta aca: se fue con la guarda inalcanzable, y el lint lo cazo.
    [slide, total, turn],
  );

  const onNext = useCallback(() => go(1), [go]);
  const onPrevious = useCallback(() => go(-1), [go]);

  const question = questions[position];

  if (question == null) {
    // El mazo se quedo corto entre dos renders. Se avisa en desarrollo y no se pinta
    // nada, en vez de reventar por un indice fuera de rango.
    if (__DEV__) {
      console.warn(`[main-view] no hay tarjeta en la posicion ${position} de ${total}`);
    }

    return null;
  }

  const rotate = turn.interpolate({
    inputRange: [-90, 0, 90],
    outputRange: ['-90deg', '0deg', '90deg'],
  });

  return (
    <View style={styles.root}>
      <Animated.View
        style={[
          styles.card,
          {
            transform: [
              {perspective: 900},
              {rotateY: rotate},
              {translateX: slide},
            ],
          },
        ]}>
        <QuestionCard
          position={position + 1}
          face={face}
          question={question}
          onTurn={flip}
        />
      </Animated.View>

      <DeckNavBar
        position={position + 1}
        total={total}
        onPrevious={onPrevious}
        onNext={onNext}
        disabled={isBusy}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 18,
  },
  card: {
    flex: 1,
  },
});
