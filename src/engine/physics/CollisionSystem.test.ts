import { describe, it, expect } from 'vitest';
import { SpatialGrid, CollisionSystem } from '@/engine/physics/CollisionSystem';

describe('SpatialGrid', () => {
  it('queryRadius devuelve entidades en rango', () => {
    const g = new SpatialGrid(80);
    g.insert(1, { x: 100, y: 100 });
    g.insert(2, { x: 150, y: 100 });
    g.insert(3, { x: 500, y: 500 });
    const near = g.queryRadius({ x: 120, y: 100 }, 80);
    expect(near.sort()).toEqual([1, 2].sort());
  });

  it('clear elimina todas las entradas', () => {
    const g = new SpatialGrid(80);
    g.insert(1, { x: 0, y: 0 });
    g.clear();
    expect(g.queryRadius({ x: 0, y: 0 }, 100)).toEqual([]);
  });
});

describe('CollisionSystem', () => {
  it('detecta pares de entidades que colisionan', () => {
    const sys = new CollisionSystem(80);
    sys.setEntries([
      { id: 1, pos: { x: 0, y: 0 }, radius: 10 },
      { id: 2, pos: { x: 15, y: 0 }, radius: 10 }, // solapa con 1
      { id: 3, pos: { x: 100, y: 100 }, radius: 10 }, // lejos
    ]);
    const pairs = sys.detectAll(100);
    expect(pairs.length).toBe(1);
    expect(pairs[0].a).toBe(1);
    expect(pairs[0].b).toBe(2);
  });

  it('collidesWith devuelve sólo vecinos', () => {
    const sys = new CollisionSystem(80);
    sys.setEntries([
      { id: 1, pos: { x: 0, y: 0 }, radius: 10 },
      { id: 2, pos: { x: 15, y: 0 }, radius: 10 },
      { id: 3, pos: { x: 50, y: 0 }, radius: 10 },
    ]);
    const near1 = sys.collidesWith(1);
    expect(near1).toEqual([2]);
    const near3 = sys.collidesWith(3);
    expect(near3).toEqual([]);
  });

  it('queryAABB devuelve entidades dentro del rectángulo', () => {
    const sys = new CollisionSystem(80);
    sys.setEntries([
      { id: 1, pos: { x: 10, y: 10 }, radius: 5 },
      { id: 2, pos: { x: 50, y: 50 }, radius: 5 },
      { id: 3, pos: { x: 200, y: 200 }, radius: 5 },
    ]);
    const inRect = sys.queryAABB({ x: 0, y: 0, w: 100, h: 100 }).sort();
    expect(inRect).toEqual([1, 2]);
  });
});
