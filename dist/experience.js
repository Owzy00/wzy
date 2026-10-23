import {POSTER_DEFINITIONS,posterDefinition,isPosterStyle,createPosterLoader,posterPalette} from './qinglong-posters.js?v=35';
import {stagePresentation,stageEditorialMarkup} from './stage-editorial.js?v=35';
import {GestureMachine,HandNavigator,FingerParticleInput} from './gesture-core.js?v=35';
import {GestureCamera} from './gesture-camera.js?v=35';
import {cloudPresence} from './cloud-field.js?v=35';
import {WindField,StatueStage} from './particle-effects.js?v=35';
export function initExperience(adapter,{cameraFactory=(video,callbacks)=>new GestureCamera(video,callbacks),stageFactory=()=>new StatueStage()}={}){
 const visualStyles=new Map();let candidateAt=-Infinity;
 const ui=id=>document.getElementById(id),wind=new WindField(),stage=stageFactory(),machine=new GestureMachine(),navigator=new HandNavigator(),handParticles=new FingerParticleInput();
 let restoring=null,lastPhase='',windDrag=null,lastManualWind=-9999,lastSample=0,modelState='off',sampleCount=0,preparing=false,lastCandidate=null,lastHud='',lastCountdown=-1,lastHandCount=0,resumeAfterPageShow=false,lastHand=null,lastPointer=null;
 const states={IDLE:'张开单掌，拖动星图',NAVIGATING:'张掌拖动 · 停手即停 · 握拳点亮',FIST_ARMING:'握拳锁定…',FIST_READY:'已点亮 · 张掌化形',OPENING:'张掌化形…',COOLDOWN:'移手继续探索',LOST:'请将一只手放入画面',BLOCKED:'彩塑展示中 · 即将自动返回'};
 document.body.insertAdjacentHTML('beforeend',`<div class="experience-actions"><button id="gesture-toggle" aria-expanded="false">◌ 手势交互</button><button id="morph-trigger">✧ 粒子化形</button></div>
 <section class="gesture-panel" id="gesture-panel" hidden aria-label="手势控制"><div class="gesture-panel-head"><strong>以手，环顾星空</strong><button id="gesture-close" aria-label="收起手势面板">×</button></div><p>张掌像拖动画布一样移动星图，停手即停，将星宿移近中央准星。握拳点亮，再张掌化形；成形约 4 秒后自动返回。生成与展示时，任意一根手指相对手掌晃动，即可泛起局部涟漪；整手移动不发波，波纹留在实际晃动的指尖对应处，同时最多五处，同一指尖不叠圈；也可移动鼠标，随后平滑归位。</p><div class="gesture-meter"><span id="gesture-pose">正在接入摄像头</span><progress id="gesture-progress" max="1" value="0" aria-label="握拳张掌进度"></progress></div><p id="camera-status" role="status" aria-live="polite">首次进入时请允许摄像头。视频仅在本机处理，不上传、不录制。</p><div class="gesture-buttons"><button id="camera-start">开启摄像头</button><button id="camera-stop" disabled>关闭摄像头</button></div><button id="manual-wind">↝ 推动星尘 <kbd>W</kbd></button><p class="camera-note">收起面板仍可交互。双手入镜或丢手会重置手势。备选：鼠标拖动环顾，M 化形，Esc 返回。</p></section>
 <section id="gesture-hud" class="gesture-hud" aria-label="摄像头与操作提示" data-camera-state="off"><div class="camera-card-head"><span><i class="live-dot"></i>手势预览</span><button id="camera-card-control" aria-label="开启摄像头">开启</button></div><div id="camera-viewport" class="camera-viewport"><video id="hand-video" autoplay muted playsinline aria-label="本机镜像摄像头预览"></video><canvas id="hand-overlay" aria-hidden="true"></canvas><div id="camera-placeholder" class="camera-placeholder"><span id="camera-placeholder-text">摄像头未开启</span><small>画面仅在本机处理</small></div></div><div class="camera-guide"><span class="camera-sky-steps">张掌 · 拖动星图<br>握拳 · 点亮星宿<br>张掌 · 粒子化形</span><span class="camera-morph-steps">轻晃指尖，泛起粒子涟漪</span></div><div class="camera-feedback"><span id="gesture-hint" role="status" aria-live="polite">正在接入摄像头…</span><progress id="gesture-hud-progress" max="1" value="0" aria-label="手势操作进度"></progress></div></section>
 <section id="statue-stage-ui" class="statue-stage-ui" hidden aria-label="彩塑粒子化形"><aside id="stage-atlas" class="stage-atlas" aria-label="当前星宿固定星象"></aside><aside id="stage-record" class="stage-record" aria-label="彩塑与星宿介绍"></aside><div class="stage-title"><small id="stage-index" class="stage-index"></small><p id="stage-title"></p><span id="stage-pinyin"></span><small id="stage-phase"></small></div><div class="stage-bottom"><span id="stage-credit">用户提供海报 · 粒子化形<br>主体姿态与颜色取自海报</span><span id="stage-input-hint" aria-live="polite"></span><span id="stage-countdown">成形后自动返回星空</span><button id="stage-return">回到星图 <kbd>Esc</kbd></button></div></section>`);
 const loadPoster=createPosterLoader();
 function warmSelected(){
  const id=adapter.selected().id;if(!posterDefinition(id))return;
  loadPoster(id).then(item=>{if(!stage.busy&&adapter.selected().id===id){stage.initRenderer?.();stage.prepare(item);}}).catch(()=>{});
 }
 warmSelected();
 function status(state,text){
  modelState=state;ui('camera-status').textContent=text;ui('camera-start').disabled=state==='loading'||state==='running';ui('camera-stop').disabled=state==='off'||state==='error';ui('camera-start').textContent=state==='loading'?'正在准备…':'开启摄像头';document.body.classList.toggle('camera-running',state==='running');ui('gesture-hud').setAttribute('data-camera-state',state);ui('gesture-hud').hidden=false;
  const ready=state==='running'||(state==='loading'&&ui('hand-video').readyState>=2);ui('camera-placeholder').hidden=ready;
  ui('camera-placeholder-text').textContent=state==='loading'?'请允许摄像头访问':state==='error'?'摄像头未就绪':'摄像头已关闭';
  ui('camera-card-control').textContent=state==='off'?'开启':state==='error'?'重试':'设置';ui('camera-card-control').setAttribute('aria-label',state==='off'?'开启摄像头':state==='error'?'重试摄像头':'摄像头设置');
  if(state==='off'||state==='error')drawHand(null);
  ui('gesture-toggle').textContent=state==='running'?'◉ 手势已开启':state==='loading'?'◌ 正在接入…':'◌ 手势交互';
  if(state!=='running'){navigator.reset();handParticles.reset();lastHand=null;ui('gesture-pose').textContent=state==='loading'?'正在接入摄像头…':'摄像头未开启';hud(state==='loading'?(text.includes('请允许摄像头')?'首次进入，请允许摄像头':text):state==='error'?'摄像头未就绪 · 点击手势交互重试':'手势已关闭');}
  if(state==='running'){ui('gesture-pose').textContent=states.LOST;hud(states.LOST);}
  if(state==='error')panel(true);
 }
 function hud(text){if(text!==lastHud){lastHud=text;ui('gesture-hint').textContent=text;}for(const id of ['gesture-progress','gesture-hud-progress'])if(ui(id).value!==machine.progress)ui(id).value=machine.progress;}
 function visualStyle(name,value){const text=String(value);if(visualStyles.get(name)!==text){visualStyles.set(name,text);document.body.style.setProperty(name,text);}}
 function refreshHud(){let text=lastHandCount>1?'请只保留一只手':stage.busy?(lastHand?'轻晃指尖 · 同时最多五处':'请将单手放入画面'):states[machine.state]||states.IDLE;if(machine.armed)text+=' · '+adapter.selected().name+'宿';else if(machine.state==='NAVIGATING'&&lastCandidate!==null)text+=' '+adapter.mansionName(lastCandidate)+'宿';if(ui('gesture-pose').textContent!==text)ui('gesture-pose').textContent=text;hud(text);}
 const camera=cameraFactory(ui('hand-video'),{onStatus:status,onSample:(sample,timestamp,landmarks,handCount,timing={})=>{
  lastSample=timestamp;sampleCount++;lastHandCount=handCount;if(handCount>1)sample=null;
  let handSpeed=0;if(sample&&lastHand){const dt=(timestamp-lastHand.t)/1000,travel=Math.hypot(sample.palm.x-lastHand.x,sample.palm.y-lastHand.y);if(dt>0&&dt<.4&&travel<.18)handSpeed=travel/dt;}
  lastHand=sample?{...sample.palm,t:timestamp}:null;
  const fingerEnabled=camera.running&&['GATHERING','HOLDING'].includes(stage.timeline.state)&&!preparing&&!adapter.blocked()&&!document.hidden;
  const fingerInputs=handParticles.feed(sample,timestamp,fingerEnabled);
  if(fingerEnabled&&sample)stage.interactFingers?.(fingerInputs,timestamp,sample.palm);
  const previous=machine.state,event=machine.update(sample,timestamp,{selected:adapter.selected().id,busy:stage.busy||preparing||adapter.blocked()||document.hidden,enabled:camera.running});
  if(sample?.pose==='fist'&&previous!=='FIST_ARMING'&&previous!=='FIST_READY')adapter.stopNavigation();
  if(event?.type==='select'){
   const id=adapter.selectNearest();machine.confirmSelection(id);navigator.reset();warmSelected();
   if(id!==null)adapter.notice(adapter.selected().name+'宿已点亮 · 张掌化形');else adapter.notice('请将星宿移到画面中央，再握拳');
  }
  if(event?.type==='morph')morph();
  const available=camera.running&&!stage.busy&&!preparing&&!adapter.blocked()&&!document.hidden&&!machine.armed;
  if(!available)navigator.reset();
  else {if(sample?.pose==='open'&&!navigator.previous)adapter.stopNavigation();navigator.feed(sample,timestamp,timing.receivedAt??timestamp);}
  if(available&&sample&&navigator.previous&&handSpeed>.06&&!adapter.reducedMotion){const p=adapter.handScreen?.(sample.palm)||sample.palm;wind.stir({x:p.x,y:p.y,dx:navigator.motion.x*2,dy:navigator.motion.y*2},timestamp);}
  refreshHud();
  if(!document.hidden)drawHand(landmarks);
 }});
 // The preview is the same video used for recognition: no second camera session.
 ui('hand-video').onloadedmetadata=()=>{const video=ui('hand-video');if(video.videoWidth&&video.videoHeight)ui('camera-viewport').style.aspectRatio=video.videoWidth+'/'+video.videoHeight;};
 ui('hand-video').onloadeddata=()=>{if(modelState==='loading'||modelState==='running')ui('camera-placeholder').hidden=true;};
 function drawHand(landmarks){
  const c=ui('hand-overlay'),video=ui('hand-video'),w=240,h=Math.round(w*(video.videoHeight||480)/(video.videoWidth||640));
  if(c.width!==w)c.width=w;if(c.height!==h)c.height=h;
  const context=c.getContext('2d');if(!context)return;context.clearRect(0,0,w,h);if(!landmarks)return;
  context.strokeStyle='#99e0dc99';context.lineWidth=1;
  for(const chain of [[0,1,2,3,4],[0,5,6,7,8],[5,9,10,11,12],[9,13,14,15,16],[13,17,18,19,20],[0,17]]){
   context.beginPath();chain.forEach((id,i)=>{const p=landmarks[id];if(i===0)context.moveTo((1-p.x)*w,p.y*h);else context.lineTo((1-p.x)*w,p.y*h);});context.stroke();
  }
  context.fillStyle='#d7fffa';for(const id of [4,8,12,16,20]){const tip=landmarks[id];context.beginPath();context.arc((1-tip.x)*w,tip.y*h,2.5,0,Math.PI*2);context.fill();}
 }
 function panel(open){ui('gesture-panel').hidden=!open;ui('gesture-toggle').setAttribute('aria-expanded',String(open));document.body.classList.toggle('gesture-open',open);}
 function manualWind(dx=1,dy=-.12,x=.5,y=.5){const now=performance.now();if(stage.busy||now-lastManualWind<700)return;lastManualWind=now;wind.push({x,y,dx,dy},now);adapter.notice('星尘随风 · 天球坐标保持固定');}
 async function morph(){
  if(stage.busy||preparing)return;
  preparing=true;navigator.reset();handParticles.reset();adapter.stopNavigation();
  const selected=adapter.selected();let item;
  const definition=posterDefinition(selected.id);
  if(!definition){preparing=false;adapter.notice('当前宿的海报尚未就绪');return;}
  try{adapter.notice('正在准备'+definition.title+'海报粒子…');item=await loadPoster(selected.id);}
  catch(error){preparing=false;machine.reset(performance.now());adapter.notice(error.message);return;}
  if(adapter.selected().id!==selected.id){preparing=false;machine.reset(performance.now());adapter.notice('星宿已切换，请重新触发化形');return;}
  if(!item){preparing=false;adapter.notice('当前宿的彩塑映射尚未就绪');return;}
  const snapshot=adapter.snapshot();
  const editorial=stageEditorialMarkup(stagePresentation(adapter.stageDetails?.()||selected,item));
  ui('stage-atlas').innerHTML=editorial.atlas;ui('stage-record').innerHTML=editorial.record;ui('stage-index').textContent=editorial.index;
  try{if(!stage.start(item,performance.now(),adapter.emissionSources?.()||[])){adapter.notice('化形正在冷却，请稍候');return;}}catch(error){adapter.notice('化形未能启动，请重试：'+error.message);return;}finally{preparing=false;}
  const region=item.style==='heritage-poster'?posterPalette(item.id):null;document.body.classList.toggle('heritage-poster',Boolean(region));if(region){document.body.style.setProperty('--poster-ink',region.ink);document.body.style.setProperty('--poster-accent',region.orbits[0]);}
  restoring=snapshot;lastCountdown=-1;machine.reset(performance.now(),'BLOCKED');document.body.classList.add('morphing');document.body.classList.toggle('jiao-poster',isPosterStyle(item.style));ui('stage-credit').innerHTML=isPosterStyle(item.style)?'用户提供海报 · '+item.title+'粒子演绎<br>主体姿态与颜色取自海报':'用户提供海报 · 粒子化形<br>主体姿态与颜色取自海报';ui('statue-stage-ui').hidden=false;ui('stage-title').textContent=item.title;ui('stage-pinyin').textContent=item.pinyin;ui('morph-trigger').disabled=true;document.querySelector('main').inert=true;document.querySelector('.bottom-panel').inert=true;ui('stage-return').focus({preventScroll:true});
 }
 function returnToSky(){stage.finish(performance.now());}
 ui('camera-card-control').onclick=()=>{if(modelState==='off'||modelState==='error')camera.start();else panel(ui('gesture-panel').hidden);};
 ui('gesture-toggle').onclick=()=>panel(ui('gesture-panel').hidden);ui('gesture-close').onclick=()=>panel(false);ui('camera-start').onclick=()=>camera.start();ui('camera-stop').onclick=()=>camera.stop();ui('manual-wind').onclick=()=>manualWind();ui('morph-trigger').onclick=morph;ui('stage-return').onclick=returnToSky;
 document.addEventListener('keydown',event=>{if(adapter.blocked()||event.ctrlKey||event.metaKey||event.altKey||['INPUT','TEXTAREA','SELECT'].includes(event.target.tagName))return;const key=event.key.toLowerCase();if(key==='escape'&&stage.busy){event.preventDefault();returnToSky();}if(event.repeat)return;if(key==='w'){event.preventDefault();manualWind(event.shiftKey?-1:1);}if(key==='m'){event.preventDefault();morph();}});
 document.addEventListener('pointermove',event=>{
  const now=performance.now(),x=event.clientX/innerWidth,y=event.clientY/innerHeight;let dx=0,dy=0;
  if(lastPointer){const dt=Math.max(.016,(now-lastPointer.t)/1000);dx=(x-lastPointer.x)/dt;dy=(y-lastPointer.y)/dt;}lastPointer={x,y,t:now};
  if(stage.busy){stage.interact(x,y,now,Math.min(1.2,Math.hypot(dx,dy)*.9));return;}
  if(event.target.id==='sky'&&!adapter.blocked()&&!adapter.reducedMotion&&Math.hypot(dx,dy)>.08)wind.stir({x,y,dx:dx*.75,dy:dy*.75},now);
 });
 document.addEventListener('pointerdown',event=>{if(event.target.id!=='sky'||adapter.reducedMotion)return;const now=performance.now(),x=event.clientX/innerWidth,y=event.clientY/innerHeight;if(stage.busy)stage.interact(x,y,now,1.3);else wind.ripple({x,y},now);});
 document.addEventListener('visibilitychange',()=>{navigator.reset();machine.reset(performance.now());camera.suspended=document.hidden||stage.timeline.state==='RETURNING';if(document.hidden&&stage.busy)returnToSky();});window.addEventListener('pagehide',()=>{resumeAfterPageShow=camera.running||camera.starting;camera.stop();});window.addEventListener('pageshow',event=>{if(event.persisted&&resumeAfterPageShow){resumeAfterPageShow=false;camera.start();}});
 // Exactly one automatic request per document. Panel and morph transitions reuse the stream.
 queueMicrotask(()=>camera.start());
 return {
  get busy(){return stage.busy||preparing;},
  get navigating(){return camera.running&&machine.state==='NAVIGATING'&&!stage.busy;},
  get occludesSky(){return stage.occludesSky;},
  beforeFrame(now){
   camera.suspended=stage.timeline.state==='RETURNING'||preparing||adapter.blocked()||document.hidden;wind.prepare(now);if(camera.suspended)handParticles.reset();
   if(camera.suspended||stage.busy||preparing||adapter.blocked()||document.hidden){navigator.reset();machine.reset(now,'BLOCKED');return;}
   if(camera.running&&now-lastSample>Math.max(650,camera.inferenceMs*3)){machine.reset(now,'LOST');navigator.reset();hud(states.LOST);}
   const motion=navigator.step(now);if(motion.dx||motion.dy)adapter.pan(motion.dx,motion.dy);
   if(camera.running&&now-candidateAt>=80){candidateAt=now;lastCandidate=adapter.nearest();refreshHud();}
  },
  offset(x,y,w,h){return wind.offset(x,y,w,h);},
  draw(context,now,w,h,anchor,reduced){const sample=stage.draw(context,now,w,h,anchor,reduced),presence=sample.presence??cloudPresence(sample.amount||0);visualStyle('--stage-presence',presence);visualStyle('--statue-reveal',Math.max(0,Math.min(1,((sample.formation||0)-.5)/.4))*(1-(sample.release||0)));visualStyle('--stage-sky-opacity',1-presence*.48);visualStyle('--stage-scale',1);if(context&&!reduced&&!stage.busy)wind.draw(context,w,h);if(stage.busy&&sample.state!==lastPhase){lastPhase=sample.state;ui('stage-phase').textContent={GATHERING:'流尘凝像',HOLDING:'星神呼吸',RETURNING:'流光归野'}[sample.state]||'';}if(stage.busy){ui('stage-input-hint').textContent=sample.state==='RETURNING'?'':!camera.running?(modelState==='error'?'摄像头未就绪 · 可用鼠标':modelState==='loading'?'正在接入摄像头…':'手势未开启 · 可用鼠标'):lastHandCount>1?'请只保留一只手':!lastHand||now-lastSample>1200?'请将单手放入画面':!handParticles.previous?'让任意指尖进入画面':stage.lastRippleSource==='hand'&&now-stage.lastRipple<700?'指尖涟漪已响应':'晃动指尖 · 同时最多五处涟漪';const remaining=sample.hold?Math.ceil((stage.timeline.started+stage.timeline.duration.gather+stage.timeline.duration.hold-now)/1000):-1;if(remaining!==lastCountdown||sample.state!=='HOLDING'){lastCountdown=remaining;ui('stage-countdown').textContent=sample.hold?remaining+' 秒后回到星空':sample.state==='RETURNING'?'流光散回星空':'成形后自动返回星空';}}if(sample.done){document.body.classList.remove('morphing');document.body.classList.remove('jiao-poster');document.body.classList.remove('heritage-poster');document.querySelector('main').inert=false;document.querySelector('.bottom-panel').inert=false;ui('statue-stage-ui').hidden=true;ui('morph-trigger').disabled=false;ui('morph-trigger').focus({preventScroll:true});adapter.restore(restoring);navigator.reset();machine.reset(now);machine.cooldownUntil=now+700;restoring=null;lastPhase='';hud(camera.running?'已回到星空 · 移手继续探索':modelState==='off'?'手势已关闭 · 可用鼠标':'摄像头未就绪 · 可用鼠标');adapter.notice('已回到星空 · 移手继续探索');}},
  pointerCancel(){windDrag=null;},
  pointerDown(event){if(stage.busy)return true;if(event.shiftKey){windDrag={x:event.clientX,y:event.clientY,t:performance.now(),lastX:event.clientX,lastY:event.clientY};event.currentTarget.setPointerCapture(event.pointerId);return true;}return false;},
  pointerMove(event){if(stage.busy)return true;if(!windDrag)return false;windDrag.lastX=event.clientX;windDrag.lastY=event.clientY;return true;},
  pointerUp(event){if(stage.busy)return true;if(!windDrag)return false;const d=windDrag;windDrag=null;const seconds=Math.max(.12,(performance.now()-d.t)/1000);manualWind((event.clientX-d.x)/innerWidth/seconds*2,(event.clientY-d.y)/innerHeight/seconds*2,event.clientX/innerWidth,event.clientY/innerHeight);return true;},
  get diagnostics(){return {gestureState:machine.state,cameraState:modelState,cameraBackend:camera.backend,cameraWorkerError:camera.workerError,inferenceMs:camera.inferenceMs,cameraLatencyMs:camera.latencyMs||0,cameraSampleHz:camera.sampleHz||0,handSampleIntervalMs:Math.round(navigator.interval||0),sentFrames:camera.sent,receivedFrames:camera.received,sampleCount,gestureCandidate:lastCandidate,cameraSuspended:camera.suspended,handRippleCount:stage.handRippleCount||0,fingerRippleCount:{...stage.fingerRippleCount},activeRipples:stage.ripples?.length||0,lastRippleSource:stage.lastRippleSource||null,morphState:stage.timeline.state,morphPoints:stage.item?.count||0,morphFrameMs:stage.frameMs,particleQuality:stage.quality,morphRenderer:stage.renderer,morphError:stage.error||null,morphCadence:stage.cadence,assetCount:POSTER_DEFINITIONS.length,windGusts:wind.gusts.length};}
 };
}
