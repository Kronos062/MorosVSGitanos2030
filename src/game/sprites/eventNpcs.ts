export const EVENT_NPCS = {
  merchant_bot: {
    name: 'Kronos',
    dialogue: 'Buenas, te veo más perdido que un Charmander en una fiesta de agua, échale un ojo a estos productos, a ver si te puede ayudar algo.',
    colors: ['#30231f', '#b98363', '#4a305f', '#251c32', '#202026'],
    departure: 'fly',
  },
  altar_sangre: {
    name: 'Lady69Dark',
    dialogue: 'Vamos a hacer un pacto que será beneficioso para ambos, piensa con cabeza…',
    colors: ['#c29b5b', '#e1a68a', '#a3294e', '#6e1b3c', '#572138'],
    departure: 'sigil',
  },
  shrine_light: {
    name: 'Wifi',
    dialogue: 'Creo que tengo algo que puede ayudarte, toma lo que necesites.',
    colors: ['#372a28', '#c38c6a', '#e8e9e2', '#babfc6', '#385d87'],
    departure: 'portal',
  },
} as const;

type EventNpc = (typeof EVENT_NPCS)[keyof typeof EVENT_NPCS];
const bitmaps = new Map<EventNpc, { canvas: HTMLCanvasElement; portrait?: string }>();

export function getEventNpc(id: string): EventNpc | undefined {
  return Object.prototype.hasOwnProperty.call(EVENT_NPCS, id) ? EVENT_NPCS[id as keyof typeof EVENT_NPCS] : undefined;
}

function getBitmap(npc: EventNpc) {
  const cached = bitmaps.get(npc);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = 24;
  canvas.height = 31;
  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;
  const [hair, skin, fabric, seam, lower] = npc.colors;
  const box = (color: string, x: number, y: number, w: number, h: number) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };
  const ink = '#191724';

  // Torso, mangas y silueta de los pies.
  box(ink, 5, 12, 14, 12);
  box(ink, 4, 17, 16, 5);
  box(fabric, 6, 14, 12, 8);
  box(seam, 6, 18, 2, 4);
  box(seam, 16, 17, 2, 5);
  box(skin, 5, 20, 2, 2);
  box(skin, 17, 20, 2, 2);
  box(ink, 7, 22, 10, 7);
  box(lower, 8, 22, 3, 5);
  box(lower, 13, 22, 3, 5);
  box(ink, 6, 27, 5, 3);
  box(ink, 13, 27, 5, 3);
  
  // Cabeza orientada hacia la cámara.
  box(ink, 6, 3, 12, 11);
  box(ink, 7, 2, 10, 2);
  box(hair, 7, 4, 10, 5);
  box(skin, 8, 8, 8, 5);
  box(hair, 7, 8, 2, 3);
  box(hair, 9, 7, 4, 2);
  box('#252632', 10, 10, 1, 1);
  box('#252632', 14, 10, 1, 1);

  if (npc.departure === 'fly') {
    box(seam, 6, 12, 4, 3);
    box(seam, 14, 12, 4, 3);
    box('#a482b8', 10, 16, 1, 4);
    box('#76598b', 13, 16, 1, 3);
    box(seam, 9, 20, 6, 2);
  } else if (npc.departure === 'sigil') {
    box('#624132', 8, 3, 8, 2);
    box(hair, 6, 8, 2, 7);
    box(hair, 16, 8, 2, 7);
    box('#d04a65', 6, 2, 2, 6);
    box('#d04a65', 16, 2, 2, 6);
    box('#d04a65', 8, 6, 8, 2);
    box('#f58a98', 11, 7, 2, 2);
    box(ink, 6, 23, 12, 5);
    box(lower, 7, 23, 10, 4);
    box(fabric, 9, 21, 6, 5);
    box('#d66e8d', 10, 17, 4, 2);
  } else {
    box('#634939', 8, 12, 8, 2);
    box('#828ea3', 10, 16, 1, 3);
    box('#828ea3', 13, 16, 1, 3);
    box('#e6e8e0', 7, 27, 4, 2);
    box('#e6e8e0', 13, 27, 4, 2);
  }
  const bitmap: { canvas: HTMLCanvasElement; portrait?: string } = { canvas };
  bitmaps.set(npc, bitmap);
  return bitmap;
}

export function eventNpcPortrait(id: string) {
  const npc = getEventNpc(id);
  const bitmap = npc && getBitmap(npc);
  if (bitmap) return bitmap.portrait ??= bitmap.canvas.toDataURL();
}

export function drawEventNpc(ctx: CanvasRenderingContext2D, id: string, x: number, y: number, time: number, goneAt?: number) {
  const npc = getEventNpc(id);
  if (!npc) return false;
  const bitmap = getBitmap(npc);
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
  ctx.drawImage(bitmap.canvas, Math.round(walk) - 24, Math.round(lift) - 54, 48, 62);
  ctx.restore();
  return true;
}
