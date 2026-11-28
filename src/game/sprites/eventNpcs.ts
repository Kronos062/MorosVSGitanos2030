import { paintKronos, paintLady, paintWifi } from './eventNpcEffects';
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

export const EVENT_NPC_DEPARTURE_DURATION = 1.65;
const EFFECT_WIDTH = 112;
const EFFECT_HEIGHT = 124;
const EFFECT_ORIGIN_Y = 106;
let effectContext: CanvasRenderingContext2D | null = null;

function getEffectContext() {
  if (effectContext) return effectContext;
  const canvas = document.createElement('canvas');
  canvas.width = EFFECT_WIDTH;
  canvas.height = EFFECT_HEIGHT;
  effectContext = canvas.getContext('2d');
  return effectContext;
}

export function drawEventNpc(ctx: CanvasRenderingContext2D, id: string, x: number, y: number, time: number, goneAt?: number) {
  const npc = getEventNpc(id);
  if (!npc) return false;
  const elapsed = goneAt === undefined ? 0 : Math.max(0, time - goneAt);
  if (elapsed >= EVENT_NPC_DEPARTURE_DURATION) return true;

  const bitmap = getBitmap(id);
  const effect = getEffectContext();
  if (!bitmap || !effect) return false;
  const progress = elapsed / EVENT_NPC_DEPARTURE_DURATION;

  // Dibuja personajes y efectos en la misma cuadrícula de píxeles.
  effect.clearRect(0, 0, EFFECT_WIDTH, EFFECT_HEIGHT);
  effect.save();
  effect.translate(EFFECT_WIDTH / 2, EFFECT_ORIGIN_Y);
  effect.imageSmoothingEnabled = false;
  const drawNpc = (offset: number, feet: number, width = 32, height = 36, alpha = 1) => {
    if (alpha <= 0) return;
    effect.globalAlpha = alpha;
    effect.drawImage(bitmap.canvas, offset - Math.floor(width / 2), feet - height, width, height);
    effect.globalAlpha = 1;
  };

  switch (npc.departure) {
    case 'fly':
      paintKronos(effect, drawNpc, time, progress);
      break;
    case 'sigil':
      paintLady(effect, drawNpc, time, progress);
      break;
    case 'portal':
      paintWifi(effect, drawNpc, time, progress);
      break;
  }
  effect.restore();

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(effect.canvas, Math.round(x) - EFFECT_WIDTH, Math.round(y) - EFFECT_ORIGIN_Y * 2,
    EFFECT_WIDTH * 2, EFFECT_HEIGHT * 2);
  ctx.restore();
  return true;
}
