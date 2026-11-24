"""
Ancho REAL del texto del header, medido en los propios archivos de fuente.

Para que existe: DD-028 calculo si `MAX_CHROME_FONT_SCALE = 1.4` sigue valiendo con los
rotulos de 13 px de DELTA-006, y lo hizo con un ancho de glifo ESTIMADO sobre una
tipografia condensada, donde el error puede ir en cualquier direccion. Esto lo mide en vez
de estimarlo: lee `cmap` y `hmtx` de los TTF empaquetados, sin dependencias.

    python3 scripts/measure-header-text.py

Lo que NO sustituye: ver la pantalla. Esto dice si el texto CABE en el bloque central del
header; que se vea bien es T-209, y a plena luz.
"""
import struct, sys

def tables(b):
    n = struct.unpack('>H', b[4:6])[0]
    out = {}
    for i in range(n):
        o = 12 + i * 16
        tag = b[o:o+4].decode('latin-1')
        off, ln = struct.unpack('>II', b[o+8:o+16])
        out[tag] = (off, ln)
    return out

def load(path):
    b = open(path, 'rb').read()
    t = tables(b)
    ho, _ = t['head']; upem = struct.unpack('>H', b[ho+18:ho+20])[0]
    hho, _ = t['hhea']; num_h = struct.unpack('>H', b[hho+34:hho+36])[0]
    mo, _ = t['maxp']; num_g = struct.unpack('>H', b[mo+4:mo+6])[0]
    hm, _ = t['hmtx']
    adv = []
    for i in range(num_h):
        adv.append(struct.unpack('>H', b[hm+i*4:hm+i*4+2])[0])
    while len(adv) < num_g:
        adv.append(adv[-1])
    # cmap: se busca un subtable de formato 4
    co, _ = t['cmap']
    ntab = struct.unpack('>H', b[co+2:co+4])[0]
    cmap = {}
    for i in range(ntab):
        o = co + 4 + i*8
        so = struct.unpack('>I', b[o+4:o+8])[0] + co
        if struct.unpack('>H', b[so:so+2])[0] != 4:
            continue
        segx2 = struct.unpack('>H', b[so+6:so+8])[0]
        seg = segx2 // 2
        end = [struct.unpack('>H', b[so+14+j*2:so+16+j*2])[0] for j in range(seg)]
        sp = so + 16 + segx2
        start = [struct.unpack('>H', b[sp+j*2:sp+2+j*2])[0] for j in range(seg)]
        dp = sp + segx2
        delta = [struct.unpack('>h', b[dp+j*2:dp+2+j*2])[0] for j in range(seg)]
        rp = dp + segx2
        rng = [struct.unpack('>H', b[rp+j*2:rp+2+j*2])[0] for j in range(seg)]
        for j in range(seg):
            for c in range(start[j], min(end[j], 0xFFFF) + 1):
                if rng[j] == 0:
                    g = (c + delta[j]) & 0xFFFF
                else:
                    gp = rp + j*2 + rng[j] + (c - start[j]) * 2
                    g = struct.unpack('>H', b[gp:gp+2])[0]
                    if g: g = (g + delta[j]) & 0xFFFF
                if g: cmap[c] = g
        break
    return upem, adv, cmap

def width(path, text, size, tracking_dp=0.0):
    upem, adv, cmap = load(path)
    total = 0.0
    for ch in text:
        g = cmap.get(ord(ch))
        if g is None:
            raise SystemExit(f'  !! el glifo {ch!r} NO esta en la fuente')
        total += adv[g] / upem * size
    # React Native anade el tracking DESPUES de cada glifo, el ultimo incluido.
    return total + tracking_dp * len(text)

if __name__ == '__main__':
    F = 'assets/fonts/BarlowCondensed-Regular.ttf'
    G = 'assets/fonts/EBGaramond-Regular.ttf'
    COL = 430 - 12 - 14 - 46 - 46   # DD-008: el bloque central del header
    print(f'Bloque central del header: {COL} dp\n')

    for scale in (1.0, 1.4):
        print(f'--- escala {scale}x ---')
        w = width(F, 'INSTRUCCIÓN', 13 * scale, 1.82 * scale)
        print(f'  INSTRUCCION  13px/0.14em -> {w:6.1f} dp   {"CABE" if w <= COL else "NO CABE"}')
        w0 = width(F, 'INSTRUCCIÓN', 10 * scale, 3.4 * scale)
        print(f'  (el de antes: 10px/0.34em -> {w0:6.1f} dp)')
        for title in ['Preguntas y Respuestas', 'Datos', 'Instrucción de Aprendiz y Compañero 2026']:
            w = width(G, title, 19 * scale)
            lines = -(-w // COL)
            print(f'  "{title[:34]:34}" -> {w:6.1f} dp  = {int(lines)} linea(s)  '
                  f'{"CABE en 2" if lines <= 2 else "DESBORDA numberOfLines=2"}')
        print()
