"""Genera los iconos pixel art de la interfaz (16x16, contorno automático, paleta compartida).
Uso: python3 tools/make_ui_icons.py  -> escribe src/ui/iconData.ts y /tmp/icons_preview.png
Cada icono se dibuja en 14x14 y se le añade un contorno de 1 px => 16x16."""
import json, os
from PIL import Image

PAL = {'k':'#151a30','w':'#fff4d6','y':'#fff09a','g':'#ffd24a','G':'#c8901c','o':'#ff9a3a','r':'#f0583a','R':'#a82c1c',
       's':'#c3cbe8','S':'#7480b0','b':'#4a8fe8','B':'#2a5ab0','c':'#7fd8ff','C':'#3aa0d8','n':'#b9773f','N':'#6b3f22',
       'p':'#a77bff','P':'#6a43c8','e':'#5ee0a0','E':'#2a9a64','l':'#f2c9a0','d':'#8a93b8'}
N = 14
class C:
    def __init__(s): s.g=[['.']*N for _ in range(N)]
    def p(s,x,y,c):
        if 0<=x<N and 0<=y<N: s.g[y][x]=c
    def rect(s,x,y,w,h,c):
        for j in range(h):
            for i in range(w): s.p(x+i,y+j,c)
    def line(s,x0,y0,x1,y1,c):
        dx,dy=abs(x1-x0),abs(y1-y0); sx=1 if x0<x1 else -1; sy=1 if y0<y1 else -1; e=dx-dy
        while True:
            s.p(x0,y0,c)
            if x0==x1 and y0==y1: break
            e2=2*e
            if e2>-dy: e-=dy; x0+=sx
            if e2<dx: e+=dx; y0+=sy
    def disc(s,cx,cy,r,c):
        for y in range(N):
            for x in range(N):
                if (x-cx)**2+(y-cy)**2<=r*r: s.p(x,y,c)
    def art(s,rows,ox=0,oy=0):
        for j,row in enumerate(rows):
            for i,ch in enumerate(row):
                if ch!='.': s.p(ox+i,oy+j,ch)
    def out(s):
        o=[['.']*16 for _ in range(16)]
        for y in range(N):
            for x in range(N):
                if s.g[y][x]!='.': o[y+1][x+1]=s.g[y][x]
        res=[r[:] for r in o]
        for y in range(16):
            for x in range(16):
                if o[y][x]=='.':
                    for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
                        xx,yy=x+dx,y+dy
                        if 0<=xx<16 and 0<=yy<16 and o[yy][xx]!='.': res[y][x]='k'; break
        return [''.join(r) for r in res]
I={}
def icon(name):
    def deco(f):
        c=C(); f(c); I[name]=c.out(); return f
    return deco

@icon('sword')
def _(c):
    for t in range(8): c.p(11-t,1+t,'w'); c.p(10-t,1+t,'s'); c.p(11-t,2+t,'S')
    c.line(2,8,6,12,'g'); c.line(3,8,6,11,'G'); c.line(2,11,1,12,'n'); c.line(3,11,1,13,'n'); c.p(0,13,'g'); c.p(1,13,'g')
@icon('shield')
def _(c):
    c.art(['sssssssssss','sbbbbbwbbbBs','sbbbbwbbbbBs','sbbbwwbbbbBs','sbbbwbbbbBBs','sbbbbbbbbBBs','.sbbbbbbBBs.','..sbbbbBBs..','...sbbBBs...','....sBBs....','.....ss.....'],1,1)
@icon('coin')
def _(c):
    c.disc(6.5,6.5,5.6,'g'); c.disc(6.5,6.5,4.2,'G'); c.disc(6.2,6.2,3.6,'g')
    c.rect(6,4,2,6,'G'); c.p(3,3,'y'); c.p(4,2,'y'); c.p(3,4,'y')
@icon('heart')
def _(c):
    c.art(['.rrr....rrr.','rrwrr..rrrrr','rwrrrrrrrrrr','rrrrrrrrrrrr','rrrrrrrrrrrR','.rrrrrrrrrR.','..rrrrrrrR..','...rrrrrR...','....rrrR....','.....rR.....'],1,2)
@icon('bolt')
def _(c):
    c.art(['....yyy.','...yggg.','..yggg..','.yggg...','yggggggg','.gggggg.','...ggG..','..ggG...','..gG....','.gG.....'],3,2)
@icon('flame')
def _(c):
    c.art(['.....o.....','....oo.....','...ooro....','...orro.o..','..orrro.oo.','.orryrrooo.','.orryyrrro.','.orryyyrro.','.orryyyyro.','..orrryrro.','...orrrro..','....oooo...'],1,1)
@icon('skull')
def _(c):
    c.art(['..wwwwwwww..','.wwwwwwwwww.','wwwwwwwwwwww','wwkkwwwwkkww','wwkkwwwwkkww','wwwwwwwwwwww','.wwwwkkwwww.','..wwwwwwwS..','..wSwwSwwS..','..wSwwSwwS..','...SSSSSS...'],1,2)
@icon('boot')
def _(c):
    c.art(['...nnnn...','...nnnn...','...nwnn...','...nnnn...','...nnnn...','...nnnn...','...nnnnnnn.','..nnnnnnnnn','.nnnnnnnnnn','.NNNNNNNNNN','.SSSSSSSSSS'],2,2)
@icon('target')
def _(c):
    c.disc(6.5,6.5,5.8,'r'); c.disc(6.5,6.5,4.2,'w'); c.disc(6.5,6.5,3.0,'r'); c.disc(6.5,6.5,1.4,'w')
    c.line(6,0,6,13,'k') if False else None
@icon('drop')
def _(c):
    c.art(['.....r.....','....rrr....','....rrr....','...rrrrr...','..rrwrrrr..','..rwrrrrr..','.rrwrrrrrr.','.rrrrrrrrR.','.rrrrrrrrR.','..rrrrrrR..','...RRRRR...'],1,1)
@icon('syringe')
def _(c):
    c.line(2,11,6,7,'c'); c.line(3,11,7,7,'C'); c.rect(7,3,2,2,'S')
    c.line(8,6,11,3,'s'); c.line(8,7,11,4,'S'); c.line(10,2,12,4,'d'); c.line(0,13,2,11,'w')
    c.line(5,8,8,5,'w')
@icon('spark')
def _(c):
    c.art(['......y......','......y......','.....ygy.....','.....ygy.....','....yygyy....','yyyygggggyyyy','....yygyy....','.....ygy.....','.....ygy.....','......y......','......y......'],0,1)
@icon('wind')
def _(c):
    c.art(['...cccccc....','..cwwwwwcc...','.....wwwcc...','cccccwcc.cc..','wwwwwwwc..cc.','cccccwwc.cc..','.....wwcccc..','..cwwwwwc....','...cccccc....'],0,2)
@icon('robot')
def _(c):
    c.art(['......r.....','......S.....','.sssssssssss','.sbbbbbbbbbS','.sbcbbbbcbbS','.sbbbbbbbbbS','.ssssssssssS','.sS.kkkk.SsS','.ssssssssssS','..SSSSSSSSS.'],0,2)
@icon('vest')
def _(c):
    c.art(['bb......bb','bbb.ssss.bb','bbbbsbbsbbb','bbbbbbbbbbb','.bbbwbbbbB.','.bbbwbbbbB.','.bbbbbbbbB.','.bbbbbbbBB.','.BBBBBBBBB.'],1,2)
@icon('helmet')
def _(c):
    c.art(['...ssssss...','.ssswwsssss.','sswsssssssss','ssssssssssss','sSSSSSSSSSSS','sSkkkkkkkkSS','sSSSSSSSSSSS','.SS......SS.'],1,3)
@icon('pants')
def _(c):
    c.art(['bbbbbbbbbbbb','bBBBBBBBBBBb','bbbbbbbbbbbb','bbbbbBBbbbbb','bbbbb..bbbbb','bbbbb..bbbbb','bbbbb..bbbbb','bbbbb..bbbbb','BBBBB..BBBBB'],1,2)
@icon('check')
def _(c):
    c.art(['.........ee','........eee','.......eee.','ee....eee..','eee..eee...','.eeeeee....','..eeee.....','...ee......'],1,3)
@icon('cross')
def _(c):
    for t in range(9): c.p(2+t,2+t,'r'); c.p(3+t,2+t,'r'); c.p(10-t,2+t,'r'); c.p(11-t,2+t,'r')
@icon('box')
def _(c):
    c.art(['nnnnnnnnnnnn','nwnnnnnnnnnn','nnnnggggnnnn','nnnnggggnnnn','NNNNggggNNNN','nnnnggggnnnn','nnnnggggnnnn','NNNNNNNNNNNN'],1,3)
@icon('warn')
def _(c):
    c.art(['......gg......','.....gggg.....','.....gkkg.....'[:14],'....ggkkgg....','....ggkkgg....','...gggkkggg...','...ggggggGg...','..gggggkkGgg..','..ggggggGGgg..','.gggggggGGGgg.','.GGGGGGGGGGGG.'],0,1)
@icon('vortex')
def _(c):
    c.art(['....pppppp....','..pppccccppp..','.ppcc....ccpp.','ppc..pppp..cpp','pc..pcccpp..cp','pc.pc..cpp.cp.','pc.pc.pc.p.pc.','pcc.pcc.pc.cp.','.pcc..ppc..cp.','..pcc....ccp..','...pppcccppp..','.....pppp.....'],0,1)
@icon('city')
def _(c):
    c.art(['.....ss.....','..bb.sSs.bb.','..bB.sSs.bB.','.bbBbbSsbbBb','.bwBbbSsbwBb','.bbBbbSsbbBb','.bwBbbSwbbBb','.bbBbbSsbbBb','.bbBbbSsbbBb'],1,3)
@icon('boom')
def _(c):
    c.art(['.....o.....','.o...o...o.','..o.ooo.o..','...ooyyoo..','oooyyyyyooo','.ooyyyyyoo.','oooyyyyyooo','...ooyyoo..','..o.ooo.o..','.o...o...o.','.....o.....'],1,2)
@icon('lock')
def _(c):
    c.art(['..SSSSSS..','.SS....SS.','.S......S.','.S......S.','gggggggggg','gGGGGGGGGg','gGGGkkGGGg','gGGGkkGGGg','gGGGGGGGGg','gggggggggg'],2,2)
@icon('clock')
def _(c):
    c.disc(6.5,6.5,5.8,'s'); c.disc(6.5,6.5,4.6,'w'); c.line(6,6,6,2,'k'); c.line(6,6,9,7,'k'); c.p(6,6,'k')
@icon('potion')
def _(c):
    c.art(['..ssss..','..swws..','...ss...','...ss...','..eeee..','.eewwee.','eeeeeeee','eeeeeeEE','eeeeeEEE','.EEEEEE.'],3,2)
@icon('bow')
def _(c):
    c.art(['nn.........','.nn......w.','..nn....w..','...nn..w...','...n.nw....','...n.wn....','...nw.n....','...n.nn.s..','..nn..nnss.','.nn....nns.','nn......ss.'],1,1)
@icon('gun')
def _(c):
    c.art(['..ssssssssss','..sSSSSSSSSS','..sSSSSSSSSd','sSSSSSSSsss.','nnSS.nn.....','nnn..nn.....','nn...nn.....','nn.........'],0,3)
@icon('monster')
def _(c):
    c.art(['r.........r.','rr.......rr.','.rr.....rr..','..rrrrrrrr..','.rrrrrrrrrr.','.rwkrrrrkwr.','.rrrrrrrrrr.','.rrwwrrwwrr.','..rwwwwwwr..','...rrrrrr...'],1,2)
@icon('snow')
def _(c):
    c.art(['.....c.....','..c..c..c..','...c.c.c...','....ccc....','ccccwwwcccc','....ccc....','...c.c.c...','..c..c..c..','.....c.....'],1,2)
@icon('trophy')
def _(c):
    c.art(['gggggggggg','gwGGGGGGGg','gwGGGGGGGg','.gGGGGGGg.','..gGGGGg..','...gGGg...','....gg....','....gg....','..gggggg...'[:10],'..GGGGGG..'],2,2)
@icon('speaker')
def _(c):
    c.art(['...ss.....','..sss..s..','sssss.s.s.','sssss..s.s','sssss.s.s.','..sss..s...','...ss.....'],1,3)
@icon('clip')
def _(c):
    c.art(['..SSSS..','nnSwwSnn','nwwwwwwn','nwkkkkwn','nwwwwwwn','nwkkkkwn','nwwwwwwn','nwkkkwwn','nnnnnnnn'],3,2)
@icon('star')
def _(c):
    c.art(['.....yy.....','.....yy.....','....yggy....','yyyyyggyyyyy','.yggggggggy.','..yggggggy..','...ggggGg...','..gggGGggg..','..ggG..Ggg..','.gG......Gg.'],1,2)
@icon('gear')
def _(c):
    c.disc(6.5,6.5,5.6,'S'); c.disc(6.5,6.5,4.4,'s')
    for a in ((6,0),(6,12),(0,6),(12,6)): c.rect(a[0],a[1],2,2,'S')
    c.disc(6.5,6.5,2.0,'k'); c.disc(6.5,6.5,1.2,'d')
@icon('ghost')
def _(c):
    c.art(['..wwwwww..','.wwwwwwww.','wwkkwwkkww','wwkkwwkkww','wwwwwwwwww','wwwwwwwwww','wwwwwwwwww','ww.ww.ww.w','w..w..w..w'],2,2)
@icon('pet')
def _(c):
    c.art(['nn......nn','nnn....nnn','nnnnnnnnnn','nwknnnnkwn','nnnnnnnnnn','nnnnllnnnn','.nnnlknnn.','..nnnnnn..'],2,3)
@icon('eye')
def _(c):
    c.art(['..wwwwwwww..','.wwwbbbbwww.','wwwbbkkbbwww','.wwwbbbbwww.','..wwwwwwww..'],1,4)
@icon('wrench')
def _(c):
    c.line(3,10,10,3,'S'); c.line(4,10,11,3,'s'); c.disc(10.5,3.5,2.6,'s'); c.disc(11,3,1.2,'k'); c.rect(1,10,3,3,'S')
@icon('bomb')
def _(c):
    c.disc(6.5,8,4.6,'S'); c.disc(6,7.5,3.6,'d'); c.p(4,6,'w'); c.p(5,5,'w')
    c.line(8,4,10,2,'n'); c.p(11,1,'o'); c.p(10,1,'y'); c.p(12,2,'y')
@icon('chip')
def _(c):
    c.rect(3,3,8,8,'E'); c.rect(4,4,6,6,'e'); c.rect(6,6,2,2,'k')
    for i in (4,6,8): c.p(i,1,'s'); c.p(i,2,'s'); c.p(i,11,'s'); c.p(i,12,'s'); c.p(1,i,'s'); c.p(2,i,'s'); c.p(11,i,'s'); c.p(12,i,'s')
@icon('phone')
def _(c):
    c.rect(3,0,8,14,'S'); c.rect(4,1,6,10,'c'); c.rect(6,12,2,1,'s'); c.p(5,2,'w'); c.p(5,3,'w')
@icon('ring')
def _(c):
    c.disc(6.5,8,4.2,'g'); c.disc(6.5,8,2.6,'.'); c.rect(5,1,4,3,'c'); c.p(5,1,'w')

# ---- revisiones tras la primera vista previa ----
@icon('syringe')
def _(c):
    c.art(['d..sssssss....','dddsccwcccssss','d..sccccccS...','d..SSSSSSS....'],0,5)
@icon('wind')
def _(c):
    c.art(['..cccccc......','wwwwwwwwcc....','..........cc..','cccccccwwwwc..','............c.','..wwwwwwwcc...','cccccccccc....'],0,3)
@icon('helmet')
def _(c):
    c.art(['....rrrr....','...ssssss...','..swwssssss.','.swsssssssss','.ssssssssssS','.sSSSSSSSSSS','.sSkkkkkkkSS','.sSSSSSSSSSS','.ss......ssS'],0,2)
@icon('bow')
def _(c):
    for (x,y) in [(6,0),(5,1),(4,2),(3,3),(3,4),(3,5),(3,6),(3,7),(3,8),(3,9),(4,10),(5,11),(6,12)]: c.p(x,y,'n')
    c.line(6,0,6,12,'w'); c.line(2,6,12,6,'S'); c.p(13,6,'s'); c.p(12,5,'s'); c.p(12,7,'s'); c.p(2,5,'r'); c.p(2,7,'r'); c.p(1,6,'r')
@icon('speaker')
def _(c):
    c.art(['...ss.........','..sss...c.....','ssss.....c....','ssss..c...c...','ssss.....c....','..sss...c.....','...ss.........'],0,3)
@icon('gear')
def _(c):
    c.disc(6.5,6.5,4.6,'S'); c.disc(6.5,6.5,3.6,'s')
    for a in ((6,0),(6,12),(0,6),(12,6),(2,2),(10,2),(2,10),(10,10)): c.rect(a[0],a[1],2,2,'S')
    c.disc(6.5,6.5,1.7,'k')
@icon('city')
def _(c):
    c.art(['.......ss.....','.......sS.....','..bb...sS..bb.','..bw...yS..bB.','..bb.sSsyS.bb.','..by.sSsSS.by.','..bb.sSysS.bb.','..bb.sSsSS.bb.','..bB.sSsyS.bB.','.bbbbsSsSSbbbb'],0,2)

if __name__=='__main__':
    for k,v in I.items():
        assert len(v)==16 and all(len(r)==16 for r in v),k
    out=os.path.join(os.path.dirname(__file__),'..','src','ui','iconData.ts')
    os.makedirs(os.path.dirname(out),exist_ok=True)
    with open(out,'w') as f:
        f.write('// GENERADO por tools/make_ui_icons.py — no editar a mano.\n')
        f.write('export const ICON_PALETTE: Record<string, string> = '+json.dumps(PAL)+';\n')
        f.write('export const ICON_BITMAPS: Record<string, string[]> = '+json.dumps(I,indent=1)+';\n')
    S=8; cols=10; rows=(len(I)+cols-1)//cols
    sheet=Image.new('RGB',(cols*(16*S+8)+8,rows*(16*S+8)+8),(52,64,110))
    for n,(k,v) in enumerate(I.items()):
        ox=8+(n%cols)*(16*S+8); oy=8+(n//cols)*(16*S+8)
        for y,row in enumerate(v):
            for x,ch in enumerate(row):
                if ch!='.':
                    col=tuple(int(PAL[ch][i:i+2],16) for i in (1,3,5))
                    for dy in range(S):
                        for dx in range(S): sheet.putpixel((ox+x*S+dx,oy+y*S+dy),col)
    sheet.save('/tmp/icons_preview.png'); print(len(I),'iconos',list(I))
