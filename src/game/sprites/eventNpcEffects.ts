type DrawNpc = (x: number, feet: number, width?: number, height?: number, alpha?: number) => void;

const clamp = (value: number) => Math.min(1, Math.max(0, value));
const stage = (progress: number, start: number, end: number) => clamp((progress - start) / (end - start));
const TAU = Math.PI * 2;

function oval(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string) {
  ctx.fillStyle = color;
  for (let row = -ry; row <= ry; row++) {
    const halfWidth = Math.floor(rx * Math.sqrt(1 - (row / ry) ** 2));
    ctx.fillRect(x - halfWidth, y + row, halfWidth * 2 + 1, 1);
  }
}

function ring(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string) {
  ctx.fillStyle = color;
  const steps = Math.ceil(Math.max(rx, ry) * TAU);
  for (let i = 0; i < steps; i++) {
    const angle = i * TAU / steps;
    ctx.fillRect(x + Math.round(Math.cos(angle) * rx), y + Math.round(Math.sin(angle) * ry), 1, 1);
  }
}

function pixelLine(ctx: CanvasRenderingContext2D, x: number, y: number, endX: number, endY: number) {
  const steps = Math.max(Math.abs(endX - x), Math.abs(endY - y), 1);
  for (let i = 0; i <= steps; i++) {
    ctx.fillRect(Math.round(x + (endX - x) * i / steps), Math.round(y + (endY - y) * i / steps), 1, 1);
  }
}

function smoke(ctx: CanvasRenderingContext2D, x: number, y: number, life: number, accent: boolean) {
  ctx.globalAlpha = (1 - life) * .74;
  ctx.fillStyle = '#130d1c';
  ctx.fillRect(x - 3, y, 7, 3);
  ctx.fillRect(x - 5, y + 2, 7, 2);
  ctx.fillRect(x - 2, y - 1, 4, 5);
  ctx.fillStyle = accent ? '#7751a0' : '#4b2b66';
  ctx.fillRect(x - 4, y + 2, 5, 1);
  ctx.fillRect(x - 1, y, 4, 1);
  ctx.fillRect(x + 3, y + 1, 2, 1);
  if (accent) {
    ctx.fillStyle = '#a370d1';
    ctx.fillRect(x, y, 2, 1);
  }
}

export function paintKronos(ctx: CanvasRenderingContext2D, drawNpc: DrawNpc, time: number, progress: number) {
  const launch = stage(progress, .14, .76);
  const lift = Math.round(launch ** 1.7 * 75 - Math.sin(stage(progress, 0, .14) * Math.PI) * 2);
  const drift = Math.round(launch * 13);
  const fade = 1 - stage(progress, .53, .76);
  oval(ctx, 0, 4, 17 - Math.round(launch * 11), 3, 'rgba(18, 11, 27, .46)');

  for (let i = 0; i < 14; i++) {
    const life = (time * .63 + i / 14) % 1;
    const angle = i * 2.4 + time * .9;
    const x = Math.round(Math.cos(angle) * (13 + life * 8));
    const y = Math.round(3 + Math.sin(angle) * 4 - life * 22);
    smoke(ctx, x + drift, y - Math.round(lift * (1 - life * .52)), 1 - (1 - life) * fade, i % 3 === 0);
  }
  ctx.globalAlpha = 1;
  drawNpc(drift, 4 - lift, 32, 36, fade);

  if (progress > 0) {
    const wake = stage(progress, .18, 1);
    for (let i = 0; i < 10; i++) {
      const phase = stage(progress, .14 + i * .023, .61 + i * .038);
      if (phase === 0 || phase === 1) continue;
      const x = Math.round((i % 2 ? -1 : 1) * phase * (7 + i % 4 * 3) + drift * .45);
      smoke(ctx, x, Math.round(5 - phase * (7 + i * 4)), phase, i % 2 === 0);
    }
    ctx.globalAlpha = 1 - wake;
    ring(ctx, 0, 4, 9 + Math.round(wake * 16), 2 + Math.round(wake * 3), '#966ac8');
  }
  ctx.globalAlpha = 1;
}

export function paintLady(ctx: CanvasRenderingContext2D, drawNpc: DrawNpc, time: number, progress: number) {
  const expand = stage(progress, 0, .24);
  const close = 1 - stage(progress, .77, 1);
  const radius = Math.round((13 + 11 * expand) * close);
  const rise = stage(progress, .27, .73);
  const center = 5;
  if (radius >= 4) {
    const depth = Math.max(2, Math.round(radius * .29));
    oval(ctx, 0, center, radius, depth, 'rgba(107, 17, 40, .6)');
    ring(ctx, 0, center, radius, depth, '#9d2e45');
    ring(ctx, 0, center, radius - 2, Math.max(1, depth - 1), progress > 0 ? '#ef5d77' : '#bd4961');

    ctx.fillStyle = '#d34560';
    for (let i = 0; i < 5; i++) {
      const angle = i * TAU / 5 - Math.PI / 2;
      const next = angle + 2 * TAU / 5;
      pixelLine(ctx, Math.round(Math.cos(angle) * (radius - 4)), center + Math.round(Math.sin(angle) * (depth - 1)),
        Math.round(Math.cos(next) * (radius - 4)), center + Math.round(Math.sin(next) * (depth - 1)));
    }
    for (let i = 0; i < 9; i++) {
      const angle = time * 1.25 + i * TAU / 9;
      const x = Math.round(Math.cos(angle) * (radius + 2));
      const y = Math.round(Math.sin(angle) * (depth + 2)) + center;
      ctx.fillStyle = i % 3 ? '#df5368' : '#ff9a9e';
      ctx.fillRect(x, y, i % 3 ? 1 : 2, 1);
    }
  }

  // Mantiene las proporciones del cuerpo y lo oculta por debajo del plano del sello.
  if (rise > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(-24, -40, 48, 44);
    ctx.clip();
    drawNpc(0, 4 + Math.round(rise * 36), 32, 36, 1 - stage(progress, .65, .74));
    ctx.restore();
  } else {
    drawNpc(0, 4);
  }
  if (progress === 0) return;
  for (let i = 0; i < 18; i++) {
    const phase = (progress * 1.7 + i / 18) % 1;
    const angle = i * 2.4 + progress * 6;
    const x = Math.round(Math.cos(angle) * radius * (1 - phase * .55));
    const y = Math.round(center + Math.sin(angle) * 5 - phase * 31 * expand);
    ctx.globalAlpha = close * expand * (1 - phase);
    ctx.fillStyle = i % 4 ? '#f06175' : '#ffb5a8';
    ctx.fillRect(x, y, 1, i % 4 ? 2 : 1);
  }
  ctx.globalAlpha = 1;
}

function portalGun(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = '#1a2530';
  ctx.fillRect(x, y, 10, 4);
  ctx.fillRect(x + 2, y + 3, 4, 3);
  ctx.fillStyle = '#8298a2';
  ctx.fillRect(x + 1, y + 1, 8, 2);
  ctx.fillStyle = '#c2d1ce';
  ctx.fillRect(x + 1, y + 1, 5, 1);
  ctx.fillStyle = '#96f798';
  ctx.fillRect(x + 7, y + 1, 3, 1);
}

export function paintWifi(ctx: CanvasRenderingContext2D, drawNpc: DrawNpc, time: number, progress: number) {
  const portalX = 30;
  const aperture = stage(progress, .15, .37) * (1 - stage(progress, .75, .99));
  const entry = stage(progress, .37, .73);
  const walk = Math.round(entry * portalX);
  const feet = 4 - (entry > 0 && entry < .8 ? Math.round(Math.abs(Math.sin(entry * 18)) * 2) : 0);
  const width = Math.round(32 - stage(entry, .65, 1) * 22);

  ctx.globalAlpha = 1 - entry;
  oval(ctx, 0, 4, 15, 3, 'rgba(34, 97, 69, .34)');
  for (let i = 0; i < 5; i++) {
    const phase = (time * .44 + i / 5) % 1;
    const angle = time + i * TAU / 5;
    ctx.globalAlpha = (1 - phase) * .68 * (1 - entry);
    ctx.fillStyle = '#9be9a1';
    ctx.fillRect(Math.round(Math.cos(angle) * 16), Math.round(4 + Math.sin(angle) * 4 - phase * 11), 1, 1);
  }
  ctx.globalAlpha = 1;

  if (aperture > 0) {
    const rx = Math.max(1, Math.round(aperture * 10));
    const ry = Math.max(1, Math.round(aperture * 22));
    oval(ctx, portalX, -15, rx + 2, ry + 2, 'rgba(91, 205, 102, .24)');
    oval(ctx, portalX, -15, rx, ry, '#185942');
    oval(ctx, portalX, -15, Math.max(1, rx - 2), Math.max(1, ry - 3), '#0b342d');
    ring(ctx, portalX, -15, rx, ry, '#78ee8c');
    ring(ctx, portalX, -15, Math.max(1, rx - 1), Math.max(1, ry - 2), '#38a96e');
    for (let i = 0; i < 28; i++) {
      const distance = i / 28;
      const angle = i * .25 + time * 6;
      const x = portalX + Math.round(Math.cos(angle) * rx * distance);
      const y = -15 + Math.round(Math.sin(angle) * ry * distance);
      ctx.fillStyle = i < 10 ? '#57c47e' : '#296a4f';
      ctx.fillRect(x, y, 1, 1);
    }
  }

  drawNpc(walk, feet, width, 36 - Math.round(stage(entry, .72, 1) * 19), 1 - stage(entry, .64, 1));
  if (progress > 0 && progress < .33) {
    portalGun(ctx, 10, -14);
    if (progress >= .13 && progress < .23) {
      ctx.fillStyle = '#c9ffc1';
      pixelLine(ctx, 20, -13, portalX, -15);
      ctx.fillRect(21, -15, 2, 3);
    }
  }
  if (aperture > 0) {
    if (entry > .35) {
      ctx.fillStyle = '#78ee8c';
      for (let i = -14; i <= 14; i++) {
        const angle = i * Math.PI / 28;
        const x = portalX + Math.round(Math.cos(angle) * 10 * aperture);
        const y = -15 + Math.round(Math.sin(angle) * 22 * aperture);
        ctx.fillRect(x, y, 1, 2);
      }
    }
    for (let i = 0; i < 12; i++) {
      const angle = time * 4 + i * TAU / 12;
      const x = portalX + Math.round(Math.cos(angle) * 12 * aperture);
      const y = -15 + Math.round(Math.sin(angle) * 22 * aperture);
      ctx.fillStyle = i % 3 ? '#90ef95' : '#dcffb1';
      ctx.fillRect(x, y, 1, i % 3 ? 1 : 2);
    }
  }
}
