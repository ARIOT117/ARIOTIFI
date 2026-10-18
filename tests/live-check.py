import json,time,base64
from pathlib import Path
from cdp import CDP
c=CDP();out={};dest=Path('measurements');dest.mkdir(exist_ok=True)
def ev(s,gesture=False,wait=True):
 r=c.call('Runtime.evaluate',{'expression':s,'returnByValue':True,'awaitPromise':wait,'userGesture':gesture})
 if 'exceptionDetails' in r.get('result',{}):raise RuntimeError(json.dumps(r))
 return r.get('result',{}).get('result',{}).get('value')
def shot(name):
 r=c.call('Page.captureScreenshot',{'format':'png'});(dest/(name+'.png')).write_bytes(base64.b64decode(r['result']['data']))
initial=ev('fetch("http://127.0.0.1:43891/player").then(r=>r.json())')
try:
 ev('VideoGlass.close()');ev('VideoGlass.open()',True)
 out['fullscreen']=ev('!!document.fullscreenElement')
 assert out['fullscreen'] is False
 out['withLyrics']=ev('({ ...VideoGlass.diagnostics(),title:document.querySelector(".vg-title").textContent,duration:document.querySelector(".vg-duration").textContent})');shot('immersive-lyrics')
 ev('VideoGlass.close()')
 ev('VideoGlass.open()',True,False);time.sleep(.15)
 out['transition']=ev('(()=>{const p=document.querySelector("#vg-flower-clip polygon");const a=p?.getAnimations()[0];if(a){a.pause();a.currentTime=360;}const b=document.querySelector(".vg-content")?.getAnimations()[0];if(b){b.pause();b.currentTime=360;}return {points:p?.points.numberOfItems,transform:p?getComputedStyle(p).transform:null};})()');shot('flower-half-open')
 ev('document.querySelectorAll("#vg *").forEach(e=>e.getAnimations().forEach(a=>{if(a.playState==="paused")a.play()}))');time.sleep(.6)
 ev('fetch("http://127.0.0.1:43891/control",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"play"})})');time.sleep(2)
 out['playing']=ev('VideoGlass.diagnostics()')
 out['spectrum']=ev('fetch("http://127.0.0.1:43891/spectrum").then(r=>r.json()).then(x=>({active:x.active,peak:Math.max(...x.bands),error:x.error}))');shot('immersive-playing')
 ev('fetch("http://127.0.0.1:43891/control",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"pause"})})');time.sleep(.8)
 out['paused']=ev('VideoGlass.diagnostics()')
 c.call('Emulation.setDeviceMetricsOverride',{'width':640,'height':900,'deviceScaleFactor':1,'mobile':False});time.sleep(.4)
 out['narrow']=ev('({width:innerWidth,scrollWidth:document.querySelector(".vg-content").scrollWidth,canvas:document.querySelectorAll("#vg canvas").length})');shot('immersive-narrow')
 ev('VideoGlass.close()');time.sleep(.4);shot('home-narrow')
 c.call('Emulation.clearDeviceMetricsOverride')
 ev('window.__vgFetch=window.fetch;window.fetch=(url,opts)=>String(url).includes("/lyrics?")?Promise.resolve(new Response(JSON.stringify({syncedLyrics:null,plainLyrics:null}))):window.__vgFetch(url,opts);VideoGlass.open()',True);time.sleep(.5)
 out['emptyLyrics']=ev('document.querySelector(".vg-empty h2")?.textContent');shot('immersive-empty')
 ev('window.fetch=window.__vgFetch;delete window.__vgFetch;VideoGlass.close()')
 out['closed']=ev('({...VideoGlass.diagnostics(),nodes:document.querySelectorAll("#vg").length,mask:document.querySelectorAll("#vg-flower-clip").length})')
 shot('home-premium')
finally:
 ev('if(window.__vgFetch){window.fetch=window.__vgFetch;delete window.__vgFetch;}VideoGlass.close()')
 c.call('Emulation.clearDeviceMetricsOverride')
 ev('fetch("http://127.0.0.1:43891/control",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"seek",value:'+str(initial['position'])+'})})')
 if initial['playing']:ev('fetch("http://127.0.0.1:43891/control",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"play"})})')
(dest/'live-check.json').write_text(json.dumps(out,indent=2,ensure_ascii=False));print(json.dumps(out,indent=2,ensure_ascii=False))
