
# ☠️ Moros VS Gitanos 2030

> **Un roguelike de acción. Dos bandos. Una ciudad en guerra. Ninguna partida sale igual.**

**Moros VS Gitanos 2030** es un roguelike de acción desarrollado para navegador, ambientado en una versión absurda y distópica de un futuro cercano.

Entra en combate, explora salas generadas proceduralmente, consigue armas y objetos, derrota enemigos, mejora tu personaje y decide hasta dónde estás dispuesto a llegar antes de perderlo todo.

---

## 🎮 ¿Qué encontrarás?

🗡️ **Combate rápido**

Enfréntate a enemigos cuerpo a cuerpo y a distancia utilizando diferentes armas y habilidades.

💨 **Movimiento y esquivas**

Muévete por el escenario con libertad y utiliza el dash para esquivar ataques y reposicionarte durante los combates.

🧟 **Enemigos diferentes**

Cada enemigo tiene su propio comportamiento, estadísticas y función dentro del combate.

👑 **Jefes**

Al final de determinados recorridos te esperan enemigos especiales con varias fases y patrones de combate propios.

🗺️ **Mapas procedurales**

Cada partida genera una distribución diferente de salas, enemigos, eventos y recompensas.

🎁 **Loot y recompensas**

Explora las salas, derrota enemigos y encuentra cofres, armas, objetos y mejoras que cambian tu partida.

⬆️ **Progresión durante la partida**

Cada nivel te permite escoger nuevas habilidades y construir una combinación diferente para tu personaje.

🧩 **Builds diferentes**

Las decisiones que tomas durante una partida determinan cómo evoluciona tu personaje y qué estrategia puedes utilizar.

---

## ⚔️ Una partida

```text
        🏚️
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

Cada partida sigue su propio camino.

**Explora → combate → consigue recompensas → mejora tu personaje → sobrevive → derrota al jefe.**

Pero morir significa volver a empezar.

---

## 🧠 Diseñado para que cada partida sea diferente

El contenido del juego está construido de forma modular y orientada a datos.

Armas, enemigos, habilidades, personajes, mascotas, biomas, eventos, jefes y demás elementos del juego están definidos de forma independiente para poder ampliar el contenido sin tener que rehacer el núcleo del juego.

Esto permite que el juego pueda crecer progresivamente con:

* ⚔️ Nuevas armas
* 👹 Nuevos enemigos
* 👑 Nuevos jefes
* 🧙 Nuevos personajes
* ✨ Nuevas habilidades
* 🐾 Nuevas mascotas
* 🌍 Nuevos biomas
* 🎲 Nuevos eventos
* 💎 Nuevos objetos y reliquias

---

## 🎨 Estilo

El juego utiliza una estética **pixel art / voxel**, con una cámara cenital en perspectiva diagonal inspirada en los clásicos juegos de acción y aventura.

La intención es combinar:

**🕹️ estética retro + ⚔️ combate arcade + 🎲 estructura roguelike**

en una experiencia sencilla de entender pero con suficiente profundidad para que cada partida pueda jugarse de una manera diferente.

---

## 🛠️ Tecnología

El proyecto está desarrollado como un **monorepo** y actualmente está orientado a funcionar directamente en navegador.

### Frontend

* TypeScript
* React
* Vite
* Canvas
* Motor de juego propio

### Arquitectura

El juego separa el **motor** de la lógica específica del videojuego:

```text
src/
├── engine/       → Sistemas reutilizables del motor
├── game/         → Lógica y sistemas del juego
├── content/      → Contenido del juego
└── App.tsx       → Interfaz y pantallas
```

El objetivo es mantener una separación clara entre la infraestructura reutilizable y la lógica específica de **Moros VS Gitanos 2030**.

---

## 🚧 Estado del proyecto

🟢 **Jugable**

El proyecto ya cuenta con el núcleo necesario para ejecutar partidas completas y continúa en desarrollo.

Actualmente se trabaja principalmente en:

* ⚔️ Combate y balance
* 👹 Enemigos
* 🗺️ Generación procedural
* 🎁 Loot
* ✨ Habilidades
* 👑 Jefes
* 🎨 Arte y animaciones
* 🎵 Audio y música
* 🧩 Contenido adicional

El proyecto está en evolución constante, por lo que algunas partes pueden cambiar considerablemente durante el desarrollo.

---

## 🚀 Ejecutarlo

Clona el repositorio e instala las dependencias:

```bash
npm install
```

Inicia el servidor de desarrollo:

```bash
npm run dev
```

Y abre la dirección indicada por Vite en el navegador.

---

## 📸 Capturas

> Próximamente: capturas de gameplay, enemigos, bosses, armas y diferentes biomas.

---

## ❤️ Proyecto

**Moros VS Gitanos 2030** es un proyecto independiente desarrollado con la intención de experimentar con diseño de videojuegos, arquitectura de motores, generación procedural y desarrollo de un roguelike desde cero.

No busca ser un clon de otro juego.

Busca convertirse en **su propio caos**.

---

### ☠️ Entra. Lucha. Mejora. Muere. Repite.

**Moros VS Gitanos 2030**
