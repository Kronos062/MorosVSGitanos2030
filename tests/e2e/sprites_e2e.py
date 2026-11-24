"""E2E del sistema de sprites (Playwright para Python + numpy + Pillow).

Ejecutar desde la raíz del proyecto:  python3 tests/e2e/sprites_e2e.py
Arranca `vite preview` si no hay servidor en :4173 (haz `npm run build` antes).

Modos:
  A  producción: manifiesto real (objetos del mundo) -> cofres/portal con sprite; el resto, primitivas originales
  B  fixture:    tests/fixtures/sprites   -> verifica todo el pipeline por píxel
  C  roto:       manifiesto que apunta a archivos inexistentes / basura -> fallback sin errores

Los sprites de tests/fixtures son SINTÉTICOS de diagnóstico, no arte del juego.
"""
import io, json, os, subprocess, sys, time, urllib.request
import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
FIX = os.path.join(ROOT, 'tests', 'fixtures', 'sprites')
URL = 'http://localhost:4173/?spritedebug'
W, H = 1280, 720

RES = []
def check(name, ok, detail=''):
    RES.append((name, bool(ok), detail))
    print(('PASS' if ok else 'FAIL'), '-', name, ('· ' + str(detail)) if detail else '')

def ensure_server():
    try:
        urllib.request.urlopen('http://localhost:4173/', timeout=1); return None
    except Exception:
        pass
    proc = subprocess.Popen(['npx', 'vite', 'preview', '--port', '4173', '--strictPort'], cwd=ROOT,
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
    for _ in range(40):
        time.sleep(0.5)
        try:
            urllib.request.urlopen('http://localhost:4173/', timeout=1); return proc
        except Exception:
            pass
    raise RuntimeError('no arranca vite preview')

# ───────────── utilidades de píxel ─────────────
ANIM_COL = {'idle': (70, 130, 200), 'walk': (60, 170, 90), 'roll': (220, 160, 40), 'hurt': (220, 70, 70), 'death': (120, 120, 120)}
SWATCH = {'up': (0, 255, 255), 'up_right': (0, 255, 0), 'right': (255, 0, 255), 'down_right': (255, 255, 0), 'down': (255, 128, 0)}
WEAPON_COL, PROJ_COL, FX_COL, FEET, WHITE = (200, 200, 210), (255, 240, 80), (255, 140, 0), (255, 0, 0), (255, 255, 255)

def mask(a, c): return (a[:, :, 0] == c[0]) & (a[:, :, 1] == c[1]) & (a[:, :, 2] == c[2])

def shot(page):
    """Captura rápida (~20 ms) del canvas vía toDataURL: necesaria para ver estados de 0,15-0,3 s (dash, hurt)."""
    import base64
    d = page.evaluate("() => document.querySelector('canvas').toDataURL('image/png')")
    return np.array(Image.open(io.BytesIO(base64.b64decode(d.split(',', 1)[1]))).convert('RGB'))

def analyze(a):
    """Devuelve dict con pies, animación, dirección/espejado, frame, arma."""
    r = {}
    f = mask(a, FEET); ys, xs = np.nonzero(f)
    if len(xs) < 4: return {'feet': None}
    r['feet'] = (float(xs.mean()), int(ys.max()) + 1)           # centro x, borde inferior de los pies
    fx, fy = r['feet']
    x0, x1, y0, y1 = int(fx) - 70, int(fx) + 70, int(fy) - 110, int(fy) + 12
    reg = a[max(0, y0):y1, max(0, x0):x1]
    best = max(ANIM_COL, key=lambda k: mask(reg, ANIM_COL[k]).sum())
    r['anim'] = best if mask(reg, ANIM_COL[best]).sum() >= 100 else None
    r['anim_px'] = {k: int(mask(reg, v).sum()) for k, v in ANIM_COL.items()}
    sw = max(SWATCH, key=lambda k: mask(reg, SWATCH[k]).sum())
    m = mask(reg, SWATCH[sw]); sy, sx = np.nonzero(m)
    if len(sx) >= 50:
        r['dir_file'] = sw
        r['flipped'] = bool(sx.mean() + max(0, x0) > fx)         # el cuadrado nace a la izquierda; a la derecha = espejado
    wm = mask(reg, WEAPON_COL); wy, wx = np.nonzero(wm)
    r['weapon_px'] = int(wm.sum())
    r['weapon_dx'] = float(wx.mean() + max(0, x0) - fx) if len(wx) else None
    wh = mask(reg, WHITE); hy, hx = np.nonzero(wh)
    r['pips'] = len(hx)
    if r['anim'] and not r.get('flipped') and len(hx):
        # el píxel blanco está en sprite-x = 4 + 3*frame; el frame empieza 13 px de sprite (=26 px) a la izquierda de los pies
        left = r['feet'][0] - 3 - 26 + 0.0
        r['frame'] = int(round(((hx.min() + max(0, x0) - left) / 2 - 4) / 3))
    return r

def count(a, c): return int(mask(a, c).sum())

# ───────────── manejo de página ─────────────
def serve(page, manifest_override=None, use_fixture=False, garbage=False):
    def handler(route):
        rel = route.request.url.split('/assets/sprites/', 1)[1].split('?')[0]
        if rel == 'manifest.json':
            if garbage: return route.fulfill(status=200, content_type='text/html', body='<!doctype html><html>nope</html>')
            if manifest_override is not None: return route.fulfill(status=200, content_type='application/json', body=json.dumps(manifest_override))
            if use_fixture: return route.fulfill(status=200, content_type='application/json', body=open(os.path.join(FIX, 'manifest.json')).read())
            return route.continue_()
        if not use_fixture and manifest_override is None and not garbage:
            return route.continue_()          # modo producción: se sirven los recursos reales
        p = os.path.join(FIX, rel)
        if use_fixture and os.path.exists(p): return route.fulfill(status=200, content_type='image/png', body=open(p, 'rb').read())
        return route.fulfill(status=404, body='')
    page.route('**/assets/sprites/**', handler)

def open_game(pw, **serve_kw):
    b = pw.chromium.launch()
    pg = b.new_page(viewport={'width': W, 'height': H})
    logs = {'console': [], 'page': [], 'bad_requests': []}
    pg.on('console', lambda m: logs['console'].append(m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: logs['page'].append(str(e)))
    pg.on('response', lambda r: logs['bad_requests'].append(f'{r.status} {r.url}') if r.status >= 400 and 'favicon' not in r.url else None)
    serve(pg, **serve_kw)
    pg.goto(URL); pg.wait_for_timeout(300)
    pg.evaluate('() => window.__sprites.load()')   # espera a que termine la carga completa de sprites
    pg.wait_for_timeout(200)
    return b, pg, logs

def start_run(pg, faction='MOROS'):
    pg.get_by_role('button').filter(has_text=faction).first.click(); pg.wait_for_timeout(250)
    if pg.get_by_role('button', name='ENTENDIDO').count(): pg.get_by_role('button', name='ENTENDIDO').click(); pg.wait_for_timeout(150)
    pg.get_by_role('button').filter(has_text='JUGAR').first.click(); pg.wait_for_timeout(300)

def combat(pg):
    pg.get_by_role('button', name='COMBATIR').click(); pg.wait_for_timeout(900)

def clean_scene(pg):
    """Solo para pruebas: mantiene la escena sin enemigos ni proyectiles enemigos (no toca hp ni invuln del jugador)."""
    pg.evaluate("""() => {
        const e = window.__engine;
        const sweep = () => { e.enemies.length = 0; for (let i = e.projectiles.length - 1; i >= 0; i--) if (e.projectiles[i].owner === 'enemy') e.projectiles.splice(i, 1); };
        sweep();
        if (!window.__sweeper) window.__sweeper = setInterval(sweep, 30);
        e.player.hp = e.player.maxHp; e.player.invuln = 0;
    }""")

def record_in_page(pg, ms=600):
    """Empieza a leer el canvas en cada frame de render durante `ms` (no depende de la latencia de Playwright).
    Devuelve, vía `pg.evaluate('() => window.__rec')`, los píxeles exactos vistos por color de animación."""
    cols = json.dumps(ANIM_COL)
    pg.evaluate("""([cols, ms]) => {
        const c = document.querySelector('canvas'), ctx = c.getContext('2d'), C = cols;
        window.__rec = new Promise(res => {
            const seen = {}, t0 = performance.now();
            const tick = () => {
                const d = ctx.getImageData(560, 250, 160, 150).data;
                for (let i = 0; i < d.length; i += 4)
                    for (const k in C) if (d[i] === C[k][0] && d[i+1] === C[k][1] && d[i+2] === C[k][2]) seen[k] = (seen[k] || 0) + 1;
                performance.now() - t0 < ms ? requestAnimationFrame(tick) : res(seen);
            };
            tick();
        });
    }""", [ANIM_COL, ms])

def grab(pg, tries=6):
    """Captura y analiza reintentando si el sprite no está visible en ese instante."""
    r = {'feet': None}
    for _ in range(tries):
        r = analyze(shot(pg))
        if r.get('feet'): return r
        pg.wait_for_timeout(40)
    return r

def set_facing(pg, fx, fy):
    pg.evaluate(f"() => {{ const p = window.__engine.player; p.facingX = {fx}; p.facingY = {fy}; }}")

# ───────────── MODO A: producción ─────────────
def mode_a(pw):
    print('\n== MODO A · manifiesto de producción (solo objetos del mundo): fallback para personajes/enemigos ==')
    b, pg, logs = open_game(pw)
    st = pg.evaluate('() => window.__sprites.stats()')
    exp_objs = {'chest_common_closed', 'chest_common_open', 'chest_rare_closed', 'chest_rare_open', 'chest_legendary_closed', 'chest_legendary_open', 'portal_descent', 'portal_final',
                'pickup_heal', 'pickup_shield', 'pickup_score', 'pickup_relic', 'pickup_weapon',
                'pickup_item_helm', 'pickup_item_chest', 'pickup_item_pants', 'pickup_item_boots'}
    n_equip = len([k for k in st['objects'] if k.startswith('equip_')])
    check('A: manifiesto real: 17 objetos del mundo + 84 de equipo (20 sets x 4 ranuras + 4 genéricos), sin personajes ni enemigos y sin problemas de carga',
          exp_objs <= set(st['objects']) and n_equip == 84 and len(st['objects']) == 101 and not st['characters'] and not st['enemies'] and not st['problems'],
          f"{len(st['objects'])} objetos, {n_equip} de equipo, problemas={st['problems'][:2]}")
    check('A: manifiesto real: 59 armas y 59 proyectiles cargados', len(st['weapons']) == 59 and len(st['projectiles']) == 59 and 'iron_python' in st['weapons'],
          f"{len(st['weapons'])} armas, {len(st['projectiles'])} proyectiles")
    start_run(pg); combat(pg); clean_scene(pg)
    col = pg.evaluate("() => window.__engine.player.color")
    rgb = tuple(int(col[i:i + 2], 16) for i in (1, 3, 5))
    shots = [shot(pg) for _ in range(8)]   # varias muestras: el parpadeo de invulnerabilidad alterna alfa
    best = max(count(a, rgb) for a in shots)
    check('A: jugador dibujado con la primitiva original (color propio presente; el arma en mano tapa parte)', best > 12, f'{col}: {best}px')
    check('A: ningún píxel de fixture en producción', all(count(a, FEET) == 0 and count(a, PROJ_COL) == 0 for a in shots))
    # velocidad de movimiento de referencia (para compararla con el modo B)
    x0 = pg.evaluate('() => window.__engine.player.x'); pg.keyboard.down('KeyD'); pg.wait_for_timeout(1000); pg.keyboard.up('KeyD')
    x1 = pg.evaluate('() => window.__engine.player.x')
    # ── objetos del mundo: cofres y portal con sprite ──
    clean_scene(pg)
    info = pg.evaluate("() => { const e = window.__engine; const c = e.chests[0]; return c ? {n: e.chests.length, x: c.x, y: c.y, cam: [e.camera.x, e.camera.y]} : null; }")
    check('A: hay un cofre en la sala inicial para probar', info is not None, info)
    if info:
        # IDs reales de partida (src/content/chests.ts); el motor los mapea a chest_common/rare/legendary del manifiesto.
        BAND = {'chest_street': (195, 203, 232), 'chest_armory': (127, 216, 255), 'chest_boss': (255, 210, 74)}
        for defid, col in BAND.items():
            pg.evaluate(f"() => {{ const c = window.__engine.chests[0]; c.defId = '{defid}'; c.opened = false; }}"); pg.wait_for_timeout(250)
            cx, cy = int(W / 2 + info['x'] - info['cam'][0]), int(H / 2 + info['y'] - info['cam'][1])
            best = max(count(shot(pg)[max(0, cy - 40):cy + 20, max(0, cx - 40):cx + 40], col) for _ in range(6))
            check(f'A: {defid} cerrado se dibuja con su sprite (banda metálica exacta)', best > 12, f'{best}px')
            pg.evaluate("() => { window.__engine.chests[0].opened = true; }"); pg.wait_for_timeout(250)
            reg = shot(pg)[max(0, cy - 40):cy + 20, max(0, cx - 40):cx + 40]
            check(f'A: {defid} abierto se dibuja con su sprite (interior oscuro exacto)', count(reg, (42, 32, 64)) > 8, f'{count(reg, (42, 32, 64))}px')
        pos = pg.evaluate("() => { const c = window.__engine.chests[0]; return [c.x, c.y]; }")
        check('A: el sprite no mueve ni altera el cofre (posición intacta)', pos == [info['x'], info['y']], pos)
    # portal: ambos tipos, y animación
    pg.evaluate("() => { const e = window.__engine; e.chests.length = 0; e.portal = {x: e.player.x + 140, y: e.player.y, active: true, kind: 'descent'}; }"); pg.wait_for_timeout(300)
    cam = pg.evaluate("() => { const e = window.__engine; return [e.portal.x - e.camera.x, e.portal.y - e.camera.y]; }")
    px_, py_ = int(W / 2 + cam[0]), int(H / 2 + cam[1])
    hashes = set(); ring = 0
    for _ in range(14):
        reg = shot(pg)[py_ - 34:py_ + 34, px_ - 34:px_ + 34]; ring = max(ring, count(reg, (127, 216, 255))); hashes.add(reg.tobytes().__hash__())
    check('A: portal de descenso dibujado con su sprite (anillo cian exacto)', ring > 40, f'{ring}px')
    check('A: el portal se anima (≥3 frames distintos)', len(hashes) >= 3, f'{len(hashes)} frames distintos')
    pg.evaluate("() => { window.__engine.portal.kind = 'final'; }"); pg.wait_for_timeout(300)
    gold = max(count(shot(pg)[py_ - 34:py_ + 34, px_ - 34:px_ + 34], (255, 210, 74)) for _ in range(6))
    check('A: portal final dibujado con su sprite dorado', gold > 40, f'{gold}px')
    pg.evaluate("() => { window.__engine.portal = null; }")

    # ── pickups: cada tipo con su sprite ──
    CASES = [  # (nombre, kind, itemId, color exacto del sprite, mínimo de px, color que NO debe aparecer)
        ('heal (botiquín)', 'heal', None, (94, 224, 160), 6, None),
        ('shield (escudo)', 'shield', None, (58, 208, 238), 10, None),
        ('score (moneda)', 'score', None, (255, 210, 74), 8, None),
        ('relic (reliquia)', 'relic', 'x', (167, 123, 255), 10, None),
        ('weapon (arma)', 'weapon', None, (116, 128, 176), 8, None),
        ('item helm (casco, set Berserker)', 'item', 'set_berserker_helm', (255, 85, 0), 10, None),
        ('item chest (pechera, set Berserker)', 'item', 'set_berserker_chest', (255, 85, 0), 14, None),
        ('item pants (pantalón, set Berserker)', 'item', 'set_berserker_pants', (255, 85, 0), 14, None),
        ('item boots (botas, set Berserker)', 'item', 'set_berserker_boots', (255, 85, 0), 14, None),
        ('item helm (casco, set Francotirador)', 'item', 'set_sniper_helm', (0, 200, 255), 10, None),
    ]
    for label, kind, item, col, need, absent in CASES:
        arg = f", undefined, '{item}'" if (item and kind == 'item') else (", undefined, 'x'" if kind == 'relic' else "")
        pg.evaluate(f"() => {{ const e = window.__engine; e.pickups.length = 0; e.spawnPickup(e.player.x + 90, e.player.y + 10, '{kind}', '#39ff88', 20{arg}); }}")
        pg.wait_for_timeout(200)
        off = pg.evaluate("() => { const e = window.__engine, k = e.pickups[0]; return [k.x - e.camera.x, k.y - e.camera.y]; }")
        kx, ky = int(W / 2 + off[0]), int(H / 2 + off[1])
        best, bad = 0, 0
        for _ in range(8):
            reg = shot(pg)[max(0, ky - 36):ky + 30, max(0, kx - 36):kx + 36]
            best = max(best, count(reg, col)); bad = max(bad, count(reg, absent) if absent else 0)
        check(f'A: pickup {label} dibujado con su sprite', best >= need and bad == 0, f'{best}px' + (f' | color ajeno {bad}px' if absent else ''))
    # la animación flotante es solo visual: la posición real del pickup no cambia
    y0, y1 = [pg.evaluate("() => window.__engine.pickups[0].y") for _ in range(1)] * 2
    pg.wait_for_timeout(400); y1 = pg.evaluate("() => window.__engine.pickups[0].y")
    check('A: el flotado del pickup no altera su posición real', y0 == y1, f'{y0} → {y1}')
    pg.evaluate("() => { window.__engine.pickups.length = 0; }")

    # ── equipo: formas distintas por ranura, pantalla de objeto encontrado y build con el sprite de la pieza ──
    hashes = {}
    for slot in ('helm', 'chest', 'pants', 'boots'):
        pg.evaluate(f"() => {{ const e = window.__engine; e.pickups.length = 0; e.spawnPickup(e.player.x + 90, e.player.y + 10, 'item', '#ff5500', 0, undefined, 'set_berserker_{slot}'); }}")
        pg.wait_for_timeout(200)
        off = pg.evaluate("() => { const e = window.__engine, k = e.pickups[0]; return [k.x - e.camera.x, k.y - e.camera.y]; }")
        kx, ky = int(W / 2 + off[0]), int(H / 2 + off[1])
        reg = shot(pg)[ky - 20:ky + 14, kx - 20:kx + 20]; hashes[slot] = (mask(reg, (255, 85, 0))).tobytes().__hash__()
    check('A: las cuatro ranuras de un mismo set tienen silueta distinta', len(set(hashes.values())) == 4, len(set(hashes.values())))
    pg.evaluate("() => { const e = window.__engine; e.pickups.length = 0; e.spawnPickup(e.player.x + 12, e.player.y, 'item', '#ff5500', 0, undefined, 'set_berserker_helm'); }")
    pg.wait_for_timeout(300); pg.keyboard.press('KeyE'); pg.wait_for_timeout(700)
    tiles = pg.evaluate("() => [...document.querySelectorAll('.screen .equip-tile .px-ico')].map(e => [getComputedStyle(e).backgroundImage, e.getBoundingClientRect().width])")
    check('A: la pantalla de objeto encontrado muestra el sprite de la pieza (set Berserker, 32 px)',
          len(tiles) >= 1 and all('equip_set_berserker_helm' in t[0] and t[1] == 32 for t in tiles), tiles)
    pg.locator('.screen .menu-btn.primary').first.click(); pg.wait_for_timeout(500)
    check('A: tras elegir, el juego se reanuda', pg.evaluate('() => window.__engine.running === true'))
    pg.keyboard.press('Escape'); pg.wait_for_timeout(400)
    pg.get_by_role('button', name='BUILD').first.click(); pg.wait_for_timeout(500)
    bt = pg.evaluate("() => [...document.querySelectorAll('.build-equipment-section .equip-tile .px-ico')].map(e => getComputedStyle(e).backgroundImage)")
    check('A: la pantalla de build muestra el sprite de la pieza equipada', len(bt) == 1 and 'equip_set_berserker_helm' in bt[0], bt)
    pg.get_by_role('button', name='VOLVER').first.click(); pg.wait_for_timeout(300)
    pg.get_by_role('button', name='CONTINUAR').first.click(); pg.wait_for_timeout(500)
    pg.evaluate("() => { window.__engine.pickups.length = 0; }")

    # ── armas: en mano sobre la forma original, como pickup concreto y como proyectil ──
    pg.mouse.move(W / 2 + 200, H / 2); pg.evaluate("() => { const p = window.__engine.player; p.facingX = 1; p.facingY = 0; }")
    WEAPON_COLOR = {'minigun': (255, 136, 0), 'rail_driver': (255, 43, 214), 'bat': (148, 163, 184), 'nova_cannon': (255, 225, 74)}
    pcx, pcy = W // 2, H // 2
    for wid, col in WEAPON_COLOR.items():
        pg.evaluate(f"() => {{ const p = window.__engine.player; p.weaponId = '{wid}'; p.facingX = 1; p.facingY = 0; p.invuln = 0; }}"); pg.wait_for_timeout(250)
        best = max(count(shot(pg)[pcy - 50:pcy + 40, pcx - 30:pcx + 90], col) for _ in range(5))
        check(f'A: {wid} se dibuja en mano sobre la forma del jugador (acento exacto)', best >= 6, f'{best}px')
    pg.evaluate("() => { const p = window.__engine.player; p.facingX = -1; p.facingY = 0; p.weaponId = 'minigun'; }"); pg.wait_for_timeout(250)
    left = max(count(shot(pg)[pcy - 50:pcy + 40, pcx - 90:pcx + 30], (255, 136, 0)) for _ in range(5))
    check('A: al apuntar a la izquierda el arma se dibuja a ese lado', left >= 6, f'{left}px')
    # pickup de arma concreta (no el genérico)
    for wid, col in (('minigun', (255, 136, 0)), ('rail_driver', (255, 43, 214))):
        pg.evaluate(f"() => {{ const e = window.__engine; e.pickups.length = 0; e.spawnPickup(e.player.x + 90, e.player.y + 10, 'weapon', '#ffe14a', 0, '{wid}'); }}"); pg.wait_for_timeout(200)
        off = pg.evaluate("() => { const e = window.__engine, k = e.pickups[0]; return [k.x - e.camera.x, k.y - e.camera.y, k.weaponId]; }")
        kx, ky = int(W / 2 + off[0]), int(H / 2 + off[1])
        best = max(count(shot(pg)[max(0, ky - 40):ky + 30, max(0, kx - 50):kx + 50], col) for _ in range(6))
        check(f'A: pickup de arma {wid} muestra el arma concreta', best >= 6, f'{best}px (weaponId={off[2]})')
    pg.evaluate("() => { window.__engine.pickups.length = 0; }")
    # proyectiles: el sprite de proyectil de cada arma (clave = baseId) se dibuja con su núcleo crema exacto
    CORE = (255, 244, 214)
    for wid in ('pulse_pistol', 'rail_driver'):
        pg.evaluate(f"() => {{ const p = window.__engine.player; p.weaponId = '{wid}'; p.facingX = 1; p.facingY = 0; }}")
        pg.evaluate("""([core]) => {
            const e = window.__engine, ctx = document.querySelector('canvas').getContext('2d'), t0 = performance.now();
            window.__proj = new Promise(res => {
                const keys = new Set(); let px = 0;
                (function f() {
                    for (const p of e.projectiles) if (p.owner === 'player') keys.add(String(p.sprite));
                    const d = ctx.getImageData(0, 300, 1280, 150).data; let n = 0;
                    for (let i = 0; i < d.length; i += 4) if (d[i] === core[0] && d[i+1] === core[1] && d[i+2] === core[2]) n++;
                    px = Math.max(px, n); performance.now() - t0 < 1500 ? requestAnimationFrame(f) : res({ keys: [...keys], px });
                })();
            });
        }""", [CORE])
        pg.mouse.move(W / 2 - 250, H / 2); pg.keyboard.down('KeyA'); pg.wait_for_timeout(500); pg.keyboard.up('KeyA')
        pg.mouse.move(W / 2 - 250, H / 2); pg.mouse.down(); pg.wait_for_timeout(1500); pg.mouse.up()
        pr = pg.evaluate('() => window.__proj')
        check(f'A: proyectil de {wid} usa su sprite (clave y núcleo crema exacto)', pr['keys'] == [wid] and pr['px'] >= 3, pr)
        pg.evaluate("() => { window.__engine.projectiles.length = 0; }")
    fps = pg.evaluate("() => new Promise(r => { let n=0; const t0=performance.now(); const f=()=>{ n++; performance.now()-t0<2000 ? requestAnimationFrame(f) : r(n/2) }; f(); })")
    check('A: sin errores de consola/página/red', not logs['console'] and not logs['page'] and not logs['bad_requests'], logs)
    b.close()
    return {'dx': x1 - x0, 'fps': fps}

# ───────────── MODO B: fixture ─────────────
def mode_b(pw, ref):
    print('\n== MODO B · fixture sintético: pipeline completo ==')
    b, pg, logs = open_game(pw, use_fixture=True)
    st = pg.evaluate('() => window.__sprites.stats()')
    check('B: manifiesto cargado sin problemas', st['characters'] == ['tariq'] and not st['problems'] and 'iron_python' in st['weapons'] and 'explosion' in st['effects'], st)

    # retratos en selección de personaje
    pg.get_by_role('button').filter(has_text='MOROS').first.click(); pg.wait_for_timeout(250)
    if pg.get_by_role('button', name='ENTENDIDO').count(): pg.get_by_role('button', name='ENTENDIDO').click(); pg.wait_for_timeout(150)
    pg.get_by_role('button').filter(has_text='JUGAR').first.click(); pg.wait_for_timeout(300)
    icons = pg.evaluate("() => [...document.querySelectorAll('img.pixel-icon')].map(i => [i.naturalWidth, i.complete])")
    port = pg.evaluate("() => [...document.querySelectorAll('img.pixel-portrait')].map(i => [i.naturalWidth, i.complete])")
    check('B: icono de Tariq en su tarjeta y solo en ella', icons == [[16, True]], icons)
    check('B: retrato de Tariq en el panel de detalle', port == [[64, True]], port)
    pg.screenshot(path='/tmp/b_chars.png')
    combat(pg); clean_scene(pg); pg.wait_for_timeout(200)

    # idle y anclaje de pies
    a = grab(pg)
    check('B: Tariq renderizado con sprite (pies localizados)', a.get('feet') is not None, a.get('feet'))
    check('B: animación idle seleccionada en reposo', a.get('anim') == 'idle', a.get('anim_px'))
    cam = pg.evaluate("() => { const e = window.__engine; return [e.player.x - e.camera.x, e.player.y - e.camera.y]; }")
    exp_y = H / 2 + cam[1] + 14
    check('B: pies anclados a y+14 del centro de colisión (footOffset = radio 14)', a['feet'] and abs(a['feet'][1] - exp_y) <= 2, f"pies y={a['feet'] and a['feet'][1]} esperado≈{exp_y:.1f}")

    # ocho direcciones
    expect = {'up': ('up', False), 'up_right': ('up_right', False), 'right': ('right', False), 'down_right': ('down_right', False),
              'down': ('down', False), 'down_left': ('down_right', True), 'left': ('right', True), 'up_left': ('up_right', True)}
    vec = {'up': (0, -1), 'up_right': (1, -1), 'right': (1, 0), 'down_right': (1, 1), 'down': (0, 1), 'down_left': (-1, 1), 'left': (-1, 0), 'up_left': (-1, -1)}
    feet_x0 = None
    for d, (fx, fy) in vec.items():
        set_facing(pg, fx, fy); pg.wait_for_timeout(150)
        r = grab(pg); want = expect[d]
        check(f'B: dirección lógica {d} → archivo {want[0]}{" espejado" if want[1] else ""}', r.get('dir_file') == want[0] and r.get('flipped') == want[1], {k: r.get(k) for k in ('dir_file', 'flipped')})
        feet_x0 = feet_x0 or (r['feet'] or [None])[0]
        check(f'B: pies no se desplazan al cambiar a {d}', r['feet'] and feet_x0 is not None and abs(r['feet'][0] - feet_x0) <= 2 and abs(r['feet'][1] - a['feet'][1]) <= 2, r['feet'])

    # arma: dibujada en su socket, del lado al que apunta, sin mover al personaje
    for d, sign in (('right', 1), ('left', -1)):
        set_facing(pg, *vec[d]); pg.wait_for_timeout(150); r = grab(pg)
        check(f'B: arma visible apuntando a {d} y del lado correcto', r['weapon_px'] > 20 and r['weapon_dx'] is not None and r['weapon_dx'] * sign > 0, f"px={r['weapon_px']} dx={r['weapon_dx']}")
    wb = pg.evaluate('() => window.__engine.visWeaponBase')
    check('B: baseId de arma cacheado coincide con la clave del manifiesto', wb == 'iron_python', wb)

    # caminar: animación + sin saltos verticales + frames avanzan
    set_facing(pg, 1, 0); pg.keyboard.down('KeyD'); pg.wait_for_timeout(250)
    ys, frames, anims = [], set(), set()
    for _ in range(14):
        r = analyze(shot(pg)); anims.add(r.get('anim'))
        if r.get('feet'): ys.append(r['feet'][1])
        if r.get('frame') is not None: frames.add(r['frame'])
    pg.keyboard.up('KeyD')
    check('B: animación walk al moverse', 'walk' in anims, anims)
    check('B: sin saltos verticales de pies durante walk', ys and max(ys) - min(ys) <= 1, f'y∈[{min(ys)},{max(ys)}] n={len(ys)}')
    check('B: los frames de walk avanzan', len(frames) >= 3, sorted(frames))
    dx = pg.evaluate('() => window.__engine.player.x')
    pg.wait_for_timeout(350); r = grab(pg)
    check('B: vuelve a idle al detenerse', r.get('anim') == 'idle', r.get('anim_px'))

    # rodar (el dash dura 0,18 s y todo él parpadea por invulnerabilidad: se mide dentro de la página)
    clean_scene(pg); pg.wait_for_timeout(300)
    record_in_page(pg, 700)
    pg.keyboard.down('KeyD'); pg.keyboard.press('ShiftLeft')
    seen = pg.evaluate('() => window.__rec')
    pg.keyboard.up('KeyD'); pg.wait_for_timeout(300)
    check('B: animación roll durante el dash', seen.get('roll', 0) > 100, seen)
    check('B: antes y después del roll se usa walk/idle (no se queda atascada)', seen.get('walk', 0) + seen.get('idle', 0) > 100, seen)

    # daño
    clean_scene(pg); pg.wait_for_timeout(300)
    record_in_page(pg, 700)
    pg.evaluate('() => { window.__engine.player.hp -= 10; }')
    seen_px = pg.evaluate('() => window.__rec'); seen = {k for k, v in seen_px.items() if v > 100}
    check('B: animación hurt al perder vida', 'hurt' in seen, seen)
    pg.wait_for_timeout(500); clean_scene(pg); pg.wait_for_timeout(300)
    _r = grab(pg); check('B: hurt termina y vuelve a idle', _r.get('anim') == 'idle', {k: _r.get(k) for k in ('feet', 'anim', 'anim_px')})

    # invulnerabilidad (parpadeo del motor sobre el sprite)
    clean_scene(pg); pg.evaluate('() => { window.__engine.player.invuln = 5; }')
    cnt = [analyze(shot(pg)).get('anim_px', {}).get('idle', 0) for _ in range(30)]
    check('B: parpadeo de invulnerabilidad sigue aplicándose al sprite', min(cnt) < 10 and max(cnt) > 100, f'min={min(cnt)} max={max(cnt)}')
    pg.evaluate('() => { window.__engine.player.invuln = 0; }')

    # proyectiles
    # Tras caminar/rodar a la derecha el jugador puede estar pegado al muro: volver hacia el lado libre y disparar hacia allí.
    clean_scene(pg); pg.keyboard.down('KeyA'); pg.wait_for_timeout(800); pg.keyboard.up('KeyA'); pg.wait_for_timeout(150); set_facing(pg, -1, 0)
    # Las balas viven ~0,3 s: se observan dentro de la página en cada frame (el muestreo desde Python las pierde).
    pg.evaluate("""([col]) => {
        const e = window.__engine, ctx = document.querySelector('canvas').getContext('2d'), t0 = performance.now();
        window.__proj = new Promise(res => {
            const keys = new Set(); let px = 0;
            (function f() {
                for (const p of e.projectiles) if (p.owner === 'player') keys.add(String(p.sprite));
                const d = ctx.getImageData(0, 300, 1280, 150).data;
                let n = 0;
                for (let i = 0; i < d.length; i += 4) if (d[i] === col[0] && d[i+1] === col[1] && d[i+2] === col[2]) n++;
                px = Math.max(px, n);
                performance.now() - t0 < 1300 ? requestAnimationFrame(f) : res({ keys: [...keys], px });
            })();
        });
    }""", [PROJ_COL])
    pg.mouse.move(W / 2 - 250, H / 2); pg.mouse.down(); pg.wait_for_timeout(1350); pg.mouse.up()
    pr = pg.evaluate('() => window.__proj'); proj, best = pr['keys'], pr['px']
    check('B: proyectiles del jugador llevan la clave de sprite del arma', len(proj) > 0 and set(proj) == {'iron_python'}, proj)
    check('B: sprite de proyectil dibujado', best > 8, f'{best}px')

    # efectos
    pg.evaluate("() => { const e = window.__engine; window.__sprites.spawnEffect('explosion', e.player.x + 90, e.player.y - 40, e.worldTime); }")
    pg.wait_for_timeout(120); seen_fx = count(shot(pg), FX_COL) > 10
    pg.wait_for_timeout(700)
    gone = count(shot(pg), FX_COL) == 0
    check('B: efecto se reproduce una vez y desaparece', seen_fx and gone, f'visto={seen_fx} desaparecido={gone}')

    # muerte (se neutraliza endRun solo en la prueba para poder observar el estado)
    clean_scene(pg); pg.mouse.move(W / 2, H / 2 + 200)
    pg.evaluate("() => { const e = window.__engine; e.endRun = () => {}; e.player.hp = 0; }"); pg.wait_for_timeout(300)
    r = grab(pg)
    check('B: animación death con hp ≤ 0', r.get('anim') == 'death', r.get('anim_px'))

    fps = pg.evaluate("() => new Promise(r => { let n=0; const t0=performance.now(); const f=()=>{ n++; performance.now()-t0<2000 ? requestAnimationFrame(f) : r(n/2) }; f(); })")
    check('B: rendimiento comparable al fallback (≥70% de FPS)', fps >= 0.7 * ref['fps'], f"{fps:.1f} fps vs {ref['fps']:.1f} fps (fallback)")
    check('B: sin errores de consola/página/red', not logs['console'] and not logs['page'] and not logs['bad_requests'], logs)
    b.close()

# ───────────── MODO C: manifiestos rotos ─────────────
def mode_c(pw):
    print('\n== MODO C · manifiestos rotos: fallback sin errores ==')
    broken = json.load(open(os.path.join(FIX, 'manifest.json')))
    broken['characters']['tariq']['clip'] = 'no/existe/{anim}_{dir}.png'
    broken['weapons']['iron_python']['image'] = 'weapons/falta.png'
    for name, kw in (('imágenes inexistentes', dict(manifest_override=broken, use_fixture=True)), ('respuesta no JSON', dict(garbage=True))):
        b, pg, logs = open_game(pw, **kw)
        st = pg.evaluate('() => window.__sprites.stats()')
        check(f'C: {name}: atlas sin personajes', st['characters'] == [], st['problems'][:2])
        start_run(pg); combat(pg); clean_scene(pg)
        a = shot(pg)
        check(f'C: {name}: partida arranca y se dibuja el fallback', count(a, FEET) == 0 and pg.evaluate('() => window.__engine.running !== false'))
        check(f'C: {name}: sin excepciones de página', not logs['page'], logs['page'])
        b.close()
    # frames mal declarados (anchura no divisible) -> recurso descartado con aviso
    bad = json.load(open(os.path.join(FIX, 'manifest.json')))
    bad['characters']['tariq']['animations']['idle']['frames'] = 3
    b, pg, logs = open_game(pw, manifest_override=bad, use_fixture=True)
    st = pg.evaluate('() => window.__sprites.stats()')
    check('C: frames no divisibles detectados y reportados', any('divisible' in p for p in st['problems']), st['problems'][:1])
    check('C: sin excepciones de página con frames inválidos', not logs['page'], logs['page'])
    b.close()

if __name__ == '__main__':
    srv = ensure_server()
    try:
        with sync_playwright() as pw:
            ref = mode_a(pw)
            mode_b(pw, ref)
            mode_c(pw)
    finally:
        if srv: srv.terminate()
    fails = [r for r in RES if not r[1]]
    print(f'\n{len(RES) - len(fails)}/{len(RES)} comprobaciones OK')
    sys.exit(1 if fails else 0)
