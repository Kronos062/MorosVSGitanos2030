import { describe, it, expect } from 'vitest';
import { WorldEventSystem } from './WorldEventSystem';
import { EventBus, EventTypes } from '@/engine/events/EventBus';
import { ContentRepository, SchemaValidator } from '@/engine/content/ContentRepository';
import eventsData from '@/content/events.json';

describe('WorldEventSystem', () => {
  it('triggers world events and updates duration', () => {
    const events = new EventBus();
    const repo = new ContentRepository(new SchemaValidator());
    repo.load(eventsData.map((e) => ({ ...e, type: 'events' as const })) as never[]);

    const system = new WorldEventSystem(events, repo);

    let activeEventName = '';
    events.on<{ event: { name: string } }>(EventTypes.WORLD_EVENT_ACTIVATED, (e) => {
      activeEventName = e.event.name;
    });

    system.triggerEvent('event_blood_moon');

    expect(activeEventName).toBe('Luna Neón Sangrienta');
    expect(system.activeEvent?.id).toBe('event_blood_moon');
    expect(system.eventTimer).toBe(30);

    // Simulate update tick
    system.update({
      world: null as never,
      events,
      time: { elapsed: 0, fixedDt: 10, alpha: 0, frameDt: 10, timeScale: 1 },
    });

    expect(system.eventTimer).toBe(20);
  });
});
