/**
 * Content Pipeline (TDD §6).
 *
 * - ContentRepository: caché en memoria indexada por id, O(1) lookup.
 * - ContentLoader: carga JSON (por fetch o import estático).
 * - SchemaValidator: validación ligera de estructura por tipo.
 * - AssetManager: placeholder para texturas/audio (Fase 4).
 * - Manifest: índice generado (ver manifest.json).
 *
 * El motor expone getContent<T>(type, id) al gameplay; el gameplay nunca
 * sabe de dónde viene el contenido.
 */

export type ContentType = string;

export interface ContentItem {
  id: string;
  type?: ContentType;
  contentVersion?: string;
  [key: string]: unknown;
}

export interface ManifestEntry {
  id: string;
  type: ContentType;
  version: string;
}

export interface Manifest {
  version: string;
  entries: ManifestEntry[];
}

/** Validador estructural ligero. */
export type SchemaRule =
  | { kind: 'required'; fields: string[] }
  | { kind: 'type'; field: string; type: 'string' | 'number' | 'boolean' | 'object' | 'array' }
  | { kind: 'enum'; field: string; values: readonly string[] };

export class SchemaValidator {
  private schemas = new Map<ContentType, SchemaRule[]>();

  register(type: ContentType, rules: SchemaRule[]): void {
    this.schemas.set(type, rules);
  }

  validate(type: ContentType, item: ContentItem): string[] {
    const rules = this.schemas.get(type);
    if (!rules) return [];
    const errors: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const obj = item as any;
    for (const rule of rules) {
      if (rule.kind === 'required') {
        for (const f of rule.fields) {
          if (obj[f] === undefined || obj[f] === null) errors.push(`Falta campo requerido: ${f}`);
        }
      } else if (rule.kind === 'type') {
        const v = obj[rule.field];
        if (v === undefined) continue;
        const t = Array.isArray(v) ? 'array' : typeof v;
        if (t !== rule.type) errors.push(`Campo ${rule.field}: esperado ${rule.type}, recibido ${t}`);
      } else if (rule.kind === 'enum') {
        const v = obj[rule.field];
        if (v !== undefined && !rule.values.includes(v)) {
          errors.push(`Campo ${rule.field}: valor "${v}" fuera de ${rule.values.join(',')}`);
        }
      }
    }
    return errors;
  }
}

export class ContentRepository {
  private stores = new Map<ContentType, Map<string, ContentItem>>();
  private validator: SchemaValidator;

  constructor(validator: SchemaValidator) {
    this.validator = validator;
  }

  load(items: ContentItem[]): { loaded: number; errors: string[] } {
    const errors: string[] = [];
    let loaded = 0;
    for (const item of items) {
      const type = item.type!;
      const errs = this.validator.validate(type, item);
      if (errs.length > 0) {
        errors.push(`${type}/${item.id}: ${errs.join('; ')}`);
        continue;
      }
      let store = this.stores.get(type);
      if (!store) {
        store = new Map();
        this.stores.set(type, store);
      }
      store.set(item.id, item);
      loaded++;
    }
    return { loaded, errors };
  }

  get<T = ContentItem>(type: ContentType, id: string): T | undefined {
    return this.stores.get(type)?.get(id) as T | undefined;
  }

  all<T = ContentItem>(type: ContentType): T[] {
    const store = this.stores.get(type);
    if (!store) return [];
    return Array.from(store.values()) as T[];
  }

  has(type: ContentType, id: string): boolean {
    return this.stores.get(type)?.has(id) ?? false;
  }

  clear(): void {
    this.stores.clear();
  }

  stats(): Record<ContentType, number> {
    const out: Record<ContentType, number> = {};
    for (const [type, store] of this.stores) {
      out[type] = store.size;
    }
    return out;
  }
}

export interface ContentBundle {
  type: ContentType;
  items: ContentItem[];
}

export class ContentLoader {
  constructor(private readonly repo: ContentRepository) {}

  async loadBundles(bundles: ContentBundle[]): Promise<{ loaded: number; errors: string[] }> {
    let totalLoaded = 0;
    const allErrors: string[] = [];
    for (const b of bundles) {
      const { loaded, errors } = this.repo.load(
        b.items.map((it) => ({ ...it, type: b.type }))
      );
      totalLoaded += loaded;
      allErrors.push(...errors);
    }
    return { loaded: totalLoaded, errors: allErrors };
  }
}

export class AssetManager {
  private images = new Map<string, HTMLImageElement>();

  async loadImage(key: string, url: string): Promise<HTMLImageElement> {
    if (this.images.has(key)) return this.images.get(key)!;
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.images.set(key, img);
        resolve(img);
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  getImage(key: string): HTMLImageElement | undefined {
    return this.images.get(key);
  }
}
