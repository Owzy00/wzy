import test from 'node:test';
import assert from 'node:assert/strict';
import {initExperience} from '../dist/experience.js';
import {MorphTimeline,StatueStage} from '../dist/particle-effects.js';

// Exercise the real experience coordinator with camera callbacks and the real timeline.
// The small DOM facade lets the test control visibility and permission errors without a camera.
async function scene(run){
 const names=['document','window','fetch','requestIdleCallback','cancelIdleCallback'],saved=new Map(names.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
 const elements=new Map(),listeners={},classes=new Set(),idle=[];
 const element=id=>{if(!elements.has(id))elements.set(id,{id,hidden:['gesture-panel','statue-stage-ui','gesture-hud'].includes(id),style:{},value:0,textContent:'',setAttribute(name,value){this[name]=value;},focus(){},getContext(){return {};}});return elements.get(id);};
 const main={inert:false},bottom={inert:false};
 globalThis.document={hidden:false,body:{style:{setProperty(){}},insertAdjacentHTML(){},classList:{toggle(name,value){if(value)classes.add(name);else classes.delete(name);},add(name){classes.add(name);},remove(name){classes.delete(name);}}},getElementById:element,querySelector:selector=>selector==='main'?main:bottom,addEventListener:(name,callback)=>listeners[name]=callback};
 globalThis.window={addEventListener:(name,callback)=>listeners[name]=callback};
 globalThis.fetch=async()=>({ok:true,json:async()=>({items:Array.from({length:28},(_,id)=>({id,name:'宿'+id,title:'彩塑'+id,pinyin:'test'}))})});
 globalThis.requestIdleCallback=callback=>idle.push(callback);globalThis.cancelIdleCallback=()=>{};
 let callbacks,selected=3,selectedCount=0,panDistance=0,morphs=0,starts=0,stops=0,restores=0,touches=0;
 const stage={timeline:new MorphTimeline(),get busy(){return this.timeline.busy;},get occludesSky(){return this.busy;},prepare(){},interact(){touches++;},start(item,now){if(!this.timeline.start(now))return false;this.item=item;morphs++;return true;},draw(ctx,now){return this.timeline.sample(now);},finish(now){this.timeline.finish(now);},pointer:{}};
 const camera={running:false,inferenceMs:30,async start(){starts++;this.running=true;callbacks.onStatus('running','已接入');},stop(){stops++;this.running=false;callbacks.onStatus('off','已关闭');}};
 const adapter={selected:()=>({id:selected,name:'宿'+selected}),blocked:()=>false,notice(){},ensureDust(){},stopNavigation(){},selectNearest(){selected=9;selectedCount++;return selected;},nearest:()=>9,mansionName:id=>'宿'+id,pan(dx,dy){panDistance+=Math.hypot(dx,dy);},snapshot:()=>({camera:{ra:1.2,dec:.1}}),restore(snapshot){assert.equal(snapshot.camera.ra,1.2);restores++;}};
 try{
  const experience=initExperience(adapter,{cameraFactory:(video,c)=>{callbacks=c;return camera;},stageFactory:()=>stage});
  await new Promise(resolve=>setImmediate(resolve));
  await run({experience,stage,camera,element,listeners,classes,callbacks,counts:()=>({starts,stops,morphs,selectedCount,panDistance,restores,touches}),emit:(pose,time,x=.5)=>callbacks.onSample(pose?{pose,palm:{x,y:.5},span:.15}:null,time,null,pose?1:0)});
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
 assert.equal(s.counts().morphs,1);assert.equal(s.experience.busy,true);s.experience.beforeFrame(base+1500);assert.equal(s.camera.suspended,true);assert.equal(s.counts().stops,0);
 const hold=s.stage.timeline.started+3500;s.experience.draw(null,hold,1000,800,null,false);s.experience.beforeFrame(hold+16);assert.equal(s.camera.suspended,false);const touches=s.counts().touches;s.emit('open',hold+50);assert.equal(s.counts().touches,touches+1);assert.equal(s.counts().morphs,1);
 const end=s.stage.timeline.started+9500;s.experience.draw(null,end,1000,800,null,false);s.experience.beforeFrame(end+16);
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
