import { describe, it, expect } from 'vitest';
import { EventBus, EventTypes } from '@/engine/events/EventBus';

describe('EventBus', () => {
  it('entrega eventos a subscribers', () => {
    const bus = new EventBus();
    const received: number[] = [];
    bus.on<{ amount: number }>(EventTypes.SCORE_CHANGED, (e) => received.push(e.amount));
    bus.emit(EventTypes.SCORE_CHANGED, { amount: 10 });
    bus.emit(EventTypes.SCORE_CHANGED, { amount: 20 });
    expect(received).toEqual([10, 20]);
  });

  it('unsub deja de recibir', () => {
    const bus = new EventBus();
    const received: number[] = [];
    const off = bus.on<{ amount: number }>(EventTypes.SCORE_CHANGED, (e) => received.push(e.amount));
    bus.emit(EventTypes.SCORE_CHANGED, { amount: 1 });
    off();
    bus.emit(EventTypes.SCORE_CHANGED, { amount: 2 });
    expect(received).toEqual([1]);
  });

  it('enqueue + flush procesa al final', () => {
    const bus = new EventBus();
    const order: string[] = [];
    bus.on<{ id: string }>('a', (e) => {
      order.push('a:' + e.id);
      if (e.id === '1') bus.enqueue('b', { id: '2' });
    });
    bus.on<{ id: string }>('b', (e) => order.push('b:' + e.id));
    bus.emit('a', { id: '1' });
    expect(order).toEqual(['a:1']); // b no se ha procesado aún
    bus.flush();
    expect(order).toEqual(['a:1', 'b:2']);
  });

  it('clear elimina todos los subscribers', () => {
    const bus = new EventBus();
    const received: number[] = [];
    bus.on<number>('x', (n) => received.push(n));
    bus.emit('x', 1);
    bus.clear();
    bus.emit('x', 2);
    expect(received).toEqual([1]);
  });
});
