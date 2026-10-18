"""Reversible CPU isolation diagnostic; keeps supplied components unchanged."""
import sys,time,json,psutil
from pathlib import Path
from cdp import CDP
c=CDP()
def ev(s):return c.evaluate(s).get('result',{}).get('result',{}).get('value')
out={}
def sample(label):
    procs=[p for p in psutil.process_iter(['name','cmdline']) if p.info['name']=='spotify'];a={p.pid:sum(p.cpu_times()[:2]) for p in procs};ta={}
    for p in procs:
        for t in p.threads():ta[t.id]=t.user_time+t.system_time
    start=time.monotonic();time.sleep(5);dt=time.monotonic()-start;data={};threads=[]
    for p in procs:
        try:
            data[p.pid]={'cpu':round((sum(p.cpu_times()[:2])-a[p.pid])/dt*100,2),'type':next((x for x in p.info['cmdline'] if x.startswith('--type=')),'main')}
            for t in p.threads():
                cpu=(t.user_time+t.system_time-ta.get(t.id,t.user_time+t.system_time))/dt*100
                if cpu>1:threads.append([p.pid,t.id,round(cpu,2),Path('/proc/'+str(p.pid)+'/task/'+str(t.id)+'/comm').read_text().strip()])
        except (psutil.NoSuchProcess,OSError):pass
    out[label]={'processes':data,'threads':threads,'visible':ev('document.visibilityState')};print(label,json.dumps(out[label]),flush=True)
try:
 ev('VideoGlass.close();Spicetify.Player.play()');time.sleep(1);sample('normal')
 ev('window.__costWP=document.querySelector("[data-vg-progress]").__wavy;window.__costKick=__costWP._kick;cancelAnimationFrame(__costWP.raf);__costWP.raf=0;__costWP._kick=()=>{};document.querySelector("[data-testid=control-button-playpause]").__flower.setPlaying(false)');sample('both components frozen')
 ev('window.__costSheet=[...document.styleSheets].find(s=>s.href?.includes("user.css"));if(__costSheet)__costSheet.disabled=true');sample('without theme and components')
finally:
 ev('if(window.__costSheet)__costSheet.disabled=false;__costWP._kick=__costKick;__costWP._kick();document.querySelector("[data-testid=control-button-playpause]").__flower.setPlaying(Spicetify.Player.isPlaying());delete window.__costWP;delete window.__costKick;delete window.__costSheet;true')
Path('measurements/final-audit/render-isolation.json').write_text(json.dumps(out,indent=2))
