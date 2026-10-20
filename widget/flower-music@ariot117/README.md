# Flower Music

Extensión propia para GNOME Shell 50. UUID `flower-music@ariot117`. La píldora conserva su diseño; el desplegable compacto mide 400×172 px. Implementación nativa GJS/St/Cairo, sin fuentes descargadas ni librerías nuevas.

El widget anterior es Media Controls (`mediacontrols@cliffniff.github.com`). Sus archivos permanecen intactos; al activar Flower Music se desactiva la original. `./revert.sh` invierte ese cambio.

## Interfaz y memoria

- `extension.js`: ciclo de vida de la extensión.
- `ui/indicator.js`: píldora, controles MPRIS y montaje del desplegable. Su contenido se crea al abrir y se destruye al terminar el cierre, también cuando GNOME cierra sin animación.
- `ui/paint.js`: flores suaves, onda antialias y fondo negro. No usa Shell.BlurEffect, GLSLEffect, texturas de portada en el fondo ni desenfoque en vivo.
- `artwork-cache.js`: Soup/GdkPixbuf. Reducción a un máximo de 256×256 px y JPEG de calidad 82; LRU de 10 entradas comprimidas en memoria y 10 archivos JPEG en disco. El color promedio 8×8 se calcula por entrada de pista y se conserva con ella.
- `mpris.js`: descubrimiento D-Bus, prioridad Spotify y consultas de Position solo mientras el menú está abierto, cada 500 ms y sin solaparse.
- `icons/`: SVG propios, independientes del tema de iconos.

Solo la portada actual mantiene una surface Cairo. Al reemplazarla se llama `finish()` y se elimina la referencia. La caché nunca guarda surfaces ni imágenes originales decodificadas. Como GJS Cairo solo expone el lector PNG, hay un puente temporal de 256 px para decodificar la imagen actual; el archivo se elimina inmediatamente y no forma parte de la caché. Los PNG de la caché antigua se eliminan al migrar.

Con el menú cerrado no hay timeline del compositor: solo un temporizador de 100 ms dibuja la portada de 20 px si está sonando, manteniendo la vuelta de 24 segundos. El progreso de la píldora se actualiza una vez por segundo. Abierto, un único timeline (~30 fps) dibuja onda, flor y ecualizador; en pausa se detiene al terminar el aplanado de la onda. Se respeta `enable-animations=false`.

`disable()` elimina timers, desconecta señales, cancela peticiones, destruye actores y vacía la caché. No hay procesos propios auxiliares, MutationObserver ni blob URLs.

## Referencia y verificación

La referencia original completa está en `references/Widget.dc.html`. El enlace actualizado devolvió HTTP 403; se aplicaron las medidas y colores explícitos del último encargo, resumidos en `references/compact-spec.md`.

`sh tests/run-nested.sh` empaqueta y prueba la extensión en un bus privado con MPRIS controlado. Usa devkit si está instalado; este Ubuntu carece de `/usr/libexec/mutter-devkit`, por lo que utiliza el backend headless oficial con monitor virtual 1280×720. Comprueba tamaño, alineación, pausa, controles, ausencia de portada, 20 aperturas/cierres, 20 canciones, LRU y liberación de surfaces.

La auditoría real se ejecuta con `python3 tests/looking-glass.py compact-benchmark`. Cambia 20 canciones y restaura canción, posición y estado de reproducción. Durante la muestra abierta de 60 s, el menú se retira temporalmente del gestor de captura de entrada para que otras interacciones no lo cierren ni bloqueen el escritorio; después se restaura su comportamiento normal. Esta instrumentación no se carga con la extensión.

Los scripts usan Looking Glass y una sesión local temporal de entrada de Mutter, sin habilitar `unsafe_mode` ni añadir interfaces D-Bus de depuración. GNOME puede registrar un aviso interno de `keyboard.js` al retirar el dispositivo virtual de prueba.

Ver `REPORT.md` para capturas, tabla de RAM/CPU, metodología y resultados. Las capturas PNG quedan locales y se excluyen de Git; los JSON medidos sí se versionan. `python3 tests/compact-captures.py` genera las comparaciones al 200% a partir de capturas reales.
