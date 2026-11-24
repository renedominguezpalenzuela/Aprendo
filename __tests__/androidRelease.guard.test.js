/**
 * Cerrojo del entorno de firma de release.
 *
 * REQ-003 y REQ-004 de specs/features/android-release; diseno en su §2.4 y DD-006.
 *
 * Pregunta a GIT y no al sistema de archivos, y la distincion es el sentido del
 * cerrojo: el keystore DEBE existir en el disco, asi que `fs.existsSync`
 * responderia la pregunta equivocada. Lo que hay que comprobar es si el control
 * de versiones lo conoce.
 *
 * Si `git` no esta disponible, estas pruebas FALLAN; no se saltan. Un cerrojo que
 * se desactiva cuando el entorno no le gusta es exactamente
 * docs/solutions/2026-08-16-el-cerrojo-que-no-protegia-nada.md.
 *
 * @format
 */

const {execFileSync} = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');

/** El keystore publico de depuracion, que SI tiene que estar versionado. */
const DEBUG_KEYSTORE = 'android/app/debug.keystore';

/** Extensiones de almacen de claves, en cualquier sitio del arbol. */
const ALMACENES = /\.(keystore|jks|p12)$/;

/**
 * Rutas que git conoce, relativas a la raiz del repositorio.
 *
 * Se pide con `-z` porque `ls-files` escapa entre comillas los nombres con
 * caracteres raros cuando separa por saltos de linea, y un nombre escapado no
 * coincidiria con la comparacion.
 *
 * @returns {string[]}
 */
function archivosRastreados() {
  const salida = execFileSync('git', ['ls-files', '-z'], {
    cwd: REPO,
    encoding: 'utf8',
  });

  return salida.split('\0').filter(Boolean);
}

/**
 * `android/app/build.gradle` sin el bloque `signingConfigs.debug`.
 *
 * Se recorta por llaves en vez de buscar en el archivo entero porque el bloque
 * `debug` lleva su contrasena en claro a proposito (DD-002): contarla seria un
 * falso positivo sobre la unica credencial que es publica.
 *
 * @returns {string}
 */
function buildGradleSinBloqueDebug() {
  const source = fs.readFileSync(
    path.join(REPO, 'android', 'app', 'build.gradle'),
    'utf8',
  );

  const configs = source.indexOf('signingConfigs');
  if (configs === -1) {
    return source;
  }

  const debug = source.indexOf('debug', configs);
  const abre = source.indexOf('{', debug);
  if (debug === -1 || abre === -1) {
    return source;
  }

  let profundidad = 0;
  for (let i = abre; i < source.length; i++) {
    if (source[i] === '{') {
      profundidad++;
    } else if (source[i] === '}') {
      profundidad--;
      if (profundidad === 0) {
        return source.slice(0, debug) + source.slice(i + 1);
      }
    }
  }

  return source;
}

describe('entorno de firma de release', () => {
  // REQ-003: el archivo de credenciales no puede estar en el control de versiones.
  //
  // Se busca por NOMBRE en cualquier carpeta y no por la ruta concreta
  // `android/keystore.properties`: el mismo archivo un directorio mas arriba
  // seria el mismo secreto, y un cerrojo que solo vigila una ruta invita a
  // moverlo.
  it('git no rastrea ningun keystore.properties, en ninguna carpeta', () => {
    const colados = archivosRastreados().filter(
      ruta => path.basename(ruta) === 'keystore.properties',
    );

    expect(colados).toEqual([]);
  });

  // REQ-003: y tampoco ningun almacen de claves, cualquiera que sea su nombre.
  // Se comprueba por EXTENSION y no por el nombre concreto del keystore de este
  // proyecto: asi el cerrojo sigue sirviendo si manana se llama de otra forma.
  it('git no rastrea ningun almacen de claves salvo el de depuracion', () => {
    const colados = archivosRastreados()
      .filter(ruta => ALMACENES.test(ruta))
      .filter(ruta => ruta !== DEBUG_KEYSTORE);

    expect(colados).toEqual([]);
  });

  // La asercion COMPLEMENTARIA, y la que suele faltar. Sin ella, un .gitignore
  // demasiado ancho —o un `git rm --cached` con la mano suelta— pasaria las dos
  // pruebas de arriba mientras rompe la compilacion en depuracion de cualquier
  // clon, que necesita este archivo (DD-002).
  it('git SI rastrea el keystore de depuracion', () => {
    expect(archivosRastreados()).toContain(DEBUG_KEYSTORE);
  });

  // REQ-004: ninguna contrasena en claro fuera del bloque `debug`.
  //
  // El patron exige una CADENA pegada al nombre de la propiedad, que es como se
  // escribe una contrasena literal. `storePassword keystoreProperties['...']`
  // —la forma correcta, que llega con T-003— no coincide: despues del nombre
  // viene un identificador, no una comilla.
  it('build.gradle no lleva contrasenas en claro fuera del bloque debug', () => {
    const literal = /\b(storePassword|keyPassword)\s+['"]/g;
    const hallazgos = buildGradleSinBloqueDebug().match(literal) || [];

    expect(hallazgos).toEqual([]);
  });
});
