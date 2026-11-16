"""Genera los sprites pixel art de objetos del mundo: cofres y portal.
Uso: python3 tools/make_world_sprites.py
Escribe PNG en public/assets/sprites/objects/ y fusiona la sección "objects" en public/assets/sprites/manifest.json.
Todo se dibuja con paleta fija y contorno automático de 1 px (mismo estilo que los iconos de la interfaz)."""
import json, math, os
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..')
OUT = os.path.join(ROOT, 'public', 'assets', 'sprites', 'objects')
os.makedirs(OUT, exist_ok=True)
INK = (0x15, 0x1a, 0x30)
def hx(s): return tuple(int(s[i:i+2], 16) for i in (1, 3, 5))

class Grid:
    def __init__(s, w, h): s.w, s.h, s.p = w, h, {}
    def set(s, x, y, c):
        if 0 <= x < s.w and 0 <= y < s.h: s.p[(x, y)] = c
    def rect(s, x, y, w, h, c):
        for j in range(h):
            for i in range(w): s.set(x + i, y + j, c)
    def hline(s, x, y, w, c): s.rect(x, y, w, 1, c)
    def outlined(s):
        """Añade 1 px de contorno oscuro alrededor: devuelve Grid de (w+2, h+2)."""
        g = Grid(s.w + 2, s.h + 2)
        for (x, y), c in s.p.items(): g.p[(x + 1, y + 1)] = c
        for (x, y) in list(g.p):
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                q = (x + dx, y + dy)
                if q not in g.p and 0 <= q[0] < g.w and 0 <= q[1] < g.h: g.p[q] = ('ink',)
        for k, v in list(g.p.items()):
            if v == ('ink',): g.p[k] = INK
        return g
    def image(s, w=None, h=None):
        im = Image.new('RGBA', (w or s.w, h or s.h), (0, 0, 0, 0))
        for (x, y), c in s.p.items(): im.putpixel((x, y), c + (255,))
        return im

# ───────────────────────── cofres ─────────────────────────
WOOD = dict(l=hx('#d99a5a'), m=hx('#b9773f'), d=hx('#6b3f22'))
RAR = {
  'common':    dict(wood=WOOD, b=(hx('#e4e9fb'), hx('#c3cbe8'), hx('#7480b0')), gem=None, size=(20, 15)),
  'rare':      dict(wood=dict(l=hx('#c98457'), m=hx('#a2623a'), d=hx('#5a3320')), b=(hx('#b9ecff'), hx('#7fd8ff'), hx('#3aa0d8')), gem=(hx('#ffffff'), hx('#7fd8ff'), hx('#3aa0d8')), size=(22, 17)),
  'legendary': dict(wood=dict(l=hx('#b5563f'), m=hx('#8c3b2a'), d=hx('#4d1f18')), b=(hx('#fff09a'), hx('#ffd24a'), hx('#c8901c')), gem=(hx('#e2ccff'), hx('#a77bff'), hx('#6a43c8')), size=(26, 19)),
}

def chest(rarity, state, frame=0):
    cfg = RAR[rarity]; W, H = cfg['size']; w = cfg['wood']; bl, bm, bd = cfg['b']; gem = cfg['gem']
    lidH = H // 2 - 1
    extra = 0   # el cofre abierto mantiene la altura del cerrado
    g = Grid(W, H + extra)
    oy = extra
    def corner_round(y0, y1, top):
        pass
    if state == 'closed':
        # tapa abovedada
        for y in range(0, lidH):
            inset = 2 if y == 0 else (1 if y == 1 else 0)
            g.hline(inset, y, W - 2 * inset, w['m'])
        g.hline(2, 0, W - 4, w['l'])                       # brillo superior
        for y in range(1, lidH): g.set(1 if y == 1 else 0, y, w['l'])
    else:
        # tapa abierta hacia atrás (panel trasero)
        for y in range(0, 4):
            inset = 2 if y == 0 else 1 if y == 1 else 0
            g.hline(1 + inset, y, W - 2 - 2 * inset, w['d'] if y else w['m'])
        g.hline(3, 0, W - 6, w['l'])
        # interior oscuro con brillo
        glow = bm if rarity == 'common' else gem[1] if gem else bm
        g.hline(1, 4, W - 2, hx('#2a2040'))
        for x in range(4, W - 4, 3): g.set(x, 4, glow)
    # cuerpo
    for y in range(oy + lidH if state == 'closed' else 5, H + extra):
        yy = y
        g.hline(0, yy, W, w['m'])
        g.set(0, yy, w['l'])
    bodyTop = lidH if state == 'closed' else 5
    g.hline(0, H + extra - 1, W, w['d'])
    g.hline(0, H + extra - 2, W, w['d'])
    # vetas de madera
    for x in (5, 9, 14, 18, 22):
        if x < W - 3:
            for y in range(bodyTop + 1, H + extra - 2, 2): g.set(x, y, w['d'])
    # franja metálica entre tapa y cuerpo
    g.hline(0, bodyTop, W, bm); g.hline(0, bodyTop + 1, W, bd)
    g.hline(1, bodyTop, W - 2, bl)
    # bandas verticales
    for bx in (2, W - 4):
        top = 0 if state == 'closed' else 0
        for y in range(top, H + extra):
            if (bx, y) in g.p or state == 'closed':
                g.set(bx, y, bm); g.set(bx + 1, y, bd)
        g.set(bx, bodyTop + 3, bl); g.set(bx, 2, bl)
    # esquinas/remaches
    for (x, y) in ((0, H + extra - 3), (W - 1, H + extra - 3)): g.set(x, y, bm)
    # cerradura (solo cerrado)
    if state == 'closed':
        cx = W // 2 - 1
        g.rect(cx - 1, bodyTop - 2, 4, 5, bm); g.hline(cx - 1, bodyTop - 2, 4, bl)
        g.rect(cx - 1, bodyTop + 2, 4, 1, bd)
        if gem: g.rect(cx, bodyTop - 1, 2, 2, gem[1]); g.set(cx, bodyTop - 1, gem[0])
        else:   g.set(cx, bodyTop, INK); g.set(cx, bodyTop + 1, INK)
        if rarity == 'legendary':   # coronación dorada en las esquinas de la tapa
            for x in (2, W - 3): g.set(x, 1, bl); g.set(x, 0, bm)
        # destello animado (solo raro/legendario)
        if gem and frame in (1, 2):
            sx, sy = (5, 2) if frame == 1 else (W - 7, 3)
            for dx, dy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)): g.set(sx + dx, sy + dy, hx('#ffffff'))
            if frame == 2:
                for dx, dy in ((2, 0), (-2, 0), (0, 2), (0, -2)): g.set(sx + dx, sy + dy, gem[0])
    return g.outlined()

def sheet(frames):
    w, h = frames[0].w, frames[0].h
    im = Image.new('RGBA', (w * len(frames), h), (0, 0, 0, 0))
    for i, f in enumerate(frames): im.paste(f.image(), (i * w, 0))
    return im

# ───────────────────────── portal ─────────────────────────
PORTALS = {
  'descent': dict(ring=(hx('#d6f6ff'), hx('#7fd8ff'), hx('#3aa0d8'), hx('#2a5ab0')), arm=(hx('#ffffff'), hx('#9fe6ff'), hx('#4a8fe8'), hx('#2a3f8f')), void=hx('#0e1330')),
  'final':   dict(ring=(hx('#fff6c4'), hx('#ffd24a'), hx('#c8901c'), hx('#7a4f12')), arm=(hx('#ffffff'), hx('#ffe98a'), hx('#e8a52a'), hx('#8c4f18')), void=hx('#1f1020')),
}
N_FRAMES = 6
def portal_frame(kind, f):
    P = PORTALS[kind]; S = 30; c = (S - 1) / 2.0
    g = Grid(S, S)
    ph = 2 * math.pi * f / N_FRAMES / 3          # 3 brazos => bucle perfecto en 6 frames (120° / 6 = 20° por frame)
    for y in range(S):
        for x in range(S):
            dx, dy = x - c, y - c; r = math.hypot(dx, dy); th = math.atan2(dy, dx)
            if r > 14.6: continue
            if r >= 12.2:                         # anillo exterior con runas que giran
                v = math.sin(6 * th - ph * 3)
                col = P['ring'][0] if v > 0.8 else P['ring'][1] if v > 0.1 else P['ring'][2] if v > -0.6 else P['ring'][3]
                g.set(x, y, col); continue
            if r < 3.2:
                g.set(x, y, P['void']); continue
            s = math.sin(3 * (th + 0.42 * r) - ph * 3 * 1.0 + 0.0)
            t = (r - 3.2) / 9.0                   # 0 centro … 1 borde
            if s > 0.62: col = P['arm'][0] if t < 0.55 else P['arm'][1]
            elif s > 0.12: col = P['arm'][1] if t > 0.25 else P['arm'][2]
            elif s > -0.45: col = P['arm'][2] if t > 0.2 else P['arm'][3]
            else: col = P['arm'][3] if t > 0.12 else P['void']
            g.set(x, y, col)
    # chispas fijas que parpadean por frame
    for i in range(5):
        a = i * 1.26 + f * (2 * math.pi / N_FRAMES); rr = 7 + (i * 3) % 5   # una vuelta completa en N_FRAMES => bucle sin salto
        g.set(int(c + math.cos(a) * rr), int(c + math.sin(a) * rr), P['arm'][0])
    return g.outlined()

# ───────────────────────── pickups y drops ─────────────────────────
import sys
sys.path.insert(0, os.path.dirname(__file__))
import make_ui_icons as UI          # reutiliza los iconos 16x16 de la interfaz (casco, pechera, pantalón, botas, pistola)

PK = {'w': hx('#fff4d6'), 's': hx('#e4e9fb'), 'S': hx('#7480b0'), 'e': hx('#5ee0a0'), 'E': hx('#2a9a64'),
      'c': hx('#9fe9ff'), 'C': hx('#3ad0ee'), 'b': hx('#4a8fe8'), 'B': hx('#2a5ab0'),
      'g': hx('#ffd24a'), 'G': hx('#c8901c'), 'y': hx('#fff09a'), 'p': hx('#a77bff'), 'P': hx('#6a43c8'), 'W': hx('#ffffff')}

def art(rows):
    h = len(rows); w = max(len(r) for r in rows)
    g = Grid(w, h)
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch != '.': g.set(x, y, PK[ch])
    return g

def pk_heal():
    return art(['.wwwwwwww.', 'wwwwwwwwwS', 'wwwweewwwS', 'wwwweewwwS', 'wweeeeeewS', 'wweeeeEEwS', 'wwwweEwwwS', 'wwwweEwwwS', 'wwwwwwwwwS', '.SSSSSSSS.']).outlined()

def pk_shield():
    return art(['cccccccccc', 'cCCCCCCCCb', 'cCCwCCCCCb', 'cCCwCCCCbb', 'cCCCCCCCbb', '.cCCCCCbb.', '..cCCCbb..', '...cCbb...', '....bb....']).outlined()

def pk_coin(f):
    widths = [8, 6, 3, 6]; w = widths[f]; g = Grid(8, 8); x0 = (8 - w) // 2
    for y in range(8):
        hw = (w / 2.0) * math.sqrt(max(0.0, 1 - ((y - 3.5) / 4.0) ** 2))
        for x in range(8):
            if abs(x + 0.5 - 4) <= hw: g.set(x, y, PK['g'])
    for (x, y), c in list(g.p.items()):
        if x >= x0 + w - 2 or y >= 6: g.p[(x, y)] = PK['G']
        if y <= 1 and x <= x0 + 2: g.p[(x, y)] = PK['y']
    if w >= 6:
        for y in range(2, 6): g.set(3, y, PK['G']); g.set(4, y, PK['G']) if w >= 8 else None
    return g.outlined()

def pk_relic(f):
    g = art(['....pppp....', '...pWWppP...', '..pWWpppPP..', '.pWppppppPP.', 'ppppppppppPP', '.ppppppppPP.', '..ppppppPP..', '...ppppPP...', '....ppPP....', '.....PP.....'])
    g.w, g.h = 12, 10
    if f in (1, 2):
        sx, sy = (2, 1) if f == 1 else (9, 3)
        for dx, dy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)): g.set(sx + dx, sy + dy, PK['W'])
    return g.outlined()

def icon_png(name):
    rows = UI.I[name]; im = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch != '.': im.putpixel((x, y), hx(UI.PAL[ch]) + (255,))
    return im

def pickup_assets():
    meta = {}
    def one(key, im, frames=1, fps=8):
        im.save(f'{OUT}/{key}.png')
        meta[key] = {'image': f'objects/{key}.png', 'frames': frames, 'pixelScale': 2, 'anchor': {'x': 0.5, 'y': 0.5}}
        if frames > 1: meta[key]['fps'] = fps
    one('pickup_heal', pk_heal().image()); one('pickup_shield', pk_shield().image())
    one('pickup_score', sheet([pk_coin(f) for f in range(4)]), 4, 8)
    one('pickup_relic', sheet([pk_relic(f) for f in range(4)]), 4, 4)
    one('pickup_weapon', icon_png('gun'))
    for slot, icon in (('helm', 'helmet'), ('chest', 'vest'), ('pants', 'pants'), ('boots', 'boot')):
        one(f'pickup_item_{slot}', icon_png(icon))
    return meta

def build():
    manifest_objs = {}
    for rarity in RAR:
        W, H = RAR[rarity]['size']
        frames = [chest(rarity, 'closed', f) for f in range(4 if RAR[rarity]['gem'] else 1)]
        sheet(frames).save(f'{OUT}/chest_{rarity}_closed.png')
        manifest_objs[f'chest_{rarity}_closed'] = {'image': 'objects/chest_%s_closed.png' % rarity, 'frames': len(frames), 'fps': 3, 'pixelScale': 2,
                                                  'anchor': {'x': 0.5, 'y': 1}, 'shadow': {'w': W - 4, 'h': 4}}
        sheet([chest(rarity, 'open')]).save(f'{OUT}/chest_{rarity}_open.png')
        manifest_objs[f'chest_{rarity}_open'] = {'image': 'objects/chest_%s_open.png' % rarity, 'frames': 1, 'pixelScale': 2,
                                                'anchor': {'x': 0.5, 'y': 1}, 'shadow': {'w': W - 4, 'h': 4}}
    for kind in PORTALS:
        sheet([portal_frame(kind, f) for f in range(N_FRAMES)]).save(f'{OUT}/portal_{kind}.png')
        manifest_objs[f'portal_{kind}'] = {'image': f'objects/portal_{kind}.png', 'frames': N_FRAMES, 'fps': 8, 'pixelScale': 2, 'anchor': {'x': 0.5, 'y': 0.5}}
    manifest_objs.update(pickup_assets())
    mp = os.path.join(ROOT, 'public', 'assets', 'sprites', 'manifest.json')
    m = json.load(open(mp)); m['version'] = 1; m['objects'] = manifest_objs
    json.dump(m, open(mp, 'w'), indent=2); open(mp, 'a').write('\n')
    # vista previa ampliada
    S = 8; tiles = []
    for rarity in RAR:
        tiles += [Image.open(f'{OUT}/chest_{rarity}_closed.png'), Image.open(f'{OUT}/chest_{rarity}_open.png')]
    tiles += [Image.open(f'{OUT}/portal_descent.png'), Image.open(f'{OUT}/portal_final.png')]
    tiles += [Image.open(f'{OUT}/{k}.png') for k in ('pickup_heal','pickup_shield','pickup_score','pickup_relic','pickup_weapon','pickup_item_helm','pickup_item_chest','pickup_item_pants','pickup_item_boots')]
    Wt = max(t.width for t in tiles) * S + 16; Ht = sum(t.height * S + 12 for t in tiles) + 12
    prev = Image.new('RGB', (Wt, Ht), (52, 64, 110)); y = 12
    for t in tiles:
        prev.paste(t.resize((t.width * S, t.height * S), Image.NEAREST), (8, y), t.resize((t.width * S, t.height * S), Image.NEAREST)); y += t.height * S + 12
    prev.save('/tmp/world_preview.png'); print('ok', list(manifest_objs))
if __name__ == '__main__': build()
