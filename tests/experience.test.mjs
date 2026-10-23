import {cloudField,cloudPose,cloudPresence,starFlight,statueSurface,prepareRippleWaves,rippleDisplacement} from '../dist/cloud-field.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {GestureMachine,describeHand,HandNavigator} from '../dist/gesture-core.js';
import {MorphTimeline,WindField,decodeCloud,createParticleBuffer,StatueStage} from '../dist/particle-effects.js';
import {GestureCamera} from '../dist/gesture-camera.js';
const state={selected:3,busy:false,enabled:true};
const sample=(pose,x=.62,y=.5)=>({pose,palm:{x,y},tip:{x,y},confidence:.95});
function fistThenOpen(machine,{start=0,options=state,fistDuration=600}={}){const events=[];for(let t=start;t<start+fistDuration;t+=40){const e=machine.update(sample('fist'),t,options);if(e)events.push(e);}for(let t=start+fistDuration;t<=start+fistDuration+400;t+=40){const e=machine.update(sample('open'),t,options);if(e)events.push(e);}return events;}
test('fist first selects a mansion, then open palm morphs it exactly once',()=>{const m=new GestureMachine(),events=fistThenOpen(m);assert.deepEqual(events,[{type:'select'},{type:'morph',selected:3}]);});
test('the fist selection may change the mansion without disarming the opening sequence',()=>{const m=new GestureMachine();let count=0;for(let t=0;t<600;t+=40){const event=m.update(sample('fist'),t,t<400?state:{...state,selected:9});if(event?.type==='select'){count++;m.confirmSelection(9);}}assert.equal(count,1);let event;for(let t=600;t<=840;t+=40)event=m.update(sample('open'),t,{...state,selected:9})||event;assert.deepEqual(event,{type:'morph',selected:9});});
test('brief fists, open palm alone and pointing circles never morph',()=>{assert.equal(fistThenOpen(new GestureMachine(),{fistDuration:200}).length,0);for(const pose of ['open','point']){const m=new GestureMachine();for(let i=0;i<120;i++){const a=i/40*Math.PI*2;assert.equal(m.update(sample(pose,.5+Math.cos(a)*.12,.5+Math.sin(a)*.12),i*40,state),null);}}});
test('stable opening is required; short natural intermediate poses are allowed',()=>{const m=new GestureMachine();for(let t=0;t<600;t+=40)m.update(sample('fist'),t,state);for(let t=600;t<700;t+=40)assert.equal(m.update(sample('open'),t,state),null);for(let t=720;t<1300;t+=40)assert.equal(m.update(sample('point'),t,state),null);const n=new GestureMachine();for(let t=0;t<600;t+=40)n.update(sample('fist'),t,state);n.update(sample('neutral'),600,state);n.update(sample('point'),640,state);let event;for(let t=680;t<1100;t+=40)event=n.update(sample('open'),t,state)||event;assert.equal(event.type,'morph');});
test('busy and disabled reject actions; no target and external selection changes reject morphing',()=>{for(const options of [{...state,busy:true},{...state,enabled:false}])assert.equal(fistThenOpen(new GestureMachine(),{options}).length,0);assert.equal(fistThenOpen(new GestureMachine(),{options:{...state,selected:null}}).filter(e=>e.type==='morph').length,0);const m=new GestureMachine();for(let t=0;t<600;t+=40)m.update(sample('fist'),t,state);for(let t=600;t<1200;t+=40)assert.equal(m.update(sample('open'),t,{...state,selected:4}),null);});
test('lost hand, long gaps and abrupt hand movement discard a ready fist',()=>{for(const kind of ['lost','gap','jump']){const m=new GestureMachine();for(let t=0;t<600;t+=40)m.update(sample('fist'),t,state);assert.equal(m.armed,true);if(kind==='lost')m.update(null,600,state);const start=kind==='gap'?1400:640;for(let t=start;t<start+700;t+=40)assert.notEqual(m.update(sample('open',kind==='jump'?.95:.62),t,state)?.type,'morph');assert.equal(m.armed,false);}});
test('holding open cannot retrigger and a fresh fist works after cooldown',()=>{const m=new GestureMachine();assert.equal(fistThenOpen(m).filter(e=>e.type==='morph').length,1);const until=m.cooldownUntil;for(let t=1040;t<until+700;t+=40)assert.equal(m.update(sample('open'),t,state),null);assert.equal(fistThenOpen(m,{start:until+800}).filter(e=>e.type==='morph').length,1);});
test('duplicate or backwards timestamps cannot advance the recognizer',()=>{const m=new GestureMachine();m.update(sample('fist'),100,state);const before=JSON.stringify(m);m.update(sample('open'),100,state);m.update(sample('open'),90,state);assert.equal(JSON.stringify(m),before);});
test('palm dragging follows measured displacement one-to-one and settles without inertia',()=>{
 const n=new HandNavigator(),deltas=[];for(let t=0;t<=1250;t+=10){if(t%50===0)n.feed(sample('open',.25+Math.min(t,1000)*.0003,.3+Math.min(t,1000)*.0001),t);deltas.push(n.step(t));}
 assert.ok(Math.abs(deltas.reduce((s,d)=>s+d.dx,0)-.3)<.0001);assert.ok(Math.abs(deltas.reduce((s,d)=>s+d.dy,0)-.1)<.0001);
 assert.ok(deltas.every(d=>d.dx>=0&&d.dx<.012));assert.deepEqual(n.step(1260),{dx:0,dy:0});
});
test('stationary jitter, new hands and closed fists cannot jump or drift the sky',()=>{const n=new HandNavigator();for(let t=0;t<=1000;t+=50){n.feed(sample('open',.5+(t%100?.0005:0)),t);assert.deepEqual(n.step(t),{dx:0,dy:0});}n.feed(sample('open',.9),1100);assert.deepEqual(n.step(1100),{dx:0,dy:0});n.feed(null,1150);n.feed(sample('open',.2),1200);assert.deepEqual(n.step(1200),{dx:0,dy:0});n.feed(sample('open',.23),1250);assert.deepEqual(n.step(1275),{dx:0,dy:0});assert.equal(n.awaitingGrip,true);for(const t of [1290,1330])n.feed(sample('open',.23),t);n.feed(sample('open',.26),1380);n.step(1380);assert.ok(n.step(1405).dx>0);n.feed(sample('fist'),1450);assert.deepEqual(n.step(1450),{dx:0,dy:0});});
test('a stopped camera stream stops without extrapolating palm velocity',()=>{const n=new HandNavigator();n.feed(sample('open',.3),0);n.step(0);n.feed(sample('open',.35),100);n.step(100);assert.ok(n.step(125).dx>0);for(let t=120;t<700;t+=20)n.step(t);assert.deepEqual(n.step(700),{dx:0,dy:0});n.feed(sample('open',.8),900);assert.deepEqual(n.step(900),{dx:0,dy:0});});

test('landmark input rejects two hands, low confidence and invalid coordinates',()=>{const hand=Array.from({length:21},(_,i)=>({x:.3+(i%5)*.08,y:.3+Math.floor(i/5)*.08,z:0}));assert.equal(describeHand(hand,.74,1),null);assert.equal(describeHand(hand,.99,2),null);hand[2].x=NaN;assert.equal(describeHand(hand,.99,1),null);});
test('valid landmark poses distinguish open palm, index pointing and a closed fist',()=>{const hand=Array.from({length:21},()=>({x:.5,y:.85,z:0}));hand[0]={x:.5,y:.9};for(const [i,mcp]of [5,9,13,17].entries()){const x=.35+i*.12;hand[mcp]={x,y:.7};hand[mcp+1]={x,y:.5};hand[mcp+2]={x,y:.35};hand[mcp+3]={x,y:.22};}assert.equal(describeHand(hand,.95,1).pose,'open');for(const mcp of [9,13,17])hand[mcp+3]={x:hand[mcp].x,y:.78};const point=describeHand(hand,.95,1);assert.equal(point.pose,'point');assert.equal(point.tip.x,.65);hand[8]={x:hand[5].x,y:.78};assert.equal(describeHand(hand,.95,1).pose,'fist');});
test('camera stop terminates inference and releases every video track once',()=>{let tracks=0,workers=0;const video={pause(){},srcObject:{}},statuses=[];const c=new GestureCamera(video,{onSample(){},onStatus:s=>statuses.push(s)});c.stream={getTracks:()=>[{stop(){tracks++;}},{stop(){tracks++;}}]};c.worker={terminate(){workers++;}};c.running=true;c.stop();c.stop();assert.equal(tracks,2);assert.equal(workers,1);assert.equal(c.running,false);assert.equal(video.srcObject,null);assert.ok(statuses.every(s=>s==='off'));});

test('worker startup failure falls back to compatible recognition and releases its detector',async()=>{
 const priorNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator'),priorSecure=globalThis.isSecureContext;let tracks=0,closed=0;const statuses=[];
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia:async()=>({getTracks:()=>[{stop(){tracks++;}}]})}}});globalThis.isSecureContext=true;
 const video={readyState:0,play:async()=>{},pause(){},srcObject:null},camera=new GestureCamera(video,{onSample(){},onStatus:(state,message)=>statuses.push({state,message}),workerFactory(){throw new Error('worker blocked by browser');},detectorFactory:async()=>({close(){closed++;}})});
 try{await camera.start();assert.equal(camera.running,true);assert.equal(camera.backend,'main');assert.match(camera.workerError,/blocked/);assert.ok(statuses.some(s=>s.state==='running'&&s.message.includes('移手环顾')));camera.stop();assert.equal(tracks,1);assert.equal(closed,1);}finally{camera.stop();if(priorNavigator)Object.defineProperty(globalThis,'navigator',priorNavigator);else delete globalThis.navigator;if(priorSecure===undefined)delete globalThis.isSecureContext;else globalThis.isSecureContext=priorSecure;}
});

test('lower inference rates still select and morph without a long confirmation delay',()=>{const m=new GestureMachine();const events=[];for(let t=0;t<=600;t+=200){const e=m.update(sample('fist'),t,state);if(e)events.push(e);}assert.deepEqual(events,[{type:'select'}]);assert.equal(m.update(sample('open'),800,state),null);assert.deepEqual(m.update(sample('open'),1000,state),{type:'morph',selected:3});});

test('wind field affects only its screen displacement, then returns to zero',()=>{const stars=Object.freeze([{ra:2,dec:.5}]),before=JSON.stringify(stars);const field=new WindField();field.push({x:.5,y:.5,dx:1,dy:.2},0);field.prepare(400);assert.ok(field.offset(500,400,1000,800)[0]>0);field.prepare(4000);assert.deepEqual(field.offset(500,400,1000,800),[0,0]);assert.equal(JSON.stringify(stars),before);});
test('morph timeline progresses through gather, hold, return and cooldown',()=>{const t=new MorphTimeline();assert.equal(t.start(0),true);assert.ok(t.sample(t.duration.gather/2).amount>.2);assert.equal(t.sample(5500).state,'HOLDING');assert.equal(t.sample(9500).state,'RETURNING');assert.equal(t.sample(12000).done,true);assert.equal(t.start(12100),false);assert.equal(t.start(13300),true);});
test('early termination returns smoothly from partial gathering',()=>{const t=new MorphTimeline();t.start(0);const a=t.sample(1000).amount;t.finish(1000);assert.ok(Math.abs(t.sample(1000).amount-a)<1e-10);assert.ok(t.sample(1800).amount<a);assert.equal(t.sample(4000).done,true);});

test('GPU upload preserves source coordinates and normalized colors without changing the input cloud',()=>{
 const points=Object.freeze([Object.freeze({x:.1,y:-.2,z:.03,r:230,g:150,b:40}),Object.freeze({x:-.3,y:.4,z:-.01,r:12,g:21,b:32})]),before=JSON.stringify(points);
 const packed=createParticleBuffer(points,96000);assert.equal(packed.count,96002);assert.equal(packed.data.byteLength,96002*40);assert.ok(packed.data.every(Number.isFinite));
 for(let i=0;i<packed.count;i++){const o=i*10;for(let c=3;c<9;c++)assert.ok(packed.data[o+c]>=0&&packed.data[o+c]<=1);assert.equal(packed.data[o+9],i<96000?1:0);}
 assert.ok(Math.abs(packed.data[96000*10]-points[0].x)<1e-7);assert.equal(JSON.stringify(points),before);
});

test('GPU transitions issue a single draw per frame with no per-frame point-buffer uploads',()=>{
 const calls={draws:0,uploads:0},gl=new Proxy({canvas:null,getUniformLocation(){return {};},drawArrays(){calls.draws++;},bufferData(){calls.uploads++;}}, {get:(object,key)=>key in object?object[key]:(()=>{})});
 const stage=new StatueStage();stage.gl=gl;stage.program={};stage.uniforms={};stage.canvas={width:0,height:0,style:{}};stage.particleCount=144000;stage.origin={x:400,y:300};stage.timeline.start(0);stage.animationStarted=0;stage.lastDraw=0;
 const prior=globalThis.devicePixelRatio;globalThis.devicePixelRatio=1;
 try{for(let t=16;t<=2600;t+=16)stage.draw(null,t,1000,800,null);assert.equal(calls.draws,162);assert.equal(calls.uploads,0);assert.equal(stage.occludesSky,true);stage.finish(2600);for(let t=2616;t<=5620;t+=16)stage.draw(null,t,1000,800,null);assert.equal(stage.busy,false);assert.equal(stage.canvas.hidden,true);assert.equal(stage.occludesSky,false);}finally{if(prior===undefined)delete globalThis.devicePixelRatio;else globalThis.devicePixelRatio=prior;}
});

test('the statue always returns automatically after roughly four seconds of full formation',()=>{const t=new MorphTimeline();t.start(0);const a=t.duration.gather,b=a+t.duration.hold,c=b+t.duration.return;assert.equal(t.duration.hold,4200);assert.equal(t.sample(a-1).state,'GATHERING');assert.equal(t.sample(a).state,'HOLDING');assert.equal(t.sample(b-1).state,'HOLDING');assert.equal(t.sample(b).state,'RETURNING');assert.equal(t.sample(c).done,true);assert.equal(t.busy,false);});

test('all 28 authorized clouds match the astronomical mansion ids and decode to valid colored points',async()=>{const pack=JSON.parse(await readFile(new URL('../dist/data/statues.json',import.meta.url),'utf8'));const ms=JSON.parse(await readFile(new URL('../dist/data/mansions.json',import.meta.url),'utf8'));assert.equal(pack.items.length,28);for(const [i,item] of pack.items.entries()){assert.equal(item.id,i);assert.equal(item.name,ms[i].name);assert.ok(item.count>=20000&&item.count<=48000);const pts=decodeCloud(item);assert.equal(pts.length,item.count);assert.ok(new Set(pts.slice(0,100).map(p=>p.r)).size>10);for(const p of pts){assert.ok(Math.abs(p.x)<1&&Math.abs(p.y)<=.51&&Math.abs(p.z)<.3);assert.ok(p.r>=0&&p.r<=255);}}});
test('bundled MediaPipe model matches the recorded SHA-256',async()=>{const folder=new URL('../dist/vendor/mediapipe/',import.meta.url),meta=JSON.parse(await readFile(new URL('provenance.json',folder),'utf8')),bytes=await readFile(new URL('hand_landmarker.task',folder));assert.ok(bytes.length>1000000);assert.equal(createHash('sha256').update(bytes).digest('hex'),meta.modelSha256);assert.equal(meta.version,'1.1.1');});

test('entry and exit meet the held shape with zero endpoint velocity',()=>{
 const t=new MorphTimeline();t.start(0);const entry=t.duration.gather,exit=entry+t.duration.hold,end=exit+t.duration.return;
 const before=t.sample(entry-1),at=t.sample(entry),leaving=t.sample(exit+1);
 assert.ok(1-before.amount<1e-7);assert.equal(at.amount,1);assert.ok(1-leaving.amount<1e-7);assert.equal(leaving.formation,1);assert.ok(leaving.release>0);
 const almost=t.sample(end-1);assert.ok(almost.amount<1e-7);assert.equal(t.sample(end).done,true);
});
test('an early return preserves the current shape and releases it rather than rewinding its gathering',()=>{
 for(const time of [100,900,2000,4000]){const t=new MorphTimeline();t.start(0);const entry=t.sample(time);t.finish(time);const initial=t.sample(time),later=t.sample(time+600);assert.equal(initial.formation,entry.formation);assert.equal(initial.release,0);assert.equal(initial.amount,entry.amount);assert.equal(later.formation,entry.formation);assert.ok(later.release>0);assert.ok(later.amount<=initial.amount);}
});
test('late finish still delivers the completion event to the next display frame',()=>{
 const t=new MorphTimeline();t.start(0);t.finish(13000);assert.equal(t.busy,false);assert.equal(t.sample(13001).done,true);assert.equal(t.sample(13002).done,false);
});
test('a ripple pushes only decorative particles outward and expires without a residual displacement',()=>{
 const field=new WindField(),stars=Object.freeze([{ra:1.2,dec:-.3}]),before=JSON.stringify(stars);field.ripple({x:.5,y:.5},0);field.prepare(600);const a=field.offset(500+600*.6*.33,300,1000,600),b=field.offset(500-600*.6*.33,300,1000,600);assert.ok(a[0]>5);assert.ok(b[0]<-5);assert.ok(Math.abs(a[1])<1e-8);field.prepare(2600);assert.deepEqual(field.offset(620,300,1000,600),[0,0]);assert.equal(JSON.stringify(stars),before);
});
test('particle interaction is smoothed and keeps a bounded ripple history',()=>{
 const stage=new StatueStage(),gl=new Proxy({}, {get:()=>()=>{}});stage.gl=gl;stage.program={};stage.uniforms={};stage.canvas={width:0,height:0,style:{}};stage.origin={x:500,y:300};stage.timeline.start(0);stage.timeline.sample(5000);stage.lastDraw=5000;stage.animationStarted=0;
 const prior=globalThis.devicePixelRatio;globalThis.devicePixelRatio=1;
 try{stage.interact(1,0,5000,1);stage.draw(null,5016,1000,600,null);assert.ok(stage.pointer.x>0&&stage.pointer.x<.3);assert.ok(stage.pointer.y<0&&stage.pointer.y>-.3);for(let i=1;i<10;i++)stage.interact(.5,.5,5000+i*300,1);assert.equal(stage.ripples.length,3);stage.draw(null,11000,1000,600,null);assert.equal(stage.ripples.length,0);}finally{if(prior===undefined)delete globalThis.devicePixelRatio;else globalThis.devicePixelRatio=prior;}
});

test('the cloud changes its envelope over time, including the quiet motion setting',()=>{
 const seeds=Array.from({length:120},(_,i)=>({x:(i*.6180339)%1,y:(i*.7548776)%1,z:(i*.56984)%1}));
 for(const motion of [1,.18]){const distance=seeds.reduce((sum,s)=>{const a=cloudField(s,0,motion),b=cloudField(s,1.2,motion);return sum+Math.hypot(a.x-b.x,a.y-b.y);},0)/seeds.length;assert.ok(distance>.025);}
});
test('the gathering cloud converges to the sampled statue and releases through a different cloud',()=>{
 const target=Object.freeze({x:.21,y:-.24,z:.07}),before=JSON.stringify(target);
 for(let i=0;i<100;i++){const seed={x:i*.6180339%1,y:i*.7548776%1,z:i/100},held=cloudPose(target,seed,3,1,0),later=cloudPose(target,seed,5,1,0);assert.ok(Math.hypot(held.x-target.x,held.y-target.y,held.z-target.z)<1e-12);assert.ok(Math.hypot(held.x-later.x,held.y-later.y)<1e-12);const out=cloudPose(target,seed,8,1,1);assert.ok(Object.values(out).every(Number.isFinite));assert.ok(Math.hypot(out.x-held.x,out.y-held.y)>.01);}
 assert.equal(JSON.stringify(target),before);assert.equal(cloudPresence(0),0);assert.equal(cloudPresence(.1),1);
});
test('flow particles have real sampled surface destinations instead of zero-target ribbons',()=>{
 const points=[{x:.21,y:-.12,z:.03,r:140,g:90,b:40},{x:-.31,y:.23,z:.01,r:90,g:65,b:30}],before=JSON.stringify(points),p=createParticleBuffer(points,100);
 for(let i=0;i<100;i++){const o=i*10;assert.ok(points.some(t=>Math.abs(p.data[o]-t.x)<.001&&Math.abs(p.data[o+1]-t.y)<.001));}
 assert.equal(JSON.stringify(points),before);
});


test('surface ripples expand outwards, stay bounded, and leave no residual displacement',()=>{
 const source=Object.freeze([Object.freeze({x:.5,y:.5,time:1000,strength:1.4})]),before=JSON.stringify(source);
 const waves=prepareRippleWaves(source,1450,1000,600),radius=.45*600*.36;
 const right=rippleDisplacement(500+radius,300,waves,42),left=rippleDisplacement(500-radius,300,waves,42);
 assert.ok(right.x>8);assert.ok(left.x< -8);assert.ok(Math.abs(right.y)<1e-9);
 const stacked=rippleDisplacement(500+radius,300,[...waves,...waves,...waves],42);assert.ok(Math.hypot(stacked.x,stacked.y)<=42);
 assert.deepEqual(rippleDisplacement(600,300,prepareRippleWaves(source,1000,1000,600),42),{x:0,y:0});
 assert.deepEqual(rippleDisplacement(600,300,prepareRippleWaves(source,3500,1000,600),42),{x:0,y:0});assert.equal(JSON.stringify(source),before);
});
test('surface ripple input works throughout generation and hold without extending the automatic return',()=>{
 const stage=new StatueStage();stage.interact(.5,.5,0,1);assert.equal(stage.ripples.length,0);stage.timeline.start(0);stage.interact(.5,.5,1000,1);assert.equal(stage.ripples.length,1);stage.ripples=[];
 stage.timeline.sample(5000);stage.interact(.5,.5,5000,0);assert.equal(stage.ripples.length,0);
 stage.interact(.5,.5,5000,1);stage.interact(.6,.5,5100,1);assert.equal(stage.ripples.length,1);
 for(const t of [5300,5600,5900])stage.interact(.6,.5,t,1);assert.equal(stage.ripples.length,3);
 stage.timeline.sample(9100);const before=JSON.stringify(stage.ripples);stage.interact(.5,.5,9200,1);assert.equal(JSON.stringify(stage.ripples),before);
 assert.equal(stage.draw(null,12000,1000,600,null).done,true);assert.equal(stage.ripples.length,0);assert.equal(stage.busy,false);
});
test('Canvas held particles are displaced by a ripple and the intact body cache returns after it expires',()=>{
 const stage=new StatueStage(),dots=[],bodies=[];stage.context={clearRect(){},fillRect(x,y){dots.push({x,y});},drawImage(){bodies.push(this.globalAlpha);}};
 stage.animationStarted=0;stage.origin={x:500,y:300};stage.body={};stage.fallbackPose={};stage.fallbackDisplacement={};stage.fallbackPalette=Array(12).fill('#d5b784');
 const point=Object.freeze({target:Object.freeze({x:.1,y:0,z:0}),seed:Object.freeze({x:.6,y:.5,z:.5}),loose:false});
 stage.fallbackGroups=Array.from({length:12},(_,i)=>i===0?[point]:[]);
 const sample={formation:1,release:0,presence:1,hold:true},layout=stage.layout(1000,600);
 stage.drawFallback(layout,5500,sample,false);assert.equal(dots.length,0);assert.equal(bodies.at(-1),1);
 stage.ripples=[{x:.45,y:.52,time:5000,strength:1.2}];stage.drawFallback(layout,5500,sample,false);
 const home=layout.cx+.1*layout.size*(1+Math.sin(5.5*1.22)*.007);assert.ok(dots.at(-1).x>home+5);assert.ok(bodies.at(-1)<.6);
 const count=dots.length;stage.drawFallback(layout,7600,sample,false);assert.equal(dots.length,count);assert.equal(bodies.at(-1),1);
});

test('slow and fast palm drags with the same endpoints reach the same canvas position',()=>{
 const totals=[];for(const duration of [300,1200]){const n=new HandNavigator();let sum=0;for(let t=0;t<=duration+250;t+=10){if(t%50===0)n.feed(sample('open',.3+.18*Math.min(1,t/duration)),t);sum+=n.step(t).dx;}totals.push(sum);}
 assert.ok(Math.abs(totals[0]-.18)<.0001);assert.ok(Math.abs(totals[0]-totals[1])<.0001);
});
test('a closed-loop palm drag returns to its initial position with no speed-dependent drift',()=>{
 const n=new HandNavigator();let total=0;for(let t=0;t<=1500;t+=10){if(t%50===0){const p=t<600?t/600:t<1200?2-t/600:0;n.feed(sample('open',.3+.15*p),t);}total+=n.step(t).dx;}assert.ok(Math.abs(total)<.0001);
});
