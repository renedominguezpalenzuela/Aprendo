#!/usr/bin/env python3
"""Genera los iconos de aplicacion de iOS y Android desde assets/minerva.png.

Por que existe este script y no se pegan los PNG a mano:

El icono de una app no es un archivo, son quince. Cada plataforma lo recorta con
una mascara distinta —esquinas redondeadas en iOS, circulo o cuadrado o gota en
Android— y cada una exige un margen distinto para que el arte no se corte. Hacer
esos quince a ojo garantiza que dentro de un mes nadie sepa de donde salio
ninguno ni con que margen se genero.

El arte de origen NO es cuadrado (519x557) y su envolvente real no toca las
esquinas de su bounding box: el pixel opaco mas lejano al centro esta justo
abajo, a la altura del semilienzo. Asi que el arte se encaja por CIRCULO
ENVOLVENTE MEDIDO, no por bbox, que es la leccion que ya dejo
scripts/make-padded-logo.py: el criterio del bbox rechaza tamanos que en
realidad entran.

Uso:
    python3 scripts/make-app-icons.py

El cerrojo que comprueba el resultado vive en __tests__/appIcon.guard.test.js.
"""

import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "assets" / "minerva.png"

ANDROID_RES = ROOT / "android" / "app" / "src" / "main" / "res"
IOS_APPICON = ROOT / "ios" / "Mason" / "Images.xcassets" / "AppIcon.appiconset"

# Pergamino, el mismo fondo del splash (SPLASH_BACKGROUND en
# src/splash/splashTheme.js y bootsplash_background en values/colors.xml).
#
# DUPLICADO A PROPOSITO, como ya lo esta mason_background: el icono lo dibuja el
# sistema operativo mucho antes de que exista React Native, y no hay forma de que
# lea una constante de JavaScript. Si cambia el color de marca, cambiar aca.
BACKGROUND = (0xF4, 0xF1, 0xEA)

# Un pixel cuenta como arte a partir de este alfa. Por debajo es antialiasing de
# borde y recortarlo no seria perceptible.
ALPHA_THRESHOLD = 8

# Diametro del circulo envolvente del arte, como fraccion del lienzo.
#
# iOS recorta con una superelipse: los laterales llegan al borde pero las
# esquinas se comen ~22% del lado. 0.78 deja el arte holgado dentro de la forma
# y, a 40 px —el icono mas chico que genera Xcode—, da 31 px de arte legible.
IOS_ART = 0.78

# El icono heredado (API 24 y 25, antes de los adaptativos) lo dibujan los
# lanzadores tal cual, sin mascara. Se le da el mismo aire que a iOS para que las
# dos plataformas se vean igual.
LEGACY_ART = 0.78

# La variante redonda se dibuja dentro del circulo inscrito, asi que el arte
# tiene que ser mas chico que en el cuadrado: 0.72 del lienzo son 72% del radio
# del circulo y deja 28% de margen contra su borde.
LEGACY_ROUND_ART = 0.72

# Icono adaptativo (API 26+). El lienzo son 108 dp de los que el sistema solo
# GARANTIZA visibles los 72 dp centrales; los 18 dp de cada lado son reserva para
# la mascara y el parallax. Dentro de esos 72 dp la mascara puede ser un circulo,
# asi que el arte se encaja en un circulo de 68 dp: entra en cualquier mascara
# —circulo, cuadrado redondeado, gota— y guarda 5.6% de margen contra el limite
# documentado.
#
# Deliberadamente NO se reusa el 0.93 de make-padded-logo.py. Ese numero se midio
# contra la mascara de la VENTANA DE SPLASH de Android 12, que es otra mascara y
# mas generosa. Confundirlas recortaria el casco.
ADAPTIVE_ART_DP = 68
ADAPTIVE_CANVAS_DP = 108

# Densidades de Android y su multiplicador sobre dp.
DENSIDADES = {
    "mdpi": 1,
    "hdpi": 1.5,
    "xhdpi": 2,
    "xxhdpi": 3,
    "xxxhdpi": 4,
}

# Lado del icono heredado, en dp. Lo fija Android y no es negociable.
LEGACY_DP = 48

# Xcode 14 en adelante genera el resto de tamanos desde una sola imagen de
# 1024 px, y Xcode 15.2 —el techo de este proyecto— lo hace. Por eso hay un PNG
# de iOS y no nueve.
IOS_PX = 1024


def cargar_arte():
    """El arte recortado a su contenido, y el radio de su circulo envolvente.

    Se recorta a la bbox del alfa para que el centro del recorte SEA el centro
    sobre el que se mide el radio: asi centrar el recorte en el lienzo centra
    tambien la envolvente.
    """
    arte = Image.open(SOURCE).convert("RGBA")
    bbox = arte.getchannel("A").getbbox()

    if bbox is None:
        sys.exit(f"{SOURCE.name} esta completamente transparente")

    arte = arte.crop(bbox)
    return arte, radio_del_arte(arte)


def radio_del_arte(imagen, fondo=None):
    """Distancia del pixel de arte mas lejano al centro de la imagen.

    Con `fondo` a None el arte son los pixeles opacos. Con un color, son los que
    NO son ese color: es como se mide un lienzo ya compuesto, donde todo es
    opaco y el alfa ya no distingue nada.
    """
    ancho, alto = imagen.size
    cx, cy = ancho / 2, alto / 2

    if fondo is None:
        canal = imagen.getchannel("A").load()

        def es_arte(x, y):
            return canal[x, y] >= ALPHA_THRESHOLD

    else:
        px = imagen.convert("RGB").load()

        def es_arte(x, y):
            return px[x, y] != fondo

    peor = 0.0
    for y in range(alto):
        dy2 = (y + 0.5 - cy) ** 2
        for x in range(ancho):
            if es_arte(x, y):
                d = ((x + 0.5 - cx) ** 2 + dy2) ** 0.5
                peor = max(peor, d)

    return peor


def componer(arte, radio, lienzo_px, fraccion, fondo=None, recorte_circular=False):
    """Un lienzo cuadrado con el arte escalado y centrado.

    `fraccion` es el diametro de la envolvente del arte sobre el lado del lienzo.
    `fondo` a None deja el lienzo transparente, que es lo que necesita la capa
    delantera del icono adaptativo: el color lo pone la capa de atras.
    """
    objetivo = fraccion * lienzo_px / 2
    escala = objetivo / radio

    ancho = max(1, round(arte.width * escala))
    alto = max(1, round(arte.height * escala))

    if ancho > lienzo_px or alto > lienzo_px:
        sys.exit(
            f"el arte escalado ({ancho}x{alto}) no cabe en {lienzo_px} px; "
            f"reduce la fraccion"
        )

    if fondo is None:
        lienzo = Image.new("RGBA", (lienzo_px, lienzo_px), (0, 0, 0, 0))
    else:
        lienzo = Image.new("RGBA", (lienzo_px, lienzo_px), fondo + (255,))

    if recorte_circular:
        mascara = Image.new("L", (lienzo_px, lienzo_px), 0)
        ImageDraw.Draw(mascara).ellipse((0, 0, lienzo_px - 1, lienzo_px - 1), fill=255)
        lienzo.putalpha(mascara)

    escalado = arte.resize((ancho, alto), Image.LANCZOS)
    lienzo.paste(
        escalado,
        ((lienzo_px - ancho) // 2, (lienzo_px - alto) // 2),
        escalado,
    )

    return lienzo


def escribir(imagen, destino):
    destino.parent.mkdir(parents=True, exist_ok=True)
    imagen.save(destino, "PNG")
    print(f"  {destino.relative_to(ROOT)}  ({imagen.width}x{imagen.height})")


def generar_android(arte, radio):
    print("Android")

    for densidad, factor in DENSIDADES.items():
        carpeta = ANDROID_RES / f"mipmap-{densidad}"

        legado = round(LEGACY_DP * factor)
        escribir(
            componer(arte, radio, legado, LEGACY_ART, fondo=BACKGROUND),
            carpeta / "ic_launcher.png",
        )
        escribir(
            componer(
                arte,
                radio,
                legado,
                LEGACY_ROUND_ART,
                fondo=BACKGROUND,
                recorte_circular=True,
            ),
            carpeta / "ic_launcher_round.png",
        )

        # La capa delantera del adaptativo se guarda con alfa y sin color de
        # fondo: ademas de dejar que la capa de atras se vea, es lo que permite
        # que el sistema la reuse como capa monocroma de los iconos tematicos de
        # Android 13, donde la forma la define el alfa y el color lo pone el tema.
        escribir(
            componer(
                arte,
                radio,
                round(ADAPTIVE_CANVAS_DP * factor),
                ADAPTIVE_ART_DP / ADAPTIVE_CANVAS_DP,
            ),
            carpeta / "ic_launcher_foreground.png",
        )


def generar_ios(arte, radio):
    print("iOS")

    # Sin alfa, y no es un detalle de estilo: App Store rechaza un icono con
    # canal alfa. Convertir a RGB lo aplana contra el pergamino y deja el PNG en
    # color type 2, que es lo que comprueba el cerrojo.
    icono = componer(arte, radio, IOS_PX, IOS_ART, fondo=BACKGROUND).convert("RGB")
    escribir(icono, IOS_APPICON / "minerva-1024.png")

    return icono


def verificar(icono_ios):
    """Comprueba lo unico que puede romperse en silencio: que el arte se corte."""
    print("Verificacion")

    # iOS: el arte tiene que quedar dentro del circulo inscrito, que es lo que
    # sobrevive al recorte de esquinas de la superelipse.
    radio = radio_del_arte(icono_ios, fondo=BACKGROUND)
    inscrito = IOS_PX / 2
    print(f"  iOS  arte a {radio / inscrito:.1%} del radio inscrito")
    if radio >= inscrito:
        sys.exit("el arte de iOS excede el circulo inscrito; reduce IOS_ART")

    # Android adaptativo: contra los 36 dp de radio de la zona garantizada, que
    # es el limite real. Se mide sobre el xxxhdpi, el mas grande, porque es donde
    # el redondeo a pixel entero pesa menos.
    delantera = Image.open(
        ANDROID_RES / "mipmap-xxxhdpi" / "ic_launcher_foreground.png"
    ).convert("RGBA")
    factor = DENSIDADES["xxxhdpi"]
    garantizado = (72 / 2) * factor
    radio = radio_del_arte(delantera)
    print(f"  Android  arte a {radio / garantizado:.1%} del radio garantizado (72 dp)")
    if radio >= garantizado:
        sys.exit("el arte adaptativo sale de los 72 dp garantizados; reduce ADAPTIVE_ART_DP")

    print("OK")


if __name__ == "__main__":
    arte, radio = cargar_arte()
    print(f"origen: {SOURCE.relative_to(ROOT)}  arte {arte.width}x{arte.height}  ")
    print(f"radio envolvente medido: {radio:.1f} px\n")

    generar_android(arte, radio)
    verificar(generar_ios(arte, radio))
