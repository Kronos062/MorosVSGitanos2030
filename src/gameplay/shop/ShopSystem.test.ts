import { describe, it, expect } from 'vitest';
import { ShopSystem } from './ShopSystem';

describe('ShopSystem', () => {
  it('calculates exponential upgrade costs correctly', () => {
    const shop = new ShopSystem();
    expect(shop.getCost(0)).toBe(100);
    expect(shop.getCost(1)).toBe(150);
    expect(shop.getCost(2)).toBe(225);
  });
});
