import type { InputAction, KeyBindings } from './types';
import type { Faction } from '../content/characters';

export interface HighScore {
  score: number;
  wave: number;
  kills: number;
  characterId: string;
  date: string;
}

export interface PermanentUpgrades {
  permHpLevel: number;
  permDamageLevel: number;
}

export interface SaveData {
  faction: Faction | null;
  gold: number;
  armory: Record<string, boolean>;
  bestiary: Record<string, number>;
  upgrades: PermanentUpgrades;
  highScores: HighScore[];
  volume: number;
  bindings: KeyBindings;
  /** Permanently unlocked pets (id → true). */
  pets: Record<string, boolean>;
  /** Currently equipped pet id, or null. Persists between runs. */
  equippedPet: string | null;
  /** Highest ascension level beaten (0 = not beaten yet). Unlocks higher levels. */
  highestAscension: number;
  /** Currently selected ascension level for the next run. */
  activeAscension: number;
}

const KEY = 'mvg2030_save_v1';

export const DEFAULT_BINDINGS: KeyBindings = {
  moveUp: 'KeyW',
  moveDown: 'KeyS',
  moveLeft: 'KeyA',
  moveRight: 'KeyD',
  attack: 'Mouse0',
  dash: 'ShiftLeft',
  interact: 'KeyE',
  pause: 'KeyP',
  openBuild: 'KeyB',
  openMap: 'Tab',
};

const DEFAULT_SAVE: SaveData = {
  faction: null,
  gold: 0,
  armory: { pulse_pistol: true },
  bestiary: {},
  upgrades: { permHpLevel: 0, permDamageLevel: 0 },
  highScores: [],
  volume: 0.7,
  bindings: { ...DEFAULT_BINDINGS },
  pets: {},
  equippedPet: null,
  highestAscension: 0,
  activeAscension: 0,
};

function mergeBindings(raw?: Partial<KeyBindings>): KeyBindings {
  return { ...DEFAULT_BINDINGS, ...(raw ?? {}) };
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULT_SAVE);
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    return {
      faction: parsed.faction ?? null,
      gold: parsed.gold ?? 0,
      armory: { pulse_pistol: true, ...(parsed.armory ?? {}) },
      bestiary: parsed.bestiary ?? {},
      upgrades: {
        permHpLevel: parsed.upgrades?.permHpLevel ?? 0,
        permDamageLevel: parsed.upgrades?.permDamageLevel ?? 0,
      },
      highScores: parsed.highScores ?? [],
      volume: parsed.volume ?? 0.7,
      bindings: mergeBindings(parsed.bindings),
      pets: parsed.pets ?? {},
      equippedPet: parsed.equippedPet ?? null,
      highestAscension: parsed.highestAscension ?? 0,
      activeAscension: parsed.activeAscension ?? 0,
    };
  } catch {
    return structuredClone(DEFAULT_SAVE);
  }
}

export function writeSave(data: SaveData): void {
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function discoverWeapon(data: SaveData, weaponId: string): SaveData {
  const next = { ...data, armory: { ...data.armory, [weaponId]: true } };
  writeSave(next);
  return next;
}

export function recordKill(data: SaveData, enemyId: string): SaveData {
  const next = {
    ...data,
    bestiary: { ...data.bestiary, [enemyId]: (data.bestiary[enemyId] ?? 0) + 1 },
  };
  writeSave(next);
  return next;
}

export function addGold(data: SaveData, amount: number): SaveData {
  const next = { ...data, gold: data.gold + amount };
  writeSave(next);
  return next;
}

export function buyUpgrade(data: SaveData, kind: 'hp' | 'damage', cost: number): SaveData | null {
  if (data.gold < cost) return null;
  const upgrades = { ...data.upgrades };
  if (kind === 'hp') upgrades.permHpLevel += 1;
  else upgrades.permDamageLevel += 1;
  const next = { ...data, gold: data.gold - cost, upgrades };
  writeSave(next);
  return next;
}

export function upsertHighScore(data: SaveData, entry: HighScore): SaveData {
  const idx = data.highScores.findIndex((h) => h.date === entry.date);
  let highScores: HighScore[];
  if (idx !== -1) {
    highScores = [...data.highScores];
    highScores[idx] = entry;
    highScores.sort((a, b) => b.score - a.score);
    highScores = highScores.slice(0, 10);
  } else {
    highScores = [...data.highScores, entry].sort((a, b) => b.score - a.score).slice(0, 10);
  }
  const next = { ...data, highScores };
  writeSave(next);
  return next;
}

export function setVolume(data: SaveData, volume: number): SaveData {
  const next = { ...data, volume };
  writeSave(next);
  return next;
}

export function setBindings(data: SaveData, bindings: KeyBindings): SaveData {
  const next = { ...data, bindings: { ...bindings } };
  writeSave(next);
  return next;
}

export function setBinding(data: SaveData, action: InputAction, code: string): SaveData {
  const bindings = { ...data.bindings, [action]: code };
  return setBindings(data, bindings);
}

export function resetBindings(data: SaveData): SaveData {
  return setBindings(data, { ...DEFAULT_BINDINGS });
}

export function upgradeCost(level: number): number {
  return 50 + level * 40;
}

export function setFaction(data: SaveData, faction: Faction): SaveData {
  const next = { ...data, faction };
  writeSave(next);
  return next;
}

  /** Resets all progress but keeps bindings/volume, assigns new faction. */
export function switchFaction(data: SaveData, faction: Faction): SaveData {
  const next: SaveData = {
    faction,
    gold: 0,
    armory: { pulse_pistol: true },
    bestiary: {},
    upgrades: { permHpLevel: 0, permDamageLevel: 0 },
    highScores: [],
    volume: data.volume,
    bindings: { ...data.bindings },
    pets: {},
    equippedPet: null,
    highestAscension: 0,
    activeAscension: 0,
  };
  writeSave(next);
  return next;
}

/** Buy a pet permanently. Returns null if not enough gold or already owned. */
export function buyPet(data: SaveData, petId: string, cost: number): SaveData | null {
  if (data.pets[petId]) return null;
  if (data.gold < cost) return null;
  const next: SaveData = {
    ...data,
    gold: data.gold - cost,
    pets: { ...data.pets, [petId]: true },
  };
  writeSave(next);
  return next;
}

/** Equip a pet (must be owned) or unequip with null. Persists automatically. */
export function equipPet(data: SaveData, petId: string | null): SaveData {
  if (petId !== null && !data.pets[petId]) return data;
  const next: SaveData = { ...data, equippedPet: petId };
  writeSave(next);
  return next;
}

export function factionLabel(f: Faction): string {
  return f === 'bando_moros' ? 'Moros' : 'Gitanos';
}

export function codeLabel(code: string): string {
  const map: Record<string, string> = {
    Space: 'ESPACIO',
    ShiftLeft: 'SHIFT IZQ',
    ShiftRight: 'SHIFT DER',
    ControlLeft: 'CTRL IZQ',
    ControlRight: 'CTRL DER',
    AltLeft: 'ALT IZQ',
    AltRight: 'ALT DER',
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    Escape: 'ESC',
    Enter: 'ENTER',
    Tab: 'TAB',
    Mouse0: 'CLIC',
  };
  if (map[code]) return map[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return code;
}

