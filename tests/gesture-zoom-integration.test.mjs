import test from 'node:test';
import assert from 'node:assert/strict';
import {initExperience} from '../dist/experience.js';
import {describeHand} from '../dist/gesture-core.js';
import {MorphTimeline} from '../dist/particle-effects.js';
import {POSTER_DEFINITIONS,posterDefinition} from '../dist/qinglong-posters.js';
import {handLandmarks} from './hand-fixtures.mjs';

// Camera landmarks flow through the real coordinator. No zoom-module internals
// are mocked: these checks protect arbitration with navigation and morphing.
function zoomHand(gap=.8,{dx=0,dy=0,scale=1}={}){
 const p=handLandmarks();for(const id of [12,16,20])p[id].y=.74;
 p[2]={x:.40,y:.70,z:0};p[3]={x:.36,y:.53,z:0};p[4]={x:p[8].x-gap*.15,y:p[8].y,z:0};
 return p.map(point=>({x:.5+(point.x-.5)*scale+dx,y:.7+(point.y-.7)*scale+dy,z:(point.z||0)*scale}));
}
function fistHand(){const p=handLandmarks();for(const id of [8,12,16,20])p[id].y=.74;p[4]={x:.49,y:.73,z:0};return p;}

async function zoomScene(run,{deferPoster=false}={}){
 const names=['document','window','fetch','innerWidth','innerHeight','matchMedia','requestIdleCallback','cancelIdleCallback'],saved=new Map(names.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
 const elements=new Map(),events=new Map(),classes=new Set(),requests=[],zooms=[],pans=[],notices=[];
 let callbacks,selected=15,blocked=false,starts=0,stops=0,morphs=0,selections=0,stoppedNavigation=0,fingerFrames=0,clock=performance.now()+1000;
 const base=clock;let releasePoster;const posterGate=deferPoster?new Promise(resolve=>releasePoster=resolve):Promise.resolve();
 const element=id=>{if(!elements.has(id))elements.set(id,{id,hidden:['gesture-panel','statue-stage-ui','gesture-hud'].includes(id),style:{},textContent:'',value:0,setAttribute(name,value){this[name]=value;},focus(){},getContext(){return {clearRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},arc(){},fill(){}};}});return elements.get(id);};
 const listen=(type,listener)=>{if(!events.has(type))events.set(type,[]);events.get(type).push(listener);};
 const surface={inert:false};
 globalThis.document={hidden:false,body:{style:{setProperty(){}},insertAdjacentHTML(){},classList:{add:name=>classes.add(name),remove:name=>classes.delete(name),contains:name=>classes.has(name),toggle(name,value){const on=value??!classes.has(name);if(on)classes.add(name);else classes.delete(name);return on;}}},getElementById:element,querySelector:()=>surface,addEventListener:listen};
 globalThis.window={addEventListener:listen};globalThis.innerWidth=1000;globalThis.innerHeight=800;globalThis.matchMedia=()=>({matches:false});
 globalThis.requestIdleCallback=()=>0;globalThis.cancelIdleCallback=()=>{};
 globalThis.fetch=async url=>{requests.push(url);await posterGate;const spec=POSTER_DEFINITIONS.find(p=>p.url===url);assert.ok(spec,'only a known poster may be loaded');return {ok:true,json:async()=>({...spec,count:96000})};};
 const stage={timeline:new MorphTimeline(),get busy(){return this.timeline.busy;},get occludesSky(){return this.busy;},prepare(){},pointer:{},interact(){},interactFingers(){fingerFrames++;},start(item,now){if(!this.timeline.start(now))return false;this.item=item;morphs++;return true;},draw(context,now){return this.timeline.sample(now);},finish(now){this.timeline.finish(now);}};
 const camera={running:false,inferenceMs:30,async start(){starts++;this.running=true;callbacks.onStatus('running','已接入');},stop(){stops++;this.running=false;callbacks.onSample(null,++clock,null,0);callbacks.onStatus('off','已关闭');}};
 const adapter={selected:()=>({id:selected,name:posterDefinition(selected).name}),stageDetails:()=>({id:selected,name:posterDefinition(selected).name,group:Math.floor(selected/7),members:[{id:1,ra:1,dec:.1,mag:1},{id:2,ra:1.02,dec:.15,mag:2}],center:{ra:1.01,dec:.125},lines:[[1,2]]}),blocked:()=>blocked,notice:text=>notices.push(text),nearest:()=>9,mansionName:id=>posterDefinition(id).name,stopNavigation(){stoppedNavigation++;},selectNearest(){selections++;selected=9;return selected;},pan:(dx,dy)=>pans.push({dx,dy}),zoom:factor=>zooms.push(factor),snapshot:()=>({camera:{ra:1,dec:0}}),restore(){}};
 try{
  const experience=initExperience(adapter,{cameraFactory:(video,c)=>{callbacks=c;return camera;},stageFactory:()=>stage});
  await new Promise(resolve=>setImmediate(resolve));
  const emit=(points,time,{confidence=.96,handCount=points?1:0,timing={}}={})=>{clock=time;callbacks.onSample(points?describeHand(points,confidence,handCount):null,time,points,handCount,{receivedAt:time,...timing});experience.beforeFrame(time);};
  await run({base,experience,stage,camera,callbacks,element,emit,zooms,pans,requests,notices,releasePoster,setBlocked:value=>blocked=value,dispatch:(type,event={})=>{for(const callback of events.get(type)||[])callback(event);},frame:time=>{clock=time;experience.beforeFrame(time);},counts:()=>({starts,stops,morphs,selections,stoppedNavigation,fingerFrames})});
 }finally{releasePoster?.();for(const [name,descriptor]of saved){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}}
}

function armZoom(s,time=s.base,gap=.8){for(const offset of [0,60,120])s.emit(zoomHand(gap),time+offset);}
const realZooms=s=>s.zooms.filter(factor=>Math.abs(factor-1)>1e-8);
function noOtherAction(s){assert.equal(s.pans.length,0);assert.equal(s.counts().selections,0);assert.equal(s.counts().morphs,0);}

test('stable single-hand opening and closing reaches only the zoom adapter',async()=>zoomScene(async s=>{
 armZoom(s);assert.equal(realZooms(s).length,0,'activation establishes a distance baseline');
 s.emit(zoomHand(1.1),s.base+180);s.emit(zoomHand(1.35),s.base+240);
 assert.ok(realZooms(s).some(factor=>factor<1),'opening enlarges the sky');const count=realZooms(s).length;
 s.emit(zoomHand(.9),s.base+300);s.emit(zoomHand(.6),s.base+360);
 assert.ok(realZooms(s).slice(count).some(factor=>factor>1),'closing reduces the sky');
 s.frame(s.base+650);assert.ok(s.zooms.every(factor=>Number.isFinite(factor)&&factor>0));noOtherAction(s);assert.equal(s.counts().starts,1);assert.equal(s.counts().stops,0);
}));

test('an unstable L pose never starts zooming or selects a mansion',async()=>zoomScene(async s=>{
 s.emit(zoomHand(),s.base);s.emit(zoomHand(1.3),s.base+50);s.emit(handLandmarks(),s.base+90);s.frame(s.base+350);
 assert.equal(realZooms(s).length,0);noOtherAction(s);
}));

test('whole-hand travel and apparent camera depth changes do not change aperture zoom',async()=>zoomScene(async s=>{
 armZoom(s);for(const [offset,options]of [[180,{dx:.02,dy:.01}],[240,{dx:.04,dy:.02,scale:1.1}],[300,{dx:.05,dy:.03,scale:1.2}]])s.emit(zoomHand(.8,options),s.base+offset);
 s.frame(s.base+600);assert.equal(realZooms(s).length,0);noOtherAction(s);
}));

test('full-palm release reanchors navigation before a later palm drag',async()=>zoomScene(async s=>{
 armZoom(s);s.emit(zoomHand(1.15),s.base+180);const zoomCount=realZooms(s).length;
 s.emit(handLandmarks({dx:.06}),s.base+240);s.frame(s.base+280);assert.equal(s.pans.length,0);
 s.emit(handLandmarks({dx:.06}),s.base+300);s.frame(s.base+350);assert.equal(s.pans.length,0);
 s.emit(handLandmarks({dx:.08}),s.base+400);s.frame(s.base+650);
 assert.ok(s.pans.some(p=>Math.hypot(p.dx,p.dy)>0));assert.equal(realZooms(s).length,zoomCount);assert.equal(s.counts().selections,0);assert.equal(s.counts().morphs,0);
}));

test('closing the zoom hand is swallowed until a full palm permits a fresh fist-to-morph sequence',async()=>zoomScene(async s=>{
 armZoom(s);s.emit(zoomHand(1.1),s.base+180);
 for(let offset=240;offset<=900;offset+=60)s.emit(fistHand(),s.base+offset);
 assert.equal(s.counts().selections,0);assert.equal(s.counts().morphs,0);
 for(let offset=960;offset<=1200;offset+=60)s.emit(handLandmarks(),s.base+offset);
 assert.equal(s.counts().selections,0);assert.equal(s.counts().morphs,0);
 for(let offset=1300;offset<=1800;offset+=50)s.emit(fistHand(),s.base+offset);
 assert.equal(s.counts().selections,1);
 for(let offset=1850;offset<=2150;offset+=50)s.emit(handLandmarks(),s.base+offset);
 await new Promise(resolve=>setImmediate(resolve));assert.equal(s.counts().morphs,1);assert.equal(s.counts().starts,1);
}));

test('an already armed fist keeps priority over a potential zoom pose and still morphs once',async()=>zoomScene(async s=>{
 for(let offset=0;offset<=500;offset+=50)s.emit(fistHand(),s.base+offset);assert.equal(s.counts().selections,1);
 for(const offset of [530,590,650])s.emit(zoomHand(.8),s.base+offset);
 for(let offset=700;offset<=1000;offset+=50)s.emit(handLandmarks(),s.base+offset);
 await new Promise(resolve=>setImmediate(resolve));assert.equal(realZooms(s).length,0);assert.equal(s.counts().morphs,1);assert.equal(s.counts().selections,1);
}));

for(const phase of ['GATHERING','HOLDING','RETURNING']){
 test('camera pinch cannot zoom or navigate during '+phase,async()=>zoomScene(async s=>{
  await s.element('morph-trigger').onclick();const time=s.stage.timeline.started+({GATHERING:100,HOLDING:5000,RETURNING:9500}[phase]);
  s.experience.draw(null,time,1000,800,null,false);assert.equal(s.stage.timeline.state,phase);
  armZoom(s,time);s.emit(zoomHand(1.2),time+180);s.frame(time+400);
  assert.equal(realZooms(s).length,0);assert.equal(s.pans.length,0);assert.equal(s.counts().selections,0);assert.equal(s.counts().morphs,1);
  if(phase!=='RETURNING')assert.ok(s.counts().fingerFrames>0,'existing v30 fingertip input remains available');
 }));
}

test('poster preparation blocks pinch input before the stage has started',async()=>zoomScene(async s=>{
 const pending=s.element('morph-trigger').onclick();await new Promise(resolve=>setImmediate(resolve));assert.equal(s.experience.busy,true);assert.equal(s.stage.busy,false);
 armZoom(s);s.emit(zoomHand(1.2),s.base+180);assert.equal(realZooms(s).length,0);noOtherAction(s);
 s.releasePoster();await pending;assert.equal(s.counts().morphs,1);
},{deferPoster:true}));

for(const interruption of ['missing','low confidence','two hands','uncertain finger']){
 test(interruption+' freezes zoom and reacquisition never uses the old distance baseline',async()=>zoomScene(async s=>{
  armZoom(s);s.emit(zoomHand(1.15),s.base+180);const count=realZooms(s).length;
  if(interruption==='missing')s.emit(null,s.base+240);
  else if(interruption==='uncertain finger'){const points=zoomHand(.45);points[12].y=.54;s.emit(points,s.base+240);}
  else s.emit(zoomHand(.45),s.base+240,interruption==='two hands'?{handCount:2}:{confidence:.5});
  assert.equal(realZooms(s).length,count);
  s.emit(zoomHand(.45),s.base+300);assert.equal(realZooms(s).length,count,'the first valid sample only reanchors');
  s.frame(s.base+500);noOtherAction(s);
 }));
}

for(const reset of ['capture dimensions','video resize']){
 test(reset+' resets the pinch baseline without a zoom jump',async()=>zoomScene(async s=>{
  armZoom(s);s.emit(zoomHand(1.15),s.base+180);const count=realZooms(s).length;
  if(reset==='capture dimensions')s.emit(null,s.base+240,{timing:{reset:true}});else s.element('hand-video').onresize();
  s.emit(zoomHand(.4),s.base+300);assert.equal(realZooms(s).length,count);noOtherAction(s);
 }));
}

for(const state of ['blocked','hidden','camera off']){
 test(state+' suppresses zoom and reopening starts from a fresh baseline',async()=>zoomScene(async s=>{
  armZoom(s);s.emit(zoomHand(1.15),s.base+180);const count=realZooms(s).length;
  if(state==='blocked')s.setBlocked(true);else if(state==='hidden'){document.hidden=true;s.dispatch('visibilitychange');}else s.camera.stop();
  armZoom(s,s.base+300,.45);s.emit(zoomHand(1.3),s.base+480);assert.equal(realZooms(s).length,count);noOtherAction(s);
  if(state==='blocked')s.setBlocked(false);else if(state==='hidden'){document.hidden=false;s.dispatch('visibilitychange');}else await s.camera.start();
  s.emit(zoomHand(.4),s.base+600);assert.equal(realZooms(s).length,count);noOtherAction(s);
 }));
}

test('page suspension releases the camera and restored pages do not inherit the pinch distance',async()=>zoomScene(async s=>{
 armZoom(s);s.emit(zoomHand(1.15),s.base+180);const count=realZooms(s).length;
 s.dispatch('pagehide');assert.equal(s.camera.running,false);s.dispatch('pageshow',{persisted:true});assert.equal(s.camera.running,true);
 s.emit(zoomHand(.4),s.base+300);assert.equal(realZooms(s).length,count);noOtherAction(s);assert.equal(s.counts().starts,2);assert.equal(s.counts().stops,1);
}));
