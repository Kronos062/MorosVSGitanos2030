# Sprites de Moros VS Gitanos 2030

Sprites de personajes, enemigos, armas, proyectiles y efectos. Cualquier archivo `x.png` queda accesible en `/assets/sprites/x.png`.

El motor lee **`manifest.json`** (esta carpeta). Todo lo que no esté declarado se dibuja con las primitivas vectoriales originales, así que el juego funciona con 0, 1 o 100 sprites integrados. **Estado actual: integrados objetos del mundo (cofres, portal, pickups), las 59 armas base y sus proyectiles. Faltan personajes, enemigos y efectos.**

## Estructura

```
characters/<id>/<id>_<anim>_<dir>.png   una tira horizontal por animación y dirección
enemies/<defId>/<defId>_<anim>_<dir>.png
weapons/<baseId>.png                    arma independiente, mirando a la DERECHA
projectiles/<baseId>.png                (o <enemyDefId>.png)
effects/<nombre>.png                    tira horizontal, una reproducción
portraits/<id>_portrait.png  /  <id>_icon.png
objects/<clave>.png                     objetos del mundo (tira horizontal si tiene animación)
```

Claves: `<id>` = id de `src/content/characters/*.json` (p. ej. `tariq`). `<baseId>` = id base en `weapons.json`: **ojo, el arma de Tariq (`startingWeapon: "pistol"`) resuelve a `iron_python`**, no a `pistol`.

## Reglas de los PNG

- Pixel art sin suavizado, transparencia real, paleta limitada.
- Cada tira: `frames × anchoFrame` de ancho; **el ancho debe ser divisible entre `frames`** (si no, el recurso se descarta y se avisa por consola).
- Todos los frames de una tira con el mismo tamaño. Pies en el **borde inferior, centrados** (anclaje por defecto `{x:0.5, y:1}`); puede dejarse margen transparente arriba y a los lados, no abajo.
- Direcciones dibujadas: `up, up_right, right, down_right, down`. Las otras tres (`down_left, left, up_left`) se obtienen espejando, salvo `"mirror": false` en el manifiesto (personajes con elementos asimétricos; entonces hay que dibujar las 8).
- Animaciones: `idle, walk, roll, hurt, death` (si falta una, se degrada: roll→walk→idle, hurt→idle, death→hurt→idle). `death` no hace bucle.
- `pixelScale` (entero, por defecto 2): píxeles de pantalla por píxel de sprite. Mantener el mismo valor en todo el reparto para densidad homogénea.

## manifest.json

Ver `docs/manifest.tariq.example.json` (plantilla, no activa) y `src/game/sprites/types.ts` (tipos documentados). Resumen:

```jsonc
{
  "version": 1,
  "characters": { "tariq": {
    "clip": "characters/tariq/tariq_{anim}_{dir}.png",
    "pixelScale": 2,
    "animations": { "idle": {"frames": 4, "fps": 6}, "walk": {"frames": 6, "fps": 10}, ... },
    "weaponSocket": { "right": {"x": 6, "y": -18}, "up": {"x": 4, "y": -20, "behind": true} }
  }},
  "weapons":     { "iron_python": { "image": "weapons/iron_python.png", "grip": {"x": 2, "y": 3} } },
  "projectiles": { "iron_python": { "image": "projectiles/iron_python.png" } },
  "effects":     { "explosion":   { "image": "effects/explosion.png", "frames": 5, "fps": 14 } },
  "portraits":   { "tariq": { "portrait": "portraits/tariq_portrait.png", "icon": "portraits/tariq_icon.png" } }
}
```

`weaponSocket` = punto de agarre en píxeles de sprite respecto a los pies (x→derecha, y→abajo). Las direcciones espejadas derivan del socket de su opuesta. El arma gira hacia el apuntado y se voltea verticalmente al apuntar a la izquierda.

## Comportamiento garantizado

- El sprite solo se **dibuja**: no cambia posición, colisión (radio 14), hitboxes ni estadísticas. Los pies se colocan en `y + 14` respecto al centro de colisión.
- Animación deducida del estado del motor: `roll` = dash, `hurt` = bajada de vida/escudo, `death` = hp ≤ 0, `walk` = se movió en los últimos 0,12 s, `idle` en otro caso. Dirección = `facingX/Y`.
- Pruebas: `npm run test:unit` y `npm run test:e2e` (usa tiras sintéticas de `tests/fixtures/`, que **no son arte**).

## Pendiente de decisión (jugabilidad, no tocado)

La derrota es inmediata (`damagePlayer` → `endRun('defeat')` en el mismo instante), así que la animación `death` está soportada pero **no llega a verse** salvo que se retrase el fin de partida unos 0,6–1 s. Es un cambio de flujo de juego; no lo he hecho sin tu confirmación.

## Objetos del mundo (`objects`)

Clave del manifiesto → qué dibuja:

| Clave | Uso | Frames |
|---|---|---|
| `chest_common_closed` / `_open` | cofre común | 1 / 1 |
| `chest_rare_closed` / `_open` | cofre raro (cerrado con destello) | 4 / 1 |
| `chest_legendary_closed` / `_open` | cofre legendario (cerrado con destello) | 4 / 1 |
| `portal_descent` | portal de descenso (cian) | 6, 8 fps, bucle |
| `portal_final` | portal final (dorado) | 6, 8 fps, bucle |
| `pickup_heal` | botiquín (pickup `heal`) | 1 |
| `pickup_shield` | escudo (pickup `shield`) | 1 |
| `pickup_score` | moneda que gira (pickup `score`) | 4, 8 fps |
| `pickup_relic` | reliquia con destello (pickup `relic`) | 4, 4 fps |
| `pickup_weapon` | arma en el suelo (pickup `weapon`; genérico hasta la fase de armas) | 1 |
| `pickup_item_helm` / `_chest` / `_pants` / `_boots` | pieza de equipo según su ranura (pickup `item`) | 1 |

Formato: `{ "image", "frames", "fps", "pixelScale", "anchor": {x,y}, "shadow": {w,h} }`. Cofres: anclaje centro-abajo en `(x, y+12)` (la base del rectángulo original). Portal: anclaje centro. Los sprites actuales están **dibujados por código** (`tools/make_world_sprites.py`, regenerable) con la misma paleta y contorno que los iconos de la interfaz; se pueden sustituir por arte de Pixel Engine con solo reemplazar los PNG (mismo nombre y mismo nº de frames).

Los pickups se anclan en su centro y flotan (efecto solo visual: la posición real no cambia). Bajo cada uno el motor dibuja una **base plana del color de rareza** (`pk.color`), sin desenfoque, para no perder esa información. Las monedas se desfasan para no girar sincronizadas.

## Armas y proyectiles

- **`weapons/<baseId>.png`** (59, uno por entrada de `WEAPON_BASES` en `src/content/weapons.ts`; la clave es el **baseId**, p. ej. `iron_python`): arma mirando a la derecha. El manifiesto guarda `grip` (empuñadura), `muzzle` (distancia empuñadura→boca) y `pixelScale`.
- **`projectiles/<baseId>.png`** (59): tira horizontal. Tipos según el efecto del arma: bala, bala larga, perdigón, bolt de energía, orbe, haz, arco eléctrico, llama, esquirla de hielo, orbe del vacío, onda sónica, glóbulo, cohete, granada, cuchilla giratoria, tajo (cuerpo a cuerpo) y orbe de curación. Su tamaño sigue el `projectileSize` del arma (diámetro ≈ ese nº de píxeles de sprite = el radio de colisión).
- Siluetas base: pistola, revólver, subfusil, fusil, escopeta, francotirador, railgun, ametralladora, minigun, bláster, tesla, lanzallamas, criogénico, lanzadores (mortero, granadas, RPG, misiles, MLR), cañón del vacío, bate/cuchillo/hacha/martillo, lanzacuchillas, escudo antidisturbios, cañón de patatas y balizas de soporte. El acento de color de cada arma es el suyo.
- El arma se dibuja **en mano** también sobre la forma vectorial del jugador (su boca queda ~20 px por delante del centro, cerca del punto donde nacen las balas). Cuando exista el sprite del personaje se colocará en su `weaponSocket`.
- Los pickups de arma muestran el arma concreta sobre la base del color de rareza.
- Regenerar: `python3 tools/make_weapon_sprites.py` (lee `weapons.ts`; si añades un arma hay que asignarle silueta en el diccionario `W` del script).
