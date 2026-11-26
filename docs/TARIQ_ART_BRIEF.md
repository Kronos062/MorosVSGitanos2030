# Encargo de arte · Bombeta (prototipo de referencia)

Estado: **sin generar**. Pixel Engine no estaba disponible en la sesión de desarrollo (no aparece como herramienta ni en el directorio de conectores). La integración está lista y probada con tiras sintéticas; falta únicamente el arte.

## Diseño
Niño. Chilaba blanca. Kufiya blanca y negra. Silueta infantil, cabeza proporcionalmente grande, reconocible al instante. Perspectiva top-down 3/4 (estilo action-roguelite tipo Zelda). Pixel art auténtico: contorno limpio y consistente, sombreado en 2-3 tonos por material, paleta limitada (blanco hueso, negro tinta, gris de sombra, piel, un acento). Sin antialiasing ni degradados. Sombra de suelo NO incluida (la dibuja el motor).

Color de identidad en el juego: cian `#00f0ff`. Estética del HUD: tinta `#0b0d14`, azulejo `#3d7bd0`, arcilla `#d9482f`, oro `#f0c23a`, hueso `#efe6cb`.

## Entregables (PNG con transparencia real, una tira horizontal por archivo)
Carpeta `public/assets/sprites/characters/tariq/`, nombre `tariq_<anim>_<dir>.png`, direcciones `up, up_right, right, down_right, down` (las otras tres las espeja el motor; Bombeta no tiene elementos asimétricos que lo impidan; si el kufiya lleva un detalle asimétrico, dibujar las 8 y poner `"mirror": false`).

| Animación | Frames sugeridos | fps | Bucle |
|-----------|------------------|-----|-------|
| idle      | 4                | 6   | sí    |
| walk      | 6                | 10  | sí    |
| roll      | 5                | 14  | sí (dura ~0,18 s en juego) |
| hurt      | 3                | 10  | no    |
| death     | 6                | 8   | no (mantiene último frame) |

25 tiras en total. Requisitos técnicos:
- Mismo tamaño de frame en todo el set; **pies en el borde inferior, centrados**, sin filas transparentes por debajo. Tamaño orientativo de lienzo 32×40 (ajustable; escala visual coherente con el resto del reparto, `pixelScale` 2).
- Ancho de cada PNG divisible entre su nº de frames.
- Sin píxeles sobrantes que muevan el encuadre entre frames.

Además: `portraits/tariq_portrait.png` (retrato de selección, sugerido 64×64) y `portraits/tariq_icon.png` (icono, 16×16). Arma `weapons/iron_python.png` (mirando a la derecha, punto de agarre indicado) y `projectiles/iron_python.png`; **son el arma y la bala reales de Bombeta** (`startingWeapon: pistol` → `iron_python`).

## Integración (ya preparada)
1. Copiar los PNG a las rutas anteriores.
2. Copiar las entradas de `docs/manifest.tariq.example.json` a `public/assets/sprites/manifest.json`, ajustando `frames`, `fps` y `weaponSocket` al arte real.
3. `npm run build`; en consola aparecerá un aviso por cada recurso declarado que falte o tenga medidas inválidas.
4. Verificar con `npm run test:e2e` (cambiar a un manifiesto propio) y a ojo en partida.

## Cómo generarlo con Pixel Engine cuando esté conectado
Conectar el conector/MCP de Pixel Engine a la sesión (con permiso para generar y animar sprites y escribir archivos en el proyecto). Con él: generar el personaje 32×40 por dirección, animar cada clip (idle/walk/roll/hurt/death), exportar una tira por clip y dirección, y generar retrato, icono, arma y proyectil. El orden es: primero Bombeta completo, validación visual por tu parte, y solo entonces los otros nueve.

---
## Estado de producción (actualizado)

- Pixel Engine **operativo** en la sesión (generate_sprite / animate_sprite / remove_background / pixelate_image / get_job). Saldo al empezar: 100 créditos.
- Primer diseño base generado (modelo `pe_image_v1`, 24×32 px, 12 colores, fondo transparente, 6 créditos). Job: `6c343a4d-1a83-4e97-9b36-0ff29a4c9f6e`, seed `1533984`. Pendiente de aprobación visual del usuario. Los archivos se conservan ≥24 h y se recuperan con `get_job`.
- **Bloqueo:** el contenedor no resuelve `*.supabase.co` (donde Pixel Engine aloja los PNG), por lo que no se pueden descargar los resultados al proyecto. Hay que añadir `pbyjudvocajebcijrloe.supabase.co` (o `*.supabase.co`) a los dominios permitidos de red.
- Tamaño de sprite decidido: 24×32 px por frame base, `pixelScale` 2 (48×64 px en pantalla), anclaje de pies abajo-centro. Con `animate_sprite` y `canvas.scale` 1.5 los frames de las tiras serán mayores (≈36×48); el manifiesto no necesita cambios porque el anclaje es fraccionario.

### Costes de Pixel Engine (esta cuenta)
| Operación | Créditos |
|---|---|
| still `pe_image_v1` | 6 |
| still `nb_flash_2_1` (admite referencias, mejor para mantener el personaje entre direcciones) | 12 |
| animación v1.1 / v1.5 | 20 / 26 |
| quitar fondo | 2 |

Conjunto completo de Bombeta (5 direcciones × 5 animaciones = 25 clips) ≈ 25 × (20–26 + 2) + stills ≈ 600–750 créditos, más repeticiones (la animación es estocástica: 2–4 tomas por clip es normal).

---
## Iconos de interfaz (pixel art)
Los emojis de la UI se sustituyen por 44 iconos pixel art de 16×16 definidos en `tools/make_ui_icons.py` (genera `src/ui/iconData.ts`). La asignación emoji → icono está en `src/ui/iconMap.ts` y la sustitución se hace en un envoltorio del runtime de JSX (`src/ui/jsx`, activado con `jsxImportSource: "mvg-jsx"`), así que cubre también los iconos que vienen de los datos del juego. Los emojis sin icono asignado se muestran como antes. Estos iconos están dibujados como mapas de bits por código, no generados con Pixel Engine.
