#!/usr/bin/env python3
"""Genera assets/minerva-splash.png, el logo del splash, a partir de assets/minerva.png.

Por que existe este script (ver design.md DD-005 y REQ-012):

En Android 12+ el icono del splash se dibuja dentro de una ventana con mascara
CIRCULAR: medida en un Pixel_9a con Android 15, el area visible es un circulo de
186 dp para un drawable de 192 dp. Todo lo que exceda ese circulo se recorta.

El arte de Minerva no es cuadrado (519x557) y su envolvente real no toca las
esquinas de su bounding box. Asi que se encaja por CIRCULO ENVOLVENTE MEDIDO
(la distancia real de cada pixel opaco al centro del arte), no por bbox: el
criterio del bbox rechaza tamanos que en realidad entran. Es la misma leccion
que aplica scripts/make-app-icons.py.

Hasta el 2026-11-24 el splash usaba assets/mason-logo.png.

Uso:
    python3 scripts/make-padded-logo.py
"""

import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "assets" / "minerva.png"
TARGET = ROOT / "assets" / "minerva-splash.png"

# Lado del lienzo cuadrado de salida, en px. bootsplash reescala a 192 dp, y a
# @4x eso son 768 px: con 1024 nunca se amplia de mas.
CANVAS = 1024

# Radio del circulo envolvente del arte, como fraccion del semilienzo.
#
# Con 0.80 el arte llega a 76.8 dp de un drawable de 192 dp, contra los 93 dp
# del circulo visible de Android: queda ~17% de margen, el mismo aire que tenia
# el logo anterior (80.6% del radio).
ART_RADIUS = 0.80

# Un pixel se considera opaco a partir de este alfa. Por debajo es antialiasing
# de borde y recortarlo no seria perceptible.
ALPHA_THRESHOLD = 8


def opaque_pixels(image):
    """Devuelve las coordenadas de los pixeles opacos de la imagen."""
    width, height = image.size
    alpha = image.getchannel("A").load()
    return [
        (x, y)
        for y in range(height)
        for x in range(width)
        if alpha[x, y] >= ALPHA_THRESHOLD
    ]


def enclosing_circle(points):
    """Centro (del bbox) y radio del circulo que envuelve todos los puntos."""
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    cx = (min(xs) + max(xs) + 1) / 2
    cy = (min(ys) + max(ys) + 1) / 2
    radius = max(((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2) ** 0.5 for x, y in points)
    return cx, cy, radius


def build():
    source = Image.open(SOURCE).convert("RGBA")
    points = opaque_pixels(source)
    if not points:
        sys.exit("El arte de origen esta completamente transparente")

    cx, cy, radius = enclosing_circle(points)
    scale = (CANVAS / 2 * ART_RADIUS) / radius

    resized = source.resize(
        (round(source.width * scale), round(source.height * scale)),
        Image.LANCZOS,
    )

    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    offset = (round(CANVAS / 2 - cx * scale), round(CANVAS / 2 - cy * scale))
    canvas.paste(resized, offset, resized)
    canvas.save(TARGET, "PNG")

    return canvas


def verify(image):
    """Comprueba que ningun pixel opaco quede fuera del circulo inscrito."""
    width, height = image.size
    center = width / 2
    radius = width / 2

    points = opaque_pixels(image)
    if not points:
        sys.exit("La imagen generada esta completamente transparente")

    worst_at = max(points, key=lambda p: (p[0] - center) ** 2 + (p[1] - center) ** 2)
    worst = ((worst_at[0] - center) ** 2 + (worst_at[1] - center) ** 2) ** 0.5

    print(f"lienzo          : {width}x{height}")
    print(f"radio inscrito  : {radius:.1f} px")
    print(f"pixel mas lejano: {worst_at}  a {worst:.1f} px  ({worst / radius:.1%} del radio)")

    if worst >= radius:
        sys.exit(
            f"El logo excede el circulo inscrito ({worst:.1f} >= {radius:.1f}). "
            f"Reduce ART_RADIUS."
        )

    print(f"OK: margen de {(1 - worst / radius):.1%} contra el borde del circulo")


if __name__ == "__main__":
    verify(build())
    print(f"escrito: {TARGET.relative_to(ROOT)}")
