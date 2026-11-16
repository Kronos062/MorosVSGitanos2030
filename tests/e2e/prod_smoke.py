"""Smoke test del build de producción servido como sitio estático.
Uso: python3 tests/e2e/prod_smoke.py <URL_BASE>   (p. ej. http://localhost:8081/  o  http://localhost:8081/mvg/)
Comprueba: el juego arranca, no hay errores de consola/página ni peticiones 4xx/5xx, y los audios y el manifiesto de sprites cargan."""
import sys
from playwright.sync_api import sync_playwright
base = sys.argv[1]
bad, ok_assets, errs = [], [], []
with sync_playwright() as pw:
    b = pw.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    pg = b.new_page(viewport={'width': 1280, 'height': 720})
    pg.on('response', lambda r: (bad.append(f'{r.status} {r.url}') if r.status >= 400 and 'favicon' not in r.url else ok_assets.append(r.url) if '/assets/' in r.url else None))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(base); pg.wait_for_timeout(800)
    pg.get_by_role('button').filter(has_text='MOROS').first.click(); pg.wait_for_timeout(300)
    if pg.get_by_role('button', name='ENTENDIDO').count(): pg.get_by_role('button', name='ENTENDIDO').click(); pg.wait_for_timeout(300)
    pg.get_by_role('button').filter(has_text='JUGAR').first.click(); pg.wait_for_timeout(400)
    pg.get_by_role('button', name='COMBATIR').click(); pg.wait_for_timeout(1500)
    px = pg.evaluate("() => { const c = document.querySelector('canvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 400) if (d[i] + d[i+1] + d[i+2] > 60) n++; return n; }")
    b.close()
sounds = [u for u in ok_assets if '/sounds/' in u or '/music/' in u]
manifest = [u for u in ok_assets if 'sprites/manifest.json' in u]
print('peticiones /assets OK:', len(ok_assets), '| audio:', len(sounds), '| manifest sprites:', len(manifest), '| píxeles de juego en canvas:', px)
print('errores:', errs, '| 4xx/5xx:', bad)
fail = bool(bad or errs or not manifest or px < 50)
print('RESULTADO:', 'FALLO' if fail else 'OK'); sys.exit(1 if fail else 0)
