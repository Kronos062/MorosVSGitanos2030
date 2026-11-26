# Fase 3 — Pipeline artístico

Base acumulativa: fase 2. Bombeta conserva el ID tariq. Se adopta la resolución final de 24×32 indicada al final de TARIQ_ART_BRIEF.md (no la sugerencia inicial de 32×40). Cinco direcciones originales, 25 tiras, 120 frames. PNG RGBA, alfa binario, anclaje inferior. No se activa ningún recurso provisional.

## Flujo local
Instalar LibreSprite y Python con Pillow (`python -m pip install Pillow`). Crear una carpeta de trabajo con 25 archivos .ase, nombrados tariq_<anim>_<dir>.ase, con frames y direcciones del manifiesto de ejemplo. Exportar y validar:

```
python tools/sprite_pipeline.py ruta/a/sprites --export --editor ruta/a/libresprite.exe
```

Para PNG ya exportados, omitir --export. El exportador CLI queda pendiente de prueba con LibreSprite instalado. El validador no certifica calidad artística ni continuidad visual; revisar manualmente anclaje horizontal, manos, silueta y animación. Solo tras aprobación artística copiar las tiras al directorio indicado en la guía y activar la entrada del personaje. Retrato e icono se revisan aparte.

## Equipamiento
Conservar IDs, rarezas, estadísticas y bonificaciones. Diseñar siluetas y materiales específicos por conjunto, no recolorear una plantilla común. Probar 32×32 para iconos antes de adoptar globalmente; no cambiar el tamaño de los recursos actuales en esta fase.
