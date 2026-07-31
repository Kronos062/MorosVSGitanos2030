import { describe, it, expect } from 'vitest';
import { World, ComponentRegistry } from '@/engine/ecs/World';

describe('World (ECS)', () => {
  const makeRegistry = () => {
    const r = new ComponentRegistry();
    r.register({ name: 'Position', clone: (s) => ({ ...(s as object) }) as never });
    r.register({ name: 'Velocity', clone: (s) => ({ ...(s as object) }) as never });
    return r;
  };

  it('crea y destruye entidades', () => {
    const w = new World(makeRegistry());
    const a = w.createEntity();
    const b = w.createEntity();
    expect(w.isAlive(a)).toBe(true);
    expect(w.isAlive(b)).toBe(true);
    expect(w.entityCount()).toBe(2);
    w.destroyEntity(a);
    expect(w.isAlive(a)).toBe(false);
    expect(w.entityCount()).toBe(1);
  });

  it('añade, consulta y elimina componentes', () => {
    const w = new World(makeRegistry());
    const e = w.createEntity();
    w.addComponent(e, 'Position', { x: 1, y: 2 });
    expect(w.hasComponent(e, 'Position')).toBe(true);
    expect(w.getComponent<{ x: number }>(e, 'Position')?.x).toBe(1);
    w.removeComponent(e, 'Position');
    expect(w.hasComponent(e, 'Position')).toBe(false);
  });

  it('clona los componentes (evita aliasing)', () => {
    const w = new World(makeRegistry());
    const e1 = w.createEntity();
    const e2 = w.createEntity();
    const pos = { x: 1, y: 2 };
    w.addComponent(e1, 'Position', pos);
    w.addComponent(e2, 'Position', pos);
    const p1 = w.getComponent<{ x: number }>(e1, 'Position')!;
    const p2 = w.getComponent<{ x: number }>(e2, 'Position')!;
    p1.x = 99;
    expect(p2.x).toBe(1);
    expect(pos.x).toBe(1);
  });

  it('query filtra por conjunción de componentes', () => {
    const w = new World(makeRegistry());
    const a = w.createEntity();
    const b = w.createEntity();
    const c = w.createEntity();
    w.addComponent(a, 'Position', { x: 0, y: 0 });
    w.addComponent(a, 'Velocity', { vx: 1, vy: 0 });
    w.addComponent(b, 'Position', { x: 0, y: 0 });
    w.addComponent(c, 'Velocity', { vx: 0, vy: 1 });
    expect(w.query('Position', 'Velocity')).toEqual([a]);
    expect(w.query('Position').sort()).toEqual([a, b].sort());
    expect(w.query('Velocity').sort()).toEqual([a, c].sort());
  });

  it('tags y groups', () => {
    const w = new World(makeRegistry());
    const p = w.createEntity();
    w.setTag('player', p);
    expect(w.getTag('player')).toBe(p);

    const e1 = w.createEntity();
    const e2 = w.createEntity();
    w.addToGroup('enemies', e1);
    w.addToGroup('enemies', e2);
    expect(w.getGroup('enemies').sort()).toEqual([e1, e2].sort());
  });

  it('destruir limpia componentes, tags y grupos', () => {
    const w = new World(makeRegistry());
    const e = w.createEntity();
    w.addComponent(e, 'Position', { x: 0, y: 0 });
    w.addToGroup('enemies', e);
    w.destroyEntity(e);
    expect(w.query('Position')).toEqual([]);
    expect(w.getGroup('enemies')).toEqual([]);
  });
});
