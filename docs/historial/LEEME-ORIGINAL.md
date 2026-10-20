# Spotify personalizado

Abre **Spotify** desde el menú o ejecuta `/home/diego/.local/bin/spotify-personalizado`. Si has creado el acceso **Spotify personalizado** en el escritorio, también puedes usarlo.

Pulsa el botón verde de ondas junto a **Inicio**, o **Ctrl + Alt + V**, para entrar en la vista del video. En ventanas grandes muestra **Vista del video**; en ventanas pequeñas muestra solo el icono. **Esc** vuelve a tu biblioteca. Spotify recuerda si dejaste esta vista abierta.

El registro completo y el [procedimiento paso a paso del resultado final](../readmi%20personalizacion%20spoty.md#13-procedimiento-completo-para-reproducir-el-resultado-final) están en el README principal. Las [fuentes finales](fuentes-finales-2026-10-11/LEEME.md) conservan el código necesario para reconstruirlo.

La vista entra con un fundido y desplazamiento de **460 ms** y sale en **380 ms**. La carátula y los controles son más grandes; la barra muestra el tiempo restante y permite previsualizar la posición mientras la arrastras.

La rueda de ajustes permite elegir visualizador circular, barras u ondas; carátula circular, en flor o cuadrada; desenfoque, oscuridad y saturación del fondo; letras; y temporizador para pausar la música.

El visualizador de audio está limitado a 24 fotogramas por segundo y se suspende al pausar o minimizar la ventana. Los controles solo se actualizan cuando cambia su valor. Se retiraron los tres puntos decorativos de colores.

**Espacio** pausa/reproduce. **← / →** retrocede/avanza 10 segundos. Puedes hacer clic en una línea sincronizada para reproducir desde ella.

Las letras dependen de la disponibilidad en LRCLIB. El visualizador analiza la salida de audio del equipo y también puede reaccionar a otras aplicaciones que estén reproduciendo audio. No utiliza el micrófono. Deja de capturar el sonido cuando cierras la vista o pausas la música.

La referencia muestra un cliente nativo QML de @shred0s. Esta instalación reproduce su diseño dentro del cliente oficial con Spicetify; conserva el motor web de Spotify y no promete el consumo de memoria del video. No se encontró una descarga pública verificable del proyecto del autor.

## Volver al original

El Spotify original sigue disponible con `/snap/bin/spotify`. En el menú, haz clic derecho en Spotify y selecciona **Abrir Spotify original**. Cierra primero la copia personalizada para que no reutilice esa instancia.

El respaldo de la configuración original está en `/home/diego/Backups/spotify-personalizado/config-original`. La copia personalizable está en `/home/diego/.local/share/spotify-personalizado/spotify`. La configuración del tema y extensión está en `/home/diego/.config/spicetify`.

Para volver al cliente sin personalización conservando esta copia: `/home/diego/.local/bin/spicetify restore -n`. Para aplicar otra vez el diseño: `/home/diego/.local/bin/spicetify backup apply -n`.

No elimina la instalación Snap. La copia personalizada no se actualiza automáticamente con Snap.

Fuente de Spicetify: https://github.com/spicetify/cli
Letras: https://lrclib.net

## Efectos del video del 17 de octubre de 2026

Está seleccionado **Halo rosado · video de referencia** en Ajustes visuales → Visualizador → Estilo. Incluye espectro radial de 96 barras que responde al audio, carátula con borde ondulado, fondo de la carátula difuminado con desplazamiento lento y una pequeña onda en la barra de reproducción. Las letras sincronizadas resaltan la línea actual con una tarjeta translúcida y transiciones suaves. El fondo se detiene al pausar y respeta la preferencia de movimiento reducido.

Los estilos anteriores siguen disponibles en el selector. La copia anterior de la extensión está en `/home/diego/Backups/spotify-personalizado/efectos-2026-10-17/videoglass.js`. Las capturas, fotogramas de referencia y validaciones están en `efectos-referencia-2026-10-17/`. Se verificó audio real y tamaños de 1920, 900, 640 y 480 píxeles de ancho. Las letras requieren disponibilidad en LRCLIB.
