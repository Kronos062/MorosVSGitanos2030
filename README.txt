# ☠️ Moros VS Gitanos 2030

> **Un roguelike de acción. Dos bandos. Una ciudad en guerra. Ninguna partida sale igual.**

**Moros VS Gitanos 2030** es un roguelike de acción desarrollado para navegador, ambientado en una versión absurda y distópica de un futuro cercano.

Entra en combate, explora salas generadas proceduralmente, consigue armas y objetos, derrota enemigos, mejora tu personaje y decide hasta dónde estás dispuesto a llegar antes de perderlo todo.

---

## 🎮 Características

### 🗡️ Combate

Enfréntate a enemigos cuerpo a cuerpo y a distancia utilizando diferentes armas, habilidades y estilos de juego.

### 💨 Movimiento

Muévete por el escenario con libertad y utiliza el dash para esquivar ataques y reposicionarte durante los combates.

### 👹 Enemigos

Cada enemigo cuenta con estadísticas y comportamientos diferentes, desde enemigos básicos hasta unidades especializadas y amenazas mucho más peligrosas.

### 👑 Jefes

Enfréntate a enemigos especiales con patrones de combate propios y diferentes fases.

### 🗺️ Mapas procedurales

Cada partida genera una distribución diferente de salas, enemigos, eventos y recompensas.

### 🎁 Loot

Explora, combate y encuentra armas, objetos, cofres y mejoras que pueden cambiar completamente tu partida.

### ⬆️ Progresión

Sube de nivel durante la partida y elige nuevas habilidades para construir tu personaje.

### 🧩 Builds

Cada combinación de armas, habilidades y mejoras permite desarrollar una estrategia diferente.

---

## 🎮 Cómo se juega

```text
        🏚️ SALA
           │
      ┌────┴────┐
      │         │
     ⚔️        🎁
      │         │
      └────┬────┘
           │
          👹
           │
        👑 BOSS
           │
       💀 / 🏆
```

La estructura básica de una partida es sencilla:

**Explora → combate → consigue recompensas → mejora tu personaje → sobrevive → derrota al jefe.**

Pero morir significa volver a empezar.

---

## 🎲 Cada partida es diferente

El juego utiliza generación procedural para crear diferentes situaciones durante cada partida.

La combinación de:

* Salas
* Enemigos
* Armas
* Habilidades
* Objetos
* Eventos
* Biomas
* Jefes
* Mejoras

hace que las decisiones tomadas durante una partida puedan producir experiencias completamente diferentes.

---

## 🎨 Estilo

El juego combina una estética **pixel art / voxel** con una cámara cenital en perspectiva diagonal.

La intención es mezclar:

**🕹️ estética retro + ⚔️ acción arcade + 🎲 estructura roguelike**

en una experiencia rápida, caótica y rejugable.

---

## 🛠️ Tecnología

El proyecto está desarrollado como un monorepo utilizando tecnologías web.

**Frontend**

* TypeScript
* React
* Vite
* Canvas
* Motor de juego propio

**Arquitectura**

El proyecto separa el motor reutilizable de la lógica específica del videojuego:

```text
src/
├── engine/       → Sistemas reutilizables del motor
├── game/         → Lógica específica del juego
├── content/      → Contenido del juego
└── App.tsx       → Interfaz y pantallas
```

El objetivo es mantener una separación clara entre el motor y **Moros VS Gitanos 2030** para poder ampliar el proyecto sin convertir el código en un único bloque difícil de mantener.

---

## 🚧 Estado del proyecto

🟢 **Jugable — En desarrollo**

El núcleo del juego ya permite ejecutar partidas y actualmente el desarrollo continúa centrado en ampliar y pulir el contenido.

### Actualmente en desarrollo

* ⚔️ Combate y balance
* 👹 Enemigos
* 🗺️ Generación procedural
* 🎁 Loot
* ✨ Habilidades
* 👑 Jefes
* 🎨 Arte y animaciones
* 🎵 Música y efectos
* 🧩 Contenido adicional

---

## 🚀 Ejecutar el proyecto

Clona el repositorio:

```bash
git clone https://github.com/Kronos062/MorosVSGitanos2030.git
cd MorosVSGitanos2030
```

Instala las dependencias:

```bash
npm install
```

Inicia el servidor de desarrollo:

```bash
npm run dev
```

Después abre en el navegador la dirección proporcionada por Vite.

---

## 📸 Gameplay

> Las capturas y GIFs de gameplay se añadirán próximamente.

---

## ❤️ Sobre el proyecto

**Moros VS Gitanos 2030** es un proyecto independiente creado desde cero para experimentar con desarrollo de videojuegos, arquitectura de motores, generación procedural y diseño de un roguelike.

El objetivo no es simplemente crear otro roguelike.

El objetivo es crear un juego con **su propia identidad, su propio caos y su propia forma de jugarse**.

---

# ☠️ Entra. Lucha. Mejora. Muere. Repite.

**Moros VS Gitanos 2030**
