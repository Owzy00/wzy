import test from 'node:test';
import assert from 'node:assert/strict';
import {HandParticleInput} from '../dist/gesture-core.js';
import {StatueStage} from '../dist/particle-effects.js';
import {prepareRippleWaves,rippleDisplacement} from '../dist/cloud-field.js';
const hand=(x=.5,y=.5,span=.15)=>({palm:{x,y},pose:'open',span,confidence:.95});

test('slow deliberate hand movement triggers visible pulses from 1 to 30 camera frames per second',()=>{
 for(const hz of [1,2,5,15,30]){
  const input=new HandParticleInput(),pulses=[];
  for(let i=0;i<=hz*3;i++){const now=i*1000/hz,p=input.feed(hand(.4+now*.00002),now);if(p.strength)pulses.push({time:now,strength:p.strength});}
  assert.ok(pulses.length>=2,`${hz} FPS must not discard a slow hand`);assert.ok(pulses.every(p=>p.strength>=1.1&&p.strength<=1.4));
  assert.ok(pulses.every((p,i)=>!i||p.time-pulses[i-1].time>=280));
 }
});
test('small hand movements track across the model at a comparable screen distance to a mouse',()=>{
 const stage=new StatueStage();stage.currentLayout=stage.layout(1280,720);stage.bounds={minX:-.25,maxX:.25,minY:-.48,maxY:.48};
 const a=stage.handPoint(.5,.5),b=stage.handPoint(.55,.55);assert.ok(b.x-a.x>.035&&b.x-a.x<.065);assert.ok(b.y-a.y>.04&&b.y-a.y<.07);
});
test('hand compensation broadens and strengthens waves while preserving mouse physics and the displacement cap',()=>{
 const hand=prepareRippleWaves([{x:.5,y:.5,time:0,strength:1.2,spread:1.35}],450,1000,600),mouse=prepareRippleWaves([{x:.5,y:.5,time:0,strength:1.2}],450,1000,600);
 assert.ok(Math.abs(hand[0].edge/mouse[0].edge-1.35)<1e-9);assert.ok(hand[0].force>mouse[0].force);
 const x=500+hand[0].radius+mouse[0].edge;
 assert.ok(rippleDisplacement(x,300,hand,42).x>rippleDisplacement(x,300,mouse,42).x*1.5);
 assert.ok(Math.hypot(...Object.values(rippleDisplacement(x,300,[...hand,...hand,...hand],42)))<=42);
 const plain=prepareRippleWaves([{x:.5,y:.5,time:0,strength:1.2,spread:1}],450,1000,600);assert.deepEqual(mouse,plain);
});
test('stationary jitter does not accumulate into hand ripples',()=>{
 const input=new HandParticleInput();for(let t=0;t<12000;t+=50)assert.equal(input.feed(hand(.5+Math.sin(t)*.001,.5+Math.cos(t)*.001),t).strength,0);
});
test('lost hands, disabled phases, stale frames, confidence and size jumps require a new anchor',()=>{
 for(const reset of [input=>input.feed(null,200),input=>input.feed(hand(),200,false),input=>input.feed({...hand(),confidence:.5},200)]){
  const input=new HandParticleInput();input.feed(hand(.3),0);reset(input);assert.equal(input.feed(hand(.6),400).strength,0);
 }
 const input=new HandParticleInput();input.feed(hand(.3),0);assert.equal(input.feed(hand(.7),100).strength,0);assert.equal(input.feed(hand(.75),1500).strength,0);assert.equal(input.feed(hand(.76,.5,.32),1600).strength,0);
 const before=JSON.stringify(input);assert.equal(input.feed(hand(.2),1600),null);assert.equal(JSON.stringify(input),before);
});
test('hand ripple origins are mapped into the model while mouse positions and smooth translation are preserved',()=>{
 const stage=new StatueStage();stage.currentLayout=stage.layout(1280,720);stage.bounds={minX:-.25,maxX:.25,minY:-.48,maxY:.48};stage.timeline.start(0);
 assert.equal(stage.interactFingers([{finger:'index',x:.85,y:.85,strength:.8}],500,{x:.85,y:.85}),1);const wave=stage.ripples[0];assert.ok(wave.x>.5&&wave.x<.7);assert.ok(wave.y>.7&&wave.y<.85);assert.ok(Math.abs(stage.pointerTarget.x-.7)<1e-10);assert.equal(stage.handRippleCount,1);
 assert.equal(stage.interact(.1,.2,900,1,'pointer'),true);assert.equal(stage.ripples[1].x,.1);assert.equal(stage.ripples[1].y,.2);assert.equal(stage.pointerRippleCount,1);
 stage.timeline.sample(9200);assert.equal(stage.interactFingers([{finger:'index',x:.5,y:.5,strength:1}],9500,{x:.5,y:.5}),0);assert.equal(stage.handRippleCount,1);
});
