// VideoGlass premium — native Spotify controls, disposable immersive view.
(async function () {
  'use strict';
  while (!window.Spicetify?.Player || !Spicetify.Platform?.History) await new Promise(r => setTimeout(r, 500));
  window.VideoGlass?.dispose?.();
  const API = 'http://127.0.0.1:43891';
  const life = new AbortController(), motion = matchMedia('(prefers-reduced-motion: reduce)');
  const cache = new Map();
  let state = null, sampledAt = 0, view = null, closing = false, tickTimer = 0, playerRequest = null;
  let track = '', artRequest = null, sleepTimer = 0, returnFocus = null, fullscreenOwned = false;
  let disposed = false, dock = null;
  const icons = {
    close:'<path d="m6 6 12 12M18 6 6 18"/>',
    play:'<path d="m8 5 11 7-11 7Z" fill="currentColor" stroke="none"/>',
    pause:'<path d="M8 5v14M16 5v14" stroke-width="4"/>',
    prev:'<path d="M5 5v14M19 5 8 12l11 7Z"/>', next:'<path d="M19 5v14M5 5l11 7-11 7Z"/>',
    shuffle:'<path d="m4 4 16 16m-4 0h4v-4M4 20l6-6m4-4 6-6m-4 0h4v4"/>',
    repeat:'<path d="m17 3 3 3-3 3M4 11V9a3 3 0 0 1 3-3h13M7 21l-3-3 3-3m13-2v2a3 3 0 0 1-3 3H4"/>',
    volume:'<path d="M4 9h3l5-4v14l-5-4H4Zm12 0a4 4 0 0 1 0 6m3-9a8 8 0 0 1 0 12"/>',
    mini:'<rect x="3" y="5" width="18" height="14" rx="2"/><rect x="12" y="12" width="6" height="4" rx="1"/>',
    lyrics:'<path d="M4 5h14v11H9l-4 3v-3H4ZM8 9h6m-6 3h4"/>',
    queue:'<path d="M4 6h15M4 11h15M4 16h8m6-2v6"/><circle cx="16" cy="20" r="2"/>',
    moon:'<path d="M20 15A8 8 0 1 1 9 4a7 7 0 0 0 11 11Z"/>',
    eq:'<path d="M4 7h8m6 0h2M4 17h3m6 0h7"/><circle cx="15" cy="7" r="3"/><circle cx="10" cy="17" r="3"/>',
    more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    expand:'<path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/>',
    note:'<path d="M9 18V6l10-2v12"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/>'
  };
  const svg = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.more}</svg>`;
  const button = (action, label, icon=action, cls='') => `<button type="button" class="vg-button ${cls}" data-action="${action}" aria-label="${label}" title="${label}">${svg(icon)}</button>`;
  const fmt = ms => { const s = Math.max(0, Math.floor((Number(ms)||0)/1000)); return Math.floor(s/60)+':'+String(s%60).padStart(2,'0'); };
  const position = () => Math.max(0, Math.min(state?.duration || 0, (state?.position || 0)+(state?.playing ? performance.now()-sampledAt : 0)));
  function flower(lobes, amp, count=180) {
    return 'polygon('+Array.from({length:count},(_,i)=>{const a=i/count*Math.PI*2,r=50*(1-amp+amp*Math.cos(lobes*a));return `${50+r*Math.cos(a)}% ${50+r*Math.sin(a)}%`;}).join(',')+')';
  }
  document.documentElement.style.setProperty('--vg-art-clip',flower(12,.035));
  document.documentElement.style.setProperty('--vg-play-clip',flower(9,.06));
  const wave = `<span class="vg-wave-window" aria-hidden="true"><svg class="vg-wave" width="2048" height="16"><path d="${Array.from({length:1025},(_,i)=>(i?'L':'M')+(i*2)+' '+(8+2.6*Math.sin(i*2/16*Math.PI*2)).toFixed(2)).join(' ')}" fill="none" stroke="white" stroke-width="2"/></svg></span>`;
  function progressMarkup() {return `<div class="vg-progress"><span class="vg-elapsed">0:00</span><div class="vg-seek-wrap">${wave}<input class="vg-seek" type="range" min="0" max="1000" value="0" aria-label="Progreso"></div><span class="vg-duration">0:00</span></div>`;}
  function transportMarkup() {return `<div class="vg-transport">${button('shuffle','Aleatorio')}${button('back','Anterior','prev')}<button class="vg-button vg-play" data-action="toggle" aria-label="Reproducir"><span class="vg-pulse"><span class="vg-spin"></span></span><span class="vg-play-icon">${svg('play')}</span></button>${button('next','Siguiente')}${button('repeat','Repetir')}</div>`;}
  function volumeMarkup() {return `<label class="vg-volume">${svg('volume')}<input class="vg-vol" type="range" min="0" max="100" value="0" aria-label="Volumen"></label>`;}
  function notify(message) { Spicetify.showNotification?.(message); }
  async function control(action,value) {
    try {
      const r=await fetch(API+'/control',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,value}),signal:AbortSignal.timeout(3000)});
      if(!r.ok) throw Error('control');
      // The shared 500 ms clock is the sole writer of playback progress.
    } catch { notify('No se pudo controlar la reproducción. Comprueba el servicio VideoGlass.'); }
  }
  async function refresh() {
    if(disposed || document.hidden || playerRequest) return;
    const request=playerRequest=new AbortController();
    try {
      const r=await fetch(API+'/player',{signal:AbortSignal.any([request.signal,AbortSignal.timeout(2500)])});
      if(!r.ok) throw Error('player');
      const next=await r.json(); if(disposed || request.signal.aborted) return;
      state=next; sampledAt=performance.now();
      const id=state.item?.uri || '';
      if(id!==track){track=id;prepareArtwork(id,state.item?.metadata?.image_xlarge_url);if(view)loadSong(view);}
      updateUI();
    } catch(e) { if(e.name!=='AbortError' && view) view.root.querySelector('.vg-status').textContent='Esperando al reproductor…'; }
    finally {if(playerRequest===request)playerRequest=null;}
  }
  async function clockTick() {
    if(disposed)return;
    mountDock(); await refresh();
    if(!disposed)tickTimer=setTimeout(clockTick,500);
  }
  function rangeFill(input) {input.style.setProperty('--vg-fill',(Number(input.value)/Number(input.max)*100)+'%');}
  function updateUI() {
    document.documentElement.classList.toggle('vg-paused',!state?.playing);
    if(dock) updateDock();
    const v=view;if(!v||closing)return;
    const r=v.root,p=position(),d=state?.duration||0;
    const seek=r.querySelector('.vg-seek');
    if(!v.dragging.has(seek)) {seek.value=d?p/d*1000:0;rangeFill(seek);seek.parentElement.style.setProperty('--vg-fill',seek.value/10+'%');r.querySelector('.vg-elapsed').textContent=fmt(p);}
    seek.setAttribute('aria-valuetext',fmt(p)+' de '+fmt(d));
    r.querySelector('.vg-duration').textContent=fmt(d);
    const vol=r.querySelector('.vg-vol');if(!v.dragging.has(vol)){vol.value=(state?.volume||0)*100;rangeFill(vol);}
    if(v.playing!==state?.playing){v.playing=state?.playing;r.querySelector('.vg-play-icon').innerHTML=svg(v.playing?'pause':'play');r.querySelector('.vg-play').setAttribute('aria-label',v.playing?'Pausar':'Reproducir');syncVisualizer(v);}
    for(const [key,value] of [['shuffle',!!state?.shuffle],['repeat',!!state?.repeat]])r.querySelector(`[data-action="${key}"]`).setAttribute('aria-pressed',String(value));
    r.querySelector('[data-action="repeat"]').title=state?.repeat===2?'Repetir canción':state?.repeat===1?'Repetir lista':'Repetición desactivada';
    updateLyric(v,p);
  }
  async function prepareArtwork(id,url) {
    artRequest?.abort();artRequest=null;
    if(cache.has(id)){applyArtwork(cache.get(id));return;}
    if(!url){applyArtwork({accent:'180,150,170',background:''});return;}
    const abort=artRequest=new AbortController(),img=new Image();img.crossOrigin='anonymous';
    abort.signal.addEventListener('abort',()=>{img.onload=null;img.onerror=null;img.src='';},{once:true});
    img.onload=()=>{
      if(abort.signal.aborted)return;
      const asset={accent:'180,150,170',background:''};
      try {
        const small=document.createElement('canvas');small.width=small.height=64;
        const c=small.getContext('2d',{willReadFrequently:true});c.drawImage(img,0,0,64,64);
        const pixels=c.getImageData(0,0,64,64).data,sum=[0,0,0];let weight=0;
        for(let i=0;i<pixels.length;i+=4){const rgb=[pixels[i],pixels[i+1],pixels[i+2]],hi=Math.max(...rgb),lo=Math.min(...rgb);if(hi<35||lo>225)continue;const w=.15+(hi-lo)/255;rgb.forEach((x,j)=>sum[j]+=x*w);weight+=w;}
        if(weight)asset.accent=sum.map(x=>Math.round(x/weight)).join(',');
        // Blur once at 64 px. The fullscreen layer never runs a blur filter.
        const blurred=document.createElement('canvas');blurred.width=blurred.height=64;
        const b=blurred.getContext('2d');b.fillStyle=`rgb(${asset.accent})`;b.fillRect(0,0,64,64);b.filter='blur(12px) saturate(1.4)';b.drawImage(small,-8,-8,80,80);asset.background=blurred.toDataURL('image/jpeg',.8);
        small.width=small.height=blurred.width=blurred.height=0;
      } catch {/* Cross-origin covers retain a plain accent background. */}
      cache.set(id,asset);while(cache.size>20)cache.delete(cache.keys().next().value);
      if(track===id)applyArtwork(asset);img.onload=img.onerror=null;
    };
    img.onerror=()=>{if(!abort.signal.aborted&&track===id)applyArtwork({accent:'180,150,170',background:''});img.onload=img.onerror=null;};
    img.src=url.replace(/^spotify:image:/,'https://i.scdn.co/image/');
  }
  function applyArtwork(asset){
    document.documentElement.style.setProperty('--vg-accent-rgb',asset.accent);
    if(view){view.accent=`rgb(${asset.accent})`;view.root.querySelector('.vg-backdrop').style.backgroundImage=asset.background?`url("${asset.background}")`:'none';}
  }
  function mountView() {
    const root=document.createElement('section');root.id='vg';root.tabIndex=-1;root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','Reproductor inmersivo');
    root.innerHTML=`<div class="vg-content"><div class="vg-backdrop" aria-hidden="true"></div><div class="vg-shade" aria-hidden="true"></div><header class="vg-toolbar">${button('close','Cerrar vista inmersiva')}<nav class="vg-segments" aria-label="Vistas">${button('mini','Mini reproductor')}${button('lyrics','Letras')}${button('queue','Cola')}${button('timer','Temporizador','moon')}${button('equalizer','Ecualizador','eq')}</nav></header><main class="vg-layout"><section class="vg-song" aria-label="Reproduciendo ahora"><div class="vg-art-space"><canvas class="vg-ring" aria-hidden="true"></canvas><img class="vg-art" alt="Portada del álbum"></div><h1 class="vg-title"></h1><div class="vg-artist-row"><span class="vg-artist"></span>${button('more','Más opciones')}</div><div class="vg-album"></div>${progressMarkup()}${transportMarkup()}${volumeMarkup()}</section><section class="vg-lyrics" aria-label="Letra"><div class="vg-lyric-list"></div></section></main><div class="vg-status" role="status"></div><div class="vg-panel" hidden></div></div>`;
    const v={root,abort:new AbortController(),lyricsAbort:null,lines:[],line:-2,playing:undefined,frame:0,spectrumTimer:0,spectrumAbort:null,bands:new Float32Array(64),target:new Float32Array(64),dragging:new Set(),accent:'rgb(180,150,170)',animation:null,resize:null};
    view=v;document.body.append(root);
    root.querySelector('[data-action="lyrics"]').setAttribute('aria-pressed','true');
    root.addEventListener('click',e=>handleClick(e,v),{signal:v.abort.signal});
    root.addEventListener('keydown',e=>{
      if(e.key==='Tab'){const all=[...root.querySelectorAll('button,input,a')].filter(x=>!x.disabled&&x.getClientRects().length);const first=all[0],last=all.at(-1);if(e.shiftKey&&(document.activeElement===first||document.activeElement===root)){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}
    },{signal:v.abort.signal});
    for(const input of root.querySelectorAll('input[type="range"]')){
      input.addEventListener('pointerdown',()=>v.dragging.add(input),{signal:v.abort.signal});
      for(const event of ['pointerup','pointercancel','blur'])input.addEventListener(event,()=>v.dragging.delete(input),{signal:v.abort.signal});
      input.addEventListener('input',()=>{rangeFill(input);if(input.classList.contains('vg-seek')){input.parentElement.style.setProperty('--vg-fill',input.value/10+'%');root.querySelector('.vg-elapsed').textContent=fmt((state?.duration||0)*input.value/1000);}},{signal:v.abort.signal});
      input.addEventListener('change',()=>control(input.classList.contains('vg-seek')?'seek':'volume',input.classList.contains('vg-seek')?(state?.duration||0)*input.value/1000:input.value/100),{signal:v.abort.signal});
    }
    v.resize=new ResizeObserver(()=>{sizeCanvas(v);updateLyric(v,position(),true);if(!state?.playing)drawSpectrum(v);});v.resize.observe(root.querySelector('.vg-art-space'));v.resize.observe(root.querySelector('.vg-lyrics'));
    sizeCanvas(v);loadSong(v);if(cache.has(track))applyArtwork(cache.get(track));updateUI();root.focus({preventScroll:true});return v;
  }
  async function loadSong(v) {
    if(view!==v)return;
    v.lyricsAbort?.abort();const abort=v.lyricsAbort=new AbortController();v.lines=[];v.line=-2;
    const m=state?.item?.metadata||{};
    v.root.querySelector('.vg-title').textContent=m.title||'Elige una canción';v.root.querySelector('.vg-artist').textContent=m.artist_name||'';v.root.querySelector('.vg-album').textContent=m.album_title||'';
    const art=v.root.querySelector('.vg-art'),url=m.image_xlarge_url?.replace(/^spotify:image:/,'https://i.scdn.co/image/');if(url)art.src=url;else art.removeAttribute('src');
    const box=v.root.querySelector('.vg-lyric-list');box.style.transform='';box.replaceChildren();
    const loading=document.createElement('p');loading.className='vg-loading';loading.textContent='Buscando letras…';box.append(loading);
    try {
      const q=new URLSearchParams({track_name:m.title||'',artist_name:m.artist_name||'',album_name:m.album_title||'',duration:Math.round((state?.duration||0)/1000)});
      const response=await fetch(API+'/lyrics?'+q,{signal:AbortSignal.any([abort.signal,AbortSignal.timeout(15000)])});if(!response.ok)throw Error('lyrics');const data=await response.json();
      if(view!==v||abort.signal.aborted)return;
      for(const line of (data.syncedLyrics||'').split('\n'))for(const match of line.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g))v.lines.push({time:(Number(match[1])*60+Number(match[2]))*1000,text:line.replace(/\[[^\]]*\]/g,'').trim()||'♪'});
      v.lines.sort((a,b)=>a.time-b.time);box.replaceChildren();
      if(v.lines.length){
        if(v.lines[0].time>0)v.lines.unshift({time:0,text:'♪'});
        for(const [i,line] of v.lines.entries()){const b=document.createElement('button');b.className='vg-lyric';b.dataset.line=i;b.textContent=line.text;b.title='Reproducir desde '+fmt(line.time);box.append(b);}
        updateLyric(v,position(),true);
      }else if(data.plainLyrics){const p=document.createElement('p');p.className='vg-plain';p.textContent=data.plainLyrics;box.append(p);}
      else emptyLyrics(v,data.instrumental);
    }catch(e){if(view===v&&!abort.signal.aborted)emptyLyrics(v,false);}
  }
  function emptyLyrics(v,instrumental) {
    const box=v.root.querySelector('.vg-lyric-list');box.style.transform='';
    box.innerHTML=`<div class="vg-empty"><span class="vg-empty-icon">${svg('note')}</span><h2>Sin letra para esta canción</h2><p>${instrumental?'Esta pista es instrumental. Disfruta cada nota.':'Esta pista todavía no tiene letra sincronizada. Disfruta la música o intenta buscarla de nuevo.'}</p><button class="vg-ghost" data-action="search-lyrics">Buscar letra</button></div>`;
  }
  function updateLyric(v,p,force=false) {
    if(!v.lines.length)return;let index=0;for(let i=0;i<v.lines.length;i++){if(v.lines[i].time<=p)index=i;else break;}
    if(index===v.line&&!force)return;v.line=index;
    const list=v.root.querySelector('.vg-lyric-list'),buttons=[...list.children];
    buttons.forEach((b,i)=>{b.classList.toggle('current',i===index);b.classList.toggle('near',Math.abs(i-index)===1);b.setAttribute('aria-current',String(i===index));});
    const active=buttons[index],h=v.root.querySelector('.vg-lyrics').clientHeight;
    if(active)list.style.transform=`translateY(${h*.45-active.offsetTop-active.offsetHeight/2}px)`;
  }
  function sizeCanvas(v){const canvas=v.root.querySelector('canvas'),box=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(box.width*dpr);canvas.height=Math.round(box.height*dpr);v.ctx=canvas.getContext('2d');v.ctx.setTransform(dpr,0,0,dpr,0,0);v.size=box.width;}
  function drawSpectrum(v){
    if(!v.ctx)return;const c=v.ctx,w=v.size;c.clearRect(0,0,w,w);c.strokeStyle=v.accent;c.lineWidth=5;c.lineCap='round';const scale=w/340;
    for(let i=0;i<72;i++){const a=i/72*Math.PI*2-Math.PI/2,down=(1+Math.sin(a))/2,bin=Math.round(Math.min(i,72-i)/36*31);v.bands[bin]+=(v.target[bin]-v.bands[bin])*.24;const start=106*scale,length=(14+v.bands[bin]*(12+35*down))*scale;c.globalAlpha=.5+.5*down;c.beginPath();c.moveTo(w/2+Math.cos(a)*start,w/2+Math.sin(a)*start);c.lineTo(w/2+Math.cos(a)*(start+length),w/2+Math.sin(a)*(start+length));c.stroke();}c.globalAlpha=1;
  }
  function stopVisualizer(v){cancelAnimationFrame(v.frame);v.frame=0;clearTimeout(v.spectrumTimer);v.spectrumTimer=0;v.spectrumAbort?.abort();v.spectrumAbort=null;v.target.fill(0);v.bands.fill(0);}
  function syncVisualizer(v){
    stopVisualizer(v);if(view!==v||closing||document.hidden||!state?.playing){drawSpectrum(v);return;}
    const abort=v.spectrumAbort=new AbortController();
    const poll=async()=>{try{const r=await fetch(API+'/spectrum',{signal:AbortSignal.any([abort.signal,AbortSignal.timeout(1500)])}),data=await r.json();if(abort.signal.aborted)return;if(data.active&&Array.isArray(data.bands)&&data.bands.length===64&&data.bands.every(Number.isFinite)){v.target.set(data.bands.map(x=>Math.max(0,Math.min(1,x))));v.root.querySelector('.vg-status').textContent='';}else{v.target.fill(0);v.root.querySelector('.vg-status').textContent='Visualizador sin señal de audio';}}catch{v.target.fill(0);}if(!abort.signal.aborted)v.spectrumTimer=setTimeout(poll,100);};poll();
    let last=0;const frame=now=>{v.frame=0;if(abort.signal.aborted)return;if(now-last>=1000/30){drawSpectrum(v);last=now;}v.frame=requestAnimationFrame(frame);};v.frame=requestAnimationFrame(frame);
  }
  function panel(v,html){const p=v.root.querySelector('.vg-panel');p.hidden=false;p.innerHTML=button('dismiss','Cerrar panel','close')+html;p.querySelector('button')?.focus();}
  async function handleClick(e,v){
    const line=e.target.closest('[data-line]');if(line){control('seek',v.lines[Number(line.dataset.line)].time);return;}
    const action=e.target.closest('[data-action]')?.dataset.action;if(!action)return;
    if(['toggle','back','next'].includes(action))return control(action);
    if(action==='shuffle')return control('shuffle',!state?.shuffle);
    if(action==='repeat')return control('repeat',((state?.repeat||0)+1)%3);
    if(action==='close')return closeView();
    if(action==='dismiss'){v.root.querySelector('.vg-panel').hidden=true;v.root.querySelector('[data-action="more"]').focus();return;}
    if(action==='mini'){v.root.classList.toggle('vg-mini');e.target.closest('button').setAttribute('aria-pressed',String(v.root.classList.contains('vg-mini')));return;}
    if(action==='lyrics'){const hidden=v.root.classList.toggle('vg-no-lyrics');e.target.closest('button').setAttribute('aria-pressed',String(!hidden));return;}
    if(action==='queue'||action==='equalizer'){await closeView();Spicetify.Platform.History.push(action==='queue'?'/queue':'/preferences');if(action==='equalizer')notify('Ecualizador: abre la sección Reproducción de los ajustes.');return;}
    if(action==='more')return panel(v,'<h2>Más opciones</h2><button class="vg-ghost" data-action="full">Pantalla completa</button><button class="vg-ghost" data-action="settings">Ajustes</button>');
    if(action==='settings')return panel(v,'<h2>Ajustes</h2><p>El fondo y el acento se adaptan a la portada. Se respeta la preferencia de movimiento reducido del sistema.</p><button class="vg-ghost" data-action="equalizer">Abrir ajustes de reproducción</button>');
    if(action==='full'){try{if(document.fullscreenElement){fullscreenOwned=false;await document.exitFullscreen();}else{await document.documentElement.requestFullscreen();fullscreenOwned=true;}}catch{notify('La aplicación no permitió activar pantalla completa.');}return;}
    if(action==='timer')return panel(v,'<h2>Temporizador</h2><div class="vg-timer-options">'+[15,30,45,60].map(n=>`<button class="vg-ghost" data-action="sleep-${n}">${n} min</button>`).join('')+'<button class="vg-ghost" data-action="sleep-0">Cancelar</button></div>');
    if(action.startsWith('sleep-')){clearTimeout(sleepTimer);const minutes=Number(action.slice(6));sleepTimer=minutes?setTimeout(()=>{control('pause');sleepTimer=0;},minutes*60000):0;v.root.querySelector('.vg-panel').hidden=true;notify(minutes?'La música se pausará en '+minutes+' minutos.':'Temporizador cancelado.');return;}
    if(action==='search-lyrics'){loadSong(v);}
  }
  async function openView(){
    if(view||closing)return;returnFocus=document.activeElement;
    // Call fullscreen synchronously from the user's click, preserving activation.
    const full=!document.fullscreenElement?document.documentElement.requestFullscreen?.():null;
    const v=mountView();document.querySelector('.Root')?.setAttribute('inert','');document.documentElement.classList.add('vg-immersive');
    if(full)try{await full;fullscreenOwned=true;}catch{notify('No se pudo ocultar la barra del sistema; prueba Pantalla completa en ···.');}
    if(view===v&&!closing){await transition(v,true);if(!closing)syncVisualizer(v);}
  }
  async function closeView(){
    const v=view;if(!v||closing)return;closing=true;stopVisualizer(v);v.lyricsAbort?.abort();
    document.documentElement.classList.remove('vg-immersive');
    await transition(v,false);
    v.abort.abort();v.resize.disconnect();v.animation?.cancel();v.root.querySelectorAll('canvas').forEach(c=>{c.width=c.height=0;});v.root.remove();v.lines=[];view=null;closing=false;
    document.querySelector('.Root')?.removeAttribute('inert');
    if(fullscreenOwned&&document.fullscreenElement){fullscreenOwned=false;try{await document.exitFullscreen();}catch{}}
    (returnFocus?.isConnected?returnFocus:document.querySelector('[data-vg-open]'))?.focus({preventScroll:true});
  }
  async function transition(v,enter){
    v.animation?.cancel();
    if(motion.matches||document.hidden)return;
    const art=document.querySelector('[data-testid="cover-art-button"],.main-nowPlayingWidget-coverArtContainer');
    const rect=art?.getBoundingClientRect();
    const cx=rect?rect.left+rect.width/2:54,cy=rect?rect.top+rect.height/2:innerHeight-54;
    const radius=Math.max(2600,Math.hypot(Math.max(cx,innerWidth-cx),Math.max(cy,innerHeight-cy))/.76+4);
    const ns='http://www.w3.org/2000/svg',mask=document.createElementNS(ns,'svg');
    mask.setAttribute('width','0');mask.setAttribute('height','0');mask.setAttribute('aria-hidden','true');mask.style.position='absolute';
    const defs=document.createElementNS(ns,'defs'),clip=document.createElementNS(ns,'clipPath'),polygon=document.createElementNS(ns,'polygon');
    clip.id='vg-flower-clip';clip.setAttribute('clipPathUnits','userSpaceOnUse');
    polygon.setAttribute('points',Array.from({length:96},(_,i)=>{const a=i/96*Math.PI*2,r=.88+.12*Math.cos(6*a);return `${cx+r*Math.cos(a)},${cy+r*Math.sin(a)}`;}).join(' '));
    polygon.style.transformOrigin=`${cx}px ${cy}px`;clip.append(polygon);defs.append(clip);mask.append(defs);v.root.prepend(mask);
    v.root.style.clipPath='url(#vg-flower-clip)';
    const content=v.root.querySelector('.vg-content');content.style.transformOrigin=`${cx}px ${cy}px`;
    const frames=[{transform:'rotate(0deg) scale(4)'},{transform:`rotate(50deg) scale(${radius})`}];
    const timing={duration:720,easing:'cubic-bezier(.7,0,.25,1)',fill:'both'};
    const flowerAnimation=polygon.animate(enter?frames:[...frames].reverse(),timing);
    const contentFrames=[{transform:'scale(1.08)',opacity:.6},{transform:'scale(1)',opacity:1}];
    const contentAnimation=content.animate(enter?contentFrames:[...contentFrames].reverse(),timing);
    const animation={cancel(){flowerAnimation.cancel();contentAnimation.cancel();mask.remove();v.root.style.clipPath='';}};
    v.animation=animation;
    await Promise.all([flowerAnimation.finished,contentAnimation.finished]).catch(()=>{});
    // A replaced animation must not remove the replacement's clip.
    if(v.animation===animation){animation.cancel();v.animation=null;}
  }
  function mountDock() {
    const root=document.querySelector('.main-nowPlayingBar-nowPlayingBar');
    if(!root)return;
    if(dock?.root!==root){dock?.abort.abort();dock={root,abort:new AbortController()};}
    const cover=root.querySelector('[data-testid="cover-art-button"],.main-nowPlayingWidget-coverArtContainer');
    if(cover&&!cover.hasAttribute('data-vg-open')){
      cover.dataset.vgOpen='true';cover.setAttribute('aria-label','Abrir vista inmersiva');
      const expand=document.createElement('span');expand.className='vg-cover-expand';expand.dataset.vgOwned='';expand.innerHTML=svg('expand');cover.append(expand);
      cover.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();openView();},{capture:true,signal:dock.abort.signal});
    }
    const right=root.querySelector('.main-nowPlayingBar-right');
    if(right&&!right.querySelector('.vg-dock-open')){
      const b=document.createElement('button');b.className='vg-button vg-dock-open';b.dataset.vgOpen='true';b.dataset.vgOwned='';b.innerHTML=svg('expand')+'<span>Inmersiva</span>';b.title='Abrir vista inmersiva';b.setAttribute('aria-label',b.title);b.onclick=openView;right.append(b);
    }
    const progress=root.querySelector('[data-testid="playback-progressbar"],.playback-progressbar');
    if(progress&&!progress.querySelector('.vg-wave-window')){
      progress.classList.add('vg-native-progress');progress.insertAdjacentHTML('beforeend',wave);progress.querySelector('.vg-wave-window').dataset.vgOwned='';
    }
    const bar=root.querySelector('.playback-bar');
    if(bar&&!bar.querySelector('.vg-native-duration')){
      const total=document.createElement('span');total.className='vg-native-duration';total.dataset.vgOwned='';total.title='Duración total';bar.append(total);
    }
  }
  function updateDock(){
    const r=dock.root,p=position(),d=state?.duration||0;
    r.querySelector('.vg-native-progress')?.style.setProperty('--vg-fill',(d?p/d*100:0)+'%');
    const total=r.querySelector('.vg-native-duration');if(total)total.textContent=fmt(d);
  }
  const launcher=new Spicetify.Topbar.Button('Inmersiva',icons.expand,openView);
  document.addEventListener('keydown',e=>{
    if(e.ctrlKey&&e.altKey&&e.code==='KeyV'){e.preventDefault();view?closeView():openView();return;}
    if(!view)return;
    if(e.code==='Escape'){e.preventDefault();if(!view.root.querySelector('.vg-panel').hidden)view.root.querySelector('.vg-panel').hidden=true;else closeView();}
    if(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;
    if(e.code==='Space'){e.preventDefault();control('toggle');}
    if(e.code==='ArrowLeft'||e.code==='ArrowRight'){e.preventDefault();control('seek',Math.max(0,Math.min(state?.duration||0,position()+(e.code==='ArrowLeft'?-10000:10000))));}
  },{signal:life.signal});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)playerRequest?.abort();if(view)syncVisualizer(view);document.documentElement.classList.toggle('vg-hidden',document.hidden);},{signal:life.signal});
  document.addEventListener('fullscreenchange',()=>{if(fullscreenOwned&&!document.fullscreenElement){fullscreenOwned=false;closeView();}},{signal:life.signal});
  function dispose(){disposed=true;clearTimeout(tickTimer);clearTimeout(sleepTimer);playerRequest?.abort();artRequest?.abort();life.abort();if(view){stopVisualizer(view);view.abort.abort();view.lyricsAbort?.abort();view.resize.disconnect();view.animation?.cancel();view.root.remove();view=null;}cache.clear();launcher?.deregister?.();dock?.abort.abort();document.querySelectorAll('[data-vg-owned]').forEach(x=>x.remove());document.querySelector('.Root')?.removeAttribute('inert');document.documentElement.classList.remove('vg-immersive','vg-paused','vg-hidden');}
  window.VideoGlass={open:openView,close:closeView,dispose,get root(){return view?.root||null;},diagnostics:()=>({mounted:!!view,frames:view?.frame?1:0,cache:cache.size,lyricLines:view?.lines.length||0,playing:!!state?.playing})};
  clockTick();
})();
