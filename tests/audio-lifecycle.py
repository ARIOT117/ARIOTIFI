"""Measure the real audio worker, then verify that close terminates it."""
import json,time,psutil
from pathlib import Path
from cdp import CDP
c=CDP()
def ev(s):
 r=c.evaluate(s)
 if r.get('result',{}).get('exceptionDetails'):raise RuntimeError(str(r))
 return r.get('result',{}).get('result',{}).get('value')
def health():return ev('fetch("http://127.0.0.1:43891/health").then(r=>r.json())')
try:
 ev('VideoGlass.close();Spicetify.Player.play();VideoGlass.open()');time.sleep(1)
 h=health();assert h['worker_pid'];worker=psutil.Process(h['worker_pid']);parent=worker.parent();procs=[parent,worker];a={p.pid:sum(p.cpu_times()[:2]) for p in procs};t=time.monotonic();time.sleep(5);elapsed=time.monotonic()-t
 opened=[]
 for p in procs:
  m=p.memory_full_info();opened.append({'pid':p.pid,'command':p.cmdline(),'rss_MiB':m.rss/2**20,'pss_MiB':m.pss/2**20,'cpu_single_core_percent':(sum(p.cpu_times()[:2])-a[p.pid])/elapsed*100})
finally:ev('VideoGlass.close()')
time.sleep(.3);closed=health();assert closed['worker_pid'] is None and not closed['pipeline'] and not closed['lease_timer'] and not psutil.pid_exists(worker.pid)
out={'opened':opened,'closed':closed};Path('measurements/final-audit/audio-resources.json').write_text(json.dumps(out,indent=2));print(json.dumps(out,indent=2))
