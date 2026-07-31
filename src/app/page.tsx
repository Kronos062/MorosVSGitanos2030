'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { bootstrapGame, type GameHandle, type GameStats } from '@/gameplay/main';
import { BestiaryStore as BestiaryManager } from '@/gameplay/persistence/BestiaryStore';
import { ArmoryStore as ArmoryManager } from '@/gameplay/persistence/ArmoryStore';
import { ShopSystem, type UpgradesState } from '@/gameplay/shop/ShopSystem';
import { LocalApiClient } from '@/gameplay/persistence/ApiClient';
import type { KeyBindings } from '@/engine/input/InputManager';
import weaponsData from '@/content/weapons.json';

type Phase = 'menu' | 'playing' | 'paused' | 'gameover';

interface ScoreStats {
  score: number;
  wave: number;
  kills: number;
  combo: number;
  multiplier: number;
}

interface RunEndData {
  result: 'victory' | 'defeat';
  score: number;
  wave: number;
  kills: number;
}

interface HighScoreEntry {
  score: number;
  wave: number;
  kills: number;
  date: number;
}

interface CharacterItem {
  id: string;
  name: string;
  faction: string;
  description: string;
  sprite: { color: string };
}

interface SkillChoice {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: string;
}

const HIGH_SCORES_KEY = 'mvg_highscores_v1';

function loadHighScores(): HighScoreEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(HIGH_SCORES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as HighScoreEntry[];
  } catch {
    return [];
  }
}

function saveHighScore(entry: HighScoreEntry): HighScoreEntry[] {
  const list = loadHighScores();
  list.push(entry);
  list.sort((a, b) => b.score - a.score);
  const top = list.slice(0, 10);
  try {
    localStorage.setItem(HIGH_SCORES_KEY, JSON.stringify(top));
  } catch { /* noop */ }
  return top;
}

export default function GamePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameHandle | null>(null);
  const joyRef = useRef<HTMLDivElement>(null);
  const atkRef = useRef<HTMLButtonElement>(null);
  const dashRef = useRef<HTMLButtonElement>(null);

  const [phase, setPhase] = useState<Phase>('menu');
  const [selectedChar, setSelectedChar] = useState('tariq');
  const [gStats, setGStats] = useState<GameStats | null>(null);
  const [sStats, setSStats] = useState<ScoreStats | null>(null);
  const [endData, setEndData] = useState<RunEndData | null>(null);
  const [highScores, setHighScores] = useState<HighScoreEntry[]>([]);
  const [banner, setBanner] = useState<string | null>(null);
  const [damageFlash, setDamageFlash] = useState(false);
  const [comboPulse, setComboPulse] = useState(0);
  const [volume, setVolume] = useState(0.3);
  const [skillChoices, setSkillChoices] = useState<SkillChoice[] | null>(null);

  // Bootstrap
  useEffect(() => {
    if (!canvasRef.current) return;
    const game = bootstrapGame(canvasRef.current);
    gameRef.current = game;
    setHighScores(loadHighScores());

    const unsubStats = game.onStats((s) => setGStats(s));

    return () => {
      unsubStats();
      game.destroy();
    };
  }, []);

  // Polling de score y fin de partida
  useEffect(() => {
    if (phase !== 'playing') return;
    let raf = 0;
    const tick = () => {
      const g = gameRef.current;
      if (!g) return;
      setSStats(g.getScore());
      const state = g.getRunState();
      if (state.ended) {
        const data: RunEndData = {
          result: state.ended,
          score: g.getScore().score,
          wave: state.currentWave,
          kills: g.getScore().kills,
        };
        setEndData(data);
        setPhase('gameover');

        // Persistir el resultado y el oro ganado en la base de datos local (Roguelite style)
        const apiClient = new LocalApiClient();
        apiClient.endRun(`run_${Date.now()}`, {
          playerId: 'local_player',
          score: data.score,
          wave: data.wave,
          kills: data.kills,
          level: data.wave,
          duration: 120,
          result: data.result,
        });

        const updated = saveHighScore({ ...data, date: Date.now() });
        setHighScores(updated);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  // Combo pulse
  useEffect(() => {
    if (!sStats) return;
    setComboPulse((n) => n + 1);
    const t = setTimeout(() => setComboPulse(0), 100);
    return () => clearTimeout(t);
  }, [sStats?.combo]);

  // Keyboard global
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const g = gameRef.current;
      if (!g) return;
      if (phase === 'menu' && e.code === 'Enter') startGame(selectedChar);
      else if (phase === 'gameover' && (e.code === 'Enter' || e.code === 'KeyR')) restart();
      else if (phase === 'playing' && (e.code === 'KeyP' || e.code === 'Escape')) togglePause();
      else if (phase === 'paused' && (e.code === 'KeyP' || e.code === 'Escape')) resume();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, selectedChar]);

  // Damage flash
  useEffect(() => {
    let prevHp = gStats?.hp ?? 100;
    if (!gStats) return;
    if (gStats.hp < prevHp) {
      setDamageFlash(true);
      const t = setTimeout(() => setDamageFlash(false), 150);
      prevHp = gStats.hp;
      return () => clearTimeout(t);
    }
    prevHp = gStats.hp;
  }, [gStats]);

  // Wave banner
  useEffect(() => {
    if (!sStats) return;
    setBanner(`OLEADA ${sStats.wave}`);
    const t = setTimeout(() => setBanner(null), 1800);
    return () => clearTimeout(t);
  }, [sStats?.wave]);

  const startGame = useCallback((charId?: string) => {
    const c = charId ?? selectedChar;
    gameRef.current?.start(c);
    setPhase('playing');
    setEndData(null);
    setSkillChoices(null);
  }, [selectedChar]);

  const restart = useCallback(() => {
    gameRef.current?.restart(selectedChar);
    setPhase('playing');
    setEndData(null);
    setSkillChoices(null);
  }, [selectedChar]);

  const toMenu = useCallback(() => {
    gameRef.current?.pause();
    setPhase('menu');
  }, []);

  const togglePause = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    g.togglePause();
    setPhase((p) => p === 'playing' ? 'paused' : 'playing');
  }, []);

  const resume = useCallback(() => {
    gameRef.current?.resume();
    setPhase('playing');
  }, []);

  const handleVolumeChange = (v: number) => {
    setVolume(v);
    gameRef.current?.setAudioVolume(v);
  };

  const handleSelectSkill = (skillId: string) => {
    gameRef.current?.applySkill(skillId);
    setSkillChoices(null);
    gameRef.current?.resume();
  };

  return (
    <div id="game-root">
      <canvas ref={canvasRef} />
      <div className="vignette" />
      <div className={`damage-flash ${damageFlash ? 'active' : ''}`} />

      {(phase === 'playing' || phase === 'paused') && gStats && sStats && (
        <HUD
          pStats={gStats}
          sStats={sStats}
          onPause={togglePause}
          comboPulse={comboPulse}
        />
      )}

      {/* Touch controls */}
      <div className="touch-controls">
        <div ref={joyRef} className="joystick"><div className="joystick-thumb" /></div>
        <div className="touch-buttons">
          <button ref={dashRef} className="touch-btn skill" aria-label="Dash">💨</button>
          <button ref={atkRef} className="touch-btn attack" aria-label="Atacar">⚔️</button>
        </div>
      </div>

      {banner && phase === 'playing' && <div className="wave-indicator">{banner}</div>}

      {/* Modal de Mapa Global Abierto con M */}
      {phase === 'playing' && gStats?.radarData.mapOpened && (
        <GlobalMapModal
          radarData={gStats.radarData}
          onClose={() => {
            if (gStats) gStats.radarData.mapOpened = false;
          }}
        />
      )}

      {/* Modal de Selección de Habilidad Pasiva al Subir de Nivel */}
      {skillChoices && (
        <div className="overlay" style={{ zIndex: 100 }}>
          <div className="screen">
            <div className="screen-content" style={{ maxWidth: 600 }}>
              <h2 style={{ color: '#ffe14a', letterSpacing: '0.15em', marginBottom: 8, fontSize: '2rem' }}>¡NIVEL ARRIBA!</h2>
              <p style={{ opacity: 0.8, marginBottom: 20 }}>Selecciona un atributo o mejora pasiva:</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                {skillChoices.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleSelectSkill(s.id)}
                    className="menu-btn"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 16,
                      padding: 16,
                      background: 'rgba(20,26,51,0.85)',
                      borderColor: s.rarity === 'epic' ? '#b04dff' : s.rarity === 'rare' ? '#00f0ff' : '#39ff88',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ fontSize: '2rem' }}>{s.icon}</div>
                    <div>
                      <div style={{ fontWeight: 'bold', color: '#fff', fontSize: '1.1rem' }}>{s.name}</div>
                      <div style={{ fontSize: '0.85rem', color: '#8891b8', marginTop: 2 }}>{s.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {phase === 'menu' && (
        <MenuScreen
          selectedChar={selectedChar}
          onSelectChar={setSelectedChar}
          onStart={startGame}
          highScores={highScores}
          volume={volume}
          onVolumeChange={handleVolumeChange}
          gameRef={gameRef}
        />
      )}

      {phase === 'paused' && (
        <PauseScreen onResume={resume} onRestart={restart} onQuit={toMenu} />
      )}

      {phase === 'gameover' && endData && (
        <GameOverScreen data={endData} onRestart={restart} onMenu={toMenu} />
      )}
    </div>
  );
}

// ===== Sub-components =====

function HUD({
  pStats, sStats, onPause, comboPulse,
}: {
  pStats: GameStats; sStats: ScoreStats; onPause: () => void; comboPulse: number;
}) {
  return (
    <div className="hud">
      {/* Boss Health Bar Overlay */}
      {pStats.bossStats && (
        <div style={{
          position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
          width: 380, maxWidth: '80vw', textAlign: 'center', pointerEvents: 'none', zIndex: 30,
        }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#ff3b5c', textShadow: '0 0 10px #ff3b5c', marginBottom: 4 }}>
            ⚠️ {pStats.bossStats.name.toUpperCase()} (FASE {pStats.bossStats.phase})
          </div>
          <div style={{ width: '100%', height: 14, background: 'rgba(0,0,0,0.8)', border: '1px solid #ff3b5c', position: 'relative' }}>
            <div style={{
              height: '100%', background: 'linear-gradient(90deg, #ff3b5c, #ffe14a)',
              width: `${Math.max(0, (pStats.bossStats.hp / pStats.bossStats.maxHp) * 100)}%`,
              transition: 'width 0.2s ease-out',
            }} />
          </div>
        </div>
      )}

      <div className="hud-top">
        <div className="hud-panel">
          <div className="stat-row">
            <span className="stat-label">OLEADA</span>
            <span className="stat-value">{sStats.wave}</span>
          </div>
          <div className="stat-row" style={{ marginTop: 4 }}>
            <span className="stat-label">NIVEL</span>
            <span className="stat-value">{pStats.level}</span>
          </div>
        </div>

        <div className="hud-panel" style={{ textAlign: 'center' }}>
          <div className="stat-row">
            <span className="stat-label">PUNTOS</span>
            <span className="stat-value score">{sStats.score.toLocaleString()}</span>
          </div>
          {pStats.activeEventName && (
            <div style={{ fontSize: '0.75rem', color: '#39ff88', marginTop: 4, fontWeight: 'bold' }}>
              🌐 {pStats.activeEventName} ({pStats.activeEventTimer}s)
            </div>
          )}
        </div>

        {/* Radar Minimap Widget con indicador [M] */}
        <div
          className="hud-panel"
          style={{ padding: 4, width: 90, height: 60, position: 'relative', cursor: 'pointer', pointerEvents: 'auto' }}
          onClick={() => { pStats.radarData.mapOpened = true; }}
          title="Haz clic o pulsa M para abrir el Mapa Global"
        >
          <RadarWidget radarData={pStats.radarData} />
          <span style={{ position: 'absolute', bottom: 2, right: 4, fontSize: '0.6rem', color: '#ffe14a', fontWeight: 'bold' }}>[M] MAPA</span>
        </div>

        <div className="hud-panel" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="stat-label" style={{ fontSize: '0.7rem' }}>PAUSA</span>
          <button className="pause-btn" onClick={onPause} aria-label="Pausar">⏸</button>
        </div>
      </div>

      {sStats.combo >= 2 && (
        <div className="combo-counter">
          <div className="combo-label">COMBO</div>
          <div className={`combo-value ${comboPulse ? 'pulse' : ''}`}>{sStats.combo}x</div>
          <div className="combo-multiplier">×{sStats.multiplier.toFixed(1)}</div>
        </div>
      )}

      {/* Sinergias Activas Badges */}
      {pStats.activeSynergies.length > 0 && (
        <div style={{ position: 'absolute', top: 90, left: 16, display: 'flex', gap: 6, pointerEvents: 'none' }}>
          {pStats.activeSynergies.map((syn) => (
            <span key={syn} style={{
              background: 'rgba(255,225,74,0.2)', border: '1px solid #ffe14a',
              color: '#ffe14a', fontSize: '0.7rem', padding: '2px 6px', fontWeight: 'bold',
            }}>
              ⚡ {syn}
            </span>
          ))}
        </div>
      )}

      {/* Cartel Interactivo de Intercambio de Arma en el Suelo (BUG 4 Fix) */}
      {pStats.weaponPrompt && (
        <div style={{
          position: 'absolute', bottom: 110, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(10, 14, 31, 0.92)', border: '2px solid #b04dff',
          padding: '12px 24px', borderRadius: 8, textAlign: 'center', zIndex: 40,
          boxShadow: '0 0 25px rgba(176, 77, 255, 0.6)', pointerEvents: 'none',
          backdropFilter: 'blur(6px)', width: 340, maxWidth: '90vw',
        }}>
          <div style={{ color: '#ffe14a', fontWeight: 'bold', fontSize: '1.1rem', letterSpacing: '0.1em' }}>
            📦 {pStats.weaponPrompt.weaponName.toUpperCase()}
          </div>
          <div style={{ fontSize: '0.85rem', color: '#e8ecff', display: 'flex', gap: 16, justifyContent: 'center', margin: '6px 0' }}>
            <span>Daño: <strong style={{ color: '#39ff88' }}>{pStats.weaponPrompt.damage}</strong> <span style={{ opacity: 0.6 }}>(Actual: {pStats.weaponPrompt.currentDamage})</span></span>
            <span>Cadencia: <strong style={{ color: '#00f0ff' }}>{pStats.weaponPrompt.fireRate}</strong> <span style={{ opacity: 0.6 }}>(Actual: {pStats.weaponPrompt.currentFireRate})</span></span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#8891b8', marginBottom: 6 }}>
            Munición: <strong style={{ color: '#ffe14a' }}>Infinita</strong>
          </div>
          <div style={{ color: '#00f0ff', fontWeight: 'bold', fontSize: '0.85rem', borderTop: '1px solid rgba(0,240,255,0.2)', paddingTop: 6 }}>
            [E] Pulsa E para sustituir tu arma actual
          </div>
        </div>
      )}

      <div className="hud-bottom">
        <div>
          <div className="health-bar-container">
            <div className="health-bar-bg">
              <div className="health-bar-fill" style={{ width: `${Math.max(0, (pStats.hp / pStats.maxHp) * 100)}%` }} />
            </div>
            <div className="health-text">
              VIDA {Math.ceil(pStats.hp)} / {pStats.maxHp}
              {pStats.shield > 0 && ` • 🛡 ×${pStats.shield}`}
              {sStats.kills > 0 && ` • ${sStats.kills} KILLS`}
            </div>
          </div>
        </div>
        <div className="abilities">
          <div className={`ability ${pStats.dashPct < 1 ? 'on-cooldown' : ''}`}>
            <div className="ability-icon">💨</div>
            <div className="ability-cooldown-overlay" style={{ height: `${(1 - pStats.dashPct) * 100}%` }} />
            <div className="ability-key">SHIFT</div>
          </div>
          <div className="ability">
            <div className="ability-icon">⚔️</div>
            <div className="ability-key">SPACE</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GlobalMapModal({ radarData, onClose }: { radarData: GameStats['radarData']; onClose: () => void }) {
  return (
    <div className="overlay" style={{ zIndex: 120 }}>
      <div className="screen">
        <div className="screen-content" style={{ maxWidth: 750 }}>
          <h2 style={{ color: '#00f0ff', letterSpacing: '0.15em', marginBottom: 12 }}>MAPA GLOBAL DE SALAS Y PASILLOS</h2>
          <p style={{ fontSize: '0.85rem', opacity: 0.8, marginBottom: 20 }}>Recorrido físico lineal continuo a través de los 10 niveles:</p>

          <div style={{
            display: 'flex', gap: 6, overflowX: 'auto', padding: '16px 8px',
            background: 'rgba(5, 6, 13, 0.9)', border: '1px solid rgba(0,240,255,0.4)',
            borderRadius: 8, marginBottom: 20, alignItems: 'center',
          }}>
            {radarData.globalNodes.map((node) => {
              const isActive = node.index === radarData.activeNodeIndex;
              const isCleared = node.status === 'cleared';
              const isCorridor = node.type === 'corridor';

              const color = isCleared ? '#39ff88' : isActive ? '#ff3b5c' : '#00f0ff';
              const bg = isCleared ? 'rgba(57,255,136,0.15)' : isActive ? 'rgba(255,59,92,0.25)' : 'rgba(20,26,51,0.6)';

              if (isCorridor) {
                return (
                  <div key={node.index} style={{ width: 24, height: 4, background: '#ffe14a', opacity: isCleared || isActive ? 1 : 0.3 }} />
                );
              }

              return (
                <div
                  key={node.index}
                  style={{
                    minWidth: 50, height: 50, padding: 4,
                    background: bg, border: `2px solid ${color}`,
                    borderRadius: node.type === 'boss' ? '50%' : 6,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    boxShadow: isActive ? '0 0 15px #ff3b5c' : 'none',
                    position: 'relative',
                  }}
                >
                  <span style={{ fontSize: '0.65rem', color: '#8891b8' }}>Niv.{node.level}</span>
                  <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#fff' }}>
                    {node.type === 'boss' ? '👑' : node.type === 'treasure' ? '🎁' : isCleared ? '✓' : isActive ? '👤' : '?'}
                  </span>
                </div>
              );
            })}
          </div>

          <button className="menu-btn primary" onClick={onClose}>[M] / [X] CERRAR MAPA</button>
        </div>
      </div>
    </div>
  );
}

function RadarWidget({ radarData }: { radarData: GameStats['radarData'] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'rgba(5, 6, 13, 0.85)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.3)';
    ctx.strokeRect(0, 0, canvas.width, canvas.height);

    for (const dot of radarData.dots) {
      const dx = dot.x * canvas.width;
      const dy = dot.y * canvas.height;

      if (dot.kind === 'player') {
        ctx.fillStyle = '#00f0ff';
        ctx.beginPath(); ctx.arc(dx, dy, 3, 0, Math.PI * 2); ctx.fill();
      } else if (dot.kind === 'enemy') {
        ctx.fillStyle = '#ff3b5c';
        ctx.beginPath(); ctx.arc(dx, dy, 2, 0, Math.PI * 2); ctx.fill();
      } else if (dot.kind === 'boss') {
        ctx.fillStyle = '#b04dff';
        ctx.beginPath(); ctx.arc(dx, dy, 4, 0, Math.PI * 2); ctx.fill();
      } else if (dot.kind === 'chest') {
        ctx.fillStyle = '#ffe14a';
        ctx.fillRect(dx - 2, dy - 2, 4, 4);
      } else if (dot.kind === 'door') {
        ctx.fillStyle = '#39ff88';
        ctx.beginPath(); ctx.arc(dx, dy, 3, 0, Math.PI * 2); ctx.fill();
      }
    }
  }, [radarData]);

  return <canvas ref={canvasRef} width={80} height={50} style={{ width: '100%', height: '100%', display: 'block' }} />;
}

const CHARACTERS: CharacterItem[] = [
  { id: 'tariq', name: 'Comandante Tariq', faction: 'Bando Moros', description: 'Líder táctico. Gran armadura inicial y resistencia.', sprite: { color: '#00f0ff' } },
  { id: 'ziryab', name: 'Alquimista Ziryab', faction: 'Bando Moros', description: 'Maestro de la química y energía. Disparos corrosivos.', sprite: { color: '#39ff88' } },
  { id: 'benghazi', name: 'Jinete Benghazi', faction: 'Bando Moros', description: 'Rápido y ágil en combate a distancia.', sprite: { color: '#ffe14a' } },
  { id: 'sombra', name: 'Sombra de Córdoba', faction: 'Bando Moros', description: 'Asesino sigiloso con alta probabilidad crítica.', sprite: { color: '#b04dff' } },
  { id: 'alhambra', name: 'Guardián Alhambra', faction: 'Bando Moros', description: 'Baluarte inexpugnable de alta supervivencia.', sprite: { color: '#0099ff' } },
  { id: 'bailaor_furia', name: 'Bailaor Furia', faction: 'Bando Gitanos', description: 'Ataques de fuego frenéticos con alto ritmo.', sprite: { color: '#ff2bd6' } },
  { id: 'rayo', name: 'Guitarrista Rayo', faction: 'Bando Gitanos', description: 'Descargas eléctricas resonantes en cadena.', sprite: { color: '#ffe14a' } },
  { id: 'bronce', name: 'Campero Bronce', faction: 'Bando Gitanos', description: 'Especialista en emboscadas y rifles de largo alcance.', sprite: { color: '#ff8800' } },
  { id: 'hechicera_lola', name: 'Hechicera Lola', faction: 'Bando Gitanos', description: 'Mística misteriosa de gran potencia mística.', sprite: { color: '#ff3b5c' } },
  { id: 'patriarca', name: 'Patriarca Hierro', faction: 'Bando Gitanos', description: 'Veterano curtido con potencia devastadora.', sprite: { color: '#ff2bd6' } },
];

const BESTIARY_LORE: Record<string, { name: string; desc: string }> = {
  grunt: { name: 'Drone Cyber', desc: 'Unidad autómata básica de combate directo.' },
  shooter: { name: 'Centinela Neón', desc: 'Francotirador de apoyo con proyectiles de plasma.' },
  bomber: { name: 'Bombardero', desc: 'Unidad suicida equipada con cargas detonantes.' },
  tank: { name: 'Pesado Blindado', desc: 'Baluarte metálico de alta resistencia.' },
  swarm: { name: 'Enjambre', desc: 'Minidrones veloces que atacan en grupo.' },
  sniper: { name: 'Francotirador Cyber', desc: 'Impactos de largo alcance y alta potencia.' },
  assassin: { name: 'Asesino Neón', desc: 'Sigiloso y veloz, busca flanquear al jugador.' },
  shield_bearer: { name: 'Portador de Escudo', desc: 'Genera barreras físicas defensivas.' },
  summoner: { name: 'Invocador Cyber', desc: 'Invoca refuerzos continuos en la arena.' },
  boss_dragon_2030: { name: 'Mecha Dragón 2030', desc: 'Titan biomecánico de 3 fases de combate.' },
};

function MenuScreen({
  selectedChar, onSelectChar, onStart, highScores, volume, onVolumeChange, gameRef,
}: {
  selectedChar: string;
  onSelectChar: (id: string) => void;
  onStart: (id?: string) => void;
  highScores: HighScoreEntry[];
  volume: number;
  onVolumeChange: (v: number) => void;
  gameRef: React.RefObject<GameHandle | null>;
}) {
  const [sub, setSub] = useState<'main' | 'chars' | 'controls' | 'scores' | 'options' | 'bestiary' | 'shop' | 'armory'>('main');
  const [bestiaryData, setBestiaryData] = useState<Record<string, number>>({});
  const [armoryData, setArmoryData] = useState<Record<string, boolean>>({});
  const [playerGold, setPlayerGold] = useState(0);
  const [upgrades, setUpgrades] = useState<UpgradesState>({ permHpLevel: 0, permDamageLevel: 0, permSpeedLevel: 0, permGoldLevel: 0 });

  const shopSystemRef = useRef(new ShopSystem());
  const apiClientRef = useRef(new LocalApiClient());

  // Cargar saldo de monedas persistente de forma roguelite
  useEffect(() => {
    apiClientRef.current.getProfile('local_player').then((p) => {
      setPlayerGold(p.gold);
    });
  }, [sub]);

  useEffect(() => {
    if (sub === 'bestiary') {
      setBestiaryData(BestiaryManager.load());
    } else if (sub === 'armory') {
      setArmoryData(ArmoryManager.load());
    } else if (sub === 'shop') {
      shopSystemRef.current.getUpgrades().then(setUpgrades);
    }
  }, [sub]);

  const selectedItem = CHARACTERS.find((c) => c.id === selectedChar) ?? CHARACTERS[0];

  const handleBuy = async (stat: keyof UpgradesState) => {
    const res = await shopSystemRef.current.buyUpgrade('local_player', stat);
    if (res.success && res.upgrades) {
      setUpgrades(res.upgrades);
      if (res.profile) setPlayerGold(res.profile.gold);
    }
  };

  return (
    <div className="overlay">
      <div className="screen">
        <div className="screen-content">
          {sub === 'main' && (
            <>
              {/* Título y Subtítulo no recortados */}
              <h1 className="game-title">MOROS VS GITANOS</h1>
              <h2 className="game-subtitle">2 0 3 0</h2>

              {/* MEJORA 1: Cuadro Prominente de Monedas Totales Roguelite en Menú Principal */}
              <div style={{
                margin: '12px auto 20px auto',
                padding: '10px 20px',
                background: 'rgba(10, 14, 31, 0.85)',
                border: '1px solid rgba(255, 225, 74, 0.5)',
                borderRadius: 6,
                boxShadow: '0 0 20px rgba(255, 225, 74, 0.25)',
                maxWidth: 260,
                textAlign: 'center',
              }}>
                <div style={{ fontSize: '0.75rem', color: '#8891b8', letterSpacing: '0.2em', textTransform: 'uppercase' }}>MONEDAS ROGUELITE</div>
                <div style={{ fontSize: '1.8rem', color: '#ffe14a', fontWeight: 900, textShadow: '0 0 10px rgba(255,225,74,0.7)', marginTop: 2 }}>
                  🪙 {playerGold.toLocaleString()}
                </div>
              </div>

              {/* Distribución limpia en cuadrícula de 2 columnas */}
              <div className="menu-grid">
                <button className="menu-btn primary full-width" onClick={() => onStart(selectedChar)}>▶ INICIAR PARTIDA</button>
                <button className="menu-btn" onClick={() => setSub('chars')}>👤 PERSONAJES ({selectedItem.name})</button>
                <button className="menu-btn" onClick={() => setSub('shop')}>🏛 TIENDA PERMANENTE</button>
                <button className="menu-btn" onClick={() => setSub('armory')}>⚔️ ARMERÍA</button>
                <button className="menu-btn" onClick={() => setSub('bestiary')}>📖 BESTIARIO</button>
                <button className="menu-btn" onClick={() => setSub('controls')}>⌨ CONTROLES</button>
                <button className="menu-btn" onClick={() => setSub('options')}>⚙ OPCIONES</button>
                <button className="menu-btn full-width" onClick={() => setSub('scores')}>🏆 PUNTUACIONES</button>
              </div>
              <div className="footer-text">
                <p>ROGUELIKE DE ACCIÓN • DATA-DRIVEN • ECS LIGERO</p>
                <p style={{ marginTop: 8, opacity: 0.7 }}>ENTER para comenzar</p>
              </div>
            </>
          )}

          {sub === 'chars' && (
            <>
              <h2 style={{ color: '#00f0ff', letterSpacing: '0.15em', marginBottom: 16 }}>SELECCIÓN DE PERSONAJE</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, maxHeight: 280, overflowY: 'auto', marginBottom: 16, textAlign: 'left' }}>
                {CHARACTERS.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => onSelectChar(c.id)}
                    style={{
                      padding: '8px 12px',
                      background: selectedChar === c.id ? 'rgba(0,240,255,0.2)' : 'rgba(10,14,31,0.6)',
                      border: `1px solid ${selectedChar === c.id ? '#00f0ff' : 'rgba(255,255,255,0.1)'}`,
                      color: '#fff',
                      textAlign: 'left',
                      cursor: 'pointer',
                      borderRadius: 4,
                    }}
                  >
                    <div style={{ fontWeight: 'bold', color: c.sprite.color }}>{c.name}</div>
                    <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>{c.faction}</div>
                  </button>
                ))}
              </div>
              <div style={{ background: 'rgba(0,0,0,0.4)', padding: 12, borderRadius: 4, marginBottom: 16, textAlign: 'left', fontSize: '0.85rem' }}>
                <strong style={{ color: selectedItem.sprite.color }}>{selectedItem.name}</strong> ({selectedItem.faction})
                <p style={{ marginTop: 4, opacity: 0.8 }}>{selectedItem.description}</p>
              </div>
              <button className="menu-btn primary" onClick={() => setSub('main')}>✓ CONFIRMAR Y VOLVER</button>
            </>
          )}

          {sub === 'armory' && (
            <>
              <h2 style={{ color: '#ffe14a', letterSpacing: '0.15em', marginBottom: 16 }}>ARMERÍA DE ARMAS</h2>
              <div style={{ maxHeight: 320, overflowY: 'auto', textAlign: 'left', marginBottom: 16, paddingRight: 6 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {weaponsData.map((w) => {
                    const discovered = !!armoryData[w.id];
                    return (
                      <div
                        key={w.id}
                        style={{
                          background: discovered ? 'rgba(20,26,51,0.8)' : 'rgba(10,14,31,0.5)',
                          border: `1px solid ${discovered ? (w.color ?? '#00f0ff') : 'rgba(255,255,255,0.1)'}`,
                          padding: 10,
                          borderRadius: 6,
                          opacity: discovered ? 1 : 0.45,
                        }}
                      >
                        <div style={{ fontWeight: 'bold', color: discovered ? (w.color ?? '#00f0ff') : '#888', fontSize: '0.95rem' }}>
                          {discovered ? w.name : '???????'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#8891b8', marginTop: 4 }}>
                          {discovered ? (
                            <>
                              <div>Rareza: <strong style={{ color: w.color ?? '#fff' }}>{w.rarity.toUpperCase()}</strong></div>
                              <div>Daño: {w.damage} | Cadencia: {w.fireRate}/s</div>
                              <div>Proyectiles: {w.count} | Penetración: {w.pierce}</div>
                            </>
                          ) : (
                            <div>Arma desconocida</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <button className="menu-btn" onClick={() => setSub('main')}>← VOLVER</button>
            </>
          )}

          {sub === 'bestiary' && (
            <>
              <h2 style={{ color: '#ff3b5c', letterSpacing: '0.15em', marginBottom: 16 }}>BESTIARIO DE ENEMIGOS</h2>
              <div style={{ maxHeight: 300, overflowY: 'auto', textAlign: 'left', marginBottom: 16, paddingRight: 8 }}>
                {Object.entries(BESTIARY_LORE).map(([id, info]) => {
                  const kills = bestiaryData[id] ?? 0;
                  return (
                    <div key={id} style={{ background: 'rgba(10,14,31,0.7)', border: '1px solid rgba(255,59,92,0.3)', padding: 10, marginBottom: 8, borderRadius: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', color: '#00f0ff' }}>
                        <span>{info.name}</span>
                        <span style={{ color: kills > 0 ? '#39ff88' : '#888' }}>{kills > 0 ? `${kills} ELIMINADOS` : 'NO DESCUBIERTO'}</span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#8891b8', marginTop: 4 }}>
                        {kills > 0 ? info.desc : 'Derrota a este enemigo en combate para desbloquear su registro.'}
                      </div>
                    </div>
                  );
                })}
              </div>
              <button className="menu-btn" onClick={() => setSub('main')}>← VOLVER</button>
            </>
          )}

          {sub === 'shop' && (
            <>
              <h2 style={{ color: '#ffe14a', letterSpacing: '0.15em', marginBottom: 16 }}>TIENDA PERMANENTE</h2>
              <div style={{ textAlign: 'left', marginBottom: 16 }}>
                <div style={{ background: 'rgba(10,14,31,0.7)', border: '1px solid rgba(0,240,255,0.3)', padding: 12, marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 'bold', color: '#39ff88' }}>NÚCLEO DE VITALIDAD (HP)</div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>Nivel actual: {upgrades.permHpLevel} (+{upgrades.permHpLevel * 10} HP)</div>
                  </div>
                  <button className="menu-btn" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => handleBuy('permHpLevel')}>
                    MEJORAR ({shopSystemRef.current.getCost(upgrades.permHpLevel)} 🪙)
                  </button>
                </div>
                <div style={{ background: 'rgba(10,14,31,0.7)', border: '1px solid rgba(0,240,255,0.3)', padding: 12, marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 'bold', color: '#ff3b5c' }}>POTENCIA DE DAÑO</div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>Nivel actual: {upgrades.permDamageLevel} (+{upgrades.permDamageLevel * 5}%)</div>
                  </div>
                  <button className="menu-btn" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => handleBuy('permDamageLevel')}>
                    MEJORAR ({shopSystemRef.current.getCost(upgrades.permDamageLevel)} 🪙)
                  </button>
                </div>
              </div>
              <button className="menu-btn" onClick={() => setSub('main')}>← VOLVER</button>
            </>
          )}

          {sub === 'controls' && (
            <>
              <h2 style={{ color: '#00f0ff', letterSpacing: '0.15em', marginBottom: 16 }}>CONTROLES Y TECLAS</h2>
              <div className="controls-info">
                <h3>⌨ Teclado</h3>
                <p><strong>WASD / Flechas:</strong> Movimiento</p>
                <p><strong>Espacio:</strong> Disparar (auto-apunta si estás quieto)</p>
                <p><strong>Shift:</strong> Dash / Esquiva táctica</p>
                <p><strong>E:</strong> Intercambiar arma en el suelo</p>
                <p><strong>M:</strong> Abrir / Cerrar Mapa Global</p>
                <p><strong>P / Esc:</strong> Pausa</p>
                <div className="control-section">
                  <h3>📱 Táctil</h3>
                  <p><strong>Joystick izq.:</strong> Movimiento</p>
                  <p><strong>Botón ⚔️:</strong> Disparar</p>
                  <p><strong>Botón 💨:</strong> Dash / Intercambiar</p>
                </div>
              </div>
              <button className="menu-btn" onClick={() => setSub('main')}>← VOLVER</button>
            </>
          )}

          {sub === 'scores' && (
            <>
              <h2 style={{ color: '#ffe14a', letterSpacing: '0.15em', marginBottom: 16 }}>MEJORES PUNTUACIONES</h2>
              <div className="highscores-list">
                {highScores.length === 0 ? (
                  <div className="highscore-empty">Sin puntuaciones aún. ¡Juega para registrar la primera!</div>
                ) : (
                  highScores.map((hs, i) => (
                    <div key={i} className="highscore-entry">
                      <span className="highscore-rank">#{i + 1}</span>
                      <span className="highscore-name">Ol. {hs.wave} • {hs.kills} kills</span>
                      <span className="highscore-value">{hs.score.toLocaleString()}</span>
                    </div>
                  ))
                )}
              </div>
              <button className="menu-btn" onClick={() => setSub('main')}>← VOLVER</button>
            </>
          )}

          {sub === 'options' && (
            <OptionsRemapperSub
              volume={volume}
              onVolumeChange={onVolumeChange}
              onBack={() => setSub('main')}
              gameRef={gameRef}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function OptionsRemapperSub({
  volume, onVolumeChange, onBack, gameRef,
}: {
  volume: number;
  onVolumeChange: (v: number) => void;
  onBack: () => void;
  gameRef: React.RefObject<GameHandle | null>;
}) {
  const [remappingAction, setRemappingAction] = useState<keyof KeyBindings | null>(null);
  const [bindings, setBindings] = useState<KeyBindings>(() => {
    return gameRef.current?.getBindings() ?? {
      moveUp: ['KeyW'], moveDown: ['KeyS'], moveLeft: ['KeyA'], moveRight: ['KeyD'],
      attack: ['Space'], dash: ['ShiftLeft'], interact: ['KeyE'], map: ['KeyM'], pause: ['KeyP'],
    };
  });

  // Rebinder keydown listener
  useEffect(() => {
    if (!remappingAction) return;

    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code === 'Escape') {
        setRemappingAction(null);
        return;
      }
      gameRef.current?.setBinding(remappingAction, e.code);
      const updated = gameRef.current?.getBindings();
      if (updated) setBindings({ ...updated });
      setRemappingAction(null);
    };

    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [remappingAction, gameRef]);

  const actionsList: Array<{ action: keyof KeyBindings; label: string }> = [
    { action: 'attack', label: 'Disparo' },
    { action: 'dash', label: 'Dash / Esquiva' },
    { action: 'interact', label: 'Intercambiar Arma' },
    { action: 'map', label: 'Mapa Global' },
    { action: 'moveUp', label: 'Mover Arriba' },
    { action: 'moveDown', label: 'Mover Abajo' },
    { action: 'moveLeft', label: 'Mover Izquierda' },
    { action: 'moveRight', label: 'Mover Derecha' },
  ];

  return (
    <>
      <h2 style={{ color: '#b04dff', letterSpacing: '0.15em', marginBottom: 16 }}>AJUSTES Y CONTROLES</h2>
      <div className="controls-info" style={{ textAlign: 'left', maxHeight: 320, overflowY: 'auto', paddingRight: 8 }}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 8, color: '#00f0ff', fontWeight: 'bold' }}>VOLUMEN DE AUDIO: {Math.round(volume * 100)}%</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: '#00f0ff' }}
          />
        </div>
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(0,240,255,0.2)' }}>
          <h3 style={{ color: '#ffe14a', marginBottom: 12 }}>⌨ CONFIGURACIÓN DE TECLAS Y CONTROLES</h3>
          <p style={{ fontSize: '0.75rem', opacity: 0.8, marginBottom: 12 }}>
            Haz clic en una acción para cambiar su tecla asociada:
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: '0.85rem' }}>
            {actionsList.map(({ action, label }) => {
              const isRemapping = remappingAction === action;
              const currentCodes = bindings[action]?.join(' / ') || 'Ninguna';
              return (
                <button
                  key={action}
                  onClick={() => setRemappingAction(action)}
                  style={{
                    background: isRemapping ? 'rgba(255,204,0,0.25)' : 'rgba(18,21,32,0.8)',
                    border: `1px solid ${isRemapping ? '#ffcc00' : 'rgba(255,204,0,0.3)'}`,
                    padding: 10,
                    borderRadius: 4,
                    textAlign: 'left',
                    cursor: 'pointer',
                    color: '#fff',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{label}</div>
                  <div style={{ fontWeight: 'bold', color: isRemapping ? '#ffcc00' : '#00c8ff', marginTop: 3 }}>
                    {isRemapping ? 'Pulsa un botón para cambiar...' : currentCodes}
                  </div>
                </button>
              );
            })}
          </div>
          <div style={{ marginTop: 16 }}>
            <button
              className="menu-btn"
              style={{ width: '100%', fontSize: '0.8rem', borderColor: '#ff6a00', color: '#ffcc00' }}
              onClick={() => {
                gameRef.current?.resetBindings();
                const updated = gameRef.current?.getBindings();
                if (updated) setBindings({ ...updated });
              }}
            >
              🔄 REESTABLECER TECLAS POR DEFECTO
            </button>
          </div>
        </div>
      </div>
      <button className="menu-btn" onClick={onBack}>← VOLVER</button>
    </>
  );
}

function PauseScreen({ onResume, onRestart, onQuit }: { onResume: () => void; onRestart: () => void; onQuit: () => void }) {
  return (
    <div className="overlay">
      <div className="screen">
        <div className="screen-content">
          <h2 style={{ color: '#00f0ff', letterSpacing: '0.2em', marginBottom: 24, fontSize: '2.5rem' }}>⏸ PAUSA</h2>
          <div className="menu-buttons">
            <button className="menu-btn primary" onClick={onResume}>▶ CONTINUAR</button>
            <button className="menu-btn" onClick={onRestart}>↻ REINICIAR</button>
            <button className="menu-btn" onClick={onQuit}>✕ SALIR AL MENÚ</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function GameOverScreen({ data, onRestart, onMenu }: { data: RunEndData; onRestart: () => void; onMenu: () => void }) {
  const title = data.result === 'victory' ? '¡VICTORIA!' : 'DERROTA';
  const color = data.result === 'victory' ? '#39ff88' : '#ff3b5c';
  return (
    <div className="overlay">
      <div className="screen">
        <div className="screen-content">
          <h2 className="gameover-title" style={{ color }}>{title}</h2>
          <div className="gameover-stats">
            <p><span>Oleada alcanzada</span><span>{data.wave}</span></p>
            <p><span>Enemigos eliminados</span><span>{data.kills}</span></p>
            <p style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,59,92,0.3)' }}>
              <span style={{ fontSize: '1.2rem' }}>PUNTUACIÓN</span>
              <span style={{ fontSize: '1.6rem' }}>{data.score.toLocaleString()}</span>
            </p>
          </div>
          <div className="menu-buttons">
            <button className="menu-btn primary" onClick={onRestart} autoFocus>↻ REINTENTAR</button>
            <button className="menu-btn" onClick={onMenu}>← MENÚ PRINCIPAL</button>
          </div>
        </div>
      </div>
    </div>
  );
}
