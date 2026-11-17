import { Renderer } from './renderer.js';
import { Vision, FaceTracker } from './vision.js';
import { pickMime, pickMimeFor, extFor, elementAudio, audioCtx, saveTake, loadTakes, deleteTake } from './media.js';
import { SCRIPTS } from './scripts.js';

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const fmtT=s=>{ s=Math.max(0,s||0); const m=Math.floor(s/60), x=Math.floor(s%60); return `${m}:${String(x).padStart(2,'0')}`; };
const toast=(m,ms=2600)=>{ const t=$('#toast'); t.textContent=m; t.hidden=false; clearTimeout(toast._t); toast._t=setTimeout(()=>t.hidden=true,ms); };
const store={ get(k,d){ try{ const v=localStorage.getItem('ns.'+k); return v==null?d:JSON.parse(v); }catch{ return d; } }, set(k,v){ try{ localStorage.setItem('ns.'+k,JSON.stringify(v)); }catch{} } };

// ---------- settings ----------
const ZERO={smooth:0,shine:0,underEye:0,bright:0,contrast:0,warmth:0,sat:0,glow:0,lipTint:0,gloss:0,lipFull:0,liner:0,whites:0,iris:0,lash:0,eyeSize:0,eyeLift:0,eyeOpen:0,brow:0,gaze:0,neck:0,jaw:0,level:0,persp:0};
const PRESETS=[
  {id:'off',name:'Off',sub:'No filters',bg:'#EEF2F2',v:{}},
  {id:'natural',name:'Natural',sub:'Just a little nicer',bg:'#FFEBDD',v:{smooth:.45,shine:.3,underEye:.3,bright:.1,contrast:.05,warmth:.1,sat:.05,glow:.1,whites:.2}},
  {id:'glow',name:'Glow',sub:'Soft & radiant',bg:'#FFE0D2',v:{smooth:.6,underEye:.45,bright:.2,warmth:.15,sat:.1,glow:.55,whites:.3,iris:.2,gloss:.3}},
  {id:'warm',name:'Warm',sub:'Golden hour',bg:'#FFD8BE',v:{smooth:.45,underEye:.3,bright:.12,contrast:.1,warmth:.55,sat:.15,glow:.2}},
  {id:'studio',name:'Studio',sub:'Crisp & clean',bg:'#DDF3F1',v:{smooth:.5,shine:.5,underEye:.4,bright:.15,contrast:.25,warmth:.05,sat:.1,glow:.15,whites:.3,iris:.25,brow:.2,lash:.15,gaze:.4}},
  {id:'softglam',name:'Soft Glam',sub:'Rose lip, bright eyes',bg:'#FCD3D9',v:{smooth:.6,shine:.5,underEye:.55,bright:.15,contrast:.1,warmth:.2,sat:.1,glow:.35,lipTint:.45,lipColor:'#D2667A',gloss:.45,lipFull:.2,liner:.25,whites:.4,iris:.35,lash:.35,eyeSize:.15,eyeLift:.15,brow:.3,neck:.8,jaw:.2,level:.7,persp:.3,gaze:.75,eyeOpen:.45}},
  {id:'glam',name:'Glam',sub:'Berry lip, full lash',bg:'#F2C6D6',v:{smooth:.7,shine:.6,underEye:.65,bright:.15,contrast:.2,warmth:.15,sat:.15,glow:.3,lipTint:.55,lipColor:'#8E2A4F',gloss:.55,lipFull:.3,liner:.5,whites:.55,iris:.55,lash:.65,eyeSize:.3,eyeLift:.3,brow:.55,neck:.9,jaw:.35,level:.8,persp:.4,gaze:.9,eyeOpen:.6}},
];
const DEF={...ZERO,...PRESETS[1].v,lipColor:'#D2667A',bgMode:'none',bgBlur:.6,bgColor:'#0E6E6B',preset:'natural'};
const S=Object.assign({},DEF,store.get('settings',{}));
const saveS=()=>store.set('settings',S);
const SL={
  skin:[['smooth','Skin smoothing',0,1],['underEye','Under-eye brighten',0,1],['shine','Shine & glare control',0,1],['bright','Brightness',-.5,1],['contrast','Contrast',-.5,1],['warmth','Warmth',-1,1],['sat','Color boost',-1,1],['glow','Soft glow',0,1]],
  lips:[['lipTint','Lip color',0,1],['gloss','Gloss & shine',0,1],['lipFull','Lip fullness',0,1],['liner','Lip liner',0,1]],
  eyes:[['whites','Brighten eye whites',0,1],['iris','Iris pop',0,1],['lash','Lash & liner',0,1],['underEye','Dark-circle smoothing',0,1],['eyeOpen','Open eyes wider',0,1],['eyeSize','Eye enlarge',0,1],['eyeLift','Eye lift',0,1],['brow','Brow definition',0,1],['gaze','Eye contact (look at lens)',0,1]],
  sculpt:[['neck','Neck slimming (up to 30% narrower)',0,1],['jaw','Jawline & chin contour',0,1],['level','Auto-level head tilt',0,1],['persp','Higher camera angle',0,1]],
  bg:[['bgBlur','Blur strength',0,1]],
};
const LIPS=[['Nude','#C98B7A'],['Rose','#D2667A'],['Berry','#8E2A4F'],['Coral','#F06A5A'],['Red','#C8102E']];
const sliderEls={};
function buildSliders(host,list){ for(const [k,label,min,max] of list){
  const w=document.createElement('div'); w.className='slider';
  w.innerHTML=`<label for="s_${k}_${host.id}">${label}</label><output></output><input id="s_${k}_${host.id}" type="range" min="${min}" max="${max}" step="0.01">`;
  const inp=w.querySelector('input'), out=w.querySelector('output');
  inp.addEventListener('input',()=>{ S[k]=+inp.value; S.preset='custom'; syncUI(); saveS(); });
  (sliderEls[k]=sliderEls[k]||[]).push({inp,out}); host.appendChild(w); } }
buildSliders($('#skinSliders'),SL.skin); buildSliders($('#lipSliders'),SL.lips); buildSliders($('#eyeSliders'),SL.eyes); buildSliders($('#bgSliders'),SL.bg); buildSliders($('#sculptSliders'),SL.sculpt);
for(const [n,c] of LIPS){ const b=document.createElement('button'); b.className='sw'; b.style.background=c; b.textContent=n; b.dataset.c=c;
  b.onclick=()=>{ S.lipColor=c; if(S.lipTint<.2) S.lipTint=.5; S.preset='custom'; syncUI(); saveS(); }; $('#lipSwatches').appendChild(b); }
{ const pick=document.createElement('input'); pick.type='color'; pick.id='lipPick'; pick.title='Any lip color'; pick.oninput=()=>{ S.lipColor=pick.value; if(S.lipTint<.2) S.lipTint=.5; S.preset='custom'; syncUI(); saveS(); }; $('#lipSwatches').appendChild(pick); }
for(const p of PRESETS){ const b=document.createElement('button'); b.className='preset'; b.dataset.id=p.id; b.style.background=p.bg; b.innerHTML=`${p.name}<small>${p.sub}</small>`;
  b.onclick=()=>{ Object.assign(S,ZERO,p.v); if(!p.v.lipColor) S.lipColor=S.lipColor||'#D2667A'; S.preset=p.id; syncUI(); saveS(); }; $('#presets').appendChild(b); }
const BGC=['#0E6E6B','#FFD8BE','#FF6F61','#F7F1E8','#1E2B4A'];
for(const c of BGC){ const b=document.createElement('button'); b.className='sw'; b.style.background=c; b.dataset.c=c; b.setAttribute('aria-label','Background '+c); b.onclick=()=>{ S.bgColor=c; syncUI(); saveS(); }; $('#bgSwatches').appendChild(b); }
$('#bgColor').oninput=e=>{ S.bgColor=e.target.value; syncUI(); saveS(); };
// built-in backgrounds generated on the fly (original, no stock)
function genBg(kind){ const c=document.createElement('canvas'); c.width=540; c.height=960; const g=c.getContext('2d');
  if(kind==='sunrise'){ const gr=g.createLinearGradient(0,0,0,960); gr.addColorStop(0,'#FFB59E'); gr.addColorStop(.55,'#FFD8BE'); gr.addColorStop(1,'#14A3A0'); g.fillStyle=gr; g.fillRect(0,0,540,960);
    const r=g.createRadialGradient(270,520,10,270,520,260); r.addColorStop(0,'rgba(255,255,240,.95)'); r.addColorStop(1,'rgba(255,220,190,0)'); g.fillStyle=r; g.fillRect(0,0,540,960); }
  else if(kind==='teal'){ const gr=g.createLinearGradient(0,0,540,960); gr.addColorStop(0,'#0A4E4C'); gr.addColorStop(1,'#14A3A0'); g.fillStyle=gr; g.fillRect(0,0,540,960);
    for(let i=0;i<40;i++){ g.fillStyle=`rgba(255,216,190,${Math.random()*.25})`; g.beginPath(); g.arc(Math.random()*540,Math.random()*960,10+Math.random()*60,0,7); g.fill(); } }
  else { const gr=g.createLinearGradient(0,0,0,960); gr.addColorStop(0,'#FFF6EE'); gr.addColorStop(1,'#FFD8BE'); g.fillStyle=gr; g.fillRect(0,0,540,960);
    g.fillStyle='rgba(255,111,97,.12)'; for(let y=0;y<960;y+=60){ g.fillRect(0,y,540,26); } }
  return c; }
const bgThumbs=[['sunrise','Sunrise'],['teal','Teal bokeh'],['cream','Cream']];
let bgImgSel=store.get('bgImg','sunrise');
for(const [k,n] of bgThumbs){ const cv=genBg(k); const b=document.createElement('button'); b.className='sw img'; b.dataset.k=k; b.title=n; b.setAttribute('aria-label',n); b.style.backgroundImage=`url(${cv.toDataURL()})`;
  b.onclick=()=>{ bgImgSel=k; renderer&&renderer.setBackgroundImage(cv); store.set('bgImg',k); syncUI(); }; b._cv=cv; $('#bgImgs').appendChild(b); }
$('#bgFile').onchange=e=>{ const f=e.target.files[0]; if(!f) return; const img=new Image(); img.onload=()=>{ renderer.setBackgroundImage(img); bgImgSel='upload'; syncUI(); }; img.src=URL.createObjectURL(f); };
$$('#bgModes button').forEach(b=>b.onclick=()=>{ S.bgMode=b.dataset.bg; saveS(); syncUI(); });

function syncUI(){
  for(const k in sliderEls) for(const {inp,out} of sliderEls[k]){ inp.value=S[k]; const v=S[k]; out.textContent=(SL.skin.find(x=>x[0]===k)&&SL.skin.find(x=>x[0]===k)[2]<0)?(v>0?'+':'')+Math.round(v*100):Math.round(v*100)+'%'; }
  $$('.preset').forEach(b=>b.classList.toggle('on',b.dataset.id===S.preset));
  $$('#lipSwatches .sw').forEach(b=>b.classList.toggle('on',b.dataset.c.toLowerCase()===S.lipColor.toLowerCase()));
  const lp=$('#lipPick'); if(lp) lp.value=S.lipColor;
  $$('#bgModes button').forEach(b=>b.classList.toggle('on',b.dataset.bg===S.bgMode));
  $('#bgColorRow').hidden=S.bgMode!=='color'; $('#bgImgRow').hidden=S.bgMode!=='image'; $('#bgSliders').hidden=S.bgMode!=='blur';
  $$('#bgSwatches .sw').forEach(b=>b.classList.toggle('on',b.dataset.c===S.bgColor)); $('#bgColor').value=S.bgColor;
  $$('#bgImgs .sw').forEach(b=>b.classList.toggle('on',b.dataset.k===bgImgSel));
}

// ---------- tabs & modes ----------
$$('.tab').forEach(t=>t.onclick=()=>showTab(t.dataset.tab));
function showTab(id){ $$('.tab').forEach(t=>t.classList.toggle('on',t.dataset.tab===id)); $$('.panel').forEach(p=>p.classList.toggle('on',p.dataset.panel===id)); }
let mode='record';
$$('.mode').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
function setMode(m){ if(recording||exporting) return toast('Finish the current recording/export first');
  if(m==='upload'&&!renderer) return toast('Enhancing videos needs WebGL2, which this browser doesn’t offer.',4000);
  mode=m; $$('.mode').forEach(b=>b.classList.toggle('on',b.dataset.mode===m));
  const takes=m==='takes'; $('#takesView').hidden=!takes; $('.tabs').hidden=takes; $('.panels').hidden=takes;
  $('#recControls').hidden=m!=='record'; $('#upControls').hidden=m!=='upload'||!upVid.src;
  $('#placeholder').hidden=!(m==='record'&&!camStream)&&!(m==='takes'&&!camStream);
  $('#uploadPh').hidden=!(m==='upload'&&!upVid.src);
  $('#scriptTab').hidden=m==='upload'; $('#exportTab').hidden=m!=='upload';
  if(m==='upload'){ if(!$('.tab.on')||$('.tab.on').hidden) showTab('looks'); stopPrompter(); $('#prompter').hidden=true; $('#view').classList.remove('mirror'); if(upVid.src) setOutputForVideo(); }
  if(m==='record'){ upVid.pause(); if($('#exportTab').classList.contains('on')) showTab('looks'); applyMirror(); applyRecordSize(); $('#prompter').hidden=!prompterOn; }
  if(takes) renderTakes();
  tracker.reset();
}

// ---------- renderer & vision ----------
const canvas=$('#view'); let renderer;
try{ renderer=new Renderer(canvas); }catch(e){ console.error('WebGL renderer unavailable',e); renderer=null; }
const bgSel=$$('#bgImgs .sw').find(b=>b.dataset.k===bgImgSel)||$$('#bgImgs .sw')[0]; renderer&&renderer.setBackgroundImage(bgSel._cv);
const vision=new Vision(); const tracker=new FaceTracker();
const chip=$('#aiChip');
const visionNote=st=>{ if(rawMode) return; chip.hidden=false; chip.textContent=st==='ready'?'✨ Face & background AI on':st==='partial'?'AI partly loaded':'Face tracking didn’t load – basic filters only'; chip.classList.toggle('ok',st==='ready'); setTimeout(()=>{ if(!rawMode) chip.hidden=true; },st==='ready'?4000:8000); };
Promise.race([vision.load(), new Promise((_,rej)=>setTimeout(()=>rej(new Error('face tracking timed out')),30000))])
  .then(visionNote).catch(e=>{ console.warn('vision unavailable',e); if(vision.status==='loading') vision.status='failed'; visionNote('failed'); });

// ---------- camera ----------
const camVid=$('#camVid'); camVid.playsInline=true; camVid.muted=true; camVid.autoplay=true; camVid.setAttribute('playsinline',''); camVid.setAttribute('muted','');
const upVid=document.createElement('video'); upVid.playsInline=true; upVid.setAttribute('playsinline',''); upVid.loop=true; upVid.preload='auto';
const expVid=document.createElement('video'); expVid.playsInline=true; expVid.setAttribute('playsinline','');
{ const hold=document.createElement('div'); hold.style.cssText='position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none;overflow:hidden'; for(const v of [upVid,expVid]){ v.style.width='2px'; hold.appendChild(v); } document.body.appendChild(hold); }
let camStream=null, facing='user';
let aspect=store.get('aspect','9:16'), quality=store.get('quality',1080);
const mirrorEl=$('#mirror'); mirrorEl.checked=store.get('mirror',true);
const micNs=$('#micNs'); micNs.checked=store.get('micNs',true);
function applyMirror(){ const m=mode==='record'&&facing==='user'&&mirrorEl.checked; canvas.classList.toggle('mirror',m); camVid.classList.toggle('mirror',m); }
mirrorEl.onchange=()=>{ store.set('mirror',mirrorEl.checked); applyMirror(); };
micNs.onchange=()=>{ store.set('micNs',micNs.checked); if(camStream) startCamera(); };
function outDims(){ const long=quality==1080?1920:1280, short=quality==1080?1080:720; return aspect==='9:16'?[short,long]:[long,short]; }
function applyRecordSize(){ if(!renderer) return; const [w,h]=outDims(); renderer.setSize(w,h); $('#frame').style.aspectRatio=''; $('#frame').classList.toggle('wide',aspect==='16:9'); }
function segSet(id,val,cb){ $$(id+' button').forEach(b=>{ b.classList.toggle('on',b.dataset.v==String(val)); b.onclick=()=>{ $$(id+' button').forEach(x=>x.classList.toggle('on',x===b)); cb(b.dataset.v); }; }); }
segSet('#aspectSeg',aspect,v=>{ aspect=v; store.set('aspect',v); if(mode==='record') applyRecordSize(); tracker.reset(); });
segSet('#qualSeg',quality,v=>{ quality=+v; store.set('quality',quality); if(mode==='record') applyRecordSize(); else if(mode==='upload') setOutputForVideo(); });
// Plain-camera mode: if WebGL/filters can't run, show the raw camera instead of a black box.
let rawMode=false; const cmpBtnHide=()=>{ const c=document.querySelector('#compare'); if(c) c.hidden=true; };
function useRaw(why){ if(rawMode) return; rawMode=true; console.warn('plain camera mode:',why); canvas.hidden=true; camVid.hidden=false; cmpBtnHide();
  chip.hidden=false; chip.classList.remove('ok'); chip.textContent='Plain camera – filters unavailable on this device'; }
canvas.addEventListener('webglcontextlost',e=>{ e.preventDefault(); useRaw('WebGL context lost'); });
const isIOS=/iP(hone|ad|od)/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
function camError(e){
  const help=$('#camHelp'), btn=$('#startCam'), n=e&&e.name;
  let msg;
  if(n==='NotAllowedError'||n==='SecurityError') msg='Camera access was blocked.';
  else if(n==='NotReadableError'||n==='AbortError'||n==='TrackStartError') msg='Your camera is busy. Close other apps that use the camera (FaceTime, Instagram, another tab), then tap Retry.';
  else if(n==='NotFoundError'||n==='DevicesNotFoundError') msg='No camera was found on this device.';
  else if(n==='OverconstrainedError') msg='Your camera didn’t accept the requested settings. Tap Retry to use basic settings.';
  else msg='Couldn’t start the camera'+(e&&e.message?': '+e.message:'.');
  $('#phMsg').textContent=msg;
  help.innerHTML=isIOS?'iPhone: open <b>Settings › Safari › Camera</b> (and Microphone) and pick <b>Allow</b>, or tap <b>aA</b> in the address bar › Website Settings › Camera › Allow. Then tap Retry.'
    :'Click the camera icon in the address bar and choose <b>Allow</b> for camera and microphone, then tap Retry.';
  help.hidden=!(n==='NotAllowedError'||n==='SecurityError');
  btn.textContent='Retry'; btn.disabled=false; $('#placeholder').hidden=false;
}
async function getStream(){
  // Soft constraints only, stepping down until something works.
  const audio=micNs.checked?{echoCancellation:true,noiseSuppression:true,autoGainControl:true}:{echoCancellation:true,noiseSuppression:false,autoGainControl:true};
  const vids=[
    {facingMode:{ideal:facing},width:{ideal:1920},height:{ideal:1080},frameRate:{ideal:30}},
    {facingMode:{ideal:facing},width:{ideal:1280},height:{ideal:720}},
    {facingMode:{ideal:facing}},
    true];
  let last;
  for(const v of vids){
    try{ return await navigator.mediaDevices.getUserMedia({video:v,audio}); }
    catch(e){ last=e; if(e.name==='NotAllowedError'||e.name==='SecurityError') break; }
  }
  // Mic refused or broken? Still give them a picture.
  if(last&&last.name!=='NotAllowedError'){ try{ const st=await navigator.mediaDevices.getUserMedia({video:true}); toast('Microphone unavailable – recording without sound',4000); return st; }catch(e){ last=e; } }
  else if(last){ try{ const st=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:facing}}}); toast('Microphone blocked – recording without sound',4000); return st; }catch(e){ last=e; } }
  throw last;
}
let camBusy=false;
async function startCamera(){
  try{ audioCtx(); }catch{}  // unlock audio inside the tap (iOS)
  if(!window.isSecureContext||!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){ camError({name:'Insecure',message:'the camera only works on a secure https page in Safari or Chrome'}); return; }
  if(camBusy) return; camBusy=true;
  const btn=$('#startCam'); btn.disabled=true; btn.textContent='Starting camera…';
  try{
    if(camStream) camStream.getTracks().forEach(t=>t.stop());
    camStream=await getStream();
    camVid.srcObject=camStream;
    try{ await camVid.play(); }catch(e){ console.warn('play() rejected, retrying muted',e); camVid.muted=true; await camVid.play(); }
    if(!camVid.videoWidth) await new Promise(r=>{ const t=setTimeout(r,3000); camVid.onloadedmetadata=()=>{ clearTimeout(t); r(); }; });
    $('#placeholder').hidden=true; $('#camHelp').hidden=true; btn.textContent='Turn on camera'; btn.disabled=false;
    if(!renderer) useRaw('no WebGL2');
    applyMirror(); applyRecordSize(); tracker.reset(); blackChecks=0; firstFrameAt=performance.now();
    const vt=camStream.getVideoTracks()[0]; const st=vt&&vt.getSettings?vt.getSettings():{}; diag.cam=`${st.width||camVid.videoWidth}×${st.height||camVid.videoHeight}`;
  }catch(e){ console.error(e); camError(e); }
  finally{ camBusy=false; }
}
$('#startCam').onclick=startCamera;
$('#flipBtn').onclick=()=>{ if(recording) return; facing=facing==='user'?'environment':'user'; startCamera(); };

// ---------- render loop ----------
let blackChecks=99, firstFrameAt=0; const probe=document.createElement('canvas'); probe.width=probe.height=8;
function videoHasPicture(){ try{ const g=probe.getContext('2d',{willReadFrequently:true}); g.drawImage(camVid,0,0,8,8); const d=g.getImageData(0,0,8,8).data; let m=0; for(let i=0;i<d.length;i+=4) m=Math.max(m,d[i],d[i+1],d[i+2]); return m>20; }catch(e){ return true; } } let compare=false, lastVision=0, exporting=null, frames=0, fpsT=performance.now(), fps=0; const diag={};
const cmp=$('#compare');
const on=(v)=>()=>{ compare=v; cmp.textContent=v?'Before':'Hold: before'; };
cmp.addEventListener('pointerdown',on(true)); for(const ev of ['pointerup','pointerleave','pointercancel']) cmp.addEventListener(ev,on(false));
function currentSource(){
  if(exporting) return {el:exporting.el, w:exporting.el.videoWidth, h:exporting.el.videoHeight, pass:exporting.passthrough};
  if(mode==='upload') return upVid.readyState>=2?{el:upVid,w:upVid.videoWidth,h:upVid.videoHeight}:null;
  return camStream&&camVid.readyState>=2?{el:camVid,w:camVid.videoWidth,h:camVid.videoHeight}:null;
}
function needFace(){ return ['lipTint','gloss','lipFull','liner','whites','iris','lash','underEye','eyeSize','eyeLift','eyeOpen','brow','gaze','smooth','shine','neck','jaw','level'].some(k=>S[k]>0.001); }
function frame(){
  requestAnimationFrame(frame);
  const src=currentSource(); if(!src||!src.w) return; if(!renderer){ return; }
  const now=performance.now(); let face=null;
  if(!src.pass&&!compare){
    const minGap=quality==1080&&!exporting?28:16;
    if(now-lastVision>=minGap&&vision.status!=='loading'){
      lastVision=now;
      if(needFace()&&vision.face){ const lm=vision.detectFace(src.el); renderer.crop&&(face=tracker.update(lm,renderer.crop,...renderer.size,now)); }
      else face=null;
      if(S.bgMode!=='none'&&vision.seg){ const m=vision.segment(src.el); if(m) renderer.setPersonMask(m.u8,m.w,m.h); }
    } else if(needFace()&&renderer.crop) face=tracker.update(null,renderer.crop,...renderer.size,now), tracker.lost--;
  }
  if(rawMode&&!exporting&&mode==='record'){ window.__ns={raw:true,vision:vision.status,cam:diag.cam}; return; }
  try{ renderer.render(src.el,src.w,src.h,S,face,{passthrough:src.pass||compare}); }
  catch(e){ console.error('render failed',e); if(mode==='record') useRaw('render error'); return; }
  if(mode==='record'&&!exporting&&blackChecks<8&&now-firstFrameAt>1200){ blackChecks++; if(renderer.isBlank&&renderer.isBlank()&&videoHasPicture()){ if(blackChecks>=6) useRaw('canvas stays black'); } else if(!renderer.isBlank()) blackChecks=99; }
  window.__ns={face:!!face,faceWeight:face?face.weight:0,vision:vision.status,size:renderer.size,fps};
  frames++; if(now-fpsT>1000){ fps=Math.round(frames*1000/(now-fpsT)); frames=0; fpsT=now; $('#diag').textContent=`Preview ${fps} fps · output ${renderer.size.join('×')} · camera ${diag.cam||'-'} · AI ${vision.status} · saves as ${extFor(pickMime()).toUpperCase()}`; }
}
requestAnimationFrame(frame);

// ---------- teleprompter ----------
const scriptSel=$('#scriptSel'), scriptBox=$('#scriptBox'); let prompterOn=store.get('prompterOn',true);
for(const s of SCRIPTS){ const o=document.createElement('option'); o.value=s.id; o.textContent=s.name; scriptSel.appendChild(o); }
scriptSel.value=store.get('scriptSel','waking');
const scriptText=id=>store.get('script.'+id,null)??SCRIPTS.find(s=>s.id===id).text;
function loadScript(){ scriptBox.value=scriptText(scriptSel.value); $('#promptText').textContent=scriptBox.value||'Paste your script in the Script tab.'; resetPrompter(); }
scriptSel.onchange=()=>{ store.set('scriptSel',scriptSel.value); loadScript(); };
scriptBox.oninput=()=>{ store.set('script.'+scriptSel.value,scriptBox.value); $('#promptText').textContent=scriptBox.value; };
$('#scriptReset').onclick=()=>{ localStorage.removeItem('ns.script.'+scriptSel.value); loadScript(); };
const P=Object.assign({speed:3,size:26},store.get('prompter',{}));
{ const host=$('#promptSliders'); for(const [k,label,min,max,step] of [['speed','Scroll speed',1,10,.5],['size','Text size',16,48,1]]){
  const w=document.createElement('div'); w.className='slider'; w.innerHTML=`<label>${label}</label><output>${P[k]}</output><input type="range" min="${min}" max="${max}" step="${step}" value="${P[k]}">`;
  const i=w.querySelector('input'); i.oninput=()=>{ P[k]=+i.value; w.querySelector('output').textContent=i.value; store.set('prompter',P); applyPrompt(); }; host.appendChild(w); } }
const pt=$('#promptText'); let pY=0, pRun=false, pLast=0;
function applyPrompt(){ pt.style.fontSize=P.size+'px'; pt.style.transform=`translateY(${-pY}px)`; }
function resetPrompter(){ pY=0; applyPrompt(); }
function stopPrompter(){ pRun=false; }
function startPrompter(){ pRun=true; pLast=performance.now(); requestAnimationFrame(stepP); }
function stepP(t){ if(!pRun) return; pY+=(t-pLast)/1000*P.speed*P.size*0.32; pLast=t; const max=pt.scrollHeight-$('#prompter').clientHeight*0.4; if(pY>max){ pY=max; pRun=false; } applyPrompt(); requestAnimationFrame(stepP); }
$('#prompter').onclick=()=>{ if(pRun) stopPrompter(); else startPrompter(); };
$('#promptBtn').onclick=()=>{ prompterOn=!prompterOn; store.set('prompterOn',prompterOn); $('#prompter').hidden=!prompterOn; if(prompterOn) resetPrompter(); };
$('#prompter').hidden=!prompterOn; loadScript(); applyPrompt();

// ---------- recording ----------
let recording=null; const recBtn=$('#recBtn');
function startRecorder(stream,mime,bps){ const rec=new MediaRecorder(stream,mime?{mimeType:mime,videoBitsPerSecond:bps,audioBitsPerSecond:128000}:{}); const chunks=[];
  rec.ondataavailable=e=>{ if(e.data&&e.data.size) chunks.push(e.data); };
  const done=new Promise(res=>rec.onstop=()=>res(new Blob(chunks,{type:(rec.mimeType||mime||'video/webm').split(';')[0]})));
  rec.start(1000); return {rec,done}; }
async function countdown(){ const c=$('#countdown'); c.hidden=false; for(const n of [3,2,1]){ c.textContent=n; await new Promise(r=>setTimeout(r,800)); } c.hidden=true; }
recBtn.onclick=async()=>{
  if(!camStream) return startCamera();
  if(recording){ return stopRecording(); }
  if(typeof MediaRecorder==='undefined') return toast('Recording isn’t supported in this browser. Update iOS/Safari or use Chrome.');
  const plain=rawMode||!canvas.captureStream;
  recBtn.disabled=true; if(prompterOn) resetPrompter();
  await countdown(); recBtn.disabled=false;
  const vs=plain?camStream:canvas.captureStream(30); const tracks=[...vs.getVideoTracks(),...camStream.getAudioTracks()];
  const mime=pickMime(); const {rec,done}=startRecorder(new MediaStream(tracks),mime,quality==1080?8e6:5e6);
  recording={rec,done,t0:performance.now(),mime,size:plain?[camVid.videoWidth,camVid.videoHeight]:[...renderer.size]};
  recBtn.classList.add('on'); recBtn.setAttribute('aria-label','Stop'); $('#recChip').hidden=false; $('#flipBtn').disabled=true;
  if(prompterOn&&$('#promptAuto').checked) startPrompter();
  recording.tick=setInterval(()=>$('#recTime').textContent=fmtT((performance.now()-recording.t0)/1000),250);
};
async function stopRecording(){
  const r=recording; recording=null; clearInterval(r.tick); r.rec.stop(); stopPrompter();
  recBtn.classList.remove('on'); recBtn.setAttribute('aria-label','Record'); $('#recChip').hidden=true; $('#flipBtn').disabled=false;
  const blob=await r.done; const dur=(performance.now()-r.t0)/1000;
  const takes=await loadTakes(); const n=takes.length?Math.max(...takes.map(t=>t.n||0))+1:1;
  const take={id:'t'+Date.now(),n,created:Date.now(),blob,mime:blob.type,duration:dur,w:r.size[0],h:r.size[1]};
  await saveTake(take); takeCache.unshift(take); updateCount(); toast(`Take ${n} saved (${fmtT(dur)}). See it in Takes.`);
}

// ---------- takes ----------
let takeCache=[];
async function refreshTakes(){ takeCache=(await loadTakes()).sort((a,b)=>b.created-a.created); updateCount(); }
function updateCount(){ $('#takeCount').textContent=takeCache.length; }
const urls=new Map(); const urlFor=t=>{ if(!urls.has(t.id)) urls.set(t.id,URL.createObjectURL(t.blob)); return urls.get(t.id); };
function fileName(prefix,ext){ const d=new Date(); const p=n=>String(n).padStart(2,'0'); return `${prefix}-${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.${ext}`; }
function renderTakes(){
  const L=$('#takeList'); L.innerHTML='';
  if(!takeCache.length){ L.innerHTML='<div class="empty">No takes yet. Record one and it shows up here.</div>'; return; }
  for(const t of takeCache){
    const el=document.createElement('div'); el.className='take';
    el.innerHTML=`<video src="${urlFor(t)}#t=0.5" preload="metadata" playsinline muted></video><div class="info"><b>Take ${t.n}</b><small>${fmtT(t.duration)} · ${t.w}×${t.h} · ${extFor(t.mime).toUpperCase()} · ${new Date(t.created).toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}</small>
      <div class="acts"><button class="btn small coral" data-a="trim">✂️ Trim &amp; export</button><a class="btn small" download="${fileName('normie-take'+t.n,extFor(t.mime))}" href="${urlFor(t)}">⬇ Raw</a><button class="btn small ghost" data-a="del" aria-label="Delete take">🗑</button></div></div>`;
    el.querySelector('[data-a=trim]').onclick=()=>openTrim(t);
    el.querySelector('[data-a=del]').onclick=async()=>{ if(!confirm(`Delete take ${t.n}?`)) return; await deleteTake(t.id); takeCache=takeCache.filter(x=>x!==t); updateCount(); renderTakes(); };
    L.appendChild(el);
  }
}

// ---------- formats ----------
function fillFmt(sel){ sel.innerHTML=''; const mp4=pickMimeFor('mp4'), webm=pickMimeFor('webm');
  if(mp4) sel.add(new Option(/mp4a/.test(mp4)?'MP4 (best for X, Instagram, iPhone)':'MP4','mp4')); if(webm) sel.add(new Option('WebM','webm')); }
fillFmt($('#tFmt')); fillFmt($('#upFmt'));

// ---------- export engine (real-time re-render) ----------
async function seek(el,t){ if(Math.abs(el.currentTime-t)<0.01&&el.readyState>=2) return; await new Promise(res=>{ const f=()=>{ el.removeEventListener('seeked',f); res(); }; el.addEventListener('seeked',f); el.currentTime=t; setTimeout(res,3000); }); }
async function runExport({el,start,end,passthrough,clean,fmt,w,h,onProgress}){
  if(!renderer){ toast('Filters/export need WebGL2 – use the ⬇ Raw download instead',4000); return null; }
  const prevSize=[...renderer.size]; renderer.setSize(w,h); tracker.reset();
  const busy=$('#busy'); busy.hidden=false; $('#busyTitle').textContent='Exporting…'; $('#busyBar').style.width='0%';
  let cancelled=false; $('#busyCancel').onclick=()=>{ cancelled=true; };
  el.loop=false; el.muted=false; el.pause(); await seek(el,start);
  const au=await elementAudio(el,clean); au.monitor.gain.value=0;
  exporting={el,passthrough};
  const mime=pickMimeFor(fmt)||pickMime(); const vs=canvas.captureStream(30);
  const {rec,done}=startRecorder(new MediaStream([...vs.getVideoTracks(),...au.stream.getAudioTracks()]),mime,(Math.max(w,h)>=1900?9e6:6e6));
  await el.play().catch(e=>console.warn(e));
  await new Promise(res=>{ const iv=setInterval(()=>{ const p=(el.currentTime-start)/Math.max(0.1,end-start); $('#busyBar').style.width=Math.min(100,p*100)+'%'; $('#busyMsg').textContent=`${fmtT(el.currentTime-start)} of ${fmtT(end-start)} · keep this screen open`; onProgress&&onProgress(p);
      if(cancelled||el.ended||el.currentTime>=end){ clearInterval(iv); res(); } },100); });
  el.pause(); rec.stop(); const blob=await done; exporting=null; busy.hidden=true; au.monitor.gain.value=1;
  if(mode==='record') applyRecordSize(); else renderer.setSize(...prevSize);
  return cancelled?null:{blob,ext:extFor(blob.type||mime)};
}
function showResult(host,res,prefix){
  host.hidden=false; const url=URL.createObjectURL(res.blob); const name=fileName(prefix,res.ext);
  host.innerHTML=`<b>✅ Ready: ${name} (${(res.blob.size/1048576).toFixed(1)} MB)</b><video src="${url}" controls playsinline></video><div class="row"><a class="btn coral" href="${url}" download="${name}">⬇ Download</a><button type="button" class="btn" data-share>Share / Save to Photos</button></div>`;
  const f=new File([res.blob],name,{type:res.blob.type}); const sb=host.querySelector('[data-share]');
  if(navigator.canShare&&navigator.canShare({files:[f]})) sb.onclick=()=>navigator.share({files:[f]}).catch(()=>{}); else sb.remove();
}

// ---------- trim dialog (takes) ----------
const dlg=$('#trimDlg'), tv=$('#trimVid'); let curTake=null;
function wireTrim(sIn,eIn,sT,eT,getDur,video){
  const upd=(which)=>{ const d=getDur(); let s=+sIn.value/1000*d, e=+eIn.value/1000*d; if(e-s<0.5){ if(which==='s'){ s=Math.max(0,e-0.5); sIn.value=s/d*1000; } else { e=Math.min(d,s+0.5); eIn.value=e/d*1000; } }
    sT.textContent=fmtT(s); eT.textContent=fmtT(e); if(video&&which){ video.currentTime=which==='s'?s:e; } return [s,e]; };
  sIn.oninput=()=>upd('s'); eIn.oninput=()=>upd('e'); return ()=>upd(null); }
const trimRange=wireTrim($('#tStart'),$('#tEnd'),$('#tStartT'),$('#tEndT'),()=>curTake?curTake.duration:1,tv);
function openTrim(t){ curTake=t; $('#trimTitle').textContent=`Trim & export · Take ${t.n}`; tv.src=urlFor(t); $('#tStart').value=0; $('#tEnd').value=1000; trimRange(); $('#tResult').hidden=true; dlg.showModal(); }
dlg.addEventListener('close',()=>tv.pause());
$('#tPreview').onclick=async()=>{ const [s,e]=trimRange(); await seek(tv,s); tv.play(); const iv=setInterval(()=>{ if(tv.currentTime>=e||tv.paused){ tv.pause(); clearInterval(iv); } },100); };
$('#tExport').onclick=async()=>{ if(!curTake) return; const [s,e]=trimRange(); tv.pause(); dlg.close();
  expVid.src=urlFor(curTake); await new Promise(r=>{ if(expVid.readyState>=1) r(); else expVid.onloadedmetadata=r; });
  const res=await runExport({el:expVid,start:s,end:e,passthrough:true,clean:$('#tClean').checked,fmt:$('#tFmt').value,w:curTake.w,h:curTake.h});
  dlg.showModal(); if(res) showResult($('#tResult'),res,`normie-take${curTake.n}-final`); };

// ---------- enhance uploaded video ----------
const upSeek=$('#upSeek');
function setOutputForVideo(){ if(!upVid.videoWidth) return; const w=upVid.videoWidth,h=upVid.videoHeight; const sc=Math.min(1,(quality==1080?1920:1280)/Math.max(w,h)); let W=Math.round(w*sc/2)*2,H=Math.round(h*sc/2)*2; renderer.setSize(W,H);
  const fr=$('#frame'); fr.classList.toggle('wide',w>h); fr.style.aspectRatio=`${W}/${H}`; }
async function loadUpload(f){ if(!f) return; upVid.src=URL.createObjectURL(f); upVid.muted=false; $('#upResult').hidden=true;
  await new Promise(r=>upVid.onloadedmetadata=r); setOutputForVideo(); $('#uploadPh').hidden=true; $('#upControls').hidden=false;
  $('#upStart').value=0; $('#upEnd').value=1000; upRange(); upVid.currentTime=0.01; showTab('looks'); toast('Loaded. Pick a look, then go to Trim & Export.'); }
$('#fileIn').onchange=e=>loadUpload(e.target.files[0]); $('#fileIn2').onchange=e=>loadUpload(e.target.files[0]);
const upDur=()=>isFinite(upVid.duration)?upVid.duration:1;
const upRange=wireTrim($('#upStart'),$('#upEnd'),$('#upStartT'),$('#upEndT'),upDur,upVid);
$('#upPlay').onclick=()=>{ audioCtx(); if(upVid.paused) upVid.play(); else upVid.pause(); };
upVid.onplay=()=>$('#upPlay').textContent='⏸'; upVid.onpause=()=>$('#upPlay').textContent='▶';
upVid.ontimeupdate=()=>{ upSeek.value=upVid.currentTime/upDur()*1000; $('#upTime').textContent=fmtT(upVid.currentTime); };
upSeek.oninput=()=>{ upVid.currentTime=+upSeek.value/1000*upDur(); };
$('#upExport').onclick=async()=>{ if(!upVid.src) return toast('Choose a video first'); const [s,e]=upRange();
  const res=await runExport({el:upVid,start:s,end:e,passthrough:false,clean:$('#upClean').checked,fmt:$('#upFmt').value,w:renderer.size[0],h:renderer.size[1]});
  upVid.loop=true; if(res){ showResult($('#upResult'),res,'normie-enhanced'); showTab('export'); } };
document.addEventListener('visibilitychange',()=>{ if(document.hidden&&exporting) toast('Keep this screen open while exporting',4000); });

// ---------- boot ----------
syncUI(); applyRecordSize(); refreshTakes();
if(new URLSearchParams(location.search).has('autostart')) startCamera();
window.__nsApp={S,setMode,showTab,startCamera,loadUpload,refreshTakes,get takes(){return takeCache;},runExport,upVid,PRESETS};
