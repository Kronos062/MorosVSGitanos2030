/* ======================================================================
 * bosses.ts — Data-driven Boss Phase Definitions.
 * ----------------------------------------------------------------------
 * Each boss has an array of phases. Phases activate when HP% drops below
 * a threshold. Phase modifiers are applied ON TOP of the boss's base
 * stats (which are already scaled by map progression).
 * Adding a new boss requires ZERO engine changes.
 * ==================================================================== */

export interface BossPhase {
  /** Activate when HP% (0..1) drops below this value. */
  hpThreshold: number;
  /** Human-readable phase name (shown in UI). */
  name: string;
  /** Description of what happens (UI hint). */
  description: string;
  /** Stat multipliers ON TOP of current (applied cumulatively when entering phase). */
  speedMult?: number;
  damageMult?: number;
  attackCooldownMult?: number;
  /** Extra projectile attributes during this phase (merged with boss base). */
  extraProjectile?: { speed?: number; color?: string; size?: number };
  /** Enemies to spawn when entering this phase (by defId). */
  adds?: Array<{ defId: string; count: number }>;
  /** Color/glow override (visual indicator of phase). */
  colorOverride?: string;
  glowOverride?: string;
  /** If true, boss becomes invulnerable briefly when entering this phase. */
  phaseInvuln?: number;
}

export interface BossDef {
  bossId: string;
  name: string;
  lore: string;
  phases: BossPhase[];
}

export const BOSS_DEFS: BossDef[] = [
  {
    bossId: 'boss_dragon_2030',
    name: 'Mecha Dragón 2030',
    lore: 'Dragón mecánico del distrito este. Aliento de plasma y garras de titanio.',
    phases: [
      {
        hpThreshold: 1.0,
        name: 'Vigilancia',
        description: 'El dragón observa desde la distancia, disparando proyectiles de plasma.',
      },
      {
        hpThreshold: 0.55,
        name: 'Furia Ígnea',
        description: 'Enfurecido: dispara más rápido y sus ataques ganan velocidad.',
        speedMult: 1.15,
        attackCooldownMult: 0.8,
        extraProjectile: { speed: 1.15, size: 1.2 },
        colorOverride: '#ffe14a',
        glowOverride: '#ff6a00',
        phaseInvuln: 0.8,
      },
      {
        hpThreshold: 0.2,
        name: 'Eco del Dragón',
        description: 'Invoca drones de apoyo. Desesperación total.',
        attackCooldownMult: 0.7,
        adds: [
          { defId: 'pulse_orb', count: 3 },
          { defId: 'grunt', count: 2 },
        ],
        colorOverride: '#ffe14a',
        glowOverride: '#ff3b5c',
        phaseInvuln: 1.0,
      },
    ],
  },
  {
    bossId: 'boss_cyber_kraken',
    name: 'Kraken Ciberpunk 2030',
    lore: 'Tentáculos de fibra óptica emergen del subsuelo inundado.',
    phases: [
      {
        hpThreshold: 1.0,
        name: 'Emergencia',
        description: 'Tentáculos controlados disparan proyectiles de plasma.',
      },
      {
        hpThreshold: 0.55,
        name: 'Escalada Tóxica',
        description: 'La electricidad se intensifica. Tentáculos se mueven más rápido.',
        speedMult: 1.2,
        attackCooldownMult: 0.85,
        extraProjectile: { speed: 1.12, color: '#b04dff' },
        colorOverride: '#b04dff',
        glowOverride: '#6ef0ff',
        phaseInvuln: 0.8,
      },
      {
        hpThreshold: 0.22,
        name: 'Kraken Desatado',
        description: 'Invoca drones de apoyo y dispara en ráfagas.',
        attackCooldownMult: 0.65,
        adds: [
          { defId: 'plasma_sentry', count: 2 },
          { defId: 'pulse_orb', count: 2 },
        ],
        colorOverride: '#00f0ff',
        glowOverride: '#b04dff',
        phaseInvuln: 1.0,
      },
    ],
  },
  {
    bossId: 'boss_golem_prime',
    name: 'Titán Bronce 2030',
    lore: 'Coloso de bronce y hormigón. Cada paso agrieta el asfalto.',
    phases: [
      {
        hpThreshold: 1.0,
        name: 'Vigilia',
        description: 'El titán avanza lentamente, aplastando todo a su paso.',
      },
      {
        hpThreshold: 0.50,
        name: 'Sismo',
        description: 'El ritmo aumenta. Los ataques generan ondas expansivas.',
        speedMult: 1.25,
        damageMult: 1.15,
        attackCooldownMult: 0.85,
        colorOverride: '#ffe14a',
        glowOverride: '#ff8800',
        phaseInvuln: 0.7,
      },
      {
        hpThreshold: 0.22,
        name: 'Ruptura Tectónica',
        description: 'Modo rabia: velocidad máxima, invoca constructos de apoyo.',
        speedMult: 1.5,
        damageMult: 1.25,
        attackCooldownMult: 0.7,
        adds: [
          { defId: 'shield_bearer', count: 2 },
          { defId: 'nano_construct', count: 2 },
        ],
        colorOverride: '#ffe14a',
        glowOverride: '#ff5500',
        phaseInvuln: 1.0,
      },
    ],
  },
];

/** Lookup boss phases by bossId. Returns empty array for unknown bosses. */
export function getBossPhases(bossId: string): BossPhase[] {
  const def = BOSS_DEFS.find((b) => b.bossId === bossId);
  return def?.phases ?? [];
}
