import test from 'node:test';
import assert from 'node:assert/strict';
import {initExperience} from '../dist/experience.js';
import {describeHand,HandNavigator} from '../dist/gesture-core.js';
import {MorphTimeline} from '../dist/particle-effects.js';
import {RAD,panSky} from '../dist/astronomy.js';
import {POSTER_DEFINITIONS} from '../dist/qinglong-posters.js';
import {handLandmarks} from './hand-fixtures.mjs';

// Raw camera landmarks pass through the real coordinator and astronomical pan.
// Camera/GPU resources are replaced, but navigation and reacquisition are not.
async function reentryScene(run,mode='sphere'){
 const names=['document','window','fetch','innerWidth','innerHeight','matchMedia','requestIdleCallback','cancelIdleCallback'],saved=new Map(names.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
 const elements=new Map(),events=new Map(),classes=new Set(),pans=[];
 let callbacks,clock=performance.now()+1000,selections=0,zooms=0;const base=clock;
 const camera={ra:1,dec:.1,fov:94*RAD,zoom:1},viewport={w:800,h:600,cx:500,cy:400};
 const element=id=>{if(!elements.has(id))elements.set(id,{id,hidden:['gesture-panel','statue-stage-ui','gesture-hud'].includes(id),style:{},textContent:'',value:0,setAttribute(name,value){this[name]=value;},focus(){},getContext(){return {clearRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},arc(){},fill(){}};}});return elements.get(id);};
 const listen=(type,listener)=>{if(!events.has(type))events.set(type,[]);events.get(type).push(listener);};
 globalThis.document={hidden:false,body:{style:{setProperty(){}},insertAdjacentHTML(){},classList:{add:name=>classes.add(name),remove:name=>classes.delete(name),contains:name=>classes.has(name),toggle(name,value){const on=value??!classes.has(name);if(on)classes.add(name);else classes.delete(name);return on;}}},getElementById:element,querySelector:()=>({inert:false}),addEventListener:listen};
 globalThis.window={addEventListener:listen};globalThis.innerWidth=1000;globalThis.innerHeight=800;globalThis.matchMedia=()=>({matches:false});globalThis.requestIdleCallback=()=>0;globalThis.cancelIdleCallback=()=>{};
 globalThis.fetch=async url=>{const spec=POSTER_DEFINITIONS.find(p=>p.url===url);assert.ok(spec);return {ok:true,json:async()=>({...spec,count:96000})};};
 const stage={timeline:new MorphTimeline(),busy:false,occludesSky:false,prepare(){},interact(){},interactFingers(){},pointer:{},draw(){return {state:'IDLE'};}};
 const input={running:false,inferenceMs:30,async start(){this.running=true;callbacks.onStatus('running','已接入');},stop(){this.running=false;callbacks.onSample(null,++clock,null,0);callbacks.onStatus('off','已关闭');}};
 const adapter={selected:()=>({id:15,name:'娄'}),blocked:()=>false,notice(){},nearest:()=>15,mansionName:()=> '娄',stopNavigation(){},selectNearest(){selections++;return 15;},pan(dx,dy){pans.push({dx,dy});Object.assign(camera,panSky(camera,mode,viewport,dx,dy));},zoom(){zooms++;},snapshot:()=>({camera:{...camera}}),restore(){}};
 try{
  const experience=initExperience(adapter,{cameraFactory:(_video,c)=>{callbacks=c;return input;},stageFactory:()=>stage});await new Promise(resolve=>setImmediate(resolve));
  const emit=(points,offset,{confidence=.96,handCount=points?1:0}={})=>{clock=base+offset;callbacks.onSample(points?describeHand(points,confidence,handCount):null,clock,points,handCount,{receivedAt:clock});experience.beforeFrame(clock);};
  await run({base,camera,pans,emit,frame:offset=>experience.beforeFrame(base+offset),counts:()=>({selections,zooms}),total:()=>pans.reduce((sum,p)=>({dx:sum.dx+p.dx,dy:sum.dy+p.dy}),{dx:0,dy:0})});
 }finally{for(const [name,descriptor]of saved){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}}
}
const close=(actual,expected,message)=>assert.ok(Math.abs(actual-expected)<1e-9,`${message}: ${actual} versus ${expected}`);
const sameView=(actual,expected)=>{for(const key of ['ra','dec','fov','zoom'])close(actual[key],expected[key],key+' stays fixed');};
function moveStart(s){for(const [time,dx]of [[0,0],[100,.02],[200,.04]])s.emit(handLandmarks({dx}),time);s.frame(300);close(s.total().dx,-.04,'the original drag was applied');}

for(const mode of ['sphere','atlas'])for(const missingTime of [40,900]){
 test(`${mode}: a ${missingTime}ms loss keeps the sky fixed through a moving return and stable regrab`,async()=>reentryScene(async s=>{
  moveStart(s);s.emit(null,310);const held={...s.camera};
  // Reenter within 0.04 of the old palm, which previously reused its anchor.
  const start=310+missingTime;s.emit(handLandmarks({dx:.01}),start);s.frame(start+30);sameView(s.camera,held);
  for(const [offset,dx]of [[60,-.01],[120,-.03],[180,-.05]]){s.emit(handLandmarks({dx}),start+offset);s.frame(start+offset+20);sameView(s.camera,held);}
  for(const offset of [240,300,360,420]){s.emit(handLandmarks({dx:-.05}),start+offset);s.frame(start+offset+20);sameView(s.camera,held);}
  s.emit(handLandmarks({dx:-.03}),start+520);s.frame(start+700);close(s.total().dx,-.06,'only the new grab displacement is added');assert.deepEqual(s.counts(),{selections:0,zooms:0});
 },mode));
}

test('a single missing sample immediately clears unfinished interpolation',()=>{
 const navigator=new HandNavigator(),sample=x=>({pose:'open',palm:{x,y:.5},span:.15});
 navigator.feed(sample(.4),0);navigator.feed(sample(.5),100);const before=navigator.step(120).dx;assert.ok(before>0&&before<.1);
 navigator.feed(null,130);for(const now of [140,180,260,400])assert.deepEqual(navigator.step(now),{dx:0,dy:0},'no queued drag is applied after release');
});

test('a stationary off-centre palm regrabs at 80ms, never before, with no third-sample delay',()=>{
 const navigator=new HandNavigator(),sample=x=>({pose:'open',palm:{x,y:.5},span:.15});
 navigator.feed(sample(.4),0);navigator.feed(null,20);navigator.feed(sample(.7),30);
 navigator.feed(sample(.7),109);assert.equal(navigator.awaitingGrip,true);assert.equal(navigator.previous,null);
 navigator.feed(sample(.7),110);assert.equal(navigator.awaitingGrip,false);assert.equal(navigator.previous.x,.7);
 assert.deepEqual(navigator.step(130),{dx:0,dy:0},'regrabbing only establishes an anchor');
 navigator.feed(sample(.72),150);assert.ok(navigator.step(230).dx>0);
 const lowRate=new HandNavigator();lowRate.feed(null,0);lowRate.feed(sample(.7),10);lowRate.feed(sample(.7),110);
 assert.equal(lowRate.awaitingGrip,false,'10Hz input needs only its next sample, not 200ms for a third');
});

test('cumulative return movement beyond the resting radius restarts the 80ms grab timer',()=>{
 const navigator=new HandNavigator(),sample=x=>({pose:'open',palm:{x,y:.5},span:.15});
 navigator.feed(null,0);navigator.feed(sample(.70),10);navigator.feed(sample(.692),50);navigator.feed(sample(.684),90);
 assert.equal(navigator.awaitingGrip,true);assert.equal(navigator.previous,null);
 navigator.feed(sample(.684),169);assert.equal(navigator.awaitingGrip,true);
 navigator.feed(sample(.684),170);assert.equal(navigator.awaitingGrip,false);assert.equal(navigator.previous.x,.684);
 assert.deepEqual(navigator.step(220),{dx:0,dy:0});
});

for(const edge of [
 {name:'left',initial:{dx:.31},out:{dx:.40},near:{dx:.37},inside:{dx:.29},next:{dx:.31},axis:'dx',delta:-.02},
 {name:'right',initial:{dx:-.33},out:{dx:-.43},near:{dx:-.40},inside:{dx:-.31},next:{dx:-.33},axis:'dx',delta:.02},
 {name:'top',initial:{dy:-.58},out:{dy:-.67},near:{dy:-.64},inside:{dy:-.56},next:{dy:-.58},axis:'dy',delta:-.02},
 {name:'bottom',initial:{dy:.04},out:{dy:.13},near:{dy:.10},inside:{dy:.02},next:{dy:.04},axis:'dy',delta:.02}
]){
 test(`a clipped ${edge.name} palm releases without a missing camera sample`,async()=>reentryScene(async s=>{
  s.emit(handLandmarks(edge.initial),0);s.emit(handLandmarks(edge.out),100);s.frame(170);const held={...s.camera};
  // Staying in the .02/.06 hysteresis band never acquires a new drag.
  for(const offset of [200,280,360,440]){s.emit(handLandmarks(edge.near),offset);s.frame(offset+25);sameView(s.camera,held);}
  for(const offset of [520,580,640,700]){s.emit(handLandmarks(edge.inside),offset);s.frame(offset+25);sameView(s.camera,held);}
  const total=s.total();s.emit(handLandmarks(edge.next),800);s.frame(1000);close(s.total()[edge.axis]-total[edge.axis],edge.delta,'the next deliberate drag uses its new anchor');assert.deepEqual(s.counts(),{selections:0,zooms:0});
 }));
}

test('returning at the same location still requires a stable grab before motion resumes',async()=>reentryScene(async s=>{
 moveStart(s);s.emit(null,310);const held={...s.camera};
 for(const [time,dx]of [[350,.04],[410,.02],[470,0],[530,-.02]]){s.emit(handLandmarks({dx}),time);s.frame(time+20);sameView(s.camera,held);}
 for(const time of [590,650,710,770]){s.emit(handLandmarks({dx:-.02}),time);s.frame(time+20);sameView(s.camera,held);}
 s.emit(handLandmarks({dx:0}),870);s.frame(1050);close(s.total().dx,-.06,'return travel was excluded from the new drag');
}));

test('ordinary continuous palm movement still follows the full measured displacement',async()=>reentryScene(async s=>{
 for(let offset=0;offset<=1000;offset+=100)s.emit(handLandmarks({dx:offset*.0001}),offset);s.frame(1250);close(s.total().dx,-.1,'continuous dragging has no lost displacement');close(s.total().dy,0,'horizontal drag stays horizontal');assert.deepEqual(s.counts(),{selections:0,zooms:0});
}));

test('a slow moving return cannot become stable merely because each individual step is small',async()=>reentryScene(async s=>{
 moveStart(s);s.emit(null,310);const held={...s.camera};
 for(let i=0;i<=10;i++){const time=350+i*60;s.emit(handLandmarks({dx:-.006*i}),time);s.frame(time+20);sameView(s.camera,held);}
 for(const time of [1010,1070,1130,1190]){s.emit(handLandmarks({dx:-.06}),time);s.frame(time+20);sameView(s.camera,held);}
 s.emit(handLandmarks({dx:-.04}),1290);s.frame(1470);close(s.total().dx,-.06,'only movement after the stable grab is added');
}));

test('a stable regrab can be off centre and tolerates small landmark jitter',async()=>reentryScene(async s=>{
 moveStart(s);s.emit(null,310);const held={...s.camera};
 for(const [time,dx]of [[350,-.20],[380,-.197],[410,-.202],[430,-.20],[470,-.20]]){s.emit(handLandmarks({dx}),time);s.frame(time+20);sameView(s.camera,held);}
 s.emit(handLandmarks({dx:-.18}),570);s.frame(750);close(s.total().dx,-.06,'the off-centre anchor supports a new drag');
}));

test('a stalled camera releases unfinished interpolation before the next display step',async()=>reentryScene(async s=>{
 s.emit(handLandmarks(),0);s.emit(handLandmarks({dx:.04}),100);s.frame(120);const held={...s.camera},total=s.total();assert.ok(total.dx<0&&total.dx>-.04);
 s.frame(900);sameView(s.camera,held);
 for(const time of [1000,1060,1120,1180]){s.emit(handLandmarks({dx:.01}),time);s.frame(time+20);sameView(s.camera,held);}
 s.emit(handLandmarks({dx:.03}),1280);s.frame(1460);close(s.total().dx-total.dx,-.02,'the stale frame is never applied after reacquisition');
}));

for(const interruption of ['low confidence','two hands']){
 test(interruption+' releases a drag and returning single-hand input must regrab',async()=>reentryScene(async s=>{
  moveStart(s);s.emit(handLandmarks({dx:.01}),310,interruption==='two hands'?{handCount:2}:{confidence:.5});const held={...s.camera};
  for(const time of [350,410,470,530]){s.emit(handLandmarks({dx:.01}),time);s.frame(time+20);sameView(s.camera,held);}
  s.emit(handLandmarks({dx:.03}),630);s.frame(810);close(s.total().dx,-.06,'only accepted motion after the new grab pans the sky');assert.deepEqual(s.counts(),{selections:0,zooms:0});
 }));
}
