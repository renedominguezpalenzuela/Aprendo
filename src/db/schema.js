/**
 * Esquema de la base local y sus migraciones.
 *
 * Declarativo a proposito: este archivo se lee de arriba abajo y dice todo lo
 * que hay en la base. Ninguna sentencia de aca se ejecuta sola; las corre
 * database.js.
 *
 * Ver specs/features/data-sources/design.md seccion 2.1 y seccion 3.1.
 *
 * @format
 */

/**
 * Version del esquema que espera esta version de la app.
 *
 * Se compara contra `PRAGMA user_version` al abrir (REQ-003).
 */
export const SCHEMA_VERSION = 3;

/**
 * Migraciones indexadas por la version a la que llevan.
 *
 * Para pasar de la version `n` a SCHEMA_VERSION se ejecutan en orden
 * MIGRATIONS[n + 1] .. MIGRATIONS[SCHEMA_VERSION].
 *
 * ANADIR una version es anadir una entrada. NUNCA editar una existente: las
 * anteriores ya se ejecutaron en telefonos que estan ahi fuera, y cambiarlas
 * solo afecta a las instalaciones nuevas, con lo que las dos poblaciones acaban
 * con esquemas distintos y el mismo `user_version`.
 *
 * @type {Record<number, string[]>}
 */
export const MIGRATIONS = {
  1: [
    `CREATE TABLE sources (
       id           INTEGER PRIMARY KEY AUTOINCREMENT,
       name         TEXT    NOT NULL,
       name_key     TEXT    NOT NULL,
       url_original TEXT    NOT NULL,
       url_csv      TEXT    NOT NULL,
       is_active    INTEGER NOT NULL DEFAULT 0,
       created_at   INTEGER NOT NULL
     )`,

    // Unicidad del nombre (REQ-012). Va sobre `name_key`, que es el nombre
    // recortado y en minusculas: comparar sobre `name` distinguiria "Aprendiz"
    // de "aprendiz", que para el usuario son el mismo identificador.
    `CREATE UNIQUE INDEX sources_name_key ON sources (name_key)`,

    // "Como mucho una activa" (REQ-022), impuesto por el ESQUEMA y no por el
    // codigo. Un indice unico PARCIAL admite tantos ceros como haga falta y un
    // unico uno: es exactamente el requisito, escrito donde no se puede eludir.
    // Ver design.md DD-007.
    `CREATE UNIQUE INDEX sources_one_active ON sources (is_active) WHERE is_active = 1`,
  ],

  // ── Version 2: el mazo (deck-sync) ──────────────────────────────────────────
  //
  // Ver specs/features/deck-sync/design.md seccion 2.1, seccion 3 y DD-001.
  2: [
    // Fecha de la ultima actualizacion con exito (REQ-011, REQ-012). NULL
    // significa "nunca", que NO es lo mismo que 0 y es lo que la fila tiene que
    // poder decir sin inventarse una fecha.
    //
    // Va por ALTER TABLE y no recreando la tabla: las fuentes ya registradas no
    // pueden perderse al actualizar la app (REQ-005).
    `ALTER TABLE sources ADD COLUMN last_synced_at INTEGER`,

    // `images` se crea ANTES que `questions`, que la referencia.
    //
    // Los bytes van como BLOB en la propia base y no en el sistema de archivos:
    // op-sqlite ya lo admite y una libreria de archivos volveria a poner el build
    // en riesgo bajo Xcode 15.2. Ver requirements.md seccion 6.
    `CREATE TABLE images (
       id         INTEGER PRIMARY KEY AUTOINCREMENT,
       source_id  INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
       url        TEXT    NOT NULL,
       mime       TEXT    NOT NULL,
       byte_size  INTEGER NOT NULL,
       bytes      BLOB    NOT NULL,
       is_pending INTEGER NOT NULL DEFAULT 1
     )`,

    // `is_pending` es el corazon de DD-001: el mazo nuevo se escribe aca mismo
    // marcado como pendiente, y no sustituye al anterior hasta que la
    // actualizacion termina del todo. Cancelar en la pregunta 7 de 20 tiene que
    // dejar LAS 20 DE ANTES, no 7 (REQ-007, REQ-054, REQ-064).
    //
    // `image_*_id` va con ON DELETE SET NULL y no CASCADE: si una imagen
    // desapareciera, la pregunta se queda sin foto, no se borra la pregunta.
    `CREATE TABLE questions (
       id                INTEGER PRIMARY KEY AUTOINCREMENT,
       source_id         INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
       position          INTEGER NOT NULL,
       question          TEXT    NOT NULL,
       answer1           TEXT    NOT NULL,
       answer2           TEXT,
       image_question_id INTEGER REFERENCES images(id) ON DELETE SET NULL,
       image_answer_id   INTEGER REFERENCES images(id) ON DELETE SET NULL,
       is_pending        INTEGER NOT NULL DEFAULT 1
     )`,

    // El mazo se lee SIEMPRE por (fuente, no pendiente, orden): REQ-003 y REQ-029
    // son este indice.
    `CREATE INDEX questions_deck ON questions (source_id, is_pending, position)`,
    `CREATE INDEX images_deck    ON images    (source_id, is_pending)`,
  ],

  // ── Version 3: la imagen se guarda LISTA PARA PINTAR ────────────────────────
  //
  // Un data URI en base64 en vez de un blob. `<Image>` de React Native no acepta
  // bytes, acepta una URI, asi que guardarla ya codificada mueve el coste a una vez
  // por imagen al descargar en vez de una vez por vista. Cuesta un 33 % mas de
  // disco. Ver deltas/delta-imagenes-en-base64.md.
  //
  // ES DESTRUCTIVA PARA LOS MAZOS, y a proposito: el formato de la columna cambia y
  // este ejecutor solo corre SQL —convertir un blob a base64 exige JS—. Se tiran las
  // imagenes y las preguntas, LAS FUENTES SE CONSERVAN, y cada una vuelve a decir
  // "Nunca actualizada", que es la verdad, hasta que el usuario pulse Actualizar.
  //
  // ACEPTABLE HOY Y NO DESPUES DE PUBLICAR: los unicos mazos que existen estan en un
  // emulador y en un simulador. Con usuarios delante, este mismo cambio exigiria
  // extender el ejecutor de migraciones para admitir un paso en JS.
  3: [
    // Las preguntas PRIMERO: sus `image_*_id` apuntan a filas que van a dejar de
    // existir. Borrarlas antes deja el orden legible sin tener que razonar sobre el
    // efecto colateral de la clave ajena al tirar la tabla padre.
    `DELETE FROM questions`,

    `DROP TABLE images`,

    `CREATE TABLE images (
       id           INTEGER PRIMARY KEY AUTOINCREMENT,
       source_id    INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
       url          TEXT    NOT NULL,
       mime         TEXT    NOT NULL,
       stored_bytes INTEGER NOT NULL,
       data_uri     TEXT    NOT NULL,
       is_pending   INTEGER NOT NULL DEFAULT 1
     )`,

    // El indice se va con la tabla, asi que se recrea.
    `CREATE INDEX images_deck ON images (source_id, is_pending)`,

    // Sin mazo, la fecha seria mentira.
    `UPDATE sources SET last_synced_at = NULL`,
  ],
};
