import { describe, it, expect } from 'vitest';
import { LevelGenerator } from './LevelGenerator';
import { ContentRepository, SchemaValidator } from '@/engine/content/ContentRepository';
import roomsData from '@/content/rooms.json';
import biomesData from '@/content/biomes.json';

describe('LevelGenerator', () => {
  const makeRepo = () => {
    const repo = new ContentRepository(new SchemaValidator());
    repo.load(roomsData.map((r) => ({ ...r, type: 'rooms' as const })) as never[]);
    repo.load(biomesData.map((b) => ({ ...b, type: 'biomes' as const })) as never[]);
    return repo;
  };

  it('generates a continuous map of 10 rooms connected by corridors with reproducible seed', () => {
    const gen = new LevelGenerator(makeRepo(), 10);
    const map1 = gen.generateMap(12345);
    const map2 = gen.generateMap(12345);

    expect(map1.nodes.length).toBe(19); // 10 salas + 9 pasillos
    expect(map1).toEqual(map2); // Misma semilla -> mismo mapa

    expect(map1.nodes[0].level).toBe(1);
    expect(map1.nodes[0].type).toBe('room');
    expect(map1.nodes[1].type).toBe('corridor');
    expect(map1.nodes[18].level).toBe(10);
    expect(map1.nodes[18].type).toBe('boss');
    expect(map1.totalWidth).toBeGreaterThan(10000);
  });

  it('generates different maps for different seeds', () => {
    const gen = new LevelGenerator(makeRepo(), 10);
    const mapA = gen.generateMap(111);
    const mapB = gen.generateMap(999);

    expect(mapA).not.toEqual(mapB);
  });
});
