// Run with: gjs tests/geometry.js (no network, account, or playback required).
const GLib=imports.gi.GLib;
const [,bytes]=GLib.file_get_contents('Extensions/videoglass.js');
globalThis.AbortController=class{constructor(){this.signal={};}};
globalThis.window={Spicetify:{Player:{},Platform:{History:{}},Topbar:{Button:class{}}}};
globalThis.Spicetify=window.Spicetify;
globalThis.matchMedia=()=>({matches:false});
globalThis.performance={now:()=>0};
let source=imports.byteArray.toString(bytes);
source=source.replace("document.documentElement.style.setProperty('--vg-art-clip'", "globalThis.testAPI={fmt,flower,drawSpectrum,updateLyric,transition};return;document.documentElement.style.setProperty('--vg-art-clip'");
source=source.replace('(async function ()', '(function ()').replace(/  while \(!window.Spicetify[^\n]+\n/,'');
eval(source);
let checks=0;
function check(ok,message){if(!ok)throw Error(message);checks++;}
const t=globalThis.testAPI;
check(!!t,'Test extraction ran');
for(const [n,expected] of [[-149000,'0:00'],[0,'0:00'],[NaN,'0:00'],[52000,'0:52'],[247000,'4:07']])check(t.fmt(n)===expected,'Nonnegative total time '+n);
for(const [lobes,amp] of [[12,.035],[9,.06]]){
 const points=t.flower(lobes,amp).slice(8,-1).split(',').map(s=>s.split(' ').map(parseFloat));
 check(points.length===180,'Flower point count');
 for(const [x,y] of points)check(x>=0&&x<=100&&y>=0&&y<=100,'Flower bounded');
}
const segments=[];let segment;
const ctx={clearRect(){},beginPath(){segment={alpha:this.globalAlpha};},moveTo(x,y){segment.start=[x,y];},lineTo(x,y){segment.end=[x,y];},stroke(){segments.push(segment);}};
t.drawSpectrum({ctx,size:340,accent:'#fff',bands:new Float32Array(64),target:new Float32Array(64).fill(.8)});
check(segments.length===72,'Exactly 72 audio bars');
check(ctx.lineWidth===5,'Bar width 5 px');
for(const s of segments){const r=Math.hypot(s.start[0]-170,s.start[1]-170);check(r<118*(1-2*.035),'Bars start underneath minimum cover radius');}
check(Math.abs(segments[0].alpha-.5)<1e-9,'Top opacity 50%');
check(Math.abs(segments[36].alpha-1)<1e-9,'Bottom opacity 100%');
const children=[80,150,90].map((h,i,a)=>({offsetTop:a.slice(0,i).reduce((s,x)=>s+x,0),offsetHeight:h,classList:{toggle(){}},setAttribute(){}}));
const list={children,style:{}},lyrics={clientHeight:540};
const v={lines:[{time:0},{time:6000},{time:12000}],line:-2,root:{querySelector:s=>s==='.vg-lyric-list'?list:lyrics}};
for(const pos of [0,7000,14000]){t.updateLyric(v,pos);const offset=parseFloat(list.style.transform.slice(11));const active=children[v.line];check(Math.abs(offset+active.offsetTop+active.offsetHeight/2-540*.45)<.01,'Active lyric stays at anchor with variable height');}
print(JSON.stringify({passed:checks,status:'PASS'}));
