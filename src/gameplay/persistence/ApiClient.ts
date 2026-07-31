/**
 * ApiClient.ts — adaptadores de persistencia de dominio (TDD §4.2, §4.3, Fase 5).
 *
 * Implementa los adaptadores HTTP REST y localStorage para el perfil del jugador
 * y los resultados de Run.
 */

export interface PlayerProfile {
  id: string;
  gold: number;
  gems: number;
  bestScore: number;
  unlocked: string[];
}

export interface RunResult {
  playerId: string;
  score: number;
  wave: number;
  kills: number;
  level: number;
  duration: number;
  result?: 'victory' | 'defeat';
}

export interface Rewards {
  gold: number;
  gems: number;
  xp: number;
}

export interface ApiClient {
  getProfile(playerId: string): Promise<PlayerProfile>;
  startRun(playerId: string, characterId: string, seed: number): Promise<{ runId: string }>;
  endRun(runId: string, result: RunResult): Promise<Rewards>;
  saveProfile(profile: PlayerProfile): Promise<void>;
}

/**
 * LocalApiClient — adaptador localStorage (offline / fallback).
 */
export class LocalApiClient implements ApiClient {
  private readonly KEY = 'mvg_player_profile_v1';

  async getProfile(playerId: string): Promise<PlayerProfile> {
    if (typeof window === 'undefined') return this.defaultProfile(playerId);
    try {
      const raw = localStorage.getItem(this.KEY);
      if (!raw) return this.defaultProfile(playerId);
      const p = JSON.parse(raw) as PlayerProfile;
      if (p.id !== playerId) return this.defaultProfile(playerId);
      return p;
    } catch {
      return this.defaultProfile(playerId);
    }
  }

  private defaultProfile(playerId: string): PlayerProfile {
    return { id: playerId, gold: 0, gems: 0, bestScore: 0, unlocked: [] };
  }

  async startRun(_playerId: string, _characterId: string, _seed: number): Promise<{ runId: string }> {
    return { runId: `run_${Date.now()}` };
  }

  async endRun(_runId: string, result: RunResult): Promise<Rewards> {
    const gold = Math.floor(result.score * 0.1 + result.wave * 5);
    const gems = result.wave >= 5 ? Math.floor(result.wave * 0.5) : 0;
    const xp = result.kills * 2 + result.level * 10;
    const profile = await this.getProfile(result.playerId);
    profile.gold += gold;
    profile.gems += gems;
    profile.bestScore = Math.max(profile.bestScore, result.score);
    await this.saveProfile(profile);
    return { gold, gems, xp };
  }

  async saveProfile(profile: PlayerProfile): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(this.KEY, JSON.stringify(profile));
    } catch { /* noop */ }
  }
}

/**
 * HttpApiClient — adaptador HTTP REST conectado al Backend / PostgreSQL (Fase 5).
 */
export class HttpApiClient implements ApiClient {
  private fallback = new LocalApiClient();

  async getProfile(playerId: string): Promise<PlayerProfile> {
    try {
      const res = await fetch(`/api/player/${playerId}`);
      if (!res.ok) return this.fallback.getProfile(playerId);
      const data = await res.json();
      if (!data.ok || !data.player) return this.fallback.getProfile(playerId);
      return {
        id: data.player.id,
        gold: data.player.gold,
        gems: data.player.gems,
        bestScore: data.player.bestScore,
        unlocked: [],
      };
    } catch {
      return this.fallback.getProfile(playerId);
    }
  }

  async startRun(playerId: string, characterId: string, seed: number): Promise<{ runId: string }> {
    try {
      const res = await fetch('/api/run/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, characterId, seed }),
      });
      if (!res.ok) return this.fallback.startRun(playerId, characterId, seed);
      const data = await res.json();
      return { runId: data.runId };
    } catch {
      return this.fallback.startRun(playerId, characterId, seed);
    }
  }

  async endRun(runId: string, result: RunResult): Promise<Rewards> {
    try {
      const res = await fetch('/api/run/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          runId,
          playerId: result.playerId,
          score: result.score,
          wave: result.wave,
          kills: result.kills,
          result: result.result,
        }),
      });
      if (!res.ok) return this.fallback.endRun(runId, result);
      const data = await res.json();
      return {
        gold: data.rewards.gold,
        gems: data.rewards.gems,
        xp: result.kills * 2 + result.level * 10,
      };
    } catch {
      return this.fallback.endRun(runId, result);
    }
  }

  async saveProfile(profile: PlayerProfile): Promise<void> {
    return this.fallback.saveProfile(profile);
  }
}
