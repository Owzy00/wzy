import test from 'node:test';
import assert from 'node:assert/strict';
import {describeHand,FingerParticleInput,FingerTapInput} from '../dist/gesture-core.js';
import {StatueStage} from '../dist/particle-effects.js';
import {handLandmarks,tapFrames} from './hand-fixtures.mjs';
const sample=(bend=.12)=>({confidence:.95,span:.15,palm:{x:.5,y:.7},point:{x:.5,y:.5,extended:bend<.4,bend}});
function replay(input,finger='index',offset=0){return tapFrames.flatMap(([t,press])=>input.feed(describeHand(handLandmarks({[finger]:press}),.96,1),offset+t)).filter(p=>p.tap);}

test('landmarks 8 and 16 retain independent mirrored positions and palm-local bend values',()=>{
 const p=handLandmarks(),before=JSON.stringify(p),hand=describeHand(p,.96,1);
 assert.deepEqual(Object.keys(hand.fingers),['index','ring']);
 for(const [finger,id]of [['index',8],['ring',16]]){assert.equal(hand.fingers[finger].x,1-p[id].x);assert.equal(hand.fingers[finger].y,p[id].y);assert.equal(hand.fingers[finger].extended,true);assert.ok(Number.isFinite(hand.fingers[finger].bend));}
 assert.equal(JSON.stringify(p),before);const bent=describeHand(handLandmarks({ring:.16}),.96,1);
 assert.ok(bent.fingers.ring.bend-hand.fingers.ring.bend>.3);assert.equal(bent.fingers.index.bend,hand.fingers.index.bend);
});
test('an index or ring press and rebound emits once, only at the tapping fingertip',()=>{
 for(const finger of ['index','ring']){const pulses=replay(new FingerParticleInput(),finger);assert.equal(pulses.length,1);assert.equal(pulses[0].finger,finger);assert.ok(pulses[0].strength>=.65&&pulses[0].strength<=.95);assert.ok(pulses[0].y>.5);}
});
test('recognition, stationary jitter and whole-hand translation/rotation/scale never emit taps',()=>{
 const input=new FingerParticleInput(),base=handLandmarks();
 for(let i=0;i<90;i++){const a=Math.sin(i*.08)*.3,c=Math.cos(a),s=Math.sin(a),scale=1+Math.sin(i*.1)*.05,dx=Math.sin(i*.1)*.10;const p=base.map(q=>({x:.5+((q.x-.5)*c-(q.y-.7)*s)*scale+dx,y:.7+((q.x-.5)*s+(q.y-.7)*c)*scale,z:0}));p[8].y+=Math.sin(i)*.0005;p[16].y+=Math.cos(i)*.0005;assert.ok(input.feed(describeHand(p,.96,1),i*40).every(q=>!q.tap&&q.strength===0));}
});
test('thumb, middle, pinky and palm motion cannot emit ripples; unknown positions are ignored',()=>{
 const input=new FingerParticleInput();
 for(let i=0;i<30;i++){const p=handLandmarks();p[0].x+=Math.sin(i)*.004;for(const id of [4,12,20])p[id].y+=Math.sin(i)*.14;assert.ok(input.feed(describeHand(p,.96,1),i*60).every(q=>!q.tap));}
 assert.deepEqual(new FingerParticleInput().feed({palm:{x:.4,y:.5},confidence:.95},0),[]);
});
test('a single-frame spike, a held press, slow curling and an initially bent finger cannot complete a tap',()=>{
 const sequences=[
 [[0,.12],[60,.12],[120,.12],[180,.5],[240,.12]],
 [[0,.12],[60,.12],[120,.12],[180,.5],[240,.5],[600,.5],[1000,.5],[1060,.12]],
 [[0,.12],[60,.12],[120,.12],...Array.from({length:25},(_,i)=>[180+i*60,.12+i*.015]),[1740,.12]],
 [[0,.5],[60,.5],[120,.5],[180,.12]]
 ];
 for(const frames of sequences){const input=new FingerTapInput();assert.ok(frames.every(([t,b])=>!input.feed(sample(b),t).tap));}
});
test('a tap must be observed at usable camera cadence; frame gaps never synthesize a gesture',()=>{
 for(const hz of [5,10,15,30]){const input=new FingerTapInput(),pulses=[];for(let i=0;i<=hz*1.2;i++){const t=i*1000/hz,b=t<250||t>=900?.12:t<450?.28:.5;const p=input.feed(sample(b),t);if(p.tap)pulses.push(p);}assert.equal(pulses.length,1,hz+' FPS');}
 const input=new FingerTapInput();for(const [t,b]of [[0,.12],[120,.12],[240,.5],[800,.5],[900,.12]])assert.equal(input.feed(sample(b),t).tap,false);
});
test('loss, low confidence, two hands, phase disablement and coordinate jumps discard incomplete taps',()=>{
 for(const invalid of [()=>null,()=>({...sample(.5),confidence:.3}),()=>({...sample(.5),palm:{x:.9,y:.7}}),()=>({...sample(.5),span:.4})]){
  const input=new FingerTapInput();for(const [t,b]of [[0,.12],[60,.12],[120,.12],[180,.5],[240,.5]])input.feed(sample(b),t);
  input.feed(invalid(),300);assert.equal(input.feed(sample(),360).tap,false);
 }
 const input=new FingerParticleInput();for(const [t,b]of tapFrames.slice(0,6))input.feed(describeHand(handLandmarks({index:b}),.96,1),t);
 assert.deepEqual(input.feed(describeHand(handLandmarks(),.96,2),330),[]);assert.ok(input.feed(describeHand(handLandmarks(),.96,1),420).every(p=>!p.tap));
 assert.deepEqual(input.feed(describeHand(handLandmarks(),.96,1),480,false),[]);
});
test('cooldown is independent per finger, survives resets, and a new tap requires rearming',()=>{
 const input=new FingerParticleInput();assert.equal(replay(input).length,1);
 const ring=replay(input,'ring',430);assert.equal(ring.length,1);assert.equal(ring[0].finger,'ring');
 // Index has recovered, but cannot emit by simply returning to the old pose.
 input.reset();assert.ok(input.feed(describeHand(handLandmarks(),.96,1),900).every(p=>!p.tap));
 assert.equal(replay(input,'index',1100).length,1);
 const one=new FingerTapInput();for(const [t,b]of [[0,.12],[60,.12],[120,.12],[180,.5],[240,.5],[300,.12]])one.feed(sample(b),t);
 assert.equal(one.lastPulse,300);one.reset();for(const [t,b]of [[330,.12],[390,.12],[450,.5],[510,.5],[570,.12]])assert.equal(one.feed(sample(b),t).tap,false);
});
test('renderer accepts only semantic taps from the two fingers, with independent cooldowns and three-wave cap',()=>{
 const stage=new StatueStage();stage.timeline.start(0);const both=['index','ring'].map((finger,i)=>({finger,x:.45+i*.1,y:.5,strength:.8,tap:true}));
 assert.equal(stage.interactFingers(both.map(p=>({...p,tap:false})),400,{x:.5,y:.5}),0);
 assert.equal(stage.interactFingers(both,500,{x:.5,y:.5}),2);assert.deepEqual(stage.fingerRippleCount,{index:1,ring:1});
 assert.equal(stage.interactFingers(both,600,{x:.5,y:.5}),0);assert.equal(stage.interactFingers(both,1000,{x:.5,y:.5}),2);assert.equal(stage.ripples.length,3);assert.ok(stage.ripples.every(r=>r.spread===.55));
 stage.timeline.sample(9200);assert.equal(stage.interactFingers(both,9500,{x:.5,y:.5}),0);
});
test('renderer rejects palm and other fingers while preserving mouse input',()=>{
 const stage=new StatueStage();stage.timeline.start(0);assert.equal(stage.interact(.5,.5,500,1,'hand'),false);
 assert.equal(stage.interactFingers(['thumb','middle','pinky'].map(finger=>({finger,x:.5,y:.5,strength:1,tap:true})),500,{x:.6,y:.4}),0);
 assert.equal(stage.ripples.length,0);assert.equal(stage.interact(.5,.5,800,1),true);assert.equal(stage.pointerRippleCount,1);
});
