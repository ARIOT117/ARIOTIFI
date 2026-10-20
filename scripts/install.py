#!/usr/bin/env python3
"""Install project-owned files for the current user; never copies login data."""
import argparse
import configparser
import datetime
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
HOME = Path.home()
DATA = Path('.local/share/spotify-personalizado')
CONFIG = Path('.config/spicetify')
FILES = {
    **{str(CONFIG / 'Extensions' / name): 'Extensions/' + name for name in
       ('videoglass.js', 'flower-button.js', 'wavy-progress.js')},
    **{str(CONFIG / 'Themes/VideoGlass' / name): 'VideoGlass/' + name for name in
       ('user.css', 'color.ini')},
    str(DATA / 'visualizer.py'): 'visualizer.py',
    '.config/systemd/user/spotify-videoglass.service': 'config/spotify-videoglass.service',
    '.local/bin/spotify-personalizado': 'config/spotify-personalizado',
}
CONFIG_FILE = '.config/spicetify/config-xpui.ini'
DESKTOP = '.local/share/applications/ariotifi.desktop'
MANAGED = tuple(FILES) + (CONFIG_FILE, DESKTOP)

def cli_path():
    return shutil.which('spicetify') or str(HOME / '.local/bin/spicetify')

def desktop_quote(value):
    # Desktop Exec has its own quoting rules, including a second escape layer.
    return '"' + str(value).replace('\\', '\\\\\\\\').replace('"', '\\\\"').replace('`', '\\\\`').replace('$', '\\\\$').replace('%', '%%') + '"'

def run(*args):
    subprocess.run(args, check=True)

def preflight(spotify, prefs, cli):
    problems = []
    if not (spotify / 'spotify').is_file() or not os.access(spotify / 'spotify', os.X_OK):
        problems.append('Falta el ejecutable Spotify: ' + str(spotify / 'spotify'))
    if not (spotify / 'Apps/xpui.spa').exists() and not (spotify / 'Apps/xpui').is_dir():
        problems.append('No se encuentra Apps/xpui.spa ni Apps/xpui en la copia del cliente.')
    if not os.access(spotify / 'Apps', os.W_OK):
        problems.append('La carpeta Apps debe ser escribible por tu usuario; usa una copia del cliente.')
    if not prefs.is_file():
        problems.append('Faltan las preferencias. Abre esta copia de Spotify una vez: ' + str(prefs))
    if not Path(cli).is_file() or not os.access(cli, os.X_OK):
        problems.append('No se encuentra Spicetify. Consulta docs/INSTALACION.md.')
    probe = subprocess.run(['/usr/bin/python3', '-c',
        "import gi; gi.require_version('Gst','1.0'); from gi.repository import Gst,Gio; "
        "Gst.init(None); assert all(Gst.ElementFactory.find(n) for n in "
        "('pulsesrc','audioconvert','spectrum','fakesink')); Gio.bus_get_sync(Gio.BusType.SESSION,None)"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if probe.returncode:
        problems.append('Faltan GI/GStreamer/plugins o el bus D-Bus de la sesión. Ejecuta desde tu escritorio Linux.')
    if not shutil.which('systemctl'):
        problems.append('Se necesita systemctl y una sesión de usuario systemd.')
    elif subprocess.run(['systemctl', '--user', 'show-environment'],
                        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode:
        problems.append('systemd --user no está disponible en esta sesión.')
    return problems

def main():
    parser = argparse.ArgumentParser(description='Instalar ARIOTIFI en el usuario actual (sin sudo).')
    parser.add_argument('--check', action='store_true', help='Comprobar requisitos sin modificar archivos.')
    parser.add_argument('--spotify-path', type=Path, default=HOME / DATA / 'spotify')
    parser.add_argument('--prefs-path', type=Path, default=HOME / '.config/spotify/prefs')
    args = parser.parse_args()
    spotify, prefs = args.spotify_path.expanduser().resolve(), args.prefs_path.expanduser().resolve()
    cli = cli_path()
    problems = preflight(spotify, prefs, cli)
    if problems:
        print('Requisitos pendientes:\n' + '\n'.join('- ' + p for p in problems), file=sys.stderr)
        return 1
    if args.check:
        print('Requisitos comprobados. No se modificó ningún archivo.')
        return 0
    config = configparser.ConfigParser(interpolation=None, strict=False)
    config.optionxform = str
    config_path = HOME / CONFIG_FILE
    if config_path.exists():
        config.read(config_path)
    # Read before changing anything, and preserve Spicetify Backup and other settings.
    fresh = not config.has_section('Backup') or not config.get('Backup', 'version', fallback='').strip()
    stamp = datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f')
    backup = HOME / '.local/state/ariotifi/backups' / stamp
    backup.mkdir(parents=True)
    manifest = {}
    for rel in MANAGED:
        path = HOME / rel
        manifest[rel] = path.is_file()
        if path.is_file():
            dest = backup / rel
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(path, dest)
    (backup / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print('Respaldo: ' + str(backup), flush=True)
    for rel, source in FILES.items():
        target = HOME / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ROOT / source, target)
    (HOME / '.local/bin/spotify-personalizado').chmod(0o755)
    # Launcher follows the selected client; shell escaping handles spaces and quotes.
    import shlex
    (HOME / '.local/bin/spotify-personalizado').write_text(
        '#!/usr/bin/env bash\nset -euo pipefail\nsystemctl --user start spotify-videoglass.service\nexec '
        + shlex.quote(str(spotify / 'spotify')) + ' "$@"\n')
    settings = {
        'Setting': {'spotify_path': str(spotify), 'prefs_path': str(prefs),
                    'current_theme': 'VideoGlass', 'color_scheme': 'Base',
                    'inject_theme_js': '1', 'inject_css': '1', 'replace_colors': '1',
                    'overwrite_assets': '0', 'check_spicetify_update': '0',
                    'always_enable_devtools': '0'},
        'Preprocesses': {'disable_sentry': '1', 'disable_ui_logging': '1',
                        'remove_rtl_rule': '1', 'expose_apis': '1'},
        'AdditionalOptions': {'sidebar_config': '0', 'home_config': '1', 'experimental_features': '1'},
    }
    for section, entries in settings.items():
        if not config.has_section(section):
            config.add_section(section)
        for key, value in entries.items():
            config.set(section, key, value)
    extensions = [s.strip() for s in config.get('AdditionalOptions', 'extensions', fallback='').split('|') if s.strip()]
    # The component IIFEs are embedded in videoglass.js; do not load them twice.
    extensions = [s for s in extensions if s not in ('flower-button.js', 'wavy-progress.js')]
    if 'videoglass.js' not in extensions:
        extensions.append('videoglass.js')
    config.set('AdditionalOptions', 'extensions', '|'.join(extensions))
    with config_path.open('w') as handle:
        config.write(handle)
    desktop = HOME / DESKTOP
    desktop.parent.mkdir(parents=True, exist_ok=True)
    desktop.write_text('[Desktop Entry]\nType=Application\nName=ARIOTIFI\n'
        'Comment=Spotify con VideoGlass, letras y visualizador\nExec='
        + desktop_quote(HOME / '.local/bin/spotify-personalizado')
        + ' %U\nIcon=spotify\nTerminal=false\nCategories=Audio;Music;Player;AudioVideo;\nStartupWMClass=Spotify\n')
    try:
        if fresh:
            run(cli, 'backup', 'apply', '-n')
        else:
            run(cli, 'apply', '-n')
        run('systemctl', '--user', 'daemon-reload')
        run('systemctl', '--user', 'restart', 'spotify-videoglass.service')
    except subprocess.CalledProcessError:
        print('Instalación incompleta. Para restaurar: ./revert.sh ' + shlex.quote(str(backup)), file=sys.stderr)
        return 1
    print('ARIOTIFI instalado. Cierra Spotify y abre ARIOTIFI desde el menú.\n'
          'Para restaurar los archivos anteriores: ./revert.sh ' + shlex.quote(str(backup)))
    return 0

if __name__ == '__main__':
    sys.exit(main())
