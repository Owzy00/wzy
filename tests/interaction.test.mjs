import test from 'node:test';
import assert from 'node:assert/strict';
import {initExperience} from '../dist/experience.js';
import {MorphTimeline,StatueStage} from '../dist/particle-effects.js';
import {describeHand} from '../dist/gesture-core.js';
import {handLandmarks,tipIds} from './hand-fixtures.mjs';

// Exercise the real experience coordinator with camera callbacks and the real timeline.
// The small DOM facade lets the test control visibility and permission errors without a camera.
async function scene(run,{poster=null,selectedId=3}={}){
 const names=['document','window','fetch','requestIdleCallback','cancelIdleCallback','innerWidth','innerHeight'],saved=new Map(names.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
 globalThis.innerWidth=1000;globalThis.innerHeight=800;
 const requests=[];const styles={},elements=new Map(),listeners={},classes=new Set(),idle=[];
 const element=id=>{if(!elements.has(id))elements.set(id,{id,hidden:['gesture-panel','statue-stage-ui','gesture-hud'].includes(id),style:{},value:0,textContent:'',setAttribute(name,value){this[name]=value;},focus(){},getContext(){return {};}});return elements.get(id);};
 const main={inert:false},bottom={inert:false};
 globalThis.document={hidden:false,body:{style:{setProperty(key,value){styles[key]=value;}},insertAdjacentHTML(){},classList:{toggle(name,value){if(value)classes.add(name);else classes.delete(name);},add(name){classes.add(name);},remove(name){classes.delete(name);}}},getElementById:element,querySelector:selector=>selector==='main'?main:bottom,addEventListener:(name,callback)=>listeners[name]=callback};
 globalThis.window={addEventListener:(name,callback)=>listeners[name]=callback};
 globalThis.fetch=async url=>{requests.push(url);return {ok:true,json:async()=>url.includes('jiao-poster')?poster:({items:Array.from({length:28},(_,id)=>({id,name:poster&&id===0?'角':'宿'+id,title:'彩塑'+id,pinyin:'test'}))})};};
 globalThis.requestIdleCallback=callback=>idle.push(callback);globalThis.cancelIdleCallback=()=>{};
 let callbacks,selected=selectedId,selectedCount=0,panDistance=0,morphs=0,starts=0,stops=0,restores=0,touches=0;
 const stage={timeline:new MorphTimeline(),get busy(){return this.timeline.busy;},get occludesSky(){return this.busy;},prepare(){},interact(...args){this.lastInteraction=args;(this.interactions??=[]).push(args);touches++;},interactFingers(inputs,now,palm){this.lastFingers=inputs;this.interact(palm.x,palm.y,now,Math.max(0,...inputs.map(p=>p.strength)),'hand');},start(item,now,sources){this.sources=sources;if(!this.timeline.start(now))return false;this.item=item;morphs++;return true;},draw(ctx,now){return this.timeline.sample(now);},finish(now){this.timeline.finish(now);},pointer:{}};
 const camera={running:false,inferenceMs:30,async start(){starts++;this.running=true;callbacks.onStatus('running','已接入');},stop(){stops++;this.running=false;callbacks.onStatus('off','已关闭');}};
 const adapter={emissionSources:()=>[{x:.3,y:.4},{x:.5,y:.6}],selected:()=>({id:selected,name:poster&&selected===0?'角':'宿'+selected}),blocked:()=>false,notice(){},ensureDust(){},stopNavigation(){},selectNearest(){selected=9;selectedCount++;return selected;},nearest:()=>9,mansionName:id=>'宿'+id,pan(dx,dy){panDistance+=Math.hypot(dx,dy);},snapshot:()=>({camera:{ra:1.2,dec:.1}}),restore(snapshot){assert.equal(snapshot.camera.ra,1.2);restores++;}};
 try{
  const experience=initExperience(adapter,{cameraFactory:(video,c)=>{callbacks=c;return camera;},stageFactory:()=>stage});
  await new Promise(resolve=>setImmediate(resolve));
  await run({requests,styles,experience,stage,camera,element,listeners,classes,callbacks,counts:()=>({starts,stops,morphs,selectedCount,panDistance,restores,touches}),emit:(pose,time,x=.5)=>callbacks.onSample(pose?{pose,palm:{x,y:.5},fingers:{index:{x:x+.02,y:.5,extended:true},ring:{x:x-.02,y:.5,extended:true}},span:.15,confidence:.95}:null,time,null,pose?1:0)});
 }finally{for(const [name,descriptor]of saved){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}}
}

test('one camera session supports navigation, fist selection, palm morph and automatic return',async()=>scene(async s=>{
 assert.equal(s.counts().starts,1);s.element('gesture-toggle').onclick();s.element('gesture-close').onclick();assert.equal(s.counts().stops,0);assert.equal(s.camera.running,true);
 const base=performance.now()+1000;
 for(let t=0;t<=500;t+=50){s.emit('open',base+t,.3+t*.0003);s.experience.beforeFrame(base+t);}
 assert.ok(s.counts().panDistance>.05);const moved=s.counts().panDistance;
 for(let t=550;t<=1100;t+=50){s.emit('fist',base+t);s.experience.beforeFrame(base+t);}
 assert.equal(s.counts().selectedCount,1);assert.equal(s.counts().morphs,0);assert.equal(s.counts().panDistance,moved);
 for(let t=1150;t<=1400;t+=50)s.emit('open',base+t);
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


test('only Jiao loads the poster asset and identifies its source in the existing stage UI',async()=>scene(async s=>{await s.element('morph-trigger').onclick();assert.equal(s.stage.item.style,'jiao-poster');assert.equal(s.stage.item.id,0);assert.match(s.element('stage-credit').innerHTML,/用户提供海报/);assert.equal(s.requests.filter(url=>url.includes('jiao-poster')).length,1);assert.equal(s.counts().starts,1);},{poster:{id:0,name:'角',title:'角木蛟',pinyin:'Jiao Mu Jiao',style:'jiao-poster'},selectedId:0}));

test('other mansions retain the v21 image path without fetching Jiao or any 3D model',async()=>scene(async s=>{await s.element('morph-trigger').onclick();assert.equal(s.stage.item.id,3);assert.equal(s.stage.item.style,undefined);assert.ok(s.requests.every(url=>!url.includes('jiao-poster')&&!url.includes('kang-3d')));}));
