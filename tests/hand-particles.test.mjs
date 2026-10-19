import test from 'node:test';
import assert from 'node:assert/strict';
import {StatueStage} from '../dist/particle-effects.js';
import {prepareRippleWaves,rippleDisplacement} from '../dist/cloud-field.js';

test('small hand movements retain model parallax and fingertip position mapping',()=>{
 const stage=new StatueStage();stage.currentLayout=stage.layout(1280,720);stage.bounds={minX:-.25,maxX:.25,minY:-.48,maxY:.48};
 const a=stage.handPoint(.5,.5),b=stage.handPoint(.55,.55);assert.ok(b.x-a.x>.035&&b.x-a.x<.065);assert.ok(b.y-a.y>.04&&b.y-a.y<.07);
});
test('hand wave is narrow and local, fades sooner, and mouse physics remain unchanged',()=>{
 const hand=prepareRippleWaves([{x:.5,y:.5,time:0,strength:.8,spread:.55}],450,1000,600),mouse=prepareRippleWaves([{x:.5,y:.5,time:0,strength:.8}],450,1000,600);
 assert.ok(Math.abs(hand[0].edge/mouse[0].edge-.55)<1e-9);assert.equal(hand[0].radius,450/1000*600*.18);assert.ok(hand[0].force<mouse[0].force);
 const remoteX=500+mouse[0].radius;assert.ok(Math.abs(rippleDisplacement(remoteX,300,hand,42).x)<.001);
 assert.deepEqual(prepareRippleWaves([{x:.5,y:.5,time:0,strength:.8,spread:.55}],1400,1000,600),[]);
 assert.equal(prepareRippleWaves([{x:.5,y:.5,time:0,strength:.8}],1400,1000,600).length,1);
 const x=500+hand[0].radius;assert.ok(Math.hypot(...Object.values(rippleDisplacement(x,300,[...hand,...hand,...hand],42)))<=42);
 const plain=prepareRippleWaves([{x:.5,y:.5,time:0,strength:.8,spread:1}],450,1000,600);assert.deepEqual(mouse,plain);
 assert.equal(mouse[0].radius,450/1000*600*.36);assert.equal(mouse[0].edge,600*.04);
});
test('hand origins map into the model; palm translation and mouse origin are preserved',()=>{
 const stage=new StatueStage();stage.currentLayout=stage.layout(1280,720);stage.bounds={minX:-.25,maxX:.25,minY:-.48,maxY:.48};stage.timeline.start(0);
 assert.equal(stage.interactFingers([{finger:'index',x:.85,y:.85,strength:.8,motion:true}],500,{x:.85,y:.85}),1);const wave=stage.ripples[0];assert.ok(wave.x>.5&&wave.x<.7);assert.ok(wave.y>.7&&wave.y<.85);assert.ok(Math.abs(stage.pointerTarget.x-.7)<1e-10);assert.equal(stage.handRippleCount,1);
 assert.equal(stage.interact(.1,.2,900,1,'pointer'),true);assert.equal(stage.ripples[1].x,.1);assert.equal(stage.ripples[1].y,.2);assert.equal(stage.pointerRippleCount,1);
 stage.timeline.sample(9200);assert.equal(stage.interactFingers([{finger:'index',x:.5,y:.5,strength:1,motion:true}],9500,{x:.5,y:.5}),0);
});
