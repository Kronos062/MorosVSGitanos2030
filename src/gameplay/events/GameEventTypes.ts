/**
 * GameEventTypes.ts — catálogo de eventos del dominio de juego (TDD §3.6).
 *
 * Define los identificadores de eventos de combate, jugador, loot, minijuegos,
 * bosses y progresión específicos de Moros VS Gitanos 2030.
 */

export const EventTypes = {
  // Ciclo de vida
  RUN_STARTED: 'run:started',
  RUN_ENDED: 'run:ended',
  LEVEL_STARTED: 'level:started',
  ROOM_ENTERED: 'room:entered',
  ROOM_CLEARED: 'room:cleared',

  // Combate
  DAMAGE_DEALT: 'combat:damage_dealt',
  DAMAGE_RECEIVED: 'combat:damage_received',
  ENTITY_KILLED: 'combat:entity_killed',
  STATUS_EFFECT_APPLIED: 'combat:status_applied',
  STATUS_EFFECT_EXPIRED: 'combat:status_expired',

  // Jugador
  PLAYER_LEVELED_UP: 'player:leveled_up',
  PLAYER_DIED: 'player:died',
  PLAYER_DASHED: 'player:dashed',

  // Loot / Inventario
  WEAPON_PICKED_UP: 'loot:weapon_picked',
  RELIC_EQUIPPED: 'loot:relic_equipped',
  CHEST_OPENED: 'loot:chest_opened',
  ITEM_DROPPED: 'loot:item_dropped',

  // Progresión / Legados
  LEGACY_THRESHOLD_REACHED: 'legacy:threshold',
  SYNERGY_UNLOCKED: 'synergy:unlocked',
  RESONANCE_TRIGGERED: 'resonance:triggered',

  // Mundo
  WORLD_EVENT_ACTIVATED: 'world:event_activated',
  BOSS_PHASE_CHANGED: 'boss:phase_changed',

  // FX
  SCREEN_SHAKE: 'fx:screen_shake',
  HIT_STOP: 'fx:hit_stop',
  PARTICLE_BURST: 'fx:particle_burst',
  FLOAT_TEXT: 'fx:float_text',
  PLAY_SOUND: 'fx:play_sound',

  // UI
  SCORE_CHANGED: 'ui:score_changed',
  COMBO_CHANGED: 'ui:combo_changed',
  WAVE_STARTED: 'ui:wave_started',

  // Ciclo de juego
  PAUSE: 'game:pause',
  RESUME: 'game:resume',
} as const;

export type GameEventType = (typeof EventTypes)[keyof typeof EventTypes];
