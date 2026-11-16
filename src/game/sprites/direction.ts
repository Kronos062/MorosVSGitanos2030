import type { Dir8 } from './types';

/** Orden por ángulo en coordenadas de canvas (y hacia abajo): 0 = derecha, +90° = abajo. */
export const DIR8: readonly Dir8[] = [
  'right',
  'down_right',
  'down',
  'down_left',
  'left',
  'up_left',
  'up',
  'up_right',
];

/** Las 5 direcciones que se dibujan; las otras 3 se obtienen espejando. */
export const DEFAULT_STORED_DIRS: readonly Dir8[] = ['up', 'up_right', 'right', 'down_right', 'down'];

export const MIRROR: Record<Dir8, Dir8> = {
  up: 'up',
  down: 'down',
  right: 'left',
  left: 'right',
  up_right: 'up_left',
  up_left: 'up_right',
  down_right: 'down_left',
  down_left: 'down_right',
};

export function dirFromVector(fx: number, fy: number, fallback: Dir8 = 'down'): Dir8 {
  if (!fx && !fy) return fallback;
  const i = Math.round(Math.atan2(fy, fx) / (Math.PI / 4));
  return DIR8[((i % 8) + 8) % 8];
}

function ringDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 8;
  return Math.min(d, 8 - d);
}

export interface ResolvedDir {
  /** Dirección cuyo archivo se usa. */
  dir: Dir8;
  /** Dibujarlo invertido horizontalmente. */
  flip: boolean;
}

/**
 * Elige el archivo y el espejado para una dirección lógica.
 * 1) Si está almacenada, se usa tal cual.
 * 2) Si `mirror` y está su opuesta horizontal, se espeja.
 * 3) Si no, la almacenada (o espejada) más cercana angularmente.
 */
export function resolveDirection(dir: Dir8, stored: readonly Dir8[], mirror = true): ResolvedDir {
  if (stored.includes(dir)) return { dir, flip: false };
  if (mirror && stored.includes(MIRROR[dir])) return { dir: MIRROR[dir], flip: true };

  const target = DIR8.indexOf(dir);
  let best: ResolvedDir = { dir: stored[0], flip: false };
  let bestDist = Infinity;
  for (const s of stored) {
    const d = ringDistance(DIR8.indexOf(s), target);
    if (d < bestDist) {
      bestDist = d;
      best = { dir: s, flip: false };
    }
    if (mirror) {
      const dm = ringDistance(DIR8.indexOf(MIRROR[s]), target);
      if (dm < bestDist) {
        bestDist = dm;
        best = { dir: s, flip: true };
      }
    }
  }
  return best;
}
