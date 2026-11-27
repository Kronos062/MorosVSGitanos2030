import { useEffect, useRef, useState } from 'react';
import type { CharacterDef } from '../content/characters';
import { codeLabel } from '../game/persistence';
import type { KeyBindings } from '../game/types';
import { CharacterPortrait } from './CharacterPortrait';
import { TouchJoystick } from './TouchJoystick';
import { BusActor, BusInterior, busPlacement, busWalkable, type BusPoint } from './BusInterior';
import '../styles/bus.css';

const SERVICES = {
  armory: 'Armería',
  bestiary: 'Bestiario',
  shop: 'Tienda',
  pets: 'Mascotas',
  scores: 'Puntuaciones',
};

export type BusService = keyof typeof SERVICES;

const STATIONS: { point: BusPoint; services: BusService[] }[] = [
  { point: { x: -.55, depth: .42 }, services: ['armory'] },
  { point: { x: .25, depth: .51 }, services: ['bestiary'] },
  { point: { x: -.86, depth: .65 }, services: ['shop', 'pets'] },
  { point: { x: .58, depth: .85 }, services: ['scores'] },
];

const DIRECTIONS = [
  { action: 'moveUp', key: 'ArrowUp', x: 0, depth: -1 },
  { action: 'moveLeft', key: 'ArrowLeft', x: -1, depth: 0 },
  { action: 'moveDown', key: 'ArrowDown', x: 0, depth: 1 },
  { action: 'moveRight', key: 'ArrowRight', x: 1, depth: 0 },
] as const;

function moveOnFloor(point: BusPoint, dx: number, dz: number) {
  const sideways = { ...point, x: point.x + dx };
  const next = busWalkable(sideways) ? sideways : point;
  const forward = { ...next, depth: next.depth + dz };
  return busWalkable(forward) ? forward : next;
}

type Stop = {
  id: string;
  point: BusPoint;
  label: string;
  passenger?: CharacterDef;
  services?: BusService[];
};

type Props = {
  active: boolean;
  character: CharacterDef;
  roster: CharacterDef[];
  bindings: KeyBindings;
  onService: (service: BusService) => void;
  onDepart: () => void;
  onDifficulty: () => void;
  onMenu: () => void;
};

export function BusLobby({ active, character, roster, bindings, onService, onDepart, onDifficulty, onMenu }: Props) {
  const positionRef = useRef<BusPoint>({ x: 0, depth: .90 });
  const [position, setPosition] = useState(positionRef.current);
  const [facing, setFacing] = useState<BusPoint>({ x: 0, depth: -1 });
  const [talking, setTalking] = useState<Stop | null>(null);
  const [approaching, setApproaching] = useState<string | null>(null);
  const pressed = useRef(new Set<string>());
  const touch = useRef<BusPoint>({ x: 0, depth: 0 });
  const route = useRef<BusPoint[]>([]);
  const stops: Stop[] = roster.filter(member => member.id !== character.id).slice(0, STATIONS.length).map((passenger, index) => {
    const { point, services } = STATIONS[index];
    return { id: passenger.id, point, passenger, services, label: services.map(service => SERVICES[service]).join(' y ') };
  });
  stops.push(
    { id: 'door', point: { x: .78, depth: .16 }, label: 'Puerta' },
    { id: 'driver', point: { x: -.52, depth: .16 }, label: 'Conductor' },
  );
  const nearest = stops.filter(({ id }) => !approaching || id === approaching)
    .map(stop => ({ stop, distance: Math.hypot((stop.point.x - position.x) * .58, stop.point.depth - position.depth) }))
    .filter(({ distance }) => distance <= .082).sort((a, b) => a.distance - b.distance)[0]?.stop;

  const place = (next: BusPoint) => {
    if (next.x === positionRef.current.x && next.depth === positionRef.current.depth) return;
    setFacing({ x: (next.x - positionRef.current.x) * 108, depth: (next.depth - positionRef.current.depth) * 145 });
    positionRef.current = next;
    setPosition(next);
  };

  useEffect(() => {
    if (!active || talking) return;
    const down = (event: KeyboardEvent) => {
      if (!DIRECTIONS.some(({ key, action }) => event.code === key || event.code === bindings[action])) return;
      event.preventDefault();
      route.current = [];
      setApproaching(null);
      pressed.current.add(event.code);
    };
    const up = (event: KeyboardEvent) => pressed.current.delete(event.code);
    const clear = () => {
      pressed.current.clear();
      touch.current = { x: 0, depth: 0 };
      route.current = [];
    };
    const onBlur = () => { clear(); setApproaching(null); };
    let frame = 0;
    let previous = performance.now();
    const walk = (now: number) => {
      const directions = DIRECTIONS.filter(({ key, action }) => pressed.current.has(key) || pressed.current.has(bindings[action]));
      const touchMoving = touch.current.x !== 0 || touch.current.depth !== 0;
      const dx = touchMoving ? touch.current.x : directions.reduce((sum, input) => sum + input.x, 0);
      const dz = touchMoving ? touch.current.depth : directions.reduce((sum, input) => sum + input.depth, 0);
      const distance = .57 * Math.min((now - previous) / 1000, .05);
      previous = now;
      const current = positionRef.current;
      if (dx || dz) {
        const step = distance / Math.max(1, Math.hypot(dx, dz));
        place(moveOnFloor(current, dx * step * 1.7, dz * step));
      } else if (route.current.length) {
        const [target] = route.current;
        const x = target.x - current.x;
        const depth = target.depth - current.depth;
        const length = Math.hypot(x / 1.7, depth);
        if (length <= distance) {
          place(target);
          route.current.shift();
          if (!route.current.length) setApproaching(null);
        } else {
          place(moveOnFloor(current, x * distance / length, depth * distance / length));
        }
      }
      frame = requestAnimationFrame(walk);
    };
    frame = requestAnimationFrame(walk);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', onBlur);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', onBlur);
      clear();
    };
  }, [active, talking, bindings]);

  const interact = () => {
    if (!nearest) return;
    route.current = [];
    setApproaching(null);
    if (nearest.id === 'door') onDepart();
    else setTalking(nearest);
  };

  useEffect(() => {
    if (!active || talking) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || event.code !== bindings.interact) return;
      if ((event.code === 'Enter' || event.code === 'Space') && event.target instanceof HTMLButtonElement) return;
      event.preventDefault();
      interact();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const chooseStop = (stop: Stop) => {
    if (stop === nearest) {
      interact();
      return;
    }
    const current = positionRef.current;
    route.current = [{ x: 0, depth: current.depth }, { x: 0, depth: stop.point.depth }, stop.point];
    setApproaching(stop.id);
  };

  return (
    <section className="bus-lobby" aria-label="Autobús" hidden={!active}>
      <header className="bus-header">
        <h1>Última parada</h1>
        <div className="bus-header-actions">
          <button type="button" onClick={onDifficulty}>Dificultad</button>
          <button type="button" onClick={onMenu}>Menú</button>
        </div>
      </header>
      <div className="bus-interior">
        <div className="bus-stage">
        {active && <BusInterior />}
        {stops.map(stop => (
          <button type="button" key={stop.id} className={`bus-stop bus-stop-${stop.id === 'door' || stop.id === 'driver' ? stop.id : 'passenger'}`}
            data-nearby={nearest === stop} style={{ ...busPlacement(stop.point), zIndex: 105 }}
            aria-label={stop.passenger ? `${stop.passenger.name}, ${stop.label}` : stop.label}
            onClick={() => chooseStop(stop)}>
            {active && stop.passenger && <BusActor id={stop.passenger.id} point={stop.point} face={{ x: 0, depth: 1 }} />}
          </button>
        ))}
        <div className="bus-player" aria-hidden="true" style={busPlacement(position)}>
          {active && <BusActor id={character.id} point={position} face={facing} />}
        </div>
        </div>
      </div>
      <footer className="bus-controls">
        <p>Flechas o teclas configuradas para moverte.</p>
        <button type="button" className="bus-interact" disabled={!nearest} onClick={interact}>
          {nearest?.id === 'door' ? 'Bajar y jugar' : nearest ? 'Hablar' : 'Interactuar'}
          <kbd>{codeLabel(bindings.interact)}</kbd>
        </button>
      </footer>
      {active && !talking && (
        <div className="touch-controls bus-touch">
          <TouchJoystick onMove={(x, depth) => {
            touch.current = { x, depth };
            if (x || depth) {
              route.current = [];
              setApproaching(null);
            }
          }} />
        </div>
      )}
      {talking && (
        <dialog className="bus-dialog" aria-labelledby="bus-speaker" onCancel={() => setTalking(null)}
          ref={dialog => { if (dialog && !dialog.open) dialog.showModal(); }}>
          {talking.passenger ? <CharacterPortrait id={talking.passenger.id} variant="idle" />
            : <span className="bus-silhouette" aria-hidden="true" />}
          <div>
            <h2 id="bus-speaker">{talking.passenger?.name ?? 'Kronos · Conductor'}</h2>
            {!talking.passenger && <p>Soy Kronos, el conductor. Bienvenido a tu última parada.</p>}
            <div className="bus-dialog-actions">
              {talking.services?.map(service => (
                <button type="button" key={service} onClick={() => { setTalking(null); onService(service); }}>{SERVICES[service]}</button>
              ))}
              <button type="button" onClick={() => setTalking(null)}>{talking.passenger ? 'Volver' : 'Continuar'}</button>
            </div>
          </div>
        </dialog>
      )}
    </section>
  );
}
