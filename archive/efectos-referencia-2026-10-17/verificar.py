import sys,json,time,base64
from pathlib import Path
sys.path.insert(0,'/home/diego/Documentos/Spotify-personalizado')
from importlib.machinery import SourceFileLoader
CDP=SourceFileLoader('cdp','/home/diego/Documentos/Spotify-personalizado/cdp-check.py').load_module().CDP
c=CDP()
def ev(js):
 r=c.evaluate(js)['result']
 if 'exceptionDetails' in r: raise RuntimeError(str(r))
 return r['result'].get('value')
p=Path(__file__).parent
source=Path('/home/diego/.config/spicetify/Extensions/videoglass.js').read_text()
print('Sintaxis:',ev('new Function('+json.dumps(source)+');true'))
(p/'estado-antes.json').write_text(json.dumps(ev('({settings:VideoGlass.settings,open:localStorage.getItem("videoglass-open")})')))
c.call('Page.reload',{'ignoreCache':True})
for i in range(30):
 time.sleep(.5)
 if ev('!!window.VideoGlass'):break
ev('VideoGlass.open()')
time.sleep(2)
report=ev('''(()=>{const r=VideoGlass.root,box=s=>{const b=r.querySelector(s).getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height}};return {settings:VideoGlass.settings,style:r.dataset.style,shape:r.dataset.shape,viewport:[innerWidth,innerHeight],title:r.querySelector('.title').textContent,playing:VideoGlass.player.isPlaying(),boxes:Object.fromEntries(['.art','.ring','.transport','.progress','.volume','.lyrics'].map(s=>[s,box(s)])),wave:!!r.querySelector('.progress-wave'),buttons:r.querySelectorAll('.transport button').length,overflow:document.documentElement.scrollWidth>innerWidth}})()''')
r=c.call('Page.captureScreenshot',{'format':'png'});(p/'spotify-efectos.png').write_bytes(base64.b64decode(r['result']['data']))
(p/'validacion.json').write_text(json.dumps(report,indent=2,ensure_ascii=False))
print(json.dumps(report,ensure_ascii=False,indent=2))
