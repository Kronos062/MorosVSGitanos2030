from PIL import Image, ImageDraw
from pathlib import Path
import json, copy
from sprite_pipeline import BASE, SPEC, DIRS
# Independent costume silhouettes; original fictional designs.
CAST={
'bronce':('guard','#526b78','#d9ad65','#80583f'),
'rayo':('kid','#4b477a','#f6d46b','#b77f59'),
'hechicera_lola':('dress','#963d56','#f3b86a','#b77f59'),
'bailaor_furia':('runner','#34384c','#e84b9b','#a66e50'),
'patriarca':('elder','#59413d','#d6b66e','#a97c5d'),
'sombra':('cloak','#493b68','#a994e0','#b78361'),
'benghazi':('scout','#536c58','#e2c47c','#a87552'),
'ziryab':('medic','#d0d6c7','#43ad89','#b98560'),
'alhambra':('heavy','#485b70','#e39850','#98694c'),
}
O='#171923'
def frame(style,base,accent,skin,direction,anim,i):
 im=Image.new('RGBA',(24,32)); d=ImageDraw.Draw(im); back=direction.startswith('up'); side=direction=='right'; diagonal=direction.endswith('right'); x=1 if diagonal else 0; y=1 if anim in ('walk','idle') and i%2 else 0
 def p(points,c): d.polygon([(a+x,b+y) for a,b in points],fill=c)
 def r(a,b,c,e,f): d.rectangle((a+x,b+y,c+x,e+y),fill=f)
 kid=style=='kid'; heavy=style in ('heavy','guard'); long=style in ('dress','cloak','elder','medic'); top=15 if kid else 13
 # legs and shoes, alternate stride
 step=[0,2,1,0,-2,-1][i] if anim=='walk' else 0
 for a,s in [(7,max(0,step)),(13,max(0,-step))]:
  d.rectangle((a+x,24-s,a+3+x,30-s),fill=O); d.rectangle((a+x,25-s,a+2+x,28-s),fill=base); d.rectangle((a-1+x,30-s,a+3+x,31-s),fill=O)
 if long: p([(7,top),(16,top),(19,26),(18,29),(5,29),(4,26)],O); p([(8,top+1),(15,top+1),(17,27),(6,27)],base); p([(10,top+2),(12,top+2),(10,27),(8,27)],accent)
 else:
  w=3 if heavy else 5; p([(w,top+2),(8,top),(16,top),(23-w,top+2),(21-w,24),(16,26),(7,26),(w+1,24)],O); p([(w+1,top+3),(8,top+1),(16,top+1),(22-w,top+3),(16,24),(8,24)],base); r(8,22,15,23,accent)
 if heavy: r(3,16,6,21,accent); r(17,16,20,21,accent); r(9,16,14,20,accent)
 if style=='runner': p([(6,15),(9,14),(12,20),(9,23),(6,20)],accent)
 if style=='scout': p([(7,14),(9,14),(17,22),(15,24)],accent); r(16,19,19,24,base)
 if style=='medic': r(15,18,19,24,O); r(16,19,18,23,accent); r(17,18,17,20,'#ffffff')
 if style=='dress': p([(4,23),(8,25),(16,25),(20,23),(19,26),(5,26)],accent)
 if style=='elder': r(5,19,7,27,accent); r(4,27,5,30,O)
 # head and individual hair / headwear
 h=2 if kid else 3; p([(7,h),(15,h),(18,h+3),(18,12),(15,15),(8,15),(5,12),(5,h+3)],O)
 p([(7,h+1),(15,h+1),(17,h+4),(17,11),(14,14),(8,14),(6,11),(6,h+4)],base if back else skin)
 if style in ('cloak','scout','medic','heavy','guard'):
  p([(6,h+1),(15,h+1),(18,h+4),(17,h+6),(6,h+6)],base); r(7,h+3,16,h+4,accent)
  if style=='cloak': r(5,8,7,14,base); r(16,8,18,14,base)
 else:
  p([(6,h+1),(15,h+1),(17,h+3),(16,h+5),(10,h+4),(7,h+6),(6,h+5)],'#49312b' if style!='elder' else '#c4c0b5')
  if style=='dress': r(5,7,7,15,'#49312b'); r(16,7,18,15,'#49312b'); r(15,4,17,6,accent)
  if style=='runner': r(6,6,17,7,accent)
 if not back:
  for ex in ([15] if side else [9,14]): r(ex,9,ex,10,O)
  if style=='elder': p([(7,11),(16,11),(15,14),(11,16),(8,14)],'#c4c0b5')
  elif style=='cloak': r(8,11,16,13,base)
 if anim=='hurt' and i==1: im=Image.blend(im,Image.new('RGBA',im.size,(255,255,255,0)),0) # preserve alpha; recoil below
 if anim in ('roll','death'):
  angle=([0,55,115,180,270][i] if anim=='roll' else -min(90,i*22)); im=im.rotate(angle,Image.Resampling.NEAREST,expand=True); im.thumbnail((24,32),Image.Resampling.NEAREST)
 b=im.getbbox(); im=im.crop(b); out=Image.new('RGBA',(24,32)); out.paste(im,((24-im.width)//2,32-im.height)); return out

def main():
 m=BASE/'manifest.json'; data=json.loads(m.read_text()); preview=Image.new('RGBA',(24*10,32*5));
 for col,(id,design) in enumerate(CAST.items(),1):
  folder=BASE/'characters'/id; folder.mkdir(parents=True,exist_ok=True)
  for anim,cfg in SPEC['animations'].items():
   for j,direction in enumerate(DIRS):
    strip=Image.new('RGBA',(24*cfg['frames'],32))
    for i in range(cfg['frames']):
     f=frame(*design,direction,anim,i); assert f.getbbox()[3]==32 and f.getchannel('A').getextrema()==(0,255); strip.paste(f,(24*i,0))
    strip.save(folder/f'{id}_{anim}_{direction}.png')
    if anim=='idle': preview.paste(frame(*design,direction,anim,0),(24*col,32*j))
  head=frame(*design,'down','idle',0).crop((3,0,21,17)); portrait=Image.new('RGBA',(64,64)); portrait.paste(head.resize((54,51),Image.Resampling.NEAREST),(5,6)); portrait.save(BASE/'portraits'/f'{id}_portrait.png'); head.resize((16,16),Image.Resampling.NEAREST).save(BASE/'portraits'/f'{id}_icon.png')
  data['characters'][id]=copy.deepcopy(SPEC); data['characters'][id]['clip']=f'characters/{id}/{id}_{{anim}}_{{dir}}.png'; data['portraits'][id]={'portrait':f'portraits/{id}_portrait.png','icon':f'portraits/{id}_icon.png'}
 for j,direction in enumerate(DIRS): preview.paste(Image.open(BASE/'characters/tariq'/f'tariq_idle_{direction}.png').crop((0,0,24,32)),(0,32*j))
 m.write_text(json.dumps(data,indent=2,ensure_ascii=False)+'\n'); preview.resize((960,640),Image.Resampling.NEAREST).save('/mnt/data/Personajes_Fase04.png')
if __name__=='__main__': main()
