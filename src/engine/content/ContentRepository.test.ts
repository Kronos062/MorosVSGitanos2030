import { describe, it, expect } from 'vitest';
import {
  ContentRepository, SchemaValidator,
} from '@/engine/content/ContentRepository';
import weaponsData from '@/content/weapons.json';
import enemiesData from '@/content/enemies.json';

describe('ContentRepository', () => {
  it('carga ítems válidos y rechaza inválidos', () => {
    const validator = new SchemaValidator();
    validator.register('weapons', [
      { kind: 'required', fields: ['id', 'damage', 'fireRate', 'color'] },
      { kind: 'type', field: 'damage', type: 'number' },
    ]);
    const repo = new ContentRepository(validator);

    const { loaded, errors } = repo.load([
      { id: 'pistol', type: 'weapons', damage: 10, fireRate: 3, color: '#00f0ff' } as never,
      { id: 'broken', type: 'weapons', damage: 'not a number' } as never,
      { id: 'missing', type: 'weapons' } as never,
    ]);
    expect(loaded).toBe(1);
    expect(errors.length).toBe(2);
    expect(repo.has('weapons', 'pistol')).toBe(true);
    expect(repo.has('weapons', 'broken')).toBe(false);
  });

  it('carga armas reales del JSON', () => {
    const repo = new ContentRepository(new SchemaValidator());
    const { loaded } = repo.load(weaponsData.map((it) => ({ ...it, type: 'weapons' as const })) as never[]);
    expect(loaded).toBe(weaponsData.length);
    const pistol = repo.get<{ damage: number }>('weapons', 'pistol');
    expect(pistol?.damage).toBe(12);
    expect(repo.all('weapons').length).toBe(weaponsData.length);
  });

  it('carga enemigos reales del JSON', () => {
    const repo = new ContentRepository(new SchemaValidator());
    const { loaded } = repo.load(enemiesData.map((it) => ({ ...it, type: 'enemies' as const })) as never[]);
    expect(loaded).toBe(enemiesData.length);
    const grunt = repo.get<{ hp: number }>('enemies', 'grunt');
    expect(grunt?.hp).toBe(20);
  });

  it('stats devuelve conteo por tipo', () => {
    const repo = new ContentRepository(new SchemaValidator());
    repo.load(weaponsData.map((it) => ({ ...it, type: 'weapons' as const })) as never[]);
    repo.load(enemiesData.map((it) => ({ ...it, type: 'enemies' as const })) as never[]);
    const stats = repo.stats();
    expect(stats.weapons).toBe(weaponsData.length);
    expect(stats.enemies).toBe(enemiesData.length);
  });
});
