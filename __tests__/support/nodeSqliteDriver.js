/**
 * Driver de `node:sqlite` para los tests.
 *
 * op-sqlite es un modulo NATIVO: bajo Jest basta importarlo para que
 * TurboModuleRegistry.getEnforcing lance. Pero la logica mas delicada de esta
 * feature ES SQL —las invariantes por indice unico, la reasignacion de la activa
 * al borrar, el orden de la lista—, y probarla contra un mock que solo registra
 * las cadenas de SQL que recibe no prueba nada.
 *
 * Asi que los tests inyectan este driver, que envuelve el SQLite que Node trae
 * de serie desde la 22.5. El SQL que se ejecuta es el mismo, con las mismas
 * restricciones UNIQUE, el mismo indice parcial y las mismas transacciones.
 *
 * NO es equivalencia total: son dos motores distintos, y `node:sqlite` sigue
 * marcado como experimental. Por eso T-016 verifica la base real en dispositivo.
 *
 * Ver specs/features/data-sources/design.md DD-014.
 *
 * @format
 */

import {DatabaseSync} from 'node:sqlite';

/**
 * @returns {() => import('../../src/db/database').Driver}
 *   Fabrica de driver, en la forma que espera `openDatabase`.
 */
export function makeMemoryDriver() {
  return () => {
    // `enableForeignKeyConstraints: false` NO es un descuido: es lo que hace que
    // los tests de la cascada valgan algo.
    //
    // `node:sqlite` enciende las claves ajenas POR DEFECTO (`PRAGMA foreign_keys`
    // devuelve 1 al abrir). SQLite crudo —y por tanto op-sqlite en el telefono—
    // las trae APAGADAS. Si el driver de tests se quedara con el defecto de Node,
    // el test de "borrar una fuente arrastra sus preguntas" pasaria IGUAL aunque
    // alguien borrara `enableForeignKeys()` de database.js: estaria comprobando el
    // defecto de Node, no nuestro pragma, y en produccion las filas quedarian
    // huerfanas para siempre (REQ-004).
    //
    // Es la trampa de docs/solutions/2026-08-16-el-cerrojo-que-no-protegia-nada.md
    // otra vez: un test que pasa por el motivo equivocado. Apagandolas aca, el
    // entorno de test se parece al telefono y el pragma es lo UNICO que puede
    // encenderlas.
    //
    // Ver deck-sync design.md DD-002.
    const db = new DatabaseSync(':memory:', {enableForeignKeyConstraints: false});

    return {
      executeSync: (sql, params = []) => ({
        // `all()` de node:sqlite ejecuta cualquier sentencia y devuelve las
        // filas; para las que no devuelven ninguna, un array vacio. Es la misma
        // forma que `executeSync` de op-sqlite. Los PRAGMA tambien pasan por aca.
        //
        // Los BLOBS no necesitan conversion en este lado: node:sqlite acepta
        // `Uint8Array` como parametro y devuelve `Uint8Array` al leer, que es
        // exactamente lo que la costura `Driver` promete (deck-sync DD-016). El
        // que convierte es el adaptador de op-sqlite, que habla `ArrayBuffer`.
        rows: db.prepare(sql).all(...params),
      }),
      transactionSync: fn => {
        db.exec('BEGIN');
        try {
          fn();
          db.exec('COMMIT');
        } catch (error) {
          db.exec('ROLLBACK');
          throw error;
        }
      },
    };
  };
}
