import test from 'node:test';
import assert from 'node:assert/strict';
import {describeHand,FingerParticleInput,FINGER_TIPS} from '../dist/gesture-core.js';
import {StatueStage} from '../dist/particle-effects.js';
import {handLandmarks,tipIds} from './hand-fixtures.mjs';
const fingers=Object.keys(tipIds);
const hand=p=>describeHand(p,.96,1);
function wave(finger,options={}){
 const input=new FingerParticleInput(),base=handLandmarks(options);input.feed(hand(base),0);
 base[tipIds[finger]].x+=.025;return input.feed(hand(base),100);
}
test('all five fingertips are mirrored independently without mutating raw landmarks',()=>{
 const p=handLandmarks(),before=JSON.stringify(p),sample=hand(p);assert.deepEqual(FINGER_TIPS,tipIds);assert.deepEqual(Object.keys(sample.fingers),fingers);
 for(const [finger,id]of Object.entries(tipIds)){const {local,...tip}=sample.fingers[finger];assert.deepEqual(tip,{x:1-p[id].x,y:p[id].y,z:0});assert.ok(Object.values(local).every(Number.isFinite));}
 assert.equal(JSON.stringify(p),before);
});
test('a wiggle of any single finger emits at that fingertip, without a tap or extension gate',()=>{
 for(const finger of fingers)for(const folded of [false,true]){
  const output=wave(finger,folded?{index:.18,middle:.18,ring:.18,pinky:.18}:{});assert.equal(output.length,1);assert.equal(output[0].finger,finger);assert.equal(output[0].motion,true);assert.ok(output[0].strength>=.65&&output[0].strength<=.95);
 }
});
test('depth motion also counts without requiring a press and rebound',()=>{
 const input=new FingerParticleInput(),p=handLandmarks();input.feed(hand(p),0);p[12].z=-.05;
 assert.equal(input.feed(hand(p),100)[0].finger,'middle');
});
test('stationary recognition, small jitter, and a changed palm with fixed fingertips stay quiet',()=>{
 const input=new FingerParticleInput();
 for(let i=0;i<200;i++){const p=handLandmarks();for(const id of Object.values(tipIds)){p[id].x+=Math.sin(i)*.001;p[id].y+=Math.cos(i)*.001;p[id].z=Math.sin(i)*.002;}p[0].x+=Math.sin(i*.04)*.02;assert.deepEqual(input.feed(hand(p),i*40),[]);}
 assert.deepEqual(new FingerParticleInput().feed({palm:{x:.4,y:.5},confidence:.95,span:.15},0),[]);
});
test('small motions work at camera rates from 1 to 30 FPS with a per-finger cooldown',()=>{
 for(const hz of [1,2,5,15,30]){const input=new FingerParticleInput(),times=[];for(let i=0;i<=hz*3;i++){const now=i*1000/hz,p=handLandmarks();p[20].x+=now*.00002;const output=input.feed(hand(p),now);if(output.length)times.push(now);}assert.ok(times.length>=2,hz+' FPS');assert.ok(times.every((t,i)=>!i||t-times[i-1]>=300));}
});
test('five moving fingers retain their five positions without merging',()=>{
 const input=new FingerParticleInput(),p=handLandmarks();input.feed(hand(p),0);for(const id of Object.values(tipIds))p[id].x+=.03;
 const output=input.feed(hand(p),100);assert.equal(output.length,5);assert.equal(new Set(output.map(q=>q.finger)).size,5);assert.equal(new Set(output.map(q=>q.x.toFixed(4))).size,5);
 for(let t=150;t<=1000;t+=50)assert.deepEqual(input.feed(hand(p),t),[]);
});
test('loss, low confidence, two hands, disabled phase, stale frames and jumps reacquire silently',()=>{
 for(const invalid of [null,{...hand(handLandmarks()),confidence:.3},describeHand(handLandmarks(),.96,2)]){
  const input=new FingerParticleInput();input.feed(hand(handLandmarks()),0);input.feed(invalid,100);assert.deepEqual(input.feed(hand(handLandmarks({dx:.1})),200),[]);
 }
 const input=new FingerParticleInput();input.feed(hand(handLandmarks()),0);assert.deepEqual(input.feed(hand(handLandmarks({dx:.3})),100),[]);assert.deepEqual(input.feed(hand(handLandmarks({dx:.31})),1500),[]);
 assert.deepEqual(input.feed(hand(handLandmarks()),1600,false),[]);assert.deepEqual(input.feed(hand(handLandmarks()),1700),[]);
 const before=JSON.stringify(input);assert.deepEqual(input.feed(hand(handLandmarks({dx:.1})),1700),[]);assert.equal(JSON.stringify(input),before);
});
test('same-finger cooldown survives reset without blocking another moving finger',()=>{
 const input=new FingerParticleInput(),p=handLandmarks();input.feed(hand(p),0);p[4].x+=.03;assert.equal(input.feed(hand(p),100)[0].finger,'thumb');
 input.reset();input.feed(hand(p),150);p[4].x+=.03;assert.deepEqual(input.feed(hand(p),200),[]);p[8].x+=.03;assert.equal(input.feed(hand(p),250)[0].finger,'index');
});
test('renderer keeps five separate fingertip origins and never stacks a second ring on the same tip',()=>{
 const stage=new StatueStage();stage.timeline.start(0);const inputs=fingers.map((finger,i)=>({finger,x:.35+i*.07,y:.4+i*.04,strength:.85,motion:true}));
 assert.equal(stage.interactFingers(inputs,500,{x:.5,y:.5}),5);assert.equal(stage.ripples.length,5);assert.equal(new Set(stage.ripples.map(r=>r.x)).size,5);
 assert.equal(stage.interactFingers(inputs,900,{x:.5,y:.5}),0);assert.equal(stage.handRippleCount,5);
 assert.equal(stage.interactFingers(inputs,1900,{x:.5,y:.5}),5);assert.equal(stage.ripples.length,5);assert.ok(stage.ripples.every(r=>r.spread===.55&&r.strength<=.95));
 for(const finger of fingers)assert.equal(stage.fingerRippleCount[finger],2);
 stage.timeline.sample(9200);assert.equal(stage.interactFingers(inputs,9500,{x:.5,y:.5}),0);
});
test('renderer rejects recognition-only and unknown inputs and preserves mouse interaction',()=>{
 const stage=new StatueStage();stage.timeline.start(0);assert.equal(stage.interact(.5,.5,500,1,'hand'),false);
 assert.equal(stage.interactFingers([{finger:'index',x:.5,y:.5,strength:1},{finger:'palm',x:.5,y:.5,strength:1,motion:true}],500,{x:.6,y:.4}),0);
 assert.equal(stage.ripples.length,0);assert.equal(stage.interact(.5,.5,800,1),true);assert.equal(stage.pointerRippleCount,1);
});

test('rigid whole-hand translation, rotation and distance changes never trigger a finger wave',()=>{
 const input=new FingerParticleInput(),base=handLandmarks();
 for(let i=0;i<120;i++){const a=Math.sin(i*.08)*.35,b=Math.cos(i*.07)*.25,scale=1+Math.sin(i*.04)*.2;
  const p=base.map(q=>{const x=q.x-.5,y=q.y-.7,z=q.z||0,x1=x*Math.cos(a)-y*Math.sin(a),y1=x*Math.sin(a)+y*Math.cos(a);return {x:.5+x1*scale+Math.sin(i*.06)*.1,y:.7+(y1*Math.cos(b)-z*Math.sin(b))*scale,z:(y1*Math.sin(b)+z*Math.cos(b))*scale};});
  assert.deepEqual(input.feed(hand(p),i*50),[]);
 }
});
test('stopping independent finger motion never queues additional positions',()=>{
 const input=new FingerParticleInput();let p;
 for(let t=0;t<=2000;t+=50){p=handLandmarks();for(const id of [4,8,12,16,20])p[id].x+=t*.000015;assert.ok(input.feed(hand(p),t).length<=5);}
 for(let t=2050;t<=3500;t+=50)assert.deepEqual(input.feed(hand(p),t),[]);
});
