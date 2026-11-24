/**
 * Punto de extension para la inicializacion de la app.
 *
 * El splash permanece visible mientras esta promesa no resuelva (REQ-002), asi
 * que aca va todo lo que deba estar listo antes de mostrar la primera pantalla:
 * sesion, configuracion, datos precargados.
 *
 * En v1 no hay nada que cargar y resuelve de inmediato. Existe igual para que
 * agregar carga real mas adelante no obligue a redisenar el arranque.
 *
 * IMPORTANTE: en cuanto aca se agregue trabajo de red, hay que reevaluar el
 * timeout de seguridad que quedo fuera de alcance en requirements seccion 4. Sin
 * el, una peticion que nunca responde deja al usuario atrapado en el splash.
 *
 * Este modulo no debe importar nada de src/splash/: la dependencia va en un solo
 * sentido, del splash hacia el bootstrap.
 *
 * Ver specs/features/splash-screen/design.md seccion 2.4.
 *
 * @format
 */

/**
 * Prepara la app antes de mostrar la primera pantalla.
 *
 * @returns {Promise<void>} Resuelve cuando la app esta lista.
 */
export async function initializeApp() {
  // v1: no hay nada que inicializar todavia.
}
