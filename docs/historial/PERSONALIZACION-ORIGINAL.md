# Readmi personalización Spoty

Registro del trabajo realizado en el equipo de Diego los días **7 y 11 de octubre de 2026**. Documento actualizado con el procedimiento completo del resultado final.

Para reconstruir la instalación, sigue la [sección 13: procedimiento completo](#13-procedimiento-completo-para-reproducir-el-resultado-final). Las secciones anteriores conservan las decisiones, las correcciones y las mediciones de cada etapa.

## 1. Resultado y uso

Se personalizó el cliente oficial de Spotify con un tema llamado **VideoGlass**, una extensión y un servicio local. El resultado incluye fondo basado en la carátula, visualizadores que reaccionan al audio, letras sincronizadas y ajustes de apariencia. Se retiraron los puntos decorativos rojo, amarillo y verde y se corrigió la superposición que aparecía al reducir la ventana. En una revisión posterior se igualaron la altura y la separación de los botones Inicio, visualizador y Buscar; el detalle está al final de la sección 6. El resultado final también incluye entrada de **460 ms** y salida de **380 ms** con fundido y desplazamiento, carátula más grande, controles similares a los del cliente nativo y barra con tiempo restante. La transición definitiva es la de la sección 12; sustituye a la primera versión de la sección 11.

Abre **Spotify** desde el menú de aplicaciones o ejecuta `/home/diego/.local/bin/spotify-personalizado`. También puede abrirse desde el acceso **Spotify personalizado** del escritorio si está creado. En la barra superior, junto al botón **Inicio**, hay un botón verde con el símbolo de ondas:

- En ventanas grandes muestra **Vista del video**.
- En ventanas pequeñas muestra únicamente el símbolo para que quepan los controles.
- **Ctrl + Alt + V** abre o cierra la vista personalizada.
- **Esc** cierra los ajustes o vuelve a la biblioteca.
- **Espacio** reproduce o pausa dentro de la vista personalizada.
- **← / →** retrocede o avanza diez segundos.
- Pulsar una línea de la letra sincronizada lleva a ese momento de la canción.

La vista incluye anterior, siguiente, aleatorio, repetición, posición y volumen. Los controles de transporte están encima de la barra de progreso; a la izquierda aparece el tiempo transcurrido y a la derecha el restante. Arrastrar la barra previsualiza la posición y soltarla realiza el salto. Arriba están los botones de vista compacta, letras, ajustes, pantalla completa y cierre. La rueda de ajustes permite cambiar:

| Apartado | Opciones |
| --- | --- |
| Visualizador | Activar/desactivar; circular, barras, onda o circular con barras; sensibilidad |
| Carátula | Círculo, flor o cuadrada |
| Fondo | Desenfoque, oscuridad y saturación |
| Apariencia | Mostrar letras y mostrar carátula |
| Reproducción | Pausar al terminar un temporizador de 15, 30, 45 o 60 minutos; cancelar |

Los ajustes visuales y el estado abierto/cerrado se guardan en el almacenamiento local de Spotify. El temporizador pertenece a la sesión actual y no continúa tras cerrar la aplicación.

## 2. Referencias analizadas

Se revisaron los archivos descargados:

- `/home/diego/Descargas/WhatsApp Video 2026-10-07 at 7.19.30 AM.mp4`.
- `/home/diego/Descargas/WhatsApp Image 2026-10-07 at 7.25.56 AM.jpeg`.
- `/home/diego/Descargas/11550ef2-4fa3-472d-9996-2a45545c73df.jpeg`, correspondiente al perfil del autor.

El video dura aproximadamente **59 segundos**. Se extrajeron doce fotogramas distribuidos a lo largo del video con Python y GStreamer y se creó un resumen con Pillow. Los fotogramas y el resumen están en `Documentos/Spotify-personalizado/referencias/`.

La referencia muestra un cliente nativo QML asociado al perfil **@shred0s**: fondo difuminado, carátula central con formas alternativas, visualizadores, letras grandes y paneles de ajustes. El perfil proporcionado no incluía un enlace de GitHub y no se encontró un repositorio o una descarga pública verificable del cliente mostrado.

Se recrearon los elementos visibles y las funciones descritas dentro de Spotify oficial mediante Spicetify. Esta instalación conserva el motor web del cliente oficial; no tiene la arquitectura QML del video ni garantiza el consumo de memoria anunciado allí. No se añadió descarga de canciones ni se cambiaron las prestaciones que dependen de la cuenta de Spotify.

## 3. Estado inicial y decisión de instalación

| Elemento | Estado encontrado |
| --- | --- |
| Spotify original | Instalación Snap, disponible mediante `/snap/bin/spotify` |
| Versión de Spotify | `1.2.95.453.g0eeebbed` |
| Revisión Snap examinada | `99` |
| Archivos del cliente | `/snap/spotify/current/usr/share/spotify` |
| Preferencias originales | `/home/diego/snap/spotify/99/.config/spotify` |
| Procesador | Intel Core i5-10400F; 12 procesadores lógicos |
| Tarjeta gráfica | NVIDIA GeForce GTX 1650 |
| Memoria | 32 GB instalados; aproximadamente 25 GiB disponibles durante la revisión |

Los archivos del Snap son de solo lectura. Por eso se creó una copia del cliente oficial, de aproximadamente 370 MB, en una carpeta del usuario que sí permite aplicar el tema. El Snap original sigue instalado.

### Pasos realizados

1. Se respaldó la configuración original en `/home/diego/Backups/spotify-personalizado/config-original`.
2. Se copió el cliente de `/snap/spotify/current/usr/share/spotify` a `/home/diego/.local/share/spotify-personalizado/spotify` y se habilitó su escritura para el usuario.
3. Se copió la configuración existente a `/home/diego/.config/spotify` para conservar la sesión. El README no contiene credenciales ni el contenido privado de esas preferencias.
4. Se descargó **Spicetify CLI 2.45.3** desde su publicación oficial:
   [spicetify-2.45.3-linux-amd64.tar.gz](https://github.com/spicetify/cli/releases/download/v2.45.3/spicetify-2.45.3-linux-amd64.tar.gz).
5. Se instaló en `/home/diego/.local/share/spicetify-cli`, con acceso mediante `/home/diego/.local/bin/spicetify`.
6. Se configuraron las rutas del cliente y las preferencias, se creó el tema **VideoGlass** y se registró la extensión `videoglass.js`.
7. Se ejecutó inicialmente `spicetify backup apply -n`. Los ajustes posteriores se aplicaron con `spicetify apply -n`. Se usó el mapa CSS local cuando no pudo obtenerse el remoto.
8. Se creó el servicio local, el lanzador y los accesos del menú y escritorio.
9. Se verificaron el funcionamiento, el consumo y la apariencia y se realizaron las correcciones de las secciones siguientes.

El sufijo `-n` evita que Spicetify reinicie automáticamente Spotify; los reinicios durante las pruebas se hicieron de forma controlada.

### Configuración principal de Spicetify

Archivo: `/home/diego/.config/spicetify/config-xpui.ini`.

```ini
[Setting]
spotify_path = /home/diego/.local/share/spotify-personalizado/spotify
prefs_path = /home/diego/.config/spotify/prefs
current_theme = VideoGlass
color_scheme = Base
inject_theme_js = 1
inject_css = 1
replace_colors = 1
overwrite_assets = 0
check_spicetify_update = 0
always_enable_devtools = 0

[Preprocesses]
disable_sentry = 1
disable_ui_logging = 1
remove_rtl_rule = 1
expose_apis = 1

[AdditionalOptions]
extensions = videoglass.js
custom_apps =
sidebar_config = 0
home_config = 1
experimental_features = 1
```

Este bloque documenta los valores principales. El archivo real también contiene los datos de respaldo gestionados por Spicetify; no hace falta reemplazarlo por este extracto.

## 4. Cómo se construyó la personalización

### Tema y vista del video

Se crearon `color.ini` y `user.css` dentro del tema **VideoGlass** para aplicar colores oscuros, acentos verdes, transparencias, difuminado y esquinas redondeadas a la biblioteca.

La extensión `videoglass.js` crea una vista inmersiva independiente del contenido de la biblioteca. Usa la carátula actual para el fondo y la imagen principal. Dibuja los visualizadores en canvas, muestra los datos de la canción y desplaza las letras al momento correspondiente. Al cerrar esta vista se vuelve a la interfaz habitual.

Se añadió un botón propio de acceso porque los botones registrados mediante las interfaces Topbar/Playbar de Spicetify no resultaban visibles en el diseño de esta versión de Spotify.

### Controles fiables mediante MPRIS

Durante la implementación se detectó que `Spicetify.Player.origin` no estaba disponible o mantenía datos desactualizados en esta versión. Esto producía duración inválida y estados de reproducción inconsistentes. Se comprobó también el acceso mediante `Platform.PlayerAPI` y se sustituyó la lectura y el control de reproducción por la interfaz nativa **MPRIS**, a través del bus de sesión D-Bus.

El servicio consulta `org.mpris.MediaPlayer2.spotify`, objeto `/org/mpris/MediaPlayer2`, interfaz `org.mpris.MediaPlayer2.Player`. De ahí obtiene canción, duración, posición, reproducción, volumen, aleatorio y repetición. También envía reproducir, pausar, anterior, siguiente y saltos de posición. Convierte microsegundos a milisegundos y normaliza los enlaces de canciones o episodios a URI `spotify:track:…` o `spotify:episode:…`.

La extensión consulta el estado aproximadamente cada 300 ms mientras la vista está abierta y visible, y cada 1500 ms cuando está oculta. El contador interpola entre lecturas para mantenerse fluido. Las llamadas visuales se realizan con `VideoGlass.player`; el objeto original de Spicetify no se usa como fuente fiable del estado.

### Servicio de audio y letras

Archivo: `/home/diego/.local/share/spotify-personalizado/visualizer.py`.

Se implementó con Python, GI, GStreamer, GLib y Gio. Escucha exclusivamente en **127.0.0.1:43891**:

| Ruta | Función |
| --- | --- |
| `GET /health` | Estado del servicio y de la captura de audio |
| `GET /player` | Estado actual de Spotify leído mediante MPRIS |
| `POST /control` | Comandos de reproducción |
| `GET /spectrum` | 64 bandas del espectro de audio |
| `GET /lyrics` | Consulta de letras y caché local |

El visualizador analiza el **monitor de la salida de audio**, con `pulsesrc device="@DEFAULT_MONITOR@"`; no usa el micrófono. Puede reaccionar también al sonido de otras aplicaciones. Las solicitudes de espectro se realizan aproximadamente cada 80 ms durante la reproducción con el visualizador abierto. Al cerrar la vista, pausar, minimizar o desactivar el visualizador, dejan de pedirse muestras. El servicio desmonta la captura después de aproximadamente seis segundos sin solicitudes.

GStreamer se configuró con 64 bandas, intervalo de 80 ms y umbral de −75 dB. La lectura inicial de `Gst.ValueList` no era compatible con las extensiones GI disponibles en el equipo; se corrigió extrayendo las magnitudes del mensaje de GStreamer y normalizándolas entre 0 y 1.

Las letras se solicitan a **LRCLIB** mediante título, artista, álbum y duración. Se envían esos metadatos públicos, sin credenciales de Spotify. Las respuestas se guardan en `/home/diego/.cache/spotify-videoglass/lyrics`. Si hay marcas de tiempo se sincronizan; si hay únicamente texto se muestra sin sincronización; si no hay resultados aparece el aviso correspondiente. La disponibilidad depende de LRCLIB.

Las respuestas permiten los orígenes de la interfaz de Spotify y las órdenes de control rechazan otros orígenes. El servicio no se publicó en Internet. El puerto de depuración `9222` solo se usó temporalmente para las pruebas y quedó cerrado al terminar.

### Inicio desde el menú y el escritorio

Se creó el servicio de usuario `spotify-videoglass.service`, que ejecuta el archivo Python y se reinicia si falla. El lanzador `/home/diego/.local/bin/spotify-personalizado` inicia ese servicio y abre la copia del cliente:

```bash
#!/bin/bash
systemctl --user start spotify-videoglass.service
exec /home/diego/.local/share/spotify-personalizado/spotify/spotify "$@"
```

Se actualizó el acceso de usuario `spotify_spotify.desktop`, se añadió la acción **Abrir Spotify original** y se creó `Spotify-personalizado.desktop` en el escritorio con permiso de ejecución y marcado como confiable. Se actualizó la base de accesos y se validó su formato.

El servicio auxiliar se inicia desde el lanzador; no se habilitó para arrancar automáticamente al iniciar sesión. Puede permanecer en memoria tras cerrar Spotify, pero deja de capturar sonido cuando no se solicitan muestras.

## 5. Retirada de puntos y optimización del consumo

Después de la primera versión se pidió quitar los tres puntos decorativos de colores y comprobar el ruido del equipo. Se retiraron esos elementos de la vista personalizada y se midieron los procesos de Spotify y del servicio auxiliar.

### Cambios de rendimiento

- Límite de animación de **24 fotogramas por segundo** durante la reproducción.
- Actualización de controles como máximo cada 250 ms, cambiando el DOM solo cuando cambia su valor.
- Dibujo de los 128 segmentos del anillo en una única operación de trazado.
- Resolución del canvas con factor 1 para reducir el trabajo gráfico.
- Escala reactiva de la carátula cuantizada para evitar transformaciones innecesarias.
- Aislamiento de los canvas para reducir repintados.
- Ocultación de la biblioteca mientras está abierta la vista inmersiva.
- Lectura de metadatos y consulta de letras cuando cambia la canción.
- Sin redibujado continuo de los visualizadores en pausa; los controles siguen comprobándose.
- Suspensión de la animación al ocultarse/minimizarse la ventana, usando `document.hidden` y `visibilitychange`.
- Detención de las solicitudes de espectro cuando el visualizador no se necesita.

### Mediciones obtenidas

Se hicieron muestras breves durante esta sesión. Los porcentajes de `pidstat` se sumaron para los procesos de Spotify. Como el equipo tiene doce procesadores lógicos, se dividió la suma entre doce para expresar su equivalente respecto a la capacidad total.

| Medida | Antes | Después, reproduciendo | En pausa |
| --- | ---: | ---: | ---: |
| CPU de Spotify, suma respecto a un procesador lógico | 160,17 % | 46,31 % | 9,47 % |
| CPU equivalente respecto a los doce procesadores lógicos | 13,35 % | 3,86 % | 0,79 % |
| RAM de los procesos de Spotify | Aproximadamente 1,21 GiB | Aproximadamente 644 MiB | Sin una medición comparable registrada |

El servicio auxiliar usaba aproximadamente **24,6 MiB de RAM** después de la optimización. La temperatura de la GPU medida después era **46 °C**. Durante la revisión había unos **25 GiB de RAM disponibles**, por lo que no se observó falta de memoria.

La medición de RAM posterior también refleja el reinicio de Spotify y no permite atribuir toda la reducción al cambio de código. Son muestras de esta sesión, no una garantía para cualquier canción, ventana o actividad del sistema. Había consumo adicional del escritorio y otras aplicaciones; no se comprobó acústicamente que los ventiladores dejaran de sonar.

Datos y registros: `rendimiento.json`, `cpu-optimizado.log` y `cpu-pausado.log` en `Documentos/Spotify-personalizado/`.

### Verificación posterior de la captura: 2,27 GB y 3,6 %

Se recibió una captura del monitor del sistema con **2,27 GB de memoria** y **3,6 % de CPU** para Spotify. Se realizó una nueva medición de aproximadamente **30 segundos**, con tres intervalos de diez segundos, sin reiniciar, pausar ni cambiar los ajustes de la aplicación. La música y el visualizador estaban activos; la reproducción pasó de «QUE VUELVAS» a «LAS FLORES» durante la muestra.

Se identificaron **nueve procesos del cliente** por la ruta exacta de su ejecutable. Se sumaron sus tiempos de CPU de `/proc/<pid>/stat`, usando los ticks por segundo del sistema, y se dividió el porcentaje entre los doce procesadores lógicos. Se leyó la memoria residente de `/proc/<pid>/status` y la memoria proporcional y privada de `/proc/<pid>/smaps_rollup`. El servicio Python se contabilizó aparte.

| Medida de la nueva comprobación | Resultado |
| --- | ---: |
| CPU media de Spotify respecto al equipo completo | **3,74 %** |
| CPU de Spotify en cada intervalo | 3,21 %, 4,16 % y 3,85 % |
| CPU media adicional del servicio auxiliar | 0,41 % |
| Suma de memoria residente de los procesos de Spotify, RSS | **2,20 GB** |
| Memoria proporcional atribuible a Spotify, PSS | **1,18 GB** |
| Memoria privada de Spotify | **0,93 GB** |
| Memoria proporcional del servicio auxiliar | 30,6 MB |
| Memoria disponible del equipo al terminar | **27,26 GB** |
| Memoria de Spotify en swap | 0 bytes |
| Temperatura de la GPU en una lectura durante la comprobación | 44 °C |

En esta tabla se usan **GB y MB decimales**: 1 GB = 1 000 000 000 bytes. Las cifras anteriores expresadas en GiB/MiB usan unidades binarias y corresponden a una medición distinta.

El **3,6 % de CPU de la captura coincide aproximadamente con la nueva medición**. Los **2,27 GB** también se acercan a la suma RSS obtenida, aunque no se verificó qué fórmula usa el monitor de la captura. La suma RSS cuenta repetidamente páginas compartidas entre procesos. PSS reparte esas páginas entre los procesos que las comparten y ofrece una estimación más útil de la memoria física atribuible a Spotify: aproximadamente **1,18 GB** en esta muestra. La memoria privada, aproximadamente 0,93 GB, excluye las páginas compartidas.

Los aproximadamente 644 MiB de la tabla inicial fueron la suma de memoria justo después de un reinicio; no representan un límite permanente del cliente. En esta comprobación posterior la suma era 2,20 GB, con música y visualizador activos. El cliente web mantiene recursos y cachés que varían durante su uso.

La memoria proporcional aumentó aproximadamente **10,85 MB en los 30 segundos** observados, durante un cambio de canción. Esta muestra breve no permite confirmar ni descartar una fuga de memoria a largo plazo. No se observó presión de memoria: quedaban unos 27,26 GB disponibles y los procesos de Spotify no tenían memoria en swap. No se realizaron cambios de rendimiento durante esta comprobación.

El procedimiento reproducible está en `Documentos/Spotify-personalizado/medir-rendimiento.py` y las lecturas completas están en `Documentos/Spotify-personalizado/rendimiento-verificacion-actual.json`.

## 6. Corrección visual en la ventana pequeña

La captura proporcionada mostraba Spotify en una ventana restaurada. El botón propio **Vista del video** tenía una posición fija y se superponía al botón Inicio. La distribución de la barra inferior también podía dejar poco espacio para títulos y controles.

Se realizaron estas correcciones:

1. Se integró el botón dentro de la barra de navegación, inmediatamente después de Inicio, para que participe en la distribución normal.
2. Se ocultó su texto por debajo de 1100 px de ancho y se conservaron el icono, la descripción accesible y el texto al pasar el cursor.
3. Se añadió un observador de cambios de la barra para recolocarlo cuando Spotify vuelve a crear sus elementos.
4. En ventanas de hasta 1100 px, se distribuyeron las zonas de la barra inferior mediante una cuadrícula con columnas que pueden encogerse y se retiraron los anchos mínimos que provocaban desbordamientos.
5. Se limitaron los contenedores de canción y artista y se configuraron títulos largos con puntos suspensivos.
6. Se añadieron reglas para ventanas de menor altura y para disposiciones estrechas de la vista inmersiva, conservando controles y letras.

Antes de editar se guardaron `videoglass.js` y `user.css` en `/home/diego/Backups/spotify-personalizado/antes-correccion-ventana/`. Después se reaplicó Spicetify y se recargó el cliente.

### Verificación de esta corrección

| Comprobación | Resultado |
| --- | --- |
| Biblioteca a 800 × 600 | Botón separado de Inicio; barra inferior dentro de la ventana; sin desbordamiento horizontal del documento |
| Vista inmersiva a 800 × 600 | Carátula, controles, tiempo y letras visibles dentro de la ventana |
| Biblioteca a 1200 × 800 | Botón con texto visible y separado de Inicio; ancho del documento correcto |
| Minimización real | `document.hidden` pasó a `true` |
| Restauración | La ventana volvió a estar visible y se restauró su tamaño original |
| Intento de tamaño 640 × 560 | Spotify mantuvo su mínimo real de 800 × 600; no se considera una prueba real a 640 px |
| Cierre de diagnóstico | Puerto temporal `9222` cerrado |
| Apertura normal final | Misma canción y reproducción activa; se recuperó la posición tras el reinicio |
| Servicio local final | `/health` respondió correctamente; captura inactiva con la vista cerrada |

Las capturas denominadas `vista-640-corregida.png` y `ventana-640-corregida.png` corresponden al intento de reducir más la ventana: su tamaño real sigue siendo 800 × 600. Los datos efectivos están registrados en `validacion-ventana.json`.

### Capturas del resultado

Biblioteca corregida, ventana de 800 × 600:

![Spotify con la barra y el botón alineados a 48 píxeles](Spotify-personalizado/barra-alineada-pequena.png)

Vista del video en la misma ventana:

![Vista inmersiva adaptada a la ventana pequeña](Spotify-personalizado/vista-pequena-corregida.png)

### Corrección posterior: altura y separación de los botones

Después de la primera corrección se recibieron dos nuevas capturas de la barra superior. Aunque el botón ya no se superponía con Inicio, seguía viéndose desalineado: medía **40 px** de alto frente a los **48 px** de los botones nativos y no tenía separación propia respecto a Inicio. La primera corrección había resuelto la superposición, pero no había igualado esas proporciones.

Se modificó de nuevo `/home/diego/.config/spicetify/Extensions/videoglass.js`:

- Altura, altura mínima y ancho mínimo del botón: **48 px**.
- En ventanas pequeñas, botón circular de **48 × 48 px**, con la etiqueta textual oculta.
- Alineación vertical centrada y `box-sizing: border-box` para incluir el borde en esas medidas.
- Margen inicial de **8 px**. La separación de **8 px** del lado de Buscar la aporta su contenedor nativo, evitando duplicar márgenes.
- Icono de **20 × 20 px**, texto de **13 px** y espaciado interior ajustado al nuevo tamaño.
- En ventanas de más de 1100 px, ampliación del ancho máximo del grupo de navegación a `min(720px, calc(100vw - 560px))`, dejando espacio para los controles laterales y para el campo de búsqueda. Así el botón añadido no consume innecesariamente el ancho de búsqueda en la ventana grande.

Se respaldaron la extensión y este README antes de cambiarlos en `/home/diego/Backups/spotify-personalizado/antes-alineacion-barra/`. Se ejecutó otra vez `spicetify apply -n` y se recargó Spotify.

La comprobación se realizó sobre el cliente abierto, midiendo los rectángulos de los elementos y revisando capturas. En **800 × 600**, **1200 × 800** y **1920 × 1003**, Inicio, el visualizador y el control visible de búsqueda tuvieron **48 px de alto**, la misma coordenada vertical y **8 px de separación entre cada pareja**. Se verificó que había un único botón de acceso, que no existía desbordamiento horizontal del documento y que pulsarlo abría la vista personalizada. Spotify decide si Buscar aparece como icono o campo según el espacio disponible; el ajuste respeta ese comportamiento.

La ventana grande mostró completo el texto de búsqueda después de ampliar el espacio del grupo. Captura de la barra corregida en la ventana grande:

![Barra superior con altura y separación uniformes en la ventana grande](Spotify-personalizado/barra-alineada-grande.png)

Evidencias de esta revisión:

- `barra-alineada-pequena.png`, `barra-alineada-mediana.png` y `barra-alineada-grande.png`.
- `validacion-alineacion.json`: tamaños, posiciones, separaciones y comprobación de apertura.
- `validacion-final-alineacion.json`: comprobación tras volver al inicio normal.

Al terminar se cerró el puerto temporal de depuración **9222** y se abrió Spotify normalmente, conservando la misma canción y su posición. En esta revisión la música estaba **en pausa** al comenzar y se dejó **en pausa** al terminar, respetando ese estado.

## 7. Archivos creados y respaldos

| Ubicación | Contenido |
| --- | --- |
| `/home/diego/.local/share/spotify-personalizado/spotify/` | Copia modificable del cliente oficial |
| `/home/diego/.local/share/spicetify-cli/` | Spicetify CLI 2.45.3 |
| `/home/diego/.local/bin/spicetify` | Acceso al ejecutable de Spicetify |
| `/home/diego/.config/spicetify/config-xpui.ini` | Configuración de aplicación del tema y extensión |
| `/home/diego/.config/spicetify/Themes/VideoGlass/color.ini` | Paleta de colores |
| `/home/diego/.config/spicetify/Themes/VideoGlass/user.css` | Estilos de biblioteca y corrección de la barra inferior |
| `/home/diego/.config/spicetify/Extensions/videoglass.js` | Vista inmersiva, controles, ajustes y optimización |
| `/home/diego/.local/share/spotify-personalizado/visualizer.py` | Audio, letras y puente MPRIS |
| `/home/diego/.config/systemd/user/spotify-videoglass.service` | Servicio auxiliar de usuario |
| `/home/diego/.local/bin/spotify-personalizado` | Lanzador habitual |
| `/home/diego/.local/share/applications/spotify_spotify.desktop` | Acceso del menú y opción de abrir el original |
| `/home/diego/Escritorio/Spotify-personalizado.desktop` | Acceso del escritorio |
| `/home/diego/.cache/spotify-videoglass/lyrics/` | Caché de letras |
| `/home/diego/Backups/spotify-personalizado/config-original/` | Respaldo de preferencias originales; contiene datos privados de sesión |
| `/home/diego/Backups/spotify-personalizado/antes-optimizacion/` | Código anterior a la optimización |
| `/home/diego/Backups/spotify-personalizado/antes-correccion-ventana/` | Código y CSS anteriores a la corrección visual |
| `/home/diego/Backups/spotify-personalizado/antes-alineacion-barra/` | Extensión y README anteriores al ajuste final de altura, separación y ancho de búsqueda |
| `/home/diego/Documentos/Spotify-personalizado/` | Referencias, capturas, registros, mediciones y comprobaciones |

En la carpeta de documentación también están `LEEME.md`, una guía breve; `aplicar.log`, el registro de aplicación; `cdp-check.py`, la herramienta temporal de inspección; y `validacion-final.json`, la comprobación del cierre del puerto y del estado de reproducción. Algunas capturas anteriores documentan etapas intermedias; las dos incluidas arriba muestran la corrección actual.

## 8. Mantenimiento y diagnóstico

### Aplicar cambios de tema o extensión

Tras editar los archivos de VideoGlass:

```bash
/home/diego/.local/bin/spicetify apply -n
```

Cierra y vuelve a abrir Spotify para cargar los cambios. Si se modificó `visualizer.py`, reinicia el servicio auxiliar:

```bash
systemctl --user restart spotify-videoglass.service
```

### Revisar el servicio

```bash
systemctl --user status spotify-videoglass.service --no-pager
journalctl --user -u spotify-videoglass.service -n 30 --no-pager
curl http://127.0.0.1:43891/health
```

Si faltan letras, puede que LRCLIB no tenga esa canción o que falle la conexión. Si el visualizador no reacciona, comprueba que esté habilitado, que la música esté reproduciéndose y que el servicio esté activo. Si necesitas liberar también la memoria del servicio auxiliar después de cerrar Spotify:

```bash
systemctl --user stop spotify-videoglass.service
```

Se iniciará de nuevo al abrir Spotify con el lanzador habitual.

### Actualizaciones

La copia personalizada **no se actualiza automáticamente** cuando se actualiza el Snap. Los estilos y la extensión se comprobaron con las versiones de Spotify y Spicetify indicadas en este documento. Una versión diferente puede necesitar ajustes de compatibilidad.

Para actualizar la copia hay que cerrar Spotify, respaldar primero la instalación y la configuración, copiar la nueva versión oficial y volver a preparar y aplicar Spicetify con una versión compatible. No conviene sobrescribir el respaldo original ni reutilizar sin revisar un respaldo de recursos de otra versión.

## 9. Cómo volver al original

Para usar inmediatamente la instalación original, cierra la copia personalizada y elige **Abrir Spotify original** en las acciones del acceso del menú, o ejecuta:

```bash
/snap/bin/spotify
```

Cerrar primero la instancia personalizada evita que Spotify reutilice la aplicación que ya está abierta.

Para quitar la personalización de la copia conservando esa instalación, cierra Spotify y ejecuta:

```bash
/home/diego/.local/bin/spicetify restore -n
```

Para volver a preparar y aplicar el diseño en esa copia restaurada:

```bash
/home/diego/.local/bin/spicetify backup apply -n
```

Después abre de nuevo Spotify. Estos comandos operan sobre la ruta configurada de la copia; el Snap original sigue disponible. Los respaldos contienen la configuración previa para una recuperación posterior, pero no es necesario reemplazar las preferencias para simplemente abrir el original.

## 10. Fuentes de los componentes

- [Proyecto oficial de Spicetify CLI](https://github.com/spicetify/cli).
- [Publicación de Spicetify 2.45.3 utilizada](https://github.com/spicetify/cli/releases/tag/v2.45.3).
- [LRCLIB](https://lrclib.net), proveedor de letras.
- Referencias visuales locales enumeradas en la sección 2.

El código completo de la personalización está en las rutas de la sección 7. Este README registra el procedimiento, las decisiones, los errores corregidos, las comprobaciones y las limitaciones del resultado obtenido.


## 11. Entrada y salida animadas y controles más naturales · 11 de octubre de 2026

**La transición de esta primera revisión fue sustituida por la corrección de la sección 12.**

Se ajustó la vista inmersiva a petición de Diego para que abrirla y cerrarla tenga una pequeña animación y la carátula, los controles y la barra de progreso se vean más grandes y cercanos a Spotify.

### Cambios aplicados

- **Entrada de 300 ms**: fundido del fondo y un desplazamiento de 18 px con una escala inicial de 0,985 para el contenido.
- **Salida de 220 ms**: fundido y desplazamiento de 12 px; la biblioteca aparece detrás y la vista se oculta después de terminar la animación.
- Las animaciones anteriores se cancelan al invertir la acción y su finalización se protege para que un cierre antiguo no oculte una apertura nueva. Se respeta la preferencia del sistema de reducir movimiento.
- La carátula mantiene su proporción cuadrada antes de aplicar círculo, flor o esquinas redondeadas. Su espacio creció de un máximo de 310 px a 410 px y se adapta al espacio disponible. En una ventana de 1920 × 1003, el tamaño base de la imagen circular pasa de unos 223 px a 274 px, antes de la escala reactiva del audio. En 800 × 600 su base es de unos 156 px frente a unos 130 px anteriores.
- Se reorganizaron los controles: **los botones de transporte quedan encima de la barra**, siguiendo la disposición del cliente nativo. El orden de los botones sigue siendo aleatorio, anterior, reproducción, siguiente y repetición.
- El botón blanco de reproducción mide **64 × 64 px** en la ventana grande y **56 × 56 px** en ventanas pequeñas o en la vista compacta. Los iconos de transporte usan proporciones y trazados correspondientes al cliente instalado, con tamaño de 22 px y 26 px para reproducir o pausar.
- Los controles activos usan verde y un pequeño indicador inferior. Se conservaron las formas de carátula, el visualizador, los ajustes y la vista compacta.
- La barra de progreso tiene una pista de **4 px** y una zona de interacción de **28 px**, avance blanco, color verde al usarla y un tirador blanco que aparece al pasar el cursor o enfocar con el teclado. La barra de volumen usa el mismo tratamiento.
- A la izquierda aparece el tiempo transcurrido y a la derecha el **tiempo restante con signo negativo**. Al pasar el cursor por el tiempo restante también se puede consultar la duración total.
- Arrastrar la barra actualiza localmente el tiempo y el avance; al soltarla envía una sola orden de salto. Las actualizaciones del reproductor respetan el arrastre y continúan aunque la barra conserve el foco después de usarla.
- La vista gestiona el foco y la interacción con la biblioteca durante la apertura y el cierre. Las animaciones afectan únicamente a opacidad y transformaciones; se conserva el límite anterior de 24 fps para el visualizador de audio.

Se modificó `/home/diego/.config/spicetify/Extensions/videoglass.js` y se aplicó con `spicetify apply -n`. El respaldo de la extensión y de este README está en:

`/home/diego/Backups/spotify-personalizado/antes-animacion-controles-20261011-192650/`.

### Verificación en Spotify

- Se validó la sintaxis con el motor JavaScript del propio cliente antes de aplicar los cambios.
- Se midieron ventanas reales de **800 × 600**, **1200 × 800**, **800 × 900** y **1920 × 1003**, tanto con letras como sin ellas: ocho disposiciones. La carátula mantuvo su proporción y los elementos de la canción quedaron dentro de la ventana, sin desbordamiento horizontal.
- Se comprobó la vista compacta y su botón de reproducción de 56 px.
- Se observaron valores intermedios de opacidad durante entrada y salida, se comprobó su finalización y que no quedaran animaciones pendientes.
- Se realizaron aperturas y cierres rápidos: la última apertura quedó visible, con la biblioteca oculta correctamente y sin una animación antigua pendiente.
- Con la preferencia de reducir movimiento activada temporalmente, la apertura y el cierre fueron inmediatos.
- El arrastre no envió órdenes de salto durante la previsualización. Soltar la barra envió **una sola orden**, y la posición leída por MPRIS estuvo a unos 519 ms de la elegida mientras seguía la reproducción.
- La barra siguió actualizándose con el foco mantenido después de usarla.

Mediciones y comprobaciones: `Spotify-personalizado/validacion-animacion-controles.json`. Herramientas locales: `verificar-animacion.py`, `window-check.py` y el `cdp-check.py` existente. Estas herramientas requieren una sesión temporal de diagnóstico local; no forman parte del inicio habitual de Spotify.

Capturas de la vista actual:

![Vista inmersiva con controles más grandes y letras en la ventana grande](Spotify-personalizado/vista-animacion-grande-letras.png)

![Vista inmersiva con carátula, controles y progreso en 800 × 600](Spotify-personalizado/vista-animacion-pequena.png)

Al terminar se cerró el diagnóstico temporal en el puerto **9222** y se abrió Spotify normalmente, con la vista inmersiva y la ventana maximizada. Se verificó que la misma canción seguía reproduciéndose y que se conservaron el volumen y la posición recuperada al reiniciar. El servicio auxiliar respondió correctamente. El cierre y el estado de reproducción están registrados en `Spotify-personalizado/validacion-final-animacion.json`.


## 12. Corrección de la transición que parecía instantánea · 11 de octubre de 2026

Diego indicó que la entrada y la salida seguían apareciendo de golpe. La primera comprobación había medido estados y valores de opacidad; en esta revisión se capturaron también los fotogramas realmente dibujados al pulsar los botones del cliente.

Se sustituyeron las animaciones anteriores por transiciones CSS de **toda la vista**, incluyendo fondo, carátula, controles y letras:

- **Entrada de 460 ms** y **salida de 380 ms**, con una curva que reparte mejor el cambio durante el efecto.
- Desplazamiento vertical de **32 px** y escala inicial/final de **0,97**, combinados con el fundido.
- Dos fotogramas de preparación antes de iniciar la transición, separando la aparición del contenedor y el cambio visual.
- Al salir se prepara primero la biblioteca debajo de la vista aún opaca. La vista se oculta al terminar el fundido, evitando retirar de golpe el contenido visible.
- Se conservó la protección frente a aperturas y cierres rápidos, la preferencia de reducir movimiento y la limpieza de capas de animación al terminar. Un tiempo de respaldo evita dejar la vista en un estado intermedio si la transición se interrumpe.

La corrección está en `~/.config/spicetify/Extensions/videoglass.js` y se aplicó con `spicetify apply -n`. Respaldo anterior a esta revisión:

`/home/diego/Backups/spotify-personalizado/antes-corregir-transicion-20261011-194838/`.

### Comprobación visible

Se pulsaron el botón **Vista del video** y el botón de cierre mediante el cliente abierto. Se capturaron **92 fotogramas** alrededor de la entrada y **85** alrededor de la salida. La inspección de las imágenes mostró la mezcla progresiva entre biblioteca y vista inmersiva. Una comparación de píxeles identificó **15 fotogramas intermedios de entrada** y **13 de salida**, además de los estados inicial y final.

Se comprobaron también ocho cambios rápidos de apertura/cierre: la apertura final quedó visible, sin transiciones pendientes y con `will-change` de nuevo en `auto`. Con reducción de movimiento activada temporalmente, el cierre y la apertura fueron inmediatos. Se restauró la preferencia real de Spotify después de la prueba.

Evidencias: `Spotify-personalizado/validacion-transicion-visible.json`, la herramienta `comprobar-transicion-visible.py` y los fotogramas en `Spotify-personalizado/transicion-fotogramas/`.

Fotograma intermedio de entrada:

![Fundido visible de la biblioteca hacia la vista personalizada](Spotify-personalizado/transicion-fotogramas/transicion-enter-50.jpg)

Fotograma intermedio de salida:

![Fundido visible de la vista personalizada hacia la biblioteca](Spotify-personalizado/transicion-fotogramas/transicion-exit-35.jpg)

Se cerró el puerto de diagnóstico **9222** y se dejó Spotify abierto normalmente en la biblioteca para entrar con el botón habitual. La misma canción, el estado de reproducción y el volumen se conservaron. La extensión instalada coincide con el código corregido. Comprobación final: `Spotify-personalizado/validacion-final-transicion-visible.json`.


## 13. Procedimiento completo para reproducir el resultado final

Esta guía reúne la instalación y las correcciones en el orden necesario. Los comandos corresponden a **Diego, Ubuntu, Spotify Snap 99 / 1.2.95.453.g0eeebbed y Spicetify 2.45.3**. Las rutas están escritas para `/home/diego`; en otro usuario hay que adaptar también las rutas dentro del servicio, la configuración y los lanzadores.

Si la instalación actual ya funciona y solo necesitas reaplicar el código final, sigue el paso 5 conservando el archivo de configuración actual y después ejecuta `spicetify apply -n`. Reinicia también `spotify-videoglass.service` si copiaste el servicio Python, cierra Spotify y vuelve a abrirlo con el lanzador habitual. Para reconstruir la copia del cliente desde el original, sigue todos los pasos.

### Paso 1. Cerrar la aplicación y respaldar la instalación anterior

Cierra Spotify desde su ventana antes de copiar o sustituir archivos. En una reconstrucción, detén también el servicio auxiliar:

```bash
systemctl --user stop spotify-videoglass.service
```

Guarda las preferencias, la configuración de Spicetify, el servicio y el lanzador. Para reconstruir la copia, conserva las carpetas anteriores mediante un cambio de ubicación:

```bash
respaldo_spoty="/home/diego/Backups/spotify-personalizado/reconstruccion-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$respaldo_spoty"

if [ -d /home/diego/.config/spotify ]; then
    cp -a /home/diego/.config/spotify "$respaldo_spoty/preferencias"
fi
if [ -f /home/diego/.config/systemd/user/spotify-videoglass.service ]; then
    cp -a /home/diego/.config/systemd/user/spotify-videoglass.service "$respaldo_spoty/"
fi
if [ -f /home/diego/.local/bin/spotify-personalizado ]; then
    cp -a /home/diego/.local/bin/spotify-personalizado "$respaldo_spoty/"
fi
if [ -f /home/diego/.local/share/applications/spotify_spotify.desktop ]; then
    cp -a /home/diego/.local/share/applications/spotify_spotify.desktop "$respaldo_spoty/"
fi
if [ -d /home/diego/.local/share/spotify-personalizado ]; then
    mv /home/diego/.local/share/spotify-personalizado "$respaldo_spoty/instalacion-anterior"
fi
if [ -d /home/diego/.config/spicetify ]; then
    mv /home/diego/.config/spicetify "$respaldo_spoty/spicetify-anterior"
fi
```

Este paso de reconstrucción mueve las carpetas existentes al respaldo. No hace falta repetirlo para cada ajuste de CSS o JavaScript. Las preferencias conservan datos de la sesión; permanecen en su carpeta habitual y en el respaldo privado.

### Paso 2. Comprobar las dependencias locales

La personalización necesita Python con GI, GLib/Gio y GStreamer. El servicio usa los elementos `pulsesrc`, `audioconvert`, `spectrum` y `fakesink`. En este equipo, `pulsesrc` y `spectrum` están disponibles a través de los complementos de GStreamer instalados; `libgstpulseaudio.so` pertenece a `gstreamer1.0-plugins-good`.

Comprueba primero las dependencias:

```bash
/usr/bin/python3 - <<'PY_DEPS'
import gi
gi.require_version('Gst', '1.0')
from gi.repository import Gst, GLib, Gio
Gst.init(None)
for nombre in ('pulsesrc', 'audioconvert', 'spectrum', 'fakesink'):
    disponible = Gst.ElementFactory.find(nombre) is not None
    print(nombre, 'OK' if disponible else 'FALTA')
PY_DEPS
```

Si faltan componentes en un equipo Ubuntu equivalente, instala los paquetes necesarios y repite la comprobación:

```bash
sudo apt update
sudo apt install python3 python3-gi gir1.2-gstreamer-1.0 \
    gstreamer1.0-plugins-base gstreamer1.0-plugins-good \
    curl tar desktop-file-utils
```

El servicio se ejecuta dentro de la sesión del usuario, con D-Bus y una salida de audio compatible con PulseAudio o con la compatibilidad PulseAudio de PipeWire. Las herramientas opcionales de imágenes y medición usan además `python3-pil` y `libx11-6`.

### Paso 3. Preparar una copia escribible del Spotify original

Comprueba qué revisión y versión contiene el Snap:

```bash
readlink /snap/spotify/current
sed -n '1,5p' /snap/spotify/current/meta/snap.yaml
```

Para reproducir exactamente la versión probada, la revisión debe ser **99** y la versión **1.2.95.453.g0eeebbed**. Si el Snap ya contiene otra versión, la copia y Spicetify necesitarán una nueva comprobación de compatibilidad.

Copia los archivos del cliente a la carpeta del usuario:

```bash
mkdir -p /home/diego/.local/share/spotify-personalizado
cp -a /snap/spotify/current/usr/share/spotify \
    /home/diego/.local/share/spotify-personalizado/spotify
chmod -R u+rwX /home/diego/.local/share/spotify-personalizado/spotify
```

En la primera instalación, si todavía no existe `/home/diego/.config/spotify`, copia las preferencias originales de la revisión probada:

```bash
if [ ! -d /home/diego/.config/spotify ]; then
    mkdir -p /home/diego/.config
    cp -a /home/diego/snap/spotify/99/.config/spotify /home/diego/.config/spotify
fi
```

Debe existir `/home/diego/.config/spotify/prefs` antes de preparar Spicetify. Si no hay preferencias originales que copiar, abre la copia del cliente una vez, inicia sesión y vuelve a cerrarla para generar la configuración.

### Paso 4. Instalar la versión de Spicetify utilizada

Si `/home/diego/.local/bin/spicetify -v` ya devuelve **2.45.3**, puedes usar esa instalación. Para una instalación nueva:

```bash
descarga_spoty="$(mktemp -d /tmp/spicetify-videoglass.XXXXXX)"
curl -fL \
    https://github.com/spicetify/cli/releases/download/v2.45.3/spicetify-2.45.3-linux-amd64.tar.gz \
    -o "$descarga_spoty/spicetify.tar.gz"
mkdir -p /home/diego/.local/share/spicetify-cli /home/diego/.local/bin
tar -xzf "$descarga_spoty/spicetify.tar.gz" \
    -C /home/diego/.local/share/spicetify-cli
ln -sfn /home/diego/.local/share/spicetify-cli/spicetify \
    /home/diego/.local/bin/spicetify
/home/diego/.local/bin/spicetify -v
```

La distribución incluye el mapa CSS y los archivos auxiliares del CLI. En el trabajo original se usó el mapa local cuando el remoto no pudo obtenerse.

### Paso 5. Copiar el código del resultado final

La implementación completa está preservada en [fuentes-finales-2026-10-11](Spotify-personalizado/fuentes-finales-2026-10-11/LEEME.md). Incluye:

| Archivo de las fuentes | Destino y función |
| --- | --- |
| `VideoGlass/color.ini` | Paleta del tema en `~/.config/spicetify/Themes/VideoGlass/` |
| `VideoGlass/user.css` | Biblioteca y adaptación de su barra inferior |
| `Extensions/videoglass.js` | Vista completa, controles, letras, tamaños y transición definitiva |
| `visualizer.py` | Servicio de espectro, letras y control MPRIS |
| `config-xpui.ini` | Configuración de aplicación; Spicetify generará su propio estado de respaldo |
| `spotify-videoglass.service` | Servicio de usuario |
| `spotify-personalizado` | Lanzador que inicia el servicio y el cliente |
| `spotify_spotify.desktop` | Acceso del menú y acción para abrir el Snap original |

Comprueba los hashes de las fuentes y copia los archivos:

```bash
fuentes_spoty=/home/diego/Documentos/Spotify-personalizado/fuentes-finales-2026-10-11
cd "$fuentes_spoty"
sha256sum -c SHA256SUMS

mkdir -p /home/diego/.config/spicetify/Themes/VideoGlass \
    /home/diego/.config/spicetify/Extensions \
    /home/diego/.local/share/spotify-personalizado
cp -a "$fuentes_spoty/VideoGlass/." /home/diego/.config/spicetify/Themes/VideoGlass/
cp "$fuentes_spoty/Extensions/videoglass.js" /home/diego/.config/spicetify/Extensions/
cp "$fuentes_spoty/visualizer.py" /home/diego/.local/share/spotify-personalizado/
```

**Para una preparación nueva después de los pasos 1–4**, instala también el archivo de configuración:

```bash
cp "$fuentes_spoty/config-xpui.ini" /home/diego/.config/spicetify/config-xpui.ini
```

**Para actualizar una copia que ya está preparada**, conserva su `config-xpui.ini` y su sección `[Backup]`. Comprueba que use las rutas, el tema y la extensión indicados en la sección 3. No sustituyas ese estado por el archivo de configuración de instalación nueva.

### Paso 6. Mantener las decisiones de implementación que dan el resultado final

Al usar los archivos del paso 5, estos cambios ya están incluidos. Si se continúa editando la extensión, deben conservarse juntos:

1. **Estado y controles:** leer duración, posición y reproducción mediante el servicio MPRIS. Interpolar la posición entre consultas; no recuperar la lectura anterior que dependía del estado desactualizado de `Spicetify.Player.origin`.
2. **Audio y letras:** mantener las 64 bandas de salida de audio, las solicitudes de espectro solo cuando se necesitan y la caché de letras de LRCLIB. Detener la captura tras la inactividad.
3. **Rendimiento:** limitar el canvas a 24 fps, actualizar los controles como máximo cada 250 ms, cuantizar la escala de la carátula y suspender dibujo y solicitudes al pausar, cerrar o minimizar.
4. **Acceso de la barra superior:** montar el botón después de Inicio, dentro de su distribución normal; usar 48 px de altura y 8 px de separación. Ocultar su texto en ventanas de hasta 1100 px y mantener el observador que lo vuelve a colocar si Spotify recrea la barra.
5. **Tamaños:** conservar `aspect-ratio: 1` y altura automática en la carátula, el espacio de hasta 410 px, las reglas de ventana baja, el botón de reproducción de 64 px y sus variantes de 56 px. Mantener los iconos de transporte en `viewBox="0 0 16 16"` y el orden de transporte, progreso y volumen.
6. **Progreso:** conservar una pista de 4 px dentro de una zona interactiva de 28 px; actualizar `--fill` para el avance y mostrar el tirador al pasar el cursor o enfocar. Mostrar tiempo transcurrido y restante; usar `input` para previsualizar y `change` para enviar el salto una sola vez. Mantener los bloqueos de arrastre y la actualización posterior aunque el control conserve el foco.
7. **Transición definitiva:** conservar el estado cerrado con opacidad 0, desplazamiento de 32 px y escala 0,97; separar `.open` de `.vg-visible`. La clase `.vg-transitioning` limita `will-change` al tiempo del efecto. Usar 460 ms al entrar y 380 ms al salir, con `cubic-bezier(.4,0,.2,1)`.
8. **Secuencia de transición:** al abrir, montar la vista antes de cambiar `.vg-visible`; al cerrar, mostrar primero la biblioteca detrás de la vista aún opaca. Esperar dos `requestAnimationFrame` antes del cambio visual. Ocultar la biblioteca solo al terminar la entrada y retirar `.open` solo al terminar la salida.
9. **Interrupciones:** incrementar `transitionId` en cada cambio para descartar finalizaciones antiguas, limpiar el temporizador anterior y conservar el tiempo de respaldo `duration + 180`. Restaurar el foco al salir y respetar `prefers-reduced-motion`.

La primera versión de 300/220 ms animaba opacidad y la disposición interior mediante Web Animations. Diego no percibió el efecto. El código final usa la transición de toda la vista descrita arriba; la prueba debe observar los fotogramas dibujados y no limitarse a comprobar valores de estilo.

### Paso 7. Instalar el servicio y los lanzadores

```bash
mkdir -p /home/diego/.config/systemd/user \
    /home/diego/.local/bin /home/diego/.local/share/applications
cp "$fuentes_spoty/spotify-videoglass.service" /home/diego/.config/systemd/user/
cp "$fuentes_spoty/spotify-personalizado" /home/diego/.local/bin/
chmod u+x /home/diego/.local/bin/spotify-personalizado
cp "$fuentes_spoty/spotify_spotify.desktop" /home/diego/.local/share/applications/
systemctl --user daemon-reload
desktop-file-validate /home/diego/.local/share/applications/spotify_spotify.desktop
update-desktop-database /home/diego/.local/share/applications
```

El servicio se inicia desde el lanzador y se reinicia si falla. Su archivo no tiene una sección `[Install]` y no se habilita al inicio de sesión.

El acceso del escritorio fue creado en la instalación original, pero en la revisión de esta documentación el archivo `/home/diego/Escritorio/Spotify-personalizado.desktop` ya no estaba presente. Para recrearlo de manera opcional:

```bash
mkdir -p /home/diego/Escritorio
cp /home/diego/.local/share/applications/spotify_spotify.desktop \
    /home/diego/Escritorio/Spotify-personalizado.desktop
sed -i 's/^Name=Spotify$/Name=Spotify personalizado/' \
    /home/diego/Escritorio/Spotify-personalizado.desktop
chmod u+x /home/diego/Escritorio/Spotify-personalizado.desktop
gio set /home/diego/Escritorio/Spotify-personalizado.desktop metadata::trusted true
```

Si el escritorio solicita confianza para ese acceso, selecciona **Permitir lanzar** en su menú contextual.

### Paso 8. Preparar y aplicar Spicetify

Para la copia nueva creada desde el Snap y la configuración nueva del paso 5:

```bash
/home/diego/.local/bin/spicetify backup apply -n
```

Para reaplicar cambios sobre la copia actual ya preparada:

```bash
/home/diego/.local/bin/spicetify apply -n
```

Ejecuta el CLI como Diego. Sus rutas deben apuntar a la copia escribible y a `/home/diego/.config/spotify/prefs`. El sufijo `-n` permite controlar cuándo se reinicia la aplicación.

Después, abre la aplicación con el lanzador:

```bash
/home/diego/.local/bin/spotify-personalizado
```

Si modificas el servicio Python después de iniciarlo, reinícialo:

```bash
systemctl --user restart spotify-videoglass.service
```

Si modificas CSS o JavaScript, reaplica Spicetify y cierra y vuelve a abrir Spotify. Una instancia anterior abierta puede reutilizarse y seguir mostrando el código anterior.

### Paso 9. Configurar el aspecto de las últimas capturas

Entra con **Vista del video** o **Ctrl + Alt + V**. En la rueda de ajustes, usa estos valores si quieres el mismo aspecto empleado en las últimas comprobaciones:

| Ajuste | Valor |
| --- | --- |
| Visualizador | Activado, circular |
| Carátula | Visible, circular |
| Sensibilidad | 115 % |
| Desenfoque | 36 px |
| Oscuridad | 49 % |
| Saturación | 183 % |
| Letras | Activadas; se pueden ocultar con su botón |

Estos ajustes pertenecen al almacenamiento local del cliente, no al archivo del tema. La carátula y los colores de fondo cambian con la canción; la intensidad del visualizador depende del audio.

### Paso 10. Verificar el uso normal y la transición

Comprueba el servicio y la comunicación con Spotify:

```bash
systemctl --user status spotify-videoglass.service --no-pager
curl -fsS http://127.0.0.1:43891/health
curl -fsS http://127.0.0.1:43891/player
```

Comprueba estas acciones en la aplicación:

1. Pulsa el botón de ondas junto a Inicio: la vista debe entrar con fundido y desplazamiento.
2. Pulsa el cierre o Esc: la biblioteca debe reaparecer gradualmente durante la salida.
3. Abre y cierra varias veces seguidas: la última acción debe quedar aplicada, sin vista transparente ni biblioteca bloqueada.
4. Revisa 800 × 600 y una ventana grande, con letras activadas y desactivadas; la carátula debe conservar su proporción y los controles deben quedar dentro de la ventana.
5. Comprueba reproducir/pausar, posición, volumen, aleatorio y repetición.
6. Arrastra la barra: el tiempo debe previsualizarse; al soltar, debe cambiar la posición. Después, el avance debe seguir actualizándose aunque el control conserve el foco.
7. Minimiza y restaura la ventana para comprobar que el visualizador se suspende y vuelve a funcionar.

Si no se percibe la animación, comprueba que la aplicación cargó el código final y que la preferencia de reducir movimiento no está activa. La transición definitiva debe mezclar visualmente las dos vistas, como en los fotogramas de la sección 12.

### Paso 11. Verificación opcional con fotogramas reales

Esta comprobación usa un diagnóstico temporal de Spotify en `127.0.0.1:9222`. Cierra primero la instancia normal para que el cliente no reutilice una sesión sin ese puerto. Antes de cerrar, anota la canción, la posición, el volumen y si estaba reproduciéndose o en pausa, para recuperar ese estado al terminar.

Abre temporalmente la copia con diagnóstico:

```bash
/home/diego/.local/bin/spotify-personalizado \
    --remote-debugging-port=9222 --remote-debugging-address=127.0.0.1
```

Cuando la aplicación esté cargada y visible, ejecuta desde otra terminal:

```bash
/usr/bin/python3 /home/diego/Documentos/Spotify-personalizado/comprobar-transicion-visible.py
```

La herramienta pulsa los botones reales mediante CDP, captura imágenes de entrada y salida, comprueba la finalización, prueba cambios rápidos y activa temporalmente la emulación de reducir movimiento. Al terminar restaura esa emulación y el estado abierto/cerrado de la vista. Guarda `validacion-transicion-visible.json` y los fotogramas en `transicion-fotogramas/`; ejecutar de nuevo la herramienta reemplaza su informe y los fotogramas con esos nombres.

El campo `passed` verifica el estado final, los cambios rápidos y la presencia de fotogramas. **La inspección visual de las imágenes intermedias confirma el fundido visible.** Los campos `estimated_blend`, `intermediate_rendered_frames` y `rendered_blend_verified` del informe archivado proceden de la comparación adicional de píxeles realizada durante la corrección; esa comparación no la genera automáticamente el script de captura.

En la prueba final archivada se registraron 92 imágenes de entrada y 85 de salida. Se identificaron 15 y 13 fotogramas intermedios, respectivamente, y se verificó que al terminar no había transiciones activas ni `will-change` permanente. El número de fotogramas puede variar en una nueva prueba.

`verificar-animacion.py` documenta las pruebas de tamaños, controles y la primera animación de la sección 11. Para comprobar la transición definitiva usa `comprobar-transicion-visible.py`; las duraciones y el inicio diferido de la versión actual son distintos.

### Paso 12. Volver al inicio normal y mantener el resultado

Cierra la instancia de diagnóstico y abre Spotify con el lanzador normal:

```bash
/home/diego/.local/bin/spotify-personalizado
```

Comprueba que el puerto temporal esté cerrado:

```bash
/usr/bin/python3 - <<'PY_PUERTO'
import socket
with socket.socket() as conexion:
    conexion.settimeout(1)
    abierto = conexion.connect_ex(('127.0.0.1', 9222)) == 0
print('9222 abierto' if abierto else '9222 cerrado')
PY_PUERTO
```

Recupera la misma canción, posición, volumen y estado de reproducción si el reinicio los cambió. El lanzador normal no incluye parámetros de diagnóstico.

Para cambios posteriores, respalda los archivos a editar, aplica el tema y reinicia únicamente los componentes necesarios. Las instrucciones de actualización, diagnóstico y recuperación están en las secciones 8 y 9. El Snap original sigue disponible y la copia personalizada mantiene su propia versión.

### Archivos conservados para reproducir y comprobar

- [Fuentes finales](Spotify-personalizado/fuentes-finales-2026-10-11/LEEME.md), con `manifest.json` y `SHA256SUMS`.
- [Validación de tamaños, controles y primera revisión](Spotify-personalizado/validacion-animacion-controles.json).
- [Validación de la transición visible definitiva](Spotify-personalizado/validacion-transicion-visible.json).
- [Comprobación del inicio normal tras la corrección](Spotify-personalizado/validacion-final-transicion-visible.json).
- Referencias, capturas y registros de rendimiento conservados en `Spotify-personalizado/`.

La copia de fuentes se creó al actualizar esta documentación; los comandos de reconstrucción y de instalación de dependencias se documentan para su uso posterior y no se ejecutaron durante esta actualización.
