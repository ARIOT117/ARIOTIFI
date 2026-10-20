# Flower Music compacto — entrega

Versión activa: desplegable **400×172 px**, portada **128 px**, fondo **#050506** con resplandores radiales tenues. La píldora mantiene su diseño y su giro de 24 segundos.

## Capturas reales al 200%

[Anterior y nueva, reproduciendo](artifacts/compact-before-after-playing-200.png) · [Anterior y nueva, en pausa](artifacts/compact-before-after-paused-200.png)

La anterior se capturó antes de editar. La nueva se capturó en la misma sesión, con datos reales de Spotify, después de restaurar la canción original. Se ampliaron exactamente 2×; no son recreaciones.

## RAM y CPU de gnome-shell

| Estado | RSS MiB | PSS MiB | Δ RSS vs. base | CPU | Muestra |
|---|---:|---:|---:|---:|---:|
| Media Controls (base) | 640.36 | 498.08 | +0.00 MiB | 67.00% | 15.00 s |
| Flower Music cerrado | 641.47 | 499.19 | +1.11 MiB | 68.27% | 15.00 s |
| Abierto durante 60 s | 639.49 | 497.22 | -0.87 MiB | 69.50% | 60.00 s |
| Después de cerrar | 640.30 | 498.03 | -0.06 MiB | 64.85% | 15.00 s |
| Después de 20 cambios | 640.25 | 497.98 | -0.11 MiB | 63.39% | 15.00 s |

**Objetivo observado cumplido en esta sesión: el mayor incremento fue de 1.11 MiB RSS**, inferior a 20 MiB en las cuatro fases. Tras 20 cambios la diferencia fue de -0.11 MiB. Las diferencias negativas pequeñas son variación normal del proceso; no significan memoria negativa ni una reducción atribuible al widget.

Metodología: alternar Media Controls y Flower Music en el mismo GNOME (PID 4151), con Spotify reproduciendo y las otras extensiones/aplicaciones conservadas. Se forzó una recolección de basura únicamente al preparar la línea base para retirar instancias de desarrollo; **no se forzó GC durante ninguna de las cuatro muestras de Flower Music ni tras los 20 cambios**. RSS/PSS de /proc/self/smaps_rollup; CPU por diferencia utime+stime y reloj monotónico, CLK_TCK=100, un núcleo=100%.

Es una comparación contemporánea en una sesión ya iniciada, con módulos y cachés compartidas de GNOME previamente calentados. **No es una medición de arranque en frío** ni debe compararse directamente con los 439.80 MiB de horas antes. Las cifras corresponden a todo gnome-shell, no al consumo exclusivo de la extensión.

La muestra abierta se validó con popupMounted=true, timeline=true y consultas de posición activas durante más de 60 s. Para evitar que un clic fuera del menú invalidara la prueba, el script retiró temporalmente su captura modal de entrada; después restauró el gestor normal. Una primera tentativa en la que el menú se cerró se descartó; se conserva en artifacts/invalid-initial y no se usa en esta tabla.

## Límites y liberación verificados

- 20 cambios reales de pista, todos confirmados por ID MPRIS; canción y posición originales restauradas.
- Caché en memoria: como máximo 10 entradas de JPEG comprimido y color promedio. Ninguna entrada contiene una surface.
- Después del estrés: 10 JPEG comprimidos, 221,498 bytes (216.31 KiB).
- Disco inspeccionado: 10 archivos, todos JPEG y de hasta 256×256 px; ningún PNG de la caché antigua.
- Surfaces: 0 para canciones sin portada y como máximo 1 actual en las muestras; finish() explícito al reemplazarla. El puente PNG de 256 px necesario para GJS Cairo se borra inmediatamente, sin cachearlo.
- Cerrado: popupMounted=false, Position timer=0 y compositor timeline=false. El único movimiento es la portada de 20 px mediante un timer de 100 ms; no mantiene despierto el frame clock completo.
- En pausa, después de terminar la transición: playing=false, timeline=false, amplitude=0.
- La ventana se destruye al cerrar: título, controles, portada grande, fondo y progreso quedan sin referencias. Solo permanece la portada pequeña necesaria para la píldora.

## Diseño y pruebas

- Geometría real: popup [79,48], 400×172; píldora [79,5], alto30; panel alto40. Misma izquierda y separación vertical exacta de8 px. Portada128×128.
- Fondo Cairo negro con dos gradientes radiales de opacidad16% y14%, oscurecido radial .35→.88→.96, borde blanco7% y luz superior6%. Sin Shell.BlurEffect ni GLSLEffect.
- Onda: conserva amplitud2.2 px, longitud30 px, velocidad0.3 periodos/s y trazo2.5 px.
- Título18/800, artista13; tiempos11. Controles30/36/46 px con iconos15/17/18. Anterior/siguiente transparentes, solo resaltado al pasar el ratón.
- 43 comprobaciones pasadas en GNOME aislado: geometría, alineación, pausa, controles, búsqueda, sin portada, desconexión/reconexión, 20 aperturas/cierres, 20 pistas, LRU10 y liberación completa al desactivar.
- Registro revisado tras las pruebas reales: sin errores de la versión final. Los avisos anteriores de keyboard.js corresponden al dispositivo temporal de entrada de la instrumentación.

## Referencia y limitación

El enlace actualizado de Claude devolvió HTTP403. Se siguieron las medidas, colores y comportamiento explícitos del encargo, documentados en references/compact-spec.md. El HTML local antiguo se conserva como referencia histórica y no se presenta como la nueva versión.

## Archivos y reversión

Producción: extension.js, ui/indicator.js, ui/paint.js, artwork-cache.js y stylesheet.css. Se conservan mpris.js, los SVG y la píldora. No se editó Media Controls ni el tema de Spotify.

Para volver a Media Controls: `./revert.sh`.
Respaldo anterior al cambio: **db47ec2**. La versión grande completa está en ese commit.

## Commits de este rediseño

- `db47ec2` Respaldo antes del rediseño compacto y ajuste de memoria
- `0a3e1b6` Compactar desplegable a 400×172 y liberar contenido y portadas decodificadas
- `f56a5aa` Dormir el reloj del compositor con el menú cerrado y rotar solo la portada pequeña

El último commit de entrega añade este informe, las comparaciones y los resultados JSON de la auditoría real.
