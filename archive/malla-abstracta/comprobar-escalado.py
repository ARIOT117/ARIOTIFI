import time,json
from pathlib import Path
from importlib.machinery import SourceFileLoader
CDP=SourceFileLoader('vg_cdp','/home/diego/Documentos/Spotify-personalizado/cdp-check.py').load_module().CDP
c=CDP();report=[]
def ev(js):
 r=c.evaluate(js)
 if 'exceptionDetails' in r.get('result',{}):raise RuntimeError(str(r))
 return r['result']['result'].get('value')
try:
 for w,h,dpr in [(800,600,1),(800,600,2),(1440,900,2)]:
  c.call('Emulation.setDeviceMetricsOverride',{'width':w,'height':h,'deviceScaleFactor':dpr,'mobile':False})
  ev("window.dispatchEvent(new Event('resize'))");time.sleep(.7)
  result=ev('''(()=>{const canvas=document.querySelector('#vg .ring'),art=document.querySelector('#vg .art'),r=art.getBoundingClientRect();return {viewport:[innerWidth,innerHeight],dpr:devicePixelRatio,cssWidth:canvas.clientWidth,pixelWidth:canvas.width,pixelHeight:canvas.height,cover:[r.width,r.height],radius:getComputedStyle(art).borderRadius,playing:VideoGlass.player.isPlaying()}})()''')
  result['pass']=abs(result['pixelWidth']-result['cssWidth']*dpr)<=1 and abs(result['cover'][0]-result['cover'][1])<1 and result['radius']=='50%'
  report.append(result)
finally:
 c.call('Emulation.clearDeviceMetricsOverride');ev("window.dispatchEvent(new Event('resize'))")
Path(__file__).with_name('escalado.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
if not all(r['pass'] for r in report):raise RuntimeError('Escalado incorrecto')
