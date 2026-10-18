"""Compare both revisions in one Spotify session without changing playback."""
import sys,json,time,shutil,subprocess
from pathlib import Path
from cdp import CDP
root=Path(__file__).resolve().parents[1]
assets=Path('/home/diego/.local/share/spotify-personalizado/spotify/Apps/xpui')
backup=Path('/home/diego/Backups/spotify-personalizado/premium-2026-10-17/spicetify')
c=CDP()
def ev(s):
    r=c.evaluate(s)
    if 'exceptionDetails' in r.get('result',{}):raise RuntimeError(json.dumps(r))
    return r.get('result',{}).get('result',{}).get('value')
was_open=bool(ev('!!VideoGlass.root'))
open_setting=ev('localStorage.getItem("videoglass-open")')
def reload_wait():
    ev('location.reload();true')
    # Both revisions get the same settling period.
    time.sleep(8)
try:
    ev('VideoGlass.close()')
    ev('localStorage.setItem("videoglass-open","false");true')
    shutil.copy2(backup/'Extensions/videoglass.js',assets/'extensions/videoglass.js')
    shutil.copy2(backup/'Themes/VideoGlass/user.css',assets/'user.css')
    reload_wait()
    subprocess.run([sys.executable,str(root/'tests/measure.py'),'--label','before'],cwd=root,check=True)
finally:
    shutil.copy2(root/'Extensions/videoglass.js',assets/'extensions/videoglass.js')
    shutil.copy2(root/'VideoGlass/user.css',assets/'user.css')
    reload_wait()
    subprocess.run([sys.executable,str(root/'tests/measure.py'),'--label','after'],cwd=root,check=True)
    ev('localStorage.setItem("videoglass-open",'+json.dumps(open_setting)+');true' if open_setting is not None else 'localStorage.removeItem("videoglass-open");true')
    if was_open:ev('VideoGlass.open()')
