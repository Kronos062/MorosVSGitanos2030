/**
 * gameplay/main.ts — bootstrap del juego (TDD §3.3, §12).
 *
 * Ensambla el motor y el gameplay. Registra contenido, configura sistemas,
 * arranca el game loop. El engine no sabe que existe este archivo.
 */

import { World, ComponentRegistry } from '@/engine/ecs/World';
import { SystemScheduler, GameLoop, type SystemContext } from '@/engine/core/GameLoop';
import { EventBus } from '@/engine/events/EventBus';
import { EventTypes } from '@/gameplay/events/GameEventTypes';
import { Canvas2DRenderer } from '@/engine/rendering/Canvas2DRenderer';
import { ParticleSystem, ParticleComponentDef, PositionComponentDef } from '@/engine/rendering/ParticleSystem';
import { InputManager } from '@/engine/input/InputManager';
import { CollisionSystem } from '@/engine/physics/CollisionSystem';
import { AudioManager } from '@/engine/audio/AudioManager';
import { ContentRepository, ContentLoader, SchemaValidator } from '@/engine/content/ContentRepository';
import { EffectExecutor, RuleEngine } from '@/engine/rules/RuleEngine';

// Contenido (JSON agrupado modular)
import { allContentBundles } from '@/content';

// Gameplay
import { registerGameplayComponents } from '@/gameplay/components';
import {
  PlayerInputSystem, MovementSystem, PlayerShootSystem, ProjectileSystem,
  AISystem, CombatResolutionSystem, DamageApplicationSystem, DeathSystem,
  PickupSystem, StatusSystem, DashSystem, ParticleUpdateSystem,
  RenderSystem, CameraFollowSystem, ScreenShakeSystem, ScoreSystem,
  WeaponInteractionSystem, type WeaponPromptData,
} from '@/gameplay/systems';
import { ChestSystem, ChestComponentDef } from '@/gameplay/systems/ChestSystem';
import { BossSystem, BossComponentDef, type BossComponent } from '@/gameplay/boss/BossSystem';
import { WorldEventSystem } from '@/gameplay/events/WorldEventSystem';
import { PetSystem } from '@/gameplay/pets/PetSystem';
import { SynergySystem } from '@/gameplay/synergies/SynergySystem';
import { RelicSystem } from '@/gameplay/relics/RelicSystem';
import { LegacySystem } from '@/gameplay/legacies/LegacySystem';
import { RadarSystem, type RadarData } from '@/gameplay/systems/RadarSystem';
import { RoomSystem } from '@/gameplay/systems/RoomSystem';
import { RunManager } from '@/gameplay/run/RunManager';
import { ItemFactory } from '@/gameplay/items/ItemFactory';
import { MutationSystem } from '@/gameplay/mutations/MutationSystem';
import { LevelGenerator } from '@/gameplay/run/LevelGenerator';

export interface GameStats {
  hp: number;
  maxHp: number;
  shield: number;
  level: number;
  dashPct: number;
  radarData: RadarData;
  activeEventName?: string;
  activeEventTimer?: number;
  activeSynergies: string[];
  bossStats?: { name: string; hp: number; maxHp: number; phase: number } | null;
  weaponPrompt?: WeaponPromptData | null;
}

export interface GameHandle {
  start(characterId?: string): void;
  pause(): void;
  resume(): void;
  togglePause(): void;
  restart(characterId?: string): void;
  destroy(): void;
  getInput: () => ReturnType<InputManager['poll']>;
  getScore: () => ReturnType<ScoreSystem['comboMultiplier']> extends number ? { score: number; wave: number; kills: number; combo: number; multiplier: number } : never;
  getRunState: () => { ended: 'victory' | 'defeat' | null; currentWave: number };
  onStats: (cb: (stats: GameStats) => void) => () => void;
  triggerWorldEvent: (eventId: string) => void;
  setAudioVolume: (volume: number) => void;
  applySkill: (skillId: string) => void;
  equipRelic: (relicId: string) => void;
  getBindings: () => import('@/engine/input/InputManager').KeyBindings;
  setBinding: (action: keyof import('@/engine/input/InputManager').KeyBindings, primaryCode: string) => void;
  resetBindings: () => void;
}

export function bootstrapGame(canvas: HTMLCanvasElement): GameHandle {
  // ---------- Engine core ----------
  const registry = new ComponentRegistry();
  registry.register(PositionComponentDef);
  registry.register(ParticleComponentDef);
  registry.register(ChestComponentDef);
  registry.register(BossComponentDef);
  registerGameplayComponents(registry);

  const world = new World(registry);
  const events = new EventBus();

  // ---------- Content pipeline ----------
  const validator = new SchemaValidator();
  const repo = new ContentRepository(validator);
  const loader = new ContentLoader(repo);

  loader.loadBundles(allContentBundles).then(({ loaded, errors }) => {
    if (errors.length) console.warn('Content load errors:', errors);
    console.info(`[Content] ${loaded} elementos cargados`, repo.stats());
  });

  // ---------- Audio ----------
  const audio = new AudioManager();
  audio.register({ id: 'shoot', synth: AudioManager.synthShoot });
  audio.register({ id: 'shoot_heavy', synth: AudioManager.synthShoot });
  audio.register({ id: 'hit', synth: AudioManager.synthHit });
  audio.register({ id: 'kill', synth: AudioManager.synthKill });
  audio.register({ id: 'hurt', synth: AudioManager.synthHurt });
  audio.register({ id: 'pickup', synth: AudioManager.synthPickup });
  audio.register({ id: 'levelup', synth: AudioManager.synthLevelUp });
  audio.register({ id: 'dash', synth: AudioManager.synthDash });
  audio.register({ id: 'explosion', synth: AudioManager.synthExplosion });
  audio.register({ id: 'button', synth: AudioManager.synthButton });
  audio.register({ id: 'death', synth: AudioManager.synthHurt });
  audio.register({ id: 'wave_start', synth: AudioManager.synthLevelUp });

  events.on<{ id: string }>(EventTypes.PLAY_SOUND, (e) => audio.play(e.id));

  // ---------- Renderer ----------
  const renderer = new Canvas2DRenderer(canvas, 1280, 800);
  const resize = () => renderer.resize(window.innerWidth, window.innerHeight);
  window.addEventListener('resize', resize);

  // ---------- Input ----------
  const input = new InputManager();

  // ---------- Physics ----------
  const collisions = new CollisionSystem(80);

  // ---------- Particles ----------
  const particles = new ParticleSystem(world, events);

  // ---------- Rule Engine & Effect Handlers ----------
  const effectExecutor = new EffectExecutor();
  const ruleEngine = new RuleEngine(events, effectExecutor);

  effectExecutor.register('heal', (eff) => {
    if (eff.kind === 'heal') {
      const p = world.getTag('player');
      if (p !== undefined) {
        const h = world.getComponent<{ current: number; max: number }>(p, 'Health');
        if (h) h.current = Math.min(h.max, h.current + eff.value);
      }
    }
  });

  effectExecutor.register('score', (eff) => {
    if (eff.kind === 'score') {
      events.emit(EventTypes.SCORE_CHANGED, { delta: eff.value });
    }
  });

  effectExecutor.register('stat_mod', () => {});

  // ---------- Factories & Systems ----------
  const itemFactory = new ItemFactory(repo);
  const mutationSystem = new MutationSystem(repo);
  const levelGenerator = new LevelGenerator(repo, 10);
  const worldEventSystem = new WorldEventSystem(events, repo);
  const petSystem = new PetSystem(world, events, repo);
  const synergySystem = new SynergySystem(world, events, repo);
  const relicSystem = new RelicSystem(world, events, repo, ruleEngine);
  const legacySystem = new LegacySystem(world, events, repo, ruleEngine);
  const getInput = () => input.poll();
  const radarSystem = new RadarSystem(getInput);
  const roomSystem = new RoomSystem(world, events, repo, mutationSystem);
  const weaponInteractionSystem = new WeaponInteractionSystem(getInput, repo);

  const scheduler = new SystemScheduler();

  scheduler.add(new PlayerInputSystem(getInput));
  scheduler.add(new DashSystem(getInput));
  scheduler.add(new MovementSystem());
  scheduler.add(new PlayerShootSystem(getInput));
  scheduler.add(new AISystem());
  scheduler.add(new BossSystem(world, events, repo));
  scheduler.add(worldEventSystem);
  scheduler.add(petSystem);
  scheduler.add(synergySystem);
  scheduler.add(relicSystem);
  scheduler.add(legacySystem);
  scheduler.add(radarSystem);
  scheduler.add(roomSystem);
  scheduler.add(weaponInteractionSystem);
  scheduler.add(new ProjectileSystem());
  scheduler.add(new CombatResolutionSystem(collisions));
  scheduler.add(new ChestSystem(world, events, repo, itemFactory));
  scheduler.add(new DamageApplicationSystem(events));
  scheduler.add(new DeathSystem(events));
  scheduler.add(new PickupSystem(events));
  scheduler.add(new StatusSystem());
  const scoreSystem = new ScoreSystem(events);
  scheduler.add(scoreSystem);
  scheduler.add(new ParticleUpdateSystem(particles));
  scheduler.add(new CameraFollowSystem(renderer));
  scheduler.add(new ScreenShakeSystem(renderer, events));
  scheduler.add(new RenderSystem(renderer));

  // ---------- Contexto del loop ----------
  const ctx: SystemContext = {
    world, events,
    time: { elapsed: 0, fixedDt: 1 / 60, alpha: 0, frameDt: 0, timeScale: 1 },
  };
  const loop = new GameLoop(scheduler, ctx, { fixedHz: 60 });

  // ---------- RunManager ----------
  const createRunManager = () =>
    new RunManager(world, events, repo, scoreSystem, mutationSystem, levelGenerator, petSystem);

  let runManager = createRunManager();

  const runUpdateSystem = {
    name: 'RunUpdate',
    phase: 'fixed' as const,
    priority: 95,
    update: (c: SystemContext) => runManager.update(c.time.fixedDt),
  };
  scheduler.add(runUpdateSystem);

  // ---------- Stats listener ----------
  type StatsCallback = (stats: GameStats) => void;
  const statsListeners = new Set<StatsCallback>();

  const pushStats = () => {
    const playerEnt = world.getTag('player');
    if (playerEnt === undefined) return;
    const h = world.getComponent<{ current: number; max: number }>(playerEnt, 'Health');
    const p = world.getComponent<{ dashCooldown: number; dashCooldownMax: number; level: number }>(playerEnt, 'Player');
    const sh = world.getComponent<{ charges: number }>(playerEnt, 'Shield');
    if (!h || !p) return;

    // Detectar Boss activo en la sala
    let bossStats: GameStats['bossStats'] = null;
    for (const [bossEnt, bossCmp] of world.iter<BossComponent>('Boss')) {
      const bHealth = world.getComponent<{ current: number; max: number }>(bossEnt, 'Health');
      if (bHealth) {
        const bossDef = repo.get<{ name: string }>('bosses', bossCmp.bossId);
        bossStats = {
          name: bossDef?.name ?? bossCmp.bossId,
          hp: bHealth.current,
          maxHp: bHealth.max,
          phase: bossCmp.currentPhase,
        };
        break;
      }
    }

    const stats: GameStats = {
      hp: h.current,
      maxHp: h.max,
      shield: sh?.charges ?? 0,
      level: p.level,
      dashPct: 1 - p.dashCooldown / p.dashCooldownMax,
      radarData: radarSystem.radarData,
      activeEventName: worldEventSystem.activeEvent?.name,
      activeEventTimer: Math.ceil(worldEventSystem.eventTimer),
      activeSynergies: Array.from(synergySystem.activeSynergies),
      bossStats,
      weaponPrompt: weaponInteractionSystem.activePrompt,
    };
    for (const cb of statsListeners) cb(stats);
  };

  scheduler.add({
    name: 'StatsPush',
    phase: 'render',
    priority: 100,
    update: () => pushStats(),
  });

  // ---------- API pública ----------
  let paused = false;
  let activeCharId = 'tariq';

  const handle: GameHandle = {
    start(characterId?: string) {
      if (characterId) activeCharId = characterId;
      audio.resume();
      runManager.startRun({ characterId: activeCharId });
      relicSystem.equipRelic('heal_potion');
      if (!loop.isRunning()) loop.start();
      paused = false;
    },
    pause() {
      if (paused) return;
      paused = true;
      loop.stop();
      events.emit(EventTypes.PAUSE, {});
    },
    resume() {
      if (!paused) return;
      paused = false;
      loop.start();
      events.emit(EventTypes.RESUME, {});
    },
    togglePause() {
      if (paused) handle.resume(); else handle.pause();
    },
    restart(characterId?: string) {
      if (characterId) activeCharId = characterId;

      world.clear();
      ruleEngine.reset();
      relicSystem.equippedRelics = [];
      synergySystem.activeSynergies.clear();
      synergySystem.activeResonances.clear();
      worldEventSystem.activeEvent = null;
      worldEventSystem.eventTimer = 0;
      scoreSystem.reset();

      runManager.dispose();
      runManager = createRunManager();
      scheduler.remove('RunUpdate');
      scheduler.add({
        name: 'RunUpdate',
        phase: 'fixed',
        priority: 95,
        update: (c: SystemContext) => runManager.update(c.time.fixedDt),
      });

      audio.resume();
      runManager.startRun({ characterId: activeCharId });
      relicSystem.equipRelic('heal_potion');
      if (!loop.isRunning()) loop.start();
      paused = false;
    },
    destroy() {
      loop.stop();
      input.dispose();
      events.clear();
      window.removeEventListener('resize', resize);
    },
    getInput,
    getScore: () => ({
      score: scoreSystem.stats.score,
      wave: scoreSystem.stats.wave,
      kills: scoreSystem.stats.kills,
      combo: scoreSystem.stats.combo,
      multiplier: scoreSystem.comboMultiplier(),
    }),
    getRunState: () => ({
      ended: runManager.ended,
      currentWave: scoreSystem.stats.wave,
    }),
    onStats: (cb) => {
      statsListeners.add(cb);
      return () => statsListeners.delete(cb);
    },
    triggerWorldEvent(eventId: string) {
      worldEventSystem.triggerEvent(eventId);
    },
    setAudioVolume(vol: number) {
      audio.setVolume(vol);
    },
    applySkill(skillId: string) {
      runManager.applySkill(skillId);
    },
    equipRelic(relicId: string) {
      relicSystem.equipRelic(relicId);
    },
    getBindings() {
      return input.bindings;
    },
    setBinding(action, primaryCode) {
      input.setBinding(action, primaryCode);
    },
    resetBindings() {
      input.resetBindings();
    },
  };

  events.on(EventTypes.PAUSE, () => {});
  loop.start();

  return handle;
}
