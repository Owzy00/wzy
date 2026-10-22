import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createParticleBuffer,decodeCloud,StatueStage} from '../dist/particle-effects.js';
import {jiaoOrbit,jiaoPresence} from '../dist/jiao-style.js';
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
 const baseline={"dist/app.js":"957005d6ffc94d5704460b7b4ba20f4689da7f18","dist/astronomy.js":"6022fe7be84cd816c16b02ae18a09115d21e85c5","dist/cloud-field.js":"1fdf09b69f34e71ae0a60cef025b74c085cddd5a","dist/gesture-camera.js":"b289de58b568aef57be7ef805b3662cd7be13b93","dist/gesture-core.js":"dd04d735a2b7a6f9e11a3a4f27069aeb2b072677","dist/hand-worker.js":"ff71cb724f9362bbca631c5b2526090e5c94dbd1","dist/style.css":"c951500c5d896aa3541bc74a735b4b16f7c4d5fc"};
 for(const [file,sha]of Object.entries(baseline)){const text=(await readFile(new URL('../'+file,import.meta.url),'utf8')).replaceAll('v=23','v=21');const data=Buffer.from(text);assert.equal(createHash('sha1').update(Buffer.from('blob '+data.length+'\0')).update(data).digest('hex'),sha,file);}
});
