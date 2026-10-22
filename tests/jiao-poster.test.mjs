import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createParticleBuffer,decodeCloud,StatueStage} from '../dist/particle-effects.js';
import {jiaoOrbit,jiaoPresence,jiaoFringePose,jiaoSmokeLife,drawJiaoAtmosphere} from '../dist/jiao-style.js';
const item=JSON.parse(await readFile(new URL('../dist/data/jiao-poster.json',import.meta.url),'utf8'));
test('Jiao uses the supplied poster figure, its own pose and colors, with no mesh',()=>{
 assert.equal(item.id,0);assert.equal(item.name,'角');assert.equal(item.title,'角木蛟');assert.equal(item.style,'jiao-poster');assert.equal(item.sourceSha256,'52ad4e6aac920997697c95d01bb156c5ea2f4fd2221c2d085cf89870886fae70');assert.equal(item.count,96000);
 assert.deepEqual(item.sourceSize,[1024,1536]);assert.deepEqual(item.crop,[157,124,793,1338]);assert.equal(Buffer.from(item.data,'base64').length,96000*9);assert.equal(item.kind,undefined);
 const points=decodeCloud(item);assert.ok(points.every(p=>Object.values(p).every(Number.isFinite)&&Math.abs(p.x)<.5&&Math.abs(p.y)<=.501&&Math.abs(p.z)<.08));
 assert.ok(points.filter(p=>p.y<-.35).length>7000);assert.ok(points.filter(p=>p.y>.1).length>20000);assert.ok(points.some(p=>p.b>p.r+30)&&points.some(p=>p.g>p.r+30));
});
test('the ordinary v21 particle upload remains byte for byte unchanged',()=>{
 const points=[{x:.1,y:-.2,z:.03,r:230,g:150,b:40},{x:-.3,y:.4,z:-.01,r:12,g:21,b:32}],packed=createParticleBuffer(points);
 assert.equal(createHash('sha256').update(Buffer.from(packed.data.buffer)).digest('hex'),'89ca8aea8b35c05dc06a12b231b2a31a8cd229a15b387494d7ad17f4034f32ae');
});

test('feathering preserves the exact surface and facial detail while giving the boundary a gradual alpha ramp',()=>{
 assert.equal(createHash('sha256').update(Buffer.from(item.data,'base64')).digest('hex'),'c21511c01b02166b8d2b3bb080ab97409a73dcb26449ea274b739c4bddc57b7b');
 const points=decodeCloud(item),ramp=points.filter(p=>p.opacity<.99);
 assert.ok(ramp.length>3000&&ramp.length<20000);assert.ok(new Set(ramp.map(p=>p.opacity)).size>100);assert.ok(ramp.every(p=>p.opacity>=.21));
 // Protected face is expressed in normalized coordinates of the same crop.
 const face=points.filter(p=>p.x>-.001&&p.x<.075&&p.y>-.43&&p.y<-.35);
 assert.ok(face.length>800);assert.ok(face.every(p=>p.opacity===1));
});

test('weathering and all 36k support grains originate on actual surface samples, with no detached bank',()=>{
 assert.equal(item.fringe,undefined);assert.equal(item.weathering.kind,'surface-edge');assert.equal(item.weathering.count,96000);assert.equal(Buffer.from(item.weathering.data,'base64').length,96000*4);
 const points=decodeCloud(item),edges=points.filter(p=>p.emitX||p.emitY),packed=createParticleBuffer(points,48000,true);
 assert.equal(edges.length,item.weathering.active);assert.ok(edges.length>3000&&edges.length<9000);assert.ok(edges.every(p=>Math.hypot(p.emitX,p.emitY)>.06&&Math.hypot(p.emitX,p.emitY)<.202));
 const key=(x,y,z,r,g,b)=>[Math.round(x*1000),Math.round(y*1000),Math.round(z*1000),r,g,b].join(','),sources=new Set(edges.map(p=>key(p.x,p.y,p.z,p.r,p.g,p.b)));
 for(let i=0;i<36000;i++){const o=i*10,d=packed.data;assert.ok(sources.has(key(d[o],d[o+1],d[o+2],Math.round(d[o+3]*255),Math.round(d[o+4]*255),Math.round(d[o+5]*255))));assert.ok(packed.emission[i*2]||packed.emission[i*2+1]);}
 let movingBody=0;for(let i=48000;i<packed.count;i++)if(packed.emission[i*2]||packed.emission[i*2+1])movingBody++;assert.equal(movingBody,edges.length);assert.equal(packed.emission.byteLength,144000*8);
 const face=points.filter(p=>p.x>-.001&&p.x<.075&&p.y>-.43&&p.y<-.35);assert.ok(face.every(p=>p.emitX===0&&p.emitY===0));
 assert.throws(()=>decodeCloud({...item,edgeAlpha:'AA=='}),/羽化/);assert.throws(()=>decodeCloud({...item,weathering:{...item.weathering,data:'AA=='}}),/风化/);
});

test('weathering stays on the body before detaching, with zero starting speed and no minimum gap',()=>{
 const target={x:.2,y:-.1,z:.03},seed={x:0,y:0,z:.4},emission={x:.15,y:.03},life=jiaoSmokeLife(seed);
 for(const phase of [.04,.07,.1,.14]){const p=jiaoFringePose(target,seed,phase*life,emission);assert.equal(p.x,target.x);assert.equal(p.y,target.y);assert.equal(p.z,target.z);assert.equal(p.alpha,1);}
 const near=jiaoFringePose(target,seed,.1401*life,emission);assert.ok(Math.hypot(near.x-target.x,near.y-target.y)<1e-8);
 const bins=Array(6).fill(0),limits=[.002,.006,.015,.03,.06,Infinity];for(let i=50;i<950;i++){const p=jiaoFringePose(target,seed,i/1000*life,emission),distance=Math.hypot(p.x-target.x,p.y-target.y);bins[limits.findIndex(n=>distance<n)]++;}assert.ok(bins.every(n=>n>20),'continuous near-to-far density with no empty annulus');
});

test('smoke leaves the surface continuously and vanishes before each invisible recycle',()=>{
 const target={x:.3,y:-.4,z:.02},seed={x:0,y:0,z:.42},original={...target},emission={x:.09,y:0},life=jiaoSmokeLife(seed);
 const a=jiaoFringePose(target,seed,life*.14,emission),b=jiaoFringePose(target,seed,life*.8,emission);
 assert.ok(Math.hypot(b.x-a.x,b.y-a.y)>.012);assert.equal(a.x,target.x);assert.ok(b.x>=target.x-1e-10);assert.ok(b.alpha<a.alpha);
 for(const phase of [0,1e-5,1-1e-5,1]){const p=jiaoFringePose(target,seed,life*phase,emission);assert.ok(p.alpha<1e-5,'invisible at the recycle seam');}
 const mid=jiaoFringePose(target,seed,life*.5,emission),repeat=jiaoFringePose(target,seed,life*1.5,emission);assert.ok(Math.abs(mid.alpha-repeat.alpha)<1e-10);assert.ok(Math.hypot(mid.x-repeat.x,mid.y-repeat.y)>.0005,'new packets follow the evolving field');
 const normal=jiaoFringePose(target,seed,life*.6,emission),slow=jiaoFringePose(target,seed,life*.6/.18,emission,.18);for(const k of ['x','y','alpha'])assert.ok(Math.abs(slow[k]-normal[k])<1e-10,'reduced motion slows the field and lifecycle');
 assert.deepEqual(target,original);
});

test('smoke turns along a shared slow flow rather than travelling along one fixed direction',()=>{
 const target={x:.2,y:-.1,z:0},seed={x:0,y:0,z:.4},emission={x:.15,y:.03},life=jiaoSmokeLife(seed);
 assert.ok(life>7&&life<12);const a=jiaoFringePose(target,seed,life*.25,emission),b=jiaoFringePose(target,seed,life*.5,emission),c=jiaoFringePose(target,seed,life*.75,emission);
 const u={x:b.x-a.x,y:b.y-a.y},v={x:c.x-b.x,y:c.y-b.y};assert.ok(Math.abs(u.x*v.y-u.y*v.x)/(Math.hypot(u.x,u.y)*Math.hypot(v.x,v.y))>.25,'trajectory has a visible bend');
 for(let phase=.2;phase<.85;phase+=.025){const p=jiaoFringePose(target,seed,life*phase,emission),q=jiaoFringePose(target,seed,life*phase+.02,emission);assert.ok(Math.hypot(q.x-p.x,q.y-p.y)/.02<.04,'no high speed outward burst');}
 const neighbour=jiaoFringePose({x:target.x+.001,y:target.y-.001,z:0},seed,life*.5,emission);assert.ok(Math.hypot(neighbour.x-b.x,neighbour.y-b.y)<.006,'nearby grains share a coherent wisp');
});
test('decorative atmosphere retains four dotted arcs and draws neither connected star chains nor their nodes',()=>{
 const calls={strokes:0,fills:0,nodes:0,dashes:[]},ctx=new Proxy({stroke(){calls.strokes++;},fill(){calls.fills++;},arc(){calls.nodes++;},setLineDash(value){calls.dashes.push(value);}},{get:(o,k)=>o[k]||(()=>{})});
 drawJiaoAtmosphere(ctx,{cx:500,cy:350,size:600,width:1280,height:720},5.6,1,0);
 assert.equal(calls.strokes,4);assert.equal(calls.fills,0);assert.equal(calls.nodes,0);assert.ok(calls.dashes.every(d=>d.length===2));
});
test('switching away from Jiao disables its emission attribute so other statues retain their original motion',()=>{
 const calls=[],stage=new StatueStage();stage.canvas={style:{},setAttribute(){}};stage.initRenderer=()=>{};stage.emissionLocation=4;
 stage.gl={ARRAY_BUFFER:1,STATIC_DRAW:2,FLOAT:3,bindBuffer(){},bufferData(){},createBuffer(){return {};},enableVertexAttribArray(loc){calls.push(['enable',loc]);},vertexAttribPointer(){},disableVertexAttribArray(loc){calls.push(['disable',loc]);},vertexAttrib2f(loc,x,y){calls.push(['constant',loc,x,y]);}};
 const poster={style:'jiao-poster'},ordinary={id:2};stage.prepare=item=>({points:[],bounds:{},packed:{count:0,data:new Float32Array(),...(item===poster?{emission:new Float32Array()}: {})}});
 stage.start(poster,0);stage.timeline.state='IDLE';stage.timeline.cooldownUntil=0;stage.start(ordinary,100);
 assert.deepEqual(calls,[['enable',4],['disable',4],['constant',4,0,0]]);
});
test('Canvas held contour particles keep shedding and fading rather than becoming part of the static body cache',()=>{
 const stage=new StatueStage(),dots=[];stage.posterMode=true;stage.animationStarted=0;stage.origin={x:500,y:300};stage.body={};stage.fallbackPose={};stage.fallbackSurface={};stage.fallbackFlight={};stage.fallbackPalette=Array(12).fill('#bce2eb');
 stage.context={globalAlpha:1,clearRect(){},fillRect(x,y){dots.push({x,y,alpha:this.globalAlpha});},drawImage(){}};
 stage.fallbackGroups=Array.from({length:12},(_,i)=>i===0?[{target:{x:.3,y:-.2,z:0},seed:{x:0,y:0,z:.42},loose:false,fringe:true,weather:true,emission:{x:.09,y:0},opacity:1}]:[]);
 const layout=stage.layout(1280,720),sample={formation:1,release:0,presence:1,hold:true},life=jiaoSmokeLife({z:.42});
 stage.drawFallback(layout,life*1.2*1000,sample,false);const a=dots.at(-1);stage.drawFallback(layout,life*1.8*1000,sample,false);const b=dots.at(-1);
 assert.equal(dots.length,2);assert.ok(Math.hypot(b.x-a.x,b.y-a.y)>6);assert.ok(b.alpha<a.alpha*.4);assert.ok(a.alpha>.5);
});

test('Canvas animates every weathering body grain and excludes them from the fixed surface cache',()=>{
 const prior=globalThis.document,stage=new StatueStage();let canvasCount=0,cacheDots=0;
 globalThis.document={createElement(){const body=canvasCount++===0;return {getContext(){return {fillRect(){if(body)cacheDots++;},createRadialGradient(){return {addColorStop(){}};}};}};}};
 try{stage.posterMode=true;stage.item=item;const prepared=stage.prepare(item);stage.points=prepared.points;stage.prepareFallback();const grains=stage.fallbackGroups.flat();
  assert.equal(cacheDots,item.count-item.weathering.active);assert.equal(grains.filter(p=>p.weather&&!p.fringe).length,item.weathering.active);assert.equal(grains.length,12000);assert.ok(grains.filter(p=>p.weather).every(p=>p.color&&p.emission));
 }finally{if(prior===undefined)delete globalThis.document;else globalThis.document=prior;}
});
test('poster upload preserves cool colors with a 144k point budget and a separate bounded cache',()=>{
 const stage=new StatueStage(),points=decodeCloud(item),packed=createParticleBuffer(points,48000,true);assert.equal(packed.count,144000);assert.equal(packed.data.byteLength,144000*40);
 const o=48000*10;assert.ok(Math.abs(packed.data[o+3]-points[0].r/255)<1e-7);assert.ok(Math.abs(packed.data[o+5]-points[0].b/255)<1e-7);
 const old={id:0,count:1,data:Buffer.alloc(9).toString('base64')};stage.prepare(old);const poster=stage.prepare(item);assert.equal(stage.prepare(item),poster);assert.equal(poster.points.length,96000);assert.equal(stage.prepared.size,2);
});
test('poster orbits evolve over time, stay bounded and fade at both transitions',()=>{
 for(let k=0;k<4;k++)for(let u=0;u<=1;u+=.1){const a=jiaoOrbit(u,2,k),b=jiaoOrbit(u,4,k);assert.ok(Math.abs(a.x)<.65&&Math.abs(a.y)<.8);assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>.005);}
 assert.equal(jiaoPresence(0),0);assert.equal(jiaoPresence(1,1),0);assert.ok(jiaoPresence(.6)>.5);
});
test('Jiao uses one GPU draw and no point uploads per frame; other mansions do not paint its orbits',()=>{
 const calls={draws:0,uploads:0,orbits:0,flags:[]},gl=new Proxy({drawArrays(){calls.draws++;},bufferData(){calls.uploads++;},uniform1f(name,value){if(name==='poster')calls.flags.push(value);}},{get:(o,k)=>o[k]||(()=>{})}),stage=new StatueStage();
 stage.gl=gl;stage.program={};stage.uniforms={uPoster:'poster'};stage.canvas={width:0,height:0,style:{},setAttribute(){}};stage.particleCount=144000;stage.origin={x:500,y:350};stage.animationStarted=0;stage.timeline.start(0);stage.drawPosterLines=()=>calls.orbits++;
 const prior=globalThis.devicePixelRatio;globalThis.devicePixelRatio=1;try{stage.posterMode=false;stage.draw(null,1000,1280,720);stage.posterMode=true;stage.draw(null,1100,1280,720);stage.draw(null,5600,1280,720);assert.deepEqual(calls,{draws:3,uploads:0,orbits:2,flags:[0,1,1]});stage.posterCanvas={hidden:false};stage.draw(null,12010,1280,720);assert.equal(stage.posterCanvas.hidden,true);}finally{if(prior===undefined)delete globalThis.devicePixelRatio;else globalThis.devicePixelRatio=prior;}
});


test('the 28 original image assets and v21 navigation / gesture code stay unchanged',async()=>{
 const bytes=await readFile(new URL('../dist/data/statues.json',import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),'70e0f1ef689c9508552c06d14673e3d8079c5b1660755607bc720a5c62220966');
 const baseline={"dist/astronomy.js":"6022fe7be84cd816c16b02ae18a09115d21e85c5","dist/cloud-field.js":"1fdf09b69f34e71ae0a60cef025b74c085cddd5a","dist/gesture-camera.js":"b289de58b568aef57be7ef805b3662cd7be13b93","dist/gesture-core.js":"dd04d735a2b7a6f9e11a3a4f27069aeb2b072677","dist/hand-worker.js":"ff71cb724f9362bbca631c5b2526090e5c94dbd1","dist/style.css":"c951500c5d896aa3541bc74a735b4b16f7c4d5fc"};
 for(const [file,sha]of Object.entries(baseline)){const text=(await readFile(new URL('../'+file,import.meta.url),'utf8')).replaceAll('v=30','v=21');const data=Buffer.from(text);assert.equal(createHash('sha1').update(Buffer.from('blob '+data.length+'\0')).update(data).digest('hex'),sha,file);}
});
