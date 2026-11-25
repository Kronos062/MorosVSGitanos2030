"""E2E de las correcciones de jugabilidad (Playwright). Ejecutar: python3 tests/e2e/gameplay_fixes_e2e.py
Arranca `vite preview` si no hay servidor en :4173 (haz `npm run build` antes)."""
import os, subprocess, sys, time, urllib.request
from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
URL = 'http://localhost:4173/?spritedebug'
RES = []
def check(name, ok, detail=''):
    RES.append(bool(ok)); print(('PASS' if ok else 'FAIL'), '-', name, ('· ' + str(detail)) if detail != '' else '')

def ensure_server():
    try: urllib.request.urlopen('http://localhost:4173/', timeout=1); return None
    except Exception: pass
    proc = subprocess.Popen(['npx', 'vite', 'preview', '--port', '4173', '--strictPort'], cwd=ROOT,
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
    for _ in range(40):
        time.sleep(0.5)
        try: urllib.request.urlopen('http://localhost:4173/', timeout=1); return proc
        except Exception: pass
    raise RuntimeError('no arranca vite preview')

def main():
    proc = ensure_server()
    try:
        with sync_playwright() as p:
            b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1280, 'height': 720})
            logs = {'console': [], 'page': []}
            pg.on('console', lambda m: logs['console'].append(m.text) if m.type == 'error' else None)
            pg.on('pageerror', lambda e: logs['page'].append(str(e)))
            pg.goto(URL); pg.wait_for_timeout(500)
            pg.get_by_role('button').filter(has_text='MOROS').first.click(); pg.wait_for_timeout(250)
            if pg.get_by_role('button', name='ENTENDIDO').count(): pg.get_by_role('button', name='ENTENDIDO').click(); pg.wait_for_timeout(150)
            pg.get_by_role('button').filter(has_text='JUGAR').first.click(); pg.wait_for_timeout(300)
            pg.get_by_role('button', name='COMBATIR').click(); pg.wait_for_timeout(900)
            # Escena limpia (sin enemigos que molesten) y jugador inmortal
            pg.evaluate("""() => { const e = window.__engine;
                const sweep = () => { e.enemies.length = 0; for (let i = e.projectiles.length - 1; i >= 0; i--) if (e.projectiles[i].owner === 'enemy') e.projectiles.splice(i, 1); e.player.hp = e.player.maxHp; };
                sweep(); window.__sw = setInterval(sweep, 20); }""")

            # --- Ráfagas con retardo real (chrono_disruptor: count 2, burst 3)
            r = pg.evaluate("""async () => { const e = window.__engine; const p = e.player;
                e.projectiles.length = 0; p.weaponId = 'chrono_disruptor'; p.fireCooldown = 0; p.countBonus = 0;
                e.fireWeapon(p, 1, 0);
                const n0 = e.projectiles.filter(x => x.owner === 'player').length, pend0 = e.pendingVolleys.length;
                await new Promise(r => setTimeout(r, 400));
                return { n0, pend0, pendAfter: e.pendingVolleys.length, n1: e.projectiles.filter(x => x.owner === 'player').length }; }""")
            check('Ráfaga: solo sale la 1ª tanda al disparar', r['n0'] == 2 and r['pend0'] == 2, r)
            check('Ráfaga: el resto sale con retardo', r['pendAfter'] == 0 and r['n1'] >= 6, r)

            # --- Rebotes
            r = pg.evaluate("""async () => { const e = window.__engine; const w = e.getAccessibleWalkables()[0];
                const mk = (x, vx) => ({ id: 99000 + x, x, y: w.y + w.h / 2, vx, vy: 0, damage: 1, color: '#fff', size: 4, pierce: 0, pierced: new Set(), life: 3, owner: 'player', sprite: 'x', _bounceCount: 1 });
                e.projectiles.length = 0;
                const away = mk(w.x + 20, 120), toward = mk(w.x + 70, -300);
                e.projectiles.push(away, toward);
                await new Promise(r => setTimeout(r, 450));
                return { awayVx: away.vx, awayCount: away._bounceCount, towardVx: toward.vx, towardCount: toward._bounceCount, towardAlive: e.projectiles.includes(toward) }; }""")
            check('Rebote: un disparo que se aleja del muro no gasta rebotes', r['awayVx'] > 0 and r['awayCount'] == 1, r)
            check('Rebote: bounceCount 1 rebota una vez y sigue vivo', r['towardVx'] > 0 and r['towardCount'] == 0 and r['towardAlive'], r)

            # --- Dash estando parado: se desplaza hacia donde mira
            r = pg.evaluate("""async () => { const e = window.__engine; const p = e.player; e.projectiles.length = 0;
                p.facingX = 1; p.facingY = 0; p.dashCooldown = 0; p.isDashing = false;
                const x0 = p.x; window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ShiftLeft' }));
                await new Promise(r => setTimeout(r, 60)); window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ShiftLeft' }));
                await new Promise(r => setTimeout(r, 300)); return { dx: p.x - x0 }; }""")
            check('Dash parado avanza hacia donde mira', abs(r['dx']) > 40, r)

            # --- Entrada: repetición, blur, pausa
            r = pg.evaluate("""() => { const e = window.__engine; e.running = false; // congela update para poder leer los sets
                e.pressedKeys.clear();
                window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', repeat: true }));
                const afterRepeat = e.pressedKeys.has('KeyE');
                window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', repeat: false }));
                const afterPress = e.pressedKeys.has('KeyE');
                window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' }));
                const held = e.keys.has('KeyD');
                window.dispatchEvent(new Event('blur'));
                const out = { afterRepeat, afterPress, held, keysAfterBlur: e.keys.size, pressedAfterBlur: e.pressedKeys.size };
                e.running = true; return out; }""")
            check('Entrada: e.repeat no cuenta como pulsación nueva', r['afterRepeat'] is False and r['afterPress'] is True, r)
            check('Entrada: blur suelta todas las teclas', r['held'] is True and r['keysAfterBlur'] == 0 and r['pressedAfterBlur'] == 0, r)
            r = pg.evaluate("""async () => { const e = window.__engine; e.pause(); window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }));
                await new Promise(r => setTimeout(r, 120)); const left = e.pressedKeys.size; e.resume(); return { left }; }""")
            check('Entrada: pulsaciones hechas en pausa no se acumulan', r['left'] == 0, r)

            # --- Reliquias no caducan; cofres de evento reales
            r = pg.evaluate("""() => { const e = window.__engine; e.pickups.length = 0; e.chests.length = 0;
                e.spawnPickup(e.player.x + 400, e.player.y + 400, 'relic', '#fff', 1);
                const life = e.pickups[0] ? e.pickups[0].life : null;
                e.spawnChest('chest_legendary', e.player.x + 300, e.player.y + 300, e.currentRoomId);
                e.spawnChest('chest_rare', e.player.x - 300, e.player.y - 300, e.currentRoomId);
                return { life: String(life), ids: e.chests.map(c => c.defId) }; }""")
            check('Reliquia: vida infinita', r['life'] == 'Infinity', r)
            check('Cofres alias resuelven a cofre real', r['ids'] == ['chest_boss', 'chest_armory'], r)

            # --- Bombardero: cuenta como baja
            r = pg.evaluate("""async () => { const e = window.__engine; clearInterval(window.__sw);
                e.enemies.length = 0; const k0 = e.kills;
                e.spawnEnemyInRoom({ id: 'bomber', name: 'Bombardero', hp: 160, speed: 70, damage: 29, size: 18, color: '#ffe14a', glow: '#ff8800', shape: 'circle_pulse', score: 35, xp: 30, aiProfile: 'bomber_rush', attackRange: 50, attackCooldown: 1.6, explosionRadius: 60, tags: ['melee'], lore: '', threat: 2, cost: 3, role: 'burst' }, false);
                const en = e.enemies[0]; en.x = e.player.x + 25; en.y = e.player.y; e.player.invuln = 5;
                await new Promise(r => setTimeout(r, 300));
                return { dk: e.kills - k0, alive: e.enemies.length }; }""")
            check('Bombardero: su explosión cuenta como baja', r['dk'] == 1 and r['alive'] == 0, r)


            # --- Selector de objetos: HUD y pausa siguen funcionando tras elegir / cancelar / Escape
            pg.evaluate("""() => { const e = window.__engine; e.pickups.length = 0; e.chests.length = 0; const p = e.player; p.invuln = 0;
                e.spawnPickup(p.x + 10, p.y, 'weapon', '#fff', 0, 'bat'); e.spawnPickup(p.x - 10, p.y, 'weapon', '#fff', 0, 'axe_heavy'); }""")
            pg.wait_for_timeout(150); pg.keyboard.press('KeyE'); pg.wait_for_timeout(350)
            check('Selector: aparece con 2 objetos juntos', pg.get_by_text('OBJETOS EN EL SUELO').count() == 1)
            pg.locator('button.menu-btn').filter(has_text='Bate').first.click(); pg.wait_for_timeout(400)
            check('Selector: tras elegir vuelve el HUD y se equipa el arma', pg.locator('.hud').count() == 1 and pg.evaluate("() => window.__engine.player.weaponId") == 'bat')
            pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
            check('Selector: Escape pausa el juego después de elegir', pg.evaluate("() => window.__engine.running") is False)
            pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
            pg.evaluate("() => { const e = window.__engine; const p = e.player; e.pickups.length = 0; e.spawnPickup(p.x + 10, p.y, 'weapon', '#fff', 0, 'bat'); e.spawnPickup(p.x - 10, p.y, 'weapon', '#fff', 0, 'axe_heavy'); }")
            pg.wait_for_timeout(150); pg.keyboard.press('KeyE'); pg.wait_for_timeout(350)
            pg.keyboard.press('Escape'); pg.wait_for_timeout(350)
            check('Selector: Escape lo cancela y vuelve el HUD', pg.get_by_text('OBJETOS EN EL SUELO').count() == 0 and pg.locator('.hud').count() == 1 and pg.evaluate("() => window.__engine.running") is True)
            pg.evaluate("() => { window.__engine.pickups.length = 0; }")

            # --- Casi-muerte: cuenta una vez al cruzar el umbral, no en cada golpe
            r = pg.evaluate("""() => { const e = window.__engine; const p = e.player; clearInterval(window.__sw);
                const nd = () => e.enemyDirector.getTelemetrySnapshot().nearDeathCount; const n0 = nd();
                p.armor = 0; p.shield = 0; p.invuln = 0; p.hp = p.maxHp * 0.3; e.damagePlayer(p.maxHp * 0.1); const afterCross = nd();
                p.invuln = 0; e.damagePlayer(2); p.invuln = 0; e.damagePlayer(2); const afterMore = nd();
                p.hp = p.maxHp; p.invuln = 0; return { n0, afterCross, afterMore }; }""")
            check('Casi-muerte: +1 al cruzar y sin más por golpes siguientes', r['afterCross'] == r['n0'] + 1 and r['afterMore'] == r['afterCross'], r)

            # --- Intocable: el escudo absorbe sin fallar el desafío; perder vida sí lo falla
            r = pg.evaluate("""() => { const e = window.__engine; const p = e.player; e.currentEvent = { combatRules: { noDamage: true } }; e.challengeFailed = false;
                p.armor = 0; p.shield = 1; p.invuln = 0; e.damagePlayer(10); const afterShield = e.challengeFailed; p.invuln = 0; e.damagePlayer(5); const afterHp = e.challengeFailed;
                e.currentEvent = null; e.challengeFailed = false; p.hp = p.maxHp; p.invuln = 0; return { afterShield, afterHp }; }""")
            check('Intocable: escudo no falla, perder vida sí', r['afterShield'] is False and r['afterHp'] is True, r)

            # --- Mascotas no pisan efectos más fuertes del arma
            r = pg.evaluate("""() => { const e = window.__engine; const p = e.player; e.enemies.length = 0;
                e.getEquippedPetDef = () => ({ id: 'test', color: '#fff', stats: { orbitRadius: 0, orbitSpeed: 0, size: 1 }, effects: [
                  { kind: 'apply_status', key: 'fire', value: 3, radius: 900, interval: 0.1 }, { kind: 'slow_aura', radius: 900, interval: 0.1 } ] });
                e.pet = { x: p.x, y: p.y, angle: 0, timers: { apply_statusfire: 0, slow_aura: 0 } };
                e.spawnEnemyInRoom({ id: 'x', name: 'x', hp: 99999, speed: 0, damage: 0, size: 10, color: '#fff', glow: '#fff', shape: 'circle_pulse', score: 1, xp: 1, aiProfile: 'chaser', attackRange: 10, attackCooldown: 9, tags: [], lore: '', threat: 1, cost: 1, role: 'swarm' }, false);
                const en = e.enemies[0]; en.burnDps = 500; en.burnTimer = 10; en.slowTimer = 9;
                e.updatePet(0.2); e.updatePet(0.2);
                const out = { burnDps: en.burnDps, burnTimer: en.burnTimer, slow: en.slowTimer }; e.enemies.length = 0; e.pet = null; delete e.getEquippedPetDef; return out; }""")
            check('Mascota: no reduce quemado ni ralentización más fuertes', r['burnDps'] >= 500 and r['burnTimer'] >= 9 and r['slow'] >= 8, r)

            # --- Crítico: la marca es el flag, no el color (arma amarilla crítica ≠ disparo normal)
            r = pg.evaluate("""() => { const e = window.__engine; const p = e.player; e.projectiles.length = 0; p.weaponId = 'rattler45'; p.critChance = 1; p.fireCooldown = 0; p.countBonus = 0;
                e.fireWeapon(p, 1, 0); const crit = e.projectiles.filter(q => q.owner === 'player'); p.critChance = 0; e.projectiles.length = 0; e.fireWeapon(p, 1, 0);
                const normal = e.projectiles.filter(q => q.owner === 'player'); p.critChance = 0.05; e.projectiles.length = 0;
                return { critFlag: crit.every(q => q._isCrit), critColor: crit[0].color, normalFlag: normal.some(q => q._isCrit), normalColor: normal[0].color }; }""")
            check('Crítico: color distinto al normal en armas amarillas', r['critFlag'] and not r['normalFlag'] and r['critColor'] != r['normalColor'], r)

            # --- Mapa determinista: regenerar el mapa tras consumir el flujo aleatorio da el mismo resultado
            r = pg.evaluate("""() => { const e = window.__engine; const sig = () => JSON.stringify(e.rooms.map(q => [q.kind, q.bounds.x, q.bounds.y, q.bounds.w, q.bounds.h, q.eventId ?? null]));
                e.newMapLayout(); const a = sig(); const rng = e.seededRandom('map'); for (let i = 0; i < 25; i++) rng();
                e.newMapLayout(); const b = sig(); return { same: a === b, rooms: e.rooms.length }; }""")
            check('Mapa: misma semilla/mapa → mismo diseño aunque se haya consumido el RNG', r['same'], r)

            # --- Puntuación Endless: el multiplicador no se compone ni se pierde
            r = pg.evaluate("""() => { const e = window.__engine; const st = e.runDirector.getAscensionState(); st.scoreMult = 2;
                e.score = 100; e.endRun('victory', true); const first = e.score;
                e.continueEndless(); e.score += 50; e.endRun('victory', true); return { first, second: e.score }; }""")
            check('Endless: ×2 sobre lo ganado en cada final (100→200, +50→+100)', r['first'] == 200 and r['second'] == 300, r)

            check('Sin errores de consola ni de página', not logs['console'] and not logs['page'], logs)
            b.close()
    finally:
        if proc: proc.terminate()
    ok = sum(RES); print(f'\n{ok}/{len(RES)} comprobaciones OK'); sys.exit(0 if ok == len(RES) else 1)

if __name__ == '__main__': main()
