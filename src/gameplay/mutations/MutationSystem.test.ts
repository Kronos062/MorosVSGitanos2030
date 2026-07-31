import { describe, it, expect } from 'vitest';
import { MutationSystem } from './MutationSystem';
import { ContentRepository, SchemaValidator } from '@/engine/content/ContentRepository';
import mutationsData from '@/content/mutations.json';

describe('MutationSystem', () => {
  const makeRepo = () => {
    const repo = new ContentRepository(new SchemaValidator());
    repo.load(mutationsData.map((m) => ({ ...m, type: 'mutations' as const })) as never[]);
    return repo;
  };

  it('applies mutations to base enemy stats', () => {
    const system = new MutationSystem(makeRepo());
    const baseStats = {
      hp: 100, damage: 10, speed: 50, size: 10,
      score: 10, xp: 10, color: '#ffffff',
    };

    let mutatedCount = 0;
    for (let i = 0; i < 50; i++) {
      const res = system.mutate({ ...baseStats }, 2.0);
      if (res.appliedMutations.length > 0) {
        mutatedCount++;
        const statChanged =
          res.stats.hp !== baseStats.hp ||
          res.stats.damage !== baseStats.damage ||
          res.stats.speed !== baseStats.speed ||
          res.stats.size !== baseStats.size ||
          res.stats.color !== baseStats.color;
        expect(statChanged).toBe(true);
      }
    }
    expect(mutatedCount).toBeGreaterThan(0);
  });
});
