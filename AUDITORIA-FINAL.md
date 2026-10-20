> Informe histórico del 18 de octubre de 2026. No es un benchmark nuevo de ARIOTIFI. Las capturas de esa auditoría también están en [la galería](docs/GALERIA.md). Para instalar usa [la guía actual](docs/INSTALACION.md).

# Auditoría final — 18 de octubre de 2026

Las correcciones visuales están aplicadas y comprobadas en Spotify real. Los dos adjuntos están copiados sin cambios; sus IIFE exactos se ejecutan al principio del bundle, antes de la integración VideoGlass. No se cambiaron el periodo de FlowerButton (24 s), su amplitud ni las opciones de WavyProgress.

**Las metas globales de rendimiento siguen pendientes.** No se afirma que el cliente completo esté libre de fugas: las cantidades de componentes, observers e imágenes permanecen estables, pero persiste un aumento de memoria del conjunto de procesos y una CPU superior al objetivo.

## RAM y CPU: procesos completos

MiB = 1024² bytes. Se sumaron TODOS los procesos cuyo ejecutable es el Spotify instalado: principal, renderer, GPU, red, almacenamiento, CDM, crash handler y zygotes. RSS suma páginas compartidas varias veces; PSS reparte esas páginas y aproxima mejor la RAM física. El servicio Python se mide aparte.

Cada variante comenzó en un proceso nuevo. Misma pista inicial/final (`Die With A Smile`), reproducción activa, vista inmersiva cerrada y documento visible. Veinte cambios reales de canción (17 pistas distintas, con repeticiones), y veinte aperturas y cierres completos por variante. La secuencia está en `tests/stress-tracks.json`; los URI y diagnósticos de cada ciclo, en los JSON `*-stress.json`. La versión anterior usa su propio CSS y backend del commit de respaldo. En la línea sin extensión se desactivó todo el bundle JS; se conservó el CSS del tema anterior para aislar el JavaScript.

CPU: diferencias user+system durante 10 s, sumadas entre procesos. Se informa tanto el porcentaje total del equipo (12 CPU lógicas, comparable con el monitor) como el porcentaje de `ps` (100% = un núcleo). El heap se midió después de GC explícito. Los snapshots se tomaron en una ejecución separada: serializarlos reserva memoria temporal en Chromium y contaminaba la comparación de RAM.

| Estado | RSS MiB | PSS MiB | Heap JS MiB | CPU equipo, 12 hilos | CPU suma, un núcleo=100% |
| --- | ---: | ---: | ---: | ---: | ---: |
| Sin extensión | 1593.4 | 906.8 | 90.27 | 5.89% | 70.70% |
| Con extensión anterior | 1613.6 | 921.5 | 86.24 | 12.07% | 144.79% |
| Estrés, antes del arreglo | 1710.9 | 1014.7 | 88.25 | 12.48% | 149.81% |
| Con extensión corregida, recién abierto | 1718.3 | 1023.4 | 87.00 | 11.54% | 138.45% |
| Estrés, después del arreglo | 1806.9 | 1107.9 | 88.95 | 11.64% | 139.72% |

La extensión corregida creció **84.51 MiB PSS / 88.62 MiB RSS** desde su propia línea base. Supera los 50 MB solicitados. La CPU posterior es **11.64% del equipo**; supera el 5% solicitado, incluso bajo esta interpretación más favorable que el porcentaje por núcleo. El cliente corregido usa más RAM absoluta que la versión anterior en estas muestras: no se presenta como una reducción global de RAM.

En una ejecución anterior de la integración corregida, después de unos 90 s en reposo, `ram-fixed-settled.json` registró 1084,4 MiB PSS y 135,92% por núcleo: no hubo una liberación tardía que permitiera cumplir la meta en esa ejecución. El crecimiento inmediato se reparte entre proceso principal, renderer y GPU; el heap JS de la última comparación creció 1.95 MiB. Esto no identifica por sí solo la causa de toda la memoria restante.

El perfil por hilos y las pruebas reversibles están en `render-isolation.json`, `closed.cpuprofile` y `contain-test.json`. Congelar los componentes y deshabilitar temporalmente el CSS no produjo una CPU por debajo del objetivo; esas muestras de 5 s también incluyen reacomodo de la interfaz y no constituyen una atribución completa. La prueba de contención no mostró una mejora suficiente; el estilo experimental se retiró. La aceleración de GPU está habilitada (GTX 1650, `gpu.json`). Queda pendiente aislar el coste residual en renderer/compositor y sus cachés, sin modificar los componentes suministrados.

## Snapshots y objetos retenidos

Archivos V8 anteriores y posteriores al estrés: `baseline-with-old.heapsnapshot`, `stress-old-controlled.heapsnapshot`, `baseline-with-fixed.heapsnapshot` y `stress-fixed.heapsnapshot`. Están en `measurements/final-audit/`, junto con su JSON de medición. Los snapshots de la integración corregida se tomaron antes de separar el audio en un proceso hijo; esa separación posterior afecta Python, no añade componentes JS ni listeners de Player.

`heap-counts.json` cuenta objetos nativos por separado de sus wrappers V8, evitando contar dos veces un mismo observer. Son cantidades del renderer completo, incluido Spotify:

| Objeto | Antes del estrés, corregida | Después del estrés, corregida |
| --- | ---: | ---: |
| WavyProgress | 1 | 1 |
| FlowerButton | 1 | 1 |
| Canvas DOM | 1 | 1 |
| HTMLImageElement DOM, incluido Spotify | 326 | 326 |
| Imágenes DOM desconectadas, incluido Spotify | 91 | 91 |
| MutationObserver nativo | 13 | 13 |
| ResizeObserver nativo | 11 | 11 |
| Listeners de Spicetify.Player | 5 | 5 |
| Blob URLs creadas después de cargar el bundle | 0 | 0 |

La instancia que queda de cada componente pertenece a la barra normal. Durante la inmersiva hay dos; tras cerrar vuelve a una. Player mantiene 2 callbacks `songchange`, 2 `onplaypause` y 1 `onprogress`. La caché terminó con 17 pistas y tiene un límite explícito de 20. Los blobs no se usan en producción; el fondo es un data URL generado a 64×64.

## Visualizador y limpieza

El servidor HTTP de letras/controles permanece disponible, con cero CPU medida al estar cerrado el modo inmersivo. GStreamer vive ahora en un **proceso hijo que se termina y se recoge al cerrar**, pausar u ocultar. Además tiene una concesión de 2 s que vence si dejan de llegar solicitudes. El cierre elimina el temporizador, desconecta el bus de GStreamer y deja cero procesos de captura. `audio-resources.json` contiene la medición separada del servidor y del hijo activos (servidor: 38,5 MiB RSS / 0,60% de un núcleo; hijo: 44,9 MiB RSS / 1,40% de un núcleo), y confirma que el PID del hijo desaparece al cerrar.

| Estado | Python RSS MiB | Python PSS MiB | CPU suma, un núcleo=100% |
| --- | ---: | ---: | ---: |
| Sin extensión | 38.8 | 22.7 | 0.00% |
| Con extensión anterior | 39.1 | 23.1 | 0.20% |
| Estrés, antes del arreglo | 49.3 | 29.9 | 0.30% |
| Con extensión corregida, recién abierto | 34.9 | 19.0 | 0.00% |
| Estrés, después del arreglo | 35.7 | 19.7 | 0.00% |

También se sustituyó el sondeo HTTP/MPRIS periódico por lectura directa del estado Spicetify, se delegaron clics en la barra estable, el observer ya existente repara la sustitución completa del botón sin esperar al reloj de 500 ms, se liberan los bitmap de canvas y fuentes de imágenes al desmontar y se anulan las referencias al view cerrado. Los componentes suministrados desconectan sus propios listeners de Player al destruirse. FlowerButton conserva el único hook global de visibilitychange de su módulo, que también utiliza el dock normal; no crece por canción ni por apertura. La suscripción de progreso mantiene el límite de cuatro lecturas por segundo.

## Verificación y capturas al 200%

En `measurements/final-audit/visual-200/`:

- `barra-reproduciendo.png`: flor girando, onda visible y slider nativo conservado.
- `barra-pausa.png`: misma flor inmóvil y progreso aplanado.
- `cerrar-esquina-nativa.png`: captura física de la ventana X11, incluyendo sus controles nativos; solo aparecen × y ···, separados por 8 px.
- `letras-skeleton.png`: cinco líneas durante una respuesta deliberadamente retenida.
- `letras-instrumental-sin-skeleton.png`: tarjeta ♪ con cero nodos de skeleton.
- `letras-sin-letra.png`: respuesta vacía con cero skeleton.
- `verification.json`: giro y pausa, reinserción del mismo SVG al borrarlo Spotify y reenlace inmediato cuando React sustituye el botón completo, tamaños 40/64, apertura sin fullscreen, portada cargada, navegación nativa restaurada al cerrar y limpieza de componentes.

Las respuestas de letras se simularon solo para probar sus estados visuales; el estrés usó canciones reales. `cover-check.json` prueba un error de imagen seguido de carga por la siguiente URL y el degradado con nota cuando todas fallan. Las URLs `spotify:image:` se convierten a HTTPS y la portada anterior se conserva hasta cargar la nueva; el fundido dura 250 ms. Los controles mantienen sus interacciones nativas y no se activa pantalla completa automáticamente.

## Archivos y commits

Respaldo previo: **963c7f2**.

1. **8172e2f** — FlowerButton original; retirar la flor y las animaciones CSS antiguas.
2. **8f57b15** — WavyProgress original actualizado y adaptador compatible con su destrucción.
3. **7671fcb** — carga de portadas con alternativas y fundido.
4. **3ad567c** — eliminación física del skeleton al completar/cancelar letras.
5. El commit que contiene este informe: limpieza, proceso de audio bajo demanda y auditoría.

Producción: `Extensions/flower-button.js`, `Extensions/wavy-progress.js`, `Extensions/videoglass.js`, `VideoGlass/user.css`, `visualizer.py` y `apply.sh`. Documentación: este informe y `README.md`. Pruebas: `tests/cdp.py`, `audit-probe.js`, `final-audit.py`, `final-ram-run.py`, `final-visual.py`, `cover-check.py`, `audio-lifecycle.py`, `profile-render.py`, `contain-check.py`, `summarize-audit.py`, `restore-session.py` y `stress-tracks.json`.

SHA-256 de los adjuntos, coincidentes con los archivos copiados y sus bloques exactos dentro del bundle:

- FlowerButton: `81daceb416db5c036c2f80888bbe65111979be36f1a5d8539f4852e6d379bacb`.
- WavyProgress: `539b4c92954d9e2d3404303de2b6a7852fc7addcc82a49c9997372397e8e30ca`.

## Repetir o revertir

Para repetir el benchmark se necesita Spotify abierto con `--remote-debugging-port=9222` y acceso a la sesión gráfica. `python3 tests/final-ram-run.py` reinicia las variantes, cambia canciones y toma mediciones sin snapshots intermedios; restaura los archivos corregidos en `finally`. `final-audit.py` permite capturar snapshots por separado. La restauración de la reproducción original de esta sesión se verificó con `tests/restore-session.py` y quedó registrada en `installed-final.json`, sin instrumentos de auditoría cargados. Los resultados y las capturas quedan en `measurements/final-audit/`; los snapshots grandes permanecen locales.

Para restaurar el código del respaldo funcional anterior a estas correcciones:

```bash
git restore --source=963c7f2 -- Extensions/videoglass.js Extensions/wavy-progress.js VideoGlass/user.css visualizer.py apply.sh
./apply.sh
```

Después cierra y abre Spotify. El archivo FlowerButton adicional queda sin cargar con el bundle anterior. Los datos de la cuenta y la biblioteca no se modifican al restaurar el código.
