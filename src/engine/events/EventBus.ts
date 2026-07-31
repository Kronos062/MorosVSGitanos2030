/**
 * EventBus.ts — bus de eventos desacoplado (TDD §3.6 engine/events).
 *
 * El motor y el gameplay se comunican exclusivamente a través de eventos.
 * Ningún sistema llama directamente a otro: publica un evento y quien
 * esté suscrito reacciona.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Handler<T = any> = (payload: T) => void;
export type Unsubscribe = () => void;

export class EventBus {
  private listeners = new Map<string, Set<Handler>>();
  private queue: Array<{ event: string; payload: unknown }> = [];
  private flushing = false;

  on<T = unknown>(event: string, handler: Handler<T>): Unsubscribe {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(handler as Handler);
    return () => this.off(event, handler as Handler);
  }

  off(event: string, handler: Handler): void {
    this.listeners.get(event)?.delete(handler);
  }

  /** Emite inmediatamente (síncrono). */
  emit<T = unknown>(event: string, payload?: T): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const h of set) {
      try {
        h(payload);
      } catch (e) {
        console.error(`EventBus handler error for ${event}:`, e);
      }
    }
  }

  /** Encola eventos para ser procesados al final del frame. */
  enqueue<T = unknown>(event: string, payload?: T): void {
    this.queue.push({ event, payload });
  }

  flush(): void {
    if (this.flushing) return;
    this.flushing = true;
    try {
      while (this.queue.length > 0) {
        const { event, payload } = this.queue.shift()!;
        this.emit(event, payload);
      }
    } finally {
      this.flushing = false;
    }
  }

  clear(): void {
    this.listeners.clear();
    this.queue.length = 0;
  }
}

// Re-exportar EventTypes para mantener compatibilidad sin duplicar tipos
export { EventTypes } from '@/gameplay/events/GameEventTypes';
