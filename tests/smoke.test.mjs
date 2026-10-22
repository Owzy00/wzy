import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareSmokeWaves,smokeDisplacement,jiaoFringePose} from '../dist/jiao-style.js';
import {StatueStage} from '../dist/particle-effects.js';
const pulse=(spread=.55)=>({x:.5,y:.5,time:0,strength:.9,spread});
test('smoke puffs retain five independent origins and vanish at the existing input lifetimes',()=>{
 const inputs=Array.from({length:5},(_,i)=>({...pulse(),x:.3+i*.08,finger:['thumb','index','middle','ring','pinky'][i]})),before=JSON.stringify(inputs);
 const waves=prepareSmokeWaves(inputs,600,1000,600);assert.equal(waves.length,5);assert.deepEqual(waves.map(w=>w.x),inputs.map(r=>r.x*1000));
 assert.equal(prepareSmokeWaves(inputs,0,1000,600).length,0);assert.equal(prepareSmokeWaves(inputs,1350,1000,600).length,0);
 assert.equal(prepareSmokeWaves([pulse(1)],2400,1000,600).length,1);assert.equal(prepareSmokeWaves([pulse(1)],2500,1000,600).length,0);
 assert.equal(JSON.stringify(inputs),before);
});
test('a finger puff curls tangentially, turns over time and stays local instead of translating the figure',()=>{
 const at=age=>smokeDisplacement(525,300,prepareSmokeWaves([pulse()],age*1000,1000,600),42);
 const a=at(.2),b=at(.5),c=at(.9),u={x:b.x-a.x,y:b.y-a.y},v={x:c.x-b.x,y:c.y-b.y};
 assert.ok(Math.abs(c.y)>3);assert.ok(Math.abs(u.x*v.y-u.y*v.x)/(Math.hypot(u.x,u.y)*Math.hypot(v.x,v.y))>.1);
 assert.ok(Math.hypot(c.x,c.y)>5&&Math.hypot(c.x,c.y)<20);
 const waves=prepareSmokeWaves([pulse()],700,1000,600),p=smokeDisplacement(525,300,waves,42),q=smokeDisplacement(525.5,300.5,waves,42);
 assert.ok(Math.hypot(p.x-q.x,p.y-q.y)<.6);
 assert.deepEqual(smokeDisplacement(800,500,waves,42),{x:0,y:0});
 assert.ok(Math.hypot(...Object.values(smokeDisplacement(525,300,Array(20).fill(waves[0]),42)))<=42.00001);
});
test('puff onset and disappearance are smooth, with no residual body offset',()=>{
 const d=age=>smokeDisplacement(525,300,prepareSmokeWaves([pulse()],age*1000,1000,600),42);
 assert.ok(Math.hypot(...Object.values(d(.001)))<1e-7);
 assert.ok(Math.hypot(...Object.values(d(1.34999)))<1e-6);assert.deepEqual(d(1.36),{x:0,y:0});
});
test('ambient contour smoke has both horizontal and vertical directions at one instant',()=>{
 const signs=new Set();for(let x=-.2;x<=.2;x+=.05)for(let y=-.45;y<=.4;y+=.08){
  const p=jiaoFringePose({x,y,z:0},{x:0,y:0,z:.5},5.6,{x:x>=0?.15:-.15,y:0});
  if(Math.hypot(p.x-x,p.y-y)>.01)signs.add(Math.sign(p.x-x)+','+Math.sign(p.y-y));
 }
 for(const sign of ['-1,-1','-1,1','1,-1','1,1'])assert.ok(signs.has(sign));
});
test('poster Canvas uses the same curved puff during gathering and holding',()=>{
 const stage=new StatueStage(),dots=[];stage.posterMode=true;stage.animationStarted=0;stage.origin={x:500,y:300};stage.body={};stage.fallbackPose={};stage.fallbackSurface={};stage.fallbackFlight={};stage.fallbackPalette=Array(12).fill('#bce2eb');
 stage.context={globalAlpha:1,clearRect(){},fillRect(x,y){dots.push({x,y});},drawImage(){}};
 stage.fallbackGroups=Array.from({length:12},(_,i)=>i===0?[{target:{x:.04,y:0,z:0},seed:{x:.2,y:.4,z:.6},loose:false,fringe:false,weather:true,emission:{x:0,y:0},opacity:1}]:[]);
 const layout=stage.layout(1000,600);
 for(const sample of [{formation:.65,release:0,presence:1,hold:false},{formation:1,release:0,presence:1,hold:true}]){
  stage.ripples=[];stage.drawFallback(layout,5500,sample,false);const home=dots.at(-1);
  stage.ripples=[{x:(home.x-20)/1000,y:home.y/600,time:4700,strength:.9,spread:.55,finger:'index'}];
  const expected=smokeDisplacement(home.x,home.y,prepareSmokeWaves(stage.ripples,5500,1000,600),42);
  stage.drawFallback(layout,5500,sample,false);const moved=dots.at(-1);
  assert.ok(Math.abs(moved.x-home.x-expected.x)<1e-8&&Math.abs(moved.y-home.y-expected.y)<1e-8);
  assert.ok(Math.hypot(expected.x,expected.y)>1);
 }
});

test('successive puffs at one fingertip evolve instead of replaying one fixed direction',()=>{
 const a=smokeDisplacement(525,300,prepareSmokeWaves([pulse()],800,1000,600),42);
 const b=smokeDisplacement(525,300,prepareSmokeWaves([{...pulse(),time:5000}],5800,1000,600),42);
 assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>1);
 const shifted=smokeDisplacement(525,300,prepareSmokeWaves([{...pulse(),time:5000}],5800,1000,600,5000),42);
 assert.ok(Math.hypot(a.x-shifted.x,a.y-shifted.y)<1e-10);
});
