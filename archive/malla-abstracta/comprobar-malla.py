"""Focused mesh checks in Spotify's actual Canvas implementation via local CDP."""
import sys,json,time,base64
from pathlib import Path
sys.path.insert(0,'/home/diego/Documentos/Spotify-personalizado')
from importlib.machinery import SourceFileLoader
CDP=SourceFileLoader('vg_cdp','/home/diego/Documentos/Spotify-personalizado/cdp-check.py').load_module().CDP
out=Path(__file__).resolve().parent
source=Path('/home/diego/.config/spicetify/Extensions/videoglass.js').read_text()
c=CDP()
def ev(js):
    result=c.evaluate(js)
    if 'exceptionDetails' in result.get('result',{}):raise RuntimeError(str(result))
    return result['result']['result'].get('value')
report={}
report['syntax']=ev('new Function('+json.dumps(source)+'); true')
block=source[source.index('  // Abstract mesh:'):source.index('  function draw(now=')]
factory="new Function('bands','target','settings','reducedMotion','$',"+json.dumps(block+'\nreturn {state:abstractMesh,smoothAbstract,abstractRadius,drawAbstract};')+")"
js='''(()=>{
 const b=Array(64).fill(0),t=Array(64).fill(0);
 const mesh=FACTORY(b,t,{sensitivity:100},{matches:false},()=>({clientWidth:365}));
 const radii=()=>Array.from({length:64},(_,j)=>Array.from({length:240},(_,i)=>mesh.abstractRadius(i/240*Math.PI*2,j,512,135)));
 const stats=r=>{const flat=r.flat();return {min:Math.min(...flat),max:Math.max(...flat),mean:flat.reduce((s,v)=>s+v,0)/flat.length,finite:flat.every(Number.isFinite)}};
 let now=100;
 mesh.smoothAbstract(now,false);const quiet=stats(radii());
 for(let i=0;i<64;i++)t[i]=.35+.5*(.5+.5*Math.sin(i*1.7));
 for(let frame=0;frame<30;frame++)mesh.smoothAbstract(now+=1000/24,true);
 const activeR=radii(),active=stats(activeR),attack=b[0];
 const seam=Math.abs(mesh.abstractRadius(0,30,512,135)-mesh.abstractRadius(Math.PI*2,30,512,135));
 const seamNear=Math.abs(mesh.abstractRadius(.00001,30,512,135)-mesh.abstractRadius(Math.PI*2-.00001,30,512,135));
 const rotationalDifference=activeR[50].reduce((sum,r,i)=>sum+Math.abs(r-activeR[50][(i+60)%240]),0)/240;
 const phasesDifferent=activeR[30].some((r,i)=>Math.abs(r-activeR[31][i])>.1);
 const previous=b[0];mesh.smoothAbstract(now+=1000/24,false);const firstRelease=b[0];
 for(let frame=0;frame<150;frame++)mesh.smoothAbstract(now+=1000/24,false);
 const paused=stats(radii());const settled=!mesh.state.settling;
 const phase=mesh.state.phase;mesh.smoothAbstract(now+=1000/24,false);const silenceFreezesPhase=phase===mesh.state.phase;
 // Distinct frequency bins must affect different sectors.
 const sector=(bin)=>{b.fill(0);t.fill(0);b[bin]=.9;return radii()[50]};
 const mid2=sector(2),mid6=sector(6),high20=sector(20);
 const sectorDifference=mid2.reduce((s,r,i)=>s+Math.abs(r-mid6[i]),0)/240;
 const highResponse=Math.max(...high20)>quiet.max;
 b.fill(.65);
 const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
 const ctx=canvas.getContext('2d');let strokes=0,fills=0;const widths=[],alphas=[];
 const originalStroke=ctx.stroke.bind(ctx);ctx.stroke=()=>{strokes++;widths.push(ctx.lineWidth);alphas.push(ctx.globalAlpha);originalStroke()};
 ctx.fill=()=>{fills++};mesh.drawAbstract(ctx,512,512);
 const pixels=ctx.getImageData(0,0,512,512).data;let insidePixels=0,meshPixels=0;
 for(let y=0;y<512;y++)for(let x=0;x<512;x++){if(pixels[(y*512+x)*4+3]){meshPixels++;if(Math.hypot(x-256,y-256)<131)insidePixels++}}
 const start=performance.now();for(let i=0;i<12;i++){ctx.clearRect(0,0,512,512);mesh.drawAbstract(ctx,512,512)}
 const frameMs=(performance.now()-start)/12;
 return {quiet,active,paused,attack,previous,firstRelease,seam,seamNear,rotationalDifference,phasesDifferent,sectorDifference,highResponse,settled,silenceFreezesPhase,strokes:strokes/13,fills,minWidth:Math.min(...widths),maxWidth:Math.max(...widths),maxAlpha:Math.max(...alphas),insidePixels,meshPixels,frameMs,
 pass:active.finite&&active.max>quiet.max+20&&active.min>=135&&active.max<256&&seam<.001&&seamNear<.01&&rotationalDifference>1&&phasesDifferent&&firstRelease>0&&firstRelease<previous&&settled&&silenceFreezesPhase&&sectorDifference>1&&highResponse&&strokes===64*13&&fills===0&&insidePixels===0&&Math.min(...widths)>=.4&&Math.max(...alphas)<.2};
})()'''.replace('FACTORY',factory)
report['geometry']=ev(js)
report['live']=ev('''(()=>{VideoGlass.open();return {style:VideoGlass.settings.style,shape:VideoGlass.settings.shape,buttons:VideoGlass.root.querySelectorAll('.transport button').length,seek:!!VideoGlass.root.querySelector('.seek'),volume:!!VideoGlass.root.querySelector('.vol'),title:VideoGlass.root.querySelector('.title').textContent,playing:VideoGlass.player.isPlaying()}})()''')
time.sleep(2)
report['canvas']=ev('''(()=>{const canvas=document.querySelector('#vg .ring'),art=document.querySelector('#vg .art'),r=art.getBoundingClientRect();return {cssWidth:canvas.clientWidth,pixelWidth:canvas.width,dpr:devicePixelRatio,coverWidth:r.width,coverHeight:r.height,borderRadius:getComputedStyle(art).borderRadius,transform:art.style.transform}})()''')
r=c.call('Page.captureScreenshot',{'format':'png'})
(out/'malla-en-spotify.png').write_bytes(base64.b64decode(r['result']['data']))
report['passed']=report['syntax'] and report['geometry']['pass'] and report['live']['buttons']==5 and report['live']['seek'] and report['live']['volume']
(out/'comprobacion.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps(report,ensure_ascii=False,indent=2))
if not report['passed']:sys.exit(1)
