import { describe, it, expect } from 'vitest';
import { LocalApiClient } from './ApiClient';

describe('LocalApiClient', () => {
  it('returns default profile for new player and calculates rewards on endRun', async () => {
    const client = new LocalApiClient();
    const profile = await client.getProfile('test_player_1');

    expect(profile.id).toBe('test_player_1');
    expect(profile.gold).toBe(0);

    const rewards = await client.endRun('run_123', {
      playerId: 'test_player_1',
      score: 500,
      wave: 5,
      kills: 25,
      level: 3,
      duration: 120,
    });

    expect(rewards.gold).toBeGreaterThan(0);
  });
});
