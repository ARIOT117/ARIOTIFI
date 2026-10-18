"""Temporarily isolate painting; always remove the diagnostic style."""
import psutil,time,json
from pathlib import Path
from cdp import CDP
c=CDP()
def ev(s):return c.evaluate(s).get('result',{}).get('result',{}).get('value')
def sample():
 p=[p for p in psutil.process_iter(['name']) if p.info['name']=='spotify'];a={x.pid:sum(x.cpu_times()[:2]) for x in p};t=time.monotonic();time.sleep(5);return sum(max(0,sum(x.cpu_times()[:2])-a[x.pid]) for x in p if x.is_running())/(time.monotonic()-t)*100
out={}
try:
 ev('VideoGlass.close();Spicetify.Player.play()');time.sleep(.5);out['before']=sample();print('before',out['before'],flush=True)
 ev('window.__containStyle=document.createElement("style");__containStyle.textContent="[data-testid=control-button-playpause]{contain:layout style}[data-testid=control-button-playpause]>svg{contain:strict}[data-vg-progress]>canvas{contain:strict;transform:translateZ(0)}";document.head.append(__containStyle)');time.sleep(.5);out['contained']=sample();print('contained',out['contained'],flush=True)
finally:ev('window.__containStyle?.remove();delete window.__containStyle;true')
Path('measurements/final-audit/contain-test.json').write_text(json.dumps(out,indent=2))
