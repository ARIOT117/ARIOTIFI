import sys,json,time,base64,urllib.request
from pathlib import Path
from importlib.machinery import SourceFileLoader
CDP=SourceFileLoader('vg_cdp','/home/diego/Documentos/Spotify-personalizado/cdp-check.py').load_module().CDP
out=Path(__file__).resolve().parent;c=CDP()
def ev(js):
 r=c.evaluate(js)
 if 'exceptionDetails' in r.get('result',{}):raise RuntimeError(str(r))
 return r['result']['result'].get('value')
def player():return json.load(urllib.request.urlopen('http://127.0.0.1:43891/player',timeout=3))
def shot(name):
 r=c.call('Page.captureScreenshot',{'format':'png'});(out/name).write_bytes(base64.b64decode(r['result']['data']))
report={};before=player();report['before']=before
# Observe the live canvas without exposing internal production state.
ev('''window.__meshProbe={frames:[],radii:[],strokes:0,fills:0};window.__meshStroke=CanvasRenderingContext2D.prototype.stroke;window.__meshFill=CanvasRenderingContext2D.prototype.fill;window.__meshMove=CanvasRenderingContext2D.prototype.moveTo;
CanvasRenderingContext2D.prototype.moveTo=function(x,y){if(this.canvas===document.querySelector('#vg .ring')){__meshProbe.radii.push(Math.hypot(x-this.canvas.clientWidth/2,y-this.canvas.clientHeight/2));}return __meshMove.call(this,x,y)};
CanvasRenderingContext2D.prototype.stroke=function(...args){if(this.canvas===document.querySelector('#vg .ring'))__meshProbe.strokes++;return __meshStroke.apply(this,args)};
CanvasRenderingContext2D.prototype.fill=function(...args){if(this.canvas===document.querySelector('#vg .ring'))__meshProbe.fills++;return __meshFill.apply(this,args)};
window.__meshRealFetch=window.fetch;window.fetch=async(...args)=>{const r=await __meshRealFetch(...args);if(String(args[0]).endsWith('/spectrum'))r.clone().json().then(d=>{__meshProbe.frames.push(d.bands)});return r};''')
try:
 ev('VideoGlass.player.seek(65000)');ev('VideoGlass.player.play()');time.sleep(3)
 report['active']=ev('''({playing:VideoGlass.player.isPlaying(),frames:__meshProbe.frames,radii:__meshProbe.radii.slice(-64),strokes:__meshProbe.strokes,fills:__meshProbe.fills})''')
 shot('malla-musica-real.png')
 ev('window.__meshProbe.radii=[];VideoGlass.player.pause()');time.sleep(.7)
 report['pause_early']=ev('({radii:__meshProbe.radii.slice(-64),playing:VideoGlass.player.isPlaying()})')
 ev('__meshProbe.radii=[]');time.sleep(4.5)
 report['pause_settled']=ev('({radii:__meshProbe.radii.slice(-64),strokes:__meshProbe.strokes})')
 shot('malla-pausada.png')
 # A short next/back cycle exercises real track changes, then restores the original.
 ev('VideoGlass.player.next()');time.sleep(.8)
 changed=player();report['changed_track']=changed.get('item',{}).get('uri')!=before.get('item',{}).get('uri')
 time.sleep(.6)
 report['after_change']=ev("({title:document.querySelector('#vg .title').textContent,cover:document.querySelector('#vg .art').src,style:VideoGlass.settings.style})")
 ev('VideoGlass.player.back()');time.sleep(.7)
 report['restored_track']=player().get('item',{}).get('uri')==before.get('item',{}).get('uri')
 original=before
 if report['restored_track']:
  ev('VideoGlass.player.seek('+str(original['position'])+')')
 ev('VideoGlass.player.'+('play' if original.get('playing') else 'pause')+'()')
 time.sleep(1)
 report['final']=player()
finally:
 ev('''CanvasRenderingContext2D.prototype.stroke=__meshStroke;CanvasRenderingContext2D.prototype.fill=__meshFill;CanvasRenderingContext2D.prototype.moveTo=__meshMove;window.fetch=__meshRealFetch;delete window.__meshStroke;delete window.__meshFill;delete window.__meshMove;delete window.__meshRealFetch;delete window.__meshProbe''')
frames=report['active']['frames']
report['passed']=bool(frames) and any(max(b)>0 for b in frames) and len({tuple(b) for b in frames})>1 and report['active']['fills']==0 and report['changed_track'] and report['restored_track']
mean=lambda values:sum(values)/len(values)
report['contraction']={'active_mean':mean(report['active']['radii']),'early_pause_mean':mean(report['pause_early']['radii']),'settled_mean':mean(report['pause_settled']['radii'])}
report['contraction']['passed']=report['contraction']['active_mean']>report['contraction']['early_pause_mean']>report['contraction']['settled_mean']
report['passed']=report['passed'] and report['contraction']['passed']
(out/'audio-real.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps({k:v for k,v in report.items() if k not in ('before','active','final')},ensure_ascii=False,indent=2))
print('Audio frames:',len(frames),'peak:',max((max(b) for b in frames),default=0))
if not report['passed']:sys.exit(1)
