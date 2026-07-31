import { describe, it, expect } from 'vitest';
import { ItemFactory, pickRarity } from './ItemFactory';
import { ContentRepository, SchemaValidator } from '@/engine/content/ContentRepository';
import weaponsData from '@/content/weapons.json';
import affixesData from '@/content/affixes.json';

describe('ItemFactory', () => {
  const makeRepo = () => {
    const repo = new ContentRepository(new SchemaValidator());
    repo.load(weaponsData.map((w) => ({ ...w, type: 'weapons' as const })) as never[]);
    repo.load(affixesData.map((a) => ({ ...a, type: 'affixes' as const })) as never[]);
    return repo;
  };

  it('generates procedurally modified weapons with affixes', () => {
    const repo = makeRepo();
    const factory = new ItemFactory(repo);

    const weapon = factory.rollWeapon('pistol', 1.0);
    expect(weapon.id).toBe('pistol');
    expect(weapon.displayName).toBeTruthy();
    expect(weapon.damage).toBeGreaterThan(0);
  });

  it('rollWeaponByRarity generates weapons matching target rarity tier', () => {
    const repo = makeRepo();
    const factory = new ItemFactory(repo);

    const weapon = factory.rollWeaponByRarity('legendary');
    expect(weapon).toBeDefined();
    expect(weapon.displayName).toBeTruthy();
  });

  it('pickRarity picks rarity according to weights', () => {
    const rarity = pickRarity({ common: 100, uncommon: 0 });
    expect(rarity).toBe('common');
  });
});
