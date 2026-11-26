param(
  [Parameter(Mandatory=$true)][string]$ReferenceDirectory,
  [Parameter(Mandatory=$true)][string]$OutputDirectory
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Collections.Generic;
using System.IO;

public static class ApprovedCast {
  static readonly string[] Directions = {"down","down_right","right","up_right","up","up_left","left","down_left"};
  static readonly string[] Actions = {"idle","walk","roll","hurt","death"};
  static readonly int[] Milliseconds = {167,100,71,100,125};
  const int Size = 32;

  public static void Rebuild(string path, string output, string id, int[] rows, int[][] centers, int[] edges, double scale) {
    Directory.CreateDirectory(output);
    using (var sheet = new Bitmap(path)) {
      if (sheet.Width != 1536 || sheet.Height != 1024) throw new InvalidDataException(path);
      using (var review = new Bitmap(24 * 64, 8 * 70)) {
        using (var graphics = Graphics.FromImage(review)) {
          graphics.Clear(Color.FromArgb(68,79,94));
          graphics.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.NearestNeighbor;
          graphics.PixelOffsetMode = System.Drawing.Drawing2D.PixelOffsetMode.Half;
          for (int dir = 0; dir < Directions.Length; dir++) {
            int column = 0;
            for (int act = 0; act < Actions.Length; act++) {
              int[] spots = centers[act];
              var frames = new List<Bitmap>();
              using (var strip = new Bitmap(Size * spots.Length, Size)) {
                using (var draw = Graphics.FromImage(strip)) {
                  draw.CompositingMode = System.Drawing.Drawing2D.CompositingMode.SourceCopy;
                  for (int frame = 0; frame < spots.Length; frame++) {
                    int left = frame == 0 ? edges[act] : (spots[frame - 1] + spots[frame]) / 2;
                    int right = frame == spots.Length - 1 ? edges[act + 1] : (spots[frame] + spots[frame + 1]) / 2;
                    Bitmap pose = RestorePose(sheet, left, rows[dir], right, rows[dir + 1], scale);
                    frames.Add(pose);
                    draw.DrawImageUnscaled(pose, frame * Size, 0);
                    graphics.DrawImage(pose, column++ * 64, dir * 70, 64, 64);
                  }
                }
                string stem = id + "_" + Actions[act] + "_" + Directions[dir];
                strip.Save(Path.Combine(output, stem + ".png"), ImageFormat.Png);
                WriteEditable(Path.Combine(output, stem + ".ase"), frames, Milliseconds[act]);
              }
              foreach (Bitmap frame in frames) frame.Dispose();
            }
          }
        }
        review.Save(Path.Combine(output, id + "_review.png"), ImageFormat.Png);
      }
    }
  }

  static Bitmap RestorePose(Bitmap sheet, int left, int top, int right, int bottom, double scale) {
    // Keep the complete pose inside its hand-mapped cell. Trim layout lines,
    // then reconstruct the perimeter from the body and enclosed dark pixels.
    left += 4; right -= 5; top += 3; bottom -= 4;
    int w = right - left, h = bottom - top;
    var pixels = new Color[w,h];
    var visible = new bool[w,h];
    for (int y = 0; y < h; y++) {
      for (int x = 0; x < w; x++) {
        Color c = sheet.GetPixel(left + x, top + y);
        pixels[x,y] = c;
        if (Math.Max(c.R, Math.Max(c.G,c.B)) < 65 || c.A < 120) continue;
        visible[x,y] = true;
      }
    }
    int x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (int y = 0; y < h; y++) for (int x = 0; x < w; x++) {
      if (!visible[x,y]) continue;
      x0 = Math.Min(x0,x); x1 = Math.Max(x1,x);
      y0 = Math.Min(y0,y); y1 = Math.Max(y1,y);
    }
    if (x1 - x0 < 10 || y1 - y0 < 7) throw new InvalidDataException("Unusable pose at " + left + "," + top);
    // Recover dark fabric and contours immediately adjacent to foreground.
    // Fill enclosed dark details rather than discarding disconnected body parts.
    var mask = (bool[,])visible.Clone();
    for (int y = y0; y <= y1; y++) {
      for (int x = x0; x <= x1; x++) {
        if (visible[x,y]) continue;
        bool leftSide = false, rightSide = false, above = false, below = false;
        for (int d = 1; d <= 5; d++) {
          leftSide |= x-d >= x0 && visible[x-d,y];
          rightSide |= x+d <= x1 && visible[x+d,y];
          above |= y-d >= y0 && visible[x,y-d];
          below |= y+d <= y1 && visible[x,y+d];
        }
        Color c = pixels[x,y];
        mask[x,y] = (leftSide && rightSide && above && below) ||
          ((leftSide || rightSide) && (above || below) && Math.Max(c.R, Math.Max(c.G,c.B)) >= 37);
      }
    }
    int dw = Math.Min(Size-2, (int)Math.Round((x1-x0+1)*scale));
    int dh = Math.Min(Size-1, (int)Math.Round((y1-y0+1)*scale));
    var result = new Bitmap(Size,Size);
    int dx = (Size-dw)/2, dy = Size-dh;
    for (int y=0; y<dh; y++) {
      for (int x=0; x<dw; x++) {
        int sx = x0 + (int)((x+0.5)*(x1-x0+1)/dw);
        int sy = y0 + (int)((y+0.5)*(y1-y0+1)/dh);
        if (mask[sx,sy]) result.SetPixel(dx+x,dy+y,Color.FromArgb(255,pixels[sx,sy]));
      }
    }
    // Paint a native-pixel outline wherever resampling removed the dark edge.
    using (var core = (Bitmap)result.Clone()) {
      for (int y=0; y<Size; y++) {
        for (int x=0; x<Size; x++) {
          if (core.GetPixel(x,y).A != 0) continue;
          if ((x>0 && core.GetPixel(x-1,y).A != 0) ||
              (x+1<Size && core.GetPixel(x+1,y).A != 0) ||
              (y>0 && core.GetPixel(x,y-1).A != 0) ||
              (y+1<Size && core.GetPixel(x,y+1).A != 0))
            result.SetPixel(x,y,Color.FromArgb(255,27,20,26));
        }
      }
    }
    return result;
  }

  static void WriteEditable(string path, List<Bitmap> frames, int duration) {
    using (var file = new BinaryWriter(File.Create(path))) {
      file.Write(new byte[128]);
      for (int n = 0; n < frames.Count; n++) {
        long start = file.BaseStream.Position;
        int chunks = n == 0 ? 2 : 1;
        file.Write(0); file.Write((ushort)0xF1FA); file.Write((ushort)chunks);
        file.Write((ushort)duration); file.Write((ushort)0); file.Write(chunks);
        if (n == 0) {
          byte[] name = System.Text.Encoding.UTF8.GetBytes("Pose");
          file.Write(24 + name.Length); file.Write((ushort)0x2004);
          file.Write((ushort)3); file.Write((ushort)0); file.Write((ushort)0);
          file.Write((ushort)Size); file.Write((ushort)Size); file.Write((ushort)0);
          file.Write((byte)255); file.Write(new byte[3]);
          file.Write((ushort)name.Length); file.Write(name);
        }
        file.Write(26 + Size*Size*4); file.Write((ushort)0x2005);
        file.Write((ushort)0); file.Write((short)0); file.Write((short)0);
        file.Write((byte)255); file.Write((ushort)0); file.Write(new byte[7]);
        file.Write((ushort)Size); file.Write((ushort)Size);
        for (int y=0; y<Size; y++) for (int x=0; x<Size; x++) {
          Color c = frames[n].GetPixel(x,y);
          file.Write(c.R); file.Write(c.G); file.Write(c.B); file.Write(c.A);
        }
        long end = file.BaseStream.Position;
        file.BaseStream.Position = start; file.Write((int)(end-start)); file.BaseStream.Position = end;
      }
      int length = (int)file.BaseStream.Length;
      file.BaseStream.Position = 0;
      file.Write(length); file.Write((ushort)0xA5E0); file.Write((ushort)frames.Count);
      file.Write((ushort)Size); file.Write((ushort)Size); file.Write((ushort)32);
      file.Write(1); file.Write((ushort)duration); file.Write(0); file.Write(0);
      file.Write((byte)0); file.Write(new byte[3]); file.Write((ushort)0); file.Write((byte)1); file.Write((byte)1);
    }
  }
}
'@

$dual = Join-Path $ReferenceDirectory 'a_clean_pixel_art_game_sprite_sheet_on_a_transpare.png'
$pallico = Join-Path $ReferenceDirectory 'a_detailed_pixel_art_sprite_sheet_for_the_characte.png'
$dualColumns = [int[][]]@(
  @(355,400,445,490), @(560,603,646,689,732,774),
  @(838,885,931,978,1026), @(1099,1153,1206), @(1284,1328,1373,1417,1461,1506)
)
$dualEdges = [int[]]@(323,524,804,1060,1249,1531)
[ApprovedCast]::Rebuild($dual, (Join-Path $OutputDirectory 'tariq'), 'tariq',
  [int[]]@(51,105,158,211,263,317,370,424,479), $dualColumns, $dualEdges, 0.61)
[ApprovedCast]::Rebuild($dual, (Join-Path $OutputDirectory 'bailaor_furia'), 'bailaor_furia',
  [int[]]@(539,594,649,702,756,810,860,914,970), $dualColumns, $dualEdges, 0.62)
[ApprovedCast]::Rebuild($pallico, (Join-Path $OutputDirectory 'bronce'), 'bronce',
  [int[]]@(66,144,221,298,374,447,519,588,660),
  [int[][]]@(@(380,432,485,538),@(605,650,693,734,776,816),@(876,926,973,1022,1069),@(1137,1195,1254),@(1323,1364,1407,1450,1499)),
  [int[]]@(350,577,843,1104,1292,1528), 0.47)
