"""Separate RAM/CPU runs from heap-snapshot allocations in Chromium."""
import subprocess,time,json,sys
from pathlib import Path
from cdp import CDP
ROOT=Path(__file__).resolve().parents[1];ASSETS=Path('/home/diego/.local/share/spotify-personalizado/spotify/Apps/xpui');BIN='/home/diego/.local/share/spotify-personalizado/spotify/spotify'
BASE='spotify:track:7so0lgd0zP2Sbgs2d7a1SZ'
def ev(c,s):
    r=c.evaluate(s)
    if r.get('result',{}).get('exceptionDetails'):raise RuntimeError(str(r))
    return r.get('result',{}).get('result',{}).get('value')
def restart(js,label):
    subprocess.run(['gdbus','call','--session','--dest','org.mpris.MediaPlayer2.spotify','--object-path','/org/mpris/MediaPlayer2','--method','org.mpris.MediaPlayer2.Quit'],capture_output=True)
    import psutil
    for p in psutil.process_iter(['cmdline']):
        cmd=p.info['cmdline'] or []
        if len(cmd)==2 and cmd[0]==BIN:
            try:p.wait(timeout=12)
            except psutil.NoSuchProcess:pass
    (ASSETS/'user.css').write_bytes((ROOT/'VideoGlass/user.css').read_bytes() if label=='ram-with-fixed' else subprocess.check_output(['git','show','963c7f2:VideoGlass/user.css'],cwd=ROOT))
    daemon=Path('/home/diego/.local/share/spotify-personalizado/visualizer.py')
    daemon.write_bytes((ROOT/'visualizer.py').read_bytes() if label=='ram-with-fixed' else subprocess.check_output(['git','show','963c7f2:visualizer.py'],cwd=ROOT))
    subprocess.run(['systemctl','--user','restart','spotify-videoglass.service'],check=True)
    (ASSETS/'extensions/videoglass.js').write_text(js)
    subprocess.Popen([BIN,'--remote-debugging-port=9222'],stdout=open(ROOT/'measurements/final-audit'/(label+'.log'),'w'),stderr=subprocess.STDOUT,start_new_session=True)
    for _ in range(100):
        try:
            c=CDP()
            if ev(c,'!!window.Spicetify?.Player?.origin') and (label=='ram-without' or ev(c,'!!window.VideoGlass?.diagnostics')):break
        except (OSError,ValueError,StopIteration):pass
        time.sleep(.3)
    else:raise RuntimeError('Spotify did not initialize')
    ev(c,'Spicetify.Player.playUri('+json.dumps(BASE)+')');time.sleep(8);c.sock.close()
    print('READY',label,flush=True)
def run(label,stress=False):
    cmd=[sys.executable,'tests/final-audit.py']+(['stress',label] if stress else [label])+['--no-snapshot']
    subprocess.run(cmd,cwd=ROOT,check=True)
probe=(ROOT/'tests/audit-probe.js').read_text();fixed=(ROOT/'Extensions/videoglass.js').read_text();old=subprocess.check_output(['git','show','963c7f2:Extensions/videoglass.js'],cwd=ROOT).decode()
try:
    if '--fixed-only' not in sys.argv:
        restart('/* Disabled for requested no-extension baseline. */','ram-without');run('ram-without')
        restart(probe+old,'ram-with-old');run('ram-with-old');run('ram-stress-old',True)
    restart(probe+fixed,'ram-with-fixed');run('ram-with-fixed');run('ram-stress-fixed',True)
finally:
    # Leave deployable files exactly as the repository, without audit instrumentation.
    (ASSETS/'extensions/videoglass.js').write_text(fixed)
    (ASSETS/'user.css').write_bytes((ROOT/'VideoGlass/user.css').read_bytes())
    Path('/home/diego/.local/share/spotify-personalizado/visualizer.py').write_bytes((ROOT/'visualizer.py').read_bytes())
