param(
  [Parameter(Mandatory=$true)][string]$Reference,
  [Parameter(Mandatory=$true)][string]$Output,
  [switch]$Gameplay
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
public static class RivalPreview {
  static Bitmap Extract(Bitmap sheet, Rectangle cell, string label) {
    int w = cell.Width, h = cell.Height;
    var pixels = new Color[w,h];
    var mask = new bool[w,h];
    int x0=w, x1=0, y0=h, y1=0;
    for (int y=0; y<h; y++) {
      Color a=sheet.GetPixel(cell.Left,cell.Top+y), b=sheet.GetPixel(cell.Right-1,cell.Top+y);
      for (int x=1; x<w-1; x++) {
        Color p=sheet.GetPixel(cell.Left+x,cell.Top+y);
        pixels[x,y]=p;
        double t=(double)x/(w-1);
        double delta=Math.Max(Math.Abs(p.R-(a.R+(b.R-a.R)*t)),Math.Max(
          Math.Abs(p.G-(a.G+(b.G-a.G)*t)),Math.Abs(p.B-(a.B+(b.B-a.B)*t))));
        if(delta<19) continue;
        mask[x,y]=true;
        x0=Math.Min(x0,x); x1=Math.Max(x1,x); y0=Math.Min(y0,y); y1=Math.Max(y1,y);
      }
    }
    if (x1-x0 < 35 || y1-y0 < 65) throw new InvalidOperationException(label);
    var restored=(bool[,])mask.Clone();
    for(int y=y0; y<=y1; y++) for(int x=x0; x<=x1; x++) {
      if(mask[x,y]) continue;
      bool left=false,right=false,above=false,below=false;
      for(int d=1; d<=17; d++) {
        left |= x-d>=x0 && mask[x-d,y];
        right |= x+d<=x1 && mask[x+d,y];
        above |= y-d>=y0 && mask[x,y-d];
        below |= y+d<=y1 && mask[x,y+d];
      }
      restored[x,y]=left && right && above && below;
    }
    int sw=x1-x0+1, sh=y1-y0+1;
    double scale=Math.Min(27.0/sw,29.0/sh);
    int dw=(int)Math.Round(sw*scale), dh=(int)Math.Round(sh*scale);
    int ox=(32-dw)/2, oy=32-dh;
    var result=new Bitmap(32,32);
    for(int y=0; y<dh; y++) for(int x=0; x<dw; x++) {
      int sx=x0+(int)((x+0.5)*sw/dw);
      int sy=y0+(int)((y+0.5)*sh/dh);
      if(restored[sx,sy]) result.SetPixel(ox+x,oy+y,Color.FromArgb(255,pixels[sx,sy]));
    }
    using(var sampled=(Bitmap)result.Clone()) {
      for(int y=0; y<32; y++) for(int x=0; x<32; x++) {
        if(sampled.GetPixel(x,y).A==0) continue;
        bool adjacent=false;
        for(int dy=-1;dy<=1;dy++) for(int dx=-1;dx<=1;dx++) {
          if((dx==0 && dy==0) || x+dx<0 || x+dx>=32 || y+dy<0 || y+dy>=32) continue;
          adjacent |= sampled.GetPixel(x+dx,y+dy).A!=0;
        }
        if(!adjacent) result.SetPixel(x,y,Color.Transparent);
      }
    }
    return result;
  }

  static void BlitPose(Bitmap pose, Bitmap strip, int frame, string action, int facing) {
    int[] stride = {0,1,2,0,-1,-2};
    int rollHeight = action=="roll" ? new[] {28,24,21,24,29}[frame] : 32;
    int fallAngle = action=="death" ? new[] {0,12,26,49,71,88}[frame] : 0;
    int rollLean = action=="roll" ? new[] {11,27,43,25,7}[frame] : 0;
    int recoil = action=="hurt" ? new[] {-1,-2,0}[frame] : 0;
    int breathing = action=="idle" && (frame==1 || frame==2) ? 1 : 0;
    int gait = action=="walk" ? stride[frame] : 0;
    double radians=(fallAngle+rollLean)*Math.PI/180;
    var points=new System.Collections.Generic.List<Tuple<int,int,Color>>();
    using(var sample=new Bitmap(32,32)) {
      for(int y=0; y<32; y++) for(int x=0; x<32; x++) {
        int foot=(x<16 ? gait : -gait);
        int sx=x;
        int sy=y;
        // Animate feet independently and shift the upper body less than the step.
        if(action=="walk" && y>=25) {
          sx-=facing*Math.Sign(foot);
          sy+=Math.Max(0,foot)*(y-24)/7;
        } else if(y<25) {
          sx-=recoil;
          sy+=breathing != 0 || Math.Abs(gait)==2 ? 1 : 0;
        }
        if(sx<0 || sx>=32 || sy<0 || sy>=32) continue;
        Color c=pose.GetPixel(sx,sy);
        if(c.A!=0) sample.SetPixel(x,y,c);
      }
      double cosine=Math.Cos(radians), sine=Math.Sin(radians)*facing;
      int yMax=-99, xMin=99, xMax=-99;
      for(int y=-22; y<54; y++) for(int x=-22; x<54; x++) {
        double dx=x-15.5, dy=y-21;
        int sx=(int)Math.Round(15.5+dx*cosine+dy*sine);
        int sy=(int)Math.Round(21+(-dx*sine+dy*cosine)*32/rollHeight);
        if(sx<0 || sx>=32 || sy<0 || sy>=32) continue;
        Color c=sample.GetPixel(sx,sy);
        if(c.A==0) continue;
        points.Add(Tuple.Create(x,y,c));
        yMax=Math.Max(yMax,y);
        xMin=Math.Min(xMin,x); xMax=Math.Max(xMax,x);
      }
      int offset = radians==0 ? 0 : (32-(xMax-xMin+1))/2-xMin;
      foreach(var p in points) {
        int y=p.Item2+31-yMax;
        int x=p.Item1+offset;
        if(x>=0 && x<32 && y>=0 && y<32)
          strip.SetPixel(frame*32+x,y,p.Item3);
      }
    }
  }

  public static void Export(Bitmap sheet, Rectangle cell, string path) {
    using(var pose=Extract(sheet,cell,path)) using(var strip=new Bitmap(128,32)) {
      for(int f=0;f<4;f++) BlitPose(pose,strip,f,"idle",1);
      strip.Save(path,ImageFormat.Png);
    }
  }

  public static void ExportCharacter(Bitmap sheet, Rectangle[] cells, string folder, string id, bool pallico) {
    System.IO.Directory.CreateDirectory(folder);
    string[] dirs={"down","down_right","right","up","up_right","left","down_left","up_left"};
    string[] actions={"idle","walk","roll","hurt","death"};
    int[] frames={4,6,5,3,6};
    using(var review=new Bitmap(24*64,cells.Length*70)) using(var graphics=Graphics.FromImage(review)) {
      graphics.Clear(Color.FromArgb(60,71,91));
      graphics.InterpolationMode=System.Drawing.Drawing2D.InterpolationMode.NearestNeighbor;
      graphics.PixelOffsetMode=System.Drawing.Drawing2D.PixelOffsetMode.Half;
      for(int dir=0;dir<cells.Length;dir++) {
        using(var pose=Extract(sheet,cells[dir],id+" "+dirs[dir])) {
          int col=0;
          for(int a=0;a<actions.Length;a++) {
            if(pallico && a>=2) break;
            using(var strip=new Bitmap(frames[a]*32,32)) {
              for(int f=0;f<frames[a];f++) {
                BlitPose(pose,strip,f,actions[a],dirs[dir].Contains("left") ? -1 : 1);
                graphics.DrawImage(strip,new Rectangle(col++*64,dir*70,64,64),
                  new Rectangle(f*32,0,32,32),GraphicsUnit.Pixel);
              }
              strip.Save(System.IO.Path.Combine(folder,id+"_"+actions[a]+"_"+dirs[dir]+".png"),ImageFormat.Png);
            }
          }
        }
      }
      review.Save(System.IO.Path.Combine(folder,id+"-review.png"),ImageFormat.Png);
    }
  }
}
'@
$folder = New-Item -ItemType Directory -Force $Output
$image = [Drawing.Bitmap]::new((Resolve-Path -LiteralPath $Reference).Path)
try {
  $cells = [ordered]@{
    rayo          = @(325,115,90,107)
    hechicera_lola= @(624,114,101,109)
    patriarca     = @(1243,115,96,109)
    sombra        = @(330,596,93,110)
    benghazi      = @(638,595,88,111)
    ziryab        = @(944,596,89,111)
    alhambra      = @(1244,595,91,113)
  }
  foreach($id in $cells.Keys){
    $x,$y,$w,$h=$cells[$id]
    if(!$Gameplay) {
      [RivalPreview]::Export($image,[Drawing.Rectangle]::new($x,$y,$w,$h),(Join-Path $folder.FullName "$id.png"))
      continue
    }
    $horizontal = switch ($id) {
      'alhambra' { @(1244,1340,1442) }
      'benghazi' { @(638,738,837) }
      'hechicera_lola' { @(624,722,829) }
      'patriarca' { @(1243,1339,1437) }
      'rayo' { @(325,422,519) }
      'sombra' { @(330,428,527) }
      'ziryab' { @(944,1044,1143) }
    }
    $back = if($y -lt 200){222}else{($y+112)}
    $rightEdge = @{alhambra=1523;benghazi=923;hechicera_lola=922;patriarca=1523;rayo=603;sombra=609;ziryab=1221}[$id]
    $rightWidth = [Math]::Min($w, $rightEdge - $horizontal[2])
    $windows = [Drawing.Rectangle[]]@(
      [Drawing.Rectangle]::new($horizontal[0],$y,$w,$h),
      [Drawing.Rectangle]::new($horizontal[1],$y,$w,$h),
      [Drawing.Rectangle]::new($horizontal[2],$y,$rightWidth,$h),
      [Drawing.Rectangle]::new($horizontal[1],$back,$w,$h),
      [Drawing.Rectangle]::new($horizontal[2],$back,$rightWidth,$h)
    )
    [RivalPreview]::ExportCharacter($image,$windows,(Join-Path $folder.FullName $id),$id,$false)
  }
  if($Gameplay) {
    $windows = [Drawing.Rectangle[]]@(
      [Drawing.Rectangle]::new(19,115,96,109), [Drawing.Rectangle]::new(115,115,96,109),
      [Drawing.Rectangle]::new(213,115,88,109), [Drawing.Rectangle]::new(115,222,96,105),
      [Drawing.Rectangle]::new(213,222,88,105), [Drawing.Rectangle]::new(19,324,96,108),
      [Drawing.Rectangle]::new(115,324,96,108), [Drawing.Rectangle]::new(19,222,96,105)
    )
    [RivalPreview]::ExportCharacter($image,$windows,(Join-Path $folder.FullName 'bronce'),'bronce',$true)
  }
} finally { $image.Dispose() }
