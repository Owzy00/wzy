import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Run the shipped event handlers, with controllable native pointer/capture events.
// This catches gesture transitions without requiring a camera or GPU in Node.
function eventTarget(){
 const listeners=new Map();
 return {addEventListener(type,callback){const callbacks=listeners.get(type)||[];callbacks.push(callback);listeners.set(type,callbacks);},emit(type,event={}){for(const callback of listeners.get(type)||[])callback(event);}};
}
function section(file,start,end){
 const source=fs.readFileSync(new URL(file,import.meta.url),'utf8'),from=source.indexOf(start),to=source.indexOf(end,from);
 assert.ok(from>=0&&to>from,'the shipped pointer event section is present');return source.slice(from,to);
}
const mapHandlers=section('../dist/app.js','let pointerGestureHadMultiple=false;',"canvas.addEventListener('wheel'");
const particleHandlers=section('../dist/experience.js',' const pointerSamples=new Map()',' // Camera and gesture lifecycle.');
const touch=(pointerId,x,y=200,target='sky')=>({pointerId,pointerType:'touch',clientX:x,clientY:y,target:{id:target}});

function mapScene(){
 const canvas=eventTarget(),window=eventTarget(),document=eventTarget(),captures=new Set(),classes=new Set(),selections=[],zooms=[];
 Object.assign(canvas,{style:{},focus(){},setPointerCapture:id=>captures.add(id),hasPointerCapture:id=>captures.has(id),releasePointerCapture(id){captures.delete(id);canvas.emit('lostpointercapture',{pointerId:id});},classList:{add:name=>classes.add(name),remove:name=>classes.delete(name)}});
 const experience={busy:false,pointerDown(){return this.busy;},pointerMove(){return this.busy;},pointerUp(){return this.busy;},pointerCancel(){}};
 const camera={ra:0,dec:0,fov:1,zoom:1},target={ra:0,dec:0},pointers=new Map();
 const context=vm.createContext({canvas,window,document,camera,target,pointers,experience,Math,Map,drag:null,lastPinch:null,hover:-1,viewport:{w:390,h:500},mode:'sphere',RAD:Math.PI/180,TAU:Math.PI*2,clamp:(x,a,b)=>Math.max(a,Math.min(b,x)),wrap:x=>x,hitTest:()=>7,select:id=>selections.push(id),zoom:factor=>zooms.push(factor)});
 vm.runInContext(mapHandlers,context);
 return {canvas,window,document,camera,pointers,captures,classes,selections,zooms,experience,read:expression=>vm.runInContext(expression,context),emit:(type,id,x,y)=>canvas.emit(type,touch(id,x,y))};
}
function particleScene(){
 const document=eventTarget(),window=eventTarget(),interactions=[],stirs=[],ripples=[];let now=100;
 const stage={busy:true,interact:(...args)=>interactions.push(args)},adapter={blocked:()=>false,reducedMotion:false},wind={stir:(...args)=>stirs.push(args),ripple:(...args)=>ripples.push(args)};
 const context=vm.createContext({document,window,stage,adapter,wind,Math,Map,innerWidth:390,innerHeight:844,performance:{now:()=>now}});
 vm.runInContext(particleHandlers,context);
 return {document,window,stage,interactions,stirs,ripples,advance:ms=>now+=ms,emit:(type,id,x,y=200,target='sky')=>document.emit(type,touch(id,x,y,target))};
}

test('single-finger dragging still pans, while a tap tolerates small touch jitter',()=>{
 const s=mapScene();s.emit('pointerdown',1,100);s.emit('pointermove',1,108);s.emit('pointerup',1,108);assert.deepEqual(s.selections,[7]);
 s.emit('pointerdown',1,100);s.emit('pointermove',1,130);s.emit('pointerup',1,130);assert.ok(s.camera.ra>0);assert.deepEqual(s.selections,[7]);assert.equal(s.pointers.size,0);
});

test('a two-finger gesture cannot select a star, even without a move event',()=>{
 const s=mapScene();s.emit('pointerdown',1,100);s.emit('pointerdown',2,200);s.emit('pointerup',2,200);s.emit('pointerup',1,100);assert.deepEqual(s.selections,[]);
 s.emit('pointerdown',1,100);s.emit('pointermove',1,130);s.emit('pointerdown',2,200);s.emit('pointerup',2,200);s.emit('pointerup',1,130);assert.deepEqual(s.selections,[]);
});

test('pinch responds to its first move, ignores a third finger, and reanchors a new pair',()=>{
 const s=mapScene();s.emit('pointerdown',1,100);s.emit('pointerdown',2,200);s.emit('pointermove',2,240);assert.equal(s.zooms.length,1);assert.ok(Math.abs(s.zooms[0]-100/140)<1e-10);
 s.emit('pointermove',2,280);assert.ok(Math.abs(s.zooms.reduce((a,b)=>a*b,1)-100/180)<1e-10);
 s.emit('pointerdown',3,330);const ra=s.camera.ra,count=s.zooms.length;s.emit('pointermove',3,350);assert.equal(s.camera.ra,ra);assert.equal(s.zooms.length,count);
 s.emit('pointerup',1,100);s.emit('pointermove',3,370);assert.ok(Math.abs(s.zooms.at(-1)-70/90)<1e-10);
 s.emit('pointerup',3,370);s.emit('pointermove',2,290);assert.ok(s.camera.ra>ra);s.emit('pointerup',2,290);assert.deepEqual(s.selections,[]);
});

test('cancel, lost capture, blur, page hide and hidden documents release the whole gesture',()=>{
 for(const cancel of [s=>s.emit('pointercancel',1,100),s=>s.canvas.emit('lostpointercapture',{pointerId:1}),s=>s.window.emit('blur'),s=>s.window.emit('pagehide'),s=>{s.document.hidden=true;s.document.emit('visibilitychange');}]){
  const s=mapScene();s.emit('pointerdown',1,100);s.emit('pointerdown',2,200);cancel(s);
  assert.equal(s.pointers.size,0);assert.equal(s.captures.size,0);assert.equal(s.read('drag'),null);assert.equal(s.read('lastPinch'),null);assert.equal(s.classes.has('dragging'),false);
  s.emit('pointerup',2,200);assert.deepEqual(s.selections,[]);s.emit('pointerdown',3,100);s.emit('pointerup',3,100);assert.deepEqual(s.selections,[7]);
 }
});

test('the normal capture release after one finger lifts preserves the remaining drag',()=>{
 const s=mapScene();s.emit('pointerdown',1,100);s.emit('pointerdown',2,200);s.emit('pointerup',2,200);s.canvas.releasePointerCapture(2);assert.equal(s.pointers.size,1);s.emit('pointermove',1,120);assert.ok(s.camera.ra>0);s.emit('pointerup',1,120);assert.deepEqual(s.selections,[]);
});

test('a morph taking ownership mid-drag cannot leave the sky permanently blocked',()=>{
 const s=mapScene();s.emit('pointerdown',1,100);s.experience.busy=true;s.emit('pointermove',1,120);assert.equal(s.pointers.size,0);s.emit('pointerup',1,120);assert.deepEqual(s.selections,[]);
});

test('two slowly moving touches use their own velocity, while a real swipe still emits a wave',()=>{
 const s=particleScene();s.emit('pointerdown',1,100);s.emit('pointerdown',2,300);s.advance(16);s.emit('pointermove',1,101);s.advance(16);s.emit('pointermove',2,299);
 assert.ok(s.interactions.slice(-2).every(args=>args[3]>0&&args[3]<.18));s.advance(16);s.emit('pointermove',1,140);assert.ok(s.interactions.at(-1)[3]>.18);
});

test('camera and other interface touches do not move or ripple the statue',()=>{
 const s=particleScene();for(const id of ['gesture-panel','camera-start','stage-return']){s.emit('pointerdown',1,100,200,id);s.emit('pointermove',1,200,200,id);}assert.equal(s.interactions.length,0);
 s.emit('pointerdown',2,100);const count=s.interactions.length;s.advance(16);s.emit('pointermove',2,200,200,'gesture-panel');assert.equal(s.interactions.length,count);
});

test('lifting or cancelling a touch removes its speed history and ignores orphan moves',()=>{
 for(const type of ['pointerup','pointercancel','lostpointercapture']){
  const s=particleScene();s.emit('pointerdown',1,50);s.emit(type,1,50);const count=s.interactions.length;s.advance(16);s.emit('pointermove',1,300);assert.equal(s.interactions.length,count);
  s.emit('pointerdown',1,300);s.advance(16);s.emit('pointermove',1,301);assert.ok(s.interactions.at(-1)[3]<.18);
 }
});

test('backgrounding clears touch samples, and desktop hover and sky wind remain available',()=>{
 for(const hide of [s=>s.window.emit('blur'),s=>s.window.emit('pagehide'),s=>{s.document.hidden=true;s.document.emit('visibilitychange');}]){
  const s=particleScene();s.emit('pointerdown',1,50);hide(s);const count=s.interactions.length;s.emit('pointermove',1,300);assert.equal(s.interactions.length,count);
 }
 const s=particleScene(),mouse=x=>({pointerId:9,pointerType:'mouse',clientX:x,clientY:200,target:{id:'sky'}});
 s.document.emit('pointermove',mouse(50));s.advance(16);s.document.emit('pointermove',mouse(100));assert.ok(s.interactions.at(-1)[3]>.18);
 s.stage.busy=false;s.advance(16);s.document.emit('pointermove',mouse(150));assert.equal(s.stirs.length,1);s.document.emit('pointerdown',mouse(150));assert.equal(s.ripples.length,1);
});
