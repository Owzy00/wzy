import test from 'node:test';
import assert from 'node:assert/strict';
import {HandZoom} from '../dist/hand-zoom.js';
import {describeHand} from '../dist/gesture-core.js';

function apertureHand(gap,{uncertain=false}={}){
 const p=Array.from({length:21},()=>({x:.5,y:.7,z:0}));p[0]={x:.5,y:.88,z:0};
 for(const [i,mcp]of [5,9,13,17].entries()){
  const x=.44+i*.05;p[mcp]={x,y:.68,z:0};p[mcp+1]={x,y:.57,z:0};p[mcp+2]={x,y:.47,z:0};p[mcp+3]={x,y:mcp===5?.36:.72,z:0};
 }
 p[1]={x:.43,y:.78,z:0};p[2]={x:.39,y:.67,z:0};p[3]={x:.36,y:.55,z:0};p[4]={x:.44-gap*.15,y:.36,z:0};
 if(uncertain)p[12]={x:.49,y:.54,z:0};
 return p;
}
function cameraSample(controller,event){
 if(event.kind==='missing')return controller.feed(null,null,event.t,true);
 if(event.kind==='disabled')return controller.feed(null,null,event.t,false);
 const points=apertureHand(event.gap,event);const sample=describeHand(points,.96,1);
 assert.ok(sample,'the aperture trace must contain actual valid landmark samples');
 return controller.feed(sample,points,event.t,true);
}
function runTimeline(events,end,{frameMs=10}={}){
 const controller=new HandZoom(),frames=[],samples=[];let next=0,total=1;
 const ordered=[...events].sort((a,b)=>a.t-b.t);
 for(let now=0;now<=end;now+=frameMs){
  // A camera observation is delivered only once its capture time has arrived.
  // Display frames are never allowed to consume future landmarks.
  while(next<ordered.length&&ordered[next].t<=now+1e-8){const event=ordered[next++];samples.push({...event,result:cameraSample(controller,event)});}
  const factor=controller.step(now);assert.ok(Number.isFinite(factor)&&factor>0,'every display increment is a finite zoom factor');
  total*=factor;frames.push({t:now,factor,total});
 }
 return {controller,frames,samples,total};
}
const armEvents=gap=>[0,60,120].map(t=>({t,gap}));
function linearTrace({sampleMs=100,startGap=.8,endGap=1.6,duration=1000,hold=500,uncertain=false}={}){
 const start=200,end=start+duration,finish=end+hold,events=armEvents(startGap);
 let index=0;for(let t=start;t<=finish+1e-7;t=start+(++index)*sampleMs){const captured=Math.round(t*1e6)/1e6;events.push({t:captured,gap:startGap+(endGap-startGap)*Math.max(0,Math.min(1,(captured-start)/duration)),uncertain:uncertain&&index%2===0});}
 return runTimeline(events,Math.ceil(finish/10)*10);
}
const changed=frames=>frames.filter(frame=>Math.abs(Math.log(frame.factor))>1e-7);
const near=(actual,expected,tolerance,message)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${message}: ${actual} versus ${expected}`);

test('a genuine fast 10 Hz opening is retained instead of rejected by a fixed per-frame gap limit',()=>{
 const trace=runTimeline([...armEvents(.4),{t:220,gap:1.1},{t:320,gap:1.8},{t:420,gap:2.5},...Array.from({length:5},(_,i)=>({t:520+i*100,gap:2.5}))],1000);
 assert.ok(trace.total<.3,'the measured .4 to 2.5 opening must produce substantial enlargement');
 assert.ok(changed(trace.frames).length>12,'camera updates are distributed across multiple display frames');
 assert.ok(trace.frames.every(frame=>Math.abs(Math.log(frame.factor))<.35),'no sample becomes one extreme display jump');
});

test('opening enlarges the sky and closing reduces it continuously on display frames',()=>{
 const opening=linearTrace({startGap:.7,endGap:1.7}),closing=linearTrace({startGap:1.7,endGap:.7});
 assert.ok(opening.total<.7);assert.ok(closing.total>1.4);
 assert.ok(opening.frames.every(frame=>frame.factor<=1+1e-10),'opening cannot invert into zoom-out');
 assert.ok(closing.frames.every(frame=>frame.factor>=1-1e-10),'closing cannot invert into zoom-in');
 assert.ok(changed(opening.frames).length>25);assert.ok(changed(closing.frames).length>25);
});

test('brief uncertainty in the other fingers does not repeatedly discard an active thumb/index aperture',()=>{
 const ordinary=linearTrace({startGap:.8,endGap:1.6}),uncertain=linearTrace({startGap:.8,endGap:1.6,uncertain:true});
 assert.ok(uncertain.total<.65,'valid thumb/index travel still enlarges the sky');
 near(Math.log(uncertain.total),Math.log(ordinary.total),.15,'short other-finger uncertainty preserves the aperture travel');
 assert.ok(changed(uncertain.frames).length>25,'uncertainty does not turn continuous input into a frozen zoom');
});

test('a slow intentional opening has more display increments than camera samples without large steps',()=>{
 const trace=linearTrace({startGap:.8,endGap:1.0,duration:2000}),moving=trace.frames.filter(frame=>frame.t>=600&&frame.t<=2100),updates=changed(moving);
 assert.ok(trace.total<.9,'a slow deliberate opening is not treated as perpetual jitter');
 assert.ok(updates.length>40,'10 Hz input produces substantially more than 10 Hz visual changes');
 assert.ok(updates.every(frame=>Math.abs(Math.log(frame.factor))<.02),'slow movement is spread into small visual increments');
});

test('10 Hz and 30 Hz sampling of the same measured aperture reaches almost the same scale',()=>{
 const slow=linearTrace({sampleMs:100,startGap:.6,endGap:1.8,duration:1200}),fast=linearTrace({sampleMs:1000/30,startGap:.6,endGap:1.8,duration:1200});
 near(Math.log(slow.total),Math.log(fast.total),.07,'zoom amount is independent of the camera inference rate');
 assert.ok(changed(slow.frames).length>25);assert.ok(changed(fast.frames).length>25);
});

test('holding the fingers stationary settles promptly and leaves no continuing zoom drift',()=>{
 const trace=linearTrace({startGap:.8,endGap:1.3,duration:600,hold:700}),settled=trace.frames.filter(frame=>frame.t>=1100);
 assert.ok(settled.length>20);near(Math.log(settled.at(-1).total),Math.log(settled[0].total),1e-6,'a stopped hand cannot leave an accumulated zoom velocity');
 assert.ok(settled.every(frame=>Math.abs(Math.log(frame.factor))<1e-6));
});

for(const kind of ['missing','disabled'])test(`${kind} input immediately discards unfinished display interpolation`,()=>{
 const trace=runTimeline([...armEvents(.8),{t:220,gap:1.2},{t:240,kind}],700),released=trace.frames.filter(frame=>frame.t>=240);
 assert.ok(released.every(frame=>Math.abs(Math.log(frame.factor))<1e-12),'there is no residual interpolation after input is released');
 near(released.at(-1).total,released[0].total,1e-12,'scale stays fixed after release');
});

test('an isolated implausible fingertip jump cannot slam the scale or create a delayed backlog',()=>{
 const trace=runTimeline([...armEvents(.3),{t:180,gap:2.5},{t:240,gap:.3},...Array.from({length:6},(_,i)=>({t:300+i*60,gap:.3}))],850);
 assert.ok(trace.frames.every(frame=>Math.abs(Math.log(frame.total))<.1),'a one-frame detection spike is rejected rather than amplified');
 near(Math.log(trace.total),0,.02,'returning to the original measurement leaves no zoom backlog');
});
