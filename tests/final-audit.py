"""Real Spotify PSS/RSS/CPU samples and streamed V8 snapshots; no synthetic songs."""
import json,time,sys,os
from pathlib import Path
import psutil
from cdp import CDP
DEST=Path('measurements/final-audit');DEST.mkdir(exist_ok=True,parents=True)
c=CDP();c.sock.settimeout(90)
def ev(expr):
    r=c.evaluate(expr)
    if r.get('result',{}).get('exceptionDetails'):raise RuntimeError(str(r))
    return r.get('result',{}).get('result',{}).get('value')
def spotify():
    found=[]
    for p in psutil.process_iter(['cmdline']):
        cmd=p.info['cmdline'] or []
        if cmd and cmd[0]=='/home/diego/.local/share/spotify-personalizado/spotify/spotify':found.append(p)
    return found
def daemon():
    return [p for p in psutil.process_iter(['cmdline']) if any(x.endswith('/visualizer.py') for x in (p.info['cmdline'] or [])) and 'python' in (p.info['cmdline'] or [''])[0]]
def sample(procs):
    data={}
    for p in procs:
        try:
            t=p.cpu_times();m=p.memory_full_info();data[p.pid]={'cpu':t.user+t.system,'rss':m.rss,'pss':m.pss}
        except (psutil.NoSuchProcess,psutil.AccessDenied):pass
    return data
def measure(label,snapshot=True):
    ev('window.VideoGlass?.close()');ev('Spicetify.Player.play()');time.sleep(2);ev('window.VideoGlass?.close()');assert not ev('!!window.VideoGlass?.root')
    c.call('HeapProfiler.collectGarbage');time.sleep(1)
    t=time.monotonic();a=sample(spotify());da=sample(daemon());time.sleep(10);dt=time.monotonic()-t;b=sample(spotify());db=sample(daemon())
    def metrics(x,y):
        return {'rss_MiB':sum(v['rss'] for v in y.values())/2**20,'pss_MiB':sum(v['pss'] for v in y.values())/2**20,'cpu_percent':sum(max(0,v['cpu']-x.get(k,v)['cpu']) for k,v in y.items())/dt*100,'pids':list(y),'processes':y}
    out={'label':label,'time':time.strftime('%Y-%m-%dT%H:%M:%S%z'),'spotify':metrics(a,b),'visualizer':metrics(da,db),'sample_seconds':dt,'visibility':ev('document.visibilityState'),'heap':c.call('Runtime.getHeapUsage').get('result'),'dom':c.call('Memory.getDOMCounters').get('result'),'diagnostics':ev('window.VideoGlass?.diagnostics() || null'),'audit':ev('window.__vgAudit?.() || null'),'playback':ev('({playing:Spicetify.Player.isPlaying(),uri:Spicetify.Player.data?.item?.uri})')}
    if snapshot:
        f=DEST/(label+'.heapsnapshot')
        with f.open('w') as stream:
            c.on_event=lambda e:stream.write(e['params']['chunk']) if e['method']=='HeapProfiler.addHeapSnapshotChunk' else None
            c.call('HeapProfiler.takeHeapSnapshot',{'reportProgress':False})
        c.on_event=None
        # Parse outside the renderer after measuring RSS, not during the CPU sample.
        h=json.loads(f.read_text());meta=h['snapshot']['meta'];fields=meta['node_fields'];n=len(fields);names=h['strings'];nodes=h['nodes'];ni=fields.index('name');ti=fields.index('type');types=meta['node_types'][ti];counts={}
        for i in range(0,len(nodes),n):
            name=names[nodes[i+ni]];kind=types[nodes[i+ti]]
            if kind not in ('object','native'):continue
            for term in ['WavyProgress','FlowerButton','HTMLCanvasElement','HTMLImageElement','MutationObserver','ResizeObserver']:
                if name==term or name.startswith(term+' /') or name.startswith(term+' '):counts[term]=counts.get(term,0)+1
        out['retained']=counts;out['snapshot']=str(f);out['snapshot_bytes']=f.stat().st_size
    (DEST/(label+'.json')).write_text(json.dumps(out,indent=2));print(json.dumps(out),flush=True)
def stress(label):
    records=[]
    targets=json.loads(Path(__file__).with_name('stress-tracks.json').read_text())
    for i,target in enumerate(targets):
        old=ev('Spicetify.Player.data?.item?.uri');ev('Spicetify.Player.playUri('+json.dumps(target)+')')
        end=time.monotonic()+10
        while time.monotonic()<end:
            uri=ev('Spicetify.Player.data?.item?.uri')
            if uri==target and uri!=old:break
            time.sleep(.15)
        if uri!=target or uri==old:raise RuntimeError('Actual song change failed at '+str(i+1))
        ev('VideoGlass.open()');time.sleep(.2)
        records.append({'iteration':i+1,'uri':uri,'diagnostics':ev('VideoGlass.diagnostics()'),'skeleton':ev('document.querySelectorAll("#vg .vg-loading").length')})
        ev('VideoGlass.close()');print('stress',i+1,uri,flush=True)
    (DEST/(label+'-stress.json')).write_text(json.dumps(records,indent=2));measure(label,snapshot=SNAPSHOTS)
SNAPSHOTS='--no-snapshot' not in sys.argv
if sys.argv[1]=='stress':stress(sys.argv[2])
else:measure(sys.argv[1],snapshot=SNAPSHOTS)
