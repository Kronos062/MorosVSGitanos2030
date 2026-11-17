"""Genera los sprites pixel art de equipo: 20 sets x 4 ranuras (casco, pechera, pantalón, botas) + 4 genéricos.
Uso: python3 tools/make_equipment_sprites.py
Escribe public/assets/sprites/objects/equip_<setId>_<slot>.png (16x16) y fusiona las claves en el manifiesto.

Cada pieza usa el color EXACTO del set (cuerpo), una variante oscura y otra clara (sombreado/brillo) y un emblema blanco
propio de cada set (5x5 en la pechera, recortado por filas en casco y pantalón; las botas no llevan emblema). La rareza se muestra fuera
del sprite (marco/base del color de rareza), no cambiando el dibujo."""
import json, os, re, sys
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from make_world_sprites import Grid, hx, INK, ROOT

OUT = os.path.join(ROOT, 'public', 'assets', 'sprites', 'objects')
def mix(a, b, t): return tuple(int(round(a[i] * (1 - t) + b[i] * t)) for i in range(3))
FIX = {'s': (195, 203, 232), 'S': (116, 128, 176), 'D': (58, 66, 104), 'w': (255, 244, 214), 'g': (255, 210, 74), 'G': (200, 144, 28)}

SLOTS = {
 'helm': [
  '.....MMMM.....',
  '...MMLLMMMm...',
  '..MMLMMMMMMm..',
  '.MMLMMMMMMMMm.',
  '.MMMMMMMMMMMm.',
  '.MMMMMMMMMMMm.',
  '.MDDDDDDDDDDm.',
  '.MDwDDDDDDDDm.',
  '.MMMMMMMMMMMm.',
  '.MM........Mm.',
  '.mm........mm.',
 ],
 'chest': [
  '.MMMM....MMMM.',
  'MMLMMMssMMMMMm',
  'MLMMMMMMMMMMMm',
  'MMMMMMMMMMMMmm',
  '.MMMMMMMMMMMm.',
  '.MMMMMMMMMMMm.',
  '.MMMMMMMMMMmm.',
  '.mDDDDDDDDDDm.',
  '.MMMMMMMMMMMm.',
  '..MMMMMMMMMm..',
  '..mmmmmmmmmm..',
 ],
 'pants': [
  '.DDDDDDDDDDDD.',
  '.MMMMMMMMMMMm.',
  '.MLMMMMMMMMMm.',
  '.MMMMMMMMMMMm.',
  '.MMMMM..MMMMm.',
  '.MMMMM..MMMMm.',
  '.MMMMM..MMMMm.',
  '.MMMMM..MMMMm.',
  '.MMMMM..MMMMm.',
  '.mmmmm..mmmmm.',
  '.SSSSS..SSSSS.',
 ],
 'boots': [
  '..MMM....MMM..',
  '..MLM....MMM..',
  '..MMM....MMM..',
  '..sss....sss..',
  '..MMM....MMM..',
  '..MMM....MMM..',
  '.MMMMM..MMMMM.',
  'MMMMMMM.MMMMMM',
  'MMMMMMM.MMMMMM',
  'mmmmmmm.mmmmmm',
  'SSSSSSS.SSSSSS',
 ],
}
# (x, y, (fila_inicial, fila_final)) del emblema 5x5 en cada ranura: se recorta en filas para encajar en la zona lisa de la pieza
EMB = {'chest': (4, 2, (0, 5)), 'helm': (5, 1, (0, 4)), 'pants': (4, 1, (1, 4)), 'boots': None}

EMBLEMS = {
 'set_berserker':    ['1...1', '1.1.1', '.111.', '..1..', '..1..'],
 'set_sniper':       ['..1..', '.1.1.', '11.11', '.1.1.', '..1..'],
 'set_asesino':      ['..1..', '..1..', '.111.', '..1..', '..1..'],
 'set_tank':         ['11111', '11111', '11111', '.111.', '..1..'],
 'set_vampiro':      ['11.11', '11111', '.111.', '.1.1.', '..1..'],
 'set_ingeniero':    ['1.1.1', '.111.', '11.11', '.111.', '1.1.1'],
 'set_piromano':     ['..1..', '.11..', '.111.', '11111', '.111.'],
 'set_criomante':    ['1.1.1', '.111.', '11111', '.111.', '1.1.1'],
 'set_electricista': ['...11', '..11.', '.111.', '..11.', '.11..'],
 'set_toxicologo':   ['.111.', '11111', '1.1.1', '.111.', '.1.1.'],
 'set_explorador':   ['..1..', '.111.', '11111', '.111.', '..1..'],
 'set_artillero':    ['..1..', '.111.', '.111.', '.111.', '11111'],
 'set_comando':      ['..1..', '.111.', '11111', '.111.', '1...1'],
 'set_fanatico':     ['..1..', '..1..', '11111', '..1..', '..1..'],
 'set_mercenario':   ['.111.', '1...1', '1.1.1', '1...1', '.111.'],
 'set_medico':       ['.111.', '.111.', '11111', '.111.', '.111.'],
 'set_cazador':      ['..1..', '.111.', '1.1.1', '..1..', '..1..'],
 'set_tecnomante':   ['.1.1.', '11111', '.1.1.', '11111', '.1.1.'],
 'set_caotico':      ['.111.', '1....', '1.11.', '1..1.', '.11..'],
 'set_cuantico':     ['.111.', '1.1.1', '11111', '1.1.1', '.111.'],
}

def parse_sets():
    s = open(os.path.join(ROOT, 'src', 'content', 'equipment.ts'), encoding='utf8').read()
    return re.findall(r"setId: '(set_[a-z0-9_]+)', name: '([^']+)', color: '(#[0-9a-fA-F]{6})'", s)

def render(slot, color, emblem):
    base = hx(color)
    pal = dict(FIX); pal['M'] = base; pal['m'] = mix(base, (10, 12, 30), 0.45); pal['L'] = mix(base, (255, 255, 255), 0.5)
    rows = SLOTS[slot]; g = Grid(14, len(rows))
    for y, row in enumerate(rows):
        assert len(row) == 14, (slot, y, len(row))
        for x, ch in enumerate(row):
            if ch != '.': g.set(x, y, pal[ch])
    if emblem and EMB[slot]:
        ex, ey, (r0, r1) = EMB[slot]
        for j, r in enumerate(emblem[r0:r1]):
            for i, c in enumerate(r):
                if c == '1': g.set(ex + i, ey + j, pal['w'])
    return g.outlined()

def build():
    sets = parse_sets()
    assert len(sets) == 20, len(sets)
    missing = [s[0] for s in sets if s[0] not in EMBLEMS]
    assert not missing, missing
    meta = {}
    def save(key, g):
        g.image().save(f'{OUT}/{key}.png')
        meta[key] = {'image': f'objects/{key}.png', 'frames': 1, 'pixelScale': 2, 'anchor': {'x': 0.5, 'y': 0.5}}
    for sid, name, color in sets:
        for slot in SLOTS: save(f'equip_{sid}_{slot}', render(slot, color, EMBLEMS[sid]))
    for slot in SLOTS: save(f'equip_generic_{slot}', render(slot, '#94a3b8', None))
    mp = os.path.join(ROOT, 'public', 'assets', 'sprites', 'manifest.json')
    m = json.load(open(mp)); m['version'] = 1; m.setdefault('objects', {}).update(meta)
    json.dump(m, open(mp, 'w'), indent=2); open(mp, 'a').write('\n')
    # vista previa: 20 sets x 4 ranuras
    S = 6; cell = 16 * S + 6
    sheet = Image.new('RGB', (4 * cell + 8, 20 * cell // 2 + 16), (52, 64, 110))
    for i, (sid, name, color) in enumerate(sets):
        col0 = (i % 2) * 4 * (cell // 2 + 0)
    sheet = Image.new('RGB', (8 * cell + 8, 10 * cell + 8), (52, 64, 110))
    for i, (sid, name, color) in enumerate(sets):
        ox = (i % 2) * 4 * cell + 4; oy = (i // 2) * cell + 4
        for j, slot in enumerate(SLOTS):
            im = Image.open(f'{OUT}/equip_{sid}_{slot}.png'); b = im.resize((im.width * S, im.height * S), Image.NEAREST)
            sheet.paste(b, (ox + j * cell, oy), b)
    sheet.save('/tmp/equip_preview.png'); print('ok', len(meta), 'piezas', sheet.size)

if __name__ == '__main__': build()
