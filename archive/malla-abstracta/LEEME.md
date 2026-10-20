# Malla del diseño 6

Se corrigió únicamente el visualizador de la extensión instalada en `/home/diego/.config/spicetify/Extensions/videoglass.js`. El servicio Python, los controles, los metadatos, las letras y el tema general no se modificaron. No se añadieron dependencias.

## Tecnología y audio

Canvas 2D en la extensión Spicetify VideoGlass. El servicio Python existente usa GStreamer `pulsesrc @DEFAULT_MONITOR@` y entrega 64 bandas mediante `/spectrum`, cada 80 ms mientras reproduce. Captura la salida del equipo, incluyendo otras aplicaciones; no es una captura aislada del proceso Spotify. Su FFT es lineal y tiene poca resolución de bajos: se aprovecha la primera banda para el grave amplio, las bandas 1–7 para medios y 8–55 para detalles agudos. Las divisiones son aproximadas, dependen de la frecuencia de muestreo del dispositivo.

## Geometría

64 curvas cerradas, 240 segmentos angulares por hilo. Coordenadas polares y distintas fases por hilo, con ondas de 2, 3, 5, 7, 11 y 17 ciclos moduladas por el espectro. No existe una onda fija de cuatro lóbulos. El muestreo circular Catmull–Rom une continuamente el inicio y final del espectro asignado a cada zona. Las curvas se cruzan y mantienen un radio mínimo mayor que el de la portada. No se rellenan superficies. La portada circular conserva escala 1.

Trazos de aproximadamente 0,4–0,85 px CSS, opacidad 0,085–0,14 y brillo de hasta 2 px. El canvas usa la resolución de pantalla hasta 2×. La paleta mezcla dorado y blanco cálido con un pastel obtenido de la portada mediante una muestra de 20×20; conserva colores de respaldo si el servidor de la imagen impide leer sus píxeles.

## Tiempo y recursos

Interpolación exponencial por banda con ataque de 65 ms y caída de 520 ms; independiente del tiempo entre fotogramas. La fase avanza con energía medida y se detiene en silencio. Al pausar, se sigue dibujando la cola de contracción y se vuelve al intervalo inactivo cuando decae. Se conserva el límite existente de 24 fps; al cerrar u ocultar la vista se cancelan los callbacks y se descartan muestras antiguas. El gradiente se reutiliza, el color se calcula una vez por portada y las solicitudes de espectro tienen un límite de 1,5 segundos.

## Comprobaciones

- `comprobar-malla.py`: sintaxis en Chromium de Spotify, 64 trazos sin rellenos, transparencia y grosores, portada libre de píxeles del visualizador, geometría finita y circular, continuidad de la unión, respuesta independiente por sectores, ausencia de simetría fija de cuatro lóbulos, ataque y caída, reposo, controles presentes y coste de dibujo.
- `comprobar-audio-real.py`: recepción de espectros reales variables, reproducción y pausa, contracción observada, siguiente/anterior y recuperación de la canción. Restaura las funciones instrumentadas al finalizar.
- `comprobar-escalado.py`: tamaños 800×600 y 1440×900, escalado 1× y 2× y portada circular. Restaura la emulación al finalizar.

Los scripts usan exclusivamente la biblioteca estándar de Python y el cliente CDP local ya existente. Requieren una instancia temporal de Spotify en `127.0.0.1:9222`; no arrancan esa instancia ni dejan el diagnóstico habilitado por sí mismos. Los informes JSON y las capturas de esta carpeta conservan los resultados.
