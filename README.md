# Aprendo

App móvil para repasar y aprender con tarjetas de preguntas y respuestas.

Las preguntas salen de hojas de cálculo de Google que el usuario añade como
fuentes. La app las descarga, las guarda en el dispositivo y permite repasarlas
sin conexión: cada tarjeta muestra la pregunta y se gira para ver la respuesta.

Hecha con React Native 0.80 (JavaScript, New Architecture) para iOS y Android.

## Cómo crear una fuente de preguntas

Una **fuente** es una hoja de cálculo de Google con tus preguntas y respuestas. Aprendo la
descarga, la guarda en el teléfono y te la muestra en tarjetas. Puedes tener varias (un quiz por
fuente) y elegir cuál está activa.

### 1. Crea la hoja

En [Google Sheets](https://sheets.google.com) crea una hoja nueva. La **fila 1** es la cabecera,
con estos nombres de columna; las preguntas empiezan en la fila 2, una por fila.

| Columna | ¿Obligatoria? | Qué va en ella |
| --- | --- | --- |
| `Pregunta` | Sí | El texto de la pregunta (anverso de la tarjeta) |
| `Respuesta1` | Sí | La respuesta (reverso de la tarjeta) |
| `Respuesta2` | No | Una continuación de la respuesta, que se muestra debajo de `Respuesta1` |
| `Imagen Pregunta` | No | Enlace a una imagen que acompaña a la pregunta (ver paso 2) |
| `ImagenRespuesta` | No | Enlace a una imagen que acompaña a la respuesta (ver paso 2) |

Ejemplo:

| Pregunta | Respuesta1 | Respuesta2 | Imagen Pregunta | ImagenRespuesta |
| --- | --- | --- | --- | --- |
| ¿Cuál es la capital de Francia? | París | | | |
| ¿Quién pintó la Mona Lisa? | Leonardo da Vinci | Entre 1503 y 1519. | | https://drive.google.com/file/d/…/view |
| ¿Qué planeta es el más grande? | Júpiter | | | |

Detalles que conviene saber:

- Los nombres de columna no distinguen mayúsculas, tildes ni espacios: `IMAGEN PREGUNTA` o
  `imagenpregunta` también valen. El orden de las columnas da igual, y puedes añadir otras
  columnas tuyas: Aprendo las ignora.
- Si a una fila le falta `Pregunta` o `Respuesta1`, se descarta y la app te dice su número de fila.
  Las filas completamente vacías se saltan sin avisar.
- Las preguntas se muestran en el orden de la hoja.

### 2. Imágenes (opcional)

1. Sube la imagen a [Google Drive](https://drive.google.com). Cada imagen puede pesar como mucho
   **1 MB**; las más grandes se omiten.
2. Compártela igual que la hoja: clic derecho → **Compartir** → en *Acceso general*, **Cualquier
   persona con el enlace**, como **Lector** → **Copiar enlace**. Si la imagen no está compartida
   así, la app no puede descargarla.
3. Pega ese enlace (`https://drive.google.com/file/d/…/view?usp=sharing`) en la celda
   `Imagen Pregunta` o `ImagenRespuesta`. La app lo convierte sola en enlace de descarga.

También sirve cualquier otro enlace directo a una imagen que empiece por `https://`.

### 3. Comparte la hoja como solo lectura

Aprendo descarga la hoja sin iniciar sesión en Google, así que tiene que poder abrirla cualquiera
que tenga el enlace:

1. Con la hoja abierta, pulsa **Compartir** (arriba a la derecha).
2. En **Acceso general**, cambia *Restringido* por **Cualquier persona con el enlace**.
3. Deja el permiso en **Lector**: nadie podrá modificarla.
4. Abre la pestaña que tiene las preguntas y pulsa **Copiar enlace**. Si el documento tiene varias
   pestañas, Aprendo importa la pestaña de la que copiaste el enlace.

El enlace tiene esta forma:

```
https://docs.google.com/spreadsheets/d/1AbC…/edit?gid=0#gid=0
```

> **No uses *Archivo → Compartir → Publicar en la web*.** Ese enlace
> (`…/spreadsheets/d/e/2PACX-…`) es distinto y la app lo rechaza.

### 4. Añádela en Aprendo

1. Abre el menú (☰) y entra en **Datos**.
2. Pulsa **Añadir**. Si todavía no tienes ninguna fuente, el formulario ya aparece abierto.
3. En **Nombre**, escribe el nombre del quiz, por ejemplo `Geografía`. Es el título que verás
   arriba en las tarjetas. Hasta 60 caracteres, y no puede repetirse entre tus fuentes.
4. En **Dirección de la hoja**, pega el enlace del paso 3.
5. Pulsa **Guardar**. La primera fuente que añades queda activa; con varias, la activa es la que
   dice **Test Activo**, y cambias de una a otra con **Activar Test**.
6. Pulsa **Actualizar** en la fila de la fuente para descargar las preguntas. Al terminar, la app
   te dice cuántas guardó.

Vuelve al menú → **Tarjetas** y empieza a repasar.

### 5. Cambiar las preguntas

Si editas la hoja, Aprendo no se entera solo: entra en **Datos** y pulsa **Actualizar** otra vez
en esa fuente. Las preguntas quedan guardadas en el teléfono, así que puedes repasar sin conexión;
solo necesitas internet para actualizar. Si una actualización falla, conservas las preguntas que
ya tenías.

### Errores frecuentes

| Mensaje en la app | Qué pasa | Cómo arreglarlo |
| --- | --- | --- |
| *Eso no parece una hoja de cálculo de Google* | La dirección no es de una hoja de Google Sheets | Copia el enlace desde **Compartir** en la hoja (paso 3) |
| *Ese es el enlace de «Publicar en la web»…* | Copiaste el enlace de *Publicar en la web* | Usa el enlace de **Compartir → Copiar enlace** |
| *La dirección tiene que empezar por https://* | Falta el `https://` del principio | Pega el enlace completo |
| *Ya tienes un test con ese nombre* | Otra fuente se llama igual | Elige otro nombre |
| *Eso no parece una hoja de preguntas. Comprueba que sigue compartida…* | La hoja no está compartida con el enlace, y Google devuelve una página de inicio de sesión | Vuelve al paso 3: **Cualquier persona con el enlace**, como **Lector** |
| *La hoja no responde (error 401, 403 o 404)…* | La hoja no está compartida, se borró, o la dirección tiene un error | Comprueba que la hoja existe y que está compartida como en el paso 3 |
| *A la hoja le falta la columna «Pregunta»* (o «Respuesta1») | La fila 1 no tiene esa cabecera | Revisa los nombres de la fila 1 (paso 1) |
| *La hoja no tiene ninguna pregunta* | La hoja solo tiene la cabecera, o ninguna fila está completa | Añade filas con `Pregunta` y `Respuesta1` |
| *Se descartó la fila N: le falta la pregunta o la respuesta* | Esa fila tiene contenido pero no las dos columnas obligatorias | Complétala o vacíala del todo |
| *…se omitió 1 imagen por ser demasiado grande* | La imagen pesa más de 1 MB | Redúcela y vuelve a actualizar |
| *…no se pudo descargar 1 imagen* | La imagen no está compartida con el enlace, o el enlace no es válido | Compártela como en el paso 2 |
| *No hay conexión* | El teléfono no tiene internet | Conéctate y vuelve a pulsar **Actualizar** |

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

## Licencia

El código de Aprendo se publica bajo la
[PolyForm Noncommercial License 1.0.0](LICENSE.md): puedes verlo, usarlo,
modificarlo y compartirlo para **fines no comerciales** (uso personal, estudio,
investigación, organizaciones educativas o sin ánimo de lucro). El uso comercial
requiere un permiso aparte del autor.

No es una licencia *open source* en el sentido de la OSI, sino *source-available*.

Las dependencias y los recursos de terceros conservan sus propias licencias: React
Native y las librerías de npm (MIT y similares) y las fuentes Cinzel, EB Garamond y
Barlow Condensed (SIL Open Font License).
