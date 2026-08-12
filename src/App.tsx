import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CHARACTERS, getCharacter, getCharactersByFaction, factionColor, factionName, formatPassiveMod } from './content/characters';
import type { Faction } from './content/characters';
import { RARITY_COLORS, WEAPON_BASES } from './content/weapons';
import { ASCENSION_LEVELS } from './content/ascension';
import { BESTIARY_LORE } from './content/enemies';
import { PET_DEFS, getPet, PET_RARITY_COLORS } from './content/pets';
import { GameEngine } from './game/engine';
import { audio } from './game/audio';
import { music, MENU_TRACKS } from './game/music';
import type { GameStats, GameScreen, SkillChoice, InputAction, MinimapData, BuildStats, ItemPickupData, BuildItemEntry, EquipSlot } from './game/types';
import { EQUIP_SLOT_LABELS, EQUIP_SLOT_ICONS, RARITY_COLORS as EQ_COLORS, SET_DEFS } from './content/equipment';

import {
  loadSave,
  writeSave,
  discoverWeapon,
  recordKill,
  addGold,
  buyUpgrade,
  upsertHighScore,
  setVolume,
  setBinding,
  resetBindings,
  setFaction,
  switchFaction,
  buyPet,
  equipPet,
  upgradeCost,
  codeLabel,
  factionLabel,
  DEFAULT_BINDINGS,
  exportSaveToJson,
  importSaveFromJson,
  type SaveData,
} from './game/persistence';

const emptyStats: GameStats = {
  hp: 0, maxHp: 1, shield: 0, maxShield: 0, level: 1, xp: 0, xpToNext: 55, dashPct: 1,
  score: 0, wave: 0, kills: 0, combo: 0, multiplier: 1,
  weaponName: '', weaponColor: '#00f0ff', stackedPickupCount: 0,
  boss: null, weaponPrompt: null, chestPrompt: null, portalPrompt: null,
  ended: null, goldEarned: 0,
  currentRoomLabel: '', roomsCleared: 0, roomsTotal: 0,
  mapNumber: 1, totalMaps: 10,
  biomeName: '', biomeIcon: '', biomeColor: '#00f0ff',
  minimap: null, build: null,
};

const BINDING_ROWS: Array<{ action: InputAction; label: string }> = [
  { action: 'moveUp', label: 'Arriba' },
  { action: 'moveDown', label: 'Abajo' },
  { action: 'moveLeft', label: 'Izquierda' },
  { action: 'moveRight', label: 'Derecha' },
  { action: 'attack', label: 'Atacar' },
  { action: 'dash', label: 'Dash' },
  { action: 'interact', label: 'Interactuar' },
  { action: 'pause', label: 'Pausa' },
  { action: 'openBuild', label: 'Build' },
  { action: 'openMap', label: 'Mapa' },
];

function MinimapView({ data, large = false }: { data: MinimapData; large?: boolean }) {
  const pad = 12;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const r of data.rooms) {
    if (!r.discovered && r.id !== data.currentRoomId) continue;
    minX = Math.min(minX, r.bounds.x); minY = Math.min(minY, r.bounds.y);
    maxX = Math.max(maxX, r.bounds.x + r.bounds.w); maxY = Math.max(maxY, r.bounds.y + r.bounds.h);
  }
  for (const c of data.corridors) {
    if (!c.discovered) continue;
    minX = Math.min(minX, c.bounds.x); minY = Math.min(minY, c.bounds.y);
    maxX = Math.max(maxX, c.bounds.x + c.bounds.w); maxY = Math.max(maxY, c.bounds.y + c.bounds.h);
  }
  if (!Number.isFinite(minX)) { minX = 0; minY = 0; maxX = 100; maxY = 100; }
  const bw = maxX - minX || 1; const bh = maxY - minY || 1;
  const boxW = large ? Math.min(720, window.innerWidth * 0.86) : 170;
  const boxH = large ? Math.min(360, window.innerHeight * 0.5) : 78;
  const scale = Math.min((boxW - pad * 2) / bw, (boxH - pad * 2) / bh);
  const tx = (x: number) => pad + (x - minX) * scale;
  const ty = (y: number) => pad + (y - minY) * scale;
  return (
    <svg width={boxW} height={boxH} className={large ? 'minimap-svg large' : 'minimap-svg'} viewBox={`0 0 ${boxW} ${boxH}`}>
      <rect x={0} y={0} width={boxW} height={boxH} fill="rgba(10,12,16,0.92)" stroke="rgba(255,204,0,0.35)" />
      {data.corridors.map((c, i) => {
        if (!c.discovered) return null;
        return <rect key={`c-${i}`} x={tx(c.bounds.x)} y={ty(c.bounds.y)} width={Math.max(2, c.bounds.w * scale)} height={Math.max(2, c.bounds.h * scale)} fill="rgba(255,204,0,0.25)" />;
      })}
      {data.rooms.map((r) => {
        if (!r.discovered && r.id !== data.currentRoomId) return null;
        let fill = 'rgba(80,90,110,0.7)';
        if (r.status === 'cleared') fill = 'rgba(57,255,136,0.45)';
        if (r.status === 'active') fill = 'rgba(255,85,0,0.55)';
        if (r.kind === 'boss') fill = r.status === 'cleared' ? 'rgba(255,43,214,0.45)' : 'rgba(255,43,214,0.3)';
        if (r.kind === 'treasure') fill = 'rgba(255,225,74,0.35)';
        const isCurrent = r.id === data.currentRoomId;
        return (
          <g key={r.id}>
            <rect x={tx(r.bounds.x)} y={ty(r.bounds.y)} width={Math.max(4, r.bounds.w * scale)} height={Math.max(4, r.bounds.h * scale)} fill={fill} stroke={isCurrent ? '#00f0ff' : 'rgba(255,255,255,0.2)'} strokeWidth={isCurrent ? 2 : 1} />
            {large && <text x={tx(r.bounds.x) + (r.bounds.w * scale) / 2} y={ty(r.bounds.y) + (r.bounds.h * scale) / 2 + 3} textAnchor="middle" fill="#e2e8f0" fontSize={10} fontFamily="monospace">{r.label}</text>}
          </g>
        );
      })}
      <circle cx={tx(data.player.x)} cy={ty(data.player.y)} r={large ? 5 : 3} fill="#00f0ff" stroke="#fff" strokeWidth={1} />
    </svg>
  );
}

function BuildPanel({ build }: { build: BuildStats }) {
  type SlotKey = 'helm' | 'chest' | 'pants' | 'boots';
  return (
    <div className="build-panel" style={{ textAlign: 'left', fontSize: '0.85rem' }}>
      <div className="build-layout">
        <div className="build-column build-player-column">
          <h3 className="build-player-heading" style={{ color: build.color, marginBottom: 12, letterSpacing: '0.08em' }}>{build.name} · Nivel {build.level} · XP {build.xp.toFixed(2)}/{build.xpToNext}</h3>

          <div className="build-section build-stats-section" style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 800, color: '#ffe14a', marginBottom: 8, letterSpacing: '0.1em' }}>ESTADÍSTICAS FINALES</div>
            <div className="build-grid">
              <div className="build-cell"><span className="build-cell-label">Vida</span><span className="build-cell-value" style={{ color: '#ff2a4b' }}>{Math.ceil(build.hp)}/{build.maxHp}</span></div>
              <div className="build-cell"><span className="build-cell-label">Escudo</span><span className="build-cell-value" style={{ color: '#00f0ff' }}>{build.shield}</span></div>
              <div className="build-cell"><span className="build-cell-label">Armadura</span><span className="build-cell-value">{build.armor}</span></div>
              <div className="build-cell"><span className="build-cell-label">Velocidad</span><span className="build-cell-value" style={{ color: '#39ff88' }}>{build.speed}</span></div>
              <div className="build-cell"><span className="build-cell-label">Crítico</span><span className="build-cell-value" style={{ color: '#ffe14a' }}>{Math.round(build.critChance * 100)}%</span></div>
              <div className="build-cell"><span className="build-cell-label">Robo vida</span><span className="build-cell-value" style={{ color: '#ff2bd6' }}>{Math.round(build.lifesteal * 100)}%</span></div>
              <div className="build-cell"><span className="build-cell-label">Daño ×</span><span className="build-cell-value" style={{ color: '#ff8800' }}>×{build.damageMult.toFixed(2)}</span></div>
              <div className="build-cell"><span className="build-cell-label">Cadencia ×</span><span className="build-cell-value" style={{ color: '#00c8ff' }}>×{build.fireRateMult.toFixed(2)}</span></div>
              <div className="build-cell"><span className="build-cell-label">Perforación +</span><span className="build-cell-value">+{build.pierceBonus}</span></div>
              <div className="build-cell"><span className="build-cell-label">Proyectiles +</span><span className="build-cell-value">+{build.countBonus}</span></div>
              {build.bounceBonus > 0 && <div className="build-cell"><span className="build-cell-label">Rebotes +</span><span className="build-cell-value">+{build.bounceBonus}</span></div>}
              {build.explosionBonus > 0 && <div className="build-cell"><span className="build-cell-label">Explosión +</span><span className="build-cell-value">+{build.explosionBonus}</span></div>}
            </div>
          </div>
        </div>

        <div className="build-column build-loadout-column">

      <div className="build-section build-weapon-section" style={{ marginBottom: 14, padding: '10px 12px', background: 'rgba(255,204,0,0.08)', border: '1px solid rgba(255,204,0,0.25)', borderRadius: 4 }}>
        <div style={{ fontWeight: 800, color: build.weaponColor, marginBottom: 6 }}>⚔️ Arma equipada</div>
        <div><strong style={{ color: RARITY_COLORS[build.weaponRarity as keyof typeof RARITY_COLORS] ?? build.weaponColor }}>{build.weaponName}</strong> <span style={{fontSize:'0.7rem', color:'#8891b8'}}>{build.weaponRarity.toUpperCase()}</span></div>
        {build.weaponAffixName && (
          <div style={{ marginTop: 4, padding: '4px 8px', background: 'rgba(0,0,0,0.3)', borderLeft: `3px solid ${build.weaponAffixColor ?? '#fff'}`, borderRadius: 2 }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: build.weaponAffixColor ?? '#fff' }}>
              Afijo: {build.weaponAffixName}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{build.weaponAffixDescription}</div>
          </div>
        )}
        <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: 4 }}>
          <div>Daño: {build.weaponDamage} · Cadencia: {(build.weaponFireRate * build.fireRateMult).toFixed(1)}/s · Dispersión: {Math.round(build.weaponSpread * 100)}%</div>
          <div>Proyectiles: {build.weaponCount} · Perforación: {build.weaponPierce}</div>
          {(build.weaponBurst ?? 0) > 1 && <div>Ráfaga: ×{build.weaponBurst}</div>}
          {(build.weaponBounce ?? 0) > 0 && <div>Rebotes: {build.weaponBounce}</div>}
          {(build.weaponExplosion ?? 0) > 0 && <div>Explosión: r{build.weaponExplosion}</div>}
          <div>Tags: {build.weaponTags.join(', ')}</div>
        </div>
      </div>

      {build.hasNearbyWeapon && (
        <div className="build-section build-nearby-section" style={{ marginBottom: 14, padding: '10px 12px', background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.25)', borderRadius: 4 }}>
          <div style={{ fontWeight: 800, color: '#00c8ff', marginBottom: 4 }}>🔀 Arma cercana</div>
          <div>{build.nearbyWeaponName}</div>
        </div>
      )}

      {/* Equipment slots */}
      <div className="build-section build-equipment-section" style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 800, color: '#b04dff', marginBottom: 8, letterSpacing: '0.1em' }}>EQUIPO</div>
        {(['helm','chest','pants','boots'] as SlotKey[]).map((slot) => {
          const eq = build.equippedItems.find((e) => e.slot === slot);
          const setInfo = eq?.setId ? build.activeSets.find((s) => s.setId === eq.setId) : undefined;
          return (
            <div key={slot} style={{ padding: '6px 10px', marginBottom: 4, background: 'rgba(0,0,0,0.3)', border: `1px solid ${eq ? eq.color+'55' : 'rgba(255,255,255,0.08)'}`, borderRadius: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                  {EQUIP_SLOT_ICONS[slot]} {EQUIP_SLOT_LABELS[slot]}
                </span>
                {eq ? (
                  <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: '0.72rem', color: '#8891b8' }}>{eq.icon}</span>
                    <strong style={{ color: eq.color, fontSize: '0.82rem' }}>{eq.name}</strong>
                    <span style={{ fontSize: '0.65rem', color: EQ_COLORS[eq.rarity as keyof typeof EQ_COLORS] ?? '#888' }}>{eq.rarity.toUpperCase()}</span>
                  </span>
                ) : (
                  <span style={{ color: '#555', fontSize: '0.75rem' }}>Vacío</span>
                )}
              </div>
              {eq && (
                <div style={{ fontSize: '0.68rem', color: '#8891b8', marginTop: 3, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span>{eq.mods.map((m) => m.label).join(' · ')}</span>
                  {setInfo && <span style={{ color: setInfo.color }}>Conjunto {setInfo.name} ({setInfo.equipped}/4)</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Set synergies */}
      {build.activeSets.length > 0 && (
        <div className="build-section build-sets-section" style={{ marginBottom: 14, padding: '10px 12px', background: 'rgba(176,77,255,0.08)', border: '1px solid rgba(176,77,255,0.25)', borderRadius: 4 }}>
          <div style={{ fontWeight: 800, color: '#b04dff', marginBottom: 8, letterSpacing: '0.1em' }}>SINERGIAS DE CONJUNTO</div>
          {build.activeSets.map((s) => {
            const slotKeys: SlotKey[] = ['helm', 'chest', 'pants', 'boots'];
            return (
              <div key={s.setId} style={{ marginBottom: 8, padding: '8px 10px', background: 'rgba(0,0,0,0.3)', border: `1px solid ${s.color}40`, borderRadius: 4 }}>
                <div style={{ fontWeight: 800, color: s.color, marginBottom: 4 }}>
                  {s.name} <span style={{fontSize:'0.7rem',color:'#8891b8'}}>{s.equipped}/4 piezas</span>
                </div>
                {/* Per-slot ✓/✗ progress */}
                <div style={{ display: 'flex', gap: 10, marginBottom: 6, fontSize: '0.7rem' }}>
                  {slotKeys.map((slot) => {
                    const has = build.equippedItems.some((e) => e.slot === slot && e.setId === s.setId);
                    return (
                      <span key={slot} style={{ color: has ? '#39ff88' : '#666' }}>
                        {EQUIP_SLOT_LABELS[slot]} {has ? '✓' : '✗'}
                      </span>
                    );
                  })}
                </div>
                {s.bonuses.map((b, j) => (
                  <div key={j} style={{ fontSize: '0.75rem', color: b.active ? '#39ff88' : '#555', padding: '2px 0' }}>
                    {b.active ? '✅' : '⬜'} {b.pieces}p: {b.description}
                  </div>
                ))}
                {s.playstyle && (
                  <div style={{ fontSize: '0.72rem', color: '#8891b8', marginBottom: 4 }}>
                    {s.playstyle}
                  </div>
                )}
                {s.strengths.length > 0 && (
                  <div style={{ fontSize: '0.7rem', marginBottom: 3 }}>
                    <span style={{ color: '#39ff88' }}>Fortalezas: </span>
                    {s.strengths.map((tag, i) => (
                      <span key={i} style={{ display: 'inline-block', padding: '1px 6px', margin: '0 2px', background: 'rgba(57,255,136,0.12)', border: '1px solid rgba(57,255,136,0.25)', borderRadius: 3, fontSize: '0.65rem' }}>{tag}</span>
                    ))}
                  </div>
                )}
                {s.weaknesses.length > 0 && (
                  <div style={{ fontSize: '0.7rem', marginBottom: 3 }}>
                    <span style={{ color: '#ff5500' }}>Debilidades: </span>
                    {s.weaknesses.map((tag, i) => (
                      <span key={i} style={{ display: 'inline-block', padding: '1px 6px', margin: '0 2px', background: 'rgba(255,85,0,0.12)', border: '1px solid rgba(255,85,0,0.25)', borderRadius: 3, fontSize: '0.65rem' }}>{tag}</span>
                    ))}
                  </div>
                )}
                {s.synergyDescription && (
                  <div style={{ fontSize: '0.72rem', marginTop: 4, color: s.synergyActive ? '#ffe14a' : '#666' }}>
                    {s.synergyActive ? '⚡ ACTIVA' : '○'} Sinergia: {s.synergyDescription}
                  </div>
                )}
                {s.counterSynergy && (
                  <div style={{ fontSize: '0.72rem', marginTop: 4, color: s.counterSynergyActive ? '#ff5500' : '#666' }}>
                    {s.counterSynergyActive ? '⚠ ACTIVA' : '○'} Contrasinergia: {s.counterSynergy.description}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {build.equippedItems.length === 0 && (
        <div className="build-section" style={{ marginBottom: 14, padding: '10px 12px', background: 'rgba(176,77,255,0.05)', border: '1px dashed rgba(176,77,255,0.2)', borderRadius: 4, textAlign: 'center', color: '#94a3b8' }}>
          Sin equipo. ¡Ábrelos en cofres o derrota jefes!
        </div>
      )}
      </div>
      </div>
    </div>
  );
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [screen, setScreen] = useState<GameScreen>('menu');
  const [save, setSave] = useState<SaveData>(() => loadSave());
  const [selectedChar, setSelectedChar] = useState('tariq');
  const [stats, setStats] = useState<GameStats>(emptyStats);
  const [skillChoices, setSkillChoices] = useState<SkillChoice[]>([]);
  const [endResult, setEndResult] = useState<'victory' | 'defeat' | null>(null);
  const [rebinding, setRebinding] = useState<InputAction | null>(null);
  const [factionConfirm, setFactionConfirm] = useState(false);
  const [itemPickup, setItemPickup] = useState<{ item: ItemPickupData; equipped: BuildItemEntry[]; resolve: (slot: EquipSlot | null) => void } | null>(null);
  const [eventData, setEventData] = useState<{ instance: any; resolve: (idx: number | null) => void } | null>(null);
  // End-of-run unlock summary (computed purely from already-stored save data).
  const [runUnlocks, setRunUnlocks] = useState<{
    weapons: string[];
    bestiary: string[];
    ascension: number | null;
    newHighScore: boolean;
  }>({ weapons: [], bestiary: [], ascension: null, newHighScore: false });
  const joyThumbRef = useRef<HTMLDivElement>(null);
  // Snapshot of the save taken when a run starts, so the end screen can diff
  // it against the final save to list only THIS run's unlocks. Reuses the
  // exact data already persisted (armory / bestiary / ascension / scores).
  const runStartRef = useRef<{ armory: Record<string, boolean>; bestiary: Record<string, number>; highestAscension: number; topScore: number }>({
    armory: {}, bestiary: {}, highestAscension: 0, topScore: 0,
  });
  const goldAwardedRef = useRef(0);
  const runIdRef = useRef<string | null>(null);
  const [seedInput, setSeedInput] = useState('');
  const [showCodex, setShowCodex] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showModifierChoice, setShowModifierChoice] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);
  const selectedCharRef = useRef(selectedChar);
  selectedCharRef.current = selectedChar;

  const inGame = screen === 'playing' || screen === 'paused' || screen === 'levelup' || screen === 'build' || screen === 'map';
  const hasFaction = save.faction !== null;
  const availableChars = useMemo(
    () => (hasFaction ? getCharactersByFaction(save.faction!) : CHARACTERS),
    [hasFaction, save.faction],
  );
  const selected = useMemo(() => getCharacter(selectedChar), [selectedChar]);

  // auto-pick first char of faction on faction change or first load
  useEffect(() => {
    if (hasFaction && availableChars.length > 0) {
      if (!availableChars.find((c) => c.id === selectedChar)) {
        setSelectedChar(availableChars[0].id);
      }
    }
  }, [hasFaction, availableChars, selectedChar]);

  useEffect(() => { audio.setVolume(save.volume); }, [save.volume]);
  useEffect(() => { music.setVolume(save.volume); }, [save.volume]);
  useEffect(() => {
    const runScreens: GameScreen[] = ['playing', 'paused', 'build', 'map', 'levelup', 'itempickup', 'event'];
    if (runScreens.includes(screen)) {
      music.playContext(stats.boss ? 'boss' : 'run');
      return;
    }
    music.playContext('menu');
  }, [screen, stats.boss]);
  useEffect(() => {
    const unlockMusic = () => {
      music.resume();
      window.removeEventListener('pointerdown', unlockMusic);
      window.removeEventListener('keydown', unlockMusic);
    };
    window.addEventListener('pointerdown', unlockMusic);
    window.addEventListener('keydown', unlockMusic);
    return () => {
      window.removeEventListener('pointerdown', unlockMusic);
      window.removeEventListener('keydown', unlockMusic);
    };
  }, []);
  useEffect(() => { engineRef.current?.setBindings(save.bindings); }, [save.bindings]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new GameEngine(canvas);
    engine.setBindings(loadSave().bindings);
    engineRef.current = engine;

    const offStats = engine.onStats((s) => setStats(s));
    const offLevel = engine.onLevelUp((choices) => { setSkillChoices(choices); setScreen('levelup'); });
    const offEnd = engine.onEnd((result, s) => {
      setEndResult(result); setStats(s);
      setScreen(result === 'victory' ? 'victory' : 'gameover');
      setSave((prev) => {
        // Endless: onEnd fires once per completed cycle + final defeat.
        // goldEarned is cumulative for the whole run, so only add the delta
        // since the last onEnd to avoid duplicating rewards.
        const deltaGold = Math.max(0, s.goldEarned - goldAwardedRef.current);
        let next = deltaGold > 0 ? addGold(prev, deltaGold) : prev;
        goldAwardedRef.current = s.goldEarned;

        // High score: one row per run that gets updated each cycle,
        // instead of pushing a new row per cycle.
        const runId = runIdRef.current ?? new Date().toISOString();
        if (!runIdRef.current) runIdRef.current = runId;
        const entry = { score: s.score, wave: s.wave, kills: s.kills, characterId: selectedCharRef.current, date: runId };
        next = upsertHighScore(next, entry);

        // Unlock next ascension level on victory
        if (result === 'victory') {
          const maxUnlocked = Math.min(prev.activeAscension + 1, 9);
          if (maxUnlocked > prev.highestAscension) {
            next = { ...next, highestAscension: maxUnlocked };
          }
        }
        // --- Compute THIS run's unlocks by diffing against the start snapshot.
        // All data is already persisted; nothing new is stored here. `prev`
        // already contains every weapon/enemy discovered mid-run (callbacks
        // updated it), so it's the authoritative final state.
        const start = runStartRef.current;
        const newWeapons = Object.keys(prev.armory).filter((id) => prev.armory[id] && !start.armory[id]);
        const newBestiary = Object.keys(prev.bestiary).filter((id) => (prev.bestiary[id] ?? 0) > 0 && (start.bestiary[id] ?? 0) === 0);
        const newAscension = next.highestAscension > start.highestAscension ? next.highestAscension : null;
        const newHighScore = s.score > start.topScore;
        setRunUnlocks({ weapons: newWeapons, bestiary: newBestiary, ascension: newAscension, newHighScore });
        writeSave(next);
        return next;
      });
    });
    const offWeapon = engine.onWeaponDiscover((id) => { setSave((prev) => discoverWeapon(prev, id)); });
    const offKill = engine.onKillRecord((id) => { setSave((prev) => recordKill(prev, id)); });
    const offItem = engine.onItemPickup((item, equipped, resolve) => {
      engineRef.current?.pause();
      setItemPickup({ item, equipped, resolve });
      setScreen('itempickup');
    });
    const offEvent = engine.onEventInteract((instance, resolve) => {
      engineRef.current?.pause();
      setEventData({ instance, resolve });
      setScreen('event');
    });

    return () => { offStats(); offLevel(); offEnd(); offWeapon(); offKill(); offItem(); offEvent(); engine.destroy(); engineRef.current = null; };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (rebinding) { e.preventDefault(); e.stopPropagation();
        if (e.code === 'Escape') { setRebinding(null); return; }
        setSave((prev) => setBinding(prev, rebinding, e.code)); setRebinding(null); audio.play('button'); return;
      }
      if (e.code === 'Enter' && screen === 'menu') { setScreen('chars'); audio.play('button'); }
      const pauseCode = save.bindings.pause; const mapCode = save.bindings.openMap;
      if (e.code === 'Escape' && showQuitConfirm) { e.preventDefault(); setShowQuitConfirm(false); return; }
      if ((e.code === pauseCode || e.code === 'Escape') && !showQuitConfirm && (screen === 'playing' || screen === 'paused' || screen === 'build' || screen === 'map')) {
        e.preventDefault();
        if (screen === 'playing') { engineRef.current?.pause(); setScreen('paused'); }
        else { engineRef.current?.resume(); setScreen('playing'); }
      }
      if (e.code === mapCode && (screen === 'playing' || screen === 'map')) {
        e.preventDefault();
        if (screen === 'playing') { engineRef.current?.pause(); setScreen('map'); }
        else { engineRef.current?.resume(); setScreen('playing'); }
      }
      // Hardcoded B key always toggles the build panel.
      if (e.code === 'KeyB' && (screen === 'playing' || screen === 'build')) {
        e.preventDefault();
        if (screen === 'playing') { engineRef.current?.pause(); setScreen('build'); }
        else { engineRef.current?.resume(); setScreen('playing'); }
      }
      // Hardcoded M key is an alternative way to open the map.
      if (e.code === 'KeyM' && (screen === 'playing' || screen === 'map')) {
        e.preventDefault();
        if (screen === 'playing') { engineRef.current?.pause(); setScreen('map'); }
        else { engineRef.current?.resume(); setScreen('playing'); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screen, save.bindings, rebinding, showQuitConfirm]);

  const startGame = useCallback(() => {
    audio.play('button'); audio.resume();
    music.resume();
    // Snapshot current unlock state so the end screen can diff it after the run.
    runStartRef.current = {
      armory: { ...save.armory },
      bestiary: { ...save.bestiary },
      highestAscension: save.highestAscension,
      topScore: save.highScores[0]?.score ?? 0,
    };
    goldAwardedRef.current = 0;
    runIdRef.current = new Date().toISOString();
    engineRef.current?.start(selectedChar, save.upgrades, save.bindings, save.equippedPet, seedInput.trim() || undefined, save.activeAscension, save.assistMode);
    setSeedInput('');
    setEndResult(null); setSkillChoices([]); setScreen('playing');
  }, [selectedChar, save.upgrades, save.bindings, save.equippedPet, save.activeAscension, save.armory, save.bestiary, save.highestAscension, save.highScores, seedInput]);

  const onBuyPet = (petId: string, cost: number) => {
    const next = buyPet(save, petId, cost);
    if (next) { audio.play('pickup'); setSave(next); } else { audio.play('hurt'); }
  };
  const onEquipPet = (petId: string | null) => {
    audio.play('button');
    setSave((prev) => equipPet(prev, petId));
  };

  const backToMenu = useCallback(() => { audio.play('button'); engineRef.current?.pause(); setScreen('menu'); }, []);
  const chooseSkill = (id: string) => {
    audio.play('levelup');
    engineRef.current?.applySkill(id);
    // If applySkill queued another level-up (multiple levels gained from the
    // same XP grant), the engine already pushed new choices via onLevelUp —
    // stay on the levelup screen instead of forcing back to 'playing'.
    if (engineRef.current?.hasPendingSkillChoice()) return;
    setSkillChoices([]);
    setScreen('playing');
  };

  const onBuy = (kind: 'hp' | 'damage') => {
    const level = kind === 'hp' ? save.upgrades.permHpLevel : save.upgrades.permDamageLevel;
    const cost = upgradeCost(level); const next = buyUpgrade(save, kind, cost);
    if (next) { audio.play('pickup'); setSave(next); } else { audio.play('hurt'); }
  };
  const onVolume = (v: number) => { audio.setVolume(v); setSave((prev) => setVolume(prev, v)); };

  const pickFaction = (f: Faction) => {
    audio.play('button');
    const next = setFaction(save, f);
    setSave(next);
    const chars = getCharactersByFaction(f);
    if (chars.length > 0) setSelectedChar(chars[0].id);
    setScreen('menu');
  };

  const doSwitchFaction = () => {
    if (!save.faction) return;
    const newFaction: Faction = save.faction === 'bando_moros' ? 'bando_gitanos' : 'bando_moros';
    const next = switchFaction(save, newFaction);
    setSave(next);
    const chars = getCharactersByFaction(newFaction);
    if (chars.length > 0) setSelectedChar(chars[0].id);
    setFactionConfirm(false);
    audio.play('button');
  };

  const onJoyStart = (e: React.PointerEvent<HTMLDivElement>) => { e.currentTarget.setPointerCapture(e.pointerId); moveJoy(e); };
  const onJoyMove = (e: React.PointerEvent<HTMLDivElement>) => { if (e.buttons === 0 && e.pressure === 0) return; moveJoy(e); };
  const onJoyEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    engineRef.current?.setTouchMove(0, 0, false);
    if (joyThumbRef.current) joyThumbRef.current.style.transform = 'translate(-50%, -50%)';
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* */ }
  };
  const moveJoy = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    let dx = e.clientX - cx, dy = e.clientY - cy;
    const max = rect.width / 2 - 10; const len = Math.hypot(dx, dy) || 1;
    if (len > max) { dx = (dx / len) * max; dy = (dy / len) * max; }
    if (joyThumbRef.current) joyThumbRef.current.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    engineRef.current?.setTouchMove(dx / max, dy / max, true);
  };

  const interactLabel = codeLabel(save.bindings.interact);

  return (
    <div id="game-root">
      <canvas ref={canvasRef} className="game-canvas" />

      {inGame && (
        <div className="hud">
          <div className="hud-top">
            <div className="hud-panel">
              <div className="stat-row"><span className="stat-label">Bioma</span><span className="stat-value" style={{ color: stats.biomeColor, fontSize: '0.8rem' }}>{stats.biomeIcon} {stats.biomeName}</span></div>
              <div className="stat-row"><span className="stat-label">Mapa</span><span className="stat-value score" style={{ fontSize: '0.9rem' }}>{stats.mapNumber}/{stats.totalMaps}{(stats.cycle ?? 1) > 1 ? ` · ♾️${stats.cycle}` : ''}</span></div>
              <div className="stat-row"><span className="stat-label">Puntos</span><span className="stat-value score">{stats.score.toLocaleString()}</span></div>
              <div className="stat-row"><span className="stat-label">Monedas</span><span className="stat-value" style={{ color: '#ffe14a', fontSize: '0.9rem' }}>🪙 {stats.goldEarned.toLocaleString()}</span></div>
              <div className="stat-row"><span className="stat-label">Sala</span><span className="stat-value" style={{ fontSize: '0.9rem' }}>{stats.currentRoomLabel || '—'}</span></div>
              <div className="stat-row"><span className="stat-label">Oleada</span><span className="stat-value" style={{ fontSize: '0.9rem' }}>{stats.wave > 0 ? stats.wave : '—'}</span></div>
            </div>
            <div className="hud-panel">
              <div className="stat-row"><span className="stat-label">Combo</span><span className="stat-value">x{stats.multiplier.toFixed(2)}</span></div>
              <div className="stat-row"><span className="stat-label">Nivel</span><span className="stat-value">{stats.level}</span></div>
              <div className="stat-row"><span className="stat-label">Arma</span><span className="stat-value" style={{ color: stats.weaponColor, fontSize: '0.85rem' }}>{stats.weaponName}</span></div>
            </div>
            {stats.minimap && screen !== 'map' && (
              <div className="hud-panel minimap-panel">
                <div className="stat-label" style={{ marginBottom: 4 }}>MAPA · {codeLabel(save.bindings.openMap)}</div>
                <MinimapView data={stats.minimap} />
                <div className="health-text" style={{ marginTop: 4 }}>{stats.roomsCleared}/{stats.roomsTotal} salas</div>
              </div>
            )}
          </div>
          {stats.boss && (
            <div className="boss-bar">
              <div className="name">
                {stats.boss.name}
                {stats.boss.phase && (
                  <span style={{ marginLeft: 8, fontSize: '0.8em', color: '#ffe14a' }}>
                    — {stats.boss.phase}
                  </span>
                )}
              </div>
              <div className="bar">
                <div className="fill" style={{ width: `${(stats.boss.hp / stats.boss.maxHp) * 100}%` }} />
              </div>
            </div>
          )}
          {stats.portalPrompt && (<div className="weapon-prompt" style={{ borderColor: '#ffe14a' }}>[{interactLabel}] {stats.portalPrompt.kind}</div>)}
          {!stats.portalPrompt && stats.eventPrompt && (<div className="weapon-prompt" style={{ borderColor: stats.eventPrompt.color }}>[{interactLabel}] {stats.eventPrompt.name}</div>)}
          {!stats.portalPrompt && !stats.eventPrompt && stats.chestPrompt && (<div className="weapon-prompt" style={{ borderColor: stats.chestPrompt.color }}>[{interactLabel}] {stats.chestPrompt.name}</div>)}
          {!stats.portalPrompt && !stats.eventPrompt && !stats.chestPrompt && stats.weaponPrompt && (<div className="weapon-prompt" style={{ borderColor: stats.weaponPrompt.color }}>[{interactLabel}] {stats.weaponPrompt.name}</div>)}
          {stats.stackedPickupCount > 1 && (
            <div className="weapon-prompt" style={{ borderColor: '#ffe14a', bottom: 142 }}>
              {stats.stackedPickupCount} objetos aquí — acércate a uno para elegir
            </div>
          )}
          {stats.activeChallenge && (
            <div className="boss-bar" style={{ borderColor: stats.activeChallenge.failed ? 'rgba(255,42,75,0.6)' : 'rgba(255,204,0,0.5)' }}>
              <div className="name" style={{ color: stats.activeChallenge.failed ? 'var(--hazard-red)' : 'var(--street-yellow)' }}>
                {stats.activeChallenge.desc}
                {stats.activeChallenge.time !== undefined && !stats.activeChallenge.failed && (
                  <span style={{ marginLeft: 8 }}>⏱ {stats.activeChallenge.time}s</span>
                )}
                {stats.activeChallenge.failed && <span style={{ marginLeft: 8 }}>· FALLIDO</span>}
              </div>
            </div>
          )}
          <div className="hud-bottom">
            <div className="health-bar-container">
              <div className="health-bar-bg"><div className="health-bar-fill" style={{ width: `${Math.max(0, (stats.hp / stats.maxHp) * 100)}%` }} /></div>
              <div className="xp-bar-bg"><div className="xp-bar-fill" style={{ width: `${Math.max(0, (stats.xp / stats.xpToNext) * 100)}%` }} /></div>
              <div className="health-text">HP {Math.ceil(stats.hp)}/{stats.maxHp}{stats.shield > 0 ? ` · ESCUDO ${stats.shield}` : ''}</div>
            </div>
            <div className="abilities">
              <div className="ability">💨<div className="ability-cooldown-overlay" style={{ height: `${Math.max(0, (1 - stats.dashPct) * 100)}%` }} /><span className="ability-key">{codeLabel(save.bindings.dash).slice(0, 3)}</span></div>
              <div className="ability" style={{ borderColor: stats.weaponColor }}>⚔️<span className="ability-key">{codeLabel(save.bindings.attack).slice(0, 3)}</span></div>
            </div>
          </div>
        </div>
      )}

      {screen === 'playing' && (
        <div className="touch-controls">
          <div className="joystick" onPointerDown={onJoyStart} onPointerMove={onJoyMove} onPointerUp={onJoyEnd} onPointerCancel={onJoyEnd}><div className="joystick-thumb" ref={joyThumbRef} /></div>
          <div className="touch-buttons">
            <button type="button" className="touch-btn dash" onPointerDown={(e) => { e.preventDefault(); engineRef.current?.setTouchDash(true); }} onPointerUp={() => engineRef.current?.setTouchDash(false)} onPointerCancel={() => engineRef.current?.setTouchDash(false)}>💨</button>
            <button type="button" className="touch-btn" onPointerDown={(e) => { e.preventDefault(); engineRef.current?.setTouchShoot(true); }} onPointerUp={() => engineRef.current?.setTouchShoot(false)} onPointerCancel={() => engineRef.current?.setTouchShoot(false)}>⚔️</button>
          </div>
        </div>
      )}

      <div className="overlay">
        {/* Faction choice — first run */}
        {!hasFaction && screen === 'menu' && (
          <div className="screen">
            <div className="screen-content">
              <h2 className="section-title" style={{ color: '#ffe14a' }}>ELIGE TU BANDO</h2>
              <p style={{ color: '#94a3b8', marginBottom: 20 }}>Esta decisión es permanente. Solo podrás jugar personajes del bando elegido.</p>
              <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginBottom: 16 }}>
                <button type="button" className="menu-btn" onClick={() => pickFaction('bando_moros')} style={{ fontSize: '1.1rem', padding: '16px 28px', borderColor: '#00f0ff', color: '#00f0ff' }}>
                  ⚔️ MOROS
                </button>
                <button type="button" className="menu-btn" onClick={() => pickFaction('bando_gitanos')} style={{ fontSize: '1.1rem', padding: '16px 28px', borderColor: '#ff2bd6', color: '#ff2bd6' }}>
                  🔥 GITANOS
                </button>
              </div>
            </div>
          </div>
        )}

        {(showTutorial || (!save.tutorialSeen && screen === 'menu' && hasFaction)) && (
          <div className="screen" style={{ zIndex: 20 }}>
            <div className="screen-content">
              <h2 className="section-title" style={{ color: '#ffe14a' }}>CÓMO JUGAR</h2>
              <div style={{ textAlign: 'left', fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.8, marginBottom: 16 }}>
                <p style={{ marginBottom: 8 }}>🎯 <strong style={{ color: '#e2e8f0' }}>Objetivo:</strong> Sobrevive a 10 mapas de salas procedurales, derrota al jefe de cada mapa y desciende al siguiente.</p>
                <p style={{ marginBottom: 8 }}>⌨ <strong style={{ color: '#e2e8f0' }}>Controles:</strong> {BINDING_ROWS.filter((r) => ['moveUp','moveDown','moveLeft','moveRight','attack','dash','interact'].includes(r.action)).map((r) => `${r.label}: ${codeLabel(save.bindings[r.action])}`).join(' · ')}</p>
                <p style={{ marginBottom: 8 }}>📦 <strong style={{ color: '#e2e8f0' }}>Cofres y eventos:</strong> Las salas pueden contener cofres con armas y equipo, eventos interactivos con decisiones de riesgo/recompensa, o combates con oleadas de enemigos.</p>
                <p style={{ marginBottom: 8 }}>⚔️ <strong style={{ color: '#e2e8f0' }}>Build:</strong> Al subir de nivel eliges mejoras. Equipa armaduras de set para desbloquear sinergias. Consulta tu build con la tecla B.</p>
                <p>♾️ <strong style={{ color: '#e2e8f0' }}>Endless:</strong> Tras la victoria puedes continuar con dificultad creciente. Tu puntuación y build se conservan.</p>
              </div>
              <button type="button" className="menu-btn primary full-width" onClick={() => {
                audio.play('button');
                setShowTutorial(false);
                if (!save.tutorialSeen) {
                  setSave((prev) => {
                    const next = { ...prev, tutorialSeen: true };
                    writeSave(next);
                    return next;
                  });
                }
              }}>Entendido</button>
            </div>
          </div>
        )}

        {screen === 'menu' && hasFaction && (
          <div className="screen">
            <div className="screen-content">
              <h1 className="game-title">MOROS VS GITANOS</h1>
              <h2 className="game-subtitle">2 0 3 0</h2>
              <div className="gold-box">
                <div className="label">MONEDAS ROGUELITE</div>
                <div className="value">🪙 {save.gold.toLocaleString()}</div>
              </div>
              <div style={{ textAlign: 'center', marginBottom: 8, color: factionColor(save.faction!), fontWeight: 700, letterSpacing: '0.1em' }}>
                {factionLabel(save.faction!)}
              </div>
              <div className="menu-grid">
                <button type="button" className="menu-btn primary full-width" onClick={() => { audio.play('button'); setScreen('chars'); }}>▶ Jugar</button>
                <button type="button" className="menu-btn" onClick={() => { audio.play('button'); setScreen('armory'); }}>Armería</button>
                <button type="button" className="menu-btn" onClick={() => { audio.play('button'); setScreen('bestiary'); }}>Bestiario</button>
                <button type="button" className="menu-btn" onClick={() => { audio.play('button'); setScreen('shop'); }}>Tienda</button>
                <button type="button" className="menu-btn" onClick={() => { audio.play('button'); setScreen('pets'); }}>Mascotas</button>
                <button type="button" className="menu-btn" onClick={() => { audio.play('button'); setScreen('controls'); }}>Controles</button>
                <button type="button" className="menu-btn" onClick={() => { audio.play('button'); setScreen('scores'); }}>Puntuaciones</button>
                <button type="button" className="menu-btn" onClick={() => { audio.play('button'); setScreen('options'); }}>Opciones</button>
                <button type="button" className="menu-btn" onClick={() => { audio.play('button'); setShowCodex(true); }}>Códice</button>
              </div>
              <div className="footer-text">
                <p>ROGUELIKE DE ACCIÓN · DATA-DRIVEN · CALLES 2030</p>
                <p style={{ marginTop: 8, opacity: 0.7 }}>ENTER para comenzar</p>
              </div>
            </div>
          </div>
        )}

        {screen === 'chars' && (
          <div className="screen">
            <div className="screen-content">
              <h2 className="section-title" style={{ color: factionColor(save.faction!) }}>SELECCIÓN DE PERSONAJE · {factionName(save.faction!)}</h2>
              <div className="char-grid">
                {availableChars.map((c) => (
                  <button type="button" key={c.id} className={`char-card ${selectedChar === c.id ? 'selected' : ''}`} onClick={() => { setSelectedChar(c.id); audio.play('button'); }} style={{ borderColor: selectedChar === c.id ? c.sprite.color : undefined }}>
                    <div className="name" style={{ color: c.sprite.color }}>{c.name}</div>
                    <div className="faction">{c.faction === 'bando_moros' ? '◆ BANDO MOROS' : '◆ BANDO GITANOS'}</div>
                  </button>
                ))}
              </div>
              <div className="detail-box">
                <strong style={{ color: selected.sprite.color }}>{selected.name}</strong>
                <span style={{ color: '#8891b8' }}> · {selected.faction === 'bando_moros' ? 'Moros' : 'Gitanos'}</span>
                <p style={{ marginTop: 6, opacity: 0.85 }}>{selected.description}</p>
                <p style={{ marginTop: 8, fontSize: '0.8rem', color: '#94a3b8' }}>HP {selected.stats.hp} · SPD {selected.stats.speed} · ARM {selected.stats.armor} · CRIT {Math.round(selected.stats.critChance * 100)}%</p>
                <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                  <div style={{ fontSize: '0.7rem', color: '#8891b8', letterSpacing: '0.1em' }}>PASIVA</div>
                  <div style={{ marginTop: 4, fontWeight: 800, color: selected.sprite.color }}>
                    {selected.passiveIcon} {selected.passiveName}
                  </div>
                  <div style={{ marginTop: 2, fontSize: '0.78rem', color: '#94a3b8' }}>
                    {selected.passive.map(formatPassiveMod).join(' · ')}
                  </div>
                </div>
              </div>
              <div style={{ marginBottom: 10 }}>
                <div className="menu-grid">
                  <button type="button" className="menu-btn" onClick={() => { audio.play('button'); setScreen('ascension'); }}>
                    {(() => {
                      const al = ASCENSION_LEVELS.find((l) => l.level === save.activeAscension);
                      return al ? `${al.icon} ${al.name} (Nivel ${al.level})` : '⚡ Normal (Nivel 0)';
                    })()}
                  </button>
                </div>
              </div>
              <input
                type="text"
                placeholder="Semilla (opcional)"
                value={seedInput}
                onChange={(e) => setSeedInput(e.target.value)}
                style={{ width: '100%', textAlign: 'center', marginBottom: 8, padding: '10px 18px', background: 'rgba(26,30,46,0.85)', border: '1px solid rgba(255,204,0,0.4)', color: 'var(--text)', fontFamily: 'inherit', fontSize: '0.9rem', fontWeight: 700, letterSpacing: '0.1em', borderRadius: 2 }}
              />
              <div className="menu-grid">
                <button type="button" className="menu-btn primary" onClick={startGame}>Combatir</button>
                <button type="button" className="menu-btn" onClick={backToMenu}>Volver</button>
              </div>
            </div>
          </div>
        )}

        {screen === 'ascension' && (
          <div className="screen">
            <div className="screen-content">
              <h2 className="section-title" style={{ color: '#ffe14a' }}>NIVEL DE ASCENSIÓN</h2>
              <p style={{ color: '#94a3b8', marginBottom: 16, fontSize: '0.85rem' }}>
                Modifica la dificultad. Sube el nivel para retos más duros y mejores recompensas.
              </p>
              <div style={{ marginBottom: 14 }}>
                <div className="list-scroll" style={{ maxHeight: 360 }}>
                  {ASCENSION_LEVELS.map((al) => {
                    const locked = al.level > 0 && al.level > save.highestAscension + 1;
                    const active = save.activeAscension === al.level;
                    return (
                      <div
                        key={al.level}
                        className="item-card"
                        style={{
                          borderColor: locked ? 'rgba(255,255,255,0.06)' : active ? al.color : `${al.color}44`,
                          opacity: locked ? 0.45 : 1,
                          marginBottom: 6,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 800, color: locked ? '#555' : al.color }}>
                            {al.icon} Nivel {al.level}: {al.name}
                          </span>
                          <span style={{ fontSize: '0.7rem', color: locked ? '#444' : '#8891b8' }}>
                            {locked ? '🔒' : active ? '✓ ACTIVO' : ''}
                          </span>
                        </div>
                        {!locked && (
                          <>
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 4 }}>
                              {al.description}
                            </div>
                            <div style={{ marginTop: 6, fontSize: '0.7rem', color: '#8891b8' }}>
                              {al.modifiers.map((m, i) => (
                                <span key={i} style={{ marginRight: 10 }}>{m.icon} {m.label}</span>
                              ))}
                            </div>
                          </>
                        )}
                        {!locked && !active && (
                          <button
                            type="button"
                            className="menu-btn"
                            style={{ marginTop: 6, fontSize: '0.8rem' }}
                            onClick={() => {
                              audio.play('button');
                              setSave((prev) => {
                                const next = { ...prev, activeAscension: al.level };
                                writeSave(next);
                                return next;
                              });
                            }}
                          >
                            Activar
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="menu-grid">
                <button type="button" className="menu-btn" onClick={() => { audio.play('button'); setScreen('chars'); }}>Volver</button>
              </div>
            </div>
          </div>
        )}

        {screen === 'armory' && (
          <div className="screen">
            <div className="screen-content">
              <h2 className="section-title" style={{ color: '#ffe14a' }}>ARMERÍA DE ARMAS</h2>
              <div className="list-scroll" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {WEAPON_BASES.map((w) => {
                  const discovered = !!save.armory[w.id];
                  return (
                    <div key={w.id} className={`item-card ${discovered ? '' : 'dim'}`} style={{ borderColor: discovered ? w.color : 'rgba(255,255,255,0.1)' }}>
                      <div style={{ fontWeight: 800, color: discovered ? w.color : '#888' }}>{discovered ? w.name : '???????'}</div>
                      <div style={{ fontSize: '0.75rem', color: '#8891b8', marginTop: 4 }}>
                        {discovered ? (<><div>Daño base: <strong>{w.damage}</strong> · Cadencia: {w.fireRate}/s</div><div>Proy: {w.count} · Perf: {w.pierce} · Tags: {w.tags.join(', ')}</div><div style={{ marginTop: 2, opacity: 0.7 }}>La calidad se al generar el arma.</div></>) : (<div>Arma desconocida</div>)}
                      </div>
                    </div>
                  );
                })}
              </div>
              <button type="button" className="menu-btn full-width" onClick={backToMenu}>Volver</button>
            </div>
          </div>
        )}

        {screen === 'bestiary' && (
          <div className="screen">
            <div className="screen-content">
              <h2 className="section-title" style={{ color: '#ff3b5c' }}>BESTIARIO DE ENEMIGOS</h2>
              <div className="list-scroll">
                {Object.entries(BESTIARY_LORE).map(([id, info]) => {
                  const kills = save.bestiary[id] ?? 0;
                  return (
                    <div key={id} className="item-card" style={{ borderColor: 'rgba(255,59,92,0.3)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><span style={{ fontWeight: 800 }}>{info.name}</span><span style={{ color: kills > 0 ? '#39ff88' : '#888', fontSize: '0.75rem' }}>{kills > 0 ? `${kills} ELIMINADOS` : 'NO DESCUBIERTO'}</span></div>
                      <p style={{ marginTop: 6, fontSize: '0.8rem', color: '#94a3b8' }}>{kills > 0 ? info.desc : 'Derrota a este enemigo en combate para desbloquear su registro.'}</p>
                    </div>
                  );
                })}
              </div>
              <button type="button" className="menu-btn full-width" onClick={backToMenu}>Volver</button>
            </div>
          </div>
        )}

        {screen === 'shop' && (
          <div className="screen">
            <div className="screen-content">
              <h2 className="section-title" style={{ color: '#ffe14a' }}>TIENDA PERMANENTE</h2>
              <div className="gold-box"><div className="label">SALDO</div><div className="value">🪙 {save.gold.toLocaleString()}</div></div>
              <div className="shop-row"><div><div style={{ fontWeight: 800 }}>NÚCLEO DE VITALIDAD (HP)</div><div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Nivel {save.upgrades.permHpLevel} (+{save.upgrades.permHpLevel * 10} HP)</div></div><button type="button" className="menu-btn primary" onClick={() => onBuy('hp')}>{upgradeCost(save.upgrades.permHpLevel)} 🪙</button></div>
              <div className="shop-row"><div><div style={{ fontWeight: 800 }}>POTENCIA DE DAÑO</div><div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Nivel {save.upgrades.permDamageLevel} (+{save.upgrades.permDamageLevel * 5}%)</div></div><button type="button" className="menu-btn primary" onClick={() => onBuy('damage')}>{upgradeCost(save.upgrades.permDamageLevel)} 🪙</button></div>

              <h3 style={{ color: '#b04dff', letterSpacing: '0.12em', margin: '14px 0 8px' }}>MASCOTAS</h3>
              <div className="list-scroll" style={{ maxHeight: 240 }}>
                {PET_DEFS.map((pet) => {
                  const owned = !!save.pets[pet.id];
                  const equipped = save.equippedPet === pet.id;
                  return (
                    <div key={pet.id} className="shop-row" style={{ borderColor: `${PET_RARITY_COLORS[pet.rarity]}55` }}>
                      <div>
                        <div style={{ fontWeight: 800, color: PET_RARITY_COLORS[pet.rarity] }}>
                          {pet.icon} {pet.name} <span style={{ fontSize: '0.65rem', color: '#8891b8' }}>{pet.rarity.toUpperCase()}</span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{pet.ability}</div>
                      </div>
                      {owned ? (
                        <button type="button" className={`menu-btn ${equipped ? 'primary' : ''}`} onClick={() => onEquipPet(equipped ? null : pet.id)}>
                          {equipped ? 'Equipada' : 'Equipar'}
                        </button>
                      ) : (
                        <button type="button" className="menu-btn primary" onClick={() => onBuyPet(pet.id, pet.cost)}>{pet.cost} 🪙</button>
                      )}
                    </div>
                  );
                })}
              </div>

              <button type="button" className="menu-btn full-width" onClick={backToMenu}>Volver</button>
            </div>
          </div>
        )}

        {screen === 'pets' && (() => {
          const eqPet = save.equippedPet ? getPet(save.equippedPet) : undefined;
          const owned = PET_DEFS.filter((p) => save.pets[p.id]);
          return (
            <div className="screen">
              <div className="screen-content">
                <h2 className="section-title" style={{ color: '#b04dff' }}>MASCOTAS</h2>

                <div className="detail-box" style={{ borderColor: eqPet ? `${eqPet.color}55` : undefined }}>
                  <div style={{ fontSize: '0.7rem', color: '#8891b8', marginBottom: 4 }}>EQUIPADA</div>
                  {eqPet ? (
                    <>
                      <div style={{ fontWeight: 800, color: PET_RARITY_COLORS[eqPet.rarity] }}>{eqPet.icon} {eqPet.name}</div>
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: 4 }}>{eqPet.description}</div>
                      <div style={{ fontSize: '0.78rem', color: eqPet.color, marginTop: 4 }}>Habilidad: {eqPet.ability}</div>
                      <button type="button" className="menu-btn" style={{ marginTop: 8 }} onClick={() => onEquipPet(null)}>Desequipar</button>
                    </>
                  ) : (
                    <div style={{ color: '#666' }}>Ninguna mascota equipada.</div>
                  )}
                </div>

                <h3 style={{ color: '#39ff88', letterSpacing: '0.12em', margin: '4px 0 8px' }}>
                  DESBLOQUEADAS ({owned.length}/{PET_DEFS.length})
                </h3>
                <div className="list-scroll" style={{ maxHeight: 320 }}>
                  {owned.length === 0 && (
                    <p style={{ opacity: 0.7, fontSize: '0.85rem' }}>Aún no tienes mascotas. Cómpralas en la Tienda.</p>
                  )}
                  {owned.map((pet) => {
                    const isEq = save.equippedPet === pet.id;
                    return (
                      <div key={pet.id} className="item-card" style={{ borderColor: `${PET_RARITY_COLORS[pet.rarity]}55` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 800, color: PET_RARITY_COLORS[pet.rarity] }}>{pet.icon} {pet.name}</span>
                          <button type="button" className={`menu-btn binding-btn ${isEq ? 'primary' : ''}`} onClick={() => onEquipPet(isEq ? null : pet.id)}>{isEq ? 'Equipada' : 'Equipar'}</button>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 4 }}>{pet.description}</div>
                        <div style={{ fontSize: '0.72rem', color: pet.color, marginTop: 3 }}>⚡ {pet.ability}</div>
                        <div style={{ fontSize: '0.7rem', color: '#8891b8', marginTop: 3 }}>
                          Órbita {pet.stats.orbitRadius} · Rareza {pet.rarity.toUpperCase()}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button type="button" className="menu-btn full-width" onClick={backToMenu}>Volver</button>
              </div>
            </div>
          );
        })()}

        {screen === 'controls' && (
          <div className="screen">
            <div className="screen-content">
              <h2 className="section-title" style={{ color: '#00f0ff' }}>CONTROLES Y TECLAS</h2>
              <div className="controls-info">
                <h3>⌨ Teclado actual</h3>
                {BINDING_ROWS.map((row) => (<p key={row.action}><strong>{codeLabel(save.bindings[row.action])}:</strong> {row.label}</p>))}
                <p style={{ marginTop: 8, opacity: 0.75 }}>Cambia las teclas en Opciones.</p>
                <h3>📱 Táctil</h3>
                <p><strong>Joystick izq.:</strong> Movimiento</p><p><strong>Botón ⚔️:</strong> Disparar</p><p><strong>Botón 💨:</strong> Dash</p>
              </div>
              <button type="button" className="menu-btn full-width" onClick={backToMenu}>Volver</button>
            </div>
          </div>
        )}

        {screen === 'scores' && (
          <div className="screen">
            <div className="screen-content">
              <h2 className="section-title" style={{ color: '#ffe14a' }}>MEJORES PUNTUACIONES</h2>
              <div className="highscores-list">
                {save.highScores.length === 0 ? (<p style={{ opacity: 0.7 }}>Sin puntuaciones aún. ¡Juega para registrar la primera!</p>) : (
                  save.highScores.map((hs, i) => (<div key={`${hs.date}-${i}`} className="highscore-row"><span className="highscore-rank">#{i + 1}</span><span>Ol. {hs.wave} · {hs.kills} kills · {getCharacter(hs.characterId).name}</span><span className="highscore-value">{hs.score.toLocaleString()}</span></div>))
                )}
              </div>
              <button type="button" className="menu-btn full-width" onClick={backToMenu}>Volver</button>
            </div>
          </div>
        )}

        {screen === 'options' && (
          <div className="screen">
            <div className="screen-content">
              <h2 className="section-title" style={{ color: '#00f0ff' }}>OPCIONES</h2>
              <div className="volume-row">
                <span>🔊</span><input type="range" min={0} max={1} step={0.05} value={save.volume} onChange={(e) => onVolume(Number(e.target.value))} /><span>{Math.round(save.volume * 100)}%</span>
              </div>
              <div className="volume-row" style={{ marginTop: 0 }}>
                <span style={{ fontSize: '0.85rem', color: '#94a3b8', marginRight: 8 }}>Música de menú:</span>
                <select
                  className="menu-btn"
                  style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                  value={save.menuMusicId}
                  onChange={(e) => {
                    music.setMenuTrack(e.target.value);
                    setSave((prev) => ({ ...prev, menuMusicId: e.target.value }));
                  }}
                >
                  {MENU_TRACKS.map((t) => (<option key={t.id} value={t.id} style={{ background: '#0a0c10' }}>{t.label}</option>))}
                </select>
              </div>
              <h3 style={{ color: '#ffe14a', letterSpacing: '0.12em', margin: '8px 0 12px' }}>CONFIGURAR CONTROLES</h3>
              {rebinding && (<p style={{ color: '#00f0ff', marginBottom: 10 }}>Pulsa una tecla para «{BINDING_ROWS.find((r) => r.action === rebinding)?.label}» (ESC cancela)</p>)}
              <div className="bindings-list">
                {BINDING_ROWS.map((row) => (
                  <div key={row.action} className="binding-row"><span>{row.label}</span><button type="button" className={`menu-btn binding-btn ${rebinding === row.action ? 'primary' : ''}`} onClick={() => { audio.play('button'); setRebinding(row.action); }}>{codeLabel(save.bindings[row.action])}</button></div>
                ))}
              </div>
              <button type="button" className="menu-btn" style={{ marginBottom: 10, width: '100%' }} onClick={() => { audio.play('button'); setSave((prev) => resetBindings(prev)); setRebinding(null); }}>Restablecer controles</button>

              <h3 style={{ color: '#ff2bd6', letterSpacing: '0.12em', margin: '16px 0 10px' }}>BANDO</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: 8 }}>
                Bando actual: <strong style={{ color: factionColor(save.faction!) }}>{factionLabel(save.faction!)}</strong>
              </p>
              {!factionConfirm ? (
                <button type="button" className="menu-btn" style={{ marginBottom: 10, width: '100%', borderColor: '#ff2a4b', color: '#ff2a4b' }} onClick={() => { audio.play('button'); setFactionConfirm(true); }}>
                  Cambiar bando (reinicia progreso)
                </button>
              ) : (
                <div style={{ marginBottom: 10, padding: '10px 12px', background: 'rgba(255,42,75,0.15)', border: '1px solid rgba(255,42,75,0.5)', borderRadius: 4 }}>
                  <p style={{ color: '#ff2a4b', fontSize: '0.85rem', marginBottom: 8 }}>⚠️ Esto borrará TODO tu progreso (oro, mejoras, puntuaciones). ¿Confirmas?</p>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                    <button type="button" className="menu-btn" onClick={doSwitchFaction} style={{ borderColor: '#ff2a4b', color: '#ff2a4b' }}>Sí, reiniciar</button>
                    <button type="button" className="menu-btn" onClick={() => { audio.play('button'); setFactionConfirm(false); }}>Cancelar</button>
                  </div>
                </div>
              )}

              <button type="button" className="menu-btn" style={{ marginBottom: 10, width: '100%' }} onClick={() => {
                audio.play('button');
                const fresh: SaveData = { faction: null, gold: 0, armory: { pulse_pistol: true }, bestiary: {}, upgrades: { permHpLevel: 0, permDamageLevel: 0 }, highScores: [], volume: save.volume, bindings: { ...DEFAULT_BINDINGS }, pets: {}, equippedPet: null, highestAscension: 0, activeAscension: 0, tutorialSeen: false, assistMode: false, menuMusicId: 'menu1' };
                writeSave(fresh); setSave(fresh); setRebinding(null);
              }}>Borrar progreso</button>

              <h3 style={{ color: '#00f0ff', letterSpacing: '0.12em', margin: '16px 0 10px' }}>RESPALDO</h3>
              <button type="button" className="menu-btn" style={{ marginBottom: 10, width: '100%' }} onClick={() => {
                audio.play('button');
                const json = exportSaveToJson(save);
                const blob = new Blob([json], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `moros-vs-gitanos-2030-save-${Date.now()}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}>⬇️ Exportar partida</button>

              <input
                type="file"
                accept="application/json"
                id="import-save-input"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    const imported = importSaveFromJson(String(reader.result));
                    if (!imported) {
                      setImportError('El archivo no es una partida válida.');
                      return;
                    }
                    writeSave(imported);
                    setSave(imported);
                    setImportError(null);
                  };
                  reader.readAsText(file);
                  e.target.value = '';
                }}
              />
              <button type="button" className="menu-btn" style={{ marginBottom: 6, width: '100%' }} onClick={() => {
                audio.play('button');
                document.getElementById('import-save-input')?.click();
              }}>⬆️ Importar partida</button>
              {importError && (<p style={{ color: '#ff2a4b', fontSize: '0.8rem', marginBottom: 10 }}>{importError}</p>)}

              <h3 style={{ color: '#39ff88', letterSpacing: '0.12em', margin: '16px 0 10px' }}>ACCESIBILIDAD</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, padding: '10px 12px', background: 'rgba(57,255,136,0.08)', border: '1px solid rgba(57,255,136,0.25)', borderRadius: 4 }}>
                <input type="checkbox" checked={save.assistMode} onChange={(e) => {
                  const next = { ...save, assistMode: e.target.checked };
                  writeSave(next); setSave(next);
                }} style={{ accentColor: '#39ff88', width: 18, height: 18 }} />
                <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Modo asistido (-25% daño recibido) — pensado para quienes quieren disfrutar el contenido con menos presión de combate.</span>
              </div>

              <button type="button" className="menu-btn" style={{ marginBottom: 10, width: '100%' }} onClick={() => { audio.play('button'); setShowTutorial(true); }}>Ver tutorial</button>
              <button type="button" className="menu-btn full-width" onClick={backToMenu}>Volver</button>
            </div>
          </div>
        )}

        {showCodex && (
          <div className="screen">
            <div className="screen-content">
              <h2 className="section-title" style={{ color: '#b04dff' }}>CÓDICE DE SINERGIAS</h2>
              <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: 12 }}>
                Sets de equipo y sus bonificaciones por piezas equipadas.
              </p>
              <div className="list-scroll" style={{ maxHeight: 420 }}>
                {SET_DEFS.map((set) => (
                  <div key={set.setId} style={{ marginBottom: 14, padding: '10px 12px', border: `1px solid ${set.color}55`, borderRadius: 4 }}>
                    <div style={{ color: set.color, fontWeight: 'bold', marginBottom: 4 }}>{set.name}</div>
                    <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: 6 }}>{set.identity} — {set.playstyle}</div>
                    {set.bonuses.map((b) => (
                      <div key={b.pieces} style={{ fontSize: '0.78rem', color: '#e2e8f0', marginBottom: 2 }}>
                        ({b.pieces}) {b.description}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <button type="button" className="menu-btn full-width" style={{ marginTop: 12 }} onClick={() => { audio.play('button'); setShowCodex(false); }}>Volver</button>
            </div>
          </div>
        )}

        {screen === 'paused' && (
          <div className="screen">
            <div className="screen-content">
              <h2 className="section-title" style={{ color: '#ffe14a' }}>PAUSA</h2>
              <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: 4, marginBottom: 12 }}>
                Semilla: {String(engineRef.current?.getRunSeed())}
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(String(engineRef.current?.getRunSeed()))}
                  style={{ marginLeft: 8, background: 'none', border: 'none', color: '#00f0ff', cursor: 'pointer' }}
                >
                  📋 Copiar
                </button>
              </p>
              <div className="menu-grid">
                <button type="button" className="menu-btn primary full-width" onClick={() => { audio.play('button'); engineRef.current?.resume(); setScreen('playing'); }}>Continuar</button>
                <button type="button" className="menu-btn full-width" onClick={() => { audio.play('button'); setScreen('build'); }}>Build</button>
                <button type="button" className="menu-btn full-width" onClick={() => { audio.play('button'); setScreen('map'); }}>Mapa</button>
                <button type="button" className="menu-btn full-width" onClick={() => { audio.play('button'); setShowQuitConfirm(true); }}>Menú principal</button>
              </div>

              {showQuitConfirm && (
                <div className="screen" style={{ zIndex: 20 }}>
                  <div className="screen-content">
                    <h2 className="section-title" style={{ color: '#ff2a4b' }}>¿SALIR AL MENÚ?</h2>
                    <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: 16 }}>
                      Se guardará el oro y el progreso ganados hasta ahora en esta partida.
                    </p>
                    <div className="menu-grid">
                      <button
                        type="button"
                        className="menu-btn primary full-width"
                        style={{ borderColor: '#ff2a4b' }}
                        onClick={() => {
                          audio.play('button');
                          engineRef.current?.abandonRun();
                          setShowQuitConfirm(false);
                          setScreen('menu');
                        }}
                      >
                        Sí, salir
                      </button>
                      <button
                        type="button"
                        className="menu-btn full-width"
                        onClick={() => { audio.play('button'); setShowQuitConfirm(false); }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {screen === 'build' && stats.build && (
          <div className="screen">
            <div className="screen-content build-screen-content">
              <h2 className="section-title" style={{ color: '#b04dff' }}>BUILD</h2>
              <BuildPanel build={stats.build} />
              <div className="menu-grid" style={{ marginTop: 16 }}>
                <button type="button" className="menu-btn primary" onClick={() => { audio.play('button'); setScreen('paused'); }}>Volver</button>
              </div>
            </div>
          </div>
        )}

        {screen === 'event' && eventData && (
          <div className="screen">
            <div className="screen-content">
              <h2 className="section-title" style={{ color: eventData.instance.color }}>
                {eventData.instance.icon} {eventData.instance.name.toUpperCase()}
              </h2>
              <div style={{ marginBottom: 16, color: '#94a3b8', fontSize: '0.85rem' }}>
                {eventData.instance.description}
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                {eventData.instance.options?.map((opt: any, i: number) => {
                  const canAffordGold = !opt.costGold || stats.goldEarned >= opt.costGold;
                  const canAffordHp = !opt.costHpPct || stats.hp > stats.maxHp * opt.costHpPct;
                  const canAfford = canAffordGold && canAffordHp;
                  
                  return (
                    <button
                      key={i}
                      type="button"
                      disabled={!canAfford}
                      className="menu-btn"
                      style={{ textAlign: 'left', opacity: canAfford ? 1 : 0.5 }}
                      onClick={() => {
                        eventData.resolve(i);
                        setEventData(null);
                        engineRef.current?.resume();
                        setScreen('playing');
                      }}
                    >
                      <div style={{ fontWeight: 800, color: opt.color, marginBottom: 4 }}>{opt.label}</div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{opt.description}</div>
                      {(opt.costGold || opt.costHpPct) && (
                        <div style={{ fontSize: '0.7rem', marginTop: 6, color: '#ff2a4b' }}>
                          Coste: {opt.costGold ? `${opt.costGold} 🪙` : ''} {opt.costHpPct ? `Pierdes ${Math.round(opt.costHpPct * 100)}% de Vida Max` : ''}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              <button type="button" className="menu-btn full-width" onClick={() => {
                eventData.resolve(null);
                setEventData(null);
                engineRef.current?.resume();
                setScreen('playing');
              }}>
                Ignorar
              </button>
            </div>
          </div>
        )}

        {screen === 'itempickup' && itemPickup && (() => {
    const curEq = itemPickup.equipped.find((e) => e.slot === itemPickup.item.slot);
    return (
      <div className="screen">
        <div className="screen-content">
          <h2 className="section-title" style={{ color: itemPickup.item.color }}>
            {itemPickup.item.icon} OBJETO ENCONTRADO · {EQUIP_SLOT_LABELS[itemPickup.item.slot].toUpperCase()}
          </h2>

          {/* Side-by-side comparison */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            {/* CURRENT */}
            <div style={{ padding: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 4, textAlign: 'left' }}>
              <div style={{ fontSize: '0.7rem', color: '#8891b8', marginBottom: 6 }}>EQUIPADO</div>
              {curEq ? (
                <>
                  <div style={{ fontWeight: 800, color: curEq.color, marginBottom: 4 }}>{curEq.icon} {curEq.name}</div>
                  <div style={{ fontSize: '0.7rem', color: EQ_COLORS[curEq.rarity as keyof typeof EQ_COLORS] ?? '#888', marginBottom: 4 }}>{curEq.rarity.toUpperCase()}</div>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{curEq.description}</div>
                  <div style={{ fontSize: '0.7rem', color: '#8891b8', marginTop: 6 }}>
                    {curEq.mods.map((m, j) => <span key={j} style={{ marginRight: 8 }}>{m.label}</span>)}
                  </div>
                </>
              ) : (
                <div style={{ color: '#555', fontSize: '0.8rem' }}>(Vacío)</div>
              )}
            </div>
            {/* NEW */}
            <div style={{ padding: 10, background: 'rgba(0,0,0,0.3)', border: `2px solid ${itemPickup.item.color}66`, borderRadius: 4, textAlign: 'left' }}>
              <div style={{ fontSize: '0.7rem', color: '#39ff88', marginBottom: 6 }}>ENCONTRADO</div>
              <div style={{ fontWeight: 800, color: itemPickup.item.color, marginBottom: 4 }}>{itemPickup.item.icon} {itemPickup.item.name}</div>
              <div style={{ fontSize: '0.7rem', color: EQ_COLORS[itemPickup.item.rarity as keyof typeof EQ_COLORS] ?? '#888', marginBottom: 4 }}>{itemPickup.item.rarity.toUpperCase()}</div>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{itemPickup.item.description}</div>
              <div style={{ fontSize: '0.7rem', color: '#8891b8', marginTop: 6 }}>
                {itemPickup.item.mods.map((m, j) => <span key={j} style={{ marginRight: 8 }}>{m.label}</span>)}
              </div>
            </div>
          </div>

          <div className="menu-grid">
            <button type="button" className="menu-btn primary" onClick={() => {
              itemPickup.resolve(itemPickup.item.slot);
              setItemPickup(null);
              engineRef.current?.resume();
              setScreen('playing');
            }}>
              Equipar
            </button>
            <button type="button" className="menu-btn" onClick={() => {
              itemPickup.resolve(null);
              setItemPickup(null);
              engineRef.current?.resume();
              setScreen('playing');
            }}>
              Mantener {curEq ? 'actual' : 'vacío'}
            </button>
          </div>
          {itemPickup.item.setId && (
            <div style={{ marginTop: 12, fontSize: '0.75rem', color: '#b04dff' }}>
              Pertenece al conjunto: <strong>{itemPickup.item.setId.replace('set_','')}</strong>
            </div>
          )}
        </div>
      </div>
    );
  })()}

        {screen === 'map' && (
          <div className="screen">
            <div className="screen-content" style={{ maxWidth: 820 }}>
              <h2 className="section-title" style={{ color: stats.biomeColor }}>
                {stats.biomeIcon} {stats.biomeName.toUpperCase()} · MAPA {stats.mapNumber}/{stats.totalMaps}
              </h2>
              <p style={{ color: '#94a3b8', marginBottom: 12, fontSize: '0.85rem' }}>Sala actual, descubiertas y pasillos · {codeLabel(save.bindings.openMap)} / ESC para cerrar</p>
              {stats.minimap && <MinimapView data={stats.minimap} large />}
              <div className="menu-grid" style={{ marginTop: 16 }}>
                <button type="button" className="menu-btn primary full-width" onClick={() => { audio.play('button'); engineRef.current?.resume(); setScreen('playing'); }}>Cerrar mapa</button>
              </div>
            </div>
          </div>
        )}

        {screen === 'levelup' && (
          <div className="screen">
            <div className="screen-content">
              <h2 className="section-title" style={{ color: '#b04dff' }}>SUBIDA DE NIVEL</h2>
              <p style={{ color: '#94a3b8', marginBottom: 8 }}>Elige una mejora para tu run</p>
              <div className="skill-grid">
                {skillChoices.map((s) => (<button type="button" key={s.id} className="skill-card" onClick={() => chooseSkill(s.id)}><div className="title"><span className="icon">{s.icon}</span>{s.name}</div><div className="desc">{s.description}</div></button>))}
              </div>
            </div>
          </div>
        )}

        {(screen === 'gameover' || screen === 'victory') && (
          <div className="screen">
            <div className="screen-content">
              <h2 className="section-title" style={{ color: endResult === 'victory' ? '#39ff88' : '#ff2a4b' }}>{endResult === 'victory' ? 'VICTORIA 2030' : 'CAÍDA EN LAS CALLES'}</h2>
              <div className="detail-box">
                <div className="stat-row"><span>Puntos</span><span className="stat-value score">{stats.score.toLocaleString()}</span></div>
                <div className="stat-row"><span>Salas</span><span className="stat-value">{stats.roomsCleared}/{stats.roomsTotal}</span></div>
                <div className="stat-row"><span>Bajas</span><span className="stat-value">{stats.kills}</span></div>
                <div className="stat-row"><span>Monedas ganadas</span><span className="stat-value">🪙 {stats.goldEarned}</span></div>
              </div>

              {(() => {
                const hasUnlocks =
                  runUnlocks.weapons.length > 0 ||
                  runUnlocks.bestiary.length > 0 ||
                  runUnlocks.ascension !== null ||
                  runUnlocks.newHighScore;
                if (!hasUnlocks) return null;
                return (
                  <div className="detail-box" style={{ borderColor: 'rgba(255,204,0,0.4)' }}>
                    <div style={{ fontWeight: 800, color: '#ffe14a', letterSpacing: '0.12em', marginBottom: 8 }}>
                      ✨ DESBLOQUEOS DE ESTA PARTIDA
                    </div>
                    {runUnlocks.newHighScore && (
                      <div style={{ fontSize: '0.85rem', color: '#39ff88', marginBottom: 6 }}>🏆 ¡Nuevo récord de puntuación!</div>
                    )}
                    {runUnlocks.ascension !== null && (() => {
                      const al = ASCENSION_LEVELS.find((l) => l.level === runUnlocks.ascension);
                      return (
                        <div style={{ fontSize: '0.85rem', color: '#00c8ff', marginBottom: 6 }}>
                          ⬆️ Ascensión desbloqueada: {al ? `${al.icon} ${al.name} (Nivel ${al.level})` : `Nivel ${runUnlocks.ascension}`}
                        </div>
                      );
                    })()}
                    {runUnlocks.weapons.length > 0 && (
                      <div style={{ marginBottom: 6 }}>
                        <div style={{ fontSize: '0.72rem', color: '#8891b8', letterSpacing: '0.1em' }}>ARMAS NUEVAS (ARMERÍA)</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                          {runUnlocks.weapons.map((id) => {
                            const w = WEAPON_BASES.find((b) => b.id === id);
                            return (
                              <span key={id} style={{ fontSize: '0.78rem', padding: '2px 8px', borderRadius: 3, border: `1px solid ${w?.color ?? '#888'}55`, color: w?.color ?? '#e2e8f0' }}>
                                ⚔️ {w?.name ?? id}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {runUnlocks.bestiary.length > 0 && (
                      <div>
                        <div style={{ fontSize: '0.72rem', color: '#8891b8', letterSpacing: '0.1em' }}>ENEMIGOS DESCUBIERTOS (BESTIARIO)</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                          {runUnlocks.bestiary.map((id) => {
                            const info = BESTIARY_LORE[id];
                            return (
                              <span key={id} style={{ fontSize: '0.78rem', padding: '2px 8px', borderRadius: 3, border: '1px solid rgba(255,59,92,0.3)', color: '#ff3b5c' }}>
                                👹 {info?.name ?? id}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {showModifierChoice && (
                <div className="screen" style={{ zIndex: 20 }}>
                  <div className="screen-content">
                    <h2 className="section-title" style={{ color: '#b04dff' }}>ELIGE UN MODIFICADOR</h2>
                    <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: 12 }}>
                      Se acumula con los que ya tengas activos en esta partida.
                    </p>
                    <div className="menu-grid">
                      {engineRef.current?.getEndlessModifierChoices().map((mod) => (
                        <button
                          key={mod.id}
                          type="button"
                          className="menu-btn full-width"
                          style={{ textAlign: 'left' }}
                          onClick={() => {
                            audio.play('levelup');
                            engineRef.current?.applyEndlessModifier(mod.id);
                            engineRef.current?.continueEndless();
                            setShowModifierChoice(false);
                            setEndResult(null);
                            setScreen('playing');
                          }}
                        >
                          {mod.icon} <strong>{mod.label}</strong><br />
                          <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{mod.description}</span>
                        </button>
                      ))}
                      <button
                        type="button"
                        className="menu-btn primary full-width"
                        onClick={() => {
                          audio.play('button');
                          engineRef.current?.continueEndless();
                          setShowModifierChoice(false);
                          setEndResult(null);
                          setScreen('playing');
                        }}
                      >
                        Sin modificador, continuar
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="menu-grid">
                {endResult === 'victory' && (
                  <button
                    type="button"
                    className="menu-btn primary full-width"
                    style={{ borderColor: '#b04dff' }}
                    onClick={() => { audio.play('button'); setShowModifierChoice(true); }}
                  >
                    ♾️ Continuar · Ciclo {(stats.cycle ?? 1) + 1}
                  </button>
                )}
                <button type="button" className="menu-btn primary" onClick={startGame}>Reintentar</button>
                <button type="button" className="menu-btn" onClick={backToMenu}>Menú</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
