/**
 * physics/SpatialGrid.ts — particionado espacial uniforme (TDD §3.3 engine/physics).
 *
 * Evita comparaciones O(n²) dividiendo el espacio en celdas cuadradas de tamaño fijo.
 */

import type { Vec2, Rect } from '../utils/math';

export class SpatialGrid {
  private cells = new Map<string, Set<number>>();

  constructor(private readonly cellSize: number) {}

  private key(cx: number, cy: number): string {
    return `${cx},${cy}`;
  }

  clear(): void {
    this.cells.clear();
  }

  insert(id: number, pos: Vec2): void {
    const cx = Math.floor(pos.x / this.cellSize);
    const cy = Math.floor(pos.y / this.cellSize);
    const k = this.key(cx, cy);
    let set = this.cells.get(k);
    if (!set) {
      set = new Set();
      this.cells.set(k, set);
    }
    set.add(id);
  }

  queryRadius(pos: Vec2, radius: number): number[] {
    const result: number[] = [];
    const minCx = Math.floor((pos.x - radius) / this.cellSize);
    const maxCx = Math.floor((pos.x + radius) / this.cellSize);
    const minCy = Math.floor((pos.y - radius) / this.cellSize);
    const maxCy = Math.floor((pos.y + radius) / this.cellSize);
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const set = this.cells.get(this.key(cx, cy));
        if (set) for (const id of set) result.push(id);
      }
    }
    return result;
  }

  queryRect(rect: Rect): number[] {
    return this.queryRadius({ x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 }, Math.hypot(rect.w, rect.h) / 2);
  }
}
