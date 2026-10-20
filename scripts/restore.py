#!/usr/bin/env python3
"""Restore exactly the project-managed files saved by the installer."""
import argparse
import configparser
from pathlib import Path
import json
import shutil
import subprocess
import sys
from install import HOME, MANAGED, CONFIG_FILE, cli_path

def main():
    parser = argparse.ArgumentParser(description='Restaurar un respaldo generado por ARIOTIFI.')
    parser.add_argument('backup', type=Path, help='Carpeta del respaldo que imprimió install.sh.')
    args = parser.parse_args()
    backup = args.backup.expanduser().resolve()
    backup_root = (HOME / '.local/state/ariotifi/backups').resolve()
    if backup.parent != backup_root:
        parser.error('Elige una carpeta de ~/.local/state/ariotifi/backups/.')
    manifest = json.loads((backup / 'manifest.json').read_text())
    if set(manifest) != set(MANAGED) or any(type(v) is not bool for v in manifest.values()):
        parser.error('Manifiesto de respaldo inválido.')
    for rel, existed in manifest.items():
        if existed and not (backup / rel).is_file():
            parser.error('Respaldo incompleto: ' + rel)
    # Restore the unmodified Spotify client while the current config still exists.
    subprocess.run([cli_path(), 'restore', '-n'], check=True)
    subprocess.run(['systemctl', '--user', 'stop', 'spotify-videoglass.service'], check=True)
    for rel, existed in manifest.items():
        target = HOME / rel
        if existed:
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(backup / rel, target)
        else:
            target.unlink(missing_ok=True)
    subprocess.run(['systemctl', '--user', 'daemon-reload'], check=True)
    config = configparser.ConfigParser(interpolation=None, strict=False)
    config.read(HOME / CONFIG_FILE)
    if config.get('Setting', 'current_theme', fallback='') or config.get('AdditionalOptions', 'extensions', fallback=''):
        commands = ['apply', '-n'] if config.get('Backup', 'version', fallback='').strip() else ['backup', 'apply', '-n']
        subprocess.run([cli_path(), *commands], check=True)
    if (HOME / '.config/systemd/user/spotify-videoglass.service').is_file():
        subprocess.run(['systemctl', '--user', 'start', 'spotify-videoglass.service'], check=True)
    print('Respaldo restaurado. Cierra y abre Spotify. Se conservó la cuenta y el repositorio.')
    return 0

if __name__ == '__main__':
    sys.exit(main())
