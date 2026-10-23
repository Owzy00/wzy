import {POSTER_DEFINITIONS,posterDefinition} from '../dist/qinglong-posters.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {initExperience} from '../dist/experience.js';
import {MorphTimeline,StatueStage} from '../dist/particle-effects.js';
import {describeHand} from '../dist/gesture-core.js';
import {handLandmarks,tipIds} from './hand-fixtures.mjs';

// Exercise the real experience coordinator with camera callbacks and the real timeline.
// The small DOM facade lets the test control visibility and permission errors without a camera.
async function scene(run,{poster=null,selectedId=15,posterFailures=0}={}){
 const names=['document','window','fetch','requestIdleCallback','cancelIdleCallback','innerWidth','innerHeight'],saved=new Map(names.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
 globalThis.innerWidth=1000;globalThis.innerHeight=800;
 const requests=[],notices=[];const styles={},elements=new Map(),listeners={},classes=new Set(),idle=[];
 const element=id=>{if(!elements.has(id))elements.set(id,{id,hidden:['gesture-panel','statue-stage-ui','gesture-hud'].includes(id),style:{},value:0,textContent:'',setAttribute(name,value){this[name]=value;},focus(){},getContext(){return {clearRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},arc(){},fill(){}};}});return elements.get(id);};
 const main={inert:false},bottom={inert:false};
 globalThis.document={hidden:false,body:{style:{setProperty(key,value){styles[key]=value;}},insertAdjacentHTML(){},classList:{toggle(name,value){if(value)classes.add(name);else classes.delete(name);},add(name){classes.add(name);},remove(name){classes.delete(name);}}},getElementById:element,querySelector:selector=>selector==='main'?main:bottom,addEventListener:(name,callback)=>listeners[name]=callback};
 globalThis.window={addEventListener:(name,callback)=>listeners[name]=callback};
 globalThis.fetch=async url=>{requests.push(url);const spec=POSTER_DEFINITIONS.find(p=>p.url===url);if(spec?.id===selectedId&&posterFailures>0){posterFailures--;return {ok:false};}return {ok:true,json:async()=>spec?(poster&&poster.id===spec.id?poster:{...spec,count:96000}):({items:Array.from({length:28},(_,id)=>({id,name:posterDefinition(id)?.name||'宿'+id,title:'彩塑'+id,pinyin:'test'}))})};};
 globalThis.requestIdleCallback=callback=>idle.push(callback);globalThis.cancelIdleCallback=()=>{};
 let cameraVideo;let callbacks,selected=selectedId,selectedCount=0,panDistance=0,morphs=0,starts=0,stops=0,restores=0,touches=0;
 const stage={timeline:new MorphTimeline(),get busy(){return this.timeline.busy;},get occludesSky(){return this.busy;},prepare(){},interact(...args){this.lastInteraction=args;(this.interactions??=[]).push(args);touches++;},interactFingers(inputs,now,palm){this.lastFingers=inputs;this.interact(palm.x,palm.y,now,Math.max(0,...inputs.map(p=>p.strength)),'hand');},start(item,now,sources){this.sources=sources;if(!this.timeline.start(now))return false;this.item=item;morphs++;return true;},draw(ctx,now){return this.timeline.sample(now);},finish(now){this.timeline.finish(now);},pointer:{}};
 const camera={running:false,inferenceMs:30,async start(){starts++;this.running=true;callbacks.onStatus('running','已接入');},stop(){stops++;this.running=false;callbacks.onStatus('off','已关闭');}};
 const adapter={stageDetails:()=>({id:selected,name:posterDefinition(selected)?.name||'宿'+selected,group:Math.floor(selected/7),members:[{id:1,ra:1,dec:.1,mag:1},{id:2,ra:1.02,dec:.15,mag:2}],center:{ra:1.01,dec:.125},lines:[[1,2]]}),emissionSources:()=>[{x:.3,y:.4},{x:.5,y:.6}],selected:()=>({id:selected,name:posterDefinition(selected)?.name||'宿'+selected}),blocked:()=>false,notice(text){notices.push(text);},ensureDust(){},stopNavigation(){},selectNearest(){selected=9;selectedCount++;return selected;},nearest:()=>9,mansionName:id=>'宿'+id,pan(dx,dy){panDistance+=Math.hypot(dx,dy);},snapshot:()=>({camera:{ra:1.2,dec:.1}}),restore(snapshot){assert.equal(snapshot.camera.ra,1.2);restores++;}};
 try{
  const experience=initExperience(adapter,{cameraFactory:(video,c)=>{cameraVideo=video;callbacks=c;return camera;},stageFactory:()=>stage});
  await new Promise(resolve=>setImmediate(resolve));
  await run({get cameraVideo(){return cameraVideo;},requests,notices,styles,experience,stage,camera,element,listeners,classes,callbacks,counts:()=>({starts,stops,morphs,selectedCount,panDistance,restores,touches}),emit:(pose,time,x=.5)=>callbacks.onSample(pose?{pose,palm:{x,y:.5},fingers:{index:{x:x+.02,y:.5,extended:true},ring:{x:x-.02,y:.5,extended:true}},span:.15,confidence:.95}:null,time,null,pose?1:0)});
 }finally{for(const [name,descriptor]of saved){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}}
}

function assertOnlySelectedPoster(s,spec,attempts=1){
 assert.equal(s.requests.some(url=>/data\/statues\.json(?:[?#]|$)/.test(url)),false,'the legacy statue pack must never be requested');
 assert.deepEqual(s.requests,Array(attempts).fill(spec.url),'only the selected poster is requested; generation reuses its warmed asset');
}

test('one camera session supports navigation, fist selection, palm morph and automatic return',async()=>scene(async s=>{
 assert.equal(s.counts().starts,1);s.element('gesture-toggle').onclick();s.element('gesture-close').onclick();assert.equal(s.counts().stops,0);assert.equal(s.camera.running,true);
 const base=performance.now()+1000;
 for(let t=0;t<=500;t+=50){s.emit('open',base+t,.3+t*.0003);s.experience.beforeFrame(base+t);}
 assert.ok(s.counts().panDistance>.05);const moved=s.counts().panDistance;
 for(let t=550;t<=1100;t+=50){s.emit('fist',base+t);s.experience.beforeFrame(base+t);}
 assert.equal(s.counts().selectedCount,1);assert.equal(s.counts().morphs,0);assert.equal(s.counts().panDistance,moved);
 for(let t=1150;t<=1400;t+=50)s.emit('open',base+t);await new Promise(resolve=>setImmediate(resolve));
 assert.equal(s.counts().morphs,1);assert.equal(s.experience.busy,true);s.experience.beforeFrame(base+1500);assert.equal(s.camera.suspended,false);assert.equal(s.counts().stops,0);
 assert.deepEqual(s.stage.sources,[{x:.3,y:.4},{x:.5,y:.6}]);const gatheringTouches=s.counts().touches;s.emit('open',base+1550,.53);s.emit('open',base+1600,.59);assert.ok(s.stage.interactions.slice(-3).every(args=>args[3]===0));assert.equal(s.counts().touches,gatheringTouches+2);assert.equal(s.counts().panDistance,moved);assert.equal(s.counts().selectedCount,1);
 const hold=s.stage.timeline.started+s.stage.timeline.duration.gather+700;s.experience.draw(null,hold,1000,800,null,false);s.experience.beforeFrame(hold+16);assert.equal(s.camera.suspended,false);assert.ok(Number(s.styles['--stage-sky-opacity'])>=.5);assert.equal(s.styles['--stage-scale'],'1');const touches=s.counts().touches;s.emit('open',hold+50);assert.equal(s.counts().touches,touches+1);assert.equal(s.counts().morphs,1);s.emit('open',hold+100,.55);s.emit('open',hold+150,.61);assert.ok(s.stage.interactions.slice(-3).every(args=>args[3]===0));assert.equal(s.stage.lastInteraction[3],0);s.listeners.pointermove({clientX:400,clientY:400,target:{id:'sky'}});s.listeners.pointermove({clientX:500,clientY:400,target:{id:'sky'}});assert.ok(s.stage.lastInteraction[3]>.18);assert.equal(s.counts().selectedCount,1);assert.equal(s.counts().morphs,1);
 const end=s.stage.timeline.started+s.stage.timeline.duration.gather+s.stage.timeline.duration.hold+s.stage.timeline.duration.return+100;s.experience.draw(null,end,1000,800,null,false);s.experience.beforeFrame(end+16);
 assert.equal(s.experience.busy,false);assert.equal(s.camera.suspended,false);assert.equal(s.camera.running,true);assert.equal(s.counts().restores,1);assert.equal(s.counts().starts,1);
 for(let t=0;t<=1000;t+=100){s.emit('open',end+100+t);s.experience.beforeFrame(end+100+t);}assert.equal(s.counts().morphs,1);
}));

test('visibility changes pause computation without requesting the camera again; explicit stop releases it',async()=>scene(async s=>{
 document.hidden=true;s.listeners.visibilitychange();s.experience.beforeFrame(performance.now());assert.equal(s.camera.suspended,true);assert.equal(s.counts().stops,0);
 document.hidden=false;s.listeners.visibilitychange();s.experience.beforeFrame(performance.now()+16);assert.equal(s.camera.suspended,false);assert.equal(s.counts().starts,1);
 s.callbacks.onStatus('error','权限未允许');assert.equal(s.element('gesture-panel').hidden,false);assert.equal(s.element('camera-start').disabled,false);assert.equal(s.counts().starts,1);
 s.element('camera-stop').onclick();assert.equal(s.camera.running,false);assert.equal(s.counts().stops,1);
}));

test('prepared particle data is reused and bounded to two mansions',()=>{
 const bytes=Buffer.alloc(9);bytes.writeUInt8(160,6);const item=id=>({id,count:1,data:bytes.toString('base64')});const stage=new StatueStage(),first=stage.prepare(item(0));
 assert.equal(stage.prepare(item(0)),first);stage.prepare(item(1));stage.prepare(item(2));assert.equal(stage.prepared.size,2);assert.equal(stage.prepared.has(0),false);assert.ok(first.packed.data.byteLength<4000000);
});

test('real coordinator supports every moving fingertip during generation and holding',async()=>scene(async s=>{
 const renderer=new StatueStage();renderer.timeline=s.stage.timeline;renderer.currentLayout=renderer.layout(1000,800);renderer.bounds={minX:-.3,maxX:.3,minY:-.48,maxY:.48};s.stage.interactFingers=(...args)=>renderer.interactFingers(...args);
 await s.element('morph-trigger').onclick();const start=s.stage.timeline.started;
 function emit(time,points,count=1){s.experience.draw(null,time,1000,800,null,false);s.experience.beforeFrame(time);s.callbacks.onSample(describeHand(points,.96,count),time,null,count);}
 for(const [i,finger]of Object.keys(tipIds).entries()){
  const time=start+200+i*1450,p=handLandmarks();s.callbacks.onSample(null,time-1,null,0);emit(time,p);p[tipIds[finger]].x+=.025;emit(time+100,p);
 }
 for(const finger of Object.keys(tipIds))assert.equal(renderer.fingerRippleCount[finger],1);assert.equal(s.camera.suspended,false);
 const p=handLandmarks(),gathered=renderer.handRippleCount;s.callbacks.onSample(null,start+6950,null,0);emit(start+7000,p);for(const q of p)q.x+=.02;emit(start+7050,p);assert.equal(renderer.handRippleCount,gathered);
 p[12].x+=.02;emit(start+7650,p);assert.equal(renderer.handRippleCount,gathered+1);assert.ok(renderer.ripples.every(r=>r.strength<=.95&&r.spread===.55));const held=renderer.handRippleCount;
 emit(start+7800,p,2);emit(start+7850,p);assert.equal(renderer.handRippleCount,held);
 const leave=start+s.stage.timeline.duration.gather+s.stage.timeline.duration.hold+100;emit(leave,p);assert.equal(s.camera.suspended,true);p[12].x+=.03;emit(leave+100,p);assert.equal(renderer.handRippleCount,held);
 assert.equal(s.counts().morphs,1);assert.equal(s.counts().selectedCount,0);assert.equal(s.counts().starts,1);assert.equal(s.counts().stops,0);
}));

test('coordinator preserves a drag across brief uncertain poses instead of reanchoring each time',async()=>scene(async s=>{
 const base=performance.now()+1000;
 for(let t=0;t<=2400;t+=10){if(t%100===0)s.emit(t%500===200?'neutral':'open',base+t,.3+.12*Math.min(t,1800)/1000);s.experience.beforeFrame(base+t);}
 assert.ok(Math.abs(s.counts().panDistance-.216)<1e-8);assert.equal(s.counts().selectedCount,0);assert.equal(s.counts().morphs,0);
}));


test('Jiao loads its original poster asset and identifies its source in the existing stage UI',async()=>scene(async s=>{const spec=posterDefinition(0);assertOnlySelectedPoster(s,spec);await s.element('morph-trigger').onclick();assert.equal(s.stage.item.style,'jiao-poster');assert.equal(s.stage.item.id,0);assert.match(s.element('stage-credit').innerHTML,/用户提供海报/);assertOnlySelectedPoster(s,spec);assert.equal(s.counts().starts,1);},{poster:{id:0,name:'角',title:'角木蛟',pinyin:'Jiao Mu Jiao',style:'jiao-poster',count:96000},selectedId:0}));

test('Lou uses the newly supplied poster without fetching Jiao or any 3D model',async()=>scene(async s=>{await s.element('morph-trigger').onclick();assert.equal(s.stage.item.id,15);assert.equal(s.stage.item.style,'heritage-poster');assert.ok(s.requests.every(url=>!url.includes('jiao-poster')&&!url.includes('kang-3d')));}));

test('a failed poster stays in the sky without a legacy fallback and can be retried',async()=>scene(async s=>{
 const spec=posterDefinition(15);assertOnlySelectedPoster(s,spec);
 await s.element('morph-trigger').onclick();
 assertOnlySelectedPoster(s,spec,2);assert.equal(s.counts().morphs,0);assert.equal(s.stage.item,undefined);assert.equal(s.experience.busy,false);
 assert.equal(s.element('statue-stage-ui').hidden,true);assert.equal(s.classes.has('morphing'),false);assert.notEqual(s.element('morph-trigger').disabled,true);
 assert.match(s.notices.at(-1),new RegExp(spec.title+'海报素材暂未加载，请重试'));
 await s.element('morph-trigger').onclick();
 assertOnlySelectedPoster(s,spec,3);assert.equal(s.counts().morphs,1);assert.equal(s.stage.item.id,spec.id);assert.equal(s.stage.item.style,spec.style);
 assert.equal(s.element('statue-stage-ui').hidden,false);assert.equal(s.counts().starts,1);assert.equal(s.counts().stops,0);
},{selectedId:15,posterFailures:2}));

test('persistent live preview reuses the recognition video and exposes camera controls',async()=>scene(async s=>{
 assert.equal(s.cameraVideo,s.element('hand-video'));assert.equal(s.counts().starts,1);
 assert.equal(s.element('gesture-hud').hidden,false);assert.equal(s.element('gesture-hud')['data-camera-state'],'running');
 assert.equal(s.element('camera-placeholder').hidden,true);
 s.element('camera-card-control').onclick();assert.equal(s.element('gesture-panel').hidden,false);
 s.element('gesture-close').onclick();assert.equal(s.element('gesture-hud').hidden,false);assert.equal(s.counts().starts,1);
 await s.element('morph-trigger').onclick();assert.equal(s.element('gesture-hud').hidden,false);assert.equal(s.counts().starts,1);
 s.element('camera-stop').onclick();assert.equal(s.element('camera-placeholder').hidden,false);assert.equal(s.element('camera-card-control').textContent,'开启');
 s.element('camera-card-control').onclick();assert.equal(s.counts().starts,2);assert.equal(s.element('camera-placeholder').hidden,true);
 s.callbacks.onStatus('error','摄像头权限未允许');assert.equal(s.element('camera-card-control').textContent,'重试');assert.equal(s.element('camera-placeholder').hidden,false);
 s.callbacks.onStatus('loading','正在准备识别');assert.equal(s.element('camera-placeholder').hidden,false);
 s.element('hand-video').videoWidth=1280;s.element('hand-video').videoHeight=720;s.element('hand-video').onloadedmetadata();
 assert.equal(s.element('camera-viewport').style.aspectRatio,'1280/720');
 s.element('hand-video').onloadeddata();assert.equal(s.element('camera-placeholder').hidden,true);
}));

test('stage star diagram and editorial remain unchanged through hand and mouse particle interaction',async()=>scene(async s=>{
 await s.element('morph-trigger').onclick();
 const atlas=s.element('stage-atlas').innerHTML,record=s.element('stage-record').innerHTML;
 assert.match(atlas,/娄宿固定星点连线/);assert.match(record,/J2000/);assert.equal(s.element('stage-index').textContent,'MANSION 16 / 28');
 const time=s.stage.timeline.started;
 for(const t of [100,1000,3000,5600]){s.emit('open',time+t,.3+t*.00002);s.listeners.pointermove({clientX:300+t*.01,clientY:400,target:{id:'sky'}});s.experience.draw(null,time+t,1000,800,null,false);}
 assert.equal(s.element('stage-atlas').innerHTML,atlas);assert.equal(s.element('stage-record').innerHTML,record);assert.equal(s.counts().starts,1);
}));

for(const [id,name,title,pinyin] of [[1,'亢','亢金龙','Kang Jin Long'],[2,'氐','氐土貉','Di Tu He'],[3,'房','房日兔','Fang Ri Tu'],[4,'心','心月狐','Xin Yue Hu'],[5,'尾','尾火虎','Wei Huo Hu'],[6,'箕','箕水豹','Ji Shui Bao']]){
 test(title+' uses its own poster through the coordinator and retains the same camera session',async()=>scene(async s=>{
  const spec=posterDefinition(id);assertOnlySelectedPoster(s,spec);
  await s.element('morph-trigger').onclick();
  assert.equal(s.stage.item.id,id);assert.equal(s.stage.item.title,title);assert.equal(s.stage.item.style,'qinglong-poster');
  assert.ok(s.classes.has('jiao-poster'));assert.match(s.element('stage-credit').innerHTML,new RegExp(title));
  assert.match(s.element('stage-atlas').innerHTML,new RegExp(name+'宿固定星点连线'));
  assert.equal(s.requests.filter(u=>u.includes('data/qinglong/')).length,1);
  assert.ok(s.requests.every(u=>!u.includes('jiao-poster')&&!u.includes('3d')));
  const now=s.stage.timeline.started+100;
  s.listeners.pointermove({clientX:400,clientY:300,target:{id:'sky'}});s.experience.draw(null,now,1000,800,null,false);
  assertOnlySelectedPoster(s,spec);
  assert.equal(s.counts().morphs,1);assert.equal(s.counts().starts,1);assert.equal(s.counts().stops,0);
 },{poster:{id,name,title,pinyin,style:'qinglong-poster',count:96000},selectedId:id}));
}

for(const spec of POSTER_DEFINITIONS.filter(p=>p.id>=7)){
 test(spec.title+' maps its own poster, fixed constellation and regional color through generation and hold',async()=>scene(async s=>{
  assertOnlySelectedPoster(s,spec);
  await s.element('morph-trigger').onclick();
  assert.equal(s.stage.item.id,spec.id);assert.equal(s.stage.item.title,spec.title);assert.equal(s.stage.item.style,'heritage-poster');
  assert.ok(s.classes.has('heritage-poster'));assert.match(s.element('stage-credit').innerHTML,new RegExp(spec.title));
  assert.match(s.element('stage-atlas').innerHTML,new RegExp(spec.name+'宿固定星点连线'));assert.equal(s.requests.filter(u=>u===spec.url).length,1);
  const atlas=s.element('stage-atlas').innerHTML,time=s.stage.timeline.started;
  for(const t of [100,5600]){s.experience.draw(null,time+t,1000,800,null,false);s.listeners.pointermove({clientX:440,clientY:350,target:{id:'sky'}});}
  assertOnlySelectedPoster(s,spec);
  assert.equal(s.element('stage-atlas').innerHTML,atlas);assert.equal(s.counts().morphs,1);assert.equal(s.counts().starts,1);assert.equal(s.counts().stops,0);
 },{selectedId:spec.id}));
}
