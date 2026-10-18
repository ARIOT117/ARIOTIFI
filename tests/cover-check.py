"""Exercise artwork failures on the live view without changing component code."""
import json,time,base64
from pathlib import Path
from cdp import CDP
c=CDP();dest=Path('measurements/final-audit');out={}
def ev(s):
 r=c.evaluate(s)
 if r.get('result',{}).get('exceptionDetails'):raise RuntimeError(str(r))
 return r.get('result',{}).get('result',{}).get('value')
try:
 ev('VideoGlass.close()')
 ev('window.__imageOriginal=window.Image;window.__imageDesc=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,"src");window.__imageAttempts=[];window.__imageFailures=1;window.Image=function(){const img=new __imageOriginal();Object.defineProperty(img,"src",{get(){return __imageDesc.get.call(img)},set(url){__imageAttempts.push(url);if(__imageFailures-->0)setTimeout(()=>img.onerror?.(new Event("error")),0);else __imageDesc.set.call(img,url)}});return img};Image.prototype=__imageOriginal.prototype;VideoGlass.open()')
 deadline=time.monotonic()+10
 while time.monotonic()<deadline:
  if ev('!!document.querySelector("img.vg-art")?.naturalWidth'):break
  time.sleep(.2)
 out['nextURL']=ev('({attempts:__imageAttempts,loaded:!!document.querySelector("img.vg-art")?.naturalWidth,url:document.querySelector("img.vg-art")?.src})');assert out['nextURL']['loaded'] and len(out['nextURL']['attempts'])>=2 and all(x.startswith('https://') for x in out['nextURL']['attempts'])
 ev('VideoGlass.close()');ev('__imageFailures=100;__imageAttempts=[];VideoGlass.open()');time.sleep(.4)
 out['allFail']=ev('({attempts:__imageAttempts,images:document.querySelectorAll("img.vg-art").length,fallback:!!document.querySelector(".vg-art-fallback svg"),background:getComputedStyle(document.querySelector(".vg-art-fallback")).backgroundImage})');assert out['allFail']['images']==0 and out['allFail']['fallback'] and 'linear-gradient' in out['allFail']['background']
 r=ev('document.querySelector(".vg-art-space").getBoundingClientRect().toJSON()');(dest/'cover-fallback.png').write_bytes(base64.b64decode(c.call('Page.captureScreenshot',{'format':'png','clip':{k:r[k] for k in ['x','y','width','height']}|{'scale':1}})['result']['data']))
finally:
 ev('if(window.__imageOriginal)window.Image=__imageOriginal;delete window.__imageOriginal;delete window.__imageDesc;delete window.__imageAttempts;delete window.__imageFailures;VideoGlass.close()')
(dest/'cover-check.json').write_text(json.dumps(out,indent=2,ensure_ascii=False));print(json.dumps(out,indent=2,ensure_ascii=False))
