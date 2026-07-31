/**
 * RunManager.ts — ciclo de vida de una Run (TDD §3.3 gameplay/run).
 *
 * Orquesta el inicio de la Run, la instanciación del mapa continuo de nodos
 * (Salas y Pasillos), la creación del jugador y la gestión de victoria/derrota.
 */

import type { World, EntityId } from '@/engine/ecs/World';
import type { EventBus } from '@/engine/events/EventBus';
import type { ContentRepository } from '@/engine/content/ContentRepository';
import { EventTypes } from '@/gameplay/events/GameEventTypes';
import { randInt, chance, v2Dist } from '@/engine/utils/math';
import type {
  Position, Velocity, Collider, Facing, Health, Weapon,
  Player, Pickup, Door, Sprite, Shield, MapNode, Enemy,
} from '../components';
import type { ScoreSystem } from '../systems';
import type { MutationSystem } from '../mutations/MutationSystem';
import type { LevelGenerator, MapPlan, MapNodeDef } from './LevelGenerator';
import type { ChestComponent } from '../systems/ChestSystem';
import type { PetSystem } from '../pets/PetSystem';
import { BestiaryStore as BestiaryManager } from '../persistence/BestiaryStore';
import { ArmoryStore as ArmoryManager } from '../persistence/ArmoryStore';

export interface RunConfig {
  characterId: string;
  seed?: number;
}

interface WeaponDef {
  id: string;
  name: string;
  damage: number;
  fireRate: number;
  projectileSpeed: number;
  projectileSize: number;
  color: string;
  spread: number;
  count: number;
  pierce: number;
  sound: string;
}

interface CharacterDef {
  id: string;
  name: string;
  stats: { hp: number; speed: number; armor: number; critChance: number };
  startingWeapon: string;
  sprite: { color: string; glow: string; shape: string };
}

interface ChestDef {
  id: string;
  name: string;
  color: string;
  glow: string;
  size: number;
  loot: {
    pool: Array<{
      kind: 'weapon' | 'heal' | 'shield';
      rarityWeight?: Record<string, number>;
      weight?: number;
      value?: number;
    }>;
  };
}

export interface SkillDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: string;
  mods: Array<{ stat: string; op: 'add' | 'add_pct' | 'mul'; value: number }>;
}

export class RunManager {
  private mapPlan: MapPlan | null = null;
  private activeCharacterId = 'tariq';
  private equippedWeapon: Weapon | null = null;
  private playerEnt: EntityId | null = null;
  public ended: 'victory' | 'defeat' | null = null;
  private unsubs: Array<() => void> = [];

  constructor(
    private world: World,
    private events: EventBus,
    private content: ContentRepository,
    private scoreSystem: ScoreSystem,
    private mutationSystem: MutationSystem,
    private levelGenerator: LevelGenerator,
    private petSystem: PetSystem
  ) {
    // Escuchadores estables de eventos
    this.unsubs.push(events.on<{ entity: EntityId }>(EventTypes.ENTITY_KILLED, (e) => {
      if (this.world.getTag('player') === e.entity) {
        this.endRun('defeat');
      }
    }));

    this.unsubs.push(events.on<{ weaponId: string; player: EntityId; instance?: Record<string, unknown> }>('weapon:picked', (e) => {
      const inst = e.instance as Partial<Weapon> | undefined;
      const w = inst ?? this.content.get<WeaponDef>('weapons', e.weaponId);
      if (!w) return;

      const equipped: Weapon = {
        id: w.id ?? e.weaponId,
        damage: w.damage ?? 10,
        fireRate: w.fireRate ?? 2,
        projectileSpeed: w.projectileSpeed ?? 600,
        projectileSize: w.projectileSize ?? 4,
        color: w.color ?? '#00f0ff',
        spread: w.spread ?? 0.05,
        count: w.count ?? 1,
        pierce: w.pierce ?? 0,
        sound: w.sound ?? 'shoot',
        cooldown: 0,
      };

      this.equippedWeapon = equipped;
      ArmoryManager.recordDiscovery(equipped.id);

      this.world.addComponent<Weapon>(e.player, 'Weapon', equipped);

      const displayName = (inst as unknown as { displayName?: string })?.displayName ?? (w as WeaponDef).name ?? e.weaponId;
      this.events.emit(EventTypes.FLOAT_TEXT, { target: e.player, text: displayName.toUpperCase(), color: w.color ?? '#00f0ff' });
      this.events.emit(EventTypes.SCREEN_SHAKE, { intensity: 6, time: 0.2 });
    }));

    this.unsubs.push(events.on<{ entity: EntityId; xp: number }>('enemy:killed', (e) => {
      if (!this.playerEnt) return;

      const enemyCmp = this.world.getComponent<Enemy>(e.entity, 'Enemy');
      if (enemyCmp) {
        BestiaryManager.recordKill(enemyCmp.id);
      }

      const p = this.world.getComponent<Player>(this.playerEnt, 'Player');
      const h = this.world.getComponent<Health>(this.playerEnt, 'Health');
      if (!p || !h) return;

      p.xp += e.xp;
      while (p.xp >= p.xpToNext) {
        p.xp -= p.xpToNext;
        p.level++;
        p.xpToNext = Math.round(p.xpToNext * 1.4);
        h.max += 10;
        h.current = h.max;

        const allSkills = this.content.all<SkillDef>('skills');
        const choices: SkillDef[] = [];
        if (allSkills.length > 0) {
          const pool = [...allSkills];
          for (let i = 0; i < 3 && pool.length > 0; i++) {
            const idx = randInt(0, pool.length - 1);
            choices.push(pool.splice(idx, 1)[0]);
          }
        }

        this.events.emit(EventTypes.PLAYER_LEVELED_UP, { level: p.level, choices });
        this.events.emit(EventTypes.PLAY_SOUND, { id: 'levelup' });
        this.events.emit(EventTypes.SCREEN_SHAKE, { intensity: 8, time: 0.25 });

        const playerPos = this.world.getComponent<Position>(this.playerEnt, 'Position');
        if (playerPos) {
          this.events.emit(EventTypes.PARTICLE_BURST, {
            pos: playerPos,
            count: 40, color: '#ffe14a', speed: [150, 300], life: [0.5, 0.9],
            size: [3, 6], glow: true,
          });
        }
      }
    }));

    this.unsubs.push(events.on<{ nodeIndex: number; level: number }>(EventTypes.ROOM_CLEARED, (e) => {
      if (this.mapPlan && e.level === 10) {
        this.endRun('victory');
      }
    }));
  }

  startRun(cfg: RunConfig): void {
    const seed = cfg.seed ?? Date.now();
    this.activeCharacterId = cfg.characterId ?? 'tariq';
    this.equippedWeapon = null;
    this.scoreSystem.reset();
    this.ended = null;

    this.world.clear();

    // Generar el mapa espacial continuo con nodos y pasillos
    this.mapPlan = this.levelGenerator.generateMap(seed);

    // Instanciar todas las entidades del mapa continuo (Nodos, Puertas y Cofres)
    for (const nodeDef of this.mapPlan.nodes) {
      this.instantiateMapNode(nodeDef);
    }

    // Instanciar entidad Jugador en el origen de la primera sala
    const startNode = this.mapPlan.nodes[0];
    const charDef = this.content.get<CharacterDef>('characters', this.activeCharacterId) ??
      this.content.all<CharacterDef>('characters')[0];

    const startWeaponDef = charDef ? this.content.get<WeaponDef>('weapons', charDef.startingWeapon) : null;

    const startX = startNode ? startNode.bounds.x + startNode.bounds.w / 2 : 640;
    const startY = startNode ? startNode.bounds.y + startNode.bounds.h / 2 : 400;

    this.playerEnt = this.world.createEntity();
    this.world.addComponent<Position>(this.playerEnt, 'Position', { x: startX, y: startY });
    this.world.addComponent<Velocity>(this.playerEnt, 'Velocity', { vx: 0, vy: 0 });
    this.world.addComponent<Collider>(this.playerEnt, 'Collider', { radius: 14 });
    this.world.addComponent<Facing>(this.playerEnt, 'Facing', { dx: 1, dy: 0 });

    this.world.addComponent<Health>(this.playerEnt, 'Health', {
      current: charDef?.stats.hp ?? 100,
      max: charDef?.stats.hp ?? 100,
      armor: charDef?.stats.armor ?? 0,
    });

    const defaultW: Weapon = {
      id: startWeaponDef?.id ?? 'pistol',
      damage: startWeaponDef?.damage ?? 12,
      fireRate: startWeaponDef?.fireRate ?? 3.5,
      projectileSpeed: startWeaponDef?.projectileSpeed ?? 550,
      projectileSize: startWeaponDef?.projectileSize ?? 4,
      color: startWeaponDef?.color ?? '#00f0ff',
      spread: startWeaponDef?.spread ?? 0.04,
      count: startWeaponDef?.count ?? 1,
      pierce: startWeaponDef?.pierce ?? 0,
      sound: startWeaponDef?.sound ?? 'shoot',
      cooldown: 0,
    };

    this.equippedWeapon = defaultW;
    ArmoryManager.recordDiscovery(defaultW.id);

    this.world.addComponent<Weapon>(this.playerEnt, 'Weapon', defaultW);

    this.world.addComponent<Player>(this.playerEnt, 'Player', {
      name: charDef?.id ?? 'tariq',
      color: charDef?.sprite.color ?? '#00f0ff',
      glow: charDef?.sprite.glow ?? '#00f0ff',
      shape: charDef?.sprite.shape ?? 'triangle',
      isDashing: false,
      dashTime: 0,
      dashCooldown: 0,
      dashCooldownMax: 1.5,
      xp: 0,
      level: 1,
      xpToNext: 50,
      critChance: charDef?.stats.critChance ?? 0.05,
    });

    this.world.addComponent<Sprite>(this.playerEnt, 'Sprite', {
      shape: 'triangle',
      color: charDef?.sprite.color ?? '#00f0ff',
      glow: charDef?.sprite.glow ?? '#00f0ff',
      size: 14,
    });

    this.world.setTag('player', this.playerEnt);

    // Mascota de apoyo inicial
    this.petSystem.spawnPet('pet_drone_scout', this.playerEnt);

    this.events.emit(EventTypes.RUN_STARTED, {});
  }

  private instantiateMapNode(nodeDef: MapNodeDef): EntityId {
    // Crear Entidades para las Puertas
    const entryDoorEnt = this.world.createEntity();
    const ed = nodeDef.entryDoor;
    this.world.addComponent<Door>(entryDoorEnt, 'Door', {
      x: ed.x, y: ed.y, w: ed.w, h: ed.h, locked: false, kind: 'entry', nodeIndex: nodeDef.index,
    });

    const isCorridor = nodeDef.type === 'corridor';
    const exitDoorEnt = this.world.createEntity();
    const xd = nodeDef.exitDoor;
    this.world.addComponent<Door>(exitDoorEnt, 'Door', {
      x: xd.x, y: xd.y, w: xd.w, h: xd.h, locked: !isCorridor, kind: 'exit', nodeIndex: nodeDef.index,
    });

    // Crear Entidad del Nodo de Mapa
    const nodeEnt = this.world.createEntity();
    this.world.addComponent<MapNode>(nodeEnt, 'MapNode', {
      index: nodeDef.index,
      level: nodeDef.level,
      type: nodeDef.type,
      bounds: nodeDef.bounds,
      status: 'unvisited',
      waves: nodeDef.waves,
      currentWave: 0,
      biomeId: nodeDef.biomeId,
      difficulty: nodeDef.difficulty,
      pickupPool: nodeDef.pickupPool,
      entryDoorEnt,
      exitDoorEnt,
      chestSpawns: nodeDef.chestSpawns,
    });

    // Spawnear cofres de la sala
    if (nodeDef.chestSpawns) {
      for (const cs of nodeDef.chestSpawns) {
        this.spawnChest(cs.chestId, cs.x, cs.y);
      }
    }

    return nodeEnt;
  }

  private spawnChest(chestId: string, x: number, y: number): void {
    const cDef = this.content.get<ChestDef>('chests', chestId);
    if (!cDef) return;
    const ent = this.world.createEntity();
    this.world.addComponent<Position>(ent, 'Position', { x, y });
    this.world.addComponent<Collider>(ent, 'Collider', { radius: cDef.size });
    this.world.addComponent<ChestComponent>(ent, 'Chest', {
      id: cDef.id,
      name: cDef.name,
      color: cDef.color,
      glow: cDef.glow,
      size: cDef.size,
      opened: false,
      loot: cDef.loot,
    });
    this.world.addComponent<Sprite>(ent, 'Sprite', {
      shape: 'square',
      color: cDef.color,
      glow: cDef.glow,
      size: cDef.size,
    });
    this.world.addToGroup('chests', ent);
  }

  update(dt: number): void {
    if (this.ended) return;
    void dt;
  }

  applySkill(skillId: string): void {
    if (this.playerEnt === null) return;
    const skill = this.content.get<SkillDef>('skills', skillId);
    if (!skill) return;

    const w = this.world.getComponent<Weapon>(this.playerEnt, 'Weapon');
    const h = this.world.getComponent<Health>(this.playerEnt, 'Health');
    const p = this.world.getComponent<Player>(this.playerEnt, 'Player');

    for (const mod of skill.mods) {
      if (mod.stat === 'damageMult' && w) {
        w.damage = Math.round(w.damage * (1 + mod.value));
        if (this.equippedWeapon) this.equippedWeapon.damage = w.damage;
      } else if (mod.stat === 'speedMult' && p) {
        p.speedMult = (p.speedMult ?? 1.0) * (1 + mod.value);
      } else if (mod.stat === 'pierce' && w) {
        w.pierce += mod.value;
        if (this.equippedWeapon) this.equippedWeapon.pierce = w.pierce;
      } else if (mod.stat === 'count' && w) {
        w.count += mod.value;
        if (this.equippedWeapon) this.equippedWeapon.count = w.count;
      } else if (mod.stat === 'maxHp' && h) {
        h.max += mod.value;
        h.current = h.max;
      } else if (mod.stat === 'critChance' && p) {
        p.critChance = (p.critChance ?? 0.05) + mod.value;
      } else if (mod.stat === 'shield' && this.playerEnt !== null) {
        let sh = this.world.getComponent<Shield>(this.playerEnt, 'Shield');
        if (!sh) {
          this.world.addComponent<Shield>(this.playerEnt, 'Shield', { charges: mod.value });
        } else {
          sh.charges += mod.value;
        }
      }
    }

    this.events.emit(EventTypes.FLOAT_TEXT, {
      target: this.playerEnt,
      text: skill.name.toUpperCase(),
      color: '#39ff88',
    });
  }

  private endRun(result: 'victory' | 'defeat'): void {
    if (this.ended) return;
    this.ended = result;
    this.events.emit(EventTypes.RUN_ENDED, {
      result, score: this.scoreSystem.stats.score,
      wave: this.scoreSystem.stats.wave, kills: this.scoreSystem.stats.kills,
    });
  }

  dispose(): void {
    for (const u of this.unsubs) u();
    this.unsubs.length = 0;
  }
}

export { RunManager as RunSystem };
