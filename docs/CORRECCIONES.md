# Correcciones (revisión de errores)

## Restaurado / arreglado respecto a la versión "corregido_final"
- `audio.ts`: restaurado el `AudioManager` (`audio.play/setVolume/resume`, volumen de efectos, `BASE_URL`) y mejorado con pool de elementos `<audio>` (5 por sonido) y mínimo de 35 ms entre repeticiones.
- Errores de compilación: `lastPushTime`, `combatActive`, `skillChoiceActive`, `presentSkillChoice`, `opts` const, campos sin uso de `RunDirector`.
- El HUD se refresca ~12 veces/s (no 60) y las transiciones (`pause`, skills, Endless) fuerzan un refresco inmediato.
- No se incorporó el cambio de `hasAim` (desactivaba el autoapuntado en escritorio al mover el ratón).

## Motor
- Ráfagas (`burstCount`) con retardo real de 70 ms entre disparos.
- Rebotes: solo rebota hacia la pared; `bounceCount: N` = N rebotes reales.
- Dash estando parado: sale hacia donde mira el personaje.
- Teclas: sin repetición automática, se sueltan al perder el foco y las pulsaciones en pausa se descartan.
- Acumulador del bucle con tope (sin aceleración tras lag).
- Bombarderos que explotan cuentan como baja (XP, puntuación, bestiario, botín).
- Puntuación Endless: el multiplicador se aplica a lo ganado desde el último final.
- Reliquias sin caducidad (el escudo sin `maxShield` se mantiene a propósito).
- Jefes escalan con el mapa/ciclo igual que el resto de enemigos.
- Código muerto eliminado: `queuedLevelUps`, temporizadores de `RunDirector`.

## Directores y contenido
- `EnemyDirector.tick(dt)`: bajas, daño y casi-muertes decaen con el tiempo real; la intensidad se relaja con el tiempo.
- Memorias anti-repetición con `lastIndexOf` y pesos ≤ 1.
- Eventos: el barajado es Fisher–Yates con el RNG de la partida; los eventos que se convierten en combate devuelven sus contadores (`cancelEvent`).
- Cofres de eventos con IDs reales (`chest_boss`, `chest_armory`) y alias (`chest_legendary/rare/common`) en `getChest`.
- Cofres: probabilidad de arma 40 % (calle), 70 % (armería), 100 % (jefe).
- Textos corregidos (pactos de vida, Marabunta). `scaleMods`: los penalizadores no escalan con la calidad (en ambos tipos de op).
- Semilla: escribir en el campo el número que muestra la pausa reproduce la misma partida.

## Guardado, música y UI
- `writeSave` sin excepciones; importación validada (`{}`/`123` ya no borran el progreso); datos saneados.
- Bajas del bestiario por lotes (1 escritura cada 1,5 s y al terminar la partida).
- Teclas duplicadas en Opciones se intercambian.
- Crossfade interrumpido ya no deja pistas sonando.

## Tests
- `npm run test:unit` (incluye `tests/unit/fixes.test.ts`), `npm run test:e2e` (sprites + `gameplay_fixes_e2e.py`).

## Segunda ronda de correcciones
- **Selector de objetos (`App.tsx`)**: al elegir o cancelar se vuelve a `playing` (antes se perdía el HUD y Escape/Build/Mapa dejaban de funcionar). Escape cancela el selector.
- **Semilla por mapa**: cada mapa se genera con `reseed('map', 'layout:ciclo:mapa')` y cada evento con `reseed('event', 'room:ciclo:mapa:sala')`. Misma semilla = mismos mapas y eventos, hayas visitado lo que hayas visitado.
- **Críticos**: la marca visual usa el flag `_isCrit` (antes el color `#ffe14a`, que hacía "crítico" cada disparo de armas legendarias). Si el arma ya es amarilla, el crítico sale en blanco cálido.
- **Mascotas**: `slow_aura` y `apply_status` nunca sustituyen un efecto más fuerte del arma (usan el máximo). `auto_fire` escala con el mapa efectivo (Endless incluido) y con la mitad de tu bonus de daño.
- **Casi-muerte**: se cuenta una vez al cruzar el 25 % de vida, no en cada golpe.
- **Habilidades**: elección ponderada por rareza (60/32/16/7/2,5) que favorece las raras al avanzar de mapa; las raras/épicas/legendarias ya adquiridas no se ofrecen de nuevo; las comunes/poco comunes se pueden acumular pero pesan la mitad por copia.
- **Desafío Intocable**: el escudo absorbe golpes sin fallar el desafío; perder vida sí lo falla.
