import test from 'node:test';
import assert from 'node:assert/strict';
import {brightStarOrigins} from '../dist/astronomy.js';
import {starFlight,statueSurface} from '../dist/cloud-field.js';
import {StatueStage} from '../dist/particle-effects.js';

test('emission uses the five brightest visible mansion members without mutating their coordinates',()=>{
 const members=Object.freeze([5,1,4,2,6,3,0].map((mag,i)=>Object.freeze({id:i,mag,ra:i,dec:i/10}))),before=JSON.stringify(members);
 const project=ra=>ra===6?null:{x:100+ra*50,y:200};
 const sources=brightStarOrigins(members,project,1000,600,null);
 assert.deepEqual(sources.map(p=>p.mag),[1,2,3,4,5]);assert.deepEqual(sources[0],{id:1,mag:1,x:.15,y:1/3});assert.equal(JSON.stringify(members),before);
 assert.deepEqual(brightStarOrigins(members,()=>null,1000,600,{x:2000,y:-30}),[{x:1,y:0}]);
 assert.deepEqual(brightStarOrigins(members,()=>null,1000,600,null),[]);
});
test('flights begin invisibly at their source and join the moving cloud without a position snap',()=>{
 const source=Object.freeze({x:320,y:200}),destination=Object.freeze({x:760,y:480}),before=JSON.stringify([source,destination]);
 for(let i=0;i<120;i++){
  const seed={x:i*.6180339%1,y:i*.7548776%1,z:i/120};
  const start=starFlight(seed,0,source,destination,600),end=starFlight(seed,2.5,source,destination,600),late=starFlight(seed,2.499,source,destination,600);
  assert.deepEqual(start,{...source,visibility:0});assert.deepEqual(end,{...destination,visibility:1});assert.ok(Math.hypot(late.x-end.x,late.y-end.y)<.002);
  const moving=starFlight(seed,3,source,{x:770,y:490},600);assert.equal(moving.x,770);assert.equal(moving.y,490);
  for(const t of [.3,.8,1.3,1.9]){const p=starFlight(seed,t,source,destination,600);assert.ok(Object.values(p).every(Number.isFinite));assert.ok(p.visibility>=0&&p.visibility<=1);}
 }
 assert.equal(JSON.stringify([source,destination]),before);
});
test('breathing and depth parallax stay small, reverse naturally and never accumulate into targets',()=>{
 const target=Object.freeze({x:.2,y:-.4,z:.12}),before=JSON.stringify(target);
 const a=statueSurface(target,2,{x:1,y:1}),b=statueSurface(target,2,{x:-1,y:-1});assert.ok(a.x>b.x);assert.ok(a.y>b.y);
 for(let t=0;t<200;t++){const p=statueSurface(target,t,{x:Math.sin(t),y:Math.cos(t)});assert.ok(Math.hypot(p.x-target.x,p.y-target.y)<.014);}
 assert.deepEqual(statueSurface(target,10,{x:1,y:1},0),target);assert.equal(JSON.stringify(target),before);
});
test('the stage snapshots source positions rather than retaining live projected objects',()=>{
 const stage=new StatueStage();stage.initRenderer=()=>{stage.canvas={style:{},setAttribute(){}};stage.attributes={aTarget:0,aColor:1,aSeed:2,aFlow:3,aNormal:4};stage.gl=new Proxy({bindBuffer(){},bufferData(){}},{get:(target,key)=>target[key]||(()=>{})});};stage.prepare=()=>({points:[],packed:{count:0,stride:10,data:new Float32Array()}});
 const source=[{x:.2,y:.3}];assert.equal(stage.start({id:3},0,source),true);source[0].x=.9;assert.deepEqual(stage.sources,[{x:.2,y:.3}]);
});
test('Canvas generation receives ripple displacement before the statue has settled',()=>{
 const stage=new StatueStage(),dots=[];stage.context={clearRect(){},fillRect(x,y){dots.push({x,y});},drawImage(){}};stage.animationStarted=0;stage.origin={x:500,y:300};stage.body={};stage.fallbackPose={};stage.fallbackSurface={};stage.fallbackFlight={};stage.fallbackDisplacement={};stage.fallbackPalette=Array(12).fill('#d5b784');
 stage.fallbackGroups=Array.from({length:12},(_,i)=>i===0?[{target:{x:.1,y:0,z:0},seed:{x:.6,y:.5,z:.5},loose:false}]:[]);
 const sample={formation:.65,release:0,presence:1,hold:false},layout=stage.layout(1000,600);stage.drawFallback(layout,2800,sample,false);const home=dots.at(-1);
 stage.ripples=[{x:(home.x-86.4)/1000,y:home.y/600,time:2400,strength:1.2}];stage.drawFallback(layout,2800,sample,false);assert.ok(dots.at(-1).x>home.x+8);assert.ok(Math.abs(dots.at(-1).y-home.y)<.001);
});
