Guía rápida — ejecutar en local con PowerShell

Requisito previo: tener Node.js instalado (versión 18 o superior). Compruébalo así:

powershell
node -v
npm -v

Si no te devuelve un número de versión, instala Node.js primero y vuelve a abrir PowerShell.

Pasos, desde la carpeta donde tengas el zip descomprimido (ajusta la ruta a la tuya):

powershell
# 1. Entra en la carpeta del proyecto
cd C:\ruta\a\tu\proyecto\roguelite

# 2. Instala las dependencias (solo hace falta la primera vez, o cuando cambien)
npm install

# 3. Arranca el servidor de desarrollo
npm run dev

Al ejecutar npm run dev, la terminal te mostrará algo como:

  ➜  Local:   http://localhost:5173/

Abre esa dirección en el navegador y ya tienes el juego corriendo. Los cambios que hagas en el código se recargan solos mientras el servidor esté activo (Ctrl + C en la terminal para pararlo).
