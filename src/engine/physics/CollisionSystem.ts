/**
 * CollisionSystem.ts — detección de colisiones (TDD §3.3 engine/physics).
 *
 * Utiliza SpatialGrid para consultas de colisión O(1) por radio y AABB.
 */

import type { Vec2, Rect } from '../utils/math';
import { v2Dist, rectsOverlap } from '../utils/math';
import { SpatialGrid } from './SpatialGrid';

export { SpatialGrid };

export interface ColliderEntry {
  id: number;
  pos: Vec2;
  radius: number;
  tag?: string;
}

export interface CollisionPair {
  a: number;
  b: number;
  distance: number;
}

/**
 * CollisionSystem — calcula pares en colisión a partir de una lista de entradas.
 */
export class CollisionSystem {
  private grid: SpatialGrid;
  private entries = new Map<number, ColliderEntry>();

  constructor(cellSize = 80) {
    this.grid = new SpatialGrid(cellSize);
  }

  /** Actualiza la lista de colliders para el frame. */
  setEntries(entries: ColliderEntry[]): void {
    this.grid.clear();
    this.entries.clear();
    for (const e of entries) {
      this.entries.set(e.id, e);
      this.grid.insert(e.id, e.pos);
    }
  }

  /** Detecta todas las colisiones entre entidades dentro de un grupo. */
  detectAll(maxRadius: number): CollisionPair[] {
    const pairs: CollisionPair[] = [];
    const seen = new Set<string>();
    for (const a of this.entries.values()) {
      const candidates = this.grid.queryRadius(a.pos, maxRadius);
      for (const bid of candidates) {
        if (bid === a.id) continue;
        const b = this.entries.get(bid);
        if (!b) continue;
        const key = a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`;
        if (seen.has(key)) continue;
        const d = v2Dist(a.pos, b.pos);
        if (d <= a.radius + b.radius) {
          seen.add(key);
          pairs.push({ a: a.id, b: b.id, distance: d });
        }
      }
    }
    return pairs;
  }

  /** ¿Está la entidad `id` en colisión con alguna otra? */
  collidesWith(id: number): number[] {
    const a = this.entries.get(id);
    if (!a) return [];
    const result: number[] = [];
    const candidates = this.grid.queryRadius(a.pos, a.radius * 4);
    for (const bid of candidates) {
      if (bid === id) continue;
      const b = this.entries.get(bid);
      if (!b) continue;
      if (v2Dist(a.pos, b.pos) <= a.radius + b.radius) result.push(bid);
    }
    return result;
  }

  /** AABB vs entidades. */
  queryAABB(rect: Rect): number[] {
    const ids = this.grid.queryRect(rect);
    const result: number[] = [];
    for (const id of ids) {
      const e = this.entries.get(id);
      if (!e) continue;
      const eRect: Rect = { x: e.pos.x - e.radius, y: e.pos.y - e.radius, w: e.radius * 2, h: e.radius * 2 };
      if (rectsOverlap(rect, eRect)) result.push(id);
    }
    return result;
  }
}
