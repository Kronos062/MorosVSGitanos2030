import { describe, it, expect } from 'vitest';
import { ObjectPool } from '../ecs/ObjectPool';

describe('ObjectPool', () => {
  interface Dummy { x: number; y: number; active: boolean }

  it('pre-populates the pool and reuses released objects', () => {
    const pool = new ObjectPool<Dummy>(
      () => ({ x: 0, y: 0, active: false }),
      (obj) => { obj.x = 0; obj.y = 0; obj.active = true; },
      10
    );

    expect(pool.available).toBe(10);

    const obj1 = pool.acquire();
    expect(obj1.active).toBe(true);
    expect(pool.available).toBe(9);

    obj1.x = 42;
    pool.release(obj1);
    expect(pool.available).toBe(10);

    const obj2 = pool.acquire();
    expect(obj2.x).toBe(0); // resetFn reset x to 0
  });

  it('creates new objects when pool is empty', () => {
    const pool = new ObjectPool<number>(
      () => Math.random(),
      () => {},
      0
    );

    expect(pool.available).toBe(0);
    const val = pool.acquire();
    expect(typeof val).toBe('number');
  });
});
