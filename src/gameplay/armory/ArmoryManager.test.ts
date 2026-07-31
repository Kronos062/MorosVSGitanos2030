import { describe, it, expect } from 'vitest';
import { ArmoryStore as ArmoryManager } from '../persistence/ArmoryStore';

describe('ArmoryManager', () => {
  it('records and verifies weapon discovery', () => {
    const discovered = ArmoryManager.recordDiscovery('minigun');
    expect(discovered['minigun']).toBe(true);
    expect(ArmoryManager.isDiscovered('minigun')).toBe(true);
  });
});
