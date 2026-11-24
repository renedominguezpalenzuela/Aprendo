/**
 * UNA cara de la tarjeta. No las dos.
 *
 * Ese "una" es la decision de diseno mas importante de la vista (DD-017): el giro se
 * hace en DOS TRAMOS —0 a 90 grados, intercambio, -90 a 0— y quien intercambia el
 * contenido es `CardsView`. Aca no hay transformaciones ni caras apiladas.
 *
 * Dos caras apiladas con `backfaceVisibility` habrian sido lo obvio, y en Android eso
 * se finge con OPACIDAD: la cara "oculta" seguiria recibiendo toques y podria tragarse
 * el que debia girar la tarjeta. El spike de T-101 ademas encontro que a 180 grados el
 * texto sale ESPEJADO. Ver design.md DD-017.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * LO QUE MAS FACILMENTE SE DESHACE DE ESTE ARCHIVO: la raiz NO es accionable, y no debe
 * volver a serlo (DD-030).
 *
 * Quien lea esto pensando «la tarjeta no responde al toque» va a querer devolverle el
 * `onPress`. Eso ES el defecto: mientras la raiz sea accionable, su rectangulo de pulsacion
 * es la tarjeta ENTERA, y un arrastre que se queda dentro cuenta como pulsacion al levantar
 * el dedo, asi que el `ScrollView` nunca ve el arrastre. Se midio en emulador: arrastrar
 * sobre el texto GIRABA la tarjeta, y la unica forma de leer el texto recortado era arrastrar
 * SALIENDO de la tarjeta por arriba, que no lo descubre nadie.
 *
 * El toque vive en el pie, y ahi se queda. Hay tres aserciones en `QuestionCard.test.js`
 * sujetandolo.
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * Ver specs/features/main-view/design.md seccion 2.11.
 *
 * @format
 */

import React from 'react';
import {Image, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';

import {cardTextStep, COLOR, ELEVATION, LAYOUT, TYPE} from '../theme/masonTheme';
import {
  CARD,
  CARD_TURN_HINT,
  cardAccessibilityLabel,
  cardNumberLabel,
} from './decksCopy';
import {useCardImage} from './useCardImage';

/**
 * La accion que el lector de pantalla puede invocar sobre la cara.
 *
 * Fuera del componente porque es constante: recrearla en cada render le cambiaria la
 * identidad a la prop sin cambiarle el valor.
 */
const TURN_ACTIONS = [{name: 'activate'}];

/**
 * Cuanto crece el area de toque del boton MAS ALLA de su canto visible.
 *
 * SOLO hacia abajo, y esa direccion es la mitad de la decision (DD-032). Hacia arriba esta el
 * `ScrollView`, y un `hitSlop` que lo invadiera se quedaria con los arrastres que empiezan
 * cerca del borde inferior del cuerpo: el mismo defecto que este delta arregla, en miniatura
 * y mas dificil de encontrar. Hacia abajo esta el `paddingVertical` de la tarjeta, que es
 * espacio inerte.
 *
 * OJO: los otros tres `hitSlop` de la app son ESCALARES (`8`, `10`). Este es un objeto a
 * proposito, y es el unico que tiene un vecino al que le importa. Normalizarlo a `12` por
 * parecerse a los demas reintroduce el fallo.
 */
const TURN_HIT_SLOP = {top: 0, bottom: 12, left: 12, right: 12};

/**
 * @param {Object} props
 * @param {number} props.position   Posicion 1-based en el mazo.
 * @param {'question'|'answer'} props.face
 * @param {import('./decksRepo').Question} props.question
 * @param {() => void} props.onTurn
 * @returns {React.ReactElement}
 */
export function QuestionCard({position, face, question, onTurn}) {
  const isAnswer = face === 'answer';
  const imageUri = useCardImage(
    isAnswer ? question.imageAnswerId : question.imageQuestionId,
  );

  // La longitud que decide el tamano del texto (DELTA-003).
  //
  // Para el reverso es la SUMA de las dos respuestas y no la longitud de `answer1`: son un
  // solo cuerpo de texto —`Respuesta2` CONTINUA a la anterior, deck-sync REQ-028—, asi que
  // medir solo la primera elegiria un escalon grande para una cara que en realidad lleva el
  // doble de texto.
  const length = isAnswer
    ? question.answer1.length + (question.answer2?.length ?? 0)
    : question.question.length;

  // Sobre el texto BASE, nunca sobre el ya escalado por el sistema: ver DD-022. El ajuste
  // de tamano del sistema multiplica DESPUES, sobre el escalon ya elegido.
  const step = cardTextStep(length);

  /**
   * El giro pedido por el lector de pantalla.
   *
   * Hace falta porque la raiz ya NO es un `Pressable` y la activacion por doble toque dejo de
   * venir gratis con el (DD-031). Y no se arregla con `onAccessibilityTap`: ese es SOLO de
   * iOS, asi que en Android no haria nada y nadie se enteraria.
   *
   * Sin `useCallback` a proposito: nada aguas abajo esta memoizado, asi que seria ceremonia.
   *
   * @param {{nativeEvent: {actionName: string}}} event
   */
  function onAccessibilityAction(event) {
    if (event.nativeEvent.actionName === 'activate') {
      onTurn();
    }
  }

  return (
    <View
      style={[styles.card, isAnswer && styles.cardAnswer]}
      // UN solo elemento accionable por cara (REQ-028). Sin esto el lector recorre el
      // numero, el texto y la indicacion como tres nodos sueltos, y quien no ve la
      // pantalla oye la pregunta partida en trozos.
      accessible
      accessibilityRole="button"
      accessibilityLabel={cardAccessibilityLabel(position, face, {
        question: question.question,
        answer1: question.answer1,
        answer2: question.answer2,
      })}
      accessibilityHint={CARD_TURN_HINT}
      // ESTO NO ES ADORNO, y es lo que compensa que la raiz haya dejado de ser accionable:
      // sin la accion declarada, quien usa lector de pantalla se queda sin poder girar.
      accessibilityActions={TURN_ACTIONS}
      onAccessibilityAction={onAccessibilityAction}>
      {/*
        El encabezado y el pie van FUERA del area desplazable: con el texto del
        sistema al maximo el cuerpo se desplaza dentro de la tarjeta, y estos dos
        tienen que seguir viendose (REQ-034b).
      */}
      {/*
        El encabezado. Y la SENAL ACCESIBLE de en que cara estas: dice `Nº 01` en el
        anverso y `RESPUESTA Nº 01` en el reverso.

        Es TEXTO, y por eso es la senal principal y no el filete de abajo: los dos filetes
        se distinguen por matiz y casi no por luminosidad, asi que para quien no distingue
        el oro del gris calido serian el mismo filete. Ver DD-023.

        LO QUE NO LLEVA, y hay que no ponerlo: un rotulo de GRADO a su izquierda. El diseno
        de referencia pone `APRENDIZ` ahi, y REQ-017 lo prohibe explicitamente porque el CSV
        no trae esa columna: el origen de datos no la provee. Ver tambien el reverso.
      */}
      <Text style={styles.number}>{cardNumberLabel(position, face).toUpperCase()}</Text>

      <ScrollView
        style={styles.bodyArea}
        contentContainerStyle={styles.body}
        // El lector ya oye la cara entera por la etiqueta de la RAIZ —que desde DD-030 es una
        // `View` y no un `Pressable`—, asi que estos textos no se anuncian por separado.
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden>
        {/*
          El filete de 34 dp, motivo repetido del diseno que ya usan `EmptyState` y
          `DataScreen`. Refuerza —no sustituye— la senal del encabezado, y lo hace por
          COLOR y por GROSOR: 2 dp en oro en la respuesta, 1 dp en gris calido en la
          pregunta. El grosor es lo que hace que la senal no sea solo de color (DD-023).
        */}
        <View style={[styles.rule, isAnswer && styles.ruleAnswer]} />

        {isAnswer ? (
          <>
            <Text style={step.text}>{question.answer1}</Text>

            {/*
              `Respuesta2` es CONTINUACION de la anterior, no una alternativa
              (deck-sync REQ-028). Si no viene, no se renderiza un Text vacio: un
              parrafo en blanco se lee como si faltara algo.

              Va en `step.secondary` y no en un tamano fijo: al ser continuacion, su
              jerarquia es RELATIVA, y con un tamano absoluto en el escalon pequeno saldria
              mas grande que la respuesta a la que continua.
            */}
            {question.answer2 == null ? null : (
              <Text style={step.secondary}>{question.answer2}</Text>
            )}

            {/*
              LO QUE NO LLEVA: una linea de atribucion de origen. El diseno de referencia
              pinta aqui su `{{ source }}`, y REQ-018 lo prohibe por el mismo motivo que el
              grado — el CSV no trae la columna.
            */}
          </>
        ) : (
          <Text style={step.text}>{question.question}</Text>
        )}

        {/*
          Sin imagen utilizable no se pinta NADA: ni icono de error ni hueco
          reservado (REQ-038). Puede faltar porque la celda venia vacia, porque la URL
          no servia, porque la descarga fallo o porque se omitio por tamano.
        */}
        {imageUri == null ? null : (
          <Image
            source={{uri: imageUri}}
            style={styles.image}
            // `contain` y alto acotado: la proporcion se respeta y el texto sigue
            // siendo el elemento dominante (REQ-039).
            resizeMode="contain"
          />
        )}
      </ScrollView>

      {/*
        EL UNICO ELEMENTO ACCIONABLE DE LA CARA (GESTO-002, DD-030).
        El rotulo que ya prometia el gesto por escrito —«Toca para ver la respuesta»— pasa a
        cumplirlo. Antes describia un gesto que funcionaba en OTRO sitio: la tarjeta entera.
      */}
      <View style={styles.footer}>
        <Pressable
          onPress={onTurn}
          hitSlop={TURN_HIT_SLOP}
          // Oculto al lector A PROPOSITO, y no contradice que sea lo unico pulsable: la raiz
          // ya expone la cara entera como boton, y dejar este visible daria DOS nodos donde
          // REQ-028 exige uno. Quien usa lector activa la raiz.
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
          style={({pressed}) => [styles.turn, pressed && styles.turnPressed]}>
          <Text style={styles.hint}>
            {(isAnswer ? CARD.turnToQuestion : CARD.turnToAnswer).toUpperCase()}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    // SIN altura fija, ni minima, ni maxima: la tarjeta ocupa lo que le den y su
    // cuerpo se desplaza dentro (REQ-034b). Lo que se acota es la imagen.
    flex: 1,

    // PAPEL, las dos caras. Esto no contradice REQ-027 —que fija la paleta oscura con
    // independencia del tema del sistema—: la app sigue sin ofrecer tema claro y sin
    // consultar `useColorScheme`, y la tarjeta es un objeto claro sobre una mesa oscura,
    // igual que el splash es claro. Ver DD-021.
    backgroundColor: COLOR.paper,
    borderWidth: 1,
    borderColor: COLOR.paperBorder,
    borderRadius: LAYOUT.radiusCard,

    // La sombra es lo que hace que esto se lea como papel sobre una mesa y no como un
    // recorte pegado. Aproximada a proposito: RN no tiene el `spread` del diseno, y en
    // Android solo se lee `elevation`. Ver DD-026.
    ...ELEVATION.card,

    paddingHorizontal: 22,
    paddingVertical: 20,
    gap: 14,
  },
  /**
   * El canto del REVERSO: 6 dp en dorado claro. La PREGUNTA se queda con el canto normal.
   *
   * `goldBright` y no `goldDim` porque se pidio dorado CLARO. Da 2.70:1 contra el papel —el
   * doble que el `paperBorder` de 1.35:1, que no se distingue de la superficie sobre la que se
   * apoya— y queda por debajo de la vara de 3:1 del proyecto. Se acepta porque no es la senal
   * que informa de la cara: eso lo dicen el encabezado (5.17:1) y el filete (4.35:1).
   *
   * OJO: 6 dp en vez de 1 mete el contenido 5 dp mas adentro, o sea 10 dp menos de ancho util
   * para el texto. No cambia el tamano de la tarjeta —el canto crece hacia dentro— pero con el
   * escalon grande de 36 px es bastante para mover donde parte una linea larga.
   */
  cardAnswer: {
    borderWidth: 6,
    borderColor: COLOR.goldBright,
  },

  // LO QUE SE FUE: `pressed`, que atenuaba el papel entero a 0.9. Sin superficie accionable de
  // tarjeta entera no hay nada que atenuar ahi (GESTO-006). Lo sustituye `turnPressed`.
  number: TYPE.cardNumber,
  bodyArea: {
    flex: 1,
  },
  body: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: 14,
  },

  // El filete. `alignSelf` porque el contenedor centra su contenido en vertical pero los
  // hijos se estiran a lo ancho, y un filete estirado seria una linea de lado a lado.
  rule: {
    alignSelf: 'flex-start',
    width: LAYOUT.ruleWidth,
    height: 1,
    backgroundColor: COLOR.paperRule,
  },
  ruleAnswer: {
    height: LAYOUT.ruleHeightAnswer,
    backgroundColor: COLOR.paperRuleAnswer,
  },

  image: {
    width: '100%',
    height: LAYOUT.cardImageMaxHeight,
  },
  footer: {
    alignItems: 'center',
  },

  // El boton de girar. DISCRETO a la vista y COMODO al dedo, que son dos medidas distintas
  // (DD-032): 36 dp visibles —18 de `lineHeight` mas 9 y 9— y 48 al dedo contando el
  // `hitSlop`. Un canto de 48 dp de alto sobre papel no seria discreto, seria un boton grande.
  turn: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: COLOR.paperBorder,
    borderRadius: LAYOUT.radiusControl,

    // SIN `backgroundColor` y SIN sombra: la tarjeta ya esta elevada, y dos elevaciones
    // anidadas se leen como un error de pintado, no como jerarquia.
  },
  turnPressed: {
    // El canto OSCURECE; no se atenua. Con 1 dp de borde, bajarle la opacidad lo hace
    // desaparecer y se lee como que el boton se ha ido, no como que lo estas pulsando.
    borderColor: COLOR.paperRule,
  },
  hint: {
    ...TYPE.cardHint,

    // ENCONTRADO EN EMULADOR (T-303), no sobre el papel: a `font_scale` 3.0 el rotulo envuelve
    // en tres lineas —«TOCA PARA / VOLVER A LA / PREGUNTA»— y sin esto las tres quedan
    // alineadas a la IZQUIERDA dentro del canto, que se lee como un error de maquetacion y no
    // como un boton. A escala normal no se notaba: una sola linea y la caja se cine a ella.
    //
    // Va aqui y no en `TYPE.cardHint` porque es alineacion, no tipografia: el token sigue
    // siendo puro y la colocacion es asunto del boton que lo usa.
    textAlign: 'center',
  },
});
