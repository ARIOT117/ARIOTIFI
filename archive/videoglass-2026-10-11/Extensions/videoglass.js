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
  const defaults = {enabled:true,shape:'circle',style:'ring',blur:36,dark:42,saturation:120,sensitivity:120,lyrics:true,art:true};
  let settings; try { settings = {...defaults, ...JSON.parse(localStorage.getItem('videoglass') || '{}')}; } catch { settings = {...defaults}; }
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
  #vg .ring{position:absolute;inset:-8%;width:116%;height:116%;pointer-events:none;z-index:1}#vg .title{font-size:clamp(24px,2.5vw,40px);font-weight:700;letter-spacing:-.02em;line-height:1.2;margin-bottom:8px;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}#vg .artist{font-size:16px;line-height:1.4;color:#ffffffb3;margin:0 0 20px}#vg .album{font-size:12px;line-height:1.4;color:#ffffff8c;margin-top:10px}
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
  root.innerHTML = `<div class="backdrop"></div><div class="shade"></div><div class="toolbar"><div class="buttons">${button('mini','Vista compacta')}${button('lyrics','Mostrar letras')}${button('settings','Ajustes visuales')}${button('full','Pantalla completa')}${button('close','Volver a Spotify · Esc')}</div></div><div class="layout"><div class="song"><div class="art-space"><canvas class="ring"></canvas><img class="art" alt="Carátula del álbum"></div><div class="title"></div><div class="artist"></div><div class="transport">${button('shuffle','Aleatorio')}${button('prev','Anterior')}${button('play','Reproducir o pausar','play')}${button('next','Siguiente')}${button('repeat','Repetir')}</div><div class="progress"><span class="elapsed">0:00</span><input class="seek" type="range" min="0" max="1000" value="0" aria-label="Posición de reproducción"><span class="duration" aria-label="Tiempo restante">−0:00</span></div><div class="volume">${svg('volume')}<input class="vol" type="range" min="0" max="100" aria-label="Volumen"></div><div class="album"></div></div><div class="lyrics" aria-label="Letras sincronizadas"></div></div><canvas class="bottom-vis"></canvas><div class="status"></div><div class="toast" role="status"></div><div class="settings"><div class="dialog"><nav class="tabs"><button class="tab selected" data-tab="visualizer">${svg('wave')}Visualizador</button><button class="tab" data-tab="background">${svg('image')}Fondo</button><button class="tab" data-tab="appearance">${svg('settings')}Apariencia</button><button class="tab" data-tab="playback">${svg('clock')}Reproducción</button></nav><div class="panel"></div></div></div>`;
  document.body.append(root);
  const $ = s => root.querySelector(s);
  const fmt = ms => `${Math.floor(Math.max(0,ms)/60000)}:${String(Math.floor(Math.max(0,ms)/1000)%60).padStart(2,'0')}`;
  const store = () => {localStorage.setItem('videoglass',JSON.stringify(settings));applySettings();};
  function applySettings() {
    visualDirty=true;
    root.style.setProperty('--blur',settings.blur+'px');root.style.setProperty('--dark',settings.dark/100);root.style.setProperty('--sat',settings.saturation/100);
    root.dataset.shape=settings.shape;root.classList.toggle('no-lyrics',!settings.lyrics);$('.art-space').classList.toggle('hide-art',!settings.art);
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
    if(tab==='visualizer'){title='Visualizador';content=check('enabled','Mostrar visualizador de audio')+select('style','Estilo',[['ring','Circular'],['bars','Barras'],['wave','Onda'],['both','Circular + barras']])+select('shape','Carátula',[['circle','Círculo'],['flower','Flor'],['square','Cuadrada']])+range('sensitivity','Sensibilidad',20,200,'%')+'<div class="setting-row"><small>Responde al sonido de la salida de audio del equipo. El visualizador se detiene al cerrar esta vista.</small></div>';}
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
      if(!document.hidden&&settings.enabled&&P.isPlaying())try{const data=await fetch(API+'/spectrum').then(r=>r.json());target=data.bands||target;audioOK=data.active&&!data.error;}catch{audioOK=false;target=Array(64).fill(0);}
      else {target=Array(64).fill(0);audioOK=false;}
      await new Promise(r=>setTimeout(r,!document.hidden&&settings.enabled&&P.isPlaying()?80:750));
    }polling=false;
  }
  function canvasSize(canvas){const dpr=1,w=Math.round(canvas.clientWidth*dpr),h=Math.round(canvas.clientHeight*dpr);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}return [canvas.getContext('2d'),w,h];}
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
      if(rendered.playing!==playing){rendered.playing=playing;$('.play').innerHTML=svg(playing?'pause':'play');$('.play').setAttribute('aria-label',playing?'Pausar':'Reproducir');$('.play').title=playing?'Pausar':'Reproducir';visualDirty=true;}
      if(rendered.volume!==values.volume&&!dragging.has($('.vol'))){rendered.volume=values.volume;$('.vol').value=values.volume;fillRange($('.vol'));}
      for(const key of ['shuffle','repeat'])if(rendered[key]!==values[key]){rendered[key]=values[key];root.querySelector('[data-action='+key+']').classList.toggle('active',values[key]);}
      if(rendered.seek!==values.seek&&!dragging.has($('.seek'))&&!seekPending){rendered.seek=values.seek;$('.seek').value=values.seek;fillRange($('.seek'));$('.seek').setAttribute('aria-valuetext',fmt(progress)+' de '+fmt(duration));$('.duration').title='Tiempo restante · Duración total: '+fmt(duration);}
      if(lines.length){let index=-1;for(let i=0;i<lines.length;i++){if(lines[i].time<=progress+120)index=i;else break;}
        if(index!==lastLine){lastLine=index;$('.lyrics').querySelectorAll('.lyric').forEach((b,i)=>b.classList.toggle('current',i===index));
          const active=$('.lyrics').children[index];if(active&&settings.lyrics&&!mini){const box=$('.lyrics');box.scrollTo({top:active.offsetTop-box.offsetTop-box.clientHeight/2+active.clientHeight/2,behavior:'smooth'});}
        }
      }
    }
    if(animated||visualDirty){
      for(let i=0;i<64;i++)bands[i]=animated?bands[i]+(target[i]*(settings.sensitivity/100)-bands[i])*.35:0;
      const [ctx,w,h]=canvasSize($('.ring'));ctx.clearRect(0,0,w,h);
      if(settings.enabled&&(settings.style==='ring'||settings.style==='both')){
        const cx=w/2,cy=h/2,r=Math.min(w,h)*.32;ctx.strokeStyle='#d1f4ef';ctx.lineCap='round';ctx.lineWidth=Math.max(2,w/125);
        ctx.beginPath();for(let i=0;i<128;i++){const a=i/128*Math.PI*2-Math.PI/2,v=bands[i<64?i:127-i]||0,len=3+v*Math.min(w,h)*.18;
          ctx.moveTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r);ctx.lineTo(cx+Math.cos(a)*(r+len),cy+Math.sin(a)*(r+len));
        }ctx.stroke();
      }
      const energy=bands.slice(0,12).reduce((a,b)=>a+b,0)/12;
      const scale=Math.round((1+Math.min(.065,energy*.075))*200)/200;
      if(rendered.scale!==scale){rendered.scale=scale;$('.art').style.transform='scale('+scale+')';}
      const [c,bw,bh]=canvasSize($('.bottom-vis'));c.clearRect(0,0,bw,bh);
      if(settings.enabled&&settings.style!=='ring'){
        const gradient=c.createLinearGradient(0,0,bw,0);gradient.addColorStop(0,'#b6e9e7');gradient.addColorStop(.5,'#63b8db');gradient.addColorStop(1,'#b6e9e7');c.fillStyle=gradient;
        if(settings.style==='wave'){c.beginPath();c.moveTo(0,bh);for(let i=0;i<64;i++)c.lineTo(i/63*bw,bh-2-bands[i]*bh*.9);c.lineTo(bw,bh);c.closePath();c.fill();}
        else{const width=bw/64;c.beginPath();for(let i=0;i<64;i++){const height=Math.max(3,bands[i]*bh*.9);c.roundRect(i*width,bh-height,width*.65,height,width*.3);}c.fill();}
      }
      visualDirty=false;
    }
    // 24 fps during playback; no animation while paused or minimized.
    scheduleDraw(animated?1000/24:250);
  }
  setInterval(()=>{if(sleepDeadline&&Date.now()>=sleepDeadline){sleepDeadline=0;P.pause();if(open)notify('La música se pausó por el temporizador.');}},1000);
  refreshPlayer().then(updateSong);
  setTimeout(()=>{if(localStorage.getItem('videoglass-open')==='true')setOpen(true);},1500);
})();
