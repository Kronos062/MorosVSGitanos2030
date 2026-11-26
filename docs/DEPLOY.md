# Despliegue a producción

## GitHub Pages

Las pull requests a `main` ejecutan la comprobación de tipos, las pruebas unitarias y el build con Node 22. Un push a `main` compila y publica `dist/` mediante el entorno `github-pages`.

Después de publicar, el workflow compara el HTML y el manifiesto públicos con sus sumas SHA-256 de compilación y comprueba que se sirven un sprite y un sonido desde la ruta del juego.

En la configuración de Pages del repositorio, selecciona **GitHub Actions** como origen de publicación. Para repetir el despliegue, ejecuta el workflow **Build and deploy GitHub Pages** sobre `main`.

## Opción A · Subir el sitio ya construido (recomendada)
`MorosVSGitanos2030-produccion.zip` contiene el sitio listo: descomprímelo y sube **todo su contenido** (`index.html` + carpeta `assets/`) a cualquier hosting estático (Netlify, Vercel, GitHub Pages, Cloudflare Pages, itch.io HTML5, un Nginx/Apache…). Funciona tanto en la raíz del dominio como en una subcarpeta (las rutas son relativas).

Requisitos: servirlo por HTTP(S). Abrir `index.html` con doble clic (`file://`) arranca el juego, pero el navegador bloquea la carga de música, sonidos y sprites.

Recomendado en el servidor:
- Caché larga para `assets/music/*`, `assets/sounds/*` y `assets/sprites/*.png`.
- **Sin** caché larga para `index.html` ni `assets/sprites/manifest.json` (así los sprites nuevos se ven al desplegar).

## Opción B · Construir desde el proyecto
```
npm ci
npm run build        # genera dist/
npm run preview      # prueba local en http://localhost:4173
```
Node 22 recomendado. En Netlify/Vercel: comando `npm run build`, carpeta de salida `dist`.

## Comprobaciones antes de publicar
```
npm run test:unit
python3 tests/e2e/sprites_e2e.py                       # requiere playwright, numpy, pillow
python3 tests/e2e/prod_smoke.py https://tu-dominio/    # smoke test contra el sitio publicado
```

## Notas
- El juego guarda el progreso en el navegador del jugador (localStorage). No hay backend.
- Con `?spritedebug` en la URL se exponen `window.__engine` y `window.__sprites` (herramientas de prueba). No afectan al juego sin ese parámetro.
- Los sprites se declaran en `assets/sprites/manifest.json`. El build copia el manifiesto y sus recursos desde `public/assets`.
