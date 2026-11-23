/**
 * Tipos del sistema de sprites.
 *
 * El manifiesto vive en `public/assets/sprites/manifest.json` y describe qué
 * recursos pixel art existen. Todo lo que NO esté declarado allí se dibuja con
 * las primitivas vectoriales originales del motor (fallback), de modo que el
 * juego funciona igual con 0, 1 o 100 sprites integrados.
 *
 * Documentación completa del formato: `public/assets/sprites/README.md`.
 */

export type Dir8 =
  | 'up'
  | 'up_right'
  | 'right'
  | 'down_right'
  | 'down'
  | 'down_left'
  | 'left'
  | 'up_left';

export type AnimName = 'idle' | 'walk' | 'roll' | 'hurt' | 'death';

export interface AnimMeta {
  /** Nº de frames de la tira (la imagen mide `frames × anchoFrame` px). */
  frames: number;
  fps: number;
  /** Por defecto true, salvo `death` (false). */
  loop?: boolean;
}

export interface WeaponSocket {
  /** Offset en píxeles de sprite respecto al punto de anclaje (pies). x→derecha, y→abajo. */
  x: number;
  y: number;
  /** Dibujar el arma detrás del cuerpo (típico al mirar hacia arriba). */
  behind?: boolean;
}

/** Personaje o enemigo animado por tiras (una imagen por animación y dirección). */
export interface SpriteSetMeta {
  /**
   * Plantilla de ruta relativa a `assets/sprites/`. Tokens: `{anim}` y `{dir}`.
   * Ej.: "characters/tariq/tariq_{anim}_{dir}.png".
   */
  clip: string;
  /** Direcciones almacenadas en disco. Por defecto las 5 base. */
  directions?: Dir8[];
  /** Espejar horizontalmente las direcciones que falten. Por defecto true.
   *  Poner false en personajes con elementos asimétricos que no deban invertirse. */
  mirror?: boolean;
  /** Píxeles de pantalla por píxel de sprite (entero). Por defecto 2. */
  pixelScale?: number;
  /** Anclaje de los pies como fracción del frame. Por defecto {x:0.5, y:1} (centro-abajo). */
  anchor?: { x: number; y: number };
  /** Distancia en px de mundo entre el centro de colisión y los pies. Por defecto: la que pasa el motor. */
  footOffset?: number;
  /** Sombra plana bajo los pies, en píxeles de sprite. false para desactivarla. */
  shadow?: { w: number; h: number } | false;
  animations: Partial<Record<AnimName, AnimMeta>>;
  /** Punto de agarre del arma por dirección. Las direcciones espejadas se derivan solas. */
  weaponSocket?: Partial<Record<Dir8, WeaponSocket>>;
}

/** Arma independiente del cuerpo. Imagen mirando hacia la DERECHA. */
export interface WeaponSpriteMeta {
  image: string;
  frames?: number;
  fps?: number;
  /** Punto de la imagen (px de sprite) que se coloca en el socket de la mano. */
  grip: { x: number; y: number };
  /** Distancia en px de sprite desde la empuñadura hasta la boca del arma (para colocarla en mano cuando no hay sprite de personaje). */
  muzzle?: number;
  pixelScale?: number;
}

export interface ProjectileSpriteMeta {
  image: string;
  frames?: number;
  fps?: number;
  pixelScale?: number;
  /** Girar según la velocidad. Por defecto true. */
  rotate?: boolean;
}

export interface EffectSpriteMeta {
  image: string;
  frames: number;
  fps: number;
  pixelScale?: number;
  anchor?: { x: number; y: number };
  /** Los efectos en bucle (status_*) se dibujan con drawStatus, no con spawnEffect. */
  loop?: boolean;
}

/** Objeto del mundo (cofre, portal, pickup…): imagen estática o tira animada en bucle. */
export interface ObjectSpriteMeta {
  image: string;
  frames?: number;
  fps?: number;
  pixelScale?: number;
  /** Punto del frame que se coloca en la posición del objeto, como fracción. Por defecto {x:0.5, y:1} (centro-abajo). */
  anchor?: { x: number; y: number };
  /** Sombra plana bajo el objeto (px de sprite). Por defecto sin sombra. */
  shadow?: { w: number; h: number } | false;
}

export interface PortraitMeta {
  portrait?: string;
  icon?: string;
}

export interface WorldPropMeta {
  image: string;
  foot: [number, number];
}

export type ShoreDir = 'n' | 'e' | 's' | 'w' | 'nw' | 'ne' | 'sw' | 'se';

export interface WorldSpriteMeta {
  pixelScale?: number;
  tile?: number;
  islandMargin: { x: number; y: number };
  floor?: {
    main?: string[];
    worn?: string[];
    detail?: string[];
  };
  sea?: string[];
  shore: Record<ShoreDir, string>;
  bridge?: {
    ew?: string[];
    ns?: string[];
    railN: string;
    railW: string;
    railE: string;
    fascia: string;
    pile: string;
    gateH: string;
    gateV: string;
  };
  props?: {
    cornerTop?: WorldPropMeta[];
    cornerBottom?: WorldPropMeta[];
    edge?: WorldPropMeta[];
  };
}

export interface SpriteManifest {
  version: 1;
  characters?: Record<string, SpriteSetMeta>;
  /** Clave = id de definición de enemigo (enemies.json / bosses.json). */
  enemies?: Record<string, SpriteSetMeta>;
  /** Clave = baseId del arma (weapons.json). */
  weapons?: Record<string, WeaponSpriteMeta>;
  /** Clave = baseId del arma (proyectiles del jugador) o id de enemigo. */
  projectiles?: Record<string, ProjectileSpriteMeta>;
  effects?: Record<string, EffectSpriteMeta>;
  /** Clave = `<defId>_<estado>` para cofres (chest_rare_closed…) o `portal_<kind>`. */
  objects?: Record<string, ObjectSpriteMeta>;
  portraits?: Record<string, PortraitMeta>;
  worlds?: Record<string, WorldSpriteMeta>;
}

/** Datos que el motor pasa para dibujar un actor animado. */
export interface ActorDrawOptions {
  /** Tiempo de mundo en segundos (se congela en pausa, congelando también la animación). */
  now: number;
  /** Vector hacia donde mira. */
  faceX: number;
  faceY: number;
  /** Vida (+escudo) actual; una bajada activa la animación `hurt`. */
  hp: number;
  rolling?: boolean;
  dead?: boolean;
  /** Destello blanco al recibir daño. */
  flash?: boolean;
  alpha?: number;
  /** Distancia centro de colisión → pies si el manifiesto no la define. */
  footOffset?: number;
  /** Coordenadas de mundo para detectar movimiento cuando el motor dibuja en coordenadas locales. */
  trackX?: number;
  trackY?: number;
  /** baseId del arma equipada (solo personajes). */
  weaponId?: string;
  /** Ángulo de apuntado en radianes (solo personajes). */
  aimAngle?: number;
}