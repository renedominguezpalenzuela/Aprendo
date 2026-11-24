/**
 * Cerrojo del icono de aplicacion.
 *
 * Los iconos los genera scripts/make-app-icons.py desde assets/minerva.png. Lo
 * que vigila este archivo no es el aspecto —eso no lo puede juzgar una prueba—
 * sino las tres formas en que un icono se rompe SIN QUE NADIE SE ENTERE:
 *
 *   1. Falta un archivo, y la plataforma cae en un icono por defecto. Es lo que
 *      pasaba en iOS antes de este cambio: el AppIcon.appiconset estaba vacio y
 *      no habia ni un aviso de compilacion.
 *   2. El PNG de iOS lleva canal alfa. Compila, se instala, se ve bien, y App
 *      Store lo rechaza al subirlo.
 *   3. Un XML de recurso apunta a un nombre que no existe. Esto SI rompe la
 *      compilacion de Android, pero solo la de Android: quien toque los recursos
 *      trabajando en iOS no se enteraria hasta mucho despues.
 *
 * Se leen los PNG a mano y no con una libreria de imagenes porque la cabecera
 * IHDR trae ancho, alto y presencia de alfa en los primeros 26 bytes, y no vale
 * la pena una dependencia para eso.
 *
 * @format
 */

const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const ANDROID_RES = path.join(REPO, 'android', 'app', 'src', 'main', 'res');
const IOS_APPICON = path.join(
  REPO,
  'ios',
  'Mason',
  'Images.xcassets',
  'AppIcon.appiconset',
);

/** Las mismas densidades y factores que usa scripts/make-app-icons.py. */
const DENSIDADES = {
  mdpi: 1,
  hdpi: 1.5,
  xhdpi: 2,
  xxhdpi: 3,
  xxxhdpi: 4,
};

/** Lados en dp que fija Android: 48 para el heredado, 108 para el adaptativo. */
const LEGACY_DP = 48;
const ADAPTIVE_DP = 108;

/** Los color type del PNG que traen canal alfa: gris+alfa y RGBA. */
const CON_CANAL_ALFA = [4, 6];

/**
 * Ancho, alto y presencia de alfa de un PNG, leidos de su cabecera IHDR.
 *
 * El alfa puede llegar por dos caminos y hay que mirar los dos: el color type
 * —tipos 4 y 6, que traen canal— y el trozo `tRNS`, que declara transparencia
 * sobre una paleta sin tocar el color type.
 *
 * @param {string} ruta
 * @returns {{width: number, height: number, hasAlpha: boolean}}
 */
function leerPng(ruta) {
  const bytes = fs.readFileSync(ruta);

  // Se miran los bytes 1..3 de la firma, no los ocho: los otros cinco son
  // centinelas contra transferencias que estropean saltos de linea, y aqui el
  // archivo se lee del disco.
  if (bytes.toString('latin1', 1, 4) !== 'PNG') {
    throw new Error(`${ruta} no es un PNG`);
  }

  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    hasAlpha:
      CON_CANAL_ALFA.includes(bytes[25]) || bytes.includes('tRNS'),
  };
}

/** @param {string[]} partes */
function res(...partes) {
  return path.join(ANDROID_RES, ...partes);
}

describe('icono de aplicacion en iOS', () => {
  const contents = JSON.parse(
    fs.readFileSync(path.join(IOS_APPICON, 'Contents.json'), 'utf8'),
  );

  // Se recorre el Contents.json en vez de comprobar un nombre fijo: es el
  // catalogo quien decide que archivos usa Xcode, asi que preguntarle a el
  // detecta tambien la entrada que quedo apuntando a un archivo renombrado.
  const declarados = contents.images
    .map(imagen => imagen.filename)
    .filter(Boolean);

  it('el catalogo declara al menos una imagen', () => {
    expect(declarados.length).toBeGreaterThan(0);
  });

  it.each(declarados)('%s existe en el disco', nombre => {
    expect(fs.existsSync(path.join(IOS_APPICON, nombre))).toBe(true);
  });

  // Xcode 14+ genera los tamanos restantes desde uno de 1024, que es lo que hace
  // este proyecto. Si algun dia se vuelve al juego completo de nueve, esta
  // asercion se cae sola y habra que decidir a proposito.
  it('la imagen universal mide 1024x1024', () => {
    const universal = contents.images.find(
      imagen => imagen.size === '1024x1024',
    );

    expect(universal).toBeDefined();

    const png = leerPng(path.join(IOS_APPICON, universal.filename));
    expect([png.width, png.height]).toEqual([1024, 1024]);
  });

  // La asercion que justifica el archivo: App Store rechaza un icono con alfa,
  // y no hay nada antes de la subida que lo avise.
  it.each(declarados)('%s no tiene canal alfa', nombre => {
    expect(leerPng(path.join(IOS_APPICON, nombre)).hasAlpha).toBe(false);
  });
});

describe('icono de aplicacion en Android', () => {
  // El icono heredado NO es opcional aunque exista el adaptativo: el
  // minSdkVersion del proyecto es 24 y el calificador `-v26` no aplica ahi.
  // Borrarlo dejaria a API 24 y 25 con el icono por defecto.
  describe.each(Object.entries(DENSIDADES))('mipmap-%s', (densidad, factor) => {
    const legado = Math.round(LEGACY_DP * factor);
    const adaptativo = Math.round(ADAPTIVE_DP * factor);

    it.each([['ic_launcher.png'], ['ic_launcher_round.png']])(
      `%s mide ${legado}x${legado}`,
      nombre => {
        const png = leerPng(res(`mipmap-${densidad}`, nombre));
        expect([png.width, png.height]).toEqual([legado, legado]);
      },
    );

    it(`ic_launcher_foreground.png mide ${adaptativo}x${adaptativo}`, () => {
      const png = leerPng(res(`mipmap-${densidad}`, 'ic_launcher_foreground.png'));
      expect([png.width, png.height]).toEqual([adaptativo, adaptativo]);
    });

    // La capa delantera del adaptativo SI necesita alfa: sin el taparia la capa
    // de fondo, y la capa monocroma de Android 13 define su forma con el alfa.
    // Es la asercion complementaria de la de iOS, y tira en sentido contrario.
    it('ic_launcher_foreground.png conserva el alfa', () => {
      const png = leerPng(res(`mipmap-${densidad}`, 'ic_launcher_foreground.png'));
      expect(png.hasAlpha).toBe(true);
    });
  });

  describe.each([['ic_launcher.xml'], ['ic_launcher_round.xml']])(
    'mipmap-anydpi-v26/%s',
    nombre => {
      const xml = fs.readFileSync(res('mipmap-anydpi-v26', nombre), 'utf8');
      const colors = fs.readFileSync(res('values', 'colors.xml'), 'utf8');

      it('es un icono adaptativo', () => {
        expect(xml).toMatch(/<adaptive-icon/);
      });

      // Cada `@color/...` y `@mipmap/...` del XML tiene que resolver. AGP lo
      // comprobaria al compilar, pero solo al compilar Android.
      it('todos los @color que referencia estan declarados', () => {
        const referencias = [...xml.matchAll(/@color\/([\w.]+)/g)].map(m => m[1]);

        expect(referencias.length).toBeGreaterThan(0);
        referencias.forEach(color => {
          expect(colors).toContain(`name="${color}"`);
        });
      });

      it('todos los @mipmap que referencia existen en todas las densidades', () => {
        const referencias = [...xml.matchAll(/@mipmap\/([\w.]+)/g)].map(m => m[1]);

        expect(referencias.length).toBeGreaterThan(0);
        referencias.forEach(recurso => {
          Object.keys(DENSIDADES).forEach(densidad => {
            expect(
              fs.existsSync(res(`mipmap-${densidad}`, `${recurso}.png`)),
            ).toBe(true);
          });
        });
      });
    },
  );

  // El manifiesto es el que nombra los recursos, asi que se comprueba que los
  // nombres que declara son los que se generaron y no otros.
  it('el manifiesto apunta a los iconos que existen', () => {
    const manifest = fs.readFileSync(
      path.join(REPO, 'android', 'app', 'src', 'main', 'AndroidManifest.xml'),
      'utf8',
    );

    expect(manifest).toContain('android:icon="@mipmap/ic_launcher"');
    expect(manifest).toContain('android:roundIcon="@mipmap/ic_launcher_round"');
  });
});
