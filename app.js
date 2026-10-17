/* Goshé. — 고성능 쉐도잉 v1.0.7 */
'use strict';
const VERSION='1.0.7';
const DEFAULT_MODEL='gemini-3.5-flash-lite';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* ---------- 저장소 ---------- */
const KEY='goshe.v1';
let DB=(()=>{try{return JSON.parse(localStorage.getItem(KEY))||{};}catch(e){return {};}})();
DB.clips=DB.clips||[];DB.vocab=DB.vocab||[];DB.settings=Object.assign({key:'',model:DEFAULT_MODEL},DB.settings||{});
DB.speed=Object.assign({shadow:100,script:100},DB.speed||{});DB.ui=Object.assign({tab:'pClip',folded:false,vmode:'both'},DB.ui||{});
DB.usage=DB.usage||{since:Date.now(),rows:{}};
let saveT=null;
function save(now){clearTimeout(saveT);const f=()=>{try{localStorage.setItem(KEY,JSON.stringify(DB));}catch(e){toast('저장 공간이 부족해요');}};now?f():saveT=setTimeout(f,150);}
const clipById=id=>DB.clips.find(c=>c.id===id);
const learning=()=>clipById(DB.learningId);

function toast(t,ms=2200){const d=document.createElement('div');d.className='toast';d.textContent=t;document.body.appendChild(d);setTimeout(()=>d.remove(),ms);}

/* ---------- 효과음 ---------- */
let AC=null,OUT=null,MICOPEN=false;
function ambient(){const s=navigator.audioSession;if(!s)return;try{if(s.type==='ambient')s.type='auto';s.type='ambient';}catch(e){}}
function audio(){try{if(!AC||AC.state==='closed'){ambient();AC=new(window.AudioContext||window.webkitAudioContext)();OUT=AC.createGain();OUT.gain.value=0.5;OUT.connect(AC.destination);}
  if(AC.state!=='running'&&!document.hidden){const p=AC.resume();if(p&&p.catch)p.catch(()=>{});}}catch(e){}return AC;}
function rebuildAudio(){try{AC&&AC.close();}catch(e){}AC=null;OUT=null;audio();}
function bus(g){const a=audio();if(!a||MICOPEN)return null;const n=a.createGain();n.gain.value=g;n.connect(OUT);return n;}
function tone(o,f,type,vol,dec,delay=0){const a=AC,t=a.currentTime+delay+0.005,os=a.createOscillator(),g=a.createGain();os.type=type;os.frequency.value=f;
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+0.004);g.gain.exponentialRampToValueAtTime(0.0001,t+dec);os.connect(g).connect(o);os.start(t);os.stop(t+dec+0.05);}
function noise(o,t0,dur,vol,type,f0){const a=AC,n=Math.max(1,Math.floor(a.sampleRate*dur)),b=a.createBuffer(1,n,a.sampleRate),d=b.getChannelData(0);for(let i=0;i<n;i++)d[i]=Math.random()*2-1;
  const s=a.createBufferSource();s.buffer=b;const g=a.createGain(),f=a.createBiquadFilter();f.type=type;f.frequency.value=f0;const st=a.currentTime+t0+0.005;
  g.gain.setValueAtTime(0.0001,st);g.gain.linearRampToValueAtTime(vol,st+dur*0.25);g.gain.exponentialRampToValueAtTime(0.0008,st+dur);s.connect(f).connect(g).connect(o);s.start(st);s.stop(st+dur+0.02);}
function coinHit(o,f0,t0,vol){const a=AC,s=a.currentTime+t0+0.01;
  [[1,1,0.35],[2.76,0.6,0.22],[5.40,0.4,0.12],[8.93,0.25,0.07],[13.3,0.15,0.04]].forEach(([r,amp,dec])=>{const os=a.createOscillator(),g=a.createGain();os.type='sine';os.frequency.value=f0*r;
    g.gain.setValueAtTime(0,s);g.gain.linearRampToValueAtTime(vol*amp*0.35,s+0.0015);g.gain.setTargetAtTime(0,s+0.0015,dec);os.connect(g).connect(o);os.start(s);os.stop(s+dec*6);});
  noise(o,t0+0.01,0.004,vol*0.4,'highpass',3000);}
function blipTick(o,t0,vol){const a=AC,s=a.currentTime+t0+0.01;[[1250,1],[1910,.9],[2640,1],[3960,.6],[7700,.35]].forEach(([f,amp])=>{const os=a.createOscillator(),g=a.createGain();os.type='sine';os.frequency.value=f;
  g.gain.setValueAtTime(0,s);g.gain.linearRampToValueAtTime(vol*amp*0.26,s+0.002);g.gain.setTargetAtTime(0,s+0.002,0.022);os.connect(g).connect(o);os.start(s);os.stop(s+0.15);});}
function blipTone(o,f,t0,vol,tau){const a=AC,s=a.currentTime+t0+0.01;[[1,1],[2,.08]].forEach(([r,amp])=>{const os=a.createOscillator(),g=a.createGain();os.type='sine';os.frequency.value=f*r;
  g.gain.setValueAtTime(0,s);g.gain.linearRampToValueAtTime(vol*amp,s+0.006);g.gain.setValueAtTime(vol*amp,s+0.03);g.gain.setTargetAtTime(0,s+0.03,tau);os.connect(g).connect(o);os.start(s);os.stop(s+0.03+tau*7);});}
/* 음량은 실제 소리 크기를 재서 서로 비슷하게 맞춘 값 */
const SFX={
  ding(){const o=bus(.15);if(!o)return;tone(o,1318.5,'sine',1,.45);tone(o,2637,'sine',.18,.2);},                 // A · 맑은 딩 — 하단 탭
  tok(){const o=bus(.38);if(!o)return;tone(o,2093,'triangle',.7,.16);tone(o,4186,'sine',.15,.08);},               // C · 유리 톡 — 버튼
  click(){const o=bus(1.79);if(!o)return;noise(o,0,0.02,0.35,'highpass',3000);const a=AC,t=a.currentTime+0.011,os=a.createOscillator(),g=a.createGain();
    os.type='square';os.frequency.setValueAtTime(220,t);os.frequency.linearRampToValueAtTime(110,t+0.05);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(0.07,t+0.004);
    g.gain.exponentialRampToValueAtTime(0.0008,t+0.06);os.connect(g).connect(o);os.start(t);os.stop(t+0.08);},                                     // 딸깍 — 꾹 눌러 팝업
  tick(){const o=bus(1.29);if(!o)return;noise(o,0,0.006,0.5,'highpass',5000);tone(o,3200,'sine',.18,.012);},        // 틱 — 스크립트 드럼
  ok(){const o=bus(.68);if(!o)return;coinHit(o,1390,0,0.2);coinHit(o,1850,0.055,0.22);coinHit(o,2450,0.11,0.3);},  // 성공 = 호감도 ↑
  ng(){const o=bus(.41);if(!o)return;blipTick(o,0,0.1);blipTone(o,830,0.09,0.27,0.06);},                          // 실패 = 점수 ↓
};
document.addEventListener('pointerdown',()=>audio(),{capture:true,passive:true});
document.addEventListener('visibilitychange',()=>{if(document.hidden){try{AC&&AC.suspend();}catch(e){}}});

/* ---------- 제미나이 ---------- */
const USAGE_TAGS={script:'스크립트 정리·해석',judge:'말하기 판정',word:'단어 뜻'};
function logUsage(tag,u){if(!u)return;const r=DB.usage.rows[tag]||(DB.usage.rows[tag]={n:0,inp:0,out:0});r.n++;r.inp+=u.promptTokenCount||0;r.out+=(u.candidatesTokenCount||0)+(u.thoughtsTokenCount||0);save();}
async function post(url,body,ms){const ac=new AbortController();const to=setTimeout(()=>ac.abort(),ms);
  try{return await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:ac.signal});}finally{clearTimeout(to);}}
async function gemini(parts,tag,opt={}){
  const st=DB.settings,key=(st.key||'').trim();if(!key)throw new Error('nokey');
  const model=(st.model||DEFAULT_MODEL).trim();
  const url=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
  const body={contents:[{role:'user',parts}],generationConfig:Object.assign({temperature:0,responseMimeType:'application/json'},opt.config||{})};
  let last='';
  for(let i=0;i<3;i++){
    let r;try{r=await post(url,body,opt.timeout||40000);}catch(e){last=e.name==='AbortError'?'응답이 너무 늦어요':'인터넷 연결을 확인해 주세요';await sleep(800);continue;}
    if(r.ok){const j=await r.json();logUsage(tag,j.usageMetadata);const c=j.candidates?.[0]||{};
      const text=(c.content?.parts||[]).filter(p=>!p.thought).map(p=>p.text||'').join('');return text;}
    const t=await r.text();let m=t;try{m=JSON.parse(t).error?.message||t;}catch(e){}
    if(/API key not valid|API_KEY_INVALID/i.test(m))throw new Error('API 키를 확인해 주세요');
    if(r.status===404)throw new Error('모델 이름을 확인해 주세요: '+model);
    if(r.status===429)throw new Error('사용 한도를 넘었어요. 잠시 후 다시 해주세요');
    last=m;if(r.status>=500){await sleep(1200);continue;}break;}
  throw new Error(last||'제미나이 오류');}
function parseJSON(t){t=String(t||'').trim().replace(/^```(?:json)?/i,'').replace(/```$/,'').trim();try{return JSON.parse(t);}catch(e){}
  const a=t.indexOf('{'),b=t.lastIndexOf('}'),c=t.indexOf('['),d=t.lastIndexOf(']');
  try{if(c>=0&&(a<0||c<a))return JSON.parse(t.slice(c,d+1));return JSON.parse(t.slice(a,b+1));}catch(e){return null;}}
const errMsg=e=>e&&e.message==='nokey'?'설정에서 Gemini API 키를 넣어주세요 (링크 칸을 오른쪽으로 밀기)':(e&&e.message)||'오류가 났어요';

/* ---------- 유튜브 플레이어 ---------- */
const PRE=0.3,POST=0.4;   // 구간 앞뒤 여유(초)
let YTP=null,ytReady=false,curVid='',playMon=null,PLAY=null,ytQueue=null;
function ytInit(){if(YTP||!window.YT||!YT.Player)return;
  YTP=new YT.Player('player',{width:'100%',height:'100%',playerVars:{playsinline:1,controls:0,disablekb:1,rel:0,iv_load_policy:3,fs:0,cc_load_policy:0,modestbranding:1,origin:location.origin},
    events:{onReady:()=>{ytReady=true;$('#noVideo').classList.add('hidden');if(ytQueue){const q=ytQueue;ytQueue=null;q();}},
      onStateChange:e=>{if(e.data===YT.PlayerState.PLAYING){fillTitle();}}}});}
window.onYouTubeIframeAPIReady=ytInit;
function whenYT(fn){if(ytReady&&YTP)return fn();ytQueue=fn;ytInit();}
function fillTitle(){try{const d=YTP.getVideoData();const c=DB.clips.find(c=>c.vid===d.video_id);if(c&&d.title&&(!c.title||c.title===c.vid)){c.title=d.title;save();renderClips();}}catch(e){}}
function stopMon(){clearInterval(playMon);playMon=null;PLAY=null;}
function nearRate(r){try{const av=YTP.getAvailablePlaybackRates();if(!av||!av.length)return r;
  if(av.length>8)return r;return av.reduce((a,b)=>Math.abs(b-r)<Math.abs(a-r)?b:a);}catch(e){return r;}}
/* 구간 재생: start~end 재생 후 멈춤 */
function playRange(vid,start,end,speed,onEnd){
  whenYT(()=>{stopMon();const rate=nearRate(speed/100);
    const go=()=>{try{YTP.setPlaybackRate(rate);}catch(e){}try{YTP.seekTo(Math.max(0,start),true);YTP.playVideo();}catch(e){}
      PLAY={start,end,onEnd,armed:false,t0:Date.now()};playMon=setInterval(()=>{if(!PLAY)return;let t=0,st=-1;try{t=YTP.getCurrentTime();st=YTP.getPlayerState();}catch(e){}
        /* 이동 직후엔 이전 위치가 잠깐 남아 있어서, 새 구간 안에서 실제로 재생 중일 때부터만 끝을 잼 */
        if(!PLAY.armed){if(st===1&&t>=PLAY.start-0.6&&t<PLAY.end)PLAY.armed=true;else{if(Date.now()-PLAY.t0>4000&&st!==1){try{YTP.seekTo(Math.max(0,start),true);YTP.playVideo();}catch(e){}PLAY.t0=Date.now();}return;}}
        if(t>=PLAY.end){try{YTP.pauseVideo();}catch(e){}const f=PLAY.onEnd;stopMon();f&&f();}},30);};
    if(curVid!==vid){curVid=vid;try{YTP.loadVideoById({videoId:vid,startSeconds:Math.max(0,start)});}catch(e){}setTimeout(go,350);}else go();});}
function preview(vid){whenYT(()=>{stopMon();try{YTP.setPlaybackRate(1);}catch(e){}let st=-1;try{st=YTP.getPlayerState();}catch(e){}
  if(curVid!==vid){curVid=vid;YTP.loadVideoById({videoId:vid});}
  else if(st===1){YTP.pauseVideo();}            /* 재생 중이면 탭으로 멈춤 */
  else{if(st===0)YTP.seekTo(0,true);YTP.playVideo();}});}
function pausePlayer(){stopMon();try{YTP&&YTP.pauseVideo();}catch(e){}}
/* 탭마다 영상 대기 위치가 다름: 쉐도잉=지금 문장, 스크립트=가운데 문장, 클립=미리보기 멈춘 곳(없으면 처음) */
let CLIPPOS={vid:'',t:0};
function standby(vid,t){whenYT(()=>{stopMon();t=Math.max(0,t||0);let st=-1;try{st=YTP.getPlayerState();}catch(e){}
  if(curVid!==vid||st===5||st===-1){curVid=vid;try{YTP.cueVideoById({videoId:vid,startSeconds:t});}catch(e){}return;}
  try{YTP.pauseVideo();YTP.seekTo(t,true);}catch(e){}});}
function standbyFor(tab){const c=learning();
  if(tab==='pShadow'&&c&&c.sents)standby(c.vid,rangeOf(c,Math.min(c.lastIdx||0,c.sents.length-1))[0]);
  else if(tab==='pScript'&&c&&c.sents)standby(c.vid,rangeOf(c,Math.min(c.scIdx||0,c.sents.length-1))[0]);
  else if(tab==='pClip'){if(CLIPPOS.vid)standby(CLIPPOS.vid,CLIPPOS.t);else if(c)standby(c.vid,0);}}
function cueLearning(){standbyFor(DB.ui.tab);}

/* ---------- 탭·접기·로고 ---------- */
function setTab(t,sound){if(sound&&DB.ui.tab!==t)SFX.ding();
  if(DB.ui.tab==='pClip'&&t!=='pClip'&&curVid&&YTP){try{CLIPPOS={vid:curVid,t:YTP.getCurrentTime()||0};}catch(e){}}
  const changed=DB.ui.tab!==t;DB.ui.tab=t;save();
  $$('.page').forEach(p=>p.classList.toggle('on',p.id===t));$$('.tab').forEach(b=>b.classList.toggle('on',b.dataset.t===t));
  closeWord(true);
  if(t==='pShadow')renderShadow(!!sound);
  if(t==='pScript')renderDrum();
  if(t==='pClip')renderClips();
  if(changed||!sound)standbyFor(t);
  if(t==='pVocab')renderVocab();
  requestAnimationFrame(layout);}
$$('.tab').forEach(b=>b.onclick=()=>setTab(b.dataset.t,true));
function setFold(f){document.body.classList.toggle('folded',f);DB.ui.folded=f;save();setTimeout(layout,270);}
$('#fold').onclick=()=>{SFX.tok();setFold(!DB.ui.folded);};
(()=>{const L=$('#logo');const on=()=>L.classList.add('on'),off=()=>L.classList.remove('on');
  L.addEventListener('pointerdown',on);['pointerup','pointercancel','pointerleave'].forEach(e=>L.addEventListener(e,off));})();
function layout(){
  // 쉐도잉: 도장은 속도계와 녹음 버튼 사이 가운데, 접으면 버튼도 비율 맞춰 위로
  const vh=Math.min(window.innerWidth*0.5625,292);
  document.documentElement.style.setProperty('--micUp',Math.round(24+vh*0.45)+'px');
  const page=$('#pShadow');if(page.classList.contains('on')){const spd=$('#pShadow .spd'),mw=$('.micwrap');
    const a=spd.offsetTop+spd.offsetHeight,b=page.clientHeight-parseFloat(getComputedStyle(mw).bottom)-92;$('.stampzone').style.top=Math.round((a+b)/2-50)+'px';}
  if($('#pClip').classList.contains('on'))fillEmptyRows();
  if($('#pScript').classList.contains('on'))drumPads();
  if($('#pVocab').classList.contains('on'))movePill();}
window.addEventListener('resize',()=>layout());

/* ---------- 제스처: 탭 / 꾹 / 좌우 밀기 ---------- */
function gesture(el,h){let st=null;
  el.addEventListener('pointerdown',e=>{if(e.button>0)return;st={x:e.clientX,y:e.clientY,t:Date.now(),id:e.pointerId,mode:'',long:false,tm:null};
    if(h.long)st.tm=setTimeout(()=>{if(st&&!st.mode){st.long=true;h.long(e);}},500);h.down&&h.down(e);});
  el.addEventListener('pointermove',e=>{if(!st||e.pointerId!==st.id)return;const dx=e.clientX-st.x,dy=e.clientY-st.y;
    if(!st.mode){const ax=Math.abs(dx),ay=Math.abs(dy);
      if(ax>10&&ax>ay*1.2&&h.swipe&&!st.long){st.mode='h';clearTimeout(st.tm);try{el.setPointerCapture(e.pointerId);}catch(_){}}
      else if((ay>8&&ay>=ax)||(ax>10&&!h.swipe)){st.mode='v';clearTimeout(st.tm);h.cancel&&h.cancel();}}
    if(st.mode==='h'){h.move&&h.move(dx);}});
  const end=(e,cancel)=>{if(!st||e.pointerId!==st.id)return;clearTimeout(st.tm);const dx=e.clientX-st.x;
    if(st.mode==='h'){h.swipe(cancel?0:dx);}else if(!st.mode&&!st.long&&!cancel&&Date.now()-st.t<450){h.tap&&h.tap(e);}else if(st.long){h.longEnd&&h.longEnd(e);}else{h.cancel&&h.cancel();}
    st=null;};
  el.addEventListener('pointerup',e=>end(e,false));el.addEventListener('pointercancel',e=>end(e,true));}

/* ---------- 확인창 ---------- */
function dialog(html,btns){const d=$('#dlg');$('#dlgText').innerHTML=html;const box=$('#dlgBtns');box.innerHTML='';
  btns.forEach(b=>{const x=document.createElement('button');x.textContent=b.label;if(b.pri)x.className='pri';x.onclick=()=>{SFX.tok();d.classList.add('hidden');b.fn&&b.fn();};box.appendChild(x);});
  d.classList.remove('hidden');}
$('#dlg').addEventListener('click',e=>{if(e.target.id==='dlg')$('#dlg').classList.add('hidden');});

/* ---------- ① 클립 ---------- */
function vidOf(u){u=String(u||'').trim();let m=u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);if(m)return m[1];
  if(/^[A-Za-z0-9_-]{11}$/.test(u))return u;return '';}
async function fetchTitle(vid){const w='https://www.youtube.com/watch?v='+vid;
  for(const u of ['https://www.youtube.com/oembed?format=json&url='+encodeURIComponent(w),'https://noembed.com/embed?url='+encodeURIComponent(w)]){
    try{const r=await fetch(u);if(r.ok){const j=await r.json();if(j.title)return j.title;}}catch(e){}}return '';}
async function addLink(){const inp=$('#linkIn');const vid=vidOf(inp.value);
  if(!vid){toast('유튜브 링크를 확인해 주세요');return;}
  inp.value='';inp.blur();
  if(DB.clips.some(c=>c.vid===vid)){toast('이미 있는 클립이에요');return;}
  const c={id:'c'+Date.now().toString(36),vid,title:'',added:Date.now(),sents:null,lastIdx:0,scIdx:0};DB.clips.push(c);
  if(!DB.learningId)DB.learningId=c.id;save();renderClips();
  const t=await fetchTitle(vid);if(t){c.title=t;save();renderClips();}}
$('#addBtn').onclick=()=>{SFX.tok();addLink();};
$('#linkIn').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();addLink();}});
/* 링크 칸 오른쪽 밀기 → 설정 */
(()=>{const p=$('#paste');gesture(p,{swipe:dx=>{p.style.transition='transform .2s';p.style.transform='';setTimeout(()=>p.style.transition='',220);if(dx>70)openSettings();},
  move:dx=>{p.style.transform=`translateX(${Math.max(0,Math.min(dx,120))*0.6}px)`;}});})();

function clipMeta(c){if(c.busy)return esc(c.busy);if(!c.sents)return '스크립트 없음';
  const n=c.sents.length;return `${n}문장`+(c.lastIdx>0?` · 마지막 ${c.lastIdx+1}번`:'')+(c.noKo?' · 해석 없음':'');}
function sortedClips(){const L=DB.learningId;return [...DB.clips].sort((a,b)=>(b.id===L)-(a.id===L)||b.added-a.added);}
function renderClips(){OPEN=null;const box=$('#clipList');const list=sortedClips();
  if(!list.length){box.innerHTML='<div class="cempty">유튜브 링크를 붙여넣고 <b>추가</b>를 눌러주세요.<br>쇼츠 링크도 돼요.</div>';return;}
  box.innerHTML=list.map(c=>`<div class="clip${c.id===DB.learningId?' learning':''}" data-id="${c.id}">
    <div class="under del">삭제</div><div class="under load">스크립트 불러오기</div>
    <div class="face"><div class="thumb" style="background-image:url(https://i.ytimg.com/vi/${c.vid}/mqdefault.jpg)"></div>
    <div class="cinfo"><div class="ct">${esc(c.title||'제목 불러오는 중…')}</div><div class="cs">${clipMeta(c)}</div></div>${c.id===DB.learningId?'<div class="badge">학습 중</div>':''}</div></div>`).join('');
  $$('#clipList .clip[data-id]').forEach(bindClip);fillEmptyRows();}
function fillEmptyRows(){const box=$('#clipList');$$('#clipList .clip.empty').forEach(e=>e.remove());
  if(!DB.ui.folded||!DB.clips.length)return;const n=Math.ceil(box.clientHeight/62)-DB.clips.length;
  for(let i=0;i<n;i++){const e=document.createElement('div');e.className='clip empty';box.appendChild(e);}}
/* 밀면 버튼이 드러나고, 드러난 버튼을 탭해야 실행 (아이폰은 탭으로만 파일 창을 열어줌) */
let OPEN=null;
function closeOpen(){if(!OPEN)return;const {face,del,load}=OPEN;face.style.transition='transform .2s';face.style.transform='';setTimeout(()=>{del.style.opacity=0;load.style.opacity=0;},200);OPEN=null;}
function bindClip(el){const c=clipById(el.dataset.id),face=el.querySelector('.face'),del=el.querySelector('.del'),load=el.querySelector('.load');
  const me={el,face,del,load,dir:0,at:0};
  load.addEventListener('click',()=>{if(OPEN!==me||me.dir!==1||Date.now()-me.at<350)return;SFX.tok();closeOpen();pickScript(c);});
  del.addEventListener('click',()=>{if(OPEN!==me||me.dir!==-1||Date.now()-me.at<350)return;SFX.tok();closeOpen();dialog(`이 클립을 삭제할까요?<small>${esc(c.title||'')}</small>`,[{label:'취소'},{label:'삭제',pri:true,fn:()=>removeClip(c)}]);});
  gesture(el,{
    down:e=>{if(OPEN&&OPEN!==me)closeOpen();if(!e.target.closest('.under'))el.classList.add('pressed');},cancel:()=>el.classList.remove('pressed'),
    tap:e=>{el.classList.remove('pressed');if(e.target.closest('.under'))return;if(OPEN===me){closeOpen();return;}SFX.tok();preview(c.vid);},
    long:e=>{el.classList.remove('pressed');if(OPEN)return;SFX.click();
      if(!c.sents){dialog(`스크립트를 먼저 불러와 주세요<small>${esc(c.title||'')}</small>`,[{label:'확인',pri:true}]);return;}
      if(c.id===DB.learningId){dialog(`이미 학습 중인 영상이에요<small>${esc(c.title||'')}</small>`,[{label:'확인',pri:true}]);return;}
      dialog(`이 영상으로 학습할까요?<small>${esc(c.title||'')}</small>`,[{label:'아니요'},{label:'네',pri:true,fn:()=>{DB.learningId=c.id;save();curVidCheck();renderClips();$('#clipList').scrollTop=0;}}]);},
    move:dx=>{el.classList.remove('pressed');const base=OPEN===me?(me.dir===1?160:-92):0;const x=base+dx;
      face.style.transition='';face.style.transform=`translateX(${x}px)`;del.style.opacity=x<0?1:0;load.style.opacity=x>0?1:0;},
    swipe:dx=>{me.at=Date.now();const base=OPEN===me?(me.dir===1?160:-92):0;const x=base+dx;face.style.transition='transform .2s';
      if(x>60){me.dir=1;OPEN=me;face.style.transform='translateX(160px)';load.style.opacity=1;del.style.opacity=0;SFX.tok();}
      else if(x<-50){me.dir=-1;OPEN=me;face.style.transform='translateX(-92px)';del.style.opacity=1;load.style.opacity=0;SFX.tok();}
      else{OPEN=me;closeOpen();}}});}
function curVidCheck(){/* 학습 클립이 바뀌면 다음 쉐도잉·스크립트 진입 때 그 영상으로 */}
function removeClip(c){DB.clips=DB.clips.filter(x=>x!==c);if(DB.learningId===c.id){const n=sortedClips().find(x=>x.sents)||DB.clips[0];DB.learningId=n?n.id:null;}save();renderClips();}

/* 스크립트 파일 불러오기 */
let pickFor=null;
function pickScript(c){pickFor=c;const f=$('#fileIn');f.value='';f.click();}
$('#fileIn').addEventListener('change',async e=>{const file=e.target.files&&e.target.files[0];const c=pickFor;pickFor=null;if(!file||!c)return;
  let j=null;try{j=JSON.parse(await file.text());}catch(err){}
  const ok=j&&j.goshe&&Array.isArray(j.sents)&&j.sents.length&&j.sents.every(x=>isFinite(x.start)&&isFinite(x.end)&&x.en);
  if(!ok){toast('PC에서 만든 .goshe.json 파일을 골라 주세요',2800);return;}
  const go=()=>loadScript(c,j);
  if(j.vid&&j.vid!==c.vid)dialog(`이 클립과 다른 영상의 파일이에요<small>${esc(j.title||'')}</small>`,[{label:'취소'},{label:'그래도 불러오기',pri:true,fn:go}]);else go();});
/* 구간 = Whisper가 잡은 실제 시작·끝 + 앞뒤 여유. 여유는 이웃 문장 안으로는 들어가지 않음 */
function rangeOf(c,i){const L=c.sents,s=L[i],p=L[i-1],n=L[i+1];
  const a=Math.max(p?p.end-0.05:0,s.start-PRE,0);const b=Math.min(n?n.start+0.05:1e9,s.end+POST);return [Math.min(a,s.start),Math.max(b,s.end)];}
async function loadScript(c,j){
  const sents=j.sents.map(x=>({start:+x.start,end:+x.end,en:String(x.en).trim(),ko:''}));
  if(j.title&&(!c.title||c.title===c.vid))c.title=j.title;
  const done=()=>{c.busy='';c.sents=sents;c.noKo=sents.every(s=>!s.ko);c.lastIdx=0;c.scIdx=0;if(!DB.learningId)DB.learningId=c.id;save();renderClips();};
  if(!DB.settings.key.trim()){done();toast('API 키가 없어서 해석 없이 불러왔어요',2800);return;}
  const CH=50;let failed=0;
  for(let pos=0;pos<sents.length;pos+=CH){c.busy=`해석 붙이는 중… ${Math.round(pos/sents.length*100)}%`;renderClips();
    const ch=sents.slice(pos,pos+CH);
    const prompt=`These are consecutive lines from an English video (often a dialogue). Translate each line into natural, conversational Korean, using the other lines as context.
Each line is "<number>: <text>". Return JSON only: {"ko":{"<number>":"<Korean>", ...}} with every number.

Lines:
${ch.map((s,k)=>`${pos+k}: ${s.en}`).join('\n')}`;
    try{const t=await gemini([{text:prompt}],'script',{timeout:90000});const m=(parseJSON(t)||{});const ko=m.ko||m;let n=0;
      ch.forEach((s,k)=>{const v=ko[pos+k]??ko[String(pos+k)];if(v){s.ko=String(v).trim();n++;}});if(!n)failed++;}
    catch(e){if(e.message==='nokey'||/키|모델|한도/.test(e.message||'')){done();toast(errMsg(e),3000);return;}failed++;}}
  done();toast(failed?`${sents.length}문장 불러왔어요 (일부는 해석 없이)`:`${sents.length}문장 불러왔어요`,2600);}

/* ---------- 판정: 축약형 같게 보기 ---------- */
const CONTR={"can't":['can','not'],"cannot":['can','not'],"won't":['will','not'],"shan't":['shall','not'],"ain't":['is','not'],"let's":['let','us'],
  "gonna":['going','to'],"wanna":['want','to'],"gotta":['got','to'],"kinda":['kind','of'],"sorta":['sort','of'],"lemme":['let','me'],"gimme":['give','me'],
  "y'all":['you','all'],"'cause":['because'],"cause":['because'],"cuz":['because'],"coz":['because'],"ok":['okay'],"alright":['all','right'],"ya":['you'],"yeah":['yes'],"yep":['yes'],"yup":['yes'],
  "outta":['out','of'],"dunno":['do','not','know'],"o'clock":['oclock'],"till":['until'],"til":['until'],"'til":['until']};
const ONES=['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
const TENS=['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];
function numWords(n){n=Math.floor(n);if(n<20)return [ONES[n]];if(n<100)return [TENS[Math.floor(n/10)]].concat(n%10?[ONES[n%10]]:[]);
  if(n<1000)return [ONES[Math.floor(n/100)],'hundred'].concat(n%100?numWords(n%100):[]);
  if(n<10000&&n%100!==0&&n>=1100&&n<2100){return numWords(Math.floor(n/100)).concat(numWords(n%100));}
  if(n<1000000)return numWords(Math.floor(n/1000)).concat(['thousand']).concat(n%1000?numWords(n%1000):[]);return [String(n)];}
function canon(word){let w=String(word).toLowerCase().replace(/[‘’`´]/g,"'").replace(/%/g,' percent ').replace(/&/g,' and ');
  w=w.replace(/[^a-z0-9'\- ]+/g,' ').replace(/-/g,' ').trim();if(!w)return [];
  const out=[];for(let t of w.split(/\s+/)){
    if(!CONTR[t])t=t.replace(/^'+|'+$/g,'');if(!t)continue;
    if(CONTR[t]){out.push(...CONTR[t]);continue;}
    if(/^\d+(st|nd|rd|th)?$/.test(t)){out.push(...numWords(parseInt(t,10)));continue;}
    let m;
    if((m=t.match(/^(.+)n't$/))){out.push(m[1]==='ca'?'can':m[1]==='wo'?'will':m[1],'not');continue;}
    if((m=t.match(/^(.+)'(m|re|ve|ll|d|s)$/))){out.push(m[1],{m:'am',re:'are',ve:'have',ll:'will',d:'~d',s:'~s'}[m[2]]);continue;}
    if((m=t.match(/^(.+)in'$/))){out.push(m[1]+'ing');continue;}
    out.push(t.replace(/'/g,''));}
  return out;}
const TEQ={'~d':['would','had','did'],'~s':['is','has','us','does']};
function teq(a,b){if(a===b)return true;if(TEQ[a]&&TEQ[a].includes(b))return true;if(TEQ[b]&&TEQ[b].includes(a))return true;return false;}
/* 정답 단어 중 이번에 말한 단어(순서 유지, LCS) */
function matchWords(words,said){const tt=[],owner=[];words.forEach((w,i)=>canon(w).forEach(t=>{tt.push(t);owner.push(i);}));
  const ss=canon(said);const n=tt.length,m=ss.length;const dp=Array.from({length:n+1},()=>new Uint16Array(m+1));
  for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)dp[i][j]=teq(tt[i],ss[j])?dp[i+1][j+1]+1:Math.max(dp[i+1][j],dp[i][j+1]);
  const hit=new Set();let i=0,j=0;while(i<n&&j<m){if(teq(tt[i],ss[j])){hit.add(i);i++;j++;}else if(dp[i+1][j]>=dp[i][j+1])i++;else j++;}
  const need=new Map();owner.forEach((o,k)=>{if(!need.has(o))need.set(o,[]);need.get(o).push(k);});
  const got=new Set();words.forEach((w,wi)=>{const ks=need.get(wi);if(!ks||ks.every(k=>hit.has(k)))got.add(wi);});return got;}

/* ---------- ② 쉐도잉 ---------- */
const SH={idx:0,listens:0,revealed:new Set(),done:false,phase:'idle',words:[]};   // phase: idle | rec | wait | done
const ICON={mic:'<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2"><rect x="9" y="3" width="6" height="11" rx="3" fill="#fff"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
  stop:'<svg width="28" height="28" viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" rx="2.5" fill="#fff"/></svg>',
  arrow:'<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  wait:'<span class="busy"></span><span class="busy"></span><span class="busy"></span>',
  cry:'<svg width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 26h8M36 26h8"/><path d="M24 40.5c2.7-3.6 5.3-3.6 8 0s5.3 3.6 8 0"/></svg>',
  speaker:'<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6"/><path d="M18.3 6.5a7.5 7.5 0 0 1 0 11"/></svg>'};
function setMic(k){const b=$('#micBtn');b.innerHTML=ICON[k];b.disabled=(k==='wait');}
function renderShadow(play){const c=learning();const msg=$('#shMsg');
  const show=on=>{['.top','.trz','#shSent','#pShadow .spd','.micwrap'].forEach(s=>$(s).style.visibility=on?'':'hidden');};
  if(!c||!c.sents||!c.sents.length){show(false);msg.innerHTML=!DB.clips.length?'클립 탭에서 유튜브 링크를 추가해 주세요':'클립 탭에서 스크립트를 불러오고<br>클립을 꾹 눌러 학습할 영상으로 정해 주세요';return;}
  show(true);msg.innerHTML='';SH.idx=Math.min(c.lastIdx||0,c.sents.length-1);enterSentence(false);}
function enterSentence(play){const c=learning();if(!c)return;const s=c.sents[SH.idx];
  killRec();SH.listens=0;SH.revealed=new Set();SH.done=false;SH.phase='idle';SH.words=s.en.split(/\s+/).filter(Boolean);
  closeWord(true);
  SH.words.forEach((w,i)=>{if(!canon(w).length||isName(c,w))SH.revealed.add(i);});
  const sent=$('#shSent');sent.className='sent'+(s.en.length>140?' s3':s.en.length>90?' s2':'');
  sent.innerHTML=SH.words.map((w,i)=>`<span class="w${SH.revealed.has(i)?' r':''}" data-i="${i}"><span class="t">${esc(w)}</span><span class="u"></span></span>`).join('');
  $('#shKo').textContent=s.ko||'';$('#shKo').classList.remove('on');
  $$('.dot').forEach(d=>d.classList.remove('f'));
  const st=$('#stamp');st.getAnimations().forEach(a=>a.cancel());st.style.opacity=0;
  $('#shCount').textContent=`${SH.idx+1} / ${c.sents.length}`;setMic('mic');drawListen();
  c.lastIdx=SH.idx;save();requestAnimationFrame(layout);
  }
const COMMON=new Set(('i im ive ill id a an the and but or so if then oh ah uh um hey hi yes yeah no not okay ok well wait look listen come go what whats where wheres who whos why how when which this that these those there theres here heres it its is are was were be been do does did dont doesnt didnt can cant could will wont would should you youre your we were our they theyre their he hes his she shes her him them me my mine us all just now right sure please thanks thank sorry god man dude guys good great fine alright all-right really very too also only even still never always maybe let lets get got have has had am to of in on at for with from by about up down out over off as like because cause').split(' '));
const nkey=w=>String(w).replace(/[‘’`´]/g,"'").replace(/'s$/i,'').replace(/[^A-Za-z'-]/g,'').toLowerCase().replace(/'/g,'');
function namesOf(c){if(c._names)return c._names;const N=new Set();
  c.sents.forEach(s=>{const ws=s.en.split(/\s+/);ws.forEach((w,i)=>{if(i===0)return;const prev=ws[i-1];if(/[.!?…]["'”’]*$/.test(prev))return;
    const bare=w.replace(/^[^A-Za-z]+/,'');if(!/^[A-Z][a-z]/.test(bare))return;const k=nkey(bare);if(k.length>1&&!COMMON.has(k))N.add(k);});});
  Object.defineProperty(c,'_names',{value:N,enumerable:false,configurable:true});return N;}
function isName(c,w){const b=String(w).replace(/^[^A-Za-z]+/,'');return /^[A-Z]/.test(b)&&namesOf(c).has(nkey(b));}
function playSentence(){const c=learning();if(!c)return;const s=c.sents[SH.idx];playRange(c.vid,...rangeOf(c,SH.idx),DB.speed.shadow);}
/* 듣기: 문장당 4번(들어갈 때 자동 재생도 1번). 원 3개는 1~3번째 듣기만 표시.
   3번 들을 때까지 다 맞히면 Complete, 4번째 듣고 맞혀도 Incomplete.
   4번 다 듣고 듣기를 또 누르면 = 정답 보기 → Incomplete. 문장이 끝나면 듣기 무제한. 말하기는 제한 없음 */
function drawListen(){$$('.dot').forEach((d,i)=>d.classList.toggle('f',i<Math.min(3,SH.listens)));const sad=!SH.done&&SH.listens>=4;$('#listenBtn').classList.toggle('sad',sad);$('#listenBtn').innerHTML=sad?ICON.cry:ICON.speaker;}
function listen(auto){if(SH.phase==='rec'||SH.phase==='wait')return;
  if(!SH.done&&SH.listens>=4){if(auto)return;SFX.tok();finishSentence(false);return;}
  if(!auto)SFX.tok();if(!SH.done)SH.listens++;drawListen();playSentence();}
$('#listenBtn').onclick=()=>listen(false);
function gotoSentence(d){const c=learning();if(!c||SH.phase==='rec'||SH.phase==='wait')return;const n=SH.idx+d;
  if(n<0){toast('첫 문장이에요');return;}if(n>=c.sents.length){toast('마지막 문장이에요');return;}SH.idx=n;enterSentence(false);}
/* 녹음 */
const canRecord=!!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia&&window.MediaRecorder);
const recMime=()=>{for(const m of ['audio/mp4','audio/webm;codecs=opus','audio/webm','audio/ogg'])try{if(MediaRecorder.isTypeSupported(m))return m;}catch(e){}return '';};
let REC=null;
function killRec(){const r=REC;REC=null;if(!r)return;r.dead=true;try{r.mr&&r.mr.state!=='inactive'&&r.mr.stop();}catch(e){}try{r.stream&&r.stream.getTracks().forEach(t=>t.stop());}catch(e){}if(MICOPEN)afterMic();}
async function hushForMic(){MICOPEN=true;pausePlayer();try{const as=navigator.audioSession;if(as)as.type='play-and-record';}catch(e){}
  try{if(AC&&AC.state==='running')await Promise.race([AC.suspend(),sleep(250)]);}catch(e){}}
function afterMic(){MICOPEN=false;ambient();rebuildAudio();}
async function startRec(){if(!canRecord){toast('이 브라우저는 녹음을 지원하지 않아요');return;}
  if(!DB.settings.key.trim()){toast(errMsg(new Error('nokey')),3000);return;}
  SFX.tok();await sleep(60);
  const r={chunks:[],dead:false};REC=r;SH.phase='rec';setMic('stop');
  await hushForMic();if(r.dead)return;
  try{r.stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});}
  catch(e){REC=null;SH.phase='idle';setMic('mic');afterMic();toast(e&&e.name==='NotAllowedError'?'마이크 권한을 허용해 주세요':'마이크를 열지 못했어요');return;}
  if(r.dead){try{r.stream.getTracks().forEach(t=>t.stop());}catch(e){}return;}
  const m=recMime();try{r.mr=new MediaRecorder(r.stream,m?{mimeType:m}:undefined);}catch(e){r.mr=new MediaRecorder(r.stream);}
  r.mime=(r.mr.mimeType||m||'audio/mp4').split(';')[0];r.mr.ondataavailable=e=>{if(e.data&&e.data.size)r.chunks.push(e.data);};r.mr.start();r.t0=Date.now();}
async function stopRec(){const r=REC;REC=null;if(!r)return;SH.phase='wait';setMic('wait');
  const blob=await new Promise(res=>{let done=false;const fin=()=>{if(done)return;done=true;res(new Blob(r.chunks,{type:r.mime||'audio/mp4'}));};
    if(!r.mr){fin();return;}r.mr.onstop=()=>setTimeout(fin,30);try{r.mr.state!=='inactive'?r.mr.stop():fin();}catch(e){fin();}setTimeout(fin,2500);});
  try{r.stream&&r.stream.getTracks().forEach(t=>t.stop());}catch(e){}
  afterMic();
  if(!blob.size||Date.now()-(r.t0||Date.now())<300){SH.phase='idle';setMic('mic');toast('너무 짧아요. 다시 말해 주세요');return;}
  let said='';
  try{const data=await b64(blob);
    const t=await gemini([{text:`This is a short recording of an English learner repeating one English sentence for shadowing practice.
Transcribe EXACTLY the English words you actually hear, verbatim, in order — including mistakes, wrong words, and partial attempts.
Do NOT correct anything, do NOT guess or fill in words that are not clearly spoken, do NOT complete the sentence.
If nothing intelligible is spoken, return an empty string.
Return JSON only: {"text":"..."}`},{inlineData:{mimeType:r.mime||'audio/mp4',data}}],'judge',{timeout:30000});
    const j=parseJSON(t);said=(j&&typeof j.text==='string')?j.text:(typeof t==='string'?t:'');}
  catch(e){SH.phase='idle';setMic('mic');toast(errMsg(e),2800);return;}
  judge(said);}
const b64=blob=>new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>res(String(fr.result).split(',')[1]||'');fr.onerror=rej;fr.readAsDataURL(blob);});
function revealWords(list){list.forEach((i,k)=>{const w=$(`#shSent .w[data-i="${i}"]`);if(!w||w.classList.contains('r'))return;const t=w.querySelector('.t'),u=w.querySelector('.u');
  t.animate([{opacity:0,transform:'translateY(9px)'},{opacity:1,transform:'translateY(0)'}],{duration:260,delay:k*50,easing:'cubic-bezier(.2,.8,.3,1)',fill:'forwards'});
  u.animate([{opacity:1},{opacity:0}],{duration:200,delay:k*50,fill:'forwards'});setTimeout(()=>w.classList.add('r'),k*50+270);});}
function judge(said){const got=matchWords(SH.words,said);const fresh=[...got].filter(i=>!SH.revealed.has(i)).sort((a,b)=>a-b);
  fresh.forEach(i=>SH.revealed.add(i));revealWords(fresh);
  const all=SH.revealed.size>=SH.words.length;
  // 듣기 3번 안에 다 맞히면 Complete (말하기는 몇 번이든), 4번째 듣기 뒤에 맞히면 Incomplete
  if(all){SH.phase='wait';const ok=SH.listens<=3;setTimeout(()=>finishSentence(ok),fresh.length*50+300);}
  else{SH.phase='idle';setMic('mic');}}
async function finishSentence(ok){if(SH.done)return;SH.done=true;SH.phase='done';drawListen();
  const rest=SH.words.map((_,i)=>i).filter(i=>!SH.revealed.has(i));rest.forEach(i=>SH.revealed.add(i));revealWords(rest);
  await sleep(rest.length*50+300);
  if($('#shKo').textContent)$('#shKo').classList.add('on');
  await sleep(350);
  const st=$('#stamp');st.textContent=ok?'Complete':'Incomplete';
  st.animate([{opacity:0,transform:'rotate(-30deg) scale(2.4)'},{opacity:.48,transform:'rotate(-30deg) scale(.92)',offset:.62},{opacity:.45,transform:'rotate(-30deg) scale(1.04)',offset:.82},{opacity:.44,transform:'rotate(-30deg) scale(1)'}],
    {duration:280,easing:'cubic-bezier(.55,0,.9,.45)',fill:'forwards'});
  setTimeout(()=>{ok?SFX.ok():SFX.ng();setMic('arrow');},175);
  const c=learning();if(c){c.res=c.res||{};c.res[SH.idx]=ok?1:0;save();}}
$('#micBtn').onclick=()=>{if(SH.phase==='idle')startRec();else if(SH.phase==='rec'){SFX.tok();stopRec();}else if(SH.phase==='done'){SFX.tok();gotoSentence(1);}};
/* 문장 영역: 탭 = 다시 듣기, 좌우 밀기 = 이전/다음, 단어 꾹 = 뜻 */
(()=>{const sh=$('#shad');let lw=null;
  gesture(sh,{
    long:e=>{const w=e.target.closest('#shSent .w');if(!w||!w.classList.contains('r')||SH.phase==='rec'||SH.phase==='wait')return;lw=w;openWord(+w.dataset.i);},
    swipe:dx=>{if(Math.abs(dx)>60)gotoSentence(dx<0?1:-1);},move:()=>{}});})();
/* 단어 뜻 팝업 */
let WP=null;
const CHECK='<svg width="20" height="20" viewBox="0 0 24 24"><path d="M4.5 12.5 L9.5 17.5 L19.5 6.5" fill="none" stroke="#1E9E6A" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100"/></svg>';
function hlRange(a,b){$$('#shSent .w').forEach(w=>{const i=+w.dataset.i;w.classList.toggle('hl',i>=a&&i<=b);});}
async function openWord(i){const c=learning();if(!c)return;SFX.click();pausePlayer();
  const word=SH.words[i].replace(/^[^A-Za-z0-9']+|[^A-Za-z0-9']+$/g,'');const tok={};WP=tok;hlRange(i,i);
  const pop=$('#wpop');pop.classList.remove('hidden');
  pop.innerHTML=`<div class="tx"><div class="ph">${esc(word)}</div><div class="mn ld">뜻 찾는 중…</div></div><button class="b c">닫기</button><button class="b s" disabled>저장</button>`;
  pop.querySelector('.c').onclick=()=>{SFX.tok();closeWord();};
  try{const sent=c.sents[SH.idx].en;const numbered=SH.words.map((w,k)=>`${k}:${w}`).join(' ');
    const t=await gemini([{text:`English sentence (words numbered from 0): ${numbered}
Full sentence: "${sent}"
The learner long-pressed word #${i} ("${SH.words[i]}").
If that word is part of an idiom, phrasal verb or fixed expression in THIS sentence, choose the whole expression; otherwise just that word.
Give the Korean meaning exactly as used in this sentence (short, under ~20 Korean characters, no explanation).
"phrase" must be the expression in dictionary form without surrounding punctuation (e.g. "pick up", "on my way out").
Return JSON only: {"start":<first word index>,"end":<last word index>,"phrase":"...","meaning":"..."}`}],'word',{timeout:20000});
    if(WP!==tok)return;const j=parseJSON(t)||{};let a=Number.isInteger(j.start)?j.start:i,b=Number.isInteger(j.end)?j.end:i;
    if(a>i||b<i||a<0||b>=SH.words.length){a=i;b=i;}
    tok.phrase=String(j.phrase||word).trim()||word;tok.meaning=String(j.meaning||'').trim();hlRange(a,b);
    pop.querySelector('.ph').innerHTML=esc(tok.phrase)+CHECK;const mn=pop.querySelector('.mn');mn.textContent=tok.meaning||'뜻을 못 찾았어요';mn.classList.remove('ld');
    const sv=pop.querySelector('.s');sv.disabled=!tok.meaning;sv.onclick=()=>saveWord(tok);}
  catch(e){if(WP!==tok)return;const mn=pop.querySelector('.mn');mn.textContent=errMsg(e);mn.classList.remove('ld');}}
async function saveWord(tok){if(WP!==tok||tok.saved)return;tok.saved=true;
  const en=tok.phrase,ko=tok.meaning;const ex=DB.vocab.find(v=>v.en.toLowerCase()===en.toLowerCase());
  if(ex){ex.ko=ko;ex.t=Date.now();}else DB.vocab.unshift({en,ko,t:Date.now()});save();
  const p=$('#wpop .ph path');if(p)await p.animate([{strokeDashoffset:100,offset:0,easing:'ease-in'},{strokeDashoffset:68,offset:.4,easing:'cubic-bezier(.3,0,.2,1)'},{strokeDashoffset:0,offset:1}],{duration:340,fill:'forwards'}).finished.catch(()=>{});
  await sleep(300);if(WP!==tok)return;
  const pop=$('#wpop');await pop.animate([{opacity:1,transform:'scale(1)'},{opacity:0,transform:'scale(.96)'}],{duration:200,easing:'ease-in'}).finished.catch(()=>{});closeWord(true);}
function closeWord(){WP=null;$('#wpop').classList.add('hidden');$('#wpop').innerHTML='';hlRange(-1,-1);}

/* ---------- 속도계 (탭별로 따로 기억) ---------- */
function drawSpeeds(){$$('.speed').forEach(s=>{s.querySelector('.v').textContent=DB.speed[s.dataset.k]+'%';});}
$$('.speed').forEach(s=>{const k=s.dataset.k;
  s.querySelector('.m').onclick=e=>{e.stopPropagation();SFX.tok();DB.speed[k]=Math.max(25,DB.speed[k]-15);save();drawSpeeds();liveRate(k);};
  s.querySelector('.p').onclick=e=>{e.stopPropagation();SFX.tok();DB.speed[k]=Math.min(200,DB.speed[k]+15);save();drawSpeeds();liveRate(k);};
  s.querySelector('.v').onclick=e=>{e.stopPropagation();SFX.tok();DB.speed[k]=100;save();drawSpeeds();liveRate(k);};});
function liveRate(k){if(PLAY&&YTP&&((k==='shadow'&&DB.ui.tab==='pShadow')||(k==='script'&&DB.ui.tab==='pScript'))){try{YTP.setPlaybackRate(nearRate(DB.speed[k]/100));}catch(e){}}}

/* ---------- ③ 스크립트 드럼 ---------- */
const DR={idx:0,lastCenter:-1,raf:0,user:false,settleT:null,prog:false};
function renderDrum(){const c=learning();const box=$('#drumIn'),msg=$('#scMsg');
  if(!c||!c.sents||!c.sents.length){box.innerHTML='';msg.innerHTML=!DB.clips.length?'클립 탭에서 유튜브 링크를 추가해 주세요':'클립 탭에서 스크립트를 불러오고<br>클립을 꾹 눌러 학습할 영상으로 정해 주세요';$('.ctrl').style.visibility='hidden';return;}
  msg.innerHTML='';$('.ctrl').style.visibility='';
  box.innerHTML='<div class="pad"></div>'+c.sents.map((s,i)=>`<p data-i="${i}">${esc(s.en)}</p>`).join('')+'<div class="pad"></div>';
  DR.idx=Math.min(c.scIdx||0,c.sents.length-1);DR.lastCenter=DR.idx;drumPads();scrollDrumTo(DR.idx,false);}
function drumPads(){const d=$('#drum');const h=d.clientHeight;$$('#drum .pad').forEach(p=>p.style.height=Math.max(0,h/2-12)+'px');shadeDrum();}
function scrollDrumTo(i,smooth){const d=$('#drum'),p=$(`#drum p[data-i="${i}"]`);if(!p)return;DR.prog=true;
  const top=p.offsetTop+p.offsetHeight/2-d.clientHeight/2;d.scrollTo({top,behavior:smooth?'smooth':'auto'});if(!smooth){shadeDrum();setTimeout(()=>DR.prog=false,50);}else setTimeout(()=>DR.prog=false,450);}
function centerIndex(){const d=$('#drum');const mid=d.scrollTop+d.clientHeight/2;const ps=$$('#drum p');let best=0,bd=1e9;
  const est=DR.lastCenter>=0?DR.lastCenter:0;const lo=Math.max(0,est-40),hi=Math.min(ps.length,est+40);
  for(let i=lo;i<hi;i++){const p=ps[i];const c=p.offsetTop+p.offsetHeight/2;const dd=Math.abs(c-mid);if(dd<bd){bd=dd;best=i;}}
  if(bd>200){for(let i=0;i<ps.length;i++){const p=ps[i];const dd=Math.abs(p.offsetTop+p.offsetHeight/2-mid);if(dd<bd){bd=dd;best=i;}}}return best;}
const OPS=[1,.72,.6,.5,.42,.36,.3,.26,.22];
function shadeDrum(){const d=$('#drum');const mid=d.scrollTop+d.clientHeight/2;const ci=centerIndex();const ps=$$('#drum p');
  for(let i=Math.max(0,ci-25);i<Math.min(ps.length,ci+26);i++){const p=ps[i];const c=p.offsetTop+p.offsetHeight/2;const dist=Math.abs(c-mid)/24;
    const k=Math.min(OPS.length-1,dist);const lo=Math.floor(k),fr=k-lo;const op=OPS[lo]+(OPS[Math.min(OPS.length-1,lo+1)]-OPS[lo])*fr;
    p.style.opacity=op.toFixed(3);p.style.transform=`scaleY(${Math.max(.62,1-dist*.04).toFixed(3)})`;}
  if(ci!==DR.lastCenter){DR.lastCenter=ci;SFX.tick();}}
$('#drum').addEventListener('scroll',()=>{if(!DR.raf)DR.raf=requestAnimationFrame(()=>{DR.raf=0;shadeDrum();});
  clearTimeout(DR.settleT);DR.settleT=setTimeout(()=>{if(DR.touch)return;if(DR.prog&&!DR.user)return;const ci=centerIndex();if(ci!==DR.idx){DR.idx=ci;const c=learning();if(c){c.scIdx=ci;save();}if(DR.user)playDrum();}DR.user=false;},160);},{passive:true});
$('#drum').addEventListener('touchstart',()=>{DR.user=true;DR.prog=false;DR.touch=true;},{passive:true});
$('#drum').addEventListener('touchend',()=>{DR.touch=false;$('#drum').dispatchEvent(new Event('scroll'));},{passive:true});
$('#drum').addEventListener('wheel',()=>{DR.user=true;},{passive:true});
function playDrum(){const c=learning();if(!c)return;const s=c.sents[DR.idx];playRange(c.vid,...rangeOf(c,DR.idx),DB.speed.script);}
function drumGo(i){const c=learning();if(!c)return;if(i<0){toast('첫 문장이에요');return;}if(i>=c.sents.length){toast('마지막 문장이에요');return;}
  DR.idx=i;c.scIdx=i;save();scrollDrumTo(i,true);playDrum();}
(()=>{let sx=0,sy=0,t0=0;const d=$('#drum');d.addEventListener('pointerdown',e=>{sx=e.clientX;sy=e.clientY;t0=Date.now();});
  d.addEventListener('pointerup',e=>{if(Math.abs(e.clientX-sx)<8&&Math.abs(e.clientY-sy)<8&&Date.now()-t0<400){drumGo(DR.idx+1);}});})();
$('#scPrev').onclick=()=>{SFX.tok();drumGo(DR.idx-1);};
$('#scAgain').onclick=()=>{SFX.tok();drumGo(DR.idx);};
$('#scNext').onclick=()=>{SFX.tok();drumGo(DR.idx+1);};

/* ---------- ④ 단어장 ---------- */
function movePill(){const t=$('#vToggle'),b=t.querySelector(`button[data-m="${DB.ui.vmode}"]`),p=t.querySelector('.pill');if(!b)return;
  p.style.left=b.offsetLeft+'px';p.style.width=b.offsetWidth+'px';t.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));}
$$('#vToggle button').forEach(b=>b.onclick=()=>{SFX.tok();DB.ui.vmode=b.dataset.m;save();movePill();applyVmode();});
function applyVmode(){const l=$('#vList');l.classList.toggle('m-en',DB.ui.vmode==='en');l.classList.toggle('m-ko',DB.ui.vmode==='ko');}
function renderVocab(){const q=$('#vSearch').value.trim().toLowerCase();const list=DB.vocab.filter(v=>!q||v.en.toLowerCase().includes(q)||v.ko.includes(q));
  $('#vCount').textContent=DB.vocab.length?DB.vocab.length+'개':'';
  const box=$('#vList');applyVmode();
  if(!DB.vocab.length){box.innerHTML='<div class="vempty">쉐도잉 탭에서 단어를 꾹 누르고<br><b>저장</b>하면 여기에 모여요</div>';return;}
  if(!list.length){box.innerHTML='<div class="vempty">찾는 단어가 없어요</div>';return;}
  box.innerHTML=list.map(v=>`<div class="v" data-en="${esc(v.en)}"><div class="under del">삭제</div><div class="face"><span class="en">${esc(v.en)}</span><span class="ko">${esc(v.ko)}</span></div></div>`).join('');
  $$('#vList .v').forEach(el=>{const face=el.querySelector('.face'),del=el.querySelector('.del');
    const peek=()=>el.classList.add('peek'),unpeek=()=>el.classList.remove('peek');
    el.addEventListener('pointerdown',peek);['pointerup','pointercancel','pointerleave'].forEach(t=>el.addEventListener(t,unpeek));
    gesture(el,{move:dx=>{dx=Math.min(0,dx);face.style.transition='';face.style.transform=`translateX(${dx}px)`;del.style.opacity=dx<0?1:0;},
      swipe:dx=>{face.style.transition='transform .2s';if(dx<-el.clientWidth*0.3){SFX.tok();face.style.transform='translateX(-100%)';setTimeout(()=>{DB.vocab=DB.vocab.filter(v=>v.en!==el.dataset.en);save();renderVocab();},200);}
        else{face.style.transform='';setTimeout(()=>del.style.opacity=0,200);}}});});}
$('#vSearch').addEventListener('input',renderVocab);

/* ---------- 설정 ---------- */
function usageHTML(){const U=DB.usage;const ks=Object.keys(USAGE_TAGS);const f=n=>(n||0).toLocaleString('ko-KR');
  const T={n:0,inp:0,out:0};ks.forEach(k=>{const r=U.rows[k];if(r)for(const x in T)T[x]+=r[x]||0;});
  const row=(name,r,cls)=>`<tr${cls?` class="${cls}"`:''}><td>${name}</td><td>${f(r&&r.n)}</td><td>${f(r&&r.inp)}</td><td>${f(r&&r.out)}</td></tr>`;
  return `<table class="usage"><tr><th>기능</th><th>호출</th><th>입력</th><th>출력</th></tr>${ks.map(k=>row(USAGE_TAGS[k],U.rows[k])).join('')}${row('합계',T,'tot')}</table>
  <div class="small" style="margin-top:6px">${new Date(U.since).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}부터</div>`;}
function openSettings(){SFX.tok();$('#sKey').value=DB.settings.key;$('#sModel').value=DB.settings.model;$('#usage').innerHTML=usageHTML();$('#sheet').classList.remove('hidden');}
function closeSettings(){$('#sheet').classList.add('hidden');}
$('#sheet').addEventListener('click',e=>{if(e.target.id==='sheet')closeSettings();});
(()=>{let y0=null;const g=$('.sheetin');g.addEventListener('touchstart',e=>{y0=g.scrollTop<=0?e.touches[0].clientY:null;},{passive:true});
  g.addEventListener('touchend',e=>{if(y0!==null&&e.changedTouches[0].clientY-y0>90)closeSettings();y0=null;});})();
$('#sKey').addEventListener('input',e=>{DB.settings.key=e.target.value.trim();save();});
$('#sYt').onclick=()=>{SFX.tok();window.open('https://accounts.google.com/ServiceLogin?service=youtube&continue='+encodeURIComponent('https://www.youtube.com/'),'_blank');};
$('#sModel').addEventListener('input',e=>{DB.settings.model=e.target.value.trim()||DEFAULT_MODEL;save();});
$('#sModel').addEventListener('blur',e=>{if(!e.target.value.trim())e.target.value=DEFAULT_MODEL;});
$('#sPaste').onclick=async()=>{SFX.tok();let t='';try{t=await navigator.clipboard.readText();}catch(e){}
  if(!t){toast('붙여넣기가 막혀 있어요. 칸을 길게 눌러 붙여넣어 주세요');$('#sKey').focus();return;}$('#sKey').value=t.trim();DB.settings.key=t.trim();save();toast('API 키를 넣었어요');};

/* ---------- 시작 ---------- */
$$('button').forEach(b=>b.setAttribute('type','button'));
document.addEventListener('dblclick',e=>e.preventDefault(),{passive:false});
document.addEventListener('gesturestart',e=>e.preventDefault());
document.addEventListener('contextmenu',e=>{if(!e.target.closest('input'))e.preventDefault();});
if(DB.learningId&&!clipById(DB.learningId))DB.learningId=null;
DB.clips.forEach(c=>{if(c.busy)c.busy='';});
drawSpeeds();setFold(!!DB.ui.folded);setTab(DB.ui.tab||'pClip',false);
if(window.YT&&YT.Player)ytInit();else{const iv=setInterval(()=>{if(window.YT&&YT.Player){clearInterval(iv);ytInit();}},300);setTimeout(()=>clearInterval(iv),20000);}
if(learning())setTimeout(cueLearning,600);
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
ambient();
