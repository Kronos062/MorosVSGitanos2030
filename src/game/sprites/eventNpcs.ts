import { EVENT_NPC_COLORS, EVENT_NPC_PIXELS } from './eventNpcArt';

export const EVENT_NPCS = {
  merchant_bot: {
    name: 'Kronos',
    dialogue: 'Buenas, te veo más perdido que un Charmander en una fiesta de agua, échale un ojo a estos productos, a ver si te puede ayudar algo.',
    departure: 'fly',
  },
  altar_sangre: {
    name: 'Lady69Dark',
    dialogue: 'Vamos a hacer un pacto que será beneficioso para ambos, piensa con cabeza…',
    departure: 'sigil',
  },
  shrine_light: {
    name: 'Wifi',
    dialogue: 'Creo que tengo algo que puede ayudarte, toma lo que necesites.',
    departure: 'portal',
  },
} as const;

type EventNpc = (typeof EVENT_NPCS)[keyof typeof EVENT_NPCS];
const bitmaps = new Map<string, { canvas: HTMLCanvasElement; portrait?: string }>();

export function getEventNpc(id: string): EventNpc | undefined {
  return Object.prototype.hasOwnProperty.call(EVENT_NPCS, id) ? EVENT_NPCS[id as keyof typeof EVENT_NPCS] : undefined;
}

function getBitmap(id: string) {
  const cached = bitmaps.get(id);
  if (cached) return cached;
  const pixels = EVENT_NPC_PIXELS[id];
  const canvas = document.createElement('canvas');
  canvas.width = pixels[0].length;
  canvas.height = pixels.length;
  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;

  for (let y = 0; y < pixels.length; y++) {
    for (let x = 0; x < pixels[y].length; x++) {
      const color = EVENT_NPC_COLORS[pixels[y][x]];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  const bitmap: { canvas: HTMLCanvasElement; portrait?: string } = { canvas };
  bitmaps.set(id, bitmap);
  return bitmap;
}

export function eventNpcPortrait(id: string) {
  if (!getEventNpc(id)) return;
  const bitmap = getBitmap(id);
  if (bitmap) return bitmap.portrait ??= bitmap.canvas.toDataURL();
}

export function drawSeatedKronos(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const bitmap = getBitmap('merchant_bot');
  if (!bitmap) return;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(bitmap.canvas, 4, 0, 25, 25, x, y, 24, 24);
  ctx.restore();
}

export function drawEventNpc(ctx: CanvasRenderingContext2D, id: string, x: number, y: number, time: number, goneAt?: number) {
  const npc = getEventNpc(id);
  if (!npc) return false;
  const bitmap = getBitmap(id);
  if (!bitmap) return false;
  const elapsed = goneAt === undefined ? 0 : Math.max(0, time - goneAt);
  const leaving = goneAt !== undefined;
  if (leaving && elapsed >= 1.2) return true;
  const progress = Math.min(1, elapsed / 1.2);
  let lift = 0;
  let walk = 0;
  let fade = 1;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.imageSmoothingEnabled = false;

  if (npc.departure === 'fly') {
    lift = leaving ? -145 * progress ** 1.65 : 0;
    fade = 1 - progress ** 4;
    for (let i = 0; i < 8; i++) {
      const angle = time * .9 + i * Math.PI / 4;
      ctx.globalAlpha = fade * (.24 + (1 + Math.sin(time * 4 + i)) * .14);
      ctx.fillStyle = i % 2 === 0 ? '#251333' : '#7851a3';
      ctx.fillRect(Math.round(Math.cos(angle) * (20 + i % 3 * 4)), Math.round(Math.sin(angle) * 10 + lift * .75), 7, 5);
    }
  } else if (leaving && npc.departure === 'sigil') {
    const radius = 8 + 22 * Math.min(1, progress * 4);
    ctx.globalAlpha = 1 - progress ** 3;
    ctx.strokeStyle = '#e14b68';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 7, radius, radius * .55, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i <= 6; i++) {
      const angle = -Math.PI / 2 + i * Math.PI / 3;
      const r = i % 2 === 0 ? radius - 4 : radius / 2;
      const px = Math.cos(angle) * r;
      const py = 7 + Math.sin(angle) * r * .48;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    lift = progress * 18;
    fade = Math.max(0, 1 - Math.max(0, (progress - .18) * 1.35));
  } else if (leaving && npc.departure === 'portal') {
    const opening = Math.min(1, progress * 5, (1 - progress) * 5);
    const portalX = 32;
    ctx.globalAlpha = .95;
    ctx.strokeStyle = '#aaf577';
    ctx.lineWidth = 3;
    ctx.fillStyle = '#265746';
    ctx.beginPath();
    ctx.ellipse(portalX, -13, 11 * opening, 25 * opening, -.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (progress < .2) {
      ctx.fillStyle = '#a4bfb4';
      ctx.fillRect(13, -25, 10, 4);
      ctx.fillStyle = '#c4f899';
      ctx.fillRect(21, -25, 6, 2);
    }
    walk = portalX * Math.min(1, Math.max(0, (progress - .18) * 1.9));
    fade = Math.min(1, (1 - progress) * 3.2);
  }
  ctx.globalAlpha = fade;
  const width = bitmap.canvas.width * 2;
  const height = bitmap.canvas.height * 2;
  ctx.drawImage(bitmap.canvas, Math.round(walk) - width / 2, Math.round(lift) - height + 8, width, height);
  ctx.restore();
  return true;
}
