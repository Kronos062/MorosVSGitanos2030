# Moros VS Gitanos 2030 · Auditoría del avance

**26 de noviembre de 2026 · Compilación de revisión de la fase 4**

## Material revisado

- ZIP original de 767 entradas. SHA-256 `D771D67EB7BCADAE90782C2CB1A427B767E01824C49541F5216E15B4ADAA60F8`.
- Texto extraído del GDD de 205 páginas. Se consultaron las fichas de Bombeta, Pallico y Gitano MDLR y se contrastaron con el catálogo y la implementación de ultimates.
- Documentación de continuidad, fases 1 a 4, guía técnica de sprites y propuesta visual de los diez mundos. La nota de continuidad y la propuesta describen estados anteriores. La compilación actual ya presenta Ceuta con islas y puentes.
- Código y datos de personajes, motor, atlas, pruebas, equipo, armas, enemigos y mundos. El historial de chats no estuvo accesible desde esta sesión. Se utilizó la síntesis incluida en el ZIP.

## Registro de cambios

- **MDLR.** Se sustituyeron 25 tiras experimentales por seis tiras con 26 fotogramas procedentes del atlas local. La revisión visual previa a la integración cubrió los 26 fotogramas. Se usaron celdas de 32 × 32 con fondo transparente, a escala nativa y con el borde inferior de cada pose alineado. El frontal en marcha tiene poca variación. El perfil aporta un ciclo distinto. El espejado cubre el lado izquierdo y el motor selecciona la orientación cercana para las vistas intermedias. Daño y caída tienen una sola orientación. El dash usa la animación de reserva del motor.
- **LibreSprite.** La versión 1.1-dev abrió y exportó el editable de MDLR. El editable contiene un fotograma de 32 × 32 sin etiquetas. Los ciclos recuperados provienen del PNG de 256 × 256, con cortes por celda. Ambos originales están en `art/MDLR`.
- **Manifiesto.** Se añadió soporte para direcciones por animación. Las fichas, estadísticas, colisiones y lógica de juego no recibieron cambios.
- **Bombeta y Pallico.** Se revisaron las 50 tiras existentes y se confirmaron cuerpos incompletos, poses partidas y saltos. No se encontraron sus atlas aprobados en los materiales accesibles. Este corte conserva las tiras heredadas. El diseño de Bombeta corresponde a un niño.

## Comprobaciones ejecutadas

| Comprobación | Resultado |
| --- | --- |
| Dependencias fijadas del proyecto | `npm ci` instaló 94 paquetes |
| Tipos | `tsc --noEmit` pasó |
| Pruebas unitarias | `direction.test.ts` y `fixes.test.ts` pasaron |
| Producción | Vite compiló 61 módulos y generó `dist/index.html` |
| Revisión gráfica | 75 tiras originales examinadas y 6 tiras nuevas revisadas antes de integrarse |
| Chrome automatizado | Arranque en raíz y subcarpeta. Selección de ambas facciones, entrada a Ceuta, diez conjuntos cargados, seis tiras de MDLR y cero problemas del atlas |
| Interacción en Chrome | Bombeta y MDLR recorrieron más de 20 px con el teclado. Q consumió aproximadamente 25 de energía, activó la recarga y concedió tres cargas de escudo y tres cargas de dash respectivamente |

Las suites Python existentes y la revisión en juego de todas las orientaciones, transiciones de animación y sockets quedan pendientes. Las hojas de contacto documentan la revisión de fotogramas. La captura de partida verifica la presentación de MDLR en Ceuta.

## Estado de las fases

| Fase | Estado de este corte |
| --- | --- |
| 1 · Identidad | Arranque y selección de Moros y Gitanos verificados. Queda la revisión completa de identidad en partida y pantallas finales |
| 2 · Habilidades y balance | Activación de dos ultimates verificada. Queda el balance de los diez personajes, el consumo de las cargas, los efectos situacionales y la progresión de una partida completa |
| 3 · Pipeline | Carga en navegador y compilación verificadas. Queda la validación exhaustiva del catálogo y sus reservas |
| 4 · Personajes | MDLR corregido en el alcance del atlas disponible. Restan sus orientaciones y rodamiento, Bombeta, Pallico y el acabado de otros siete personajes |
| 5 · Armaduras | Catálogo de equipo existente. Queda su recorrido completo de obtención, equipamiento y visualización |
| 6 · Armas | 59 armas y 59 proyectiles en el sistema previo. Queda comprobar legibilidad, efectos y alineación con todas las poses |
| 7 · Enemigos y jefes | Datos y lógica existentes. Queda el arte final y la validación del combate |
| 8 · Diez mundos | Diez nombres en el motor y Ceuta renderizada en partida. Quedan los conjuntos visuales y la revisión de los otros nueve |
| 9 · Interfaz | Selección, inicio de partida y HUD comprobados en escritorio. Quedan móvil, flujo completo y pantallas finales |
| 10 · Publicación | Paquete estático de revisión disponible. La auditoría final y la publicación siguen pendientes |

El fuente incluye los recursos activos y los editables disponibles de MDLR. El respaldo incluye las tiras retiradas y el manifiesto previo. Para restaurar íntegramente el estado inicial se conserva el ZIP original.

## Continuación de la validación

- **Diez personajes en Chrome.** Se seleccionaron desde el menú, se compararon su vida y energía iniciales con la tabla esperada, se activaron las diez ultimates con Q y se verificaron el desplazamiento y el inicio de la recarga. Se midieron el coste de energía, la curación, el temporizador de sigilo y la recarga total de El Patriarca. En Khalid y MOHAB se inyectaron objetivos de prueba cercanos y lejanos en la llamada de activación para comprobar el alcance. Para Cría de Gitano y Gitana del Romero se comprobó la activación por sala. El daño adicional de la daga y la cantidad de botín siguen pendientes de pruebas específicas.
- **Consumo de cargas.** Cuatro llamadas controladas a la rutina de daño mostraron que Bombeta y Pallico absorben los tres primeros golpes y pierden vida en el cuarto. MDLR agotó las tres cargas de dash en la secuencia 3, 2, 1, 0 durante el bucle normal del juego. Falta verificar el impacto de daga al final de cada desplazamiento.
- **Catálogo estático de producción.** Se comprobaron rutas, cabeceras PNG y divisibilidad del ancho por el número declarado de fotogramas en 495 archivos, sin fallos. El total incluye 231 tiras de personajes, 84 recursos de equipamiento, 59 armas, 59 proyectiles, 25 efectos, 20 retratos o iconos y 17 objetos. Ceuta es el único mundo registrado en el manifiesto gráfico. El chequeo de dimensiones no certifica la calidad de cada pose.
- **Bloqueo artístico.** Las nuevas capturas en partida reproducen los recortes de Bombeta y Pallico. La restauración con fidelidad al diseño aprobado requiere los atlas completos o los editables de ambos personajes. Esta continuación amplía las evidencias sin cambiar los binarios ni los recursos activos.

## Revisión 2 · HUD, equipo y mundos

- **HUD.** El nombre del mundo usa el color claro de la interfaz. Energía y escudo definitivo tienen un fondo opaco. Ambas lecturas alcanzaron 7,98:1 de contraste en Chrome. A 390 px, los cuatro indicadores de habilidad quedaron dentro del ancho visible. La captura estrecha es de Chrome redimensionado. Quedan pendientes los controles táctiles y la superposición parcial del aviso de recogida con la fila de habilidades.
- **Cofre, casco y arma.** En Ceuta se abrió el cofre inicial con E y aparecieron curación y puntuación. Para hacer reproducible el resto del recorrido se colocaron un casco de Toxicólogo y una Scatter-Pump mediante el motor en modo depuración. E abrió el diálogo del casco, Equipar lo colocó en la ranura correspondiente y E intercambió el arma. Un clic produjo un proyectil de Scatter-Pump. Queda por comprobar el recorrido con botín aleatorio y los demás conjuntos.
- **Mapas.** Se invocó la misma transición que emplea el portal para avanzar del mapa 2 al 10 y se eligió una habilidad en el diálogo en cada transición. Los nueve mapas tenían el nombre esperado y generaron entre 7 y 12 salas y entre 6 y 14 pasillos en la ejecución. La prueba saltó los combates y la apertura de los portales. Los mapas 2 a 10 aún requieren su arte propio.
- **Producción.** La compilación de revisión 2 incorpora el nuevo HUD. Pasaron `tsc --noEmit`, ambas suites unitarias, la compilación de Vite y la prueba dirigida de navegador. Los ZIP de la revisión anterior quedan como respaldo.

## Revisión 3 · Bombeta, Pallico y MDLR

- **Arte.** Las nuevas hojas originales permitieron recuperar los cuerpos que faltaban. Se mapearon las celdas por personaje y clip, se reconstruyeron la transparencia y los contornos, y se corrigieron los restos de rejilla identificados en la revisión visual. Los tres personajes tienen ocho direcciones propias, cinco estados y 120 editables `.ase`. Pallico utiliza las cinco poses de caída presentes en su hoja. Se mantienen las proporciones infantiles de Bombeta.
- **Exportación.** LibreSprite 1.1-dev exportó 120 tiras y 568 fotogramas. Se compararon los píxeles visibles de cada tira exportada con el candidato revisado. Los colores y la transparencia coincidieron. La prueba gráfica verificó además las celdas de 32 × 32, el alfa binario y la presencia de píxeles en el borde inferior de cada fotograma.
- **Motor.** Se seleccionaron los tres personajes desde sus facciones en Chrome. En Ceuta se comprobaron las ocho orientaciones de reposo y el uso de las tiras de reposo, marcha, rodamiento y daño. Para la caída se usó el dibujado del atlas en la sesión de juego, con ocho orientaciones y comprobación de que la pose final se sostiene. La derrota normal sigue mostrando su pantalla inmediata.
- **Armas.** Las capturas iniciales mostraban las armas demasiado cerca de la cara. Se bajaron los agarres visuales de los tres personajes. La cadencia visual del rodamiento se ajustó a los 0,18 segundos del dash. Estas modificaciones sólo afectan al renderizado.
- **Entrega.** El directorio de trabajo contiene el fuente, editables y compilación actuales. Se incluyen paquetes de actualización sobre los ZIP iniciales para evitar duplicar archivos del juego. El respaldo de sprites previo a la reconstrucción contiene las tiras originales activas y su manifiesto.

## Revisión 4 · Equipamiento y reemplazo

- Se corrigió el icono del objeto devuelto al suelo tras equipar un reemplazo de otro conjunto. El intercambio reutiliza la entidad del hallazgo. Ahora invalida su clave gráfica almacenada en caché cuando se cambia el identificador de la pieza.
- En Ceuta se colocaron piezas de prueba de Toxicólogo mediante el motor y se recogieron desde la interfaz. Se comprobaron las cuatro ranuras, sus iconos específicos, los 20 puntos de vida de la pechera y la activación de los umbrales de 2, 3 y 4 piezas. Con un casco de Tanque se probó tanto conservar el anterior como equipar el reemplazo. Tras el intercambio quedaron activos los umbrales de 2 y 3 piezas y el casco de Toxicólogo volvió al suelo con su icono.
- Pasaron TypeScript, las dos suites unitarias, el build de Vite y la prueba `node audit/smoke.mjs --equipment`. El cambio de producción sustituye únicamente el HTML compilado de la revisión 3.

## Validación de combate, jefes y victoria

- Se ejecutó `node audit/smoke.mjs --combat` sobre la compilación de la revisión 4 en Chrome. Una sala de combate generó las tres oleadas y entregó su cofre al quedar despejada.
- En la sala de jefe de Ceuta se bajó la vida del jefe al 40 % y se observó la fase siguiente en el bucle del juego. El encuentro completo habilitó el cofre de jefe y el portal de descenso. Se usó E para llegar al mapa 2 y se eligió una habilidad en la interfaz.
- Se cargó el mapa 10 mediante depuración, se despejó su sala de jefe y se usó el portal final. La interfaz mostró **VICTORIA 2030**.
- La prueba coloca al jugador en las salas y registra las bajas con la rutina del motor. Quedan pendientes una partida completa con desplazamiento y combate manuales, los patrones de ataque y el balance de todo el catálogo. Los recursos visuales de enemigos y jefes siguen pendientes. Esta ampliación de pruebas usa el binario de producción de la revisión 4.

## Revisión 5 · HUD de combate

- La barra de jefe y el aviso de desafío se distribuyen debajo de los paneles superiores. La barra ya no cubre los datos de nivel y arma. La prueba en Chrome verificó la posición con las cajas de ambos elementos y comprobó que el HUD mostraba «Sismo» para la fase observada del Titán Bronce 2030.
- Se repitió la ruta de oleadas, descenso y victoria con la compilación nueva. También pasaron TypeScript y las dos suites unitarias. Se incluye el ZIP completo de producción de esta revisión.

## Revisión 6 · Enemigos del bando contrario

- Según las secciones 6.3, 6.10 y 6.15 del GDD, las apariciones se asignan al elenco de la facción opuesta. Los enemigos llevan el nombre, el sprite y el arma inicial del personaje rival. Los jefes usan un sprite ampliado del mismo elenco, incluidos los encuentros del último mapa.
- Los perfiles siguen determinando la conducta, el daño, la cadencia hostil, las fases y el botín. Los disparos hostiles usan el gráfico del arma del rival. El identificador del perfil permanece en el bestiario y las partidas guardadas. Los siete personajes pendientes de acabado reutilizan su arte existente.
- En Chrome se inició una partida por facción y se comprobó que aparecían y se dibujaban los cinco personajes del bando rival con sus armas. En ambas partidas se validaron tres oleadas, una fase de jefe, el cofre, el descenso y la victoria. Las entradas a las salas y las bajas se realizaron mediante la prueba de depuración. Pasaron TypeScript, las dos suites unitarias y la compilación de Vite.

## Revisión 7 · Bestiario y resumen de partida

- Las nuevas bajas se guardan por personaje rival y perfil de combate en el sistema de escritura por lotes. El bestiario muestra ambos bandos con icono, arma inicial y contador por personaje. Las bajas históricas siguen visibles bajo «Perfiles de combate». Como los registros anteriores no incluyen la identidad del rival, no se les asignan nombres retroactivamente.
- En el resumen de victoria se muestran los nombres de los nuevos rivales registrados. En Chrome se reprodujo el recorrido de depuración con ambos bandos y un guardado previo con siete bajas de un perfil. Se verificaron los cinco nombres del bando contrario, la conservación del contador antiguo y la persistencia de las fichas al recargar. Pasaron TypeScript, las dos suites unitarias y la compilación de Vite.
- Los retratos aparecen cuando termina la carga del atlas si se abre una pantalla antes de que estén listos. La prueba verifica que se muestran los diez iconos tras recargar el bestiario.

## Revisión 8 · Reposo animado en el bestiario

- Las fichas muestran sprites de cuerpo entero con escalado pixelado. Bombeta, Pallico y Gitano MDLR reproducen su animación frontal de partida. Los otros siete tienen un ciclo de respiración de cuatro fotogramas preparado a partir de sus poses de la lámina aprobada. Estas siete tiras se usan en el bestiario.
- La prueba en Chrome confirmó el archivo correcto y el avance de los fotogramas en las diez fichas. Con movimiento reducido, las fichas quedan en la primera pose. Pasaron TypeScript, las dos suites unitarias y la compilación de Vite.
- La actualización de producción incluye el HTML, el manifiesto y las siete tiras nuevas. Aplicar sobre la revisión 7 conservando las rutas de `assets`.
