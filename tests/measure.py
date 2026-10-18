#!/usr/bin/env python3
"""Read-only memory and lifecycle snapshot of an already running Spotify debugger."""
import argparse,json,time,datetime
from pathlib import Path
from cdp import CDP
p=argparse.ArgumentParser()
p.add_argument('--label',required=True,choices=['before','after'])
a=p.parse_args()
out={'label':a.label,'time':datetime.datetime.now().isoformat(),'memory':None}
try:
    c=CDP()
    c.call('HeapProfiler.collectGarbage')
    out['gc']='Explicit garbage collection before both snapshots'
    out['memory']=c.call('Runtime.getHeapUsage').get('result')
    out['dom']=c.call('Memory.getDOMCounters').get('result')
    out['view']=c.evaluate('window.VideoGlass?.diagnostics?.() || {mounted:!!document.querySelector("#vg.open")}')
    rss=0;pss=0;pss_complete=True;pids=[]
    for d in Path('/proc').iterdir():
        if not d.name.isdigit():continue
        try:
            cmd=(d/'cmdline').read_bytes().replace(b'\0',b' ').decode(errors='replace')
            if not cmd.startswith('/home/diego/.local/share/spotify-personalizado/spotify/spotify'):continue
            status=(d/'status').read_text()
            line=next((x for x in status.splitlines() if x.startswith('VmRSS:')),None)
            if line:
                rss+=int(line.split()[1]);pids.append(int(d.name))
                try:
                    rollup=(d/'smaps_rollup').read_text()
                    pss+=int(next(x for x in rollup.splitlines() if x.startswith('Pss:')).split()[1])
                except OSError:pss_complete=False
        except (OSError,StopIteration):pass
    out['spotify_rss_kib_sum']=rss if pids else None
    out['spotify_pss_kib_sum']=pss if pids and pss_complete else None
    out['playback']=c.evaluate('fetch("http://127.0.0.1:43891/player").then(r=>r.json()).then(x=>({track:x.item.uri,playing:x.playing}))')
    out['pids']=pids
    out['note']='RSS sums shared pages more than once. Compare equivalent playback/window states.'
except Exception as e:
    out['error']=str(e)
    out['note']='No live measurement available; null is not zero memory.'
dest=Path('measurements');dest.mkdir(exist_ok=True)
f=dest/(a.label+'.json');f.write_text(json.dumps(out,indent=2,ensure_ascii=False))
print(json.dumps(out,indent=2,ensure_ascii=False))
