"""Restore the playback saved before the final audit and remove its page probes."""
import sys,time,json
from pathlib import Path
from cdp import CDP
c=CDP();c.evaluate('VideoGlass.close()');c.call('Page.reload');c.sock.close();time.sleep(6);c=CDP()
def ev(s):
 r=c.evaluate(s)
 if r.get('result',{}).get('exceptionDetails'):raise RuntimeError(str(r))
 return r.get('result',{}).get('result',{}).get('value')
initial=json.loads(Path('measurements/final-audit/resume-playback.json').read_text());uri=initial['item']['uri'];ev('Spicetify.Player.playUri('+json.dumps(uri)+')');time.sleep(.5);ev('Spicetify.Player.seek('+str(initial['position'])+');Spicetify.Player.'+('play' if initial['playing'] else 'pause')+'()');time.sleep(.7)
result=ev('({uri:Spicetify.Player.data.item.uri,playing:Spicetify.Player.isPlaying(),position:Spicetify.Player.getProgress(),audit:typeof window.__vgAudit,view:VideoGlass.diagnostics(),native:getComputedStyle(document.querySelector(".Root__globalNav")).visibility,fullscreen:!!document.fullscreenElement})');result['audio']=ev('fetch("http://127.0.0.1:43891/health").then(r=>r.json())')
assert result['uri']==uri and result['playing']==initial['playing'] and result['audit']=='undefined' and not result['view']['mounted'] and result['view']['flowers']==1 and result['view']['progress']==1 and not result['audio']['pipeline'] and result['audio']['worker_pid'] is None
assets=Path('/home/diego/.local/share/spotify-personalizado/spotify/Apps/xpui');assert (assets/'extensions/videoglass.js').read_bytes()==Path('Extensions/videoglass.js').read_bytes();assert Path('VideoGlass/user.css').read_bytes() in (assets/'user.css').read_bytes()
result['options']=ev('(()=>{const fb=document.querySelector("[data-testid=control-button-playpause]").__flower,wp=document.querySelector("[data-vg-progress]").__wavy;return {period:FlowerButton.period,flowerAmplitude:fb.amp,lobes:fb.lobes,size:fb.size,amplitude:wp.amp,wavelength:wp.wavelength,speed:wp.speed,stroke:wp.stroke}})()')
Path('measurements/final-audit/installed-final.json').write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2))
