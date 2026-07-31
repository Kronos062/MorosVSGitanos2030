export interface SkillDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: string;
  mods: Array<{ stat: string; op: string; value: number }>;
}

export const SKILLS: SkillDef[] = [
  { id: 'skill_damage', name: 'Sobrecarga de Impacto', description: '+20% Daño de arma.', icon: '⚔️', rarity: 'common', mods: [{ stat: 'damageMult', op: 'add_pct', value: 0.2 }] },
  { id: 'skill_speed', name: 'Propulsor Sintético', description: '+15% Velocidad de movimiento.', icon: '👟', rarity: 'common', mods: [{ stat: 'speedMult', op: 'add_pct', value: 0.15 }] },
  { id: 'skill_pierce', name: 'Proyectiles de Tungsteno', description: '+1 Perforación a todos tus disparos.', icon: '🏹', rarity: 'uncommon', mods: [{ stat: 'pierce', op: 'add', value: 1 }] },
  { id: 'skill_shield', name: 'Matriz Defensiva', description: '+1 Carga de escudo regenerable.', icon: '🛡️', rarity: 'uncommon', mods: [{ stat: 'shield', op: 'add', value: 1 }] },
  { id: 'skill_crit', name: 'Mira Ciber-Óptica', description: '+12% Probabilidad de golpe crítico.', icon: '🎯', rarity: 'rare', mods: [{ stat: 'critChance', op: 'add', value: 0.12 }] },
  { id: 'skill_vampirism', name: 'Inyector Nanómico', description: '+5% Robo de vida por baja.', icon: '💉', rarity: 'rare', mods: [{ stat: 'lifesteal', op: 'add', value: 0.05 }] },
  { id: 'skill_max_hp', name: 'Núcleo Vitalicio', description: '+30 HP Máximos y curación completa.', icon: '❤️', rarity: 'common', mods: [{ stat: 'maxHp', op: 'add', value: 30 }] },
  { id: 'skill_multishot', name: 'Disipador Múltiple', description: '+1 Proyectil adicional por disparo.', icon: '✨', rarity: 'epic', mods: [{ stat: 'count', op: 'add', value: 1 }] },
];

export function pickSkillChoices(count = 3): SkillDef[] {
  const pool = [...SKILLS];
  const result: SkillDef[] = [];
  while (result.length < count && pool.length > 0) {
    const i = Math.floor(Math.random() * pool.length);
    result.push(pool.splice(i, 1)[0]);
  }
  return result;
}
