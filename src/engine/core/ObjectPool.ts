/**
 * ObjectPool.ts — reutilización de objetos de alta frecuencia (TDD Fase 6).
 *
 * Previene pausas de Garbage Collector en Canvas2D reutilizando instancias
 * de partículas, proyectiles y componentes.
 */

export class ObjectPool<T> {
  private pool: T[] = [];

  constructor(
    private readonly factory: () => T,
    private readonly resetFn: (obj: T) => void,
    initialSize = 32
  ) {
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(this.factory());
    }
  }

  /** Obtiene una instancia reciclada o crea una nueva si la piscina está vacía. */
  acquire(): T {
    const obj = this.pool.length > 0 ? this.pool.pop()! : this.factory();
    this.resetFn(obj);
    return obj;
  }

  /** Devuelve una instancia a la piscina para ser reutilizada. */
  release(obj: T): void {
    this.pool.push(obj);
  }

  /** Tamaño de objetos disponibles en la piscina. */
  get available(): number {
    return this.pool.length;
  }

  /** Limpia la piscina. */
  clear(): void {
    this.pool.length = 0;
  }
}
