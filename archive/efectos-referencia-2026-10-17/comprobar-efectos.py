import sys,json,time,base64
from pathlib import Path
from importlib.machinery import SourceFileLoader
CDP=SourceFileLoader('cdp','/home/diego/Documentos/Spotify-personalizado/cdp-check.py').load_module().CDP
c=CDP();out=Path(__file__).parent

def ev(js):
 r=c.evaluate(js)['result']
 if 'exceptionDetails' in r:raise RuntimeError(str(r))
 return r['result'].get('value')
source=Path('/home/diego/.config/spicetify/Extensions/videoglass.js').read_text()
block=source[source.index('  function drawSwiftify('):source.index('  function draw(now=')]
factory='new Function("bands","$","settings","P","canvasSize","reducedMotion","abstractMesh",'+json.dumps(block+';return drawSwiftify;')+')'
report={}
report['geometry']=ev('''(()=>{
 const bands=Array(64).fill(0),canvas=document.createElement('canvas');canvas.width=canvas.height=512;
 const wave=document.createElement('canvas');wave.width=400;wave.height=28;
 const ctx=canvas.getContext('2d'),wc=wave.getContext('2d');let segments=0,finite=true;
 const original=ctx.lineTo.bind(ctx);ctx.lineTo=(x,y)=>{finite=finite&&Number.isFinite(x)&&Number.isFinite(y);segments++;original(x,y)};
 const draw=FACTORY(bands,s=>s==='.art-space'?{clientWidth:365}:wave,{shape:'flower'}, {getDuration:()=>100,getProgress:()=>50},()=>[wc,400,28],{matches:false},{phase:1});
 const pixels=()=>ctx.getImageData(0,0,512,512).data.reduce((n,v,i)=>n+(i%4===3&&v>0?1:0),0);
 draw(ctx,512,512,100);const quiet=pixels();ctx.clearRect(0,0,512,512);bands.fill(.85);draw(ctx,512,512,200);const loud=pixels();
 const start=performance.now();for(let i=0;i<40;i++){ctx.clearRect(0,0,512,512);draw(ctx,512,512,i*42)};
 return {finite,quietPixels:quiet,loudPixels:loud,frameMs:(performance.now()-start)/40,pass:finite&&loud>quiet*1.5&&segments>0};
})()'''.replace('FACTORY',factory))
report['sizes']=[]
try:
 for width,height in [(900,700),(640,600),(480,780)]:
  c.call('Emulation.setDeviceMetricsOverride',{'width':width,'height':height,'deviceScaleFactor':1,'mobile':False});time.sleep(.4)
  report['sizes'].append(ev('''(()=>{const selectors=['.art','.transport','.progress','.volume'];const boxes=selectors.map(s=>{const r=document.querySelector('#vg '+s).getBoundingClientRect();return {s,left:r.left,right:r.right,top:r.top,bottom:r.bottom,visible:!!r.width&&!!r.height}});return {width:innerWidth,height:innerHeight,boxes,pass:boxes.every(r=>!r.visible||(r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight))}})()'''))
finally:c.call('Emulation.clearDeviceMetricsOverride')
# Brief real output capture, preserving playback and position.
state=ev('({playing:VideoGlass.player.isPlaying(),position:VideoGlass.player.getProgress()})')
try:
 if not state['playing']:ev('VideoGlass.player.play()')
 time.sleep(3)
 report['audio']=ev('''(async()=>{const data=await fetch('http://127.0.0.1:43891/spectrum').then(r=>r.json());return {playing:VideoGlass.player.isPlaying(),active:data.active,error:data.error,peak:Math.max(...data.bands),valid:data.bands.length===64&&data.bands.every(Number.isFinite)}})()''')
 r=c.call('Page.captureScreenshot',{'format':'png'});(out/'spotify-reproduciendo.png').write_bytes(base64.b64decode(r['result']['data']))
finally:
 if not state['playing']:
  ev('VideoGlass.player.pause()');ev('VideoGlass.player.seek('+json.dumps(state['position'])+')')
report['pass']=report['geometry']['pass'] and all(s['pass'] for s in report['sizes']) and report['audio']['active'] and report['audio']['valid'] and report['audio']['peak']>0
(out/'pruebas-efectos.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps(report,ensure_ascii=False,indent=2))
if not report['pass']:sys.exit(1)
