# Moros VS Gitanos 2030 · Contexto para continuar en otro chat

> Pega este documento (o súbelo con el ZIP) al inicio de la nueva conversación. Idioma de trabajo: **español**.

## 0. Protocolo acordado con el usuario
- Cuando el usuario diga **«continúa»**: si la fase en curso está terminada → pasar a la siguiente; si no → seguir con lo pendiente de esa fase.
- Al cerrar cada fase se entrega: ZIP de producción (`dist`) + ZIP del proyecto, capturas dentro del juego, resultado de pruebas, y un resumen honesto con las limitaciones.
- **No tocar gameplay** (mecánicas, estadísticas, hitboxes, colisiones, generación de salas, IA, economía). Todo lo hecho es solo presentación visual.
- No declarar nada terminado sin verificarlo (build + pruebas + captura real). Ser honesto con lo que no se ha podido ver.
- El usuario valora: pixel art auténtico (sin suavizado), paleta coherente, interfaz **menos oscura**, y poder subir el ZIP directamente a producción.

## 1. El proyecto
- Vite 7 + React 19 + TypeScript + Tailwind 4 + `vite-plugin-singlefile`. Sin backend, sin ECS. `README.txt` original está desfasado (menciona PostgreSQL/Drizzle): ignorarlo.
- Motor propio: `src/game/engine.ts` (`GameEngine`, ~4000 líneas, canvas 2D a tamaño de ventana). Contenido en `src/content/` (JSON y TS). UI en `src/App.tsx` + `src/index.css` + `src/styles/pixel-ui.css`.
- Error de tipos **preexistente y ajeno** al trabajo: `src/content/index.ts` importa `@/engine/content/ContentRepository` (no existe, nadie lo usa; `vite build` funciona). Se filtra con `grep -v ContentRepository`.
- Datos clave: **59 armas base** (`WEAPON_BASES` en `src/content/weapons.ts`; `weapons.json` es el catálogo antiguo de 20), **20 sets de equipo × 4 ranuras** (`helm`, `chest`, `pants`, `boots`; ids `set_<nombre>_<slot>`), 20 enemigos, 3 jefes, 10 personajes (5 Moros, 5 Gitanos). Tariq: `startingWeapon: pistol` → resuelve a baseId **`iron_python`**. Radio de colisión del jugador: 14 px.
- Despliegue: sitio estático, rutas **relativas** (`base: "./"`; audio usa `import.meta.env.BASE_URL`). Funciona en raíz y en subcarpeta. Ver `docs/DEPLOY.md`.

## 2. Qué se ha hecho (todo verificado)
**Sistema de sprites** (`src/game/sprites/`: `types.ts`, `direction.ts`, `spriteAtlas.ts`) + manifiesto `public/assets/sprites/manifest.json`. Categorías: `characters`, `enemies`, `weapons`, `projectiles`, `effects`, `objects`, `portraits`.
- Todo opcional con **fallback** a las primitivas vectoriales originales (nada se rompe si falta un sprite).
- Animaciones `idle/walk/roll/hurt/death` deducidas del estado del motor; 5 direcciones + espejado (`mirror:false` para asimétricos); pies anclados a `y+14`; `pixelScale` 2; nearest-neighbor; encaje a la rejilla de píxeles.
- Carga: `main.tsx` espera como máximo 1,5 s y arranca igualmente (los sprites aparecen al terminar).
- Hooks en el motor (solo dibujado): jugador/enemigos (`drawCharacter/drawEnemy`), `drawChest`, portal, bucle de pickups (`pickupSpriteKey`, `pickupWeaponBase`, base plana de rareza `drawGroundPad`), proyectiles (`pr.sprite = baseId`), arma en mano sobre la forma original (`drawHeldWeapon`), `spawnEffect('explosion')` (sin sprite aún).
- Depuración: con `?spritedebug` se exponen `window.__engine` y `window.__sprites` (las pruebas los usan).

**Interfaz**: capa `src/styles/pixel-ui.css` (marcos de borde duro, tablero zellige, barras segmentadas, estados de botón, fuente **Pixelify Sans** solo en peso 400 —el 700 cierra la «C»— y 700 solo en el título), paleta azul azulejo clara. Iconos pixel art (44, 16×16) sustituyen a los emojis mediante un envoltorio de JSX (`jsxImportSource: "mvg-jsx"`, `src/ui/jsx`, `iconMap.ts`, `iconize.ts`, `iconData.ts` generado). Componentes: `CharacterPortrait.tsx`, `EquipIcon.tsx`. Pantalla de bando con título del juego.

**Fase 1 – cofres y portal**: 3 cofres (común/raro/legendario, cerrado con destello y abierto) + 2 portales animados (6 frames, `descent`/`final`).
**Fase 2 – pickups**: heal, shield, score (moneda que gira), relic, weapon, item por ranura; base plana del color de rareza.
**Fase 3 – armas y proyectiles**: 59 armas (≈20 siluetas + acento del color del arma) y 59 proyectiles (17 tipos, tamaño ≈ `projectileSize`); arma en mano sobre el triángulo; pickups de arma concretos.
**Fase 4 – equipo**: 84 sprites (20 sets × 4 + 4 genéricos), color exacto del set + emblema; UI de objeto encontrado y build con marco de rareza.
Manifiesto actual: **101 objetos, 59 armas, 59 proyectiles**. Vacíos: `characters`, `enemies`, `effects`, `portraits`.

## 3. Importante: de dónde sale el arte
**Todo el arte está dibujado por código** (scripts en `tools/`, regenerables), **no con Pixel Engine**. Se puede sustituir por arte generado reemplazando los PNG con el mismo nombre y número de frames.
- `tools/make_ui_icons.py` → `src/ui/iconData.ts`
- `tools/make_world_sprites.py` → cofres, portal, pickups
- `tools/make_weapon_sprites.py` → armas y proyectiles (parsea `weapons.ts`; si se añade un arma hay que asignarle silueta en el dict `W`)
- `tools/make_equipment_sprites.py` → equipo (parsea `equipment.ts`; un set nuevo necesita emblema en `EMBLEMS`)
Los scripts se encadenan: `make_world_sprites` importa `make_ui_icons`; armas y equipo importan de `make_world_sprites`. Los tres que escriben manifiesto **fusionan** su sección sin borrar las demás.

## 4. Pixel Engine (estado)
- Herramientas operativas (generate_sprite, animate_sprite, remove_background, pixelate_image, get_job…). Créditos restantes: **52** de 100. Tarifas: sprite `pe_image_v1` 6, `nb_flash_2_1` 12 (admite referencia), animación 20–26, quitar fondo 2.
- **Bloqueo**: el contenedor no resuelve `pbyjudvocajebcijrloe.supabase.co`, así que **no se pueden descargar los PNG** generados. El usuario no encontró el ajuste de dominios permitidos. Vías: que suba los PNG como adjuntos, o abrir una sesión con ese dominio permitido. (Se probó un puente vía widget + `sendPrompt` para que el navegador del usuario enviara los PNG en base64; el usuario aún no lo usó.)
- **Tariq aprobado** (8 orientaciones, `pe_image_v1` 24×32, semilla `1533984`, mismo prompt cambiando solo la orientación). Jobs: DOWN `6c343a4d-1a83-4e97-9b36-0ff29a4c9f6e`, RIGHT `7585d0ad-282b-4d22-96a1-9f0854be95b3`, UP `a71bd188-6ad0-4345-b986-2f1396c1438d`, UP_RIGHT `ca3afea5-b21e-4444-91c1-f70ef5179170`, DOWN_RIGHT `ee301d11-9469-44ac-8e7d-b51dcd281061`, DOWN_LEFT `36ce921d-b661-4a75-8dd8-4258306fb5f5`, LEFT `a857f6df-279f-414d-a470-240714731a7e`, UP_LEFT `3635a66c-e0f7-424a-a37a-ca8d999a4867`. Se recuperan con `get_job` (enlace de 1 h). **Caducan**: conviene descargarlos pronto.
- Plan de integración de Tariq (pendiente de tener los PNG): 8 archivos `characters/tariq/tariq_idle_<dir>.png`, `mirror:false`, `directions` las 8, `walk/roll/hurt/death` caen a idle por el fallback; `pixelScale` 2, anclaje de pies `y+14`; arma por `weaponSocket`. Plantilla en `docs/manifest.tariq.example.json`; encargo completo en `docs/TARIQ_ART_BRIEF.md`.

## 5. Pruebas (todas pasan)
- `npm ci` · `npm run build` · `npm run test:unit` (direcciones/espejado)
- `python3 tests/e2e/sprites_e2e.py` → **88 comprobaciones** (requiere `playwright`, `numpy`, `pillow` y el build; arranca `vite preview` en :4173). Modo A = producción real; B = fixture sintético de Tariq (`tests/fixtures`, **no es arte**); C = manifiestos rotos.
- `python3 tests/e2e/prod_smoke.py <URL>` → smoke contra el sitio servido (raíz o subcarpeta).
- Lecciones: capturas desde Python tardan ~350 ms; estados cortos (dash 0,18 s, hurt 0,3 s) o proyectiles se miden **dentro de la página** (grabadores con `requestAnimationFrame`). El parpadeo de invulnerabilidad rompe comparaciones exactas de color: usar reintentos. Los procesos en segundo plano mueren entre comandos: arrancar `vite preview` en el mismo comando que las pruebas.

## 6. Fases pendientes (personajes y enemigos al final)
- **Fase 5 · Efectos**: explosiones (gancho `spawnEffect('explosion')` ya existe), impactos, fogonazos, tesla, fuego, hielo, veneno.
- **Fase 6 · Mundo**: suelos, paredes y decoración por bioma. Pregunta abierta: ¿aclarar también el mundo de juego (hoy muy oscuro, lo dibuja el motor con colores de bioma)?
- **Fase 7 · Interfaz pendiente**: pantallas de evento y victoria no vistas renderizadas; mapa/minimapa con verdes planos fuera de paleta; iconos de UI generados con Pixel Engine si se desbloquea.
- **Fase 8 · Personajes**: Tariq primero (8 orientaciones aprobadas + idle/walk/roll/hurt/death), luego los otros 9. La animación `death` no se llega a ver porque la derrota es inmediata; retrasar el fin de partida ~0,6–1 s requiere autorización del usuario (cambia el flujo).
- **Fase 9 · Enemigos**: 20 + 3 jefes.
- **Fase 10 · Pulido**: coherencia, rendimiento, pruebas, build final.

## 7. Notas y pegas conocidas
- Varios sets de equipo tienen colores muy parecidos en los datos; los emblemas ayudan pero no del todo.
- Los proyectiles críticos se pintan en dorado por el motor, pero el sprite mantiene su color.
- Algunos francotiradores quedan largos junto al jugador (ajustable con `muzzle`/`pixelScale`).
- Estilos en línea de `App.tsx` limitan lo que el CSS puede restyle (p. ej. color del nombre del bioma en el HUD).
- La caché: no cachear `index.html` ni `assets/sprites/manifest.json` en el servidor.
