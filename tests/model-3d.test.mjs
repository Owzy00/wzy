import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {decodeModel,modelRotation,rotateModel,modelProjection} from '../dist/model-3d.js';
import {createParticleBuffer,StatueStage} from '../dist/particle-effects.js';
import {sampleSTL} from '../scripts/sample-stl.mjs';
const model=JSON.parse(await readFile(new URL('../dist/data/kang-3d.json',import.meta.url),'utf8')),points=decodeModel(model);
test('the real Kang asset preserves full surface depth, normals and exact source provenance',()=>{
 assert.equal(model.id,1);assert.equal(model.name,'亢');assert.equal(model.count,120000);assert.equal(model.source.triangles,2711708);assert.equal(model.source.sha256,'65754f5fdc85f71b2dc2454b7a94153e4fe15ebc0db3fb0b1486b07d8aa8ec3b');
 assert.ok(model.source.bytes>100000000);assert.ok(Buffer.from(model.data,'base64').length<1500000);
 for(const p of points){assert.ok(Object.values(p).every(Number.isFinite));assert.ok(Math.abs(p.y)<=.441);assert.ok(Math.abs(Math.hypot(p.nx,p.ny,p.nz)-1)<.008);}
 assert.ok(Math.min(...points.map(p=>p.z))<-.15);assert.ok(Math.max(...points.map(p=>p.z))>.15);assert.ok(points.some(p=>p.r>p.b)&&points.some(p=>p.b>p.r*1.5));
});
test('a complete yaw preserves distances and exposes real side and rear geometry',()=>{
 const p=Object.freeze({x:.2,y:-.15,z:.1}),before=JSON.stringify(p),side=rotateModel(p,modelRotation(Math.PI/2)),back=rotateModel(p,modelRotation(Math.PI)),loop=rotateModel(p,modelRotation(Math.PI*2,.3));
 assert.ok(Math.abs(side.x-.1)<1e-7&&Math.abs(side.z+.2)<1e-7);assert.ok(Math.abs(back.x+.2)<1e-7&&Math.abs(back.z+.1)<1e-7);assert.ok(Math.abs(Math.hypot(...Object.values(loop))-Math.hypot(...Object.values(p)))<1e-7);assert.equal(JSON.stringify(p),before);
 assert.ok(modelProjection({z:-.2})>modelProjection({z:.2}));
});
test('3D destinations and normals are static, with the same 144k draw budget',()=>{
 const packed=createParticleBuffer(points,24000,true);assert.equal(packed.count,144000);assert.equal(packed.stride,13);assert.equal(packed.data.byteLength,144000*52);assert.ok(packed.data.every(Number.isFinite));
 for(const i of [0,789,23999,24000,143999]){const p=points[i<24000?(i*7919+13)%points.length:i-24000],o=i*13;assert.ok(Math.abs(packed.data[o]-p.x)<(i<24000?.0008:1e-7));assert.ok(Math.abs(packed.data[o+12]-p.nz)<1e-7);}
});
test('malformed 3D clouds reject partial data and unsupported formats',()=>{
 assert.throws(()=>decodeModel({...model,data:model.data.slice(0,-4)}),/byte count/);assert.throws(()=>decodeModel({...model,format:'image'}),/Unsupported/);
});
test('STL sampling is deterministic, area weighted and maps Z up to screen Y',()=>{
 const bytes=Buffer.alloc(184);bytes.writeUInt32LE(2,80);
 const triangles=[[[0,0,0],[1,0,0],[0,0,1]],[[3,0,0],[5,0,0],[3,0,2]]];
 for(let f=0;f<2;f++)for(let v=0;v<3;v++)for(let d=0;d<3;d++)bytes.writeFloatLE(triangles[f][v][d],84+f*50+12+v*12+d*4);
 const a=sampleSTL(bytes,1000),b=sampleSTL(bytes,1000),p=decodeModel(a);assert.equal(a.data,b.data);assert.equal(p.filter(p=>p.x>.1).length,800);assert.ok(p.every(p=>Math.abs(p.z)<1e-8));assert.ok(p.some(p=>p.y<-.3));
 assert.throws(()=>sampleSTL(bytes.subarray(0,180)),/complete/);assert.throws(()=>sampleSTL(Buffer.alloc(12)),/incomplete/);
});
test('model rotation is independent of finger ripple locations and is unbounded in yaw',()=>{
 const stage=new StatueStage();stage.model3d=true;stage.timeline.start(0);assert.equal(stage.beginRotation(.2,.3),true);stage.dragRotation(.9,.7);assert.ok(stage.rotationOffset.yaw>Math.PI);assert.ok(stage.rotationOffset.pitch<=.85);stage.endRotation();const yaw=stage.rotationOffset.yaw;stage.dragRotation(.1,.1);assert.equal(stage.rotationOffset.yaw,yaw);
 stage.timeline.sample(5000);stage.interactFingers([{finger:'index',x:.4,y:.4,strength:.9,motion:true}],5100,{x:.6,y:.5});assert.equal(stage.ripples.length,1);assert.equal(stage.ripples[0].finger,'index');stage.finish(5200);assert.equal(stage.rotationDrag,null);
 stage.model3d=false;assert.equal(stage.beginRotation(.5,.5),false);
});
test('rotating a 3D surface updates uniforms with one draw and zero per-frame uploads',()=>{
 const calls={draws:0,uploads:0,matrices:0},gl=new Proxy({drawArrays(){calls.draws++;},bufferData(){calls.uploads++;},uniformMatrix3fv(){calls.matrices++;}},{get:(o,k)=>o[k]||(()=>{})});
 const stage=new StatueStage();stage.gl=gl;stage.program={};stage.uniforms={};stage.canvas={width:0,height:0,style:{},setAttribute(){}};stage.model3d=true;stage.particleCount=144000;stage.timeline.start(0);stage.animationStarted=0;stage.lastDraw=0;
 const prior=globalThis.devicePixelRatio;globalThis.devicePixelRatio=1;try{stage.draw(null,5000,1280,720);const yaw=stage.yaw;stage.draw(null,5500,1280,720);assert.ok(stage.yaw>yaw);assert.deepEqual(calls,{draws:2,uploads:0,matrices:2});}finally{if(prior===undefined)delete globalThis.devicePixelRatio;else globalThis.devicePixelRatio=prior;}
});
test('Canvas fallback projects actual depth and rotates geometry instead of a flat cache',()=>{
 const stage=new StatueStage(),dots=[];stage.context={clearRect(){dots.length=0;},fillRect(x,y){dots.push({x,y});}};stage.model3d=true;stage.sources=[];stage.origin={x:300,y:300};stage.animationStarted=0;
 const particle={target:{x:.2,y:0,z:.12},normal:{x:0,y:0,z:-1},color:{r:.5,g:.9,b:.9},seed:{x:.5,y:.5,z:.5},loose:false};stage.fallbackDraw=[{particle,target:{},pose:{},normal:{},screen:{},flight:{},displacement:{}}];
 const layout=stage.layout(1000,800),sample={formation:1,release:0};modelRotation(0,0,stage.rotation);stage.drawModelFallback(layout,5600,sample,false);const front={...dots[0]};modelRotation(Math.PI,0,stage.rotation);stage.drawModelFallback(layout,5600,sample,false);const back=dots[0];assert.ok(front.x>layout.cx&&back.x<layout.cx);assert.ok(Math.abs(back.x-layout.cx)>front.x-layout.cx);
});
