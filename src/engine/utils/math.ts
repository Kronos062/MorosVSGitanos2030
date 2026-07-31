/**
 * utils/math.ts — utilidades matemáticas puras del motor (TDD §3.3 engine/utils).
 *
 * Puras, sin dependencias de gameplay. Vector 2D, clamp, lerp, RNG con semilla.
 */

export type Vec2 = { x: number; y: number };

export const v2 = (x = 0, y = 0): Vec2 => ({ x, y });
export const v2Add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
export const v2Sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
export const v2Scale = (a: Vec2, s: number): Vec2 => ({ x: a.x * s, y: a.y * s });
export const v2Len = (a: Vec2): number => Math.hypot(a.x, a.y);
export const v2Norm = (a: Vec2): Vec2 => {
  const l = v2Len(a);
  return l > 0 ? { x: a.x / l, y: a.y / l } : { x: 0, y: 0 };
};
export const v2Dist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);
export const v2FromAngle = (angle: number, mag = 1): Vec2 => ({
  x: Math.cos(angle) * mag,
  y: Math.sin(angle) * mag,
});

export const clamp = (v: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, v));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const randRange = (min: number, max: number): number =>
  Math.random() * (max - min) + min;
export const randInt = (min: number, max: number): number =>
  Math.floor(Math.random() * (max - min + 1)) + min;
export const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
export const chance = (p: number): boolean => Math.random() < p;

/** PRNG con semilla (Mulberry32) — útil para salas reproducibles. */
export const mulberry32 = (seed: number) => {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
};

/** AABB simple. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const rectContains = (r: Rect, p: Vec2): boolean =>
  p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

export const rectsOverlap = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
