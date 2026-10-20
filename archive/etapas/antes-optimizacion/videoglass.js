// VideoGlass: immersive Spotify player inspired by the downloaded QML reference.
(async function () {
  while (!window.Spicetify?.Platform?.PlayerAPI?._state || !Spicetify.Platform.PlaybackAPI || !Spicetify.Topbar) await new Promise(r => setTimeout(r, 300));
  // Spotify 1.2.95 exposes PlayerAPI before the wrapper's origin hook.
  if(!Spicetify.Player.origin)Spicetify.Player.origin=Spicetify.Platform.PlayerAPI;
  const P = Spicetify.Player, API = 'http://127.0.0.1:43891';
  const defaults = {enabled:true,shape:'circle',style:'ring',blur:36,dark:42,saturation:120,sensitivity:120,lyrics:true,art:true};
  let settings; try { settings = {...defaults, ...JSON.parse(localStorage.getItem('videoglass') || '{}')}; } catch { settings = {...defaults}; }
  let open = false, mini = false, lines = [], plain = '', lastURI = '', generation = 0, lastLine = -2;
  let bands = Array(64).fill(0), target = Array(64).fill(0), audioOK = false, frame = 0, polling = false;
  let sleepDeadline = 0, noticeTimer;
  const css = document.createElement('style');
  css.textContent = `
  #vg{position:fixed;inset:0;z-index:10000;color:#f7f9fc;background:#101318;font-family:inherit;display:none;overflow:hidden;--blur:36px;--dark:.42;--sat:1.2;--accent:#a9dccd}
  #vg.open{display:block} #vg .backdrop{position:absolute;inset:-90px;background-position:center;background-size:cover;filter:blur(var(--blur)) saturate(var(--sat));transform:scale(1.08);transition:background-image .9s}
  #vg .shade{position:absolute;inset:0;background:linear-gradient(125deg,rgba(6,14,20,var(--dark)),rgba(0,8,18,.25)),#00000020}
  #vg .toolbar{position:absolute;top:20px;left:24px;right:24px;display:flex;justify-content:space-between;align-items:center;z-index:4}
  #vg .dots{display:flex;gap:7px}#vg .dots i{width:10px;height:10px;border-radius:50%;background:#ff6059}#vg .dots i:nth-child(2){background:#ffbd2e}#vg .dots i:nth-child(3){background:#28cb42}
  #vg button{border:0;cursor:pointer;color:inherit;font:inherit;display:inline-flex;align-items:center;justify-content:center;background:transparent;border-radius:50%;width:38px;height:38px;transition:background .15s,transform .15s}#vg button:hover{background:#ffffff20;transform:scale(1.04)}#vg button:focus-visible{outline:2px solid var(--accent);outline-offset:3px}#vg button svg{width:19px;height:19px;fill:currentColor}#vg .buttons{display:flex;gap:6px;align-items:center;background:#ffffff0b;padding:4px 8px;border-radius:30px;backdrop-filter:blur(20px)}
  #vg .layout{position:absolute;inset:85px 6% 120px;display:grid;grid-template-columns:42% 58%;align-items:center;gap:3%;z-index:2}#vg.no-lyrics .layout{grid-template-columns:1fr}#vg.no-lyrics .song{max-width:620px;margin:auto;width:100%}
  #vg .song{text-align:center;min-width:0}#vg .art-space{height:clamp(150px,30vh,310px);position:relative;display:grid;place-items:center;margin:0 auto 25px;width:clamp(150px,30vh,310px)}
  #vg .art{position:relative;width:72%;height:72%;object-fit:cover;box-shadow:0 18px 65px #0006;transition:clip-path .7s,border-radius .7s,opacity .3s;z-index:2}#vg[data-shape=circle] .art{border-radius:50%}#vg[data-shape=square] .art{border-radius:12px}#vg[data-shape=flower] .art{clip-path:polygon(100% 50%,94% 62%,98% 75%,85% 81%,83% 94%,69% 93%,60% 100%,50% 95%,38% 100%,31% 91%,17% 94%,16% 80%,3% 75%,7% 61%,0% 50%,7% 38%,3% 25%,17% 19%,18% 6%,31% 8%,40% 0%,50% 5%,62% 0%,69% 9%,83% 6%,84% 20%,97% 25%,93% 38%)}
  #vg .ring{position:absolute;inset:-8%;width:116%;height:116%;pointer-events:none;z-index:1}#vg .title{font-size:clamp(20px,2.8vw,38px);font-weight:750;letter-spacing:-.04em;line-height:1.25;margin-bottom:10px;overflow-wrap:anywhere}#vg .artist{font-size:14px;opacity:.65;margin:0 0 26px}#vg .album{font-size:12px;opacity:.45;margin-top:5px}
  #vg .progress{display:flex;align-items:center;gap:10px;max-width:370px;margin:0 auto;color:#ffffff8c;font-size:11px;font-variant-numeric:tabular-nums}#vg input[type=range]{accent-color:var(--accent);height:3px;cursor:pointer;min-width:0}#vg .progress input{flex:1;width:100%}#vg .transport{display:flex;justify-content:center;align-items:center;gap:12px;margin:18px 0}#vg .transport .play{background:#f6f8fa;color:#172325;width:43px;height:43px}#vg .transport .active{color:#5cff9b}#vg .volume{display:flex;gap:12px;align-items:center;justify-content:center;opacity:.65}#vg .volume input{width:160px}
  #vg .lyrics{height:100%;min-height:200px;overflow-y:auto;scrollbar-width:none;mask-image:linear-gradient(transparent,#000 14%,#000 84%,transparent);padding:32vh 5px 32vh;scroll-behavior:smooth}#vg .lyric{display:block;width:100%;height:auto;text-align:left;line-height:1.5;font-size:clamp(16px,2vw,28px);font-weight:650;letter-spacing:-.02em;opacity:.30;padding:8px 0;border-radius:0;transition:opacity .25s,transform .25s;justify-content:flex-start}#vg .lyric.current{opacity:1;transform:translateX(5px)}#vg .lyric:hover{opacity:.8;background:transparent;transform:none}#vg .lyric-note{font-size:18px;line-height:1.6;opacity:.55;padding-top:5vh}#vg.no-lyrics .lyrics{display:none}
  #vg .bottom-vis{position:absolute;left:3%;bottom:18px;width:94%;height:115px;opacity:.68;pointer-events:none;z-index:1}#vg .status{position:absolute;bottom:15px;right:24px;font-size:10px;opacity:.5;z-index:3}#vg .toast{position:absolute;bottom:150px;left:50%;transform:translateX(-50%);background:#0d131bdd;padding:12px 22px;border-radius:24px;z-index:9;display:none;font-size:13px}
  #vg .settings{position:absolute;inset:0;background:#0004;display:none;align-items:center;justify-content:center;z-index:7;backdrop-filter:blur(4px)}#vg .settings.visible{display:flex}#vg .dialog{width:min(630px,92vw);max-height:85vh;overflow:auto;background:#0c0d10f7;box-shadow:0 25px 100px #0009;border:1px solid #ffffff10;border-radius:18px;display:grid;grid-template-columns:145px 1fr;padding:12px}
  #vg .volume>svg{width:16px;height:16px;fill:currentColor;flex-shrink:0}
  #vg .tabs{border-right:1px solid #ffffff0a;padding:15px 10px}#vg .tab{width:100%;height:auto;justify-content:flex-start;border-radius:9px;padding:12px 8px;font-size:12px;gap:8px;opacity:.55;margin:3px 0}#vg .tab.selected{opacity:1;background:#ffffff08}#vg .tab svg{width:15px;height:15px}#vg .panel{padding:16px 22px}#vg .panel h3{font-size:17px;margin:0 0 28px}#vg .setting-row{margin:22px 0;font-size:12px;color:#c6cbd2}#vg .setting-row label{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}#vg .setting-row input[type=range]{width:100%}#vg .setting-row select{background:#23262b;border:0;border-radius:20px;color:white;padding:7px 10px;font:inherit}#vg .setting-row small{opacity:.6;line-height:1.6;display:block;margin-top:18px}#vg input[type=checkbox]{accent-color:#1ed760;width:17px;height:17px}#vg .close-settings{float:right;width:28px;height:28px;margin-top:-4px}#vg .timer-actions{display:flex;flex-wrap:wrap;gap:8px}#vg .timer-actions button{width:auto;height:auto;border-radius:20px;background:#ffffff0c;padding:10px 13px;font-size:12px}
  #vg.mini .layout{inset:50px 18% 65px;grid-template-columns:1fr}#vg.mini .lyrics,#vg.mini .artist,#vg.mini .album{display:none}#vg.mini .art-space{height:clamp(100px,25vh,250px);width:clamp(100px,25vh,250px);margin-bottom:10px}#vg.mini .title{font-size:22px}#vg.mini .transport{margin:10px}#vg.mini .bottom-vis{height:60px}#vg .hide-art .art{opacity:0}
  @media(max-width:760px){#vg .layout{grid-template-columns:1fr 1fr;inset:70px 4% 100px;gap:4%}#vg .title{font-size:22px}#vg .lyric{font-size:17px}#vg .art-space{width:180px;height:180px}#vg .artist{font-size:11px}#vg .volume input{width:110px}}
  @media(prefers-reduced-motion:reduce){#vg *{scroll-behavior:auto!important;transition:none!important}}
  `;
  document.head.append(css);
  const icons = {
    play:'<path d="M8 5v14l11-7z"/>',pause:'<path d="M7 5h4v14H7zm6 0h4v14h-4z"/>',
    prev:'<path d="M6 5h2v14H6zm3 7 11-7v14z"/>',next:'<path d="M16 5h2v14h-2zM4 5l11 7-11 7z"/>',
    close:'<path d="m6 5 6 6 6-6 1 1-6 6 6 6-1 1-6-6-6 6-1-1 6-6-6-6z"/>',
    settings:'<path d="m10 2-.5 3-2 1-2.8-1-2 3 2.3 2v3L2.7 15l2 3 2.8-1 2 1 .5 3h4l.5-3 2-1 2.8 1 2-3-2.3-2v-3l2.3-2-2-3-2.8 1-2-1-.5-3zm2 6a4 4 0 1 1 0 8 4 4 0 0 1 0-8"/>',
    full:'<path d="M3 3h6v2H5v4H3zm12 0h6v6h-2V5h-4zM3 15h2v4h4v2H3zm16 0h2v6h-6v-2h4z"/>',
    lyrics:'<path d="M4 4h16v2H4zm0 5h12v2H4zm0 5h16v2H4zm0 5h10v2H4z"/>',
    volume:'<path d="M3 9h4l5-4v14l-5-4H3zm12-2v2a4 4 0 0 1 0 6v2a6 6 0 0 0 0-10z"/>',
    shuffle:'<path d="M3 6h3c3 0 5 10 9 10h2v-3l5 4-5 4v-3h-2C10 18 8 8 6 8H3zm0 10h3c1 0 2-2 3-4l1 3c-1 2-2 3-4 3H3zm10-9c1-1 2-1 4-1V3l5 4-5 4V8h-2z"/>',
    repeat:'<path d="M6 5h10V2l5 4-5 4V7H6a3 3 0 0 0-3 3v2H1v-2a5 5 0 0 1 5-5zm12 14H8v3l-5-4 5-4v3h10a3 3 0 0 0 3-3v-2h2v2a5 5 0 0 1-5 5"/>',
    mini:'<path d="M3 4h18v16H3zm2 2v12h14V6zm7 6h6v5h-6z"/>',
    wave:'<path d="M2 10h2v4H2zm4-5h2v14H6zm4 3h2v8h-2zm4-6h2v20h-2zm4 5h2v10h-2zm4 3h2v4h-2z"/>',
    image:'<path d="M3 3h18v18H3zm2 2v12l5-6 4 4 3-3 2 3V5z"/>',
    clock:'<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16zm-1 3h2v5l4 2-1 2-5-3z"/>'
  };
  const svg = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.wave}</svg>`;
  const button = (name,title,cls='') => `<button data-action="${name}" class="${cls}" title="${title}" aria-label="${title}">${svg(name)}</button>`;
  const root = document.createElement('section'); root.id='vg';root.setAttribute('aria-label','Reproductor inmersivo');
  root.innerHTML = `<div class="backdrop"></div><div class="shade"></div><div class="toolbar"><div class="dots" aria-hidden="true"><i></i><i></i><i></i></div><div class="buttons">${button('mini','Vista compacta')}${button('lyrics','Mostrar letras')}${button('settings','Ajustes visuales')}${button('full','Pantalla completa')}${button('close','Volver a Spotify · Esc')}</div></div><div class="layout"><div class="song"><div class="art-space"><canvas class="ring"></canvas><img class="art" alt="Carátula del álbum"></div><div class="title"></div><div class="artist"></div><div class="progress"><span class="elapsed">0:00</span><input class="seek" type="range" min="0" max="1000" value="0" aria-label="Posición de reproducción"><span class="duration">0:00</span></div><div class="transport">${button('shuffle','Aleatorio')}${button('prev','Anterior')}${button('play','Reproducir o pausar','play')}${button('next','Siguiente')}${button('repeat','Repetir')}</div><div class="volume">${svg('volume')}<input class="vol" type="range" min="0" max="100" aria-label="Volumen"></div><div class="album"></div></div><div class="lyrics" aria-label="Letras sincronizadas"></div></div><canvas class="bottom-vis"></canvas><div class="status"></div><div class="toast" role="status"></div><div class="settings"><div class="dialog"><nav class="tabs"><button class="tab selected" data-tab="visualizer">${svg('wave')}Visualizador</button><button class="tab" data-tab="background">${svg('image')}Fondo</button><button class="tab" data-tab="appearance">${svg('settings')}Apariencia</button><button class="tab" data-tab="playback">${svg('clock')}Reproducción</button></nav><div class="panel"></div></div></div>`;
  document.body.append(root);
  const $ = s => root.querySelector(s);
  const fmt = ms => `${Math.floor(Math.max(0,ms)/60000)}:${String(Math.floor(Math.max(0,ms)/1000)%60).padStart(2,'0')}`;
  const store = () => {localStorage.setItem('videoglass',JSON.stringify(settings));applySettings();};
  function applySettings() {
    root.style.setProperty('--blur',settings.blur+'px');root.style.setProperty('--dark',settings.dark/100);root.style.setProperty('--sat',settings.saturation/100);
    root.dataset.shape=settings.shape;root.classList.toggle('no-lyrics',!settings.lyrics);$('.art-space').classList.toggle('hide-art',!settings.art);
  }
  applySettings();
  function notify(text){$('.toast').textContent=text;$('.toast').style.display='block';clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('.toast').style.display='none',3500);}
  function setOpen(value){if(open===value)return;open=value;localStorage.setItem('videoglass-open',String(value));root.classList.toggle('open',value);if(value){updateSong();poll();frame=requestAnimationFrame(draw);}else{cancelAnimationFrame(frame);if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});}}
  new Spicetify.Topbar.Button('Reproductor del video',icons.wave,()=>setOpen(!open));
  if(Spicetify.Playbar?.Button)new Spicetify.Playbar.Button('Reproductor del video',icons.wave,()=>setOpen(!open));
  window.VideoGlass={open:()=>setOpen(true),close:()=>setOpen(false),settings,root};
  // Keep an accessible entry point across Spotify layout updates.
  const launcher=document.createElement('button');
  launcher.id='vg-launcher';launcher.title='Abrir reproductor del video · Ctrl + Alt + V';
  launcher.setAttribute('aria-label','Abrir reproductor del video');
  launcher.innerHTML=svg('wave')+'<span>Vista del video</span>';
  launcher.style.cssText='position:fixed;top:15px;left:145px;z-index:5000;display:flex;align-items:center;gap:8px;height:34px;padding:0 12px;border:1px solid #ffffff16;border-radius:20px;background:#153028;color:#c8ecdf;font:600 12px inherit;cursor:pointer';
  launcher.querySelector('svg').style.cssText='width:16px;height:16px;fill:currentColor';
  launcher.onclick=()=>setOpen(true);document.body.append(launcher);
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
      case 'mini':mini=!mini;root.classList.toggle('mini',mini);break;
    }}catch(error){notify('No se pudo realizar esta acción.');console.warn('[VideoGlass]',error);}
  });
  $('.seek').addEventListener('input',e=>P.seek(P.getDuration()*e.target.value/1000));
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
    const item=Spicetify.Platform.PlayerAPI?._state?.item||P.data?.item;if(!item){$('.title').textContent='Elige una canción';$('.lyrics').innerHTML='<div class="lyric-note">Vuelve a tu biblioteca con Esc y reproduce una canción.</div>';return;}
    const m=item.metadata||{},uri=item.uri||m.uri||'',cover=(m.image_xlarge_url||m.image_large_url||m.image_url||m.image_small_url||'').replace(/^spotify:image:/,'https://i.scdn.co/image/');
    $('.title').textContent=m.title||item.name||'Spotify';$('.artist').textContent=m.artist_name||'';$('.album').textContent=m.album_title||'';
    if(cover&&$('.art').src!==cover){$('.art').src=cover;$('.backdrop').style.backgroundImage=`url("${cover.replace(/"/g,'')}")`;document.documentElement.style.setProperty('--vg-cover',`url("${cover.replace(/"/g,'')}")`);}
    if(uri===lastURI)return;lastURI=uri;lastLine=-2;lines=[];plain='';const current=++generation;
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
  setInterval(()=>{if(open)updateSong();},1000);
  async function poll(){
    if(polling)return;polling=true;
    while(open){
      if(!P.origin?._state){await new Promise(r=>setTimeout(r,300));continue;}
      if(settings.enabled&&P.isPlaying())try{const data=await fetch(API+'/spectrum').then(r=>r.json());target=data.bands||target;audioOK=data.active&&!data.error;}catch{audioOK=false;target=Array(64).fill(0);}
      else {target=Array(64).fill(0);audioOK=false;}
      await new Promise(r=>setTimeout(r,50));
    }polling=false;
  }
  function canvasSize(canvas){const dpr=Math.min(2,devicePixelRatio||1),w=Math.round(canvas.clientWidth*dpr),h=Math.round(canvas.clientHeight*dpr);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}return [canvas.getContext('2d'),w,h];}
  function draw(){
    if(!open)return;
    if(!P.origin?._state){frame=requestAnimationFrame(draw);return;}
    const playing=P.isPlaying(),progress=P.getProgress(),duration=P.getDuration();
    $('.elapsed').textContent=fmt(progress);$('.duration').textContent=fmt(duration);if(document.activeElement!==$('.seek'))$('.seek').value=duration?progress/duration*1000:0;
    $('.play').innerHTML=svg(playing?'pause':'play');$('.vol').value=Math.round(P.getVolume()*100);root.querySelector('[data-action=shuffle]').classList.toggle('active',P.getShuffle());root.querySelector('[data-action=repeat]').classList.toggle('active',P.getRepeat()>0);
    if(lines.length){let index=-1;for(let i=0;i<lines.length;i++){if(lines[i].time<=progress+120)index=i;else break;}if(index!==lastLine){lastLine=index;$('.lyrics').querySelectorAll('.lyric').forEach((b,i)=>b.classList.toggle('current',i===index));const active=$('.lyrics').children[index];if(active&&settings.lyrics&&!mini){const box=$('.lyrics');box.scrollTo({top:active.offsetTop-box.offsetTop-box.clientHeight/2+active.clientHeight/2,behavior:'smooth'});}}}
    for(let i=0;i<64;i++)bands[i]+=(target[i]*(settings.sensitivity/100)-bands[i])*.18;
    const energy=bands.slice(0,12).reduce((a,b)=>a+b,0)/12;
    const [ctx,w,h]=canvasSize($('.ring'));ctx.clearRect(0,0,w,h);
    if(settings.enabled&&(settings.style==='ring'||settings.style==='both')){
      const cx=w/2,cy=h/2,r=Math.min(w,h)*.32;ctx.strokeStyle='#d1f4ef';ctx.lineCap='round';ctx.lineWidth=Math.max(2,w/125);
      const count=128;for(let i=0;i<count;i++){const a=i/count*Math.PI*2-Math.PI/2,v=bands[i<64?i:127-i]||0,len=3+v*Math.min(w,h)*.18;ctx.beginPath();ctx.moveTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r);ctx.lineTo(cx+Math.cos(a)*(r+len),cy+Math.sin(a)*(r+len));ctx.stroke();}
    }
    $('.art').style.transform=`scale(${1+Math.min(.065,energy*.075)})`;
    const [c,bw,bh]=canvasSize($('.bottom-vis'));c.clearRect(0,0,bw,bh);
    if(settings.enabled&&settings.style!=='ring'){
      const gradient=c.createLinearGradient(0,0,bw,0);gradient.addColorStop(0,'#b6e9e7');gradient.addColorStop(.5,'#63b8db');gradient.addColorStop(1,'#b6e9e7');c.fillStyle=gradient;
      if(settings.style==='wave') {c.beginPath();c.moveTo(0,bh);for(let i=0;i<64;i++)c.lineTo(i/63*bw,bh-2-bands[i]*bh*.9);c.lineTo(bw,bh);c.closePath();c.fill();}
      else {const width=bw/64;for(let i=0;i<64;i++){const height=Math.max(3,bands[i]*bh*.9);c.beginPath();c.roundRect(i*width,bh-height,width*.65,height,width*.3);c.fill();}}
    }
    $('.status').textContent=sleepDeadline?'Pausa en '+Math.max(0,Math.ceil((sleepDeadline-Date.now())/60000))+' min':settings.enabled&&playing&&!audioOK?'Conectando visualizador…':'';
    frame=requestAnimationFrame(draw);
  }
  setInterval(()=>{if(sleepDeadline&&Date.now()>=sleepDeadline){sleepDeadline=0;if(P.isPlaying())P.pause();if(open)notify('La música se pausó por el temporizador.');}},1000);
  updateSong();
  setTimeout(()=>{if(localStorage.getItem('videoglass-open')==='true')setOpen(true);},1500);
})();
