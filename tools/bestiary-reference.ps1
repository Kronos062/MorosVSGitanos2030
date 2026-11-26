param(
  [Parameter(Mandatory=$true)][string]$Reference,
  [Parameter(Mandatory=$true)][string]$Output
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
public static class RivalPreview {
  public static void Export(Bitmap sheet, Rectangle cell, string path) {
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
        if(delta<24) continue;
        mask[x,y]=true;
        x0=Math.Min(x0,x); x1=Math.Max(x1,x); y0=Math.Min(y0,y); y1=Math.Max(y1,y);
      }
    }
    if (x1-x0 < 35 || y1-y0 < 65) throw new InvalidOperationException(path);
    var restored=(bool[,])mask.Clone();
    for(int y=y0; y<=y1; y++) for(int x=x0; x<=x1; x++) {
      if(mask[x,y]) continue;
      bool left=false,right=false,above=false,below=false;
      for(int d=1; d<=7; d++) {
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
    using(var result=new Bitmap(128,32)) {
      for(int f=0; f<4; f++) {
        int lift=f==1 || f==2 ? 1 : 0;
        for(int y=oy-lift; y<32; y++) for(int x=0; x<dw; x++) {
          int sx=x0+(int)((x+0.5)*sw/dw);
          int sy=y0+(int)((y-(oy-lift)+0.5)*sh/(dh+lift));
          if(restored[sx,sy]) result.SetPixel(f*32+ox+x,y,Color.FromArgb(255,pixels[sx,sy]));
        }
      }
      result.Save(path,ImageFormat.Png);
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
    [RivalPreview]::Export($image,[Drawing.Rectangle]::new($x,$y,$w,$h),(Join-Path $folder.FullName "$id.png"))
  }
} finally { $image.Dispose() }
