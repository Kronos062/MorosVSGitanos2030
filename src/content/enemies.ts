export interface EnemyDef {
  id: string;
  name: string;
  hp: number;
  speed: number;
  damage: number;
  size: number;
  color: string;
  glow: string;
  shape: string;
  score: number;
  xp: number;
  aiProfile: 'chaser' | 'ranged_kiter' | 'bomber_rush';
  attackRange: number;
  attackCooldown: number;
  projectile?: { speed: number; color: string; size: number };
  explosionRadius?: number;
  tags: string[];
  lore: string;
  /** Director metadata: threat level 1 (fodder) to 5 (boss). */
  threat: number;
  /** Director metadata: spawn budget cost (higher = more expensive to spawn). */
  cost: number;
  /** Director metadata: tactical role for composition templates. */
  role: 'fodder' | 'tank' | 'ranged' | 'assassin' | 'support' | 'burst' | 'boss' | 'miniboss';
}

export const ENEMIES: EnemyDef[] = [
  { id: 'grunt', name: 'Drone', hp: 20, speed: 90, damage: 8, size: 14, color: '#ff3b5c', glow: '#ff3b5c', shape: 'square', score: 10, xp: 10, aiProfile: 'chaser', attackRange: 22, attackCooldown: 0.6, tags: ['melee', 'basic', 'swarm_enemy'], lore: 'Unidad básica de patrulla urbana. Baratos, ruidosos y siempre en manada.', threat: 1, cost: 1, role: 'fodder' },
  { id: 'shooter', name: 'Centinela', hp: 30, speed: 55, damage: 10, size: 16, color: '#b04dff', glow: '#b04dff', shape: 'diamond', score: 25, xp: 20, aiProfile: 'ranged_kiter', attackRange: 280, attackCooldown: 1.8, projectile: { speed: 220, color: '#b04dff', size: 5 }, tags: ['ranged', 'elite', 'support_enemy'], lore: 'Torreta móvil con pulsos de energía. Mantiene distancia y castiga a los imprudentes.', threat: 2, cost: 3, role: 'ranged' },
  { id: 'bomber', name: 'Bombardero', hp: 40, speed: 70, damage: 20, size: 18, color: '#ffe14a', glow: '#ff8800', shape: 'circle_pulse', score: 35, xp: 30, aiProfile: 'bomber_rush', attackRange: 50, attackCooldown: 2.0, explosionRadius: 60, tags: ['melee', 'explosive', 'burst_enemy'], lore: 'Carga inestable. Cuando se acerca, todo el callejón arde.', threat: 2, cost: 3, role: 'burst' },
  { id: 'tank', name: 'Pesado', hp: 100, speed: 40, damage: 18, size: 24, color: '#ff2bd6', glow: '#ff2bd6', shape: 'hexagon', score: 60, xp: 50, aiProfile: 'chaser', attackRange: 28, attackCooldown: 1.0, tags: ['melee', 'tank', 'frontline'], lore: 'Blindaje grueso y golpes demoledores. No intentes pelear cuerpo a cuerpo.', threat: 3, cost: 5, role: 'tank' },
  { id: 'swarm', name: 'Enjambre', hp: 8, speed: 130, damage: 4, size: 9, color: '#39ff88', glow: '#39ff88', shape: 'circle', score: 5, xp: 5, aiProfile: 'chaser', attackRange: 18, attackCooldown: 0.4, tags: ['melee', 'swarm', 'swarm_enemy'], lore: 'Nanodrones diminutos. Individualmente frágiles, juntos son una plaga.', threat: 1, cost: 1, role: 'fodder' },
  { id: 'sniper', name: 'Francotirador Cyber', hp: 25, speed: 45, damage: 25, size: 15, color: '#ff2bd6', glow: '#ff2bd6', shape: 'diamond', score: 40, xp: 35, aiProfile: 'ranged_kiter', attackRange: 450, attackCooldown: 2.8, projectile: { speed: 450, color: '#ff2bd6', size: 4 }, tags: ['ranged', 'sniper', 'burst_enemy'], lore: 'Disparo preciso desde azoteas lejanas. Un impacto y tu carrera termina.', threat: 3, cost: 5, role: 'ranged' },
  { id: 'assassin', name: 'Asesino Neón', hp: 35, speed: 150, damage: 15, size: 12, color: '#00f0ff', glow: '#00f0ff', shape: 'triangle', score: 45, xp: 40, aiProfile: 'chaser', attackRange: 20, attackCooldown: 0.5, tags: ['melee', 'fast', 'assassin_enemy'], lore: 'Velocidad letal y cuchillas de luz. Aparece, corta y desaparece.', threat: 3, cost: 4, role: 'assassin' },
  { id: 'shield_bearer', name: 'Portador de Escudo', hp: 120, speed: 35, damage: 12, size: 22, color: '#0099ff', glow: '#00f0ff', shape: 'hexagon', score: 50, xp: 45, aiProfile: 'chaser', attackRange: 26, attackCooldown: 1.2, tags: ['tank', 'shield', 'frontline'], lore: 'Muro móvil que protege a la línea enemiga. Hay que rodearlo.', threat: 3, cost: 5, role: 'tank' },
  { id: 'summoner', name: 'Invocador Cyber', hp: 60, speed: 50, damage: 8, size: 20, color: '#b04dff', glow: '#b04dff', shape: 'circle', score: 70, xp: 60, aiProfile: 'ranged_kiter', attackRange: 300, attackCooldown: 3.0, projectile: { speed: 180, color: '#b04dff', size: 6 }, tags: ['summoner', 'support', 'support_enemy'], lore: 'Canaliza portales de refuerzo. Elimínalo antes de que llene la calle.', threat: 3, cost: 6, role: 'support' },
  { id: 'cyber_hound', name: 'Ciber Cánido', hp: 28, speed: 120, damage: 11, size: 13, color: '#ff8800', glow: '#ff8800', shape: 'triangle', score: 20, xp: 18, aiProfile: 'chaser', attackRange: 20, attackCooldown: 0.5, tags: ['melee', 'fast', 'beast', 'assassin_enemy'], lore: 'Perro de guerra aumentado. Acecha, salta y desgarra.', threat: 2, cost: 2, role: 'assassin' },
  { id: 'plasma_sentry', name: 'Centinela de Plasma', hp: 45, speed: 40, damage: 14, size: 17, color: '#6ef0ff', glow: '#00f0ff', shape: 'diamond', score: 35, xp: 30, aiProfile: 'ranged_kiter', attackRange: 320, attackCooldown: 1.6, projectile: { speed: 260, color: '#6ef0ff', size: 5 }, tags: ['ranged', 'plasma', 'support_enemy'], lore: 'Disparos de plasma de alta cadencia. Ideal para bloquear pasillos.', threat: 2, cost: 3, role: 'ranged' },
  { id: 'mortar_turret', name: 'Torreta Mortero', hp: 80, speed: 20, damage: 22, size: 21, color: '#ff3b5c', glow: '#ff3b5c', shape: 'square', score: 55, xp: 45, aiProfile: 'ranged_kiter', attackRange: 400, attackCooldown: 2.5, projectile: { speed: 200, color: '#ff3b5c', size: 7 }, tags: ['artillery', 'heavy', 'burst_enemy'], lore: 'Artillería pesada de zona. No te quedes quieto bajo su sombra.', threat: 3, cost: 5, role: 'burst' },
  { id: 'warp_stalker', name: 'Acechador del Vacío', hp: 38, speed: 110, damage: 16, size: 14, color: '#b04dff', glow: '#b04dff', shape: 'diamond', score: 40, xp: 35, aiProfile: 'chaser', attackRange: 24, attackCooldown: 0.7, tags: ['void', 'fast', 'assassin_enemy'], lore: 'Se desliza entre pliegues del vacío. Difícil de predecir.', threat: 2, cost: 3, role: 'assassin' },
  { id: 'bio_fiend', name: 'Engendro Biotóxico', hp: 55, speed: 65, damage: 13, size: 18, color: '#9dff00', glow: '#9dff00', shape: 'circle', score: 30, xp: 28, aiProfile: 'chaser', attackRange: 25, attackCooldown: 0.8, tags: ['bio', 'toxic', 'frontline'], lore: 'Carne mutada y veneno. Cada roce deja un rastro tóxico.', threat: 2, cost: 3, role: 'tank' },
  { id: 'dread_mech', name: 'Titan Ciberpunk', hp: 220, speed: 30, damage: 28, size: 32, color: '#ffe14a', glow: '#ff8800', shape: 'hexagon', score: 120, xp: 100, aiProfile: 'chaser', attackRange: 35, attackCooldown: 1.2, tags: ['boss', 'miniboss', 'frontline'], lore: 'Mini-jefe mecánico. Blindaje extremo y puños de demolición.', threat: 5, cost: 12, role: 'miniboss' },
  { id: 'pulse_orb', name: 'Orbe de Pulso', hp: 15, speed: 100, damage: 6, size: 10, color: '#00f0ff', glow: '#00f0ff', shape: 'circle_pulse', score: 12, xp: 10, aiProfile: 'chaser', attackRange: 18, attackCooldown: 0.5, tags: ['drone', 'light', 'swarm_enemy'], lore: 'Esfera de vigilancia. Débil, pero satura el campo de visión.', threat: 1, cost: 1, role: 'fodder' },
  { id: 'nano_construct', name: 'Constructo Nanómico', hp: 48, speed: 80, damage: 12, size: 15, color: '#39ff88', glow: '#39ff88', shape: 'square', score: 28, xp: 25, aiProfile: 'chaser', attackRange: 22, attackCooldown: 0.7, tags: ['nanite', 'construct', 'support_enemy'], lore: 'Estructura de nanites autorreparable. Hay que aplastarlo rápido.', threat: 2, cost: 3, role: 'support' },
];

export const BOSSES: EnemyDef[] = [
  { id: 'boss_dragon_2030', name: 'Mecha Dragón 2030', hp: 600, speed: 50, damage: 30, size: 40, color: '#ff3b5c', glow: '#ffe14a', shape: 'hexagon', score: 500, xp: 300, aiProfile: 'ranged_kiter', attackRange: 350, attackCooldown: 1.0, projectile: { speed: 300, color: '#ff3b5c', size: 8 }, tags: ['boss', 'dragon'], lore: 'Dragón mecánico del distrito este. Aliento de plasma y garras de titanio.', threat: 5, cost: 20, role: 'boss' },
  { id: 'boss_cyber_kraken', name: 'Kraken Ciberpunk 2030', hp: 750, speed: 40, damage: 35, size: 45, color: '#00f0ff', glow: '#b04dff', shape: 'hexagon', score: 650, xp: 400, aiProfile: 'ranged_kiter', attackRange: 380, attackCooldown: 1.2, projectile: { speed: 280, color: '#00f0ff', size: 9 }, tags: ['boss', 'kraken'], lore: 'Tentáculos de fibra óptica emergen del subsuelo inundado.', threat: 5, cost: 25, role: 'boss' },
  { id: 'boss_golem_prime', name: 'Titán Bronce 2030', hp: 900, speed: 35, damage: 40, size: 50, color: '#ff8800', glow: '#ffe14a', shape: 'hexagon', score: 800, xp: 500, aiProfile: 'chaser', attackRange: 45, attackCooldown: 1.4, tags: ['boss', 'golem'], lore: 'Coloso de bronce y hormigón. Cada paso agrieta el asfalto.', threat: 5, cost: 30, role: 'boss' },
];

export function getEnemy(id: string): EnemyDef | undefined {
  return ENEMIES.find((e) => e.id === id) ?? BOSSES.find((e) => e.id === id);
}

export const BESTIARY_LORE: Record<string, { name: string; desc: string }> = Object.fromEntries(
  [...ENEMIES, ...BOSSES].map((e) => [e.id, { name: e.name, desc: e.lore }]),
);
