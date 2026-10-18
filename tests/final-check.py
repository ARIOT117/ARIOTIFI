"""Window geometry and disposal checks; preserves the current playback state."""
import json,time,base64
from pathlib import Path
from cdp import CDP
c=CDP();dest=Path('measurements');result={}
def ev(s):
    r=c.evaluate(s)
    if 'exceptionDetails' in r.get('result',{}):raise RuntimeError(json.dumps(r))
    return r.get('result',{}).get('result',{}).get('value')
def shot(name):
    r=c.call('Page.captureScreenshot',{'format':'png'});(dest/(name+'.png')).write_bytes(base64.b64decode(r['result']['data']))
was_open=bool(ev('!!VideoGlass.root'))
try:
    ev('VideoGlass.close()');ev('VideoGlass.open()');time.sleep(.5)
    result['windowed']=ev('({fullscreen:!!document.fullscreenElement,...VideoGlass.diagnostics()})')
    assert result['windowed']['fullscreen'] is False
    shot('immersive-final')
    ev('VideoGlass.close()')
    for width in [640,480]:
        c.call('Emulation.setDeviceMetricsOverride',{'width':width,'height':900,'deviceScaleFactor':1,'mobile':False});time.sleep(.3)
        geometry=ev('(()=>{const r=document.querySelector(".Root__now-playing-bar").getBoundingClientRect(),b=document.querySelector(".vg-dock-open").getBoundingClientRect();return{width:innerWidth,left:r.left,right:r.right,bottom:r.bottom,height:r.height,buttonRight:b.right,buttonLeft:b.left,shell:document.querySelector(".Root__top-container").getBoundingClientRect().width}})()')
        result[str(width)]=geometry
        assert abs(geometry['left']-12)<.1 and abs(width-geometry['right']-12)<.1
        assert geometry['height']==84 and geometry['buttonRight']<=width and geometry['buttonLeft']>=0
        shot('home-'+str(width)+'-final')
        ev('VideoGlass.open()');time.sleep(.2)
        assert ev('document.querySelector(".vg-content").scrollWidth')<=width
        shot('immersive-'+str(width)+'-final');ev('VideoGlass.close()')
    c.call('Emulation.clearDeviceMetricsOverride')
    c.call('Emulation.setEmulatedMedia',{'features':[{'name':'prefers-reduced-motion','value':'reduce'}]});time.sleep(.1)
    ev('VideoGlass.open()')
    result['reducedMotion']=ev('({spin:getComputedStyle(document.querySelector(".vg-spin")).animationName,pulse:getComputedStyle(document.querySelector(".vg-pulse")).animationName,mask:!!document.querySelector("#vg-flower-clip")})')
    assert result['reducedMotion']=={'spin':'none','pulse':'none','mask':False}
    ev('VideoGlass.close()')
    # Exercise disposal repeatedly without animation/network waits.
    ev('(async()=>{for(let i=0;i<10;i++){await VideoGlass.open();await VideoGlass.close();}})()')
    result['closed']=ev('({...VideoGlass.diagnostics(),canvases:document.querySelectorAll("#vg canvas").length,mask:!!document.querySelector("#vg-flower-clip"),inert:document.querySelector(".Root").inert})')
    assert result['closed']['mounted'] is False and result['closed']['frames']==0 and result['closed']['canvases']==0 and not result['closed']['mask'] and not result['closed']['inert']
    shot('home-final')
finally:
    c.call('Emulation.clearDeviceMetricsOverride');c.call('Emulation.setEmulatedMedia',{'features':[]})
    if was_open and not ev('!!VideoGlass.root'):ev('VideoGlass.open()')
(dest/'final-check.json').write_text(json.dumps(result,indent=2,ensure_ascii=False));print(json.dumps(result,indent=2,ensure_ascii=False))
