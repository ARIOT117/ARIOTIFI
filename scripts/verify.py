#!/usr/bin/env python3
"""Offline delivery checks. Never imports or runs the production backend."""
import ast
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
errors = []
for path in [ROOT / 'visualizer.py', *sorted((ROOT / 'scripts').glob('*.py')), ROOT / 'widget/manage.py']:
    try:
        ast.parse(path.read_text(), filename=str(path))
    except SyntaxError as error:
        errors.append(str(error))
for path in [*sorted(ROOT.glob('*.sh')), *sorted((ROOT / 'widget').glob('*.sh')), ROOT / 'config/spotify-personalizado']:
    result = subprocess.run(['bash', '-n', str(path)], capture_output=True, text=True)
    if result.returncode:
        errors.append(result.stderr)
for rel, expected in json.loads((ROOT / 'config/production-sha256.json').read_text()).items():
    if hashlib.sha256((ROOT / rel).read_bytes()).hexdigest() != expected:
        errors.append('Hash de producción distinto: ' + rel)
for rel, expected in json.loads((ROOT / 'widget/sha256.json').read_text()).items():
    if hashlib.sha256((ROOT / 'widget/flower-music@ariot117' / rel).read_bytes()).hexdigest() != expected:
        errors.append('Hash de widget distinto: ' + rel)
# Parse JS without executing its browser/Spotify effects.
if shutil.which('gjs'):
    for path in sorted((ROOT / 'Extensions').glob('*.js')):
        code = 'new Function(imports.byteArray.toString(imports.gi.GLib.file_get_contents(ARGV[0])[1]));'
        result = subprocess.run(['gjs', '-c', code, str(path)], capture_output=True, text=True)
        if result.returncode:
            errors.append('JS: ' + path.name + ': ' + result.stderr)
    for path in [*sorted((ROOT / 'widget/flower-music@ariot117').rglob('*.js')), ROOT / 'scripts/gnome-benchmark-session.js']:
        code = 'Reflect.parse(imports.byteArray.toString(imports.gi.GLib.file_get_contents(ARGV[0])[1]), {target:"module"});'
        result = subprocess.run(['gjs', '-c', code, str(path)], capture_output=True, text=True)
        if result.returncode:
            errors.append('ESM: ' + path.name + ': ' + result.stderr)
else:
    print('Aviso: GJS no está instalado; se omite el análisis de JavaScript.')
# Main documentation is portable; historical documents retain their original paths.
for path in [ROOT / 'README.md', *sorted((ROOT / 'docs').glob('*.md')), ROOT / 'tests/README.md', ROOT / 'widget/README.md']:
    for target in re.findall(r'!?\[[^\]]*\]\(([^)]+)\)', path.read_text()):
        target = target.split('#')[0]
        if target and not re.match(r'\w+://', target) and not (path.parent / target).exists():
            errors.append('Enlace local roto: ' + str(path.relative_to(ROOT)) + ' -> ' + target)
if errors:
    print('\n'.join(errors), file=sys.stderr)
    sys.exit(1)
print('PASS: sintaxis Python/shell, hashes de producción/widget y enlaces locales; JavaScript analizado si GJS está disponible.')
