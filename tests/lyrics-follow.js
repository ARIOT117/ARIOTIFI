// Run with: gjs -m tests/lyrics-follow.js
import GLib from 'gi://GLib';

const source=new TextDecoder().decode(GLib.file_get_contents('Extensions/videoglass.js')[1]);
new Function(source); // Compile the complete installed extension without executing it.
function extract(name,next){return source.slice(source.indexOf(`  function ${name}(`),source.indexOf(`  function ${next}(`));}
const parse=new Function(extract('parseSyncedLyrics','clearLyricsLoading').split('  async function loadSong')[0]+';return parseSyncedLyrics;')();
const update=new Function(extract('updateLyric','sizeCanvas')+';return updateLyric;')();
function check(ok,message){if(!ok)throw new Error(message);}
const lines=parse('[offset:100]\r\n[00:01.00][00:03.00]Primera\r\n[00:02.00]Segunda\n[00:04.00]');
check(JSON.stringify(lines.map(x=>x.time))==='[900,1900,2900,3900]','Sorted repeated timestamps and LRC offset');
check(lines[3].text==='♪','Instrumental timestamps');
const buttons=[0,...lines].map((_,i)=>({offsetTop:i*108,offsetHeight:108,
  classList:{toggle(name,on){this[name]=on;}},setAttribute(name,value){this[name]=value;}}));
const list={children:buttons,style:{}};
const v={lines:[{time:0,text:'♪'},...lines],line:-2,root:{querySelector(selector){return selector==='.vg-lyric-list'?list:{clientHeight:540};}}};
for(const [time,index] of [[0,0],[899,0],[900,1],[1900,2],[3899,3],[3900,4],[500,0]]){
  update(v,time);
  check(v.line===index,`Active lyric at ${time} ms, including backward seek`);
  check(buttons[index].classList.current,'Current lyric is highlighted');
  check(buttons.filter(b=>b.classList.current).length===1,'Exactly one active lyric');
  check(list.style.transform===`translateY(${540*.45-index*108-54}px)`,'Current lyric stays at the same height');
}
print('PASS: extension syntax, timestamps, offsets, instrumental, progression, backward seek, highlight and scroll.');
