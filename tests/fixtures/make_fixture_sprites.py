"""Genera tiras SINTÉTICAS de diagnóstico para tests/e2e. NO son arte del juego.

Cada marca existe para que una prueba la detecte por color exacto:
  - color del bloque  -> animación (idle/walk/roll/hurt/death)
  - cuadrado 4x4 de color por dirección, a la IZQUIERDA del bloque (si aparece a la derecha, la tira se ha espejado)
  - píxel blanco en la fila superior, desplazado según el nº de frame
  - línea roja (255,0,0) en la última fila = punto de anclaje de los pies
"""
import json, os
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(__file__), 'sprites')
for d in ('characters/tariq', 'weapons', 'projectiles', 'effects', 'portraits'):
    os.makedirs(f'{OUT}/{d}', exist_ok=True)

WEAPON_ID = 'iron_python'   # baseId real del arma de Tariq (el motor resuelve startingWeapon -> getBaseWeapon().id)
FW, FH = 32, 40
ANIMS = {'idle': (4, 6, (70, 130, 200)), 'walk': (6, 10, (60, 170, 90)), 'roll': (5, 14, (220, 160, 40)),
         'hurt': (3, 10, (220, 70, 70)), 'death': (6, 8, (120, 120, 120))}
DIRS = ['up', 'up_right', 'right', 'down_right', 'down']
SWATCH = {'up': (0, 255, 255), 'up_right': (0, 255, 0), 'right': (255, 0, 255), 'down_right': (255, 255, 0), 'down': (255, 128, 0)}

for anim, (n, fps, col) in ANIMS.items():
    for d in DIRS:
        im = Image.new('RGBA', (FW * n, FH), (0, 0, 0, 0)); dr = ImageDraw.Draw(im)
        for f in range(n):
            ox = f * FW
            dr.rectangle([ox + 8, 8, ox + 23, FH - 4], fill=col + (255,))
            dr.rectangle([ox + 9, 10, ox + 12, 13], fill=SWATCH[d] + (255,))
            dr.point((ox + 4 + f * 3, 4), fill=(255, 255, 255, 255))
            dr.line([ox + FW // 2 - 3, FH - 1, ox + FW // 2 + 2, FH - 1], fill=(255, 0, 0, 255))
        im.save(f'{OUT}/characters/tariq/tariq_{anim}_{d}.png')

w = Image.new('RGBA', (20, 6), (0, 0, 0, 0)); d = ImageDraw.Draw(w)
d.rectangle([0, 1, 19, 4], fill=(200, 200, 210, 255)); d.rectangle([0, 0, 5, 5], fill=(90, 60, 30, 255)); w.save(f'{OUT}/weapons/{WEAPON_ID}.png')
p = Image.new('RGBA', (8, 4), (255, 240, 80, 255)); p.save(f'{OUT}/projectiles/{WEAPON_ID}.png')
e = Image.new('RGBA', (24 * 5, 24), (0, 0, 0, 0)); ed = ImageDraw.Draw(e)
for f in range(5): ed.rectangle([f * 24 + 9 - f, 9 - f, f * 24 + 14 + f, 14 + f], outline=(255, 140, 0, 255))
e.save(f'{OUT}/effects/explosion.png')
Image.new('RGBA', (64, 64), (40, 60, 120, 255)).save(f'{OUT}/portraits/tariq_portrait.png')
Image.new('RGBA', (16, 16), (40, 60, 120, 255)).save(f'{OUT}/portraits/tariq_icon.png')

json.dump({
    "version": 1,
    "characters": {"tariq": {
        "clip": "characters/tariq/tariq_{anim}_{dir}.png", "pixelScale": 2,
        "weaponSocket": {"right": {"x": 6, "y": -18}, "up": {"x": 4, "y": -20, "behind": True}},
        "animations": {a: {"frames": n, "fps": fps} for a, (n, fps, _) in ANIMS.items()}}},
    "weapons": {WEAPON_ID: {"image": f"weapons/{WEAPON_ID}.png", "grip": {"x": 2, "y": 3}}},
    "projectiles": {WEAPON_ID: {"image": f"projectiles/{WEAPON_ID}.png"}},
    "effects": {"explosion": {"image": "effects/explosion.png", "frames": 5, "fps": 14}},
    "portraits": {"tariq": {"portrait": "portraits/tariq_portrait.png", "icon": "portraits/tariq_icon.png"}},
}, open(f'{OUT}/manifest.json', 'w'), indent=1)
print('fixture generado en', OUT)
