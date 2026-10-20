# Instalar con ayuda de un CLI de IA

Abre tu CLI de IA habitual en la carpeta de ARIOTIFI. Dale acceso a este repositorio y a los destinos de instalación de tu usuario. Puedes pegar este mensaje:

```text
Quiero instalar ARIOTIFI en esta máquina Linux. Lee primero README.md,
docs/INSTALACION.md y scripts/install.py. Detecta mi distribución, arquitectura,
tipo de instalación de Spotify, rutas de preferencias, Spicetify, systemd de
usuario y servidor de audio. No asumas que mi usuario se llama diego.

Prepara las dependencias descritas en la guía. Si Spotify viene de Snap,
prepara una copia escribible en mi carpeta personal, sin superponerla a otra
copia existente. Si falta iniciar sesión, explícame cómo abrirla y continúa
cuando yo termine; no leas ni muestres tokens, cookies o preferencias privadas.

Con Spotify cerrado, ejecuta ./install.sh --check. Resuelve los requisitos y
aplica ./install.sh, pasando --spotify-path y --prefs-path si hacen falta.
Conserva otras extensiones y el estado Backup de Spicetify. No registres
flower-button.js ni wavy-progress.js por separado: ya están en videoglass.js.

Comprueba el servicio, /health y /player con la aplicación abierta. Verifica
que ARIOTIFI aparece en el menú. Ayúdame a probar Inmersiva, letras, reproducción,
visualizador y salida con Esc. No ejecutes los benchmarks históricos ni cambies
mis canciones para hacer pruebas automáticas. Muéstrame la ruta del respaldo,
el comando de restauración y cualquier requisito que siga pendiente.
```

La IA usa los scripts y la guía de este repositorio; no necesitas claves de la API de Spotify para el puente MPRIS. La instalación requiere descargar las dependencias del sistema, Spotify y Spicetify si faltan, y puede requerir que tú introduzcas la contraseña de sudo en tu terminal. El inicio de sesión se hace dentro de Spotify.

Si el CLI propone pasos distintos, contrástalos con la guía manual y comprueba las rutas antes de aplicarlos. En otra versión de Spotify puede ser necesario adaptar CSS o APIs; no hay garantía de compatibilidad automática.
