# Aprendo

App móvil para repasar y aprender con tarjetas de preguntas y respuestas.

Las preguntas salen de hojas de cálculo de Google que el usuario añade como
fuentes. La app las descarga, las guarda en el dispositivo y permite repasarlas
sin conexión: cada tarjeta muestra la pregunta y se gira para ver la respuesta.

Hecha con React Native 0.80 (JavaScript, New Architecture) para iOS y Android.

## Requisitos

- Node.js 22.5 o superior (los tests usan `node:sqlite`)
- Xcode 15.2 y CocoaPods, para iOS
- Android Studio con el SDK 35 y el NDK, para Android

## Instalación

```bash
npm ci
cd ios && bundle install && bundle exec pod install && cd ..
```

## Ejecutar

```bash
npm start          # Metro
npm run ios        # simulador de iOS
npm run android    # emulador o dispositivo Android
```

## Tests y lint

```bash
npm test
npm run lint
```

## Estructura

| Carpeta | Contenido |
| --- | --- |
| `src/splash/` | Pantalla de arranque |
| `src/main/` | Vista principal, cabecera y menú lateral |
| `src/decks/` | Tarjetas, navegación y sincronización de mazos |
| `src/sources/` | Alta y gestión de fuentes (Google Sheets) |
| `src/db/` | Almacenamiento local en SQLite (op-sqlite) |
| `src/net/` | Descarga de las hojas de cálculo |
| `src/nav/` | Navegación entre pantallas |
| `src/bootstrap/` | Inicialización de la app al arrancar |
| `src/theme/` | Colores, tipografía y espaciado |
| `__tests__/` | Tests con Jest |
| `scripts/` | Generación de iconos y del logo del splash |

## Iconos y splash

El arte de origen es `assets/minerva.png`. Si cambia, hay que regenerar:

```bash
python3 scripts/make-app-icons.py      # iconos de iOS y Android
python3 scripts/make-padded-logo.py    # assets/minerva-splash.png
npx react-native-bootsplash generate assets/minerva-splash.png \
  --platforms=android,ios --background=F4F1EA --logo-width=192 \
  --assets-output=assets/bootsplash --flavor=main
```

El generador de bootsplash reescribe `android/app/src/main/res/values/colors.xml`
y borra sus comentarios: revisa el diff y restáuralo si solo cambió el formato.

## Release de Android

La APK de release se firma con un keystore propio, que **no** está en git. Crea
`android/keystore.properties` con estas claves:

```properties
storeFile=/ruta/al/aprendo-release.keystore
storePassword=...
keyAlias=...
keyPassword=...
```

Y compila:

```bash
cd android && ./gradlew assembleRelease
```

Sin ese archivo la compilación de release falla a propósito: nunca se firma con
el keystore de depuración.
