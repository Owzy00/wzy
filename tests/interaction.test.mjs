import test from 'node:test';
import assert from 'node:assert/strict';
import {initExperience} from '../dist/experience.js';
import {MorphTimeline,StatueStage} from '../dist/particle-effects.js';
import {describeHand} from '../dist/gesture-core.js';

// Exercise the real experience coordinator with camera callbacks and the real timeline.
// The small DOM facade lets the test control visibility and permission errors without a camera.
async function scene(run){
 const names=['document','window','fetch','requestIdleCallback','cancelIdleCallback','innerWidth','innerHeight'],saved=new Map(names.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
 globalThis.innerWidth=1000;globalThis.innerHeight=800;
 const styles={},elements=new Map(),listeners={},classes=new Set(),idle=[];
 const element=id=>{if(!elements.has(id))elements.set(id,{id,hidden:['gesture-panel','statue-stage-ui','gesture-hud'].includes(id),style:{},value:0,textContent:'',setAttribute(name,value){this[name]=value;},focus(){},getContext(){return {};}});return elements.get(id);};
 const main={inert:false},bottom={inert:false};
 globalThis.document={hidden:false,body:{style:{setProperty(key,value){styles[key]=value;}},insertAdjacentHTML(){},classList:{toggle(name,value){if(value)classes.add(name);else classes.delete(name);},add(name){classes.add(name);},remove(name){classes.delete(name);}}},getElementById:element,querySelector:selector=>selector==='main'?main:bottom,addEventListener:(name,callback)=>listeners[name]=callback};
 globalThis.window={addEventListener:(name,callback)=>listeners[name]=callback};
 globalThis.fetch=async()=>({ok:true,json:async()=>({items:Array.from({length:28},(_,id)=>({id,name:'宿'+id,title:'彩塑'+id,pinyin:'test'}))})});
 globalThis.requestIdleCallback=callback=>idle.push(callback);globalThis.cancelIdleCallback=()=>{};
 let callbacks,selected=3,selectedCount=0,panDistance=0,morphs=0,starts=0,stops=0,restores=0,touches=0;
 const stage={timeline:new MorphTimeline(),get busy(){return this.timeline.busy;},get occludesSky(){return this.busy;},prepare(){},interact(...args){this.lastInteraction=args;(this.interactions??=[]).push(args);touches++;},interactFingers(inputs,now,palm){this.lastFingers=inputs;this.interact(palm.x,palm.y,now,Math.max(0,...inputs.map(p=>p.strength)),'hand');},start(item,now,sources){this.sources=sources;if(!this.timeline.start(now))return false;this.item=item;morphs++;return true;},draw(ctx,now){return this.timeline.sample(now);},finish(now){this.timeline.finish(now);},pointer:{}};
 const camera={running:false,inferenceMs:30,async start(){starts++;this.running=true;callbacks.onStatus('running','已接入');},stop(){stops++;this.running=false;callbacks.onStatus('off','已关闭');}};
 const adapter={emissionSources:()=>[{x:.3,y:.4},{x:.5,y:.6}],selected:()=>({id:selected,name:'宿'+selected}),blocked:()=>false,notice(){},ensureDust(){},stopNavigation(){},selectNearest(){selected=9;selectedCount++;return selected;},nearest:()=>9,mansionName:id=>'宿'+id,pan(dx,dy){panDistance+=Math.hypot(dx,dy);},snapshot:()=>({camera:{ra:1.2,dec:.1}}),restore(snapshot){assert.equal(snapshot.camera.ra,1.2);restores++;}};
 try{
  const experience=initExperience(adapter,{cameraFactory:(video,c)=>{callbacks=c;return camera;},stageFactory:()=>stage});
  await new Promise(resolve=>setImmediate(resolve));
  await run({styles,experience,stage,camera,element,listeners,classes,callbacks,counts:()=>({starts,stops,morphs,selectedCount,panDistance,restores,touches}),emit:(pose,time,x=.5)=>callbacks.onSample(pose?{pose,palm:{x,y:.5},fingers:{index:{x:x+.02,y:.5,extended:true},ring:{x:x-.02,y:.5,extended:true}},span:.15}:null,time,null,pose?1:0)});
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
 assert.deepEqual(s.stage.sources,[{x:.3,y:.4},{x:.5,y:.6}]);const gatheringTouches=s.counts().touches;s.emit('open',base+1550,.53);s.emit('open',base+1600,.59);assert.ok(s.stage.interactions.slice(-3).some(args=>args[3]>.18));assert.equal(s.counts().touches,gatheringTouches+2);assert.equal(s.counts().panDistance,moved);assert.equal(s.counts().selectedCount,1);
 const hold=s.stage.timeline.started+s.stage.timeline.duration.gather+700;s.experience.draw(null,hold,1000,800,null,false);s.experience.beforeFrame(hold+16);assert.equal(s.camera.suspended,false);assert.ok(Number(s.styles['--stage-sky-opacity'])>=.5);assert.equal(s.styles['--stage-scale'],'1');const touches=s.counts().touches;s.emit('open',hold+50);assert.equal(s.counts().touches,touches+1);assert.equal(s.counts().morphs,1);s.emit('open',hold+100,.55);s.emit('open',hold+150,.61);assert.ok(s.stage.interactions.slice(-3).some(args=>args[3]>.18));assert.equal(s.stage.lastInteraction[3],0);s.listeners.pointermove({clientX:400,clientY:400,target:{id:'sky'}});s.listeners.pointermove({clientX:500,clientY:400,target:{id:'sky'}});assert.ok(s.stage.lastInteraction[3]>.18);assert.equal(s.counts().selectedCount,1);assert.equal(s.counts().morphs,1);
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

test('real landmark samples at 2 FPS create real stage ripples during generation and holding',async()=>scene(async s=>{
 const renderer=new StatueStage();renderer.timeline=s.stage.timeline;renderer.currentLayout=renderer.layout(1000,800);renderer.bounds={minX:-.3,maxX:.3,minY:-.48,maxY:.48};s.stage.interactFingers=(...args)=>renderer.interactFingers(...args);
 await s.element('morph-trigger').onclick();const start=s.stage.timeline.started;
 function emitLandmarks(time,dx=0,count=1){
  const points=Array.from({length:21},()=>({x:.5+dx,y:.67,z:0}));points[0]={x:.5+dx,y:.72};for(const [i,mcp]of [5,9,13,17].entries()){const x=.35+i*.12+dx;points[mcp]={x,y:.52};points[mcp+1]={x,y:.32};points[mcp+2]={x,y:.17};points[mcp+3]={x,y:.04};}
  const sample=describeHand(points,.96,count);s.callbacks.onSample(sample,time,null,count);
 }
 for(let i=0;i<5;i++){const time=start+500+i*500;s.experience.draw(null,time,1000,800,null,false);s.experience.beforeFrame(time);assert.equal(s.camera.suspended,false);emitLandmarks(time,i*.01);}
 assert.ok(renderer.fingerRippleCount.index>=3);assert.ok(renderer.fingerRippleCount.ring>=3);assert.ok(renderer.ripples.every(r=>['index','ring'].includes(r.finger)));assert.ok(renderer.ripples.every(r=>r.strength>=.7));const gathered=renderer.handRippleCount;
 const hold=start+s.stage.timeline.duration.gather;
 for(let i=0;i<4;i++){const time=hold+100+i*500;s.experience.draw(null,time,1000,800,null,false);s.experience.beforeFrame(time);emitLandmarks(time,.04+i*.01);}
 assert.ok(renderer.handRippleCount>gathered);const held=renderer.handRippleCount;emitLandmarks(hold+1800,.08,2);emitLandmarks(hold+2000,.09);assert.equal(renderer.handRippleCount,held);
 const leave=hold+s.stage.timeline.duration.hold+100;s.experience.draw(null,leave,1000,800,null,false);s.experience.beforeFrame(leave);assert.equal(s.camera.suspended,true);emitLandmarks(leave+500,.12);assert.equal(renderer.handRippleCount,held);
 assert.equal(s.counts().morphs,1);assert.equal(s.counts().selectedCount,0);assert.equal(s.counts().starts,1);assert.equal(s.counts().stops,0);
}));
