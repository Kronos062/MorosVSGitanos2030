import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CHARACTERS, getCharacter, getCharactersByFaction, factionColor, factionName } from './content/characters';
import type { Faction } from './content/characters';
import { WEAPONS, RARITY_COLORS } from './content/weapons';
import { BESTIARY_LORE } from './content/enemies';
import { GameEngine } from './game/engine';
import { audio } from './game/audio';
import type { GameStats, GameScreen, SkillChoice, InputAction, MinimapData, BuildStats } from './game/types';
import {
  loadSave,
  writeSave,
  discoverWeapon,
  recordKill,
  addGold,
  buyUpgrade,
  pushHighScore,
  setVolume,
  setBinding,
  resetBindings,
  setFaction,
  switchFaction,
  upgradeCost,
  codeLabel,
  factionLabel,
  DEFAULT_BINDINGS,
  type SaveData,
} from './game/persistence';

const emptyStats: GameStats = {
  hp: 0, maxHp: 1, shield: 0, level: 1, xp: 0, xpToNext: 40, dashPct: 1,
  score: 0, wave: 0, kills: 0, combo: 0, multiplier: 1,
  weaponName: '', weaponColor: '#00f0ff',
  boss: null, weaponPrompt: null, chestPrompt: null,
  ended: null, goldEarned: 0,
  currentRoomLabel: '', roomsCleared: 0, roomsTotal: 0,
  minimap: null, build: null,
};

const BINDING_ROWS: Array<{ action: InputAction; label: string }> = [
  { action: 'up', label: 'Arriba' },
  { action: 'down', label: 'Abajo' },
  { action: 'left', label: 'Izquierda' },
  { action: 'right', label: 'Derecha' },
  { action: 'shoot', label: 'Disparar' },
  { action: 'dash', label: 'Dash' },
  { action: 'interact', label: 'Interactuar' },
  { action: 'pause', label: 'Pausa' },
  { action: 'map', label: 'Mapa' },
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
  return (
    <div style={{ textAlign: 'left', fontSize: '0.85rem' }}>
      <h3 style={{ color: build.color, marginBottom: 12, letterSpacing: '0.08em' }}>{build.name} · Nivel {build.level}</h3>

      <div style={{ marginBottom: 14, padding: '10px 12px', background: 'rgba(255,204,0,0.08)', border: '1px solid rgba(255,204,0,0.25)', borderRadius: 4 }}>
        <div style={{ fontWeight: 800, color: build.weaponColor, marginBottom: 6 }}>⚔️ Arma equipada</div>
        <div><strong style={{ color: RARITY_COLORS[build.weaponRarity as keyof typeof RARITY_COLORS] ?? build.weaponColor }}>{build.weaponName}</strong></div>
        <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: 4 }}>
          <div>Daño: {build.weaponDamage} · Cadencia: {build.weaponFireRate}/s</div>
          <div>Proyectiles: {build.weaponCount} · Perforación: {build.weaponPierce} · Dispersión: {Math.round(build.weaponSpread * 100)}%</div>
          <div>Tags: {build.weaponTags.join(', ')}</div>
        </div>
      </div>

      {build.hasNearbyWeapon && (
        <div style={{ marginBottom: 14, padding: '10px 12px', background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.25)', borderRadius: 4 }}>
          <div style={{ fontWeight: 800, color: '#00c8ff', marginBottom: 4 }}>🔀 Arma cercana</div>
          <div>{build.nearbyWeaponName}</div>
        </div>
      )}

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 800, color: '#ffe14a', marginBottom: 8, letterSpacing: '0.1em' }}>ESTADÍSTICAS</div>
        <div className="build-grid">
          <div className="build-cell"><span className="build-cell-label">Vida</span><span className="build-cell-value" style={{ color: '#ff2a4b' }}>{Math.ceil(build.hp)}/{build.maxHp}</span></div>
          <div className="build-cell"><span className="build-cell-label">Escudo</span><span className="build-cell-value" style={{ color: '#00f0ff' }}>{build.shield}</span></div>
          <div className="build-cell"><span className="build-cell-label">Armadura</span><span className="build-cell-value">{build.armor}</span></div>
          <div className="build-cell"><span className="build-cell-label">Velocidad</span><span className="build-cell-value" style={{ color: '#39ff88' }}>{build.speed}</span></div>
          <div className="build-cell"><span className="build-cell-label">Crítico</span><span className="build-cell-value" style={{ color: '#ffe14a' }}>{Math.round(build.critChance * 100)}%</span></div>
          <div className="build-cell"><span className="build-cell-label">Robo vida</span><span className="build-cell-value" style={{ color: '#ff2bd6' }}>{Math.round(build.lifesteal * 100)}%</span></div>
        </div>
      </div>

      <div style={{ padding: '10px 12px', background: 'rgba(176,77,255,0.08)', border: '1px solid rgba(176,77,255,0.25)', borderRadius: 4 }}>
        <div style={{ fontWeight: 800, color: '#b04dff', marginBottom: 6, letterSpacing: '0.1em' }}>BONIFICACIONES</div>
        <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
          <div>Daño: +{Math.round((build.damageMult - 1) * 100)}%</div>
          <div>Velocidad: +{Math.round((build.speedMult - 1) * 100)}%</div>
          <div>Perforación: +{build.pierceBonus}</div>
          <div>Proyectiles: +{build.countBonus}</div>
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
  const joyThumbRef = useRef<HTMLDivElement>(null);
  const selectedCharRef = useRef(selectedChar);
  selectedCharRef.current = selectedChar;

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
        let next = addGold(prev, s.goldEarned);
        next = pushHighScore(next, { score: s.score, wave: s.wave, kills: s.kills, characterId: selectedCharRef.current, date: new Date().toISOString() });
        return next;
      });
    });
    const offWeapon = engine.onWeaponDiscover((id) => { setSave((prev) => discoverWeapon(prev, id)); });
    const offKill = engine.onKillRecord((id) => { setSave((prev) => recordKill(prev, id)); });

    return () => { offStats(); offLevel(); offEnd(); offWeapon(); offKill(); engine.destroy(); engineRef.current = null; };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (rebinding) { e.preventDefault(); e.stopPropagation();
        if (e.code === 'Escape') { setRebinding(null); return; }
        setSave((prev) => setBinding(prev, rebinding, e.code)); setRebinding(null); audio.play('button'); return;
      }
      if (e.code === 'Enter' && screen === 'menu') { setScreen('chars'); audio.play('button'); }
      const pauseCode = save.bindings.pause; const mapCode = save.bindings.map;
      if ((e.code === pauseCode || e.code === 'Escape') && (screen === 'playing' || screen === 'paused' || screen === 'build' || screen === 'map')) {
        e.preventDefault();
        if (screen === 'playing') { engineRef.current?.pause(); setScreen('paused'); }
        else { engineRef.current?.resume(); setScreen('playing'); }
      }
      if (e.code === mapCode && (screen === 'playing' || screen === 'map')) {
        e.preventDefault();
        if (screen === 'playing') { engineRef.current?.pause(); setScreen('map'); }
        else { engineRef.current?.resume(); setScreen('playing'); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screen, save.bindings, rebinding]);

  const startGame = useCallback(() => {
    audio.play('button'); audio.resume();
    engineRef.current?.start(selectedChar, save.upgrades, save.bindings);
    setEndResult(null); setSkillChoices([]); setScreen('playing');
  }, [selectedChar, save.upgrades, save.bindings]);

  const backToMenu = useCallback(() => { audio.play('button'); engineRef.current?.pause(); setScreen('menu'); }, []);
  const chooseSkill = (id: string) => { audio.play('levelup'); engineRef.current?.applySkill(id); setSkillChoices([]); setScreen('playing'); };

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

  const inGame = screen === 'playing' || screen === 'paused' || screen === 'levelup' || screen === 'build' || screen === 'map';
  const interactLabel = codeLabel(save.bindings.interact);

  return (
    <div id="game-root">
      <canvas ref={canvasRef} className="game-canvas" />

      {inGame && (
        <div className="hud">
          <div className="hud-top">
            <div className="hud-panel">
              <div className="stat-row"><span className="stat-label">Puntos</span><span className="stat-value score">{stats.score.toLocaleString()}</span></div>
              <div className="stat-row"><span className="stat-label">Sala</span><span className="stat-value" style={{ fontSize: '0.9rem' }}>{stats.currentRoomLabel || '—'}</span></div>
              <div className="stat-row"><span className="stat-label">Oleada</span><span className="stat-value" style={{ fontSize: '0.9rem' }}>{stats.wave > 0 ? stats.wave : '—'}</span></div>
              <div className="stat-row"><span className="stat-label">Bajas</span><span className="stat-value">{stats.kills}</span></div>
            </div>
            <div className="hud-panel">
              <div className="stat-row"><span className="stat-label">Combo</span><span className="stat-value">x{stats.multiplier.toFixed(2)}</span></div>
              <div className="stat-row"><span className="stat-label">Nivel</span><span className="stat-value">{stats.level}</span></div>
              <div className="stat-row"><span className="stat-label">Arma</span><span className="stat-value" style={{ color: stats.weaponColor, fontSize: '0.85rem' }}>{stats.weaponName}</span></div>
            </div>
            {stats.minimap && screen !== 'map' && (
              <div className="hud-panel minimap-panel">
                <div className="stat-label" style={{ marginBottom: 4 }}>MAPA · {codeLabel(save.bindings.map)}</div>
                <MinimapView data={stats.minimap} />
                <div className="health-text" style={{ marginTop: 4 }}>{stats.roomsCleared}/{stats.roomsTotal} salas</div>
              </div>
            )}
          </div>
          {stats.boss && (<div className="boss-bar"><div className="name">{stats.boss.name}</div><div className="bar"><div className="fill" style={{ width: `${(stats.boss.hp / stats.boss.maxHp) * 100}%` }} /></div></div>)}
          {stats.chestPrompt && (<div className="weapon-prompt" style={{ borderColor: stats.chestPrompt.color }}>[{interactLabel}] {stats.chestPrompt.name}</div>)}
          {!stats.chestPrompt && stats.weaponPrompt && (<div className="weapon-prompt" style={{ borderColor: stats.weaponPrompt.color }}>[{interactLabel}] {stats.weaponPrompt.name}</div>)}
          <div className="hud-bottom">
            <div className="health-bar-container">
              <div className="health-bar-bg"><div className="health-bar-fill" style={{ width: `${Math.max(0, (stats.hp / stats.maxHp) * 100)}%` }} /></div>
              <div className="xp-bar-bg"><div className="xp-bar-fill" style={{ width: `${Math.max(0, (stats.xp / stats.xpToNext) * 100)}%` }} /></div>
              <div className="health-text">HP {Math.ceil(stats.hp)}/{stats.maxHp}{stats.shield > 0 ? ` · ESCUDO ${stats.shield}` : ''}</div>
            </div>
            <div className="abilities">
              <div className="ability">💨<div className="ability-cooldown-overlay" style={{ height: `${Math.max(0, (1 - stats.dashPct) * 100)}%` }} /><span className="ability-key">{codeLabel(save.bindings.dash).slice(0, 3)}</span></div>
              <div className="ability" style={{ borderColor: stats.weaponColor }}>⚔️<span className="ability-key">{codeLabel(save.bindings.shoot).slice(0, 3)}</span></div>
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
                <button type="button" className="menu-btn" onClick={() => { audio.play('button'); setScreen('controls'); }}>Controles</button>
                <button type="button" className="menu-btn" onClick={() => { audio.play('button'); setScreen('scores'); }}>Puntuaciones</button>
                <button type="button" className="menu-btn" onClick={() => { audio.play('button'); setScreen('options'); }}>Opciones</button>
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
              </div>
              <div className="menu-grid">
                <button type="button" className="menu-btn primary" onClick={startGame}>Combatir</button>
                <button type="button" className="menu-btn" onClick={backToMenu}>Volver</button>
              </div>
            </div>
          </div>
        )}

        {screen === 'armory' && (
          <div className="screen">
            <div className="screen-content">
              <h2 className="section-title" style={{ color: '#ffe14a' }}>ARMERÍA DE ARMAS</h2>
              <div className="list-scroll" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {WEAPONS.map((w) => {
                  const discovered = !!save.armory[w.id];
                  return (
                    <div key={w.id} className={`item-card ${discovered ? '' : 'dim'}`} style={{ borderColor: discovered ? w.color : 'rgba(255,255,255,0.1)' }}>
                      <div style={{ fontWeight: 800, color: discovered ? w.color : '#888' }}>{discovered ? w.name : '???????'}</div>
                      <div style={{ fontSize: '0.75rem', color: '#8891b8', marginTop: 4 }}>
                        {discovered ? (<><div>Rareza: <strong style={{ color: RARITY_COLORS[w.rarity] }}>{w.rarity.toUpperCase()}</strong></div><div>Daño: {w.damage} | Cadencia: {w.fireRate}/s</div><div>Proyectiles: {w.count} | Penetración: {w.pierce}</div></>) : (<div>Arma desconocida</div>)}
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
              <button type="button" className="menu-btn full-width" onClick={backToMenu}>Volver</button>
            </div>
          </div>
        )}

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
                const fresh: SaveData = { faction: null, gold: 0, armory: { pistol: true }, bestiary: {}, upgrades: { permHpLevel: 0, permDamageLevel: 0 }, highScores: [], volume: save.volume, bindings: { ...DEFAULT_BINDINGS } };
                writeSave(fresh); setSave(fresh); setRebinding(null);
              }}>Borrar progreso</button>
              <button type="button" className="menu-btn full-width" onClick={backToMenu}>Volver</button>
            </div>
          </div>
        )}

        {screen === 'paused' && (
          <div className="screen">
            <div className="screen-content">
              <h2 className="section-title" style={{ color: '#ffe14a' }}>PAUSA</h2>
              <div className="menu-grid">
                <button type="button" className="menu-btn primary full-width" onClick={() => { audio.play('button'); engineRef.current?.resume(); setScreen('playing'); }}>Continuar</button>
                <button type="button" className="menu-btn full-width" onClick={() => { audio.play('button'); setScreen('build'); }}>Build</button>
                <button type="button" className="menu-btn full-width" onClick={() => { audio.play('button'); setScreen('map'); }}>Mapa</button>
                <button type="button" className="menu-btn full-width" onClick={backToMenu}>Menú principal</button>
              </div>
            </div>
          </div>
        )}

        {screen === 'build' && stats.build && (
          <div className="screen">
            <div className="screen-content">
              <h2 className="section-title" style={{ color: '#b04dff' }}>BUILD</h2>
              <BuildPanel build={stats.build} />
              <div className="menu-grid" style={{ marginTop: 16 }}>
                <button type="button" className="menu-btn primary" onClick={() => { audio.play('button'); setScreen('paused'); }}>Volver</button>
              </div>
            </div>
          </div>
        )}

        {screen === 'map' && (
          <div className="screen">
            <div className="screen-content" style={{ maxWidth: 820 }}>
              <h2 className="section-title" style={{ color: '#00f0ff' }}>MAPA GLOBAL</h2>
              <p style={{ color: '#94a3b8', marginBottom: 12, fontSize: '0.85rem' }}>Sala actual, descubiertas y pasillos · {codeLabel(save.bindings.map)} / ESC para cerrar</p>
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
              <div className="menu-grid">
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
