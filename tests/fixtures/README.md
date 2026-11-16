# Fixtures de prueba

Tiras SINTÉTICAS de diagnóstico (bloques de color con marcas detectables por píxel). **No son arte del juego.**
Solo las usa `tests/e2e/sprites_e2e.py` para verificar el pipeline. No se referencian desde `public/assets/sprites/manifest.json` ni entran en el build.

Regenerar: `python3 tests/fixtures/make_fixture_sprites.py` (requiere Pillow).
