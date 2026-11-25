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

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, def: number, min: number, max: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def;
const int = (v: unknown, def: number, min: number, max: number): number => Math.round(num(v, def, min, max));

function numberRecord(v: unknown, integer = true): Record<string, number> {
  const out: Record<string, number> = {};
  if (!isObj(v)) return out;
  for (const [k, n] of Object.entries(v)) {
    if (typeof n === 'number' && Number.isFinite(n) && n >= 0) out[k] = integer ? Math.floor(n) : n;
  }
  return out;
}

function boolRecord(v: unknown): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  if (!isObj(v)) return out;
  for (const [k, b] of Object.entries(v)) if (b === true) out[k] = true;
  return out;
}

function sanitizeHighScores(v: unknown): HighScore[] {
  if (!Array.isArray(v)) return [];
  const out: HighScore[] = [];
  for (const h of v) {
    if (!isObj(h)) continue;
    out.push({
      score: num(h.score, 0, 0, Number.MAX_SAFE_INTEGER),
      wave: int(h.wave, 0, 0, 1_000_000),
      kills: int(h.kills, 0, 0, 1_000_000),
      characterId: typeof h.characterId === 'string' ? h.characterId : '',
      date: typeof h.date === 'string' ? h.date : '',
    });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 10);
}

function mergeBindingsSafe(raw: unknown): KeyBindings {
  const out: KeyBindings = { ...DEFAULT_BINDINGS };
  if (!isObj(raw)) return out;
  for (const action of Object.keys(DEFAULT_BINDINGS) as InputAction[]) {
    const code = raw[action];
    if (typeof code === 'string' && code.length > 0 && code.length < 32) out[action] = code;
  }
  return out;
}

function normalizeSave(input: unknown): SaveData {
  const parsed: Record<string, unknown> = isObj(input) ? input : {};
  const volume = num(parsed.volume, 0.7, 0, 1);
  const up = isObj(parsed.upgrades) ? parsed.upgrades : {};
  return {
    faction: parsed.faction === 'bando_moros' || parsed.faction === 'bando_gitanos' ? parsed.faction : null,
    gold: int(parsed.gold, 0, 0, Number.MAX_SAFE_INTEGER),
    armory: { pulse_pistol: true, ...boolRecord(parsed.armory) },
    bestiary: numberRecord(parsed.bestiary),
    upgrades: {
      permHpLevel: int(up.permHpLevel, 0, 0, 1000),
      permDamageLevel: int(up.permDamageLevel, 0, 0, 1000),
    },
    highScores: sanitizeHighScores(parsed.highScores),
    volume,
    sfxVolume: num(parsed.sfxVolume, volume, 0, 1),
    bindings: mergeBindingsSafe(parsed.bindings),
    pets: boolRecord(parsed.pets),
    equippedPet: typeof parsed.equippedPet === 'string' ? parsed.equippedPet : null,
    highestAscension: int(parsed.highestAscension, 0, 0, 99),
    activeAscension: int(parsed.activeAscension, 0, 0, 99),
    tutorialSeen: parsed.tutorialSeen === true,
    assistMode: parsed.assistMode === true,
    menuMusicId: typeof parsed.menuMusicId === 'string' ? parsed.menuMusicId : 'menu1',
  };
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULT_SAVE);
    return normalizeSave(JSON.parse(raw));
  } catch {
    return structuredClone(DEFAULT_SAVE);
  }
}

/** Guarda sin lanzar excepciones (cuota llena, modo privado...): el juego sigue funcionando sin persistencia. */
export function writeSave(data: SaveData): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (err) {
    console.warn('[save] No se pudo guardar la partida:', err);
    return false;
  }
}

export function exportSaveToJson(data: SaveData): string {
  return JSON.stringify(data, null, 2);
}

/** Returns null if the JSON is malformed — caller shows an error. */
export function importSaveFromJson(json: string): SaveData | null {
  try {
    const parsed: unknown = JSON.parse(json);
    // Un JSON válido que no parece una partida (p. ej. {} o 123) no debe borrar el progreso.
    if (!isObj(parsed)) return null;
    const known = ['faction', 'gold', 'armory', 'bestiary', 'upgrades', 'highScores', 'bindings', 'pets', 'volume'];
    if (!known.some((k) => k in parsed)) return null;
    return normalizeSave(parsed);
  } catch {
    return null;
  }
}

export function discoverWeapon(data: SaveData, weaponId: string): SaveData {
  if (data.armory[weaponId]) return data;
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

/** Registra varias bajas de golpe (una sola escritura y un solo render). */
export function recordKills(data: SaveData, counts: Record<string, number>): SaveData {
  const ids = Object.keys(counts);
  if (ids.length === 0) return data;
  const bestiary = { ...data.bestiary };
  for (const id of ids) bestiary[id] = (bestiary[id] ?? 0) + counts[id];
  const next = { ...data, bestiary };
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

/** Asigna una tecla. Si ya la usaba otra acción, se intercambian para no dejar dos acciones en la misma tecla. */
export function setBinding(data: SaveData, action: InputAction, code: string): SaveData {
  const bindings = { ...data.bindings };
  const previous = bindings[action];
  for (const other of Object.keys(bindings) as InputAction[]) {
    if (other !== action && bindings[other] === code) bindings[other] = previous;
  }
  bindings[action] = code;
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
