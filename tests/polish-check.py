"""Real Spotify controls and close-up screenshots rendered at 200%."""
import json,time,base64
from pathlib import Path
from cdp import CDP
c=CDP();dest=Path('measurements/pulido-200');dest.mkdir(parents=True,exist_ok=True)
result={}
def ev(s):
    r=c.evaluate(s)
    if 'exceptionDetails' in r.get('result',{}):raise RuntimeError(json.dumps(r))
    return r.get('result',{}).get('result',{}).get('value')
def player():return ev('fetch("http://127.0.0.1:43891/player").then(r=>r.json())')
def control(action,value=None):return ev('fetch("http://127.0.0.1:43891/control",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify('+json.dumps({'action':action,'value':value})+')}).then(r=>r.json())')
def rect(selector):return ev('document.querySelector('+json.dumps(selector)+').getBoundingClientRect().toJSON()')
def shot(name,selector,pad=0):
    box=rect(selector);clip={'x':max(0,box['x']-pad),'y':max(0,box['y']-pad),'width':box['width']+pad*2,'height':box['height']+pad*2,'scale':2}
    r=c.call('Page.captureScreenshot',{'format':'png','clip':clip});(dest/(name+'.png')).write_bytes(base64.b64decode(r['result']['data']))
def mouse(kind,x,y,down=False):c.call('Input.dispatchMouseEvent',{'type':kind,'x':x,'y':y,'button':'left' if kind!='mouseMoved' else 'none','buttons':1 if down else 0,'clickCount':1})
initial=player();(dest/'playback-before-test.json').write_text(json.dumps(initial));was_open=bool(ev('!!VideoGlass.root'));start=time.monotonic()
try:
    ev('VideoGlass.close()');control('pause');time.sleep(.7)
    box=rect('[data-vg-progress]');y=box['y']+box['height']/2
    x=box['x']+box['width']*.45;mouse('mousePressed',x,y,True);mouse('mouseReleased',x,y);time.sleep(.4)
    p=player();result['clickFraction']=p['position']/p['duration'];assert abs(result['clickFraction']-.45)<.04
    mouse('mousePressed',x,y,True);x=box['x']+box['width']*.55;mouse('mouseMoved',x,y,True);mouse('mouseReleased',x,y);time.sleep(.4)
    p=player();result['dragFraction']=p['position']/p['duration'];assert abs(result['dragFraction']-.55)<.04
    before=p['position'];ev('document.querySelector("[data-vg-progress] input[type=range]").focus()')
    for kind in ['keyDown','keyUp']:c.call('Input.dispatchKeyEvent',{'type':kind,'key':'ArrowRight','code':'ArrowRight','windowsVirtualKeyCode':39,'nativeVirtualKeyCode':39})
    time.sleep(1.2);result['keyboardSeekMs']=player()['position']-before;assert result['keyboardSeekMs']>0
    ev('document.activeElement.blur()');mouse('mouseMoved',5,400)
    control('play');time.sleep(1)
    shot('barra-reproduciendo','.main-nowPlayingBar-center',6)
    result['nativeVisuals']=ev('({rail:getComputedStyle(document.querySelector("[data-vg-progress] [data-testid=progress-bar-background]")).backgroundColor,fill:getComputedStyle(document.querySelector("[data-vg-progress] .x-progressBar-fillColor")).opacity,period:30,transition:getComputedStyle(document.querySelector(".vg-wave-amplitude")).transitionDuration,play:document.querySelector("[data-testid=control-button-playpause]").getBoundingClientRect().width,titles:document.querySelectorAll(".main-nowPlayingBar-nowPlayingBar [title]").length})')
    assert result['nativeVisuals']['rail']=='rgba(0, 0, 0, 0)' and result['nativeVisuals']['fill']=='0' and result['nativeVisuals']['play']==40 and result['nativeVisuals']['titles']==0
    control('pause');time.sleep(1.1);shot('barra-pausa','.main-nowPlayingBar-center',6)
    a=ev('getComputedStyle(document.querySelector(".vg-spin")).transform');time.sleep(.25);b=ev('getComputedStyle(document.querySelector(".vg-spin")).transform')
    result['pause']=ev('({amplitude:getComputedStyle(document.querySelector(".vg-wave-amplitude")).floodOpacity,spin:getComputedStyle(document.querySelector(".vg-spin")).animationPlayState})');result['pause']['angleUnchanged']=a==b
    assert result['pause']=={'amplitude':'0','spin':'paused','angleUnchanged':True}
    ev('VideoGlass.open()');time.sleep(.3)
    result['buttons']=ev('(()=>{const a=document.querySelector(".vg-window-actions [data-action=close]").getBoundingClientRect(),b=document.querySelector(".vg-window-actions [data-action=more]").getBoundingClientRect();return{close:[a.width,a.height],more:[b.width,b.height],gap:b.left-a.right,titles:document.querySelectorAll("#vg [title]").length,fullscreen:!!document.fullscreenElement,play:document.querySelector(".vg-play").getBoundingClientRect().width}})()')
    assert result['buttons']=={'close':[40,40],'more':[40,40],'gap':8,'titles':0,'fullscreen':False,'play':64}
    shot('cerrar-y-opciones','.vg-window-actions',12)
    shot('inmersiva-pausa','.vg-progress',6)
    control('play');time.sleep(1);shot('inmersiva-reproduciendo','.vg-progress',6)
    ev('VideoGlass.close()')
    # Hold only the lyrics response so the real loading skeleton can be inspected.
    ev('window.__polishFetch=window.fetch;window.__polishPending=[];window.fetch=(url,opts)=>String(url).includes("/lyrics?")?new Promise((resolve,reject)=>window.__polishPending.push(()=>window.__polishFetch(url,opts).then(resolve,reject))):window.__polishFetch(url,opts);VideoGlass.open()')
    result['skeleton']=ev('Array.from(document.querySelectorAll(".vg-skeleton-line")).map(x=>({height:x.getBoundingClientRect().height,width:x.style.width,shimmer:getComputedStyle(x,"::after").animationDuration}))')
    assert len(result['skeleton'])==5 and all(x['height']==26 and x['shimmer']=='1.6s' for x in result['skeleton'])
    shot('skeleton-letras','.vg-lyrics',6)
    ev('window.fetch=window.__polishFetch;window.__polishPending.forEach(f=>f());delete window.__polishPending;delete window.__polishFetch')
    c.call('Emulation.setEmulatedMedia',{'features':[{'name':'prefers-reduced-motion','value':'reduce'}]});time.sleep(.2)
    result['reduced']=ev('({amplitude:getComputedStyle(document.querySelector("#vg .vg-wave-amplitude")).floodOpacity,spin:getComputedStyle(document.querySelector("#vg .vg-spin")).animationName})')
    assert result['reduced']=={'amplitude':'0','spin':'none'}
    ev('VideoGlass.close()');result['closed']=ev('VideoGlass.diagnostics()');assert result['closed']['mounted'] is False and result['closed']['frames']==0
finally:
    ev('if(window.__polishFetch){window.fetch=window.__polishFetch;if(window.__polishPending)window.__polishPending.forEach(f=>f());delete window.__polishFetch;}delete window.__polishPending;VideoGlass.close()')
    c.call('Emulation.setEmulatedMedia',{'features':[]})
    current=player()
    if current['item']['uri']==initial['item']['uri']:
        control('seek',min(initial['duration']-1,initial['position']+(time.monotonic()-start)*1000 if initial['playing'] else initial['position']))
        control('play' if initial['playing'] else 'pause')
    if was_open:ev('VideoGlass.open()')
(dest/'verification.json').write_text(json.dumps(result,indent=2,ensure_ascii=False));print(json.dumps(result,indent=2,ensure_ascii=False))
