Guía paso a paso para ejecutarlo en tu localhost:

Requisitos previos: Node.js (v18 o superior) y PostgreSQL corriendo localmente.
Pasos detallados:
Instalar dependencias: npm install
Configurar la base de datos en .env:
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/app_db"
Crear la base de datos local si no existe (ej. createdb app_db o mediante tu cliente PG).
Aplicar el esquema de base de datos con Drizzle:
npx drizzle-kit push
Ejecutar el servidor de desarrollo:
npm run dev
Abrir en el navegador:
http://localhost:3000
Ejecutar los tests en cualquier momento:
npm test


Se han creado los siguientes directorios públicos para que puedas colocar tus propios archivos de imagen (PNG, JPG, SVG) y utilizarlos directamente en el juego:

text

public/
└── assets/
    ├── sprites/    ← (Sprites de personajes, enemigos, armas)
    ├── textures/   ← (Texturas de asfalto, hormigón, muros, grafitis)
    └── maps/       ← (Imágenes de mapas, intersecciones y layouts)
Paso a paso para colocarlos y verlos visualmente:
Colocar archivos de imagen:

Guarda tus imágenes en la carpeta correspondiente. Por ejemplo, pon una imagen tariq.png dentro de public/assets/sprites/tariq.png o asphalt_dark.png en public/assets/textures/asphalt_dark.png.
Ruta accesible de red:

Cualquier archivo colocado en public/assets/sprites/mi_sprite.png queda automáticamente accesible en el navegador en la URL relativa /assets/sprites/mi_sprite.png.