// VideoGlass: immersive Spotify player inspired by the downloaded QML reference.
(async function () {
  while (!window.Spicetify?.Platform?.PlayerAPI?._state || !Spicetify.Platform.PlaybackAPI || !Spicetify.Topbar) await new Promise(r => setTimeout(r, 300));
  const nativePlayer=Spicetify.Player, API='http://127.0.0.1:43891';
  let bridge=null,bridgeTime=0,bridgePolling=false;
  async function sendControl(action,value){
    try{
      const response=await fetch(API+'/control',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,value})});
      if(!response.ok)throw new Error('Playback command failed');
      await refreshPlayer();
    }catch(error){notify('No se pudo realizar esta acción.');console.warn('[VideoGlass]',error);}
  }
  async function refreshPlayer(){
    try{const response=await fetch(API+'/player');if(!response.ok)return;bridge=await response.json();bridgeTime=performance.now();}catch{}
  }
  async function pollPlayer(){
    if(bridgePolling)return;bridgePolling=true;
    while(open){await refreshPlayer();await new Promise(r=>setTimeout(r,document.hidden?1500:300));}
    bridgePolling=false;
  }
  const P={
    get origin(){return bridge?{_state:bridge}:null},get data(){return bridge},
    getProgress:()=>Math.min(bridge?.duration||0,(bridge?.position||0)+(bridge?.playing?performance.now()-bridgeTime:0)),
    getDuration:()=>bridge?.duration||0,getVolume:()=>bridge?.volume||0,
    isPlaying:()=>!!bridge?.playing,getShuffle:()=>!!bridge?.shuffle,getRepeat:()=>bridge?.repeat||0,
    pause:()=>sendControl('pause'),play:()=>sendControl('play'),togglePlay:()=>sendControl('toggle'),
    next:()=>sendControl('next'),back:()=>sendControl('back'),seek:value=>sendControl('seek',value),
    setVolume:value=>sendControl('volume',value),setShuffle:value=>sendControl('shuffle',value),setRepeat:value=>sendControl('repeat',value),
    addEventListener:(...args)=>nativePlayer.addEventListener(...args)
  };
  const defaults = {enabled:true,shape:'circle',style:'abstract',blur:36,dark:42,saturation:120,sensitivity:120,lyrics:true,art:true};
  let settings; try { settings = {...defaults, ...JSON.parse(localStorage.getItem('videoglass') || '{}')}; } catch { settings = {...defaults}; }
  // Select the requested design once; subsequent choices remain saved.
  if(localStorage.getItem('videoglass-ribbon-v1')!=='true'){
    Object.assign(settings,{style:'ribbon',shape:'circle',enabled:true,art:true});
    localStorage.setItem('videoglass',JSON.stringify(settings));
    localStorage.setItem('videoglass-ribbon-v1','true');
    localStorage.setItem('videoglass-open','true');
  }
  if(localStorage.getItem('videoglass-abstract-v1')!=='true'){
    Object.assign(settings,{style:'abstract',shape:'circle',enabled:true,art:true});
    localStorage.setItem('videoglass',JSON.stringify(settings));
    localStorage.setItem('videoglass-abstract-v1','true');
    localStorage.setItem('videoglass-open','true');
  }
  if(localStorage.getItem('videoglass-swiftify-v1')!=='true'){
    Object.assign(settings,{style:'swiftify',shape:'flower',enabled:true,art:true,lyrics:true,blur:48,dark:46,saturation:150});
    localStorage.setItem('videoglass',JSON.stringify(settings));
    localStorage.setItem('videoglass-swiftify-v1','true');
    localStorage.setItem('videoglass-open','true');
  }
  let open = false, mini = false, lines = [], plain = '', lastURI = '', generation = 0, lastLine = -2;
  let bands = Array(64).fill(0), target = Array(64).fill(0), audioOK = false, frame = 0, polling = false;
  let sleepDeadline = 0, noticeTimer, animationTimer=0, visualDirty=true;
  let transitionId=0, transitionTimer=0, returnFocus=null, seekPending=false;
  const dragging=new Set(), reducedMotion=matchMedia("(prefers-reduced-motion: reduce)");
  const rendered={};
  const css = document.createElement('style');
  css.textContent = `
  #vg{position:fixed;inset:0;z-index:10000;color:#f7f9fc;background:#101318;font-family:inherit;display:none;overflow:hidden;--blur:36px;--dark:.42;--sat:1.2;--accent:#a9dccd;--view-duration:460ms;opacity:0;transform:translateY(32px) scale(.97);transition:opacity var(--view-duration) cubic-bezier(.4,0,.2,1),transform var(--view-duration) cubic-bezier(.4,0,.2,1)}
  #vg.open{display:block}#vg.vg-visible{opacity:1;transform:translateY(0) scale(1)}#vg.vg-transitioning{will-change:opacity,transform} #vg .backdrop{position:absolute;inset:-90px;background-position:center;background-size:cover;filter:blur(var(--blur)) saturate(var(--sat));transform:scale(1.08);transition:background-image .9s;will-change:transform}
  #vg .shade{position:absolute;inset:0;background:linear-gradient(125deg,rgba(6,14,20,var(--dark)),rgba(0,8,18,.25)),#00000020}
  #vg .toolbar{position:absolute;top:20px;left:24px;right:24px;display:flex;justify-content:flex-end;align-items:center;z-index:4}
  #vg button{border:0;cursor:pointer;color:inherit;font:inherit;display:inline-flex;align-items:center;justify-content:center;background:transparent;border-radius:50%;width:38px;height:38px;transition:background .15s,transform .15s}#vg button:hover{background:#ffffff20;transform:scale(1.04)}#vg button:focus-visible{outline:2px solid var(--accent);outline-offset:3px}#vg button svg{width:19px;height:19px;fill:currentColor}#vg .buttons{display:flex;gap:6px;align-items:center;background:#ffffff0b;padding:4px 8px;border-radius:30px;backdrop-filter:blur(20px)}
  #vg .layout{position:absolute;inset:78px 7% 92px;display:grid;grid-template-columns:minmax(0,.95fr) minmax(0,1.05fr);align-items:center;gap:6%;z-index:2}#vg.no-lyrics .layout{grid-template-columns:minmax(0,1fr)}#vg .song{max-width:560px;margin:auto;width:100%}#vg.no-lyrics .song{max-width:660px}
  #vg .song{text-align:center;min-width:0}#vg .art-space{--art-size:clamp(190px,38vh,410px);height:auto;width:min(var(--art-size),80%);aspect-ratio:1;position:relative;display:grid;place-items:center;margin:0 auto 24px}
  #vg .art{position:relative;width:72%;height:72%;object-fit:cover;box-shadow:0 18px 65px #0006;will-change:transform;transition:clip-path .7s,border-radius .7s,opacity .3s;z-index:2}#vg[data-shape=circle] .art{border-radius:50%}#vg[data-shape=square] .art{border-radius:12px}#vg[data-shape=flower] .art{clip-path:polygon(100% 50%,94% 62%,98% 75%,85% 81%,83% 94%,69% 93%,60% 100%,50% 95%,38% 100%,31% 91%,17% 94%,16% 80%,3% 75%,7% 61%,0% 50%,7% 38%,3% 25%,17% 19%,18% 6%,31% 8%,40% 0%,50% 5%,62% 0%,69% 9%,83% 6%,84% 20%,97% 25%,93% 38%)}
  #vg[data-style=abstract] .ring{inset:-20%;width:140%;height:140%}#vg[data-style=abstract] .art{border-radius:50%;clip-path:none}
  #vg[data-style=ribbon] .ring{inset:-8% auto auto -45%;width:190%;height:116%}#vg[data-style=ribbon] .art{box-shadow:0 0 0 1px #ffd9e699,0 0 22px #ef9aaa33,0 18px 65px #0006}#vg .ring{position:absolute;inset:-8%;width:116%;height:116%;pointer-events:none;z-index:1}#vg .title{font-size:clamp(24px,2.5vw,40px);font-weight:700;letter-spacing:-.02em;line-height:1.2;margin-bottom:8px;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}#vg .artist{font-size:16px;line-height:1.4;color:#ffffffb3;margin:0 0 20px}#vg .album{font-size:12px;line-height:1.4;color:#ffffff8c;margin-top:10px}
  #vg input[type=range]{accent-color:#1ed760;cursor:pointer;min-width:0}
  #vg .transport{display:flex;justify-content:center;align-items:center;gap:20px;margin:0 0 18px}
  #vg .transport button{position:relative;width:44px;height:44px;color:#ffffffb3;flex-shrink:0}
  #vg .transport button:hover{color:#fff;background:transparent;transform:scale(1.06)}
  #vg .transport button:active{transform:scale(.96)}#vg .transport button svg{width:22px;height:22px}
  #vg .transport .play{background:#fff;color:#121212;width:64px;height:64px;box-shadow:0 4px 16px #0002}
  #vg .transport .play:hover{background:#fff;color:#121212;transform:scale(1.05)}#vg .transport .play svg{width:26px;height:26px}
  #vg .transport .active{color:#1ed760}#vg .transport .active:hover{color:#3be477}
  #vg .transport .active::after{content:"";position:absolute;bottom:0;width:4px;height:4px;border-radius:50%;background:currentColor}
  #vg .progress{display:flex;align-items:center;gap:12px;width:100%;max-width:480px;margin:0 auto;color:#ffffffb3;font-size:12px;font-variant-numeric:tabular-nums;line-height:1.4}
  #vg .progress span{min-width:36px;flex-shrink:0}#vg .elapsed{text-align:right}#vg .duration{text-align:left}
  #vg .progress input{flex:1;width:100%}
  #vg .volume{display:flex;gap:10px;align-items:center;justify-content:center;margin-top:14px;color:#ffffffb3}
  #vg .volume input{width:180px}#vg .volume>svg{width:20px;height:20px}
  #vg .progress input,#vg .volume input{--fill:0%;--rail-color:#fff;-webkit-appearance:none;appearance:none;height:28px;padding:0;margin:0;border:0;background:transparent;outline:none}
  #vg .progress input::-webkit-slider-runnable-track,#vg .volume input::-webkit-slider-runnable-track{height:4px;border-radius:2px;background:linear-gradient(to right,var(--rail-color) 0 var(--fill),#ffffff40 var(--fill) 100%)}
  #vg .progress input::-webkit-slider-thumb,#vg .volume input::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:12px;height:12px;margin-top:-4px;border:0;border-radius:50%;background:#fff;opacity:0;transition:opacity .12s}
  #vg .progress input:hover,#vg .volume input:hover,#vg .progress input:focus-visible,#vg .volume input:focus-visible{--rail-color:#1ed760}
  #vg .progress input:hover::-webkit-slider-thumb,#vg .volume input:hover::-webkit-slider-thumb,#vg .progress input:focus-visible::-webkit-slider-thumb,#vg .volume input:focus-visible::-webkit-slider-thumb{opacity:1}
  #vg .progress input:focus-visible,#vg .volume input:focus-visible{outline:2px solid #fff;outline-offset:2px;border-radius:4px}
  #vg .lyrics{height:100%;min-height:200px;overflow-y:auto;scrollbar-width:none;mask-image:linear-gradient(transparent,#000 14%,#000 84%,transparent);padding:32vh 5px 32vh;scroll-behavior:smooth}#vg .lyric{display:block;width:100%;height:auto;text-align:left;line-height:1.5;font-size:clamp(16px,2vw,28px);font-weight:650;letter-spacing:-.02em;opacity:.30;padding:8px 0;border-radius:0;transition:opacity .25s,transform .25s;justify-content:flex-start}#vg .lyric.current{opacity:1;transform:translateX(5px)}#vg .lyric:hover{opacity:.8;background:transparent;transform:none}#vg .lyric-note{font-size:18px;line-height:1.6;opacity:.55;padding-top:5vh}#vg.no-lyrics .lyrics{display:none}
  #vg .bottom-vis{position:absolute;left:3%;bottom:18px;width:94%;height:115px;opacity:.68;pointer-events:none;z-index:1}#vg .status{position:absolute;bottom:15px;right:24px;font-size:10px;opacity:.5;z-index:3}#vg .toast{position:absolute;bottom:150px;left:50%;transform:translateX(-50%);background:#0d131bdd;padding:12px 22px;border-radius:24px;z-index:9;display:none;font-size:13px}
  #vg .settings{position:absolute;inset:0;background:#0004;display:none;align-items:center;justify-content:center;z-index:7;backdrop-filter:blur(4px)}#vg .settings.visible{display:flex}#vg .dialog{width:min(630px,92vw);max-height:85vh;overflow:auto;background:#0c0d10f7;box-shadow:0 25px 100px #0009;border:1px solid #ffffff10;border-radius:18px;display:grid;grid-template-columns:145px 1fr;padding:12px}
  #vg .volume>svg{width:20px;height:20px;fill:currentColor;flex-shrink:0}
  #vg .tabs{border-right:1px solid #ffffff0a;padding:15px 10px}#vg .tab{width:100%;height:auto;justify-content:flex-start;border-radius:9px;padding:12px 8px;font-size:12px;gap:8px;opacity:.55;margin:3px 0}#vg .tab.selected{opacity:1;background:#ffffff08}#vg .tab svg{width:15px;height:15px}#vg .panel{padding:16px 22px}#vg .panel h3{font-size:17px;margin:0 0 28px}#vg .setting-row{margin:22px 0;font-size:12px;color:#c6cbd2}#vg .setting-row label{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}#vg .setting-row input[type=range]{width:100%}#vg .setting-row select{background:#23262b;border:0;border-radius:20px;color:white;padding:7px 10px;font:inherit}#vg .setting-row small{opacity:.6;line-height:1.6;display:block;margin-top:18px}#vg input[type=checkbox]{accent-color:#1ed760;width:17px;height:17px}#vg .close-settings{float:right;width:28px;height:28px;margin-top:-4px}#vg .timer-actions{display:flex;flex-wrap:wrap;gap:8px}#vg .timer-actions button{width:auto;height:auto;border-radius:20px;background:#ffffff0c;padding:10px 13px;font-size:12px}
  #vg.mini .layout{inset:76px 18% 65px;grid-template-columns:minmax(0,1fr)}#vg.mini .lyrics,#vg.mini .artist,#vg.mini .album{display:none}#vg.mini .art-space{height:clamp(150px,30vh,300px);width:clamp(150px,30vh,300px);margin-bottom:16px}#vg.mini .title{font-size:22px}#vg.mini .transport{margin:0 0 12px;gap:14px}#vg.mini .transport .play{width:56px;height:56px}#vg.mini .bottom-vis{height:60px}#vg .hide-art .art{opacity:0}
  @media(max-width:1100px){#vg .layout{inset:78px 5% 70px;gap:5%}#vg .transport{gap:12px}#vg .transport .play{width:56px;height:56px}#vg .transport button{width:38px;height:38px}#vg .progress{gap:8px}#vg .artist{font-size:15px}}
  body.vg-immersive .Root{visibility:hidden;pointer-events:none}
  #vg .ring,#vg .bottom-vis{contain:strict;transform:translateZ(0)}
  #vg-launcher{display:flex;align-items:center;justify-content:center;align-self:center;gap:8px;box-sizing:border-box;height:48px;min-height:48px;min-width:48px;padding:0 16px;margin-inline:8px 0;flex:0 0 auto;border:1px solid #ffffff16;border-radius:24px;background:#153028;color:#c8ecdf;font-family:inherit;font-weight:600;font-size:13px;line-height:1;cursor:pointer;white-space:nowrap}
  #vg-launcher svg{width:20px;height:20px;fill:currentColor;flex:none}
  #vg-launcher:focus-visible{outline:2px solid #a9dccd;outline-offset:3px}
  #vg-launcher.vg-launcher-floating{position:fixed;top:14px;left:145px;z-index:5000}
  @media(max-width:1100px){#vg-launcher{width:48px;padding:0}#vg-launcher span{display:none}}
  @media(min-width:1101px){.main-globalNav-searchContainer:has(> #vg-launcher){max-width:min(720px,calc(100vw - 560px))}}
  @media(max-height:700px){#vg .layout{inset:78px 5% 58px}#vg .art-space{--art-size:clamp(176px,36vh,248px);margin-bottom:14px}#vg .title{font-size:25px;margin-bottom:6px}#vg .artist{font-size:14px;margin-bottom:12px}#vg .transport{margin:0 0 12px;gap:12px}#vg .transport .play{width:56px;height:56px}#vg .volume{margin-top:8px}#vg .album{margin-top:6px}#vg .bottom-vis{height:65px}}
  @media(max-height:560px){#vg .layout{inset:70px 5% 40px}#vg .art-space{--art-size:140px;margin-bottom:10px}#vg .title{font-size:22px}#vg .transport .play{width:48px;height:48px}#vg .volume,#vg .album{display:none}}
  @media(max-width:620px){#vg .layout{grid-template-columns:minmax(0,1fr);grid-template-rows:auto minmax(90px,1fr);gap:12px;inset:78px 8% 45px}#vg.no-lyrics .layout{grid-template-rows:1fr}#vg .lyrics{min-height:90px;padding:45px 5px}#vg:not(.no-lyrics) .art-space{--art-size:140px;margin-bottom:8px}#vg .title{font-size:22px}#vg .artist{margin-bottom:8px}}


  /* Effects matched to the October 17 reference. */
  #vg[data-style=swiftify] .ring{inset:-16%;width:132%;height:132%}
  #vg[data-style=swiftify] .art{box-shadow:none;filter:drop-shadow(0 8px 20px #0005)}
  #vg[data-style=swiftify][data-shape=flower] .art{clip-path:polygon(100.000% 50.000%,99.744% 51.954%,99.024% 53.858%,97.978% 55.679%,96.799% 57.412%,95.691% 59.088%,94.824% 60.761%,94.297% 62.493%,94.112% 64.333%,94.181% 66.299%,94.346% 68.369%,94.415% 70.476%,94.210% 72.526%,93.603% 74.419%,92.549% 76.074%,91.086% 77.453%,89.333% 78.577%,87.450% 79.523%,85.606% 80.410%,83.939% 81.373%,82.527% 82.527%,81.373% 83.939%,80.410% 85.606%,79.523% 87.450%,78.577% 89.333%,77.453% 91.086%,76.074% 92.549%,74.419% 93.603%,72.526% 94.210%,70.476% 94.415%,68.369% 94.346%,66.299% 94.181%,64.333% 94.112%,62.493% 94.297%,60.761% 94.824%,59.088% 95.691%,57.412% 96.799%,55.679% 97.978%,53.858% 99.024%,51.954% 99.744%,50.000% 100.000%,48.046% 99.744%,46.142% 99.024%,44.321% 97.978%,42.588% 96.799%,40.912% 95.691%,39.239% 94.824%,37.507% 94.297%,35.667% 94.112%,33.701% 94.181%,31.631% 94.346%,29.524% 94.415%,27.474% 94.210%,25.581% 93.603%,23.926% 92.549%,22.547% 91.086%,21.423% 89.333%,20.477% 87.450%,19.590% 85.606%,18.627% 83.939%,17.473% 82.527%,16.061% 81.373%,14.394% 80.410%,12.550% 79.523%,10.667% 78.577%,8.914% 77.453%,7.451% 76.074%,6.397% 74.419%,5.790% 72.526%,5.585% 70.476%,5.654% 68.369%,5.819% 66.299%,5.888% 64.333%,5.703% 62.493%,5.176% 60.761%,4.309% 59.088%,3.201% 57.412%,2.022% 55.679%,0.976% 53.858%,0.256% 51.954%,0.000% 50.000%,0.256% 48.046%,0.976% 46.142%,2.022% 44.321%,3.201% 42.588%,4.309% 40.912%,5.176% 39.239%,5.703% 37.507%,5.888% 35.667%,5.819% 33.701%,5.654% 31.631%,5.585% 29.524%,5.790% 27.474%,6.397% 25.581%,7.451% 23.926%,8.914% 22.547%,10.667% 21.423%,12.550% 20.477%,14.394% 19.590%,16.061% 18.627%,17.473% 17.473%,18.627% 16.061%,19.590% 14.394%,20.477% 12.550%,21.423% 10.667%,22.547% 8.914%,23.926% 7.451%,25.581% 6.397%,27.474% 5.790%,29.524% 5.585%,31.631% 5.654%,33.701% 5.819%,35.667% 5.888%,37.507% 5.703%,39.239% 5.176%,40.912% 4.309%,42.588% 3.201%,44.321% 2.022%,46.142% 0.976%,48.046% 0.256%,50.000% 0.000%,51.954% 0.256%,53.858% 0.976%,55.679% 2.022%,57.412% 3.201%,59.088% 4.309%,60.761% 5.176%,62.493% 5.703%,64.333% 5.888%,66.299% 5.819%,68.369% 5.654%,70.476% 5.585%,72.526% 5.790%,74.419% 6.397%,76.074% 7.451%,77.453% 8.914%,78.577% 10.667%,79.523% 12.550%,80.410% 14.394%,81.373% 16.061%,82.527% 17.473%,83.939% 18.627%,85.606% 19.590%,87.450% 20.477%,89.333% 21.423%,91.086% 22.547%,92.549% 23.926%,93.603% 25.581%,94.210% 27.474%,94.415% 29.524%,94.346% 31.631%,94.181% 33.701%,94.112% 35.667%,94.297% 37.507%,94.824% 39.239%,95.691% 40.912%,96.799% 42.588%,97.978% 44.321%,99.024% 46.142%,99.744% 48.046%)}
  #vg[data-style=swiftify] .shade{background:radial-gradient(ellipse at 26% 35%,#dc4c8a18,transparent 55%),linear-gradient(115deg,rgba(9,15,22,var(--dark)),rgba(37,5,26,.38))}
  #vg[data-style=swiftify] .backdrop{transition:background-image 1.2s;animation:vg-drift 24s ease-in-out infinite alternate}
  #vg[data-style=swiftify] .lyrics{padding-left:18px;padding-right:18px}
  #vg[data-style=swiftify] .lyric{box-sizing:border-box;padding:16px 20px;margin:5px 0;border-radius:22px;opacity:.27;transform:scale(.97);transform-origin:left center;transition:opacity .5s,transform .55s cubic-bezier(.2,.8,.2,1),background .55s,filter .5s;filter:blur(.4px)}
  #vg[data-style=swiftify] .lyric.current{opacity:1;transform:scale(1);background:#ffffff12;filter:blur(0);box-shadow:inset 0 1px 0 #ffffff06}
  #vg[data-style=swiftify] .lyric:hover{opacity:.85;background:#ffffff09}
  #vg[data-style=swiftify] .transport .play{border-radius:42%;box-shadow:0 0 22px #ffe1ee18}
  #vg .seek-wrap{position:relative;flex:1;min-width:0;height:28px;display:flex;align-items:center}
  #vg .progress .seek-wrap input{position:relative;z-index:1}
  #vg .progress-wave{position:absolute;inset:0;width:100%;height:28px;pointer-events:none;display:none}
  #vg[data-style=swiftify] .progress-wave{display:block}
  #vg[data-style=swiftify] .progress input::-webkit-slider-runnable-track{height:2px;background:linear-gradient(to right,#ffffff28 0 var(--fill),#ffffff40 var(--fill) 100%)}
  #vg.vg-paused .backdrop{animation-play-state:paused}
  @keyframes vg-drift{from{transform:scale(1.08) translate(-1%,0)}to{transform:scale(1.16) translate(1%,2%)}}
  @media(prefers-reduced-motion:reduce){#vg .backdrop{animation:none!important}}

  @media(prefers-reduced-motion:reduce){#vg,#vg *{scroll-behavior:auto!important;transition:none!important}}
  `;
  document.head.append(css);
  const icons = {
    play:'<path d="m3.05 1.107 11.95 6.287a.7.7 0 0 1 0 1.212L3.05 14.893A.7.7 0 0 1 2 14.287V1.713a.7.7 0 0 1 1.05-.606"/>',pause:'<path d="M2.7 1a.7.7 0 0 0-.7.7v12.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V1.7a.7.7 0 0 0-.7-.7zm8 0a.7.7 0 0 0-.7.7v12.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V1.7a.7.7 0 0 0-.7-.7z"/>',
    prev:'<path d="M3.3 1a.7.7 0 0 1 .7.7v5.15l9.95-5.744a.7.7 0 0 1 1.05.606v12.575a.7.7 0 0 1-1.05.607L4 9.149V14.3a.7.7 0 0 1-.7.7H1.7a.7.7 0 0 1-.7-.7V1.7a.7.7 0 0 1 .7-.7z"/>',next:'<path d="M12.7 1a.7.7 0 0 0-.7.7v5.15L2.05 1.107A.7.7 0 0 0 1 1.712v12.575a.7.7 0 0 0 1.05.607L12 9.149V14.3a.7.7 0 0 0 .7.7h1.6a.7.7 0 0 0 .7-.7V1.7a.7.7 0 0 0-.7-.7z"/>',
    close:'<path d="m6 5 6 6 6-6 1 1-6 6 6 6-1 1-6-6-6 6-1-1 6-6-6-6z"/>',
    settings:'<path d="m10 2-.5 3-2 1-2.8-1-2 3 2.3 2v3L2.7 15l2 3 2.8-1 2 1 .5 3h4l.5-3 2-1 2.8 1 2-3-2.3-2v-3l2.3-2-2-3-2.8 1-2-1-.5-3zm2 6a4 4 0 1 1 0 8 4 4 0 0 1 0-8"/>',
    full:'<path d="M3 3h6v2H5v4H3zm12 0h6v6h-2V5h-4zM3 15h2v4h4v2H3zm16 0h2v6h-6v-2h4z"/>',
    lyrics:'<path d="M4 4h16v2H4zm0 5h12v2H4zm0 5h16v2H4zm0 5h10v2H4z"/>',
    volume:'<path d="M3 9h4l5-4v14l-5-4H3zm12-2v2a4 4 0 0 1 0 6v2a6 6 0 0 0 0-10z"/>',
    shuffle:'<path d="M13.151.922a.75.75 0 1 0-1.06 1.06L13.109 3H11.16a3.75 3.75 0 0 0-2.873 1.34l-6.173 7.356A2.25 2.25 0 0 1 .39 12.5H0V14h.391a3.75 3.75 0 0 0 2.873-1.34l6.173-7.356a2.25 2.25 0 0 1 1.724-.804h1.947l-1.017 1.018a.75.75 0 0 0 1.06 1.06L15.98 3.75zM.391 3.5H0V2h.391c1.109 0 2.16.49 2.873 1.34L4.89 5.277l-.979 1.167-1.796-2.14A2.25 2.25 0 0 0 .39 3.5z"/><path d="m7.5 10.723.98-1.167.957 1.14a2.25 2.25 0 0 0 1.724.804h1.947l-1.017-1.018a.75.75 0 1 1 1.06-1.06l2.829 2.828-2.829 2.828a.75.75 0 1 1-1.06-1.06L13.109 13H11.16a3.75 3.75 0 0 1-2.873-1.34l-.787-.938z"/>',
    repeat:'<path d="M0 4.75A3.75 3.75 0 0 1 3.75 1h8.5A3.75 3.75 0 0 1 16 4.75v5a3.75 3.75 0 0 1-3.75 3.75H9.81l1.018 1.018a.75.75 0 1 1-1.06 1.06L6.939 12.75l2.829-2.828a.75.75 0 1 1 1.06 1.06L9.811 12h2.439a2.25 2.25 0 0 0 2.25-2.25v-5a2.25 2.25 0 0 0-2.25-2.25h-8.5A2.25 2.25 0 0 0 1.5 4.75v5A2.25 2.25 0 0 0 3.75 12H5v1.5H3.75A3.75 3.75 0 0 1 0 9.75z"/>',
    mini:'<path d="M3 4h18v16H3zm2 2v12h14V6zm7 6h6v5h-6z"/>',
    wave:'<path d="M2 10h2v4H2zm4-5h2v14H6zm4 3h2v8h-2zm4-6h2v20h-2zm4 5h2v10h-2zm4 3h2v4h-2z"/>',
    image:'<path d="M3 3h18v18H3zm2 2v12l5-6 4 4 3-3 2 3V5z"/>',
    clock:'<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16zm-1 3h2v5l4 2-1 2-5-3z"/>'
  };
  const svg = name => `<svg viewBox="0 0 ${['play','pause','prev','next','shuffle','repeat'].includes(name)?'16 16':'24 24'}" aria-hidden="true">${icons[name] || icons.wave}</svg>`;
  const button = (name,title,cls='') => `<button data-action="${name}" class="${cls}" title="${title}" aria-label="${title}">${svg(name)}</button>`;
  const root = document.createElement('section'); root.id='vg';root.setAttribute('aria-label','Reproductor inmersivo');root.setAttribute('role','dialog');root.tabIndex=-1;root.setAttribute('aria-hidden','true');root.inert=true;
  root.innerHTML = `<div class="backdrop"></div><div class="shade"></div><div class="toolbar"><div class="buttons">${button('mini','Vista compacta')}${button('lyrics','Mostrar letras')}${button('settings','Ajustes visuales')}${button('full','Pantalla completa')}${button('close','Volver a Spotify · Esc')}</div></div><div class="layout"><div class="song"><div class="art-space"><canvas class="ring"></canvas><img class="art" alt="Carátula del álbum"></div><div class="title"></div><div class="artist"></div><div class="transport">${button('shuffle','Aleatorio')}${button('prev','Anterior')}${button('play','Reproducir o pausar','play')}${button('next','Siguiente')}${button('repeat','Repetir')}</div><div class="progress"><span class="elapsed">0:00</span><div class="seek-wrap"><canvas class="progress-wave" aria-hidden="true"></canvas><input class="seek" type="range" min="0" max="1000" value="0" aria-label="Posición de reproducción"></div><span class="duration" aria-label="Tiempo restante">−0:00</span></div><div class="volume">${svg('volume')}<input class="vol" type="range" min="0" max="100" aria-label="Volumen"></div><div class="album"></div></div><div class="lyrics" aria-label="Letras sincronizadas"></div></div><canvas class="bottom-vis"></canvas><div class="status"></div><div class="toast" role="status"></div><div class="settings"><div class="dialog"><nav class="tabs"><button class="tab selected" data-tab="visualizer">${svg('wave')}Visualizador</button><button class="tab" data-tab="background">${svg('image')}Fondo</button><button class="tab" data-tab="appearance">${svg('settings')}Apariencia</button><button class="tab" data-tab="playback">${svg('clock')}Reproducción</button></nav><div class="panel"></div></div></div>`;
  document.body.append(root);
  const $ = s => root.querySelector(s);
  const fmt = ms => `${Math.floor(Math.max(0,ms)/60000)}:${String(Math.floor(Math.max(0,ms)/1000)%60).padStart(2,'0')}`;
  const store = () => {localStorage.setItem('videoglass',JSON.stringify(settings));applySettings();};
  function applySettings() {
    visualDirty=true;
    root.style.setProperty('--blur',settings.blur+'px');root.style.setProperty('--dark',settings.dark/100);root.style.setProperty('--sat',settings.saturation/100);
    root.dataset.shape=settings.shape;root.dataset.style=settings.style;root.classList.toggle('no-lyrics',!settings.lyrics);$('.art-space').classList.toggle('hide-art',!settings.art);
  }
  applySettings();
  function notify(text){$('.toast').textContent=text;$('.toast').style.display='block';clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('.toast').style.display='none',3500);}
  function scheduleDraw(delay=0){
    clearTimeout(animationTimer);
    animationTimer=setTimeout(()=>{if(open&&!document.hidden)frame=requestAnimationFrame(draw);},delay);
  }
  function setOpen(value){
    if(open===value)return;
    const wasVisible=root.classList.contains('open'),id=++transitionId;
    clearTimeout(transitionTimer);
    open=value;localStorage.setItem('videoglass-open',String(value));
    root.setAttribute('aria-hidden',String(!value));root.inert=!value;
    const library=document.querySelector('.Root');if(library)library.inert=value;
    const duration=value?460:380;
    root.style.setProperty('--view-duration',duration+'ms');
    root.classList.add('vg-transitioning');
    if(value){
      if(!wasVisible)returnFocus=document.activeElement;
      root.classList.add('open');root.setAttribute('aria-modal','true');
      visualDirty=true;refreshPlayer().then(updateSong);pollPlayer();poll();scheduleDraw();
      root.focus({preventScroll:true});
    }else{
      // Paint the library beneath the opaque player before the exit starts.
      document.body.classList.remove('vg-immersive');root.removeAttribute('aria-modal');
      $('.settings').classList.remove('visible');dragging.clear();
      clearTimeout(animationTimer);cancelAnimationFrame(frame);
      abstractMesh.lastTime=0;bands.fill(0);target.fill(0);
      if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});
    }
    const finish=()=>{
      if(id!==transitionId)return;
      clearTimeout(transitionTimer);
      root.classList.toggle('open',value);root.classList.toggle('vg-visible',value);
      root.classList.remove('vg-transitioning');document.body.classList.toggle('vg-immersive',value);
      if(!value)(returnFocus?.isConnected?returnFocus:launcher).focus({preventScroll:true});
    };
    if(reducedMotion.matches||document.hidden){finish();return;}
    // Separate mounting/painting from the transition, so the first visible frame
    // cannot jump straight to the final appearance in Spotify's embedded browser.
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      if(id!==transitionId)return;
      if(document.hidden){finish();return;}
      root.classList.toggle('vg-visible',value);
      const transitions=root.getAnimations();
      transitionTimer=setTimeout(finish,duration+180);
      Promise.all(transitions.map(a=>a.finished.catch(()=>{}))).then(finish);
    }));
  }
  document.addEventListener('visibilitychange',()=>{
    clearTimeout(animationTimer);cancelAnimationFrame(frame);
    abstractMesh.lastTime=0;bands.fill(0);target.fill(0);
    if(open&&!document.hidden){visualDirty=true;scheduleDraw();}
  });
  window.addEventListener('resize',()=>{visualDirty=true;});
  new Spicetify.Topbar.Button('Reproductor del video',icons.wave,()=>setOpen(!open));
  if(Spicetify.Playbar?.Button)new Spicetify.Playbar.Button('Reproductor del video',icons.wave,()=>setOpen(!open));
  window.VideoGlass={open:()=>setOpen(true),close:()=>setOpen(false),settings,root,player:P};
  // Keep an accessible entry point across Spotify layout updates.
  const launcher=document.createElement('button');
  launcher.id='vg-launcher';launcher.title='Abrir reproductor del video · Ctrl + Alt + V';
  launcher.setAttribute('aria-label','Abrir reproductor del video');
  launcher.innerHTML=svg('wave')+'<span>Vista del video</span>';
  launcher.onclick=()=>setOpen(true);
  function mountLauncher(){
    const home=document.querySelector('.main-globalNav-navLink');
    if(home?.parentElement){
      launcher.classList.remove('vg-launcher-floating');
      if(launcher.previousElementSibling!==home)home.after(launcher);
    }else if(!launcher.isConnected){
      launcher.classList.add('vg-launcher-floating');document.body.append(launcher);
    }
  }
  mountLauncher();
  const globalNav=document.querySelector('.Root__globalNav');
  if(globalNav)new MutationObserver(mountLauncher).observe(globalNav,{childList:true,subtree:true});
  window.addEventListener('resize',mountLauncher);
  document.addEventListener('keydown',e=>{
    if(e.ctrlKey&&e.altKey&&e.code==='KeyV'){e.preventDefault();setOpen(!open);return;}
    if(!open||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;
    if(e.code==='Escape'){e.preventDefault();if($('.settings').classList.contains('visible'))$('.settings').classList.remove('visible');else setOpen(false);}
    if(e.code==='Space'){e.preventDefault();P.togglePlay();}
    if(e.code==='ArrowRight'){e.preventDefault();P.seek(Math.min(P.getDuration(),P.getProgress()+10000));}
    if(e.code==='ArrowLeft'){e.preventDefault();P.seek(Math.max(0,P.getProgress()-10000));}
  });
  root.addEventListener('click',async e=>{
    const b=e.target.closest('[data-action]');if(!b)return;
    try {switch(b.dataset.action){
      case 'close':setOpen(false);break;case 'play':P.togglePlay();break;case 'prev':P.back();break;case 'next':P.next();break;
      case 'shuffle':P.setShuffle(!P.getShuffle());break;case 'repeat':P.setRepeat((P.getRepeat()+1)%3);break;
      case 'lyrics':settings.lyrics=!settings.lyrics;store();break;
      case 'settings':showPanel('visualizer');$('.settings').classList.add('visible');break;
      case 'full':if(document.fullscreenElement)await document.exitFullscreen();else await root.requestFullscreen();break;
      case 'mini':mini=!mini;root.classList.toggle('mini',mini);visualDirty=true;break;
    }}catch(error){notify('No se pudo realizar esta acción.');console.warn('[VideoGlass]',error);}
  });
  function fillRange(input){input.style.setProperty('--fill',(Number(input.value)/Number(input.max)*100)+'%');}
  function previewSeek(){
    const duration=P.getDuration(),position=duration*Number($('.seek').value)/1000;
    $('.elapsed').textContent=fmt(position);$('.duration').textContent='−'+fmt(duration-position);
    $('.seek').setAttribute('aria-valuetext',fmt(position)+' de '+fmt(duration));fillRange($('.seek'));
  }
  for(const input of [$('.seek'),$('.vol')]){
    input.addEventListener('pointerdown',()=>dragging.add(input));
    for(const event of ['pointerup','pointercancel','blur'])input.addEventListener(event,()=>dragging.delete(input));
    input.addEventListener('input',()=>fillRange(input));fillRange(input);
  }
  $('.seek').addEventListener('input',previewSeek);
  $('.seek').addEventListener('change',async()=>{
    seekPending=true;
    try{await P.seek(P.getDuration()*Number($('.seek').value)/1000);}
    finally{seekPending=false;delete rendered.seek;delete rendered.elapsed;delete rendered.duration;}
  });
  $('.vol').addEventListener('input',e=>P.setVolume(e.target.value/100));
  $('.settings').addEventListener('click',e=>{if(e.target===$('.settings'))$('.settings').classList.remove('visible');const tab=e.target.closest('[data-tab]');if(tab)showPanel(tab.dataset.tab);});
  const range=(key,label,min,max,unit)=>`<div class="setting-row"><label>${label}<output>${settings[key]}${unit}</output></label><input type="range" data-key="${key}" min="${min}" max="${max}" value="${settings[key]}"></div>`;
  const check=(key,label)=>`<div class="setting-row"><label>${label}<input type="checkbox" data-key="${key}" ${settings[key]?'checked':''}></label></div>`;
  const select=(key,label,options)=>`<div class="setting-row"><label>${label}<select data-key="${key}">${options.map(([v,n])=>`<option value="${v}" ${settings[key]===v?'selected':''}>${n}</option>`).join('')}</select></label></div>`;
  function showPanel(tab){
    root.querySelectorAll('.tab').forEach(t=>t.classList.toggle('selected',t.dataset.tab===tab));
    let content='';let title='';
    if(tab==='visualizer'){title='Visualizador';content=check('enabled','Mostrar visualizador de audio')+select('style','Estilo',[['swiftify','Halo rosado · video de referencia'],['abstract','Onda abstracta · diseño 6'],['ribbon','Cinta de audio · diseño 12'],['ring','Circular'],['bars','Barras'],['wave','Onda'],['both','Circular + barras']])+select('shape','Carátula',[['circle','Círculo'],['flower','Flor'],['square','Cuadrada']])+range('sensitivity','Sensibilidad',20,200,'%')+'<div class="setting-row"><small>Responde al sonido de la salida de audio del equipo. El visualizador se detiene al cerrar esta vista.</small></div>';}
    if(tab==='background'){title='Fondo';content=range('blur','Desenfoque',0,80,' px')+range('dark','Oscuridad',10,85,'%')+range('saturation','Saturación',30,200,'%');}
    if(tab==='appearance'){title='Apariencia';content=check('lyrics','Mostrar letras sincronizadas')+check('art','Mostrar carátula')+select('shape','Forma',[['circle','Círculo'],['flower','Flor'],['square','Cuadrada']])+'<div class="setting-row"><small>Ctrl + Alt + V: abrir o cerrar.<br>Espacio: reproducir o pausar.<br>← / →: avanzar o retroceder 10 s.<br>Esc: volver a tu biblioteca.<br>Las letras se consultan en LRCLIB y se guardan en caché.</small></div>';}
    if(tab==='playback'){title='Reproducción';content='<div class="setting-row"><label>Temporizador de apagado</label><div class="timer-actions">'+[15,30,45,60].map(n=>`<button data-sleep="${n}">${n} min</button>`).join('')+'<button data-sleep="0">Cancelar</button></div><small class="timer-label">'+(sleepDeadline?'Se pausará la música en '+Math.ceil((sleepDeadline-Date.now())/60000)+' min.':'Pausa la música al terminar el tiempo seleccionado.')+'</small></div>';}
    $('.panel').innerHTML=button('close-settings','Cerrar ajustes','close-settings')+`<h3>${title}</h3>`+content;
    $('.close-settings').onclick=()=>$('.settings').classList.remove('visible');
    $('.panel').querySelectorAll('[data-key]').forEach(input=>input.addEventListener('input',()=>{settings[input.dataset.key]=input.type==='checkbox'?input.checked:input.type==='range'?Number(input.value):input.value;if(input.type==='range')input.closest('.setting-row').querySelector('output').textContent=input.value+(input.dataset.key==='blur'?' px':'%');store();}));
    $('.panel').querySelectorAll('[data-sleep]').forEach(b=>b.onclick=()=>{sleepDeadline=Number(b.dataset.sleep)?Date.now()+Number(b.dataset.sleep)*60000:0;notify(sleepDeadline?'Temporizador activado: '+b.dataset.sleep+' minutos.':'Temporizador cancelado.');showPanel('playback');});
  }
  async function updateSong(){
    if(!P.origin?._state)return;
    const item=P.data?.item;if(!item){$('.title').textContent='Elige una canción';$('.lyrics').innerHTML='<div class="lyric-note">Vuelve a tu biblioteca con Esc y reproduce una canción.</div>';return;}
    const m=item.metadata||{},uri=item.uri||m.uri||'';
    if(uri===lastURI)return;
    const cover=(m.image_xlarge_url||m.image_large_url||m.image_url||m.image_small_url||'').replace(/^spotify:image:/,'https://i.scdn.co/image/');
    $('.title').textContent=m.title||item.name||'Spotify';$('.artist').textContent=m.artist_name||'';$('.album').textContent=m.album_title||'';
    if(cover&&$('.art').src!==cover){$('.art').src=cover;$('.backdrop').style.backgroundImage=`url("${cover.replace(/"/g,'')}")`;document.documentElement.style.setProperty('--vg-cover',`url("${cover.replace(/"/g,'')}")`);}
    lastURI=uri;lastLine=-2;lines=[];plain='';const current=++generation;
    $('.lyrics').innerHTML='<div class="lyric-note">Buscando letras…</div>';
    try{
      const q=new URLSearchParams({track_name:m.title||item.name||'',artist_name:m.artist_name||'',album_name:m.album_title||'',duration:Math.round(P.getDuration()/1000)});
      const data=await fetch(API+'/lyrics?'+q).then(r=>r.json());if(current!==generation)return;
      if(data.syncedLyrics)for(const line of data.syncedLyrics.split('\n')){const matches=[...line.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)];const text=line.replace(/\[[^\]]*\]/g,'').trim();for(const match of matches)lines.push({time:(Number(match[1])*60+Number(match[2]))*1000,text:text||'♪'});}
      lines.sort((a,b)=>a.time-b.time);plain=data.plainLyrics||'';
      $('.lyrics').replaceChildren();
      if(lines.length){for(const line of lines){const b=document.createElement('button');b.className='lyric';b.textContent=line.text;b.title='Reproducir desde esta línea';b.onclick=()=>P.seek(line.time);$('.lyrics').append(b);}}
      else{const note=document.createElement('div');note.className='lyric-note';note.style.whiteSpace='pre-line';note.textContent=plain||(data.instrumental?'♪ Instrumental':'No hay letras disponibles para esta canción.');$('.lyrics').append(note);}
    }catch{$('.lyrics').innerHTML='<div class="lyric-note">No se pudieron cargar las letras. Vuelve a abrir esta vista para reintentar.</div>';lastURI='';}
  }
  P.addEventListener('songchange',updateSong);
  setInterval(()=>{if(open&&!document.hidden)updateSong();},1000);
  async function poll(){
    if(polling)return;polling=true;
    while(open){
      if(!P.origin?._state){await new Promise(r=>setTimeout(r,300));continue;}
      if(!document.hidden&&settings.enabled&&P.isPlaying())try{const data=await fetch(API+'/spectrum',{signal:AbortSignal.timeout(1500)}).then(r=>r.json());const valid=Array.isArray(data.bands)&&data.bands.length===64&&data.bands.every(Number.isFinite);audioOK=!!(data.active&&!data.error&&valid);target=open&&!document.hidden&&P.isPlaying()&&audioOK?data.bands:Array(64).fill(0);}catch{audioOK=false;target=Array(64).fill(0);}
      else {target=Array(64).fill(0);audioOK=false;}
      await new Promise(r=>setTimeout(r,!document.hidden&&settings.enabled&&P.isPlaying()?80:750));
    }polling=false;
  }
  function canvasSize(canvas,retina=false){
    const w=canvas.clientWidth,h=canvas.clientHeight,dpr=retina?Math.min(2,window.devicePixelRatio||1):1;
    const width=Math.round(w*dpr),height=Math.round(h*dpr);
    if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
    const ctx=canvas.getContext('2d');ctx.setTransform(w?width/w:1,0,0,h?height/h:1,0,0);
    return [ctx,w,h];
  }
  function drawRibbon(ctx,w,h,now,animated){
    const cx=w/2,cy=h/2,space=$('.art-space').clientWidth;
    const energy=bands.slice(0,18).reduce((sum,v)=>sum+v,0)/18;
    const radius=space*.36*(1+Math.min(.065,energy*.075))+3;
    const phase=animated&&!reducedMotion.matches?now*.00065:0;
    const gradient=ctx.createLinearGradient(0,0,w,0);
    gradient.addColorStop(0,'#efb17f');gradient.addColorStop(.28,'#ffd5ac');
    gradient.addColorStop(.5,'#ffd6e7');gradient.addColorStop(.73,'#edaccb');gradient.addColorStop(1,'#efb17f');
    ctx.save();ctx.strokeStyle=gradient;ctx.lineWidth=Math.max(.7,space/410);ctx.lineCap='round';
    ctx.shadowColor='#f5adbb';ctx.shadowBlur=5;
    // Continuous strands pass behind the cover and form flowing wings at each side.
    for(let strand=0;strand<14;strand++){
      const spread=(strand-6.5)/6.5;
      ctx.globalAlpha=.28+.38*(1-Math.abs(spread));ctx.beginPath();
      for(let i=0;i<=180;i++){
        const x=i/180*w,dx=x-cx,side=Math.abs(dx)/cx;
        const envelope=Math.sin(Math.min(1,side)*Math.PI*.9);
        const band=bands[Math.min(63,Math.floor(side*42))]||0;
        const amplitude=space*(.065+Math.min(.24,energy*.2+band*.12));
        const wave=Math.sin(dx/space*5.4-phase+spread*.65)*amplitude;
        const y=cy+envelope*(wave+spread*space*(.10+Math.min(.09,energy*.09)));
        if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
      }
      ctx.stroke();
    }
    // Fine pink contours wrap the circular cover, as in reference 12.
    for(let strand=0;strand<7;strand++){
      ctx.globalAlpha=.72-strand*.065;ctx.beginPath();
      for(let i=0;i<=180;i++){
        const a=i/180*Math.PI*2;
        const r=radius+strand*1.05+Math.sin(a*3-phase+strand*.17)*Math.min(3,energy*4);
        const x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r;
        if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
      }
      ctx.closePath();ctx.stroke();
    }
    ctx.restore();
  }
  // Abstract mesh: state and geometry stay independent of playback controls.
  const abstractMesh={lastTime:0,phase:0,settling:false,
    palette:['#e9c69b','#f4e9d9','#e4bfcf'],paletteImage:null,paletteSource:'',gradient:null};
  function smoothAbstract(now,active){
    const dt=abstractMesh.lastTime?Math.min(.1,Math.max(0,(now-abstractMesh.lastTime)/1000)):1/24;
    abstractMesh.lastTime=now;
    let peak=0;
    for(let i=0;i<64;i++){
      const raw=active?Number(target[i]):0;
      const goal=Number.isFinite(raw)?Math.max(0,Math.min(1,raw*settings.sensitivity/100)):0;
      // Fast attack (65 ms), long release (520 ms), independent of frame rate.
      bands[i]+=(goal-bands[i])*(1-Math.exp(-dt/(goal>bands[i] ? .065 : .52)));
      if(bands[i]<.0008)bands[i]=0;
      peak=Math.max(peak,bands[i]);
    }
    abstractMesh.settling=peak>0;
    // Phase is driven by measured energy; silence freezes the sculpture.
    if(!reducedMotion.matches)abstractMesh.phase=(abstractMesh.phase+dt*peak*.85)%(Math.PI*200);
    return abstractMesh.settling;
  }
  function meshCircularSample(first,count,sector){
    const position=((sector%1)+1)%1*count,index=Math.floor(position),t=position-index;
    const at=offset=>bands[first+((index+offset+count)%count)];
    const a=at(-1),b=at(0),c=at(1),d=at(2);
    // Periodic Catmull–Rom interpolation keeps both ends and their tangents joined.
    return Math.max(0,Math.min(1,.5*((2*b)+(-a+c)*t
      +(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t)));
  }
  function meshStrength(value){return Math.pow(Math.max(0,(value-.06)/.94),1.45);}
  function abstractRadius(a,thread,size,inner){
    const layer=thread/63,seed=thread*2.399963229728653,phase=abstractMesh.phase;
    const sector=(a/(Math.PI*2)+.065*Math.sin(a)+1)%1;
    // The existing FFT is linear: bin 0 is the broad bass range,
    // bins 1–7 cover mids, and bins 8–55 provide the treble detail.
    const bass=meshStrength(bands[0]);
    const mid=meshStrength(meshCircularSample(1,7,sector));
    const high=meshStrength(meshCircularSample(8,48,sector+.31));
    const local=.46*bass+.36*mid+.18*high;
    const broad=.5+.5*Math.sin(a*2+phase*.7+layer*2.4);
    const folds=.5+.30*Math.sin(a*3-phase+layer*5.6)+.20*Math.sin(a*5+phase*.6+seed*.17);
    const detail=Math.sin(a*11+seed+phase*1.4)*.55+Math.sin(a*17-seed*.7-phase)*.45;
    // Different thread phases cross rather than stack into an opaque ribbon.
    // Every term remains outside the circular image, including the glow margin.
    const spread=.23+.77*layer;
    const deformation=bass*(.022+.11*broad)*(.35+.65*layer)
      +mid*(.018+.115*folds)*spread
      +high*(.012+.011*detail)*(.25+.75*layer)
      +local*.018*(.5+.5*Math.sin(a*7+seed+phase));
    const radius=inner+size*(.003+layer*.006+deformation);
    return Math.min(size*.478,radius);
  }
  function updateMeshPalette(){
    const src=$('.art').currentSrc||$('.art').src;
    if(!src||src===abstractMesh.paletteSource)return;
    abstractMesh.paletteSource=src;
    if(abstractMesh.paletteImage){abstractMesh.paletteImage.onload=null;abstractMesh.paletteImage.onerror=null;}
    const img=new Image();abstractMesh.paletteImage=img;img.crossOrigin='anonymous';
    const finish=()=>{img.onload=null;img.onerror=null;if(abstractMesh.paletteImage===img)abstractMesh.paletteImage=null;};
    img.onload=()=>{
      if(abstractMesh.paletteSource!==src){finish();return;}
      try{
        const sample=document.createElement('canvas');sample.width=sample.height=20;
        const c=sample.getContext('2d',{willReadFrequently:true});c.drawImage(img,0,0,20,20);
        const pixels=c.getImageData(0,0,20,20).data,total=[0,0,0];let weight=0;
        for(let i=0;i<pixels.length;i+=4){
          const lum=(pixels[i]+pixels[i+1]+pixels[i+2])/3;
          if(lum<35||lum>230)continue;
          const chroma=Math.max(...pixels.slice(i,i+3))-Math.min(...pixels.slice(i,i+3));
          const k=.2+chroma/255;for(let j=0;j<3;j++)total[j]+=pixels[i+j]*k;weight+=k;
        }
        if(weight){
          const pastel=total.map(v=>Math.round(v/weight*.36+240*.64));
          abstractMesh.palette=['#e9c69b','#f4e9d9',`rgb(${pastel.join(',')})`];
          abstractMesh.gradient=null;visualDirty=true;
        }
      }catch{/* Some cover hosts disallow pixel access: retain the soft fallback palette. */}
      finish();
    };
    img.onerror=finish;img.src=src;
  }
  function drawAbstract(ctx,w,h){
    const size=Math.min(w,h),cx=w/2,cy=h/2;
    // The cover stays at its original scale; use its actual component diameter.
    const inner=$('.art-space').clientWidth*.36+Math.max(3,size*.009);
    const key=w+':'+h+':'+ctx.canvas.width;
    if(!abstractMesh.gradient||abstractMesh.gradientKey!==key){
      const gradient=ctx.createLinearGradient(cx-size*.4,cy-size*.32,cx+size*.4,cy+size*.4);
      abstractMesh.palette.forEach((color,i)=>gradient.addColorStop(i/2,color));
      abstractMesh.gradient=gradient;abstractMesh.gradientKey=key;
    }
    ctx.save();ctx.strokeStyle=abstractMesh.gradient;ctx.lineJoin='round';
    ctx.shadowColor=abstractMesh.palette[2];ctx.shadowBlur=Math.min(2,size*.003);
    for(let thread=0;thread<64;thread++){
      ctx.lineWidth=Math.max(.4,Math.min(.85,size/720)*(.85+.15*Math.sin(thread*1.7)));
      ctx.globalAlpha=.085+.055*(.5+.5*Math.sin(thread*2.39996));
      ctx.beginPath();
      // 240 angular samples interpolate each sector's frequency response.
      for(let i=0;i<=240;i++){
        const a=i/240*Math.PI*2,r=abstractRadius(a,thread,size,inner);
        const x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r;
        if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
      }
      ctx.closePath();ctx.stroke();
    }
    ctx.restore();
  }
  // Pink radial spectrum, scalloped contour, and a short waveform on the seek rail.
  function drawSwiftify(ctx,w,h,now){
    const space=$('.art-space').clientWidth,cx=w/2,cy=h/2;
    const bass=bands[0]||0;
    const coverScale=1+Math.min(.065,bands.slice(0,12).reduce((s,v)=>s+v,0)/12*.075);
    const radius=space*.36*coverScale;
    const gradient=ctx.createLinearGradient(cx,cy-radius*1.5,cx,cy+radius*1.5);
    gradient.addColorStop(0,'#e2b3c8');gradient.addColorStop(.5,'#d789b1');gradient.addColorStop(1,'#ef74ac');
    ctx.save();ctx.strokeStyle=gradient;ctx.lineCap='round';
    // Four mirrored sectors distribute the linear FFT's low-frequency detail.
    const count=96;
    ctx.lineWidth=Math.max(1.7,space*.009);
    for(let i=0;i<count;i++){
      const a=i/count*Math.PI*2-Math.PI/2;
      const sector=(i%24)/23,bin=Math.round((i<24||i>=48&&i<72?sector:1-sector)*27);
      const value=Math.min(1,(bands[bin]||0)*.7+(bands[Math.max(0,bin-1)]||0)*.3);
      const start=radius+space*.036;
      const length=space*(.018+value*.14+bass*.022);
      ctx.globalAlpha=.32+value*.48;ctx.beginPath();
      ctx.moveTo(cx+Math.cos(a)*start,cy+Math.sin(a)*start);
      ctx.lineTo(cx+Math.cos(a)*(start+length),cy+Math.sin(a)*(start+length));ctx.stroke();
    }
    ctx.lineWidth=Math.max(.7,space*.003);ctx.globalAlpha=.55+bass*.25;ctx.beginPath();
    for(let i=0;i<=240;i++){
      const a=i/240*Math.PI*2;
      const scallop=settings.shape==='flower'?(.96+.04*Math.cos(a*12)):1;
      const r=radius*scallop+2;
      const x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r;
      if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);
    }
    ctx.closePath();ctx.stroke();ctx.restore();
    const [c,pw,ph]=canvasSize($('.progress-wave'),true);c.clearRect(0,0,pw,ph);
    const fraction=P.getDuration()?Math.max(0,Math.min(1,P.getProgress()/P.getDuration())):0;
    const end=pw*fraction;
    c.strokeStyle='#f6dfeb';c.lineWidth=1.3;c.beginPath();
    for(let x=0;x<=end;x+=2){
      const distance=end-x,amp=Math.exp(-distance/52)*Math.min(5,bass*6);
      const y=ph/2+Math.sin(distance*.18-(reducedMotion.matches?0:abstractMesh.phase*5))*amp;
      if(x)c.lineTo(x,y);else c.moveTo(x,y);
    }
    c.stroke();
  }
  function draw(now=performance.now()){
    if(!open||document.hidden)return;
    if(!P.origin?._state){scheduleDraw(300);return;}
    const playing=P.isPlaying(),animated=playing&&settings.enabled;
    const progress=P.getProgress(),duration=P.getDuration();
    // Update controls four times a second and only mutate values that changed.
    if(!rendered.uiTime||now-rendered.uiTime>=250||rendered.playing!==playing){
      rendered.uiTime=now;
      const values={elapsed:fmt(progress),duration:'−'+fmt(duration-progress),volume:Math.round(P.getVolume()*100),shuffle:P.getShuffle(),repeat:P.getRepeat()>0,
        seek:Math.round(duration?progress/duration*1000:0),status:sleepDeadline?'Pausa en '+Math.max(0,Math.ceil((sleepDeadline-Date.now())/60000))+' min':settings.enabled&&playing&&!audioOK?'Conectando visualizador…':''};
      for(const key of ['elapsed','duration','status'])if((key==='status'||(!dragging.has($('.seek'))&&!seekPending))&&rendered[key]!==values[key]){rendered[key]=values[key];$('.'+key).textContent=values[key];}
      if(rendered.playing!==playing){rendered.playing=playing;root.classList.toggle('vg-paused',!playing);$('.play').innerHTML=svg(playing?'pause':'play');$('.play').setAttribute('aria-label',playing?'Pausar':'Reproducir');$('.play').title=playing?'Pausar':'Reproducir';visualDirty=true;}
      if(rendered.volume!==values.volume&&!dragging.has($('.vol'))){rendered.volume=values.volume;$('.vol').value=values.volume;fillRange($('.vol'));}
      for(const key of ['shuffle','repeat'])if(rendered[key]!==values[key]){rendered[key]=values[key];root.querySelector('[data-action='+key+']').classList.toggle('active',values[key]);}
      if(rendered.seek!==values.seek&&!dragging.has($('.seek'))&&!seekPending){rendered.seek=values.seek;$('.seek').value=values.seek;fillRange($('.seek'));$('.seek').setAttribute('aria-valuetext',fmt(progress)+' de '+fmt(duration));$('.duration').title='Tiempo restante · Duración total: '+fmt(duration);}
      if(lines.length){let index=-1;for(let i=0;i<lines.length;i++){if(lines[i].time<=progress+120)index=i;else break;}
        if(index!==lastLine){lastLine=index;$('.lyrics').querySelectorAll('.lyric').forEach((b,i)=>b.classList.toggle('current',i===index));
          const active=$('.lyrics').children[index];if(active&&settings.lyrics&&!mini){const box=$('.lyrics');box.scrollTo({top:active.offsetTop-box.offsetTop-box.clientHeight/2+active.clientHeight/2,behavior:'smooth'});}
        }
      }
    }
    const meshActive=['abstract','swiftify'].includes(settings.style)&&settings.enabled;
    const settling=meshActive?smoothAbstract(now,animated):false;
    if(!meshActive)abstractMesh.lastTime=0;
    if(animated||visualDirty||settling){
      if(!meshActive)for(let i=0;i<64;i++)bands[i]=animated?bands[i]+(target[i]*(settings.sensitivity/100)-bands[i])*.35:0;
      const [ctx,w,h]=canvasSize($('.ring'),meshActive);ctx.clearRect(0,0,w,h);
      if(meshActive&&settings.style==='abstract'){updateMeshPalette();drawAbstract(ctx,w,h);}
      if(settings.enabled&&settings.style==='swiftify')drawSwiftify(ctx,w,h,now);
      if(settings.enabled&&settings.style==='ribbon')drawRibbon(ctx,w,h,now,animated);
      if(settings.enabled&&(settings.style==='ring'||settings.style==='both')){
        const cx=w/2,cy=h/2,r=Math.min(w,h)*.32;ctx.strokeStyle='#d1f4ef';ctx.lineCap='round';ctx.lineWidth=Math.max(2,w/125);
        ctx.beginPath();for(let i=0;i<128;i++){const a=i/128*Math.PI*2-Math.PI/2,v=bands[i<64?i:127-i]||0,len=3+v*Math.min(w,h)*.18;
          ctx.moveTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r);ctx.lineTo(cx+Math.cos(a)*(r+len),cy+Math.sin(a)*(r+len));
        }ctx.stroke();
      }
      const energy=bands.slice(0,12).reduce((a,b)=>a+b,0)/12;
      const scale=settings.style==='abstract'?1:Math.round((1+Math.min(.065,energy*.075))*200)/200;
      if(rendered.scale!==scale){rendered.scale=scale;$('.art').style.transform='scale('+scale+')';}
      const [c,bw,bh]=canvasSize($('.bottom-vis'));c.clearRect(0,0,bw,bh);
      if(settings.enabled&&settings.style!=='ring'&&settings.style!=='ribbon'&&settings.style!=='abstract'&&settings.style!=='swiftify'){
        const gradient=c.createLinearGradient(0,0,bw,0);gradient.addColorStop(0,'#b6e9e7');gradient.addColorStop(.5,'#63b8db');gradient.addColorStop(1,'#b6e9e7');c.fillStyle=gradient;
        if(settings.style==='wave'){c.beginPath();c.moveTo(0,bh);for(let i=0;i<64;i++)c.lineTo(i/63*bw,bh-2-bands[i]*bh*.9);c.lineTo(bw,bh);c.closePath();c.fill();}
        else{const width=bw/64;c.beginPath();for(let i=0;i<64;i++){const height=Math.max(3,bands[i]*bh*.9);c.roundRect(i*width,bh-height,width*.65,height,width*.3);}c.fill();}
      }
      visualDirty=false;
    }
    // Continue drawing the release tail after pause, then return to idle polling.
    scheduleDraw(animated||settling?1000/24:250);
  }
  setInterval(()=>{if(sleepDeadline&&Date.now()>=sleepDeadline){sleepDeadline=0;P.pause();if(open)notify('La música se pausó por el temporizador.');}},1000);
  refreshPlayer().then(updateSong);
  setTimeout(()=>{if(localStorage.getItem('videoglass-open')==='true')setOpen(true);},1500);
})();
