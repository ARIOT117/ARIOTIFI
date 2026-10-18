"""Check live native controls, replacement DOM and delayed lyrics/artwork states."""
import json,time,base64,subprocess,re,os
from pathlib import Path
from cdp import CDP
c=CDP();dest=Path('measurements/final-audit/visual-200');dest.mkdir(parents=True,exist_ok=True);out={}
def ev(s):
    r=c.evaluate(s)
    if r.get('result',{}).get('exceptionDetails'):raise RuntimeError(json.dumps(r))
    return r.get('result',{}).get('result',{}).get('value')
def shot(name,sel):
    r=ev('document.querySelector('+json.dumps(sel)+').getBoundingClientRect().toJSON()')
    clip={'x':max(0,r['x']-6),'y':max(0,r['y']-6),'width':r['width']+12,'height':r['height']+12,'scale':1}
    (dest/(name+'.png')).write_bytes(base64.b64decode(c.call('Page.captureScreenshot',{'format':'png','clip':clip})['result']['data']))
def native_corner():
    os.environ['GDK_BACKEND']='x11'
    import gi
    gi.require_version('Gdk','3.0');gi.require_version('GdkX11','3.0');from gi.repository import Gdk,GdkX11
    from PIL import Image
    tree=subprocess.check_output(['xwininfo','-root','-tree'],text=True)
    line=next(x for x in tree.splitlines() if '("spotify" "Spotify")' in x and re.search(r'\s(?:1\d{3}|[2-9]\d{3})x\d+',x))
    Gdk.init([]);w=GdkX11.X11Window.foreign_new_for_display(Gdk.Display.get_default(),int(re.search(r'0x[0-9a-f]+',line)[0],16));p=Gdk.pixbuf_get_from_window(w,0,0,240,110)
    im=Image.frombytes('RGB',(p.get_width(),p.get_height()),bytes(p.get_pixels()),'raw','RGB',p.get_rowstride());im.resize((480,220),Image.Resampling.LANCZOS).save(dest/'cerrar-esquina-nativa.png')
def flower():return ev('(()=>{const f=document.querySelector("[data-testid=control-button-playpause]").__flower;return {transform:f.svg.style.transform,playing:f.playing,size:f.size,period:FlowerButton.period,path:f.svg.firstChild.getAttribute("d")}})()')
initial=ev('({playing:Spicetify.Player.isPlaying(),position:Spicetify.Player.getProgress(),uri:Spicetify.Player.data.item.uri})')
try:
    ev('VideoGlass.close();Spicetify.Player.seek(Math.min(90000,Spicetify.Player.getDuration()*.35));Spicetify.Player.play()');time.sleep(1)
    a=flower();time.sleep(1);b=flower();assert a['transform']!=b['transform'] and b['period']==24 and b['size']==40;out['rotation']=True
    # Spotify replacing children must reattach the same SVG and preserve its clock.
    ev('(()=>{const b=document.querySelector("[data-testid=control-button-playpause]");b.__flower.svg.remove();})()');time.sleep(.1)
    assert ev('document.querySelector("[data-testid=control-button-playpause]").__flower.svg.isConnected')
    out['wholeButtonReplaced']=ev('''(async()=>{const old=document.querySelector("[data-testid=control-button-playpause]"),before=old.__flower,copy=old.cloneNode(true);copy.querySelector('[viewBox="0 0 100 100"]')?.remove();old.replaceWith(copy);await Promise.resolve();const ok=!!copy.__flower&&!copy.__flower._dead&&copy.__flower.svg.isConnected&&before._dead;copy.replaceWith(old);await Promise.resolve();return ok&&!!old.__flower&&!old.__flower._dead})()''');assert out['wholeButtonReplaced']

    size=ev('({width:innerWidth,height:innerHeight})');c.call('Emulation.setDeviceMetricsOverride',dict(size,deviceScaleFactor=2,mobile=False));time.sleep(.2);ev('document.querySelectorAll("[data-vg-progress],.vg-seek-wrap").forEach(h=>{h.__wavy?._resize();h.__wavy?._draw()})');shot('barra-reproduciendo','.main-nowPlayingBar-center')
    ev('Spicetify.Player.pause()');time.sleep(1);a=flower();time.sleep(.6);b=flower();assert a['transform']==b['transform'];out['pauseFrozen']=True;shot('barra-pausa','.main-nowPlayingBar-center')
    # Fixture only for delayed/empty/instrumental presentation, never memory stress.
    ev('window.__vgRealFetch=window.fetch;window.fetch=(url,opts)=>String(url).includes("/lyrics?")?new Promise((resolve,reject)=>{window.__vgLyricsResolve=resolve;opts?.signal?.addEventListener("abort",()=>reject(new DOMException("Abort","AbortError")),{once:true})}):__vgRealFetch(url,opts);VideoGlass.open()')
    assert ev('document.querySelectorAll("#vg .vg-skeleton-line").length')==5;shot('letras-skeleton','.vg-lyrics')
    ev('__vgLyricsResolve(new Response(JSON.stringify({syncedLyrics:"[00:00.00]\\n[59:59.00]Letra de verificación"})))');time.sleep(.3)
    out['lyricsLoaded']=ev('({skeleton:document.querySelectorAll("#vg .vg-loading,#vg .vg-skeleton-line").length,current:document.querySelector(".vg-lyric.current")?.textContent,busy:document.querySelector(".vg-lyrics").getAttribute("aria-busy")})');assert out['lyricsLoaded']['skeleton']==0 and out['lyricsLoaded']['busy']=='false';shot('letras-instrumental-sin-skeleton','.vg-lyrics')
    c.call('Emulation.clearDeviceMetricsOverride');time.sleep(.2);native_corner()
    out['nativeCorner']=ev('({fullscreen:!!document.fullscreenElement,nav:getComputedStyle(document.querySelector(".Root__globalNav")).visibility,gap:(()=>{const a=document.querySelector("[data-action=close]").getBoundingClientRect(),b=document.querySelector("[data-action=more]").getBoundingClientRect();return b.left-a.right})(),flower:document.querySelector(".vg-play").__flower.size,cover:!!document.querySelector("img.vg-art")?.naturalWidth})');assert out['nativeCorner']['gap']==8 and out['nativeCorner']['flower']==64 and not out['nativeCorner']['fullscreen']
    ev('VideoGlass.close()');ev('VideoGlass.open()');ev('__vgLyricsResolve(new Response(JSON.stringify({instrumental:true})))');time.sleep(.2);assert ev('document.querySelectorAll("#vg .vg-loading,#vg .vg-skeleton-line").length')==0;out['emptyRemoved']=True;shot('letras-sin-letra','.vg-lyrics')
    ev('VideoGlass.close()');out['closed']=ev('({...VideoGlass.diagnostics(),native:getComputedStyle(document.querySelector(".Root__globalNav")).visibility,health:null})');out['health']=ev('fetch("http://127.0.0.1:43891/health").then(r=>r.json())');assert not out['health']['pipeline'] and not out['health']['lease_timer'];assert out['closed']['flowers']==1 and out['closed']['progress']==1 and not out['closed']['mounted']
finally:
    c.call('Emulation.clearDeviceMetricsOverride');ev('if(window.__vgRealFetch){window.fetch=__vgRealFetch;delete window.__vgRealFetch;delete window.__vgLyricsResolve;}VideoGlass.close()');ev('if(Spicetify.Player.data.item.uri==='+json.dumps(initial['uri'])+')Spicetify.Player.seek('+str(initial['position'])+');Spicetify.Player.'+('play' if initial['playing'] else 'pause')+'()')
(dest/'verification.json').write_text(json.dumps(out,indent=2,ensure_ascii=False));print(json.dumps(out,indent=2,ensure_ascii=False))
