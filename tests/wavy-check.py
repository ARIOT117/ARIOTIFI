"""Validate the unmodified supplied renderer and capture real Spotify at 200%."""
import json,time,base64,subprocess,re,os
from pathlib import Path
from cdp import CDP
c=CDP();dest=Path('measurements/wavy-original-200');result={}
def ev(s):
    r=c.evaluate(s)
    if 'exceptionDetails' in r.get('result',{}):raise RuntimeError(json.dumps(r))
    return r.get('result',{}).get('result',{}).get('value')
def player():return ev('fetch("http://127.0.0.1:43891/player").then(r=>r.json())')
def control(action,value=None):return ev('fetch("http://127.0.0.1:43891/control",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify('+json.dumps({'action':action,'value':value})+')}).then(r=>r.json())')
def rect(selector):return ev('document.querySelector('+json.dumps(selector)+').getBoundingClientRect().toJSON()')
def shot(name,selector,pad=4):
    r=rect(selector);clip={'x':max(0,r['x']-pad),'y':max(0,r['y']-pad),'width':r['width']+2*pad,'height':r['height']+2*pad,'scale':1}
    data=c.call('Page.captureScreenshot',{'format':'png','clip':clip})['result']['data'];(dest/(name+'.png')).write_bytes(base64.b64decode(data))
def native_corner(name):
    import gi
    gi.require_version('Gdk','3.0');gi.require_version('GdkX11','3.0')
    from gi.repository import Gdk,GdkX11
    from PIL import Image
    tree=subprocess.check_output(['xwininfo','-root','-tree'],text=True)
    matches=[line for line in tree.splitlines() if '("spotify" "Spotify")' in line and re.search(r'\s(?:1\d{3}|[2-9]\d{3})x\d+',line)]
    assert matches,'Spotify X11 window not found'
    xid=int(re.search(r'0x[0-9a-f]+',matches[0])[0],16)
    Gdk.init([]);w=GdkX11.X11Window.foreign_new_for_display(Gdk.Display.get_default(),xid)
    p=Gdk.pixbuf_get_from_window(w,0,0,240,110)
    im=Image.frombytes('RGB',(p.get_width(),p.get_height()),bytes(p.get_pixels()),'raw','RGB',p.get_rowstride())
    im.resize((480,220),Image.Resampling.LANCZOS).save(dest/(name+'.png'))
initial=player();was_open=bool(ev('!!VideoGlass.root'));started=time.monotonic()
try:
    ev('VideoGlass.close()');control('play');time.sleep(1)
    # Observe actual calls into the supplied implementation, without editing it.
    ev('window.__wpCheck={writes:[],draws:[],destroyed:[],native:[]};window.__wpMethods={setProgress:WavyProgress.prototype.setProgress,draw:WavyProgress.prototype._draw,destroy:WavyProgress.prototype.destroy,native:Spicetify.Platform.NativeAPI.setWindowButtonsVisibility};WavyProgress.prototype.setProgress=function(ms){__wpCheck.writes.push({host:this.host.classList.contains("vg-seek-wrap")?"immersive":"dock",at:performance.now(),amplitude:this.amp,wavelength:this.wavelength,speed:this.speed,stroke:this.stroke});return __wpMethods.setProgress.call(this,ms)};WavyProgress.prototype._draw=function(){if(__wpCheck.draws.length<1000)__wpCheck.draws.push({host:this.host.classList.contains("vg-seek-wrap")?"immersive":"dock",at:performance.now(),pos:this._currentMs(),phase:this.phase,raf:this.raf});return __wpMethods.draw.call(this)};WavyProgress.prototype.destroy=function(){__wpCheck.destroyed.push(this.host.className);return __wpMethods.destroy.call(this)};Spicetify.Platform.NativeAPI.setWindowButtonsVisibility=function(on){__wpCheck.native.push(on);return __wpMethods.native.call(this,on)}')
    size=ev('({width:innerWidth,height:innerHeight})');c.call('Emulation.setDeviceMetricsOverride',{'width':size['width'],'height':size['height'],'deviceScaleFactor':2,'mobile':False});time.sleep(.4)
    for i in range(4):shot('barra-reproduciendo-'+str(i+1),'.playback-bar');time.sleep(.3)
    shot('barra-reproduciendo','.main-nowPlayingBar-center',6)
    result['component']=ev('({canvases:document.querySelectorAll("[data-vg-progress]>canvas").length,oldSVG:document.querySelectorAll(".vg-progress-svg,.vg-wave-field,.vg-progress-visual").length,nativeRail:getComputedStyle(document.querySelector("[data-vg-progress] [data-testid=progress-bar-background]")).opacity})')
    assert result['component']=={'canvases':1,'oldSVG':0,'nativeRail':'0'}
    control('pause');time.sleep(1.5);shot('barra-pausa','.main-nowPlayingBar-center',6);shot('barra-pausa-progreso','.playback-bar')
    before=ev('__wpCheck.draws.length');time.sleep(.5);result['pausedIdle']=ev('__wpCheck.draws.length')==before;assert result['pausedIdle']
    c.call('Emulation.clearDeviceMetricsOverride');time.sleep(.2)
    ev('VideoGlass.open()');time.sleep(.3)
    result['immersive']=ev('({body:document.body.classList.contains("vg-immersive-open"),nav:getComputedStyle(document.querySelector(".Root__globalNav")).visibility,pointer:getComputedStyle(document.querySelector(".Root__globalNav")).pointerEvents,z:getComputedStyle(VideoGlass.root).zIndex,canvases:document.querySelectorAll(".vg-seek-wrap>canvas").length,gap:(()=>{const a=document.querySelector(".vg-window-actions [data-action=close]").getBoundingClientRect(),b=document.querySelector(".vg-window-actions [data-action=more]").getBoundingClientRect();return b.left-a.right})(),fullscreen:!!document.fullscreenElement})')
    assert result['immersive']=={'body':True,'nav':'hidden','pointer':'none','z':'2147483647','canvases':1,'gap':8,'fullscreen':False}
    native_corner('esquina-inmersiva-nativa')
    control('play');time.sleep(1.5)
    ev('VideoGlass.close()');result['close']=ev('({body:document.body.classList.contains("vg-immersive-open"),nav:getComputedStyle(document.querySelector(".Root__globalNav")).visibility,canvas:document.querySelectorAll("#vg canvas").length,destroyed:__wpCheck.destroyed,native:__wpCheck.native})')
    assert not result['close']['body'] and result['close']['nav']=='visible' and result['close']['canvas']==0 and 'vg-seek-wrap' in result['close']['destroyed'] and result['close']['native'][-2:]==[False,True]
    native_corner('esquina-normal-menu-restaurado')
    stats=ev('__wpCheck');result['rates']={}
    for host in ['dock','immersive']:
        calls=[x for x in stats['writes'] if x['host']==host]
        assert calls and all((x['amplitude'],x['wavelength'],x['speed'],x['stroke'])==(2.2,30,.3,2.5) for x in calls)
        gaps=[b['at']-a['at'] for a,b in zip(calls,calls[1:])]
        result['rates'][host]={'writes':len(calls),'minIntervalMs':min(gaps) if gaps else None};assert not gaps or min(gaps)>=250
    draw=[x for x in stats['draws'] if x['host']=='dock'];result['continuousFrames']=len({round(x['pos'],1) for x in draw});assert result['continuousFrames']>30
finally:
    c.call('Emulation.clearDeviceMetricsOverride')
    ev('if(window.__wpMethods){WavyProgress.prototype.setProgress=__wpMethods.setProgress;WavyProgress.prototype._draw=__wpMethods.draw;WavyProgress.prototype.destroy=__wpMethods.destroy;Spicetify.Platform.NativeAPI.setWindowButtonsVisibility=__wpMethods.native;}VideoGlass.close()')
    ev('delete window.__wpMethods;delete window.__wpCheck;true')
    current=player()
    if current['item']['uri']==initial['item']['uri']:
        target=initial['position']+(time.monotonic()-started)*1000 if initial['playing'] else initial['position'];control('seek',min(initial['duration']-1,target));control('play' if initial['playing'] else 'pause')
    if was_open:ev('VideoGlass.open()')
(dest/'verification.json').write_text(json.dumps(result,indent=2,ensure_ascii=False));print(json.dumps(result,indent=2,ensure_ascii=False))
