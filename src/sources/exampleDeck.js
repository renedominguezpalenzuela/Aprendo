/**
 * Mazo de ejemplo que trae la app: 20 preguntas sobre el sistema solar.
 *
 * El CONTENIDO vive en `ejemplos/sistema-solar.csv`, que es el que se publica en
 * el repositorio para importar en Google Sheets. Esta copia en JS existe para que
 * la app no tenga que leer ni parsear un CSV al arrancar, y
 * `__tests__/exampleDeck.test.js` falla si las dos dejan de coincidir (DD-022).
 *
 * Ver specs/features/data-sources/design.md, ampliacion del delta mazo de ejemplo.
 *
 * @format
 */

import { nameKey } from './sourceUrl';

/** @type {string} */
export const EXAMPLE_NAME = 'Ejemplo: El sistema solar';

/**
 * Las preguntas, en el orden del CSV.
 *
 * @type {ReadonlyArray<{question: string, answer1: string, answer2: string|null}>}
 */
export const EXAMPLE_QUESTIONS = Object.freeze([
  {
    question: '¿Cuántos planetas tiene el sistema solar?',
    answer1: 'Ocho',
    answer2:
      'Mercurio, Venus, Tierra, Marte, Júpiter, Saturno, Urano y Neptuno.',
  },
  {
    question: '¿Cuál es el planeta más cercano al Sol?',
    answer1: 'Mercurio',
    answer2: 'También es el más pequeño de los ocho.',
  },
  {
    question: '¿Cuál es el planeta más grande?',
    answer1: 'Júpiter',
    answer2: 'En su interior cabrían más de 1.300 Tierras.',
  },
  {
    question: '¿Qué planeta es conocido como «el planeta rojo»?',
    answer1: 'Marte',
    answer2: 'Su color se debe al óxido de hierro de su superficie.',
  },
  {
    question: '¿Qué planeta es famoso por sus anillos?',
    answer1: 'Saturno',
    answer2:
      'Júpiter, Urano y Neptuno también tienen anillos, pero mucho más tenues.',
  },
  {
    question: '¿Cuál es el planeta más caliente?',
    answer1: 'Venus',
    answer2:
      'Su atmósfera de dióxido de carbono atrapa el calor y supera los 460 °C, aunque Mercurio está más cerca del Sol.',
  },
  {
    question: '¿Qué es el Sol?',
    answer1: 'Una estrella',
    answer2: 'Es la estrella más cercana a la Tierra.',
  },
  {
    question: '¿Cuánto tarda la luz del Sol en llegar a la Tierra?',
    answer1: 'Unos 8 minutos',
    answer2: 'Más exactamente, unos 8 minutos y 20 segundos.',
  },
  {
    question: '¿Cuánto tarda la Tierra en dar una vuelta alrededor del Sol?',
    answer1: 'Un año, unos 365 días',
    answer2:
      'Como son algo más de 365 días, cada cuatro años se añade un día: el año bisiesto.',
  },
  {
    question: '¿Cuánto tarda la Tierra en girar sobre sí misma?',
    answer1: 'Un día, unas 24 horas',
    answer2: null,
  },
  {
    question: '¿Cómo se llama el satélite natural de la Tierra?',
    answer1: 'La Luna',
    answer2: null,
  },
  {
    question: '¿Quién fue la primera persona en pisar la Luna?',
    answer1: 'Neil Armstrong',
    answer2: 'El 20 de julio de 1969, en la misión Apolo 11.',
  },
  {
    question: '¿Por qué Plutón ya no se considera un planeta?',
    answer1: 'Desde 2006 se clasifica como planeta enano',
    answer2:
      'La Unión Astronómica Internacional decidió que un planeta debe haber despejado su órbita de otros objetos, y Plutón no lo ha hecho.',
  },
  {
    question: '¿Qué planeta gira «tumbado», con su eje casi horizontal?',
    answer1: 'Urano',
    answer2: 'Su eje está inclinado unos 98 grados.',
  },
  {
    question: '¿Cuál es el planeta más lejano del Sol?',
    answer1: 'Neptuno',
    answer2: null,
  },
  {
    question: '¿Qué hay entre las órbitas de Marte y Júpiter?',
    answer1: 'El cinturón de asteroides',
    answer2: null,
  },
  {
    question: '¿Qué es la Gran Mancha Roja de Júpiter?',
    answer1: 'Una tormenta gigante',
    answer2:
      'Es más grande que la Tierra y se observa desde hace más de 150 años.',
  },
  {
    question: '¿Por qué existen las estaciones del año?',
    answer1: 'Por la inclinación del eje de la Tierra',
    answer2:
      'No es por la distancia al Sol: el eje está inclinado unos 23,5 grados.',
  },
  {
    question: '¿Cuál es la luna más grande del sistema solar?',
    answer1: 'Ganímedes, una luna de Júpiter',
    answer2: 'Es más grande que el planeta Mercurio.',
  },
  {
    question: '¿Qué es un eclipse de Sol?',
    answer1: 'Cuando la Luna se pone entre el Sol y la Tierra',
    answer2: 'La sombra de la Luna oscurece el día durante unos minutos.',
  },
]);

/**
 * Inserta la fuente de ejemplo y sus preguntas, ya visibles.
 *
 * NO abre transaccion: corre dentro de la que crea la base desde cero, para que
 * o quede todo o no quede nada y el siguiente arranque lo reintente (DD-020).
 * Por eso recibe `db` y no importa `database.js`.
 *
 * La fuente no tiene hoja: sus URLs se guardan vacias porque las columnas son
 * NOT NULL, y `toSource` las expone como null.
 *
 * @param {{executeSync: (sql: string, params?: Array<*>) => {rows: Array<Object>}}} db
 * @param {number} now
 * @returns {void}
 */
export function seedExampleDeck(db, now) {
  db.executeSync(
    `INSERT INTO sources
       (name, name_key, url_original, url_csv, is_active, created_at, kind)
     VALUES (?, ?, '', '', 0, ?, 'example')`,
    [EXAMPLE_NAME, nameKey(EXAMPLE_NAME), now],
  );

  const sourceId = db.executeSync('SELECT last_insert_rowid() AS id').rows[0]
    .id;

  EXAMPLE_QUESTIONS.forEach((item, position) => {
    db.executeSync(
      `INSERT INTO questions
         (source_id, position, question, answer1, answer2, is_pending)
       VALUES (?, ?, ?, ?, ?, 0)`,
      [sourceId, position, item.question, item.answer1, item.answer2],
    );
  });
}
