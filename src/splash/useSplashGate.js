/**
 * Decide cuando el splash puede ocultarse.
 *
 * Son dos condiciones independientes que deben cumplirse ambas:
 *
 *   1. La inicializacion de la app termino (REQ-002, REQ-003).
 *   2. El wordmark lleva al menos MIN_VISIBLE_MS en pantalla (REQ-004).
 *
 * La segunda se cuenta desde el traspaso de la capa nativa a la JS, no desde el
 * lanzamiento: el texto "Mason Ayuda" solo existe a partir de ese momento, y el
 * minimo esta para que alcance a leerse (design.md DD-003).
 *
 * Ver specs/features/splash-screen/design.md seccion 2.3.
 *
 * @format
 */

import {useEffect, useState} from 'react';

import {initializeApp} from '../bootstrap/initializeApp';
import {MIN_VISIBLE_MS} from './splashTheme';

/**
 * @param {number | null} handoffAt
 *   Marca de tiempo (Date.now()) del instante en que la capa JS reemplazo a la
 *   nativa, o null si todavia no ocurrio.
 * @returns {boolean} true cuando el splash puede ocultarse.
 */
export function useSplashGate(handoffAt) {
  const [initDone, setInitDone] = useState(false);
  const [minElapsed, setMinElapsed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    initializeApp()
      .catch(error => {
        // Un fallo de inicializacion no debe atrapar al usuario en el splash:
        // se registra y se sigue adelante. Ver design.md seccion 2.3.
        console.error('[splash] initializeApp fallo, se continua igual', error);
      })
      .then(() => {
        if (!cancelled) {
          setInitDone(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (handoffAt == null) {
      return undefined;
    }

    const remaining = Math.max(0, MIN_VISIBLE_MS - (Date.now() - handoffAt));
    const timeout = setTimeout(() => setMinElapsed(true), remaining);

    return () => clearTimeout(timeout);
  }, [handoffAt]);

  return initDone && minElapsed;
}
