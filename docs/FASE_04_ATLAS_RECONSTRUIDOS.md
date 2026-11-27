# Fase 4 · Atlas reconstruidos

Las hojas dedicadas de Bombeta, Gitano MDLR y Pallico proporcionan las poses. Bombeta conserva la cabeza proporcionalmente grande, el cuerpo infantil y la ropa clara de la referencia. MDLR conserva la capucha azul y Pallico el pañuelo rojo y el chaleco.

El reconstruidor utiliza coordenadas trazadas por fila y por animación sobre cada hoja. Conserva las piezas claras desconectadas del cuerpo, recupera las sombras y detalles oscuros en la máscara, y redibuja el perímetro a resolución nativa. Los separadores de las tablas se excluyeron ajustando las celdas y revisando las hojas de contacto. Los PNG contienen poses de 32 × 32 sobre transparencia, alineadas por el borde inferior. Cada pose conserva el tamaño relativo que tiene dentro de su animación.

Cada personaje tiene ocho direcciones y cinco estados. Las hojas de Bombeta y MDLR contienen seis poses de caída por dirección. La hoja dedicada de Pallico muestra cinco y se usan las cinco. La última se sostiene al terminar la reproducción. El juego reproduce el rodamiento a 28 fps para ajustarlo a su desplazamiento de 0,18 segundos. El editable conserva una cadencia más lenta para inspeccionar el arte.

## Editables y regeneración

- Los editables de 32 × 32 están en `art/rebuilt`, un archivo por personaje, estado y dirección.
- Las tiras se exportaron con LibreSprite 1.1-dev, usando `--sheet-type horizontal`.
- Para reconstruir candidatos desde las referencias, ejecutar `tools/rebuild-approved-cast.ps1` con `-ReferenceDirectory` y `-OutputDirectory`. Revisar las hojas de contacto antes de exportar e integrar.
- Fuentes de referencia: `a_clean_pixel_art_game_sprite_sheet_on_a_transpare.png` (SHA-256 `340e1893a7b49e97b6b44f2e790225c3486961c3b000ce7e0ccea0578bf54747`) y `a_detailed_pixel_art_sprite_sheet_for_the_characte.png` (SHA-256 `f555ff235f0266629c4972c9a707aa2145ae91ca3ddf066ad388b6f445dd3919`).

## Revisión de coherencia del reparto

Los siete personajes que conservaban prototipos de combate usan cinco vistas de la lámina de facciones aprobada. Las tres direcciones restantes se obtienen por espejado. Las poses se enmascararon y revisaron a 32 × 32 píxeles. A partir de cada vista se animaron la respiración, el paso, el retroceso, el rodamiento y la caída. Son ciclos derivados de las vistas de referencia. Se pueden regenerar con `tools/bestiary-reference.ps1 -Gameplay` y revisar con las hojas de contacto que exporta el script.

Pallico usa las vistas de la lámina para reposo y marcha, con ocho direcciones dibujadas. Las poses de rodamiento, daño y caída proceden de su hoja dedicada. El bestiario reproduce el reposo que se ve en partida para todo el reparto. Los atlas de Bombeta y Gitano MDLR permanecen como referencia visual.

La lámina de facciones es `a_pixel_art_sprite_sheet_on_a_black_background_in.png` (SHA-256 `c70d74f80cf041996eb72074fb63cfabc7e1083b95a9a5a0ae83b60d62223dec`). La regeneración trabaja sobre esta referencia y deja las hojas de contacto en el directorio de salida.
