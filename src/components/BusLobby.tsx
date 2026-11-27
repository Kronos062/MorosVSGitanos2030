import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent } from 'react';
import type { CharacterDef } from '../content/characters';
import { codeLabel } from '../game/persistence';
import type { KeyBindings } from '../game/types';
import { CharacterPortrait } from './CharacterPortrait';
import '../styles/bus.css';

const SERVICES = {
  armory: 'Armería',
  bestiary: 'Bestiario',
  shop: 'Tienda',
  pets: 'Mascotas',
  scores: 'Puntuaciones',
};

export type BusService = keyof typeof SERVICES;

const SEATS: { x: number; services: BusService[] }[] = [
  { x: 25, services: ['armory'] },
  { x: 41, services: ['bestiary'] },
  { x: 57, services: ['shop', 'pets'] },
  { x: 73, services: ['scores'] },
];

type Stop = {
  id: string;
  x: number;
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
  const [position, setPosition] = useState(49);
  const [facing, setFacing] = useState(1);
  const [talking, setTalking] = useState<Stop | null>(null);
  const pressed = useRef(new Set<string>());
  const touch = useRef(0);
  const destination = useRef<number | null>(null);
  const stops: Stop[] = roster.filter(member => member.id !== character.id).slice(0, SEATS.length).map((passenger, index) => {
    const { x, services } = SEATS[index];
    return { id: passenger.id, x, passenger, services, label: services.map(service => SERVICES[service]).join(' y ') };
  });
  stops.push({ id: 'door', x: 10, label: 'Puerta' }, { id: 'driver', x: 90, label: 'Conductor' });
  const nearest = stops.find(stop => Math.abs(stop.x - position) <= 5);

  useEffect(() => {
    if (!active || talking) return;
    const left = (code: string) => code === bindings.moveLeft || code === 'ArrowLeft';
    const right = (code: string) => code === bindings.moveRight || code === 'ArrowRight';
    const down = (event: KeyboardEvent) => {
      if (!left(event.code) && !right(event.code)) return;
      event.preventDefault();
      destination.current = null;
      pressed.current.add(event.code);
    };
    const up = (event: KeyboardEvent) => pressed.current.delete(event.code);
    const clear = () => {
      pressed.current.clear();
      touch.current = 0;
      destination.current = null;
    };
    let frame = 0;
    let previous = performance.now();
    const walk = (now: number) => {
      const keys = [...pressed.current];
      const direction = Number(keys.some(right)) - Number(keys.some(left)) || touch.current;
      const distance = 39 * Math.min((now - previous) / 1000, 0.05);
      previous = now;
      if (direction) {
        setFacing(direction);
        setPosition(x => Math.max(7, Math.min(93, x + direction * distance)));
      } else if (destination.current !== null) {
        const target = destination.current;
        setPosition(x => x + Math.sign(target - x) * Math.min(Math.abs(target - x), distance));
      }
      frame = requestAnimationFrame(walk);
    };
    frame = requestAnimationFrame(walk);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clear);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear);
      clear();
    };
  }, [active, talking, bindings]);

  useEffect(() => {
    if (position === destination.current) destination.current = null;
  }, [position]);

  const interact = () => {
    if (!nearest) return;
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

  const holdDirection = (direction: number) => (event: PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    destination.current = null;
    touch.current = direction;
  };
  const releaseDirection = () => { touch.current = 0; };
  const chooseStop = (stop: Stop) => {
    if (stop === nearest) {
      interact();
      return;
    }
    setFacing(Math.sign(stop.x - position));
    destination.current = stop.x;
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
        <div className="bus-windows" aria-hidden="true">
          {Array.from({ length: 5 }, (_, index) => <div className="bus-window" key={index} />)}
        </div>
        <div className="bus-floor" aria-hidden="true" />
        {stops.map(stop => (
          <button type="button" key={stop.id} className={`bus-stop bus-stop-${stop.id === 'door' || stop.id === 'driver' ? stop.id : 'passenger'}`}
            data-nearby={nearest === stop} style={{ '--stop-x': `${stop.x}%` } as CSSProperties}
            aria-label={stop.passenger ? `${stop.passenger.name}, ${stop.label}` : stop.label}
            onClick={() => chooseStop(stop)}>
            {stop.passenger ? <CharacterPortrait id={stop.passenger.id} variant="idle" />
              : <span className={stop.id === 'driver' ? 'bus-silhouette' : 'bus-door-art'} aria-hidden="true" />}
            <span className="bus-stop-label">{stop.label}</span>
          </button>
        ))}
        <div className="bus-player" aria-hidden="true" style={{ left: `${position}%` }}>
          <span className="bus-player-sprite" style={{ transform: `scaleX(${facing})` }}>
            <CharacterPortrait id={character.id} variant="idle" />
          </span>
        </div>
      </div>
      <footer className="bus-controls">
        <div className="bus-movement">
          {[-1, 1].map(direction => (
            <button type="button" key={direction} aria-label={direction < 0 ? 'Mover a la izquierda' : 'Mover a la derecha'}
              onPointerDown={holdDirection(direction)} onPointerUp={releaseDirection} onPointerCancel={releaseDirection}
              onLostPointerCapture={releaseDirection}
              onClick={event => { if (event.detail === 0) setPosition(x => Math.max(7, Math.min(93, x + direction * 4))); }}>
              {direction < 0 ? 'Izquierda' : 'Derecha'}
            </button>
          ))}
        </div>
        <p>Acércate a un pasajero o a la puerta.</p>
        <button type="button" className="bus-interact" disabled={!nearest} onClick={interact}>
          {nearest?.id === 'door' ? 'Bajar y jugar' : nearest ? 'Hablar' : 'Interactuar'}
          <kbd>{codeLabel(bindings.interact)}</kbd>
        </button>
      </footer>
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
