"""Validate and export Bombeta sprite strips without changing game mechanics."""
import argparse, json, shutil, subprocess
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'public/assets/sprites'
SPEC = json.loads((ROOT/'docs/manifest.tariq.example.json').read_text())['characters']['tariq']
DIRS = ('up','up_right','right','down_right','down')

def validate(folder):
    errors=[]
    for anim, cfg in SPEC['animations'].items():
        for direction in DIRS:
            name=f'tariq_{anim}_{direction}.png'
            p=folder/name
            try:
                with Image.open(p) as im:
                    if im.format!='PNG' or im.mode!='RGBA': raise ValueError('PNG RGBA requerido')
                    if im.size!=(24*cfg['frames'],32): raise ValueError(f'dimensiones {im.size} incorrectas')
                    for i in range(cfg['frames']):
                        alpha=im.crop((i*24,0,(i+1)*24,32)).getchannel('A')
                        bounds=alpha.getbbox()
                        if not bounds or alpha.getextrema()[0]!=0: raise ValueError(f'frame {i}: vacío o sin transparencia')
                        if bounds[3]!=32: raise ValueError(f'frame {i}: anclaje inferior incorrecto')
                        if set(alpha.getdata())-{0,255}: raise ValueError(f'frame {i}: alfa parcial')
            except (OSError,ValueError) as e: errors.append(f'{name}: {e}')
    return errors

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('folder',type=Path); p.add_argument('--export',action='store_true'); p.add_argument('--editor',default='libresprite')
    a=p.parse_args()
    if a.export:
        exe=shutil.which(a.editor)
        if not exe: p.error('LibreSprite no encontrado; indique --editor con su ruta')
        for anim in SPEC['animations']:
            for d in DIRS:
                stem=f'tariq_{anim}_{d}'
                subprocess.run([exe,'-b',str(a.folder/(stem+'.ase')), '--sheet',str(a.folder/(stem+'.png')),'--sheet-type','horizontal'],check=True)
    errors=validate(a.folder)
    print('\n'.join(errors) if errors else 'OK: 25 tiras, 120 frames')
    return bool(errors)
if __name__=='__main__': raise SystemExit(main())
