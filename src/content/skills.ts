import { runRandom } from '../game/random';

export interface SkillContext {
  weaponTags: string[];
  weaponElement?: string;
  equippedSetIds: string[];
}

export interface SkillDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: string;
  mods: Array<{ stat: string; op: string; value: number }>;
  /** When present the skill only appears if ALL conditions are satisfied. */
  condition?: {
    /** At least one weapon tag must match. */
    weaponTags?: string[];
    /** Weapon must have this element (affix element). */
    weaponElement?: string;
    /** Player must have at least one of these sets equipped. */
    setIds?: string[];
  };
}

export const SKILLS: SkillDef[] = [
  // ── COMMON ──────────────────────────────────────────────
  { id: 'skill_damage', name: 'Sobrecarga de Impacto', description: '+20% Daño de arma.', icon: '⚔️', rarity: 'common', mods: [{ stat: 'damageMult', op: 'add_pct', value: 0.2 }] },
  { id: 'skill_speed', name: 'Propulsor Sintético', description: '+15% Velocidad de movimiento.', icon: '👟', rarity: 'common', mods: [{ stat: 'speedMult', op: 'add_pct', value: 0.15 }] },
  { id: 'skill_max_hp', name: 'Núcleo Vitalicio', description: '+30 HP Máximos y curación completa.', icon: '❤️', rarity: 'common', mods: [{ stat: 'maxHp', op: 'add', value: 30 }] },
  { id: 'skill_crit_small', name: 'Mira Táctica', description: '+8% Probabilidad de golpe crítico.', icon: '🎯', rarity: 'common', mods: [{ stat: 'critChance', op: 'add', value: 0.08 }] },
  { id: 'skill_fire_rate', name: 'Percusión Acelerada', description: '+12% Cadencia de disparo.', icon: '🔫', rarity: 'common', mods: [{ stat: 'fireRateMult', op: 'add_pct', value: 0.12 }] },
  { id: 'skill_shield_small', name: 'Escudo Emergente', description: '+1 Carga de escudo.', icon: '🛡️', rarity: 'common', mods: [{ stat: 'shield', op: 'add', value: 1 }] },
  { id: 'skill_speed_bullet', name: 'Pólvora Sintética', description: '+8% Cadencia de disparo.', icon: '💨', rarity: 'common', mods: [{ stat: 'fireRateMult', op: 'add_pct', value: 0.08 }] },
  { id: 'skill_projectile_size', name: 'Calibre Ampliado', description: '+4 Tamaño de proyectil.', icon: '🔵', rarity: 'common', mods: [{ stat: 'projectileSize', op: 'add', value: 4 }] },

  // ── UNCOMMON ────────────────────────────────────────────
  { id: 'skill_pierce', name: 'Proyectiles de Tungsteno', description: '+1 Perforación a todos tus disparos.', icon: '🏹', rarity: 'uncommon', mods: [{ stat: 'pierce', op: 'add', value: 1 }] },
  { id: 'skill_shield', name: 'Matriz Defensiva', description: '+1 Carga de escudo regenerable.', icon: '🛡️', rarity: 'uncommon', mods: [{ stat: 'shield', op: 'add', value: 1 }] },
  { id: 'skill_bounce', name: 'Proyectil Reboteante', description: '+1 Rebote a todos tus disparos.', icon: '🔁', rarity: 'uncommon', mods: [{ stat: 'bounce', op: 'add', value: 1 }] },
  { id: 'skill_explosion', name: 'Munición Explosiva', description: '+20 Radio de explosión.', icon: '💥', rarity: 'uncommon', mods: [{ stat: 'explosionRadius', op: 'add', value: 20 }] },
  { id: 'skill_pierce_double', name: 'Perforación Etérea', description: '+2 Perforación a todos tus disparos.', icon: '✨', rarity: 'uncommon', mods: [{ stat: 'pierce', op: 'add', value: 2 }], condition: { weaponTags: ['kinetic'] } },
  { id: 'skill_lifesteal_small', name: 'Drenaje Menor', description: '+3% Robo de vida por baja.', icon: '🩸', rarity: 'uncommon', mods: [{ stat: 'lifesteal', op: 'add', value: 0.03 }] },

  // ── RARE ────────────────────────────────────────────────
  { id: 'skill_crit', name: 'Mira Ciber-Óptica', description: '+12% Probabilidad de golpe crítico.', icon: '🎯', rarity: 'rare', mods: [{ stat: 'critChance', op: 'add', value: 0.12 }] },
  { id: 'skill_vampirism', name: 'Inyector Nanómico', description: '+5% Robo de vida por baja.', icon: '💉', rarity: 'rare', mods: [{ stat: 'lifesteal', op: 'add', value: 0.05 }] },
  { id: 'skill_crit_damage', name: 'Impacto Devastador', description: '+0.4 Daño crítico multiplicado.', icon: '💀', rarity: 'rare', mods: [{ stat: 'critDamageMult', op: 'add', value: 0.4 }] },
  { id: 'skill_speed_rare', name: 'Propulsión Avanzada', description: '+20% Velocidad de movimiento.', icon: '💨', rarity: 'rare', mods: [{ stat: 'speedMult', op: 'add_pct', value: 0.2 }] },
  { id: 'skill_pierce_rare', name: 'Perforación Profunda', description: '+2 Perforación a todos tus disparos.', icon: '🎯', rarity: 'rare', mods: [{ stat: 'pierce', op: 'add', value: 2 }] },
  { id: 'skill_count_small', name: 'Disparo Dual', description: '+1 Proyectil adicional por disparo.', icon: '✨', rarity: 'rare', mods: [{ stat: 'count', op: 'add', value: 1 }] },
  { id: 'skill_fire_element', name: 'Ígnea Potenciada', description: '+30% Daño de arma. Solo con arma de fuego.', icon: '🔥', rarity: 'rare', mods: [{ stat: 'damageMult', op: 'add_pct', value: 0.3 }], condition: { weaponElement: 'fire' } },
  { id: 'skill_electric_element', name: 'Carga Voltaica', description: '+25% Cadencia. Solo con arma eléctrica.', icon: '⚡', rarity: 'rare', mods: [{ stat: 'fireRateMult', op: 'add_pct', value: 0.25 }], condition: { weaponElement: 'electric' } },
  { id: 'skill_set_ranged', name: 'Tiro en Movimiento', description: '+18% Daño. Requiere set ranged.', icon: '🏃', rarity: 'rare', mods: [{ stat: 'damageMult', op: 'add_pct', value: 0.18 }], condition: { setIds: ['set_pirate'] } },
  { id: 'skill_shield_up', name: 'Barrera Reforzada', description: '+2 Cargas de escudo.', icon: '🛡️', rarity: 'rare', mods: [{ stat: 'shield', op: 'add', value: 2 }] },

  // ── EPIC ────────────────────────────────────────────────
  { id: 'skill_multishot', name: 'Disipador Múltiple', description: '+1 Proyectil adicional por disparo.', icon: '✨', rarity: 'epic', mods: [{ stat: 'count', op: 'add', value: 1 }] },
  { id: 'skill_pierce_epic', name: 'Balas Incansables', description: '+3 Perforación a todos tus disparos.', icon: '🏹', rarity: 'epic', mods: [{ stat: 'pierce', op: 'add', value: 3 }] },
  { id: 'skill_bounce_epic', name: 'Rebote Caótico', description: '+2 Rebotes a todos tus disparos.', icon: '🔄', rarity: 'epic', mods: [{ stat: 'bounce', op: 'add', value: 2 }] },
  { id: 'skill_armor_break', name: 'Coraza Perforada', description: '+30% Daño de arma. Solo con arma pesada.', icon: '🔨', rarity: 'epic', mods: [{ stat: 'damageMult', op: 'add_pct', value: 0.3 }], condition: { weaponTags: ['heavy'] } },
  { id: 'skill_fire_rate_epic', name: 'Ráfaga Ultrarrápida', description: '+25% Cadencia de disparo.', icon: '🔫', rarity: 'epic', mods: [{ stat: 'fireRateMult', op: 'add_pct', value: 0.25 }] },
  { id: 'skill_crit_epic', name: 'Punto Débil', description: '+18% Probabilidad de golpe crítico.', icon: '🎯', rarity: 'epic', mods: [{ stat: 'critChance', op: 'add', value: 0.18 }] },
  { id: 'skill_vampirism_epic', name: 'Extracción Nanómica', description: '+8% Robo de vida por baja.', icon: '💉', rarity: 'epic', mods: [{ stat: 'lifesteal', op: 'add', value: 0.08 }] },
  { id: 'skill_fire_ammo', name: 'Cápsulas Incendiarias', description: '+1 Proyectil. Solo con arma de fuego.', icon: '🔥', rarity: 'epic', mods: [{ stat: 'count', op: 'add', value: 1 }], condition: { weaponElement: 'fire' } },
  { id: 'skill_set_berserker', name: 'Furia del Berserker', description: '+20% Daño. Requiere set Berserker.', icon: '💢', rarity: 'epic', mods: [{ stat: 'damageMult', op: 'add_pct', value: 0.2 }], condition: { setIds: ['set_berserker'] } },
  { id: 'skill_set_pirate', name: 'Botín del Pirata', description: '+25% Oro ganado. Requiere set Pirata.', icon: '💰', rarity: 'epic', mods: [{ stat: 'gold_boost', op: 'add_pct', value: 0.25 }], condition: { setIds: ['set_pirate'] } },

  // ── LEGENDARY ───────────────────────────────────────────
  { id: 'skill_legendary_multishot', name: 'Tormenta de Plomo', description: '+2 Proyectiles. Solo con arma rápida.', icon: '🌟', rarity: 'legendary', mods: [{ stat: 'count', op: 'add', value: 2 }], condition: { weaponTags: ['smg', 'rapid'] } },
  { id: 'skill_legendary_vamp', name: 'Sed de Sangre', description: '+12% Robo de vida por baja.', icon: '🧛', rarity: 'legendary', mods: [{ stat: 'lifesteal', op: 'add', value: 0.12 }] },
  { id: 'skill_legendary_bounce', name: 'Ricochet Cósmico', description: '+3 Rebotes a todos tus disparos.', icon: '🌌', rarity: 'legendary', mods: [{ stat: 'bounce', op: 'add', value: 3 }] },
  { id: 'skill_legendary_pierce', name: 'Perforación Absoluta', description: '+4 Perforación a todos tus disparos.', icon: '💫', rarity: 'legendary', mods: [{ stat: 'pierce', op: 'add', value: 4 }], condition: { weaponTags: ['kinetic'] } },
  { id: 'skill_legendary_crit', name: 'Golpe Vital', description: '+0.8 Daño crítico y +4% Robo de vida.', icon: '💀', rarity: 'legendary', mods: [{ stat: 'critDamageMult', op: 'add', value: 0.8 }, { stat: 'lifesteal', op: 'add', value: 0.04 }] },
];

/** Test whether a skill's conditions are met given the current build context. */
function skillMatchesContext(skill: SkillDef, ctx?: SkillContext): boolean {
  if (!skill.condition || !ctx) return true;
  const c = skill.condition;
  if (c.weaponTags && !c.weaponTags.some((t) => ctx.weaponTags.includes(t))) return false;
  if (c.weaponElement && ctx.weaponElement !== c.weaponElement) return false;
  if (c.setIds && !c.setIds.some((s) => ctx.equippedSetIds.includes(s))) return false;
  return true;
}

/**
 * Picks `count` random skills from the pool.
 * When a SkillContext is supplied, conditional skills that don't match the
 * current build are excluded from the selection.
 */
export function pickSkillChoices(count = 3, ctx?: SkillContext): SkillDef[] {
  const pool = SKILLS.filter((s) => skillMatchesContext(s, ctx));
  const result: SkillDef[] = [];
  const available = [...pool];
  while (result.length < count && available.length > 0) {
    const i = runRandom.int('choice', available.length);
    result.push(available.splice(i, 1)[0]);
  }
  return result;
}
