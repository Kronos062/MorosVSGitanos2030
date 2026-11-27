"""Genera los sprites pixel art de las 59 armas base y de sus proyectiles.
Uso: python3 tools/make_weapon_sprites.py
Escribe public/assets/sprites/weapons/<baseId>.png y projectiles/<baseId>.png y fusiona
las secciones "weapons" y "projectiles" en public/assets/sprites/manifest.json.

Diseño: ~20 siluetas base (pistola, revólver, subfusil, fusil, escopeta, francotirador, railgun,
ametralladora, minigun, bláster, tesla, lanzallamas, criogénico, lanzadores, cañón del vacío,
cuerpo a cuerpo, escudo, soporte) con variantes por arma y un acento del color propio de cada arma.
Todas miran a la DERECHA; la empuñadura (grip) está registrada en el manifiesto.
Proyectiles: se dibujan según el tipo de efecto y su tamaño de colisión (diámetro ≈ projectileSize px de sprite)."""
import json, math, os, re, sys
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(__file__))
from make_world_sprites import Grid, hx, INK, ROOT

WDIR = os.path.join(ROOT, 'public', 'assets', 'sprites', 'weapons')
PDIR = os.path.join(ROOT, 'public', 'assets', 'sprites', 'projectiles')
os.makedirs(WDIR, exist_ok=True); os.makedirs(PDIR, exist_ok=True)

def mix(a, b, t): return tuple(int(round(a[i] * (1 - t) + b[i] * t)) for i in range(3))
BASE = {'w': (255, 244, 214), 's': (195, 203, 232), 'S': (116, 128, 176), 'D': (68, 76, 120),
        'n': (185, 119, 63), 'N': (107, 63, 34), 'G': (200, 144, 28), 'g': (255, 210, 74), 'y': (255, 235, 140),
        'o': (255, 154, 58), 'r': (240, 88, 58)}
def palette(accent):
    a = hx(accent); p = dict(BASE)
    p['A'] = a; p['B'] = mix(a, (10, 12, 30), 0.5); p['C'] = mix(a, (255, 255, 255), 0.55)
    return p

FINISHES = {
    'steel': ((202, 207, 206), (137, 151, 155), (84, 96, 101), (45, 58, 64)),
    'blued': ((163, 176, 181), (105, 125, 135), (61, 78, 89), (34, 47, 58)),
    'sand': ((207, 191, 156), (163, 142, 104), (106, 90, 64), (48, 51, 49)),
    'field': ((180, 188, 154), (132, 145, 111), (81, 97, 73), (40, 51, 45)),
}

# Material y proporciones son los primeros rasgos de identificación. Los tonos
# del catálogo se reservan para marcas pequeñas y partes activas de energía.
FINISH_BY_ID = {
    'iron_python': 'steel', 'street_judge': 'blued', 'six_shooter_v2': 'sand',
    'mk_carbine': 'sand', 'ak_milspec': 'field', 'honey_badger': 'blued',
    'hunting_rifle': 'steel', 'antimateriel': 'sand', 'rail_scout': 'field',
    'street_sawed': 'steel', 'double_hammer': 'sand', 'sawed_spas': 'field',
    'lmg_pork': 'field', 'mg_beltfed': 'sand', 'rpg_junk': 'field',
    'crimson_sidearm': 'steel', 'frost_cannon': 'steel', 'riot_shield': 'field',
}
POLYMER = {'zip9', 'rattler45', 'street_buzz', 'vector_x', 'uzi_cyber', 'kriss_vector',
           'mk_carbine', 'honey_badger', 'sawed_spas', 'antimateriel'}
ENERGY_FAMILIES = {'blaster', 'railgun', 'tesla', 'cryo', 'voidcannon', 'bladelauncher', 'beacon'}

def weapon_palette(weapon, family):
    pal = palette(weapon['color'])
    chosen = FINISH_BY_ID.get(weapon['id'], 'steel' if family in ENERGY_FAMILIES else 'blued')
    pal.update(zip(('w', 's', 'S', 'D'), FINISHES[chosen]))
    pal['n'], pal['N'] = ((94, 101, 98), (47, 55, 55)) if weapon['id'] in POLYMER else ((155, 105, 66), (87, 56, 39))
    pal['G'], pal['g'], pal['y'] = (145, 109, 58), (201, 163, 92), (228, 190, 128)
    if family not in ENERGY_FAMILIES and 'energy' not in weapon['tags']:
        pal['A'] = mix(pal['A'], pal['S'], .76)
        pal['C'] = mix(pal['A'], pal['s'], .5)
    return pal

# ───────────────────────── lienzo relativo a la empuñadura ─────────────────────────
OX, OY = 28, 20
class Rel:
    def __init__(s, pal): s.g = Grid(64, 40); s.pal = pal
    def R(s, x, y, w, h, c):
        s.g.rect(OX + x, OY + y, w, h, s.pal[c])
    def P(s, x, y, c): s.g.set(OX + x, OY + y, s.pal[c])
    def cut(s, x, y):
        s.g.p.pop((OX + x, OY + y), None)
    def D(s, cx, cy, r, c):
        for yy in range(-r - 1, r + 2):
            for xx in range(-r - 1, r + 2):
                if xx * xx + yy * yy <= r * r + r * 0.6: s.P(cx + xx, cy + yy, c)
    def finish(s):
        xs = [k[0] for k in s.g.p]; ys = [k[1] for k in s.g.p]
        x0, y0, x1, y1 = min(xs), min(ys), max(xs), max(ys)
        c = Grid(x1 - x0 + 1, y1 - y0 + 1)
        for (x, y), col in s.g.p.items(): c.p[(x - x0, y - y0)] = col
        return c.outlined(), (OX - x0 + 1, OY - y0 + 1)

# ───────────────────────── siluetas de armas ─────────────────────────
def pistol(r, L=9, cell=False, compact=False):
    r.R(-2, 0, 3, 5, 'n'); r.R(-3, 3, 3, 2, 'n'); r.R(-2, 0, 1, 5, 'N')
    r.R(-1, -2, 5, 2, 'S'); r.P(3, 0, 'D'); r.R(1, 0, 2, 1, 'D')
    r.R(-3, -4, L, 3, 's'); r.R(-3, -4, L, 1, 'w'); r.R(-3, -2, L, 1, 'S')
    r.R(L - 4, -3, 2, 1, 'D')
    if cell: r.R(0, -3, 4, 1, 'A'); r.P(0, -4, 'C'); r.P(L - 3, -2, 'A')
    else:
        r.R(-1, -3, 3, 1, 'D')
        r.P(0, -2, 's'); r.P(L - 5, -3, 'S')
    r.cut(-3, -4)
    r.P(-2, 2, 's'); r.P(-1, 3, 'N')
    if compact:
        r.cut(-3, 4); r.cut(-2, 4); r.cut(-1, 4)
    elif not cell:
        r.R(2, -1, 3, 1, 'D'); r.P(4, 0, 'D')
    r.P(L - 3, -5, 'D')
    return L - 3
def revolver(r, L=10):
    r.R(-3, 0, 3, 6, 'n'); r.R(-4, 3, 3, 3, 'n'); r.R(-3, 0, 1, 6, 'N')
    r.R(-1, -3, 5, 3, 'S'); r.R(1, -6, 4, 5, 's'); r.R(1, -6, 4, 1, 'w')
    r.R(1, -3, 4, 1, 'S')
    for xx in (2, 4): r.R(xx, -5, 1, 2, 'D')
    r.P(-2, -5, 'D'); r.P(-2, -4, 'D')
    r.R(5, -4, L - 4, 2, 's'); r.R(5, -4, L - 4, 1, 'w'); r.R(5, -2, L - 4, 1, 'S')
    r.R(6, -3, L - 6, 1, 'A'); r.P(L, -5, 'D'); r.P(3, 1, 'D')
    return L
def smg(r, mag=5, stock=True, cell=False):
    r.R(-3, -4, 11, 4, 'S'); r.R(-3, -4, 11, 1, 's')
    r.R(8, -3, 4, 2, 'D'); r.P(11, -4, 'D'); r.R(8, -4, 1, 1, 'S')
    r.R(-1, 0, 2, mag, 'D'); r.R(-1, mag - 1, 2, 1, 'A')
    r.R(-3, 0, 2, 4, 'n'); r.R(-3, 0, 1, 4, 'N')
    if stock: r.R(-9, -3, 6, 1, 'S'); r.R(-9, -2, 1, 2, 'S')
    r.R(0, -3, 6, 1, 'A'); r.P(4, -5, 's')
    if cell: r.R(2, -2, 4, 1, 'C')
    else: r.R(4, -3, 3, 1, 'D'); r.P(6, -2, 's')
    r.P(-1, mag - 2, 'S')
    return 11
def ar(r, L=14, curved=False, optic=False):
    r.R(-5, -4, 12, 4, 'S'); r.R(-5, -4, 12, 1, 's')
    r.R(7, -4, L - 7, 3, 'D'); r.R(7, -4, L - 7, 1, 'S'); r.R(L, -3, 3, 1, 'S'); r.P(L + 2, -4, 'D')
    r.R(-3, 0, 2, 4, 'n'); r.R(-3, 0, 1, 4, 'N')
    if curved:
        for i, (xx, yy) in enumerate([(1, 0), (2, 1), (2, 2), (3, 3), (3, 4)]): r.R(xx, yy, 2, 1, 'D')
        r.R(3, 5, 2, 1, 'A')
    else: r.R(1, 0, 2, 5, 'D'); r.R(1, 4, 2, 1, 'A')
    r.R(-12, -3, 7, 3, 'n'); r.R(-12, -3, 7, 1, 'N'); r.R(-12, 0, 2, 1, 'N')
    r.R(-1, -3, 4, 1, 'D'); r.P(2, -2, 's')
    for xx in range(7, L - 1, 2): r.P(xx, -3, 's')
    r.R(-11, -2, 4, 1, 'n')
    if optic: r.R(-1, -7, 5, 3, 's'); r.P(4, -6, 'A')
    else: r.P(L + 2, -5, 'D'); r.P(0, -5, 'D')
    return L + 2
def shotgun(r, kind='double', L=14):
    if kind == 'sawed':
        r.R(-2, 0, 3, 5, 'n'); r.R(-3, 3, 3, 2, 'n')
        r.R(-2, -4, 4, 4, 'S'); r.R(2, -4, L, 2, 's'); r.R(2, -2, L, 2, 'D'); r.R(2, -4, L, 1, 'w')
        r.R(3, -3, L - 4, 1, 'A'); r.P(L + 2, -3, 'D'); return L + 2
    r.R(-10, -2, 8, 3, 'n'); r.R(-10, -2, 8, 1, 'N'); r.R(-10, 1, 2, 2, 'N')
    r.R(-2, -4, 5, 5, 'S'); r.R(-2, -4, 5, 1, 's')
    r.R(3, -4, L, 2, 's'); r.R(3, -2, L, 2, 'D'); r.R(3, -4, L, 1, 'w')
    if kind == 'pump':
        r.R(7, 0, 5, 2, 'n')
        for xx in (7, 9, 11): r.R(xx, 0, 1, 2, 'N')
    else: r.R(7, 0, 3, 1, 'n')
    r.R(4, -3, L - 4, 1, 'S'); r.R(L + 2, -4, 2, 4, 'S'); r.P(0, 1, 'D')
    r.P(L + 3, -3, 'D'); r.P(L + 3, -1, 'D')
    return L + 3
def sniper(r, L=20, heavy=False, cell=False):
    r.R(-6, -4, 12, 4, 'S'); r.R(-6, -4, 12, 1, 's')
    r.R(6, -3, L - 6, 2, 'D'); r.R(6, -3, L - 6, 1, 'S')
    r.R(L - 2, -5, 3, 5, 'S'); r.R(L - 2, -5, 3, 1, 's')
    r.R(-14, -3, 8, 4, 'n'); r.R(-14, -3, 8, 1, 'N'); r.R(-3, 0, 2, 4, 'n')
    r.R(-2, -8, 10, 3, 's'); r.R(-2, -8, 10, 1, 'w'); r.R(7, -8, 2, 3, 'A'); r.R(-3, -7, 1, 2, 'D'); r.R(0, -5, 1, 1, 'D'); r.R(5, -5, 1, 1, 'D')
    r.R(-4, -3, 8, 1, 'A')
    if heavy: r.R(10, 0, 2, 4, 'S'); r.R(14, 0, 2, 4, 'S')
    if cell: r.R(-1, 1, 5, 1, 'C')
    return L + 1
def railgun(r, L=18):
    r.R(-8, -4, 6, 7, 'S'); r.R(-8, -4, 6, 1, 's'); r.R(-6, 3, 3, 4, 'n')
    r.R(-2, -5, L, 1, 's'); r.R(-2, -1, L, 1, 's'); r.R(-2, -4, L, 3, 'D')
    for xx in range(0, L - 3, 4): r.R(xx, -4, 2, 3, 'A')
    r.R(L - 2, -6, 2, 7, 'S'); r.R(-2, -3, L - 2, 1, 'C')
    return L
def lmg(r, L=12, belt=True):
    r.R(-7, -5, 17, 5, 'S'); r.R(-7, -5, 17, 1, 's')
    r.R(10, -5, 6, 4, 'S'); r.R(16, -4, L - 4, 2, 'D'); r.R(L + 8, -5, 2, 4, 'S')
    r.R(-1, 0, 6, 5, 'D'); r.R(-1, 0, 6, 1, 'S')
    if belt:
        for i in range(4): r.R(-5 + i * 0, -1 + i, 2, 1, 'G')
    r.R(-12, -4, 5, 3, 'n'); r.R(-3, 0, 1, 0, 'n'); r.R(-3, 0, 2, 4, 'n')
    r.R(-2, -8, 8, 2, 'S'); r.R(0, -4, 8, 1, 'A')
    r.R(8, 0, 1, 3, 'S'); r.R(10, 0, 1, 3, 'S')
    return L + 10
def minigun(r, barrels=3, L=20):
    r.R(-5, -4, 9, 7 if barrels == 3 else 9, 'S'); r.R(-5, -4, 9, 1, 's')
    top = -5 if barrels == 3 else -6
    ys = [top, top + 3, top + 6] if barrels == 3 else [top, top + 3, top + 6, top + 9]
    for y in ys: r.R(4, y, L - 4, 2, 'D'); r.R(4, y, L - 4, 1, 'S')
    n = len(ys) * 3
    for xx in (8, L - 4): r.R(xx, top - 1, 2, n + 1, 's')
    r.R(L - 1, top - 1, 2, n + 1, 'A')
    r.R(-2, 3 if barrels == 3 else 5, 3, 4, 'n'); r.R(-9, -2, 4, 3, 'D'); r.R(-9, -2, 4, 1, 'G')
    return L + 1
def blaster(r, kind='plain'):
    r.R(-3, 0, 3, 5, 'n'); r.R(-3, 0, 1, 5, 'N')
    r.R(-4, -4, 9, 5, 'S'); r.R(-4, -4, 9, 1, 's'); r.R(-1, -3, 5, 2, 'A'); r.P(-1, -3, 'C')
    if kind == 'plain':
        r.R(5, -3, 5, 3, 'D'); r.R(9, -3, 1, 3, 'A'); r.P(0, -5, 'D'); return 10
    if kind == 'horn':
        r.R(5, -3, 3, 3, 'D'); r.R(8, -5, 2, 7, 's'); r.R(10, -6, 2, 9, 'S'); r.R(12, -7, 1, 11, 'A'); return 13
    if kind == 'tank':
        r.R(-2, -8, 7, 4, 'A'); r.R(-2, -8, 7, 1, 'C'); r.R(5, -3, 5, 3, 'D'); r.R(9, -4, 2, 5, 'S'); r.P(11, -2, 'C'); return 11
    if kind == 'ring':
        r.R(5, -3, 4, 3, 'D'); r.R(9, -7, 2, 11, 'A'); r.R(9, -7, 2, 1, 'C'); r.R(9, 3, 2, 1, 'B'); return 11
    if kind == 'twin_core':
        r.R(5, -4, 7, 5, 'D'); r.R(7, -6, 6, 2, 'S'); r.R(7, 1, 6, 2, 'S')
        r.R(8, -5, 4, 1, 'C'); r.R(8, 1, 4, 1, 'A')
        r.R(13, -7, 2, 5, 's'); r.R(13, -1, 2, 5, 's'); return 15
    if kind == 'nova':
        r.R(5, -3, 3, 3, 'D'); r.D(11, -2, 4, 'A'); r.D(10, -3, 2, 'C'); r.P(11, -2, 'w'); return 15
    if kind == 'bounce':
        r.R(5, -3, 4, 3, 'D'); r.R(9, -5, 4, 7, 'S'); r.R(10, -4, 2, 5, 'A'); r.P(13, -2, 'C'); return 13
    if kind == 'chrono':
        r.R(5, -3, 4, 3, 'D'); r.D(11, -2, 3, 's'); r.D(11, -2, 2, 'A'); r.R(11, -4, 1, 2, 'D'); r.P(12, -2, 'D'); return 14
    return 10
def tesla(r, double=False):
    r.R(-4, -3, 5, 4, 'S'); r.R(-3, 1, 3, 4, 'n'); r.R(-4, -3, 5, 1, 's')
    r.R(1, -3, 12, 2, 'D')
    for xx in (3, 6, 9): r.R(xx, -6, 1, 8, 's'); r.P(xx, -7, 'C')
    r.R(13, -7, 2, 3, 's'); r.R(13, 0, 2, 3, 's')
    r.P(14, -4, 'C'); r.P(14, -3, 'A'); r.P(14, -2, 'C'); r.P(15, -3, 'w')
    if double: r.R(13, -10, 2, 3, 's'); r.R(13, 3, 2, 3, 's')
    return 15
def flamer(r):
    r.R(-10, -8, 7, 6, 'A'); r.R(-10, -8, 7, 1, 'C'); r.R(-8, -2, 3, 1, 'D'); r.R(-10, -5, 7, 1, 'B')
    r.R(-4, -3, 12, 3, 'S'); r.R(-4, -3, 12, 1, 's'); r.R(-2, 0, 3, 5, 'n')
    r.R(8, -5, 5, 6, 'D'); r.R(8, -5, 5, 1, 'S'); r.P(13, -2, 'o'); r.P(13, -3, 'y')
    r.R(-3, -4, 1, 1, 'D')
    return 13
def cryo(r):
    r.R(-4, -4, 9, 5, 'S'); r.R(-4, -4, 9, 1, 's'); r.R(-3, 1, 3, 4, 'n')
    r.R(-2, -8, 6, 4, 'A'); r.R(-2, -8, 6, 1, 'C')
    r.R(5, -4, 6, 4, 'D'); r.R(11, -6, 2, 8, 's')
    for k, (xx, yy, h) in enumerate([(13, -6, 3), (13, -2, 3), (15, -4, 3)]): r.R(xx, yy, 2, h, 'C'); r.P(xx, yy, 'w')
    return 16
def mortar(r):
    r.R(-2, -6, 18, 6, 'D'); r.R(-2, -6, 18, 1, 'S')
    for xx in (2, 8): r.R(xx, -6, 2, 6, 's')
    r.R(16, -7, 2, 8, 'S'); r.R(14, -4, 2, 3, 'A')
    r.R(3, 0, 2, 5, 'S'); r.R(11, 0, 2, 5, 'S'); r.R(-3, -3, 2, 2, 'G')
    r.R(-1, 0, 3, 3, 'n')
    return 18
def grenade(r):
    r.R(-4, -4, 10, 4, 'S'); r.R(-4, -4, 10, 1, 's'); r.R(-3, 0, 3, 5, 'n')
    r.D(3, 2, 3, 'D'); r.D(3, 2, 2, 'S'); r.P(3, 2, 'A'); r.P(2, 1, 'C')
    r.R(6, -4, 7, 4, 'D'); r.R(12, -5, 2, 6, 'S'); r.R(7, -3, 4, 1, 'A')
    return 14
def rpg(r):
    r.R(-8, -5, 24, 3, 'D'); r.R(-8, -5, 24, 1, 'S'); r.R(-10, -6, 2, 5, 's')
    r.R(16, -6, 4, 5, 'A'); r.R(16, -6, 4, 1, 'C'); r.R(20, -5, 1, 3, 'B')
    r.R(-1, -2, 2, 5, 'n'); r.R(8, -2, 2, 4, 'n'); r.R(2, -8, 4, 3, 's'); r.P(5, -7, 'A')
    r.R(-8, -2, 3, 2, 'S')
    return 21
def missilepack(r):
    for i, y in enumerate((-8, -4, 0)): r.R(-4, y, 20, 3, 'D' if i % 2 == 0 else 'S'); r.R(-4, y, 20, 1, 's')
    r.R(16, -9, 2, 12, 'A'); r.R(-6, -9, 2, 12, 'S'); r.R(-2, 3, 3, 4, 'n'); r.R(8, 3, 3, 3, 'n')
    for y in (-7, -3, 1): r.P(17, y, 'C')
    return 18
def mlr(r):
    r.R(-4, -7, 18, 8, 'S'); r.R(-4, -7, 18, 1, 's')
    for yy in (-6, -2): 
        for xx in (0, 4, 8): r.R(xx + 2, yy, 3, 3, 'D'); r.P(xx + 3, yy + 1, 'A')
    r.R(14, -8, 2, 10, 'A'); r.R(-2, 1, 3, 5, 'n'); r.R(8, 1, 3, 3, 'n')
    return 16
def voidcannon(r, kind='orb'):
    r.R(-4, -4, 8, 5, 'S'); r.R(-4, -4, 8, 1, 's'); r.R(-3, 1, 3, 4, 'n')
    r.R(4, -4, 8, 4, 'D'); r.R(6, -5, 2, 6, 's')
    if kind == 'orb':
        r.D(15, -2, 4, 'A'); r.D(15, -2, 2, 'D'); r.P(13, -4, 'C'); return 19
    if kind == 'ring':
        r.R(13, -9, 2, 14, 'A'); r.R(10, -9, 5, 1, 'A'); r.R(10, 4, 5, 1, 'A'); r.D(15, -2, 1, 'D'); return 15
    r.D(15, -2, 4, 'D'); r.R(11, -2, 9, 1, 'A'); r.R(15, -6, 1, 9, 'A'); r.D(15, -2, 1, 'C'); return 19
def bat(r):
    r.R(-4, -1, 6, 3, 'N'); r.R(-5, -2, 2, 5, 'D'); r.R(2, -1, 5, 3, 'n')
    r.R(7, -2, 14, 5, 'n'); r.R(7, -2, 14, 1, 'y'); r.R(20, -3, 3, 7, 'n')
    r.R(10, -2, 2, 5, 'A'); r.R(15, -2, 1, 5, 'S'); r.P(18, -3, 'S'); r.P(18, 3, 'S')
    return 23
def cutter(r):
    r.R(-4, -1, 6, 3, 'n'); r.R(-5, -2, 1, 5, 'G')
    r.R(2, -3, 2, 7, 'S'); r.R(4, -2, 13, 3, 's'); r.R(4, -2, 13, 1, 'w'); r.R(17, -1, 3, 1, 's'); r.R(4, 1, 13, 1, 'A')
    r.R(6, -1, 8, 1, 'S')
    return 20
def axe(r):
    r.R(-8, -1, 20, 2, 'N'); r.R(-8, -1, 20, 1, 'n'); r.R(-9, -2, 2, 4, 'D')
    r.R(9, -7, 6, 14, 'S'); r.R(9, -7, 6, 1, 's'); r.R(14, -7, 2, 14, 'A'); r.R(16, -5, 1, 10, 'C')
    r.R(6, -3, 3, 2, 'D'); r.R(12, -1, 1, 2, 'D')
    return 16
def judgment(r):
    r.R(-8, -1, 18, 2, 'n'); r.R(-9, -2, 2, 4, 'G'); r.R(0, -1, 1, 2, 'G'); r.R(5, -1, 1, 2, 'G')
    r.R(10, -8, 9, 16, 'G'); r.R(10, -8, 9, 2, 'g'); r.R(10, 6, 9, 2, 'B'); r.R(12, -4, 5, 8, 'A'); r.R(13, -3, 2, 3, 'C')
    r.R(19, -6, 2, 12, 'g')
    return 21
def bladelauncher(r):
    r.R(-4, -4, 9, 5, 'S'); r.R(-4, -4, 9, 1, 's'); r.R(-3, 1, 3, 4, 'n'); r.R(-1, -3, 4, 1, 'A')
    r.R(5, -3, 4, 3, 'D'); r.D(12, -2, 4, 'S'); r.D(12, -2, 3, 'D'); r.D(12, -2, 1, 'A')
    for dx, dy in ((0, -6), (0, 2), (-5, -2), (5, -2)): r.P(12 + dx, -2 + dy, 'A')
    r.R(17, -2, 2, 1, 'A')
    return 17
def riotshield(r):
    r.R(0, -9, 8, 18, 'D'); r.R(1, -8, 6, 16, 'S')
    for x in (0, 7):
        r.cut(x, -9); r.cut(x, 8)
    r.R(2, -6, 4, 4, 's'); r.R(2, -6, 4, 1, 'w'); r.R(3, -3, 3, 1, 'A')
    r.R(2, 4, 4, 1, 's'); r.P(2, 6, 's'); r.P(5, 6, 's')
    r.R(-3, -1, 3, 2, 'n'); r.R(-3, -2, 1, 4, 'N')
    return 8
def spud(r):
    r.R(-5, -4, 15, 3, 'S'); r.R(-5, -4, 15, 1, 's'); r.R(10, -5, 3, 5, 'D'); r.D(13, -2, 2, 'A'); r.P(12, -3, 'C')
    r.R(-4, 0, 6, 3, 'D'); r.R(-4, 0, 6, 1, 'S'); r.R(-2, 3, 3, 3, 'n'); r.R(-9, -3, 4, 2, 'G'); r.R(0, -5, 1, 1, 'D')
    for xx in (2, 6): r.R(xx, -4, 1, 3, 'G')
    return 15
def beacon(r, big=False):
    r.R(-3, 0, 3, 5, 'n'); r.R(-4, -5, 10, 5, 'S'); r.R(-4, -5, 10, 1, 's')
    r.R(2, -9, 1, 4, 's'); r.D(2, -10, 2, 'A'); r.P(1, -11, 'C')
    r.R(0, -4, 5, 3, 'D'); r.R(2, -4, 1, 3, 'A'); r.R(1, -3, 3, 1, 'A')
    r.R(6, -3, 3, 2, 'D'); r.R(9, -4, 2, 4, 'A')
    if big: r.R(7, -6, 2, 1, 'C'); r.R(7, 0, 2, 1, 'C'); r.R(-6, -4, 2, 3, 'G')
    return 11

# arma → (función, kwargs)
W = {
 'pulse_pistol': (pistol, dict(L=10, cell=True)), 'zip9': (pistol, dict(L=8, compact=True)), 'rattler45': (pistol, dict(L=12)),
 'crimson_sidearm': (pistol, dict(L=11, cell=True)),
 'street_judge': (revolver, dict(L=9)), 'iron_python': (revolver, dict(L=13)), 'six_shooter_v2': (revolver, dict(L=11)),
 'street_buzz': (smg, dict(mag=4, stock=False)), 'vector_x': (smg, dict(mag=5)), 'uzi_cyber': (smg, dict(mag=6, stock=False, cell=True)),
 'kriss_vector': (smg, dict(mag=5, cell=True)),
 'ar_pulse': (ar, dict(L=14)), 'mk_carbine': (ar, dict(L=13, optic=True)), 'honey_badger': (ar, dict(L=12, curved=True, optic=True)),
 'ak_milspec': (ar, dict(L=15, curved=True)),
 'street_sawed': (shotgun, dict(kind='sawed', L=8)), 'scatter_pump': (shotgun, dict(kind='pump', L=14)),
 'double_hammer': (shotgun, dict(kind='double', L=13)), 'sawed_spas': (shotgun, dict(kind='pump', L=11)),
 'hunting_rifle': (sniper, dict(L=18)), 'rail_scout': (sniper, dict(L=20, cell=True)), 'antimateriel': (sniper, dict(L=22, heavy=True)),
 'void_sniper': (sniper, dict(L=24, heavy=True, cell=True)),
 'rail_driver': (railgun, dict(L=17)), 'proton_beam': (railgun, dict(L=20)),
 'lmg_pork': (lmg, dict(L=11)), 'mg_beltfed': (lmg, dict(L=13)), 'minigun': (minigun, dict(barrels=3, L=18)),
 'bfg_minigun': (minigun, dict(barrels=4, L=22)), 'gatling_laser': (minigun, dict(barrels=3, L=20)),
 'blaster': (blaster, dict(kind='plain')), 'sonic_blaster': (blaster, dict(kind='horn')), 'venom_blaster': (blaster, dict(kind='tank')),
 'plasma_rifle': (blaster, dict(kind='ring')), 'nova_cannon': (blaster, dict(kind='nova')), 'bouncer_gun': (blaster, dict(kind='bounce')),
 'quantum_caster': (blaster, dict(kind='twin_core')), 'chrono_disruptor': (blaster, dict(kind='chrono')),
 'arc_discharger': (tesla, dict(double=True)), 'tesla_gun': (tesla, dict()),
 'flame_thrower': (flamer, dict()), 'frost_cannon': (cryo, dict()),
 'cluster_mortar': (mortar, dict()), 'plasma_grenade': (grenade, dict()), 'rpg_junk': (rpg, dict()),
 'missile_pack': (missilepack, dict()), 'rocket_mlr': (mlr, dict()),
 'void_cannon': (voidcannon, dict(kind='orb')), 'dark_matter': (voidcannon, dict(kind='dark')), 'gravity_well': (voidcannon, dict(kind='ring')),
 'bat': (bat, dict()), 'cutter': (cutter, dict()), 'axe_heavy': (axe, dict()), 'judgment': (judgment, dict()),
 'blade_launcher': (bladelauncher, dict()), 'riot_shield': (riotshield, dict()), 'spud_gun': (spud, dict()),
 'heal_beacon': (beacon, dict()), 'defibrillator': (beacon, dict(big=True)),
}

# ───────────────────────── proyectiles ─────────────────────────
def circle(g, cx, cy, r, c):
    for y in range(int(cy - r - 1), int(cy + r + 2)):
        for x in range(int(cx - r - 1), int(cx + r + 2)):
            if (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r: g.set(x, y, c)

def proj_frames(kind, s, pal):
    A, B, C, w = pal['A'], pal['B'], pal['C'], pal['w']
    d = max(4, int(round(s * 1.1)))
    frames = []
    def new(wd, ht): return Grid(wd, ht)
    if kind in ('bullet', 'bullet_long'):
        L = max(5, int(round(s * 1.8 + 3))) * (2 if kind == 'bullet_long' else 1); t = 2 if s <= 4 else 3
        g = new(L, t)
        for x in range(L): 
            for y in range(t): g.set(x, y, mix(A, (10, 12, 30), 0.4) if x < L // 3 else A)
        g.rect(L // 2, 0, L - L // 2, 1, C); g.rect(L - 2, 0, 2, t, w)
        frames = [g]
    elif kind == 'pellet':
        d2 = max(3, int(round(s * 0.9 + 1))); g = new(d2, d2); circle(g, d2 / 2, d2 / 2, d2 / 2, A); g.set(0, 0, C); frames = [g]
    elif kind == 'bolt':
        L = max(6, int(round(s * 2.4 + 3))); t = max(3, d // 2 + 1); g = new(L, t)
        for x in range(1, L - 1):
            for y in range(t): g.set(x, y, A)
        for y in range(1, t - 1): g.set(0, y, A); g.set(L - 1, y, w)
        g.rect(2, t // 2, L - 3, 1 if t < 4 else 2, w); frames = [g]
    elif kind == 'orb':
        for f in range(2):
            dd = d + 2 + f; g = new(dd + 2, dd + 2)
            circle(g, (dd + 2) / 2, (dd + 2) / 2, dd / 2, A); circle(g, (dd + 2) / 2, (dd + 2) / 2, dd / 2 - 1.6, C)
            circle(g, (dd + 2) / 2, (dd + 2) / 2, max(1, dd / 4), w); frames.append(g)
    elif kind == 'beam':
        L = max(14, int(s * 4 + 8)); t = 3; g = new(L, t)
        g.rect(0, 0, L, t, A); g.rect(0, 1, L, 1, w); g.rect(L - 3, 0, 3, t, C); frames = [g]
    elif kind == 'arc':
        for f in range(2):
            L = max(14, int(s * 3 + 8)); g = new(L, 9); pts = []; y = 4
            for x in range(0, L, 3):
                y = 4 + (((x // 3 + f) % 3) - 1) * 2; pts.append((x, y))
            pts.append((L - 1, 4))
            for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
                n = max(abs(x1 - x0), abs(y1 - y0), 1)
                for i in range(n + 1):
                    x = x0 + (x1 - x0) * i // n; yy = y0 + (y1 - y0) * i // n
                    g.set(x, yy - 1, A); g.set(x, yy + 1, A); g.set(x, yy, w)
            frames.append(g)
    elif kind == 'fire':
        for f in range(3):
            dd = d + 2 + (f % 2); g = new(dd + 2, dd); circle(g, (dd + 2) / 2, dd / 2, dd / 2, pal['r'])
            circle(g, (dd + 2) / 2 + 0.5, dd / 2, max(1.5, dd / 2 - 1.4), pal['o']); circle(g, (dd + 2) / 2 + 1, dd / 2, max(1, dd / 4), pal['y'])
            g.set(f, dd // 2 + (f - 1), pal['r']); frames.append(g)
    elif kind == 'ice':
        L = max(7, int(s * 2 + 3)); g = new(L, 5)
        for x in range(L):
            hh = 2 if x < L - 3 else 1 if x < L - 1 else 0
            for y in range(2 - hh, 3 + hh): g.set(x, y, A)
        g.rect(1, 2, L - 3, 1, w); g.set(L - 1, 2, w); frames = [g]
    elif kind == 'void':
        for f in range(2):
            dd = d + 3 + f; c = (dd + 2) / 2; g = new(dd + 2, dd + 2)
            circle(g, c, c, dd / 2, A); circle(g, c, c, dd / 2 - 1.5, (30, 18, 52)); circle(g, c, c, max(1, dd / 5), C)
            for k in range(4):
                a = f * 0.8 + k * math.pi / 2; g.set(int(c + math.cos(a) * (dd / 2)), int(c + math.sin(a) * (dd / 2)), w)
            frames.append(g)
    elif kind == 'sonic':
        for f in range(2):
            h = max(7, d + 3); g = new(6 + f, h)
            for k, x in enumerate((0, 2, 4)):
                for y in range(h):
                    off = abs(y - h // 2)
                    if off <= h // 2 - k and off >= h // 2 - k - 1 or off < 1: pass
                for y in range(h):
                    cx = x + (abs(y - (h - 1) / 2) ** 2) / (h * 0.9)
                    g.set(int(round(cx)), y, A if k % 2 == 0 else C)
            frames.append(g)
    elif kind == 'glob':
        g = new(d + 2, d + 2); c = (d + 2) / 2; circle(g, c, c, d / 2 + 0.5, A); circle(g, c - 0.5, c - 0.5, d / 4, C); g.set(0, d + 1, A); frames = [g]
    elif kind == 'rocket':
        L = max(9, int(s * 2.1 + 4)); t = max(4, s // 2 + 2); g = new(L, t + 2)
        g.rect(2, 1, L - 5, t, pal['s']); g.rect(L - 3, 1, 3, t, A); g.set(L - 1, 1, pal['w']); g.rect(2, 1, L - 5, 1, w)
        g.rect(1, 0, 3, 1, pal['D']); g.rect(1, t + 1, 3, 1, pal['D']); g.rect(0, 2, 2, t - 2 if t > 2 else 1, pal['o'])
        frames = [g]
    elif kind == 'shell':
        dd = max(6, d); g = new(dd, dd); circle(g, dd / 2, dd / 2, dd / 2, pal['D']); circle(g, dd / 2, dd / 2, dd / 2 - 1.2, pal['S'])
        g.rect(dd // 2, 0, 1, 2, A); g.set(dd // 2 + 1, 0, pal['o']); g.set(1, 1, C); frames = [g]
    elif kind == 'blade':
        for f in range(4):
            dd = max(12, d + 6); c = dd / 2; g = new(dd, dd); a0 = f * math.pi / 4
            for k in range(4):
                a = a0 + k * math.pi / 2
                for r_ in range(1, int(dd / 2)):
                    x = int(c + math.cos(a) * r_); y = int(c + math.sin(a) * r_); g.set(x, y, pal['s'] if r_ < dd / 2 - 1 else A)
                    x2 = int(c + math.cos(a + 0.5) * r_ * 0.8); y2 = int(c + math.sin(a + 0.5) * r_ * 0.8); g.set(x2, y2, pal['S'])
            g.set(int(c), int(c), A); frames.append(g)
    elif kind == 'slash':
        L = max(14, int(s * 1.2)); t = max(6, int(s * 0.5)); g = new(t + 2, L)
        for y in range(L):
            x = int(round((t) * (1 - ((y - (L - 1) / 2) / (L / 2)) ** 2)))
            for xx in range(max(0, x - 2), x + 1): g.set(xx, y, C if xx == x else A)
            g.set(x, y, w)
        frames = [g]
    elif kind == 'heal':
        for f in range(2):
            dd = max(8, d + f); c = (dd + 2) / 2; g = new(dd + 2, dd + 2)
            circle(g, c, c, dd / 2, A); circle(g, c, c, dd / 2 - 1.3, C)
            g.rect(int(c) - 1, int(c) - 3, 2, 6, w); g.rect(int(c) - 3, int(c) - 1, 6, 2, w); frames.append(g)
    return frames

def proj_kind(w):
    t = set(w['tags'])
    if 'shield' in t or 'melee' in t: return 'slash'
    if 'support' in t: return 'heal'
    if 'fire' in t: return 'fire'
    if 'ice' in t: return 'ice'
    if 'electric' in t: return 'arc'
    if 'sniper' in t: return 'bullet_long'
    if w['id'] == 'quantum_caster': return 'orb'
    if 'void' in t or 'experimental' in t: return 'void'
    if 'sonic' in t: return 'sonic'
    if 'bio' in t or 'toxic' in t: return 'glob'
    if 'launcher' in t: return 'rocket'
    if 'explosive' in t: return 'shell'
    if 'slashing' in t: return 'blade'
    if 'rail' in t or w['id'] == 'proton_beam': return 'beam'
    if 'sniper' in t: return 'bullet_long'
    if 'shotgun' in t: return 'pellet'
    if 'energy' in t: return 'orb' if w['size'] >= 6 or w['id'] in ('plasma_rifle', 'quantum_caster', 'plasma_rifle') else 'bolt'
    if 'slow' in t: return 'glob'
    return 'bullet'

def parse_weapons():
    s = open(os.path.join(ROOT, 'src', 'content', 'weapons.ts'), encoding='utf8').read()
    blk = s[s.index('export const WEAPON_BASES'):]
    out = []
    for m in re.finditer(r"\{ id: '([a-z0-9_]+)', name: '([^']+)', baseRarity: '(\w+)'(.*?)\},?\n", blk):
        f = m.group(4)
        tags = re.search(r"tags: \[([^\]]*)\]", f).group(1)
        out.append(dict(id=m.group(1), name=m.group(2), color=re.search(r"color: '(#[0-9a-fA-F]{6})'", f).group(1),
                        size=int(float(re.search(r"projectileSize: ([0-9.]+)", f).group(1))),
                        tags=re.findall(r"'([a-z_]+)'", tags)))
    return out

def strip(frames):
    w = max(f.w for f in frames); h = max(f.h for f in frames)
    im = Image.new('RGBA', (w * len(frames), h), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        o = f.image(); im.paste(o, (i * w + (w - f.w) // 2, (h - f.h) // 2))
    return im, w, h

def build(weapons_only=False):
    weapons = parse_weapons()
    assert len(weapons) == 59, len(weapons)
    missing = [w['id'] for w in weapons if w['id'] not in W]
    assert not missing, missing
    man_w, man_p, previews = {}, {}, []
    for w in weapons:
        pal = palette(w['color']); fn, kw = W[w['id']]
        r = Rel(weapon_palette(w, fn.__name__)); muzzle = fn(r, **kw)
        g, (gx, gy) = r.finish()
        g.image().save(f"{WDIR}/{w['id']}.png")
        man_w[w['id']] = {'image': f"weapons/{w['id']}.png", 'grip': {'x': gx, 'y': gy}, 'muzzle': int(muzzle), 'pixelScale': 2}
        if weapons_only:
            continue
        kind = proj_kind(w); frames = [f.outlined() if kind in ('orb', 'fire', 'void', 'glob', 'shell', 'blade', 'heal', 'rocket') else f for f in proj_frames(kind, w['size'], pal)]
        im, fw, fh = strip(frames); im.save(f"{PDIR}/{w['id']}.png")
        man_p[w['id']] = {'image': f"projectiles/{w['id']}.png", 'frames': len(frames), 'pixelScale': 2}
        if len(frames) > 1: man_p[w['id']]['fps'] = 12
        if kind in ('orb', 'glob', 'heal'): man_p[w['id']]['rotate'] = False
        previews.append((w['id'], Image.open(f"{WDIR}/{w['id']}.png"), im, kind))
    mp = os.path.join(ROOT, 'public', 'assets', 'sprites', 'manifest.json')
    if weapons_only:
        # Conserva la presentación del manifiesto y el resto de sus secciones.
        with open(mp, encoding='utf-8', newline='') as source:
            original = source.read()
        old = json.loads(original)
        if old['weapons'] != man_w:
            old['weapons'] = man_w
            with open(mp, 'w', encoding='utf-8', newline='\n') as target:
                target.write(json.dumps(old, ensure_ascii=False, indent=2) + '\n')
        print('ok', len(man_w), 'armas')
        return
    m = json.load(open(mp)); m['version'] = 1; m['weapons'] = man_w; m['projectiles'] = man_p
    json.dump(m, open(mp, 'w'), indent=2); open(mp, 'a').write('\n')
    # vista previa: cuadrícula de armas con su proyectil
    S, cols = 3, 5; cw, ch = 62 * S, 46 * S
    rows = (len(previews) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * cw, rows * ch), (52, 64, 110)); d = ImageDraw.Draw(sheet)
    for i, (wid, wi, pi, kind) in enumerate(previews):
        ox, oy = (i % cols) * cw, (i // cols) * ch
        b = wi.resize((wi.width * S, wi.height * S), Image.NEAREST); sheet.paste(b, (ox + 6, oy + 14), b)
        q = pi.resize((pi.width * S, pi.height * S), Image.NEAREST)
        sheet.paste(q, (ox + 6, oy + ch - q.height - 4), q)
        d.text((ox + 4, oy + 2), f'{wid} [{kind}]', fill=(255, 255, 160))
    sheet.save('/tmp/weapons_preview.png'); print('ok', len(man_w), 'armas', len(man_p), 'proyectiles', sheet.size)

if __name__ == '__main__': build(weapons_only='--weapons-only' in sys.argv)
