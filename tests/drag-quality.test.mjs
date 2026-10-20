import test from 'node:test';
import assert from 'node:assert/strict';
import {HandNavigator} from '../dist/gesture-core.js';
import {GestureCamera} from '../dist/gesture-camera.js';
import {handLandmarks} from './hand-fixtures.mjs';
const pose=(x,kind='open')=>({pose:kind,palm:{x,y:.5},span:.15});
test('10 Hz measured movement becomes continuous display movement without speed bursts',()=>{
 const n=new HandNavigator(),speeds=[];let total=0;
 for(let t=0;t<=2400;t+=10){if(t%100===0)n.feed(pose(.3+.12*Math.min(t,1800)/1000),t);const d=n.step(t);total+=d.dx;if(t>=500&&t<1700)speeds.push(d.dx/.01);}
 assert.ok(speeds.every(v=>Math.abs(v-.12)<1e-8));assert.ok(Math.abs(total-.216)<1e-8);assert.deepEqual(n.step(2500),{dx:0,dy:0});
});
test('one uncertain hand pose or short loss does not drop part of the drag',()=>{
 for(const kind of ['neutral','missing']){const n=new HandNavigator();let total=0;
  for(let t=0;t<=2400;t+=10){if(t%100===0)n.feed(t%500===200?(kind==='missing'?null:pose(.3+.12*Math.min(t,1800)/1000,'neutral')):pose(.3+.12*Math.min(t,1800)/1000),t);total+=n.step(t).dx;}
  assert.ok(Math.abs(total-.216)<1e-8,kind);
 }
});
test('fist, pointing, prolonged uncertainty, long loss and relocated hands release the drag',()=>{
 for(const kind of ['fist','point']){const n=new HandNavigator();n.feed(pose(.3),0);n.feed(pose(.35),50);n.feed(pose(.36,kind),100);assert.equal(n.previous,null);assert.deepEqual(n.step(200),{dx:0,dy:0});}
 const n=new HandNavigator();n.feed(pose(.3),0);n.feed(pose(.31,'neutral'),100);n.feed(pose(.32,'neutral'),200);assert.equal(n.previous,null);
 n.feed(pose(.3),300);n.feed(null,500);assert.equal(n.previous,null);n.feed(pose(.6),550);assert.deepEqual(n.step(700),{dx:0,dy:0});
 n.feed(null,710);n.feed(pose(.8),750);assert.deepEqual(n.step(900),{dx:0,dy:0});
});
test('arrival jitter and capture latency never extrapolate beyond a measured palm position',()=>{
 const n=new HandNavigator();let total=0,next=0;const captures=[0,60,120,180,240,300,360],delays=[22,35,18,44,20,38,25];
 for(let now=0;now<=700;now+=5){while(next<captures.length&&captures[next]+delays[next]<=now){n.feed(pose(.3+captures[next]*.0003),captures[next],now);next++;}const d=n.step(now);assert.ok(d.dx>=-1e-10);total+=d.dx;const measured=next?captures[next-1]*.0003:0;assert.ok(total<=measured+1e-8);}
 assert.ok(Math.abs(total-.108)<1e-8);assert.deepEqual(n.step(1000),{dx:0,dy:0});
});
test('camera delivers capture timestamps and arrival latency to the resampler',()=>{
 let delivered;const c=new GestureCamera({},{onSample:(...args)=>delivered=args,onStatus(){}});
 const now=performance.now();c.deliver(handLandmarks(),.96,1,now-40,20);
 assert.equal(delivered[1],now-40);assert.ok(delivered[4].receivedAt>=now);assert.ok(c.latencyMs>=40);assert.equal(c.received,1);
});
test('worker capture keeps one frame in flight and does not poll while inference is busy',async()=>{
 const saved=globalThis.createImageBitmap;let posts=0,captures=0,closed=0,queued=0;
 globalThis.createImageBitmap=async()=>{captures++;return {close(){closed++;}};};
 const c=new GestureCamera({readyState:2,currentTime:1},{onSample(){},onStatus(){}});c.running=true;c.generation=4;c.worker={postMessage(){posts++;}};c.schedule=()=>queued++;
 try{await c.loop(4);await c.loop(4);assert.equal(captures,1);assert.equal(posts,1);assert.equal(c.busy,true);assert.equal(queued,0);assert.equal(closed,0);}
 finally{globalThis.createImageBitmap=saved;}
});
test('duplicate video frames are skipped, and stop invalidates pending bitmap captures',async()=>{
 const saved=globalThis.createImageBitmap;let captures=0,closed=0,posts=0;
 globalThis.createImageBitmap=async()=>{captures++;return {close(){closed++;}};};
 const c=new GestureCamera({readyState:2,currentTime:1,pause(){}},{onSample(){},onStatus(){}});c.running=true;c.generation=1;c.lastVideoTime=1;c.schedule=()=>{};
 try{await c.loop(1);assert.equal(captures,0);
  let finish;globalThis.createImageBitmap=()=>new Promise(r=>finish=r);c.video.currentTime=2;c.worker={postMessage(){posts++;},terminate(){}};
  const pending=c.loop(1);c.stop();finish({close(){closed++;}});await pending;assert.equal(posts,0);assert.equal(closed,1);
 }finally{globalThis.createImageBitmap=saved;}
});
