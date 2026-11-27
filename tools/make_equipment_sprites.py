"""Genera el pixel art de las cuatro piezas de cada conjunto de equipo."""
import os, re, sys
sys.path.insert(0, os.path.dirname(__file__))
from make_world_sprites import Grid, hx, ROOT

OUT = os.path.join(ROOT, 'public', 'assets', 'sprites', 'objects')
def mix(a, b, t): return tuple(int(round(a[i] * (1 - t) + b[i] * t)) for i in range(3))
# Siluetas de 14×14. Cada perfil cambia el corte de las cuatro piezas.
PROFILES = {
    'plate': {
        'helm': '....LLLL...... ...LMMMMm..... ..LMMMMMMm.... .LMLMMMMMMm... .MMMMMMMGMMm.. .MMMMDDDDMMm.. .MMMMDwDDMMm.. ..MMMDDDDMMm.. ..MMMMGMMMMm.. ..mMMMMMMMmm.. ...mmMMMMmm...',
        'chest': 'LLMm......mMLL LMMMMmmmmMMMMm MLLMMMMMMMMMMm MMMMMG..GMMMMm .MMMMMMMMMMmm. .MLMMMMMMMmmm. .MMMMMMMMMMmm. ..GMMDDMMMGm.. ..MMMMMMMMmm.. ...mMMMMMmm... ...SSSSSSSS...',
        'pants': '..LLSSSSSSmm.. ..MGMMMMMMGm.. ..MMMMMMMMmm.. .MMMMMMMMMMm.. .MMMMM.MMMMm.. .MLMMM.MMLMm.. .LGMMM.MGMMm.. .MMMMm.MMMmm.. .MMMMm.MMMmm.. .mMmmm.mMmmm.. .SSSSS.SSSSS..',
        'boots': '...LL....LL... ..LMMm..LMMm.. ..MGMM..MGMM.. ..MMMM..MMMM.. ..MLMm..MLMm.. .MMMMm.MMMMm.. .MMMGm.MMMGm.. LMMMMmLMMMMmm. MMMMMmMMMMMmm. mmmmmm.mmmmmm. SSSSSS.SSSSSS.',
    },
    'scout': {
        'helm': '.....LL....... ...LLMMMM..... ..LMLMMMMm.... ..MMMMMMMMm... .LMMMMMMMMmm.. .MMMMMMMMMMmm. .MMDwDDDDMMm.. .mMDDDDDDMm... ..MMMMMMMMm... ..mMMMMMMmm...',
        'chest': '...LM....ML... ..LMMmmmmMMm.. .LMMMLLLMMMMm. .MMMGMMMMGMMm. ..MMMMMMMMMm.. ..MLMSSMMMMm.. ..MMLMMMSSMm.. ..MMDGGDMMMm.. ..MMMMMMMMMm.. ...mmmmmmmm...',
        'pants': '..LDDDDDDDDm.. ..MMGGGGMMMm.. ..MMLMMMMMMm.. ..MMMMMMMMMm.. ..MMMm.MMMMm.. ..MMMM.MMMMm.. ..MMMM.MMMMm.. ..MLMm.MMLMm.. ..mMMm.MMMmm.. ...SS...SSS...',
        'boots': '...LM....LM... ...MMm...MMm.. ...MGm...MGm.. ...MMm...MMm.. ..LMMm..LMMm.. ..MMMM..MMMM.. .LMMMM.LMMMM.. .MMMMm.MMMMmm. .SSSSS.SSSSSS.',
    },
    'rig': {
        'helm': '.......L...... ......LM...... ...LLLMMmm.... ..LMMMMMMMm... .LMMDDDDMMM... .MMDwGwDDMMm.. .MMDGGGDDMMm.. .MMDDDDDDMMm.. .mMMLMLMMMMm.. ..mmmmmmmmm...',
        'chest': '.Sm........mS. LMMm......mMML LMMMMmmmmMMMMm MGMMMMGGMGMMGm .MLDDDDDDDMm.. .MMDGwGGDDMm.. .MMDGGGGDDMm.. .MMDDDDDDDMm.. .MMMMMMMMMMm.. .mMGmmmmGMmm.. ..SSSSSSSSS...',
        'pants': '...LMMMMMMm... ..MMGGGGMMMm.. .LMMMMMMMMMm.. .MLMMMMMLMMm.. .MLMMm.MLMMm.. .MGGMm.MGGMm.. .MDDMm.MDDMm.. .MMMMm.MMMMm.. .MLMMm.MLMMm.. .mmmmm.mmmmm.. ..SSSS.SSSS...',
        'boots': '..LLL...LLL... ..MMm...MMm... ..MGm...MGm... ..MDm...MDm... ..MLM...MLM... ..MMM...MMM... .LMMMM.LMMMM.. MMMMMmMMMMMm.. MGMMMmMGMMMm.. SSSSSSSSSSSS..',
    },
    'woven': {
        'helm': '......L....... ....LLLM...... ...LLMMMMm.... ..LMLMMMMMm... .LMMMMMMMMMm.. .MMMGDDDGMMm.. .MMDwDDDDMMm.. .MMDDDDDDMMm.. ..MMDDDDMMm... ..MMMmmMMmm... ...mm...mm....',
        'chest': '.LMm......mML. LMMLMmmmmMLMMm MMMMLGGLMMMMMm .MMMLMMGMMMMm. .MMMMLMGMMMMm. ..MMMMLMMMm... ..MMMMMLMMm... ..MMMGGGMMm... ..MMMMMMMMm... .MMMMMMMMMMm.. .mmmm..mmmm...',
        'pants': '..GDDDDDDDDG.. .LMMMMMMMMMMm. .MMMMMMMMMMMm. .MLMMMMMLMMMm. ..MMMm.MMMMm.. ..MMMM.MMMMm.. ..MLMm.MMLMm.. ..MMMM.MMMMm.. ..MMMM.MMMMm.. ..mmMm.MMmmm.. ..SSSS.SSSSS..',
        'boots': '...LL....LL... ...MM....MM... ..LMm...LMm... ..MGm...MGm... ..MMm...MMm... ..MGM...MGM... ..MMMM..MMMM.. .LMMMM.LMMMM.. .MMMMm.MMMMmm. .SSSSS.SSSSSS.',
    },
}

# Base y herrajes propios de cada conjunto, incluso cuando comparten color de habilidad.
STYLES = {
    'set_berserker': ('plate', '#813d2d', '#d28b51'),
    'set_sniper': ('scout', '#435664', '#8fbec6'),
    'set_asesino': ('woven', '#353047', '#ae649a'),
    'set_tank': ('plate', '#354e6b', '#8fa8c2'),
    'set_vampiro': ('woven', '#55283b', '#d6a5a1'),
    'set_ingeniero': ('rig', '#565b58', '#d1b153'),
    'set_piromano': ('rig', '#70443a', '#f49352'),
    'set_criomante': ('woven', '#526a82', '#bde6e5'),
    'set_electricista': ('rig', '#273e53', '#81def4'),
    'set_toxicologo': ('rig', '#3d5039', '#9bcc54'),
    'set_explorador': ('scout', '#3f644d', '#b4d27c'),
    'set_artillero': ('plate', '#705139', '#deaa54'),
    'set_comando': ('scout', '#314337', '#96aa75'),
    'set_fanatico': ('plate', '#674358', '#e89bba'),
    'set_mercenario': ('scout', '#6a4a38', '#cf9957'),
    'set_medico': ('rig', '#748481', '#a8dbb5'),
    'set_cazador': ('scout', '#415d68', '#6ebdc5'),
    'set_tecnomante': ('rig', '#3c405b', '#66c4db'),
    'set_caotico': ('woven', '#5e426f', '#ca91e2'),
    'set_cuantico': ('plate', '#345c6e', '#83dde1'),
}

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

def render(slot, profile, base, trim, emblem):
    metal, detail = hx(base), hx(trim)
    palette = {
        'M': metal, 'm': mix(metal, (17, 21, 29), .55),
        'L': mix(metal, (245, 235, 220), .43), 'D': (34, 42, 50),
        'S': mix(metal, (24, 28, 33), .72), 'G': detail,
        'w': mix(detail, (255, 255, 239), .6),
    }
    rows = PROFILES[profile][slot].split()
    g = Grid(16, 16)
    y0 = (16 - len(rows)) // 2
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch != '.':
                g.set(x + 1, y + y0, palette[ch])
    if emblem and slot == 'chest':
        for y, row in enumerate(emblem):
            for x, mark in enumerate(row):
                if mark == '1' and (x + 6, y + 5) in g.p:
                    g.set(x + 6, y + 5, detail)
    outlined = g.outlined()
    # Pad all slots identically so a mixed set stays aligned on the inventory grid.
    result = Grid(18, 18)
    result.p.update(outlined.p)
    return result


def build():
    sets = parse_sets()
    missing = [sid for sid, _, _ in sets if sid not in STYLES or sid not in EMBLEMS]
    if missing:
        raise ValueError(f'Conjuntos sin diseño: {missing}')
    for sid, _, _ in sets:
        profile, base, trim = STYLES[sid]
        for slot in PROFILES[profile]:
            render(slot, profile, base, trim, EMBLEMS[sid]).image().save(f'{OUT}/equip_{sid}_{slot}.png')
    for slot in PROFILES['scout']:
        render(slot, 'scout', '#566575', '#a1b1be', None).image().save(f'{OUT}/equip_generic_{slot}.png')
    print('ok', len(sets) * 4 + 4, 'piezas de equipo')


if __name__ == '__main__':
    build()
