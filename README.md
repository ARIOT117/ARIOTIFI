# Reproductor premium — entrega

## Correcciones finales: FlowerButton y auditoría

Se integraron los dos adjuntos actuales sin modificarlos: FlowerButton (40/64 px, periodo 24 s) y WavyProgress con destrucción idempotente. Se corrigieron las alternativas y precarga de portada, se retira el skeleton del DOM y la captura de audio funciona en un proceso hijo que termina al cerrar.

**Las metas globales de RAM y CPU todavía no se cumplen.** Resultados, capturas al 200%, snapshots, commits y reversión: [AUDITORIA-FINAL.md](AUDITORIA-FINAL.md). Las cifras históricas de las secciones siguientes corresponden a versiones anteriores.


## Actualización: componente WavyProgress original

La onda de progreso anterior fue eliminada y reemplazada por `/home/diego/Descargas/wavy-progress.js`, copiado sin cambios a `Extensions/wavy-progress.js`. Su contenido exacto está al principio de `Extensions/videoglass.js` para cargarlo antes de la integración, sin depender del orden de extensiones de Spicetify. SHA-256 del componente: `539b4c92954d9e2d3404303de2b6a7852fc7addcc82a49c9997372397e8e30ca`.

Se conservan los valores por defecto: amplitud 2,2 px, longitud 30 px, velocidad 0,3 y grosor 2,5 px. El adaptador de entrada limita a cuatro llamadas por segundo a `setProgress` porque Spicetify emite `onprogress` cada 100 ms. El componente extrapola entre lecturas. Al cerrar la inmersiva se llama a su desconexión y a `destroy()`. El slider nativo conserva sus interacciones; solo se ocultan sus capas visuales.

La esquina superpuesta tenía un menú dibujado por Spotify fuera del DOM. Ocultar `.Root__globalNav` no bastaba: ahora `body.vg-immersive-open` oculta la barra global durante toda la inmersiva y `Platform.NativeAPI.setWindowButtonsVisibility(false)` retira la capa nativa. Tras la transición de salida se restaura con `true`. La inmersiva usa `z-index:2147483647` y continúa dentro de la ventana.

Validación: `tests/wavy-check.py`. Capturas al 200% y resultados están en `measurements/wavy-original-200/`; `esquina-inmersiva-nativa.png` se capturó directamente de la ventana X11, incluyendo los controles nativos, y `esquina-normal-menu-restaurado.png` confirma su restauración. Se verificaron las opciones originales, cero SVG de la onda anterior, intervalo mínimo de 253,5 ms entre lecturas, 434 posiciones continuas, reposo en pausa y destrucción al cerrar.


La instalación usa Spotify Desktop 1.2.95 con Spicetify 2.45.3, una extensión JavaScript, CSS y el puente Python existente (MPRIS, monitor de salida de audio y LRCLIB). El proyecto editable y su historial están en esta carpeta. Los archivos instalados están en `~/.config/spicetify` y `~/.local/share/spotify-personalizado`.

## Comportamiento final

**Inmersiva abre dentro de la ventana, sin activar pantalla completa**, según la indicación posterior del usuario. La opción manual está en ··· → Pantalla completa. La decoración de GNOME se conserva al trabajar dentro de la ventana.

La portada del dock y el botón Inmersiva abren la vista. Ctrl + Alt + V también abre/cierra. Esc cierra el panel abierto o vuelve al inicio. La portada tiene 12 ondas, el botón de reproducción 10 y la transición 6 pétalos. El visualizador tiene 72 barras en un canvas y usa audio real de la salida del equipo. No captura el micrófono.

El tiempo derecho es duración total. El progreso utiliza el componente WavyProgress adjunto sin modificar; su entrada se limita a cuatro lecturas por segundo y el componente extrapola entre ellas. Las letras provienen de LRCLIB, permiten buscar desde un verso y muestran ♪ en intervalos instrumentales identificados. Si solamente hay letra sin tiempos, se muestra texto desplazable; si no hay letra, aparece el estado diseñado con botón para reintentar.

La vista se desmonta tras cerrar. Se cancelan peticiones, listeners, ResizeObserver, RAF, animación y consultas del espectro. El servicio libera la captura al recibir `spectrum-stop`. El reloj general del dock y un temporizador de apagado elegido por el usuario pertenecen a la aplicación y pueden continuar con la inmersiva cerrada.

La portada del fondo se procesa a 64 × 64 píxeles y se desenfoca una vez. La caché de fondo/acento tiene límite de 20 pistas. El movimiento reducido desactiva flor de transición, giro, respiración, onda y deriva. El RAF del espectro se detiene al pausar, ocultar o cerrar la vista.

## Fuentes visuales y diferencias

Se extrajeron y leyeron las dos pantallas del HTML adjunto empaquetado y se revisaron fotogramas de los tres videos. El enlace de Claude no se pudo abrir con el navegador de investigación; se usó el HTML local completo, incluido su Main incrustado.

- Se adapta la composición a la interfaz real de Spotify, con sus tarjetas, biblioteca, cola, dispositivos y panel derecho. Su distribución nativa puede variar respecto al prototipo según contenido, versión y tamaño de ventana.
- Se usa la fuente del sistema como alternativa permitida a Figtree, sin descargar fuentes adicionales.
- La transición usa una máscara SVG de 96 puntos; se anima su transformación, junto con escala/opacidad del contenido. Esto evita interpolar 96 vértices en cada fotograma.
- El botón Ecualizador abre los ajustes de reproducción de Spotify; no se añadió un motor de ecualización propio. Mini reproductor ofrece una composición compacta dentro de la vista, sin crear otra ventana del sistema.
- La decoración de GNOME permanece porque la petición final es abrir sin pantalla completa automática. La pantalla completa manual sí está disponible.
- En tamaños pequeños se ocultan los paneles laterales y los controles auxiliares de la barra se colocan encima del dock para mantenerlos accesibles.
- La disponibilidad y precisión temporal de las letras dependen de LRCLIB. El espectro también puede reaccionar al audio de otras aplicaciones porque analiza la salida del equipo.

## Archivos cambiados

Código de producción:

- `Extensions/videoglass.js` → `~/.config/spicetify/Extensions/videoglass.js`.
- `VideoGlass/user.css` → `~/.config/spicetify/Themes/VideoGlass/user.css`.
- `visualizer.py` → `~/.local/share/spotify-personalizado/visualizer.py`.

También se añadieron `apply.sh`, `revert.sh`, esta documentación y herramientas de validación en `tests/`. `VideoGlass/color.ini` está en el commit base y no se modificó.

## Verificación real

Se abrió Spotify y se usó su depurador local. Evidencia en `measurements/`:

- `live-check.json`: letra sincronizada real, estado vacío simulado exclusivamente durante la prueba, reproducción y pausa reales, espectro activo con pico 0,543, transición de 96 puntos y cierre sin nodos/máscaras.
- `final-check.json`: apertura sin fullscreen, ventanas de 640 y 480 px sin desbordamiento en el dock, márgenes laterales de 12 px, altura de 84 px, movimiento reducido y diez ciclos de montaje/desmontaje sin canvas o máscaras residuales.
- Capturas `immersive-final.png`, `home-final.png`, `home-640-final.png`, `home-480-final.png` y capturas de los estados anteriores de prueba.
- `gjs tests/geometry.js`: 447 comprobaciones aprobadas de tiempos, flores, barras solapadas bajo el borde y anclaje de versos de alturas distintas.
- JavaScript validado con el analizador de GJS; Python compilado y scripts shell verificados con `bash -n`.

El estado vacío se probó interceptando temporalmente solamente la respuesta de letras; se restauró fetch después. Las pruebas de reproducción restauraron posición y estado al terminar. Las últimas comprobaciones de tamaños y memoria conservaron la reproducción actual.

## Memoria medida (versión previa a WavyProgress)

Comparación del 18 de octubre de 2026 en la misma instancia de Spotify, misma pista (`Bad Romance`) y reproducción activa, con inmersiva cerrada. Se cargó la versión anterior y después la nueva; ambas tuvieron 8 segundos para estabilizarse y una recolección explícita de basura antes de tomar la muestra. Se restauró la versión nueva al terminar.

| Medida | Antes | Después |
| --- | ---: | ---: |
| Heap JavaScript usado | 73,70 MiB | 72,15 MiB |
| Memoria proporcional PSS del cliente | 1088,91 MiB | 1098,16 MiB |
| Suma RSS de los procesos del cliente | 1799,96 MiB | 1809,30 MiB |
| Nodos DOM | 12854 | 12274 |
| Listeners JS | 4807 | 4627 |

La memoria JavaScript bajó 1,55 MiB. La PSS subió 9,25 MiB (aproximadamente 0,85%). La suma RSS cuenta páginas compartidas varias veces; PSS es la medida más útil para el cliente completo. Son dos instantáneas de una app con cachés y servicios propios, no un benchmark repetido ni garantía de ahorro global. No se atribuye toda la variación al tema. El servicio Python queda fuera de estas cifras del cliente.

Los datos originales están en `measurements/before.json` y `measurements/after.json`. Para repetir se necesita Spotify ya abierto con `--remote-debugging-port=9222`; `tests/compare-memory.py` carga temporalmente ambas revisiones y restaura la nueva incluso si hay un error.

## Respaldo, historial y reversión

El respaldo previo está en `/home/diego/Backups/spotify-personalizado/premium-2026-10-17`. Se copiaron configuración Spicetify, puente de audio y lanzador antes de editar. El commit base es `36da865`.

Commits por parte:

- `9580cd4` — A: vista inmersiva.
- `42a1bb3` — B: barra flotante.
- `5d040c4` — C: transición floral.
- `b6cde93` — D: inicio premium.
- `c2b8c2f` — E: recursos, captura y pruebas.
- `42a35ae` — apertura dentro de la ventana y correcciones de adaptación.

Para restaurar todos los archivos de producción anteriores:

```bash
/home/diego/Documentos/Spotify-personalizado/premium/revert.sh
```

Después cierra y abre Spotify. Para volver al diseño nuevo:

```bash
/home/diego/Documentos/Spotify-personalizado/premium/apply.sh
```

Los scripts también reaplican Spicetify y reinician el servicio de audio. Restaurar no elimina esta carpeta, el historial Git, la biblioteca ni los datos de la cuenta.
