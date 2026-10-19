import test from 'node:test';
import assert from 'node:assert/strict';
import {describeHand,FingerParticleInput} from '../dist/gesture-core.js';
import {StatueStage} from '../dist/particle-effects.js';

function landmarks(){
 const p=Array.from({length:21},()=>({x:.5,y:.85,z:0}));p[0]={x:.5,y:.9};
 for(const [i,mcp]of [5,9,13,17].entries()){const x=.35+i*.12;p[mcp]={x,y:.7};p[mcp+1]={x,y:.5};p[mcp+2]={x,y:.35};p[mcp+3]={x,y:.22};}
 return p;
}
const sample=(index=.45,ring=.55)=>({confidence:.95,span:.15,palm:{x:.5,y:.5},fingers:{index:{x:index,y:.5,extended:true},ring:{x:ring,y:.5,extended:true}}});

test('landmarks 8 and 16 produce separately mirrored index and ring tips, with extension flags',()=>{
 const p=landmarks(),before=JSON.stringify(p),hand=describeHand(p,.96,1);
 assert.deepEqual(Object.keys(hand.fingers),['index','ring']);assert.deepEqual(hand.fingers.index,{x:1-p[8].x,y:p[8].y,extended:true});assert.deepEqual(hand.fingers.ring,{x:1-p[16].x,y:p[16].y,extended:true});assert.equal(JSON.stringify(p),before);
 p[16].y=.77;assert.equal(describeHand(p,.96,1).fingers.ring.extended,false);assert.equal(describeHand(p,.96,1).fingers.index.extended,true);
});
test('moving only the index or only the ring produces a pulse only at that fingertip',()=>{
 for(const finger of ['index','ring']){const input=new FingerParticleInput();input.feed(sample(),0);const s=sample();s.fingers[finger].x+=.025;const result=input.feed(s,500);assert.deepEqual(result.filter(p=>p.strength>0).map(p=>p.finger),[finger]);assert.ok(result.find(p=>p.finger===finger).x>.45);}
});
test('palm, thumb, middle and pinky motion cannot emit a finger ripple',()=>{
 const input=new FingerParticleInput(),p=landmarks();input.feed(describeHand(p,.96,1),0);
 for(let i=1;i<=8;i++){p[0].x+=.004;for(const id of [4,12,20])p[id].x+=.006;const output=input.feed(describeHand(p,.96,1),i*500);assert.ok(output.every(p=>p.strength===0));}
 const palmOnly=new FingerParticleInput();assert.deepEqual(palmOnly.feed({palm:{x:.2,y:.5},confidence:.95},0),[]);assert.deepEqual(palmOnly.feed({palm:{x:.4,y:.5},confidence:.95},500),[]);
});
test('folded tips, lost input and re-extension cannot reuse an old fingertip movement',()=>{
 const input=new FingerParticleInput();input.feed(sample(),0);const folded=sample();folded.fingers.index.extended=false;assert.deepEqual(input.feed(folded,500).map(p=>p.finger),['ring']);
 const reopened=sample(.65,.55);assert.equal(input.feed(reopened,1000).find(p=>p.finger==='index').strength,0);
 input.feed(null,1100);assert.ok(input.feed(sample(.7,.6),1200).every(p=>p.strength===0));assert.deepEqual(input.feed(sample(),1500,false),[]);
});
test('two fingertip waves may start in the same frame with independent cooldowns and a shared three-wave cap',()=>{
 const stage=new StatueStage();stage.timeline.start(0);const both=['index','ring'].map((finger,i)=>({finger,x:.45+i*.1,y:.5,strength:1.2}));
 assert.equal(stage.interactFingers(both,500,{x:.5,y:.5}),2);assert.equal(stage.handRippleCount,2);assert.deepEqual(stage.fingerRippleCount,{index:1,ring:1});assert.notEqual(stage.ripples[0].x,stage.ripples[1].x);
 assert.equal(stage.interactFingers(both,600,{x:.5,y:.5}),0);assert.equal(stage.interactFingers(both,800,{x:.5,y:.5}),2);assert.equal(stage.ripples.length,3);assert.deepEqual(stage.fingerRippleCount,{index:2,ring:2});assert.deepEqual(stage.pointerTarget,{x:0,y:0});
 stage.timeline.sample(9200);assert.equal(stage.interactFingers(both,9500,{x:.5,y:.5}),0);
});
test('the renderer rejects a palm-only hand call and every other finger identifier',()=>{
 const stage=new StatueStage();stage.timeline.start(0);assert.equal(stage.interact(.5,.5,500,1,'hand'),false);
 assert.equal(stage.interactFingers(['thumb','middle','pinky'].map(finger=>({finger,x:.5,y:.5,strength:1})),500,{x:.6,y:.4}),0);assert.equal(stage.ripples.length,0);
 assert.equal(stage.interact(.5,.5,800,1),true);assert.equal(stage.pointerRippleCount,1);
});
