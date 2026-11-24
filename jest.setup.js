/**
 * Mock global de react-native-bootsplash.
 *
 * El modulo nativo RNBootSplash no existe bajo Jest, y basta con importarlo para
 * que TurboModuleRegistry.getEnforcing lance. Cualquier test que renderice la
 * app necesita este mock.
 *
 * Devuelve props con la misma forma que el hook real para que los componentes se
 * rendericen igual. No llama a `animate`: los tests que necesiten simular el
 * traspaso de la capa nativa a la JS lo hacen explicitamente con su propio mock.
 *
 * @format
 */

/**
 * Mock global de op-sqlite.
 *
 * Mismo problema que RNBootSplash: es un modulo nativo y basta importarlo para
 * que lance bajo Jest. El mock existe para que ningun test se caiga por la
 * cadena de imports.
 *
 * NO se usa para probar la capa de datos: eso seria comprobar cadenas de SQL en
 * vez de comportamiento. Los tests del esquema y del repositorio inyectan el
 * driver de __tests__/support/nodeSqliteDriver.js, que ejecuta SQL de verdad.
 * Ver specs/features/data-sources/design.md DD-014.
 */
jest.mock('@op-engineering/op-sqlite', () => ({
  __esModule: true,
  open: jest.fn(() => {
    throw new Error(
      'op-sqlite no esta disponible bajo Jest. Inyecta un driver: ver DD-014.',
    );
  }),
}));

jest.mock('react-native-bootsplash', () => ({
  __esModule: true,
  default: {
    hide: jest.fn(() => Promise.resolve()),
    isVisible: jest.fn(() => false),
    useHideAnimation: jest.fn(({manifest}) => ({
      container: {
        style: {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: manifest.background,
        },
        onLayout: jest.fn(),
      },
      logo: {
        source: 1,
        fadeDuration: 0,
        resizeMode: 'contain',
        style: {width: manifest.logo.width, height: manifest.logo.height},
        onLoadEnd: jest.fn(),
      },
      brand: {source: -1},
    })),
  },
}));

/**
 * Guardia de red: cualquier peticion NO prevista es un test roto.
 *
 * REQ-080 dice que la app no hace ninguna peticion salvo las que provoca una
 * actualizacion pedida por el usuario. Mientras la app no tuvo red, eso se
 * comprobaba con un `grep`; ahora que si la tiene, el `grep` ya no sirve y hace
 * falta que la ausencia de peticiones sea OBSERVABLE en los tests.
 *
 * Asi que `fetch` y `XMLHttpRequest` LANZAN, igual que el mock de op-sqlite. Un
 * test que renderice la app y dispare una peticion por error no pasa por
 * casualidad: falla, y dice por que.
 *
 * Quien SI necesita red simulada la inyecta:
 *   - los tests de src/net/download.js sustituyen estos globales a proposito;
 *   - los de syncDeck y aguas arriba inyectan la costura `deps.net` (DD-004) y no
 *     tocan estos globales para nada.
 *
 * Ver specs/features/deck-sync/design.md seccion 2.15 y seccion 7.
 */
const networkForbidden = surface => () => {
  throw new Error(
    `[deck-sync] ${surface} no esta disponible en los tests (REQ-080). ` +
      'Si esta peticion es esperada, sustituye el global en tu test o inyecta ' +
      'la costura de red (deps.net, DD-004). Si no lo es, acabas de encontrar ' +
      'una peticion que la app no deberia hacer.',
  );
};

global.fetch = jest.fn(networkForbidden('fetch'));

// Clase y no funcion: lo que tiene que fallar es INSTANCIARLO, no que exista. El
// polyfill de RN comprueba `'responseType' in xhr` sobre el prototipo, asi que un
// global que reventara al mirarlo romperia hasta lo que no hace peticiones.
global.XMLHttpRequest = class {
  constructor() {
    networkForbidden('XMLHttpRequest')();
  }
};
