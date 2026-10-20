#!/usr/bin/env python3
"""Install/restore the optional GNOME widget without replacing other extensions."""
import argparse
import datetime
import json
from pathlib import Path
import shutil
import subprocess
import sys

UUID='flower-music@ariot117'
MEDIA='mediacontrols@cliffniff.github.com'
ROOT=Path(__file__).resolve().parent
HOME=Path.home()
TARGET=HOME/'.local/share/gnome-shell/extensions'/UUID
BACKUPS=HOME/'.local/state/ariotifi/widget-backups'

def settings():
    from gi.repository import Gio
    return Gio.Settings.new('org.gnome.shell')

def enabled(settings, uuid):
    return uuid in settings.get_strv('enabled-extensions') and uuid not in settings.get_strv('disabled-extensions')

def toggle(uuid, active):
    return subprocess.run(['gnome-extensions','enable' if active else 'disable',uuid],
                          stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    commands=parser.add_subparsers(dest='action',required=True)
    install=commands.add_parser('install')
    install.add_argument('--check',action='store_true')
    restore=commands.add_parser('restore')
    restore.add_argument('backup',type=Path)
    args=parser.parse_args()
    if not shutil.which('gnome-shell') or not shutil.which('gnome-extensions'):
        parser.error('Se necesita GNOME Shell y gnome-extensions.')
    version=subprocess.check_output(['gnome-shell','--version'],text=True).strip()
    if args.action=='install' and ' 50.' not in version and not version.endswith(' 50'):
        parser.error('Esta extensión declara soporte para GNOME Shell 50; detectado: '+version)
    prefs=settings()
    if args.action=='install':
        if args.check:
            print('GNOME Shell 50 detectado. No se modificó ningún archivo.')
            return 0
        backup=BACKUPS/datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f')
        backup.mkdir(parents=True)
        state={'existed':TARGET.is_dir(),'widget_enabled':enabled(prefs,UUID),
               'media_enabled':enabled(prefs,MEDIA)}
        if state['existed']:
            shutil.copytree(TARGET,backup/'extension',symlinks=True)
        (backup/'state.json').write_text(json.dumps(state,indent=2)+'\n')
        shutil.copytree(ROOT/UUID,TARGET,dirs_exist_ok=True)
        result=toggle(UUID,True)
        if result.returncode==0:
            toggle(MEDIA,False)
        print('Flower Music copiado. Respaldo: '+str(backup))
        print('Cierra y vuelve a iniciar sesión para cargar la versión copiada; después ejecuta:\n'
              'gnome-extensions enable '+UUID+'\ngnome-extensions disable '+MEDIA)
        print('Restauración: ./widget/restore.sh '+str(backup))
    else:
        backup=args.backup.expanduser().resolve()
        if backup.parent != BACKUPS.resolve():
            parser.error('Usa un respaldo de ~/.local/state/ariotifi/widget-backups/.')
        state=json.loads((backup/'state.json').read_text())
        if set(state)!= {'existed','widget_enabled','media_enabled'} or any(type(v) is not bool for v in state.values()):
            parser.error('Estado de respaldo inválido.')
        if state['existed'] and not (backup/'extension').is_dir():
            parser.error('Respaldo de la extensión incompleto.')
        toggle(UUID,False)
        if TARGET.exists():shutil.rmtree(TARGET)
        if state['existed']:shutil.copytree(backup/'extension',TARGET,symlinks=True)
        toggle(UUID,state['widget_enabled'])
        toggle(MEDIA,state['media_enabled'])
        print('Archivos y activación anteriores restaurados. Cierra y vuelve a iniciar sesión.')
    return 0

if __name__=='__main__':
    sys.exit(main())
