export type RandomStream =
  | 'map'
  | 'loot'
  | 'encounter'
  | 'event'
  | 'combat'
  | 'choice'
  | 'visual';

/**
 * Single seeded random service shared by every procedural system.
 * Named streams are derived from the same run seed so visual frame rate
 * cannot change map, loot, encounter, or combat outcomes.
 */
class RunRandom {
  private seed = 1;
  private readonly states = new Map<RandomStream, number>();

  setSeed(seed: number | string): number {
    const normalized = typeof seed === 'number' ? seed >>> 0 : this.hash(seed);
    this.seed = normalized || 1;
    this.states.clear();
    return this.seed;
  }

  getSeed(): number {
    return this.seed;
  }

  next(stream: RandomStream): number {
    let state = this.states.get(stream);
    if (state === undefined) {
      state = this.hash(`${this.seed}:${stream}`) || 1;
    }

    // Mulberry32: compact, deterministic, and adequate for gameplay RNG.
    state = (state + 0x6d2b79f5) >>> 0;
    this.states.set(stream, state);
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  int(stream: RandomStream, maxExclusive: number): number {
    if (maxExclusive <= 0) return 0;
    return Math.floor(this.next(stream) * maxExclusive);
  }

  private hash(value: string): number {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i++) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }
}

export const runRandom = new RunRandom();

/** Entropy is used only to choose a new run seed, never for run decisions. */
export function createRunSeed(): number {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const value = new Uint32Array(1);
    crypto.getRandomValues(value);
    return value[0] || 1;
  }
  return (Date.now() ^ performance.now() * 1000) >>> 0 || 1;
}