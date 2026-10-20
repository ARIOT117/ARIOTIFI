# Instalación de ARIOTIFI

## Preparacion en Linux

Necesitas una sesión gráfica Linux con systemd de usuario, D-Bus/MPRIS y servidor de audio PulseAudio o compatibilidad PulseAudio de PipeWire. No está preparado para Windows, macOS ni el reproductor web. Ejecuta ARIOTIFI como tu usuario habitual.

En Ubuntu/Debian, instala los paquetes del backend y las herramientas de preparación:

```bash
sudo apt update
sudo apt install python3 python3-gi gir1.2-glib-2.0 gir1.2-gstreamer-1.0 gstreamer1.0-tools gstreamer1.0-plugins-base gstreamer1.0-plugins-good gstreamer1.0-pulseaudio curl tar
```

Instala Spotify Desktop por los canales de Spotify para tu distribución. El desarrollo se probó con el Snap 1.2.95.453.g0eeebbed y Spicetify 2.45.3. El repositorio no instala Spotify ni cambia tu cuenta.

### Si tienes Spotify Snap

Cierra Spotify. Prepara una copia nueva del cliente en tu carpeta personal:

```bash
mkdir -p "$HOME/.local/share/spotify-personalizado"
test ! -e "$HOME/.local/share/spotify-personalizado/spotify"
cp -a /snap/spotify/current/usr/share/spotify "$HOME/.local/share/spotify-personalizado/spotify"
chmod -R u+w "$HOME/.local/share/spotify-personalizado/spotify"
```

Ejecuta los comandos por separado: si `test` falla porque la carpeta existe, consérvala y revisa si ya está preparada. No copies un cliente nuevo encima de otro parcheado.

Abre directamente esta copia una vez e inicia sesión de forma normal; después ciérrala:

```bash
"$HOME/.local/share/spotify-personalizado/spotify/spotify"
```

Comprueba que se creó `~/.config/spotify/prefs`. La primera apertura puede crear las preferencias sin que necesites completar el inicio de sesión. No subas ese archivo a Git ni se lo pegues a un asistente. Puedes volver a iniciar sesión desde la aplicación.

La copia local no se actualiza automáticamente con Snap. Para actualizarla, restaura primero los parches y prepara una copia limpia; comprueba compatibilidad con Spicetify antes de aplicar de nuevo.

### Instalar Spicetify

Si ya funciona `spicetify -v`, conserva esa instalación y comprueba su compatibilidad con tu cliente. Para reproducir la versión utilizada, estos comandos descargan el archivo oficial para **Linux x86_64**:

```bash
uname -m
mkdir -p "$HOME/.local/share/spicetify-cli" "$HOME/.local/bin"
ariotifi_tmp=$(mktemp -d)
curl -fL https://github.com/spicetify/cli/releases/download/v2.45.3/spicetify-2.45.3-linux-amd64.tar.gz -o "$ariotifi_tmp/spicetify.tar.gz"
tar -xzf "$ariotifi_tmp/spicetify.tar.gz" -C "$HOME/.local/share/spicetify-cli"
ln -sfn "$HOME/.local/share/spicetify-cli/spicetify" "$HOME/.local/bin/spicetify"
"$HOME/.local/bin/spicetify" -v
```

Si `uname -m` no dice `x86_64`, descarga el artefacto correspondiente a tu arquitectura desde las publicaciones de Spicetify. No ejecutes el binario amd64 en otra arquitectura. No se afirma que estas versiones históricas sean las más recientes.

## Instalacion asistida por el script

Desde la raíz del repositorio, con Spotify cerrado:

```bash
./install.sh --check
./install.sh
```

`--check` no escribe archivos. Si no pasa, resuelve los requisitos indicados antes de continuar. La instalación crea un respaldo en `~/.local/state/ariotifi/backups/FECHA/` y muestra el comando exacto para restaurarlo. Respeta otras extensiones configuradas y usa solo `videoglass.js` para cargar este proyecto; FlowerButton y WavyProgress ya están dentro del bundle.

Los destinos habituales son:

| Archivo | Destino |
| --- | --- |
| `Extensions/*.js` | `~/.config/spicetify/Extensions/` |
| `VideoGlass/*` | `~/.config/spicetify/Themes/VideoGlass/` |
| `visualizer.py` | `~/.local/share/spotify-personalizado/visualizer.py` |
| Servicio | `~/.config/systemd/user/spotify-videoglass.service` |
| Lanzador | `~/.local/bin/spotify-personalizado` |
| Entrada del menú | `~/.local/share/applications/ariotifi.desktop` |

`apply.sh` es un acceso al mismo instalador para actualizaciones. En una instalación preparada reaplica el tema sin borrar el estado `[Backup]`. No importa preferencias privadas ni descarga canciones. No ejecuta las pruebas históricas.

## Instalacion-manual

Completa primero la preparación y la instalación de Spicetify. Los comandos siguientes se ejecutan desde la raíz de ARIOTIFI. Cierra Spotify y guarda un respaldo propio de `~/.config/spicetify`, del servicio y del backend antes de reemplazarlos; la vía manual no crea el respaldo de `revert.sh`.

```bash
mkdir -p "$HOME/.config/spicetify/Extensions" "$HOME/.config/spicetify/Themes/VideoGlass" "$HOME/.config/systemd/user" "$HOME/.local/bin" "$HOME/.local/share/spotify-personalizado"
cp Extensions/*.js "$HOME/.config/spicetify/Extensions/"
cp VideoGlass/color.ini VideoGlass/user.css "$HOME/.config/spicetify/Themes/VideoGlass/"
cp visualizer.py "$HOME/.local/share/spotify-personalizado/visualizer.py"
cp config/spotify-videoglass.service "$HOME/.config/systemd/user/spotify-videoglass.service"
cp config/spotify-personalizado "$HOME/.local/bin/spotify-personalizado"
chmod u+x "$HOME/.local/bin/spotify-personalizado"
```

El lanzador manual usa `~/.local/share/spotify-personalizado/spotify/spotify`; edítalo si elegiste otra ubicación. El servicio usa `%h`, que systemd sustituye por tu carpeta personal.

Configura Spicetify mediante su CLI para conservar sus datos de respaldo:

```bash
spicetify_cli="$HOME/.local/bin/spicetify"
"$spicetify_cli" config spotify_path "$HOME/.local/share/spotify-personalizado/spotify" prefs_path "$HOME/.config/spotify/prefs"
"$spicetify_cli" config current_theme VideoGlass color_scheme Base inject_css 1 replace_colors 1 inject_theme_js 1 overwrite_assets 0
"$spicetify_cli" config extensions videoglass.js
"$spicetify_cli" config disable_sentry 1 disable_ui_logging 1 remove_rtl_rule 1 expose_apis 1
```

Ajusta `spicetify_cli` si tu binario está en otra ruta. Revisa `config/config-xpui.ini.example` para los otros valores usados en el equipo original. Si tienes más extensiones, conserva sus nombres en `extensions`, separados por `|`; no registres por separado `flower-button.js` ni `wavy-progress.js`.

En una copia del cliente nueva:

```bash
"$spicetify_cli" backup apply -n
```

En una copia ya preparada, usa `"$spicetify_cli" apply -n`. No reemplaces su sección `[Backup]` con la de otra máquina.

```bash
systemctl --user daemon-reload
systemctl --user restart spotify-videoglass.service
"$HOME/.local/bin/spotify-personalizado"
```

Para añadir un acceso al menú a mano, crea `~/.local/share/applications/ariotifi.desktop` con:

```ini
[Desktop Entry]
Type=Application
Name=ARIOTIFI
Exec=/home/TU_USUARIO/.local/bin/spotify-personalizado %U
Icon=spotify
Terminal=false
Categories=Audio;Music;Player;AudioVideo;
StartupWMClass=Spotify
```

Sustituye `/home/TU_USUARIO` por tu ruta real; los archivos `.desktop` no expanden `$HOME` ni `~`.

## Diagnostico-y-restauracion

Abre la aplicación desde el lanzador para iniciar también el servicio. Comprueba:

```bash
systemctl --user status spotify-videoglass.service
curl -fsS http://127.0.0.1:43891/health
curl -fsS http://127.0.0.1:43891/player
journalctl --user -u spotify-videoglass.service -n 40 --no-pager
```

`/health` devuelve `ok: true` si el puente responde. Es normal que el capturador esté inactivo al cerrar o pausar la vista. `/player` necesita Spotify abierto y disponible mediante MPRIS. Si no hay visualizador, comprueba la salida de audio, los plugins `pulsesrc` y `spectrum`, y reproduce música. Si no hay letras, prueba otra canción y revisa conexión con LRCLIB.

Si ves Spotify sin cambios, cierra todas sus instancias y abre la copia local, comprueba la ruta configurada y reaplica Spicetify. El cliente Snap original sigue disponible en `/snap/bin/spotify`, con todas las copias cerradas antes de abrirlo.

Para deshacer una instalación por script, usa la ruta que imprimió el instalador:

```bash
./revert.sh "$HOME/.local/state/ariotifi/backups/FECHA"
```

Se restauran los archivos administrados anteriores y se reaplica el tema previo si lo había. Esto requiere que los respaldos originales de Spicetify sigan presentes. No borres su carpeta Backup durante la instalación. Si solo quieres retirar todos los parches del cliente actual:

```bash
"$HOME/.local/bin/spicetify" restore -n
systemctl --user stop spotify-videoglass.service
```

Después cierra y abre Spotify. Para recuperar una instalación manual restaura también las copias de archivos que guardaste antes de instalar.

## Widget del panel

La configuración opcional de Flower Music se instala por separado y requiere GNOME Shell 50. Sigue [la guía del widget](../widget/README.md), que incluye instalación manual, respaldo y restauración.
