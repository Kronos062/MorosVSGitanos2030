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
  /** Whether the first-time tutorial overlay has been dismissed. */
  tutorialSeen: boolean;
  /** Accessibility: reduces incoming damage by 25%. */
  assistMode: boolean;
  /** Chosen menu background music track ID. */
  menuMusicId: string;
  /** Volume for sound effects (separate from music volume). */
  sfxVolume: number;
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
  sfxVolume: 0.7,
  bindings: { ...DEFAULT_BINDINGS },
  pets: {},
  equippedPet: null,
  highestAscension: 0,
  activeAscension: 0,
  tutorialSeen: false,
  assistMode: false,
  menuMusicId: 'menu1',
};

function mergeBindings(raw?: Partial<KeyBindings>): KeyBindings {
  return { ...DEFAULT_BINDINGS, ...(raw ?? {}) };
}

function normalizeSave(parsed: Partial<SaveData>): SaveData {
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
    sfxVolume: parsed.sfxVolume ?? parsed.volume ?? 0.7,
    bindings: mergeBindings(parsed.bindings),
    pets: parsed.pets ?? {},
    equippedPet: parsed.equippedPet ?? null,
    highestAscension: parsed.highestAscension ?? 0,
    activeAscension: parsed.activeAscension ?? 0,
    tutorialSeen: parsed.tutorialSeen ?? false,
    assistMode: parsed.assistMode ?? false,
    menuMusicId: parsed.menuMusicId ?? 'menu1',
  };
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULT_SAVE);
    return normalizeSave(JSON.parse(raw) as Partial<SaveData>);
  } catch {
    return structuredClone(DEFAULT_SAVE);
  }
}

export function writeSave(data: SaveData): void {
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function exportSaveToJson(data: SaveData): string {
  return JSON.stringify(data, null, 2);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function num(v: unknown, fallback: number, min = -Infinity, max = Infinity): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
}

function normalizeSave(raw: unknown): SaveData {
  const parsed = isRecord(raw) ? raw : {};
  const faction = parsed.faction === 'bando_moros' || parsed.faction === 'bando_gitanos' ? parsed.faction : null;
  const upgrades = isRecord(parsed.upgrades) ? parsed.upgrades : {};
  const armory = isRecord(parsed.armory) ? (parsed.armory as Record<string, boolean>) : {};
  const bestiary = isRecord(parsed.bestiary) ? (parsed.bestiary as Record<string, number>) : {};
  const pets = isRecord(parsed.pets) ? (parsed.pets as Record<string, boolean>) : {};
  const bindings = isRecord(parsed.bindings) ? (parsed.bindings as Partial<KeyBindings>) : undefined;
  const highScores = Array.isArray(parsed.highScores)
    ? parsed.highScores.filter(
        (h): h is HighScore =>
          isRecord(h) &&
          typeof h.score === 'number' &&
          typeof h.wave === 'number' &&
          typeof h.kills === 'number' &&
          typeof h.characterId === 'string' &&
          typeof h.date === 'string',
      )
    : [];

  return {
    faction,
    gold: Math.floor(num(parsed.gold, 0, 0)),
    armory: { pulse_pistol: true, ...armory },
    bestiary,
    upgrades: {
      permHpLevel: Math.floor(num(upgrades.permHpLevel, 0, 0)),
      permDamageLevel: Math.floor(num(upgrades.permDamageLevel, 0, 0)),
    },
    highScores,
    volume: num(parsed.volume, 0.7, 0, 1),
    sfxVolume: num(parsed.sfxVolume, num(parsed.volume, 0.7, 0, 1), 0, 1),
    bindings: mergeBindings(bindings),
    pets,
    equippedPet: typeof parsed.equippedPet === 'string' ? parsed.equippedPet : null,
    highestAscension: Math.floor(num(parsed.highestAscension, 0, 0, 9)),
    activeAscension: Math.floor(num(parsed.activeAscension, 0, 0, 9)),
    tutorialSeen: typeof parsed.tutorialSeen === 'boolean' ? parsed.tutorialSeen : false,
    assistMode: typeof parsed.assistMode === 'boolean' ? parsed.assistMode : false,
    menuMusicId: typeof parsed.menuMusicId === 'string' ? parsed.menuMusicId : 'menu1',
  };
}

export function importSaveFromJson(json: string): SaveData | null {
  try {
    const parsed: unknown = JSON.parse(json);
    if (!isRecord(parsed)) return null;
    return normalizeSave(parsed);
  } catch {
    return null;
  }
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

export function setSfxVolume(data: SaveData, sfxVolume: number): SaveData {
  const next = { ...data, sfxVolume };
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
    sfxVolume: data.sfxVolume,
    bindings: { ...data.bindings },
    pets: {},
    equippedPet: null,
    highestAscension: 0,
    activeAscension: 0,
    tutorialSeen: data.tutorialSeen,
    assistMode: data.assistMode,
    menuMusicId: data.menuMusicId,
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
