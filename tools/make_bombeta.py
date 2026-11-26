from PIL import Image, ImageDraw
from pathlib import Path
import json, math
from sprite_pipeline import BASE, SPEC, DIRS, validate
O='#0b0d14'; W='#efe6cb'; L='#fff7e2'; G='#a4a4aa'; D='#626571'; S='#c99570'; T='#855c45'; C='#00f0ff'
def frame(direction, anim, i, n):
    im=Image.new('RGBA',(24,32)); d=ImageDraw.Draw(im)
    back=direction.startswith('up'); side=direction=='right'; diag=direction.endswith('right'); shift=2 if diag else 0
    bob=([0,1,0,0][i] if anim=='idle' else [0,1,0,1,0,1][i] if anim=='walk' else 0)
    y=bob; x=shift
    def poly(points,fill): d.polygon([(a+x,b+y) for a,b in points],fill=fill)
    # robe and sleeves, distinct folds
    poly([(8,14),(15,14),(19,19),(20,28),(17,30),(6,30),(4,27),(5,19)],O)
    poly([(8,15),(15,15),(17,20),(18,28),(6,28),(7,20)],W)
    poly([(8,17),(10,18),(9,27),(6,28),(7,20)],G)
    poly([(13,17),(14,17),(15,27),(13,28)],L)
    poly([(5,19),(7,18),(7,24),(5,25),(4,23)],G)
    poly([(16,18),(18,19),(19,23),(17,25),(16,23)],W)
    if not back: poly([(10,15),(13,15),(13,18),(11,19)],D)
    # head and woven scarf
    poly([(7,2),(15,2),(19,6),(19,13),(16,17),(7,17),(4,13),(4,6)],O)
    poly([(7,3),(15,3),(18,6),(17,9),(5,9),(5,6)],W)
    for a,b in [(7,4),(11,4),(15,4),(9,6),(13,6),(5,8),(17,8)]: poly([(a,b),(a+1,b),(a+1,b+1),(a,b+1)],D)
    if back:
        poly([(5,9),(17,9),(17,16),(7,16),(5,13)],G)
        for a,b in [(7,10),(11,10),(15,10),(9,12),(13,12),(7,14),(15,14)]: poly([(a,b),(a+1,b),(a+1,b+1),(a,b+1)],O)
    else:
        poly([(8 if side else 7,9),(17,9),(17,13),(14,15),(9,15),(7,13)],S)
        poly([(8,13),(10,14),(15,14),(14,15),(9,15)],T)
        for ex in ([15] if side else [10+shift//2,14+shift//2]): d.point((ex+x,11+y),fill=O); d.point((ex+x,12+y),fill=O)
        poly([(5,9),(7,9),(7,15),(5,14)],W)
        poly([(17,9),(18,9),(18,15),(16,16)],G)
    # Child proportions: enlarge head, shorten torso, preserve foot anchor.
    head=im.crop((0,0,24,18)); body=im.crop((0,18,24,29)); im=Image.new("RGBA",(24,32)); im.paste(head.resize((24,20),Image.Resampling.NEAREST),(0,0)); im.paste(body.resize((24,9),Image.Resampling.NEAREST),(0,20)); d=ImageDraw.Draw(im)
    # feet, anchored at bottom
    step=([0,1,2,0,-1,-2][i] if anim=='walk' else 0)
    d.rectangle((7+x,29-max(0,step),10+x,31-max(0,step)),fill=O)
    d.rectangle((13+x,29+min(0,step),16+x,31+min(0,step)),fill=O)
    if anim=='hurt' and i==1:
        im=im.transpose(Image.Transpose.FLIP_LEFT_RIGHT) if direction=='down' else im
    if anim=='roll':
        angle=[0,55,115,180,270][i]; im=im.rotate(angle,resample=Image.Resampling.NEAREST,expand=True); im.thumbnail((22,25),Image.Resampling.NEAREST)
    if anim=='death' and i>0:
        im=im.rotate(-min(90,i*22),resample=Image.Resampling.NEAREST,expand=True); im.thumbnail((24,32),Image.Resampling.NEAREST)
    b=im.getbbox(); im=im.crop(b); out=Image.new('RGBA',(24,32)); out.paste(im,((24-im.width)//2,32-im.height)); return out
folder=BASE/'characters/tariq'; folder.mkdir(parents=True,exist_ok=True)
for anim,cfg in SPEC['animations'].items():
    for direction in DIRS:
        strip=Image.new('RGBA',(24*cfg['frames'],32))
        for i in range(cfg['frames']): strip.paste(frame(direction,anim,i,cfg['frames']),(24*i,0))
        strip.save(folder/f'tariq_{anim}_{direction}.png')
assert not validate(folder),validate(folder)
p=BASE/'portraits'; p.mkdir(exist_ok=True)
head=frame('down','idle',0,4).crop((3,1,21,19)); portrait=Image.new('RGBA',(64,64)); portrait.paste(head.resize((54,54),Image.Resampling.NEAREST),(5,5)); portrait.save(p/'tariq_portrait.png'); head.resize((16,16),Image.Resampling.NEAREST).save(p/'tariq_icon.png')
m=BASE/'manifest.json'; data=json.loads(m.read_text()); example=json.loads((BASE.parents[2]/'docs/manifest.tariq.example.json').read_text());
for key in ('characters','portraits'): data.setdefault(key,{}).update(example[key])
m.write_text(json.dumps(data,indent=2,ensure_ascii=False)+'\n')
preview=Image.new('RGBA',(24*6,32*5));
for j,direction in enumerate(DIRS): preview.paste(Image.open(folder/f'tariq_walk_{direction}.png'),(0,j*32))
preview.resize((576,640),Image.Resampling.NEAREST).save('/mnt/data/Bombeta_preview.png')
