import test from 'node:test';
import assert from 'node:assert/strict';
import {HandZoom} from '../dist/hand-zoom.js';
import {describeHand} from '../dist/gesture-core.js';

function zoomHand({gap=.8,pose='L',dx=0,dy=0,scale=1,thumbTip=null}={}){
 const p=Array.from({length:21},()=>({x:.5,y:.7,z:0}));p[0]={x:.5,y:.88,z:0};
 for(const [i,mcp]of [5,9,13,17].entries()){
  const x=.44+i*.05;p[mcp]={x,y:.68,z:0};p[mcp+1]={x,y:.57,z:0};p[mcp+2]={x,y:.47,z:0};p[mcp+3]={x,y:.36,z:0};
  if(pose!=='open'&&(mcp!==5||pose==='fist'))p[mcp+3]={x,y:.72,z:0};
 }
 p[1]={x:.43,y:.78,z:0};p[2]={x:.39,y:.67,z:0};p[3]={x:.36,y:.55,z:0};p[4]={x:.44-gap*.15,y:.36,z:0};
 if(thumbTip)p[4]={...thumbTip,z:0};
 if(pose==='fist')p[4]={x:.49,y:.71,z:0};
 if(pose==='point')p[4]={x:.43,y:.69,z:0};
 return p.map(q=>({x:.5+(q.x-.5)*scale+dx,y:.65+(q.y-.65)*scale+dy,z:q.z*scale}));
}
function zoomInput(controller,now,options={}){const points=zoomHand(options);return controller.feed(describeHand(points,.96,1),points,now,true);}
function zoomActivate(controller,gap=.8,start=0){for(const t of [0,60,120])zoomInput(controller,start+t,{gap});assert.equal(controller.active,true);return start+120;}

test('a stable L shape enters from either a wide or narrow opening without a zoom jump',()=>{
 for(const gap of [.3,.8,1.4,2.4]){const z=new HandZoom();let r=zoomInput(z,0,{gap});assert.equal(r.consumed,true);assert.equal(r.active,false);assert.equal(r.factor,1);r=zoomInput(z,60,{gap});assert.equal(r.active,false);r=zoomInput(z,120,{gap});assert.equal(r.active,true);assert.equal(r.factor,1);}
 const z=new HandZoom();assert.equal(zoomInput(z,0).active,false);assert.equal(zoomInput(z,79).active,false,'activation cannot precede 80ms');assert.equal(zoomInput(z,80).active,true);const two=new HandZoom();zoomInput(two,0);assert.equal(zoomInput(two,80).active,true,'two reliable observations can acquire zoom after 80ms');
});

test('natural L shapes with the thumb below the index enter at different hand proportions',()=>{
 for(const thumbTip of [{x:.30,y:.60},{x:.25,y:.65},{x:.18,y:.65}]){
  const z=new HandZoom();for(const t of [0,60,120])zoomInput(z,t,{thumbTip});assert.equal(z.active,true,JSON.stringify(thumbTip));
 }
});

test('ordinary open palms, pointing, fists and legacy samples without landmarks never enter',()=>{
 for(const pose of ['open','point','fist']){const z=new HandZoom();for(const t of [0,60,120,240,500]){const r=zoomInput(z,t,{pose});assert.equal(r.consumed,false,pose);assert.equal(r.active,false,pose);assert.equal(r.factor,1);}}
 const z=new HandZoom();for(const pose of ['open','point','fist'])assert.deepEqual(z.feed({pose,palm:{x:.5,y:.5},span:.15,confidence:.96},null,100+['open','point','fist'].indexOf(pose)),{consumed:false,active:false,factor:1});
});

test('opening the two fingers zooms in and closing them zooms out from a middle baseline',()=>{
 const a=new HandZoom(),b=new HandZoom();zoomActivate(a);zoomActivate(b);
 const open=zoomInput(a,180,{gap:1.2}),close=zoomInput(b,180,{gap:.4});assert.ok(open.factor<1);assert.ok(close.factor>1);assert.ok(Math.abs(open.factor*close.factor-1)<1e-10);
});

test('holding an L shape stays active without a repeated anchor or zoom drift',()=>{
 const z=new HandZoom();zoomActivate(z);for(let t=180;t<=3000;t+=60){const r=zoomInput(z,t);assert.equal(r.active,true);assert.equal(r.consumed,true);assert.equal(r.factor,1);}
 assert.ok(zoomInput(z,3060,{gap:1.1}).factor<1);
});

test('small fingertip jitter and moving the whole hand do not produce zoom',()=>{
 const z=new HandZoom();zoomActivate(z);for(let i=1;i<=30;i++){const r=zoomInput(z,120+i*40,{gap:.8+(i%2?.006:-.006),dx:i*.001,dy:i*.0005,scale:1+i*.002});assert.equal(r.factor,1);assert.equal(r.active,true);}
});

test('a full palm exits immediately and only the following sample is free to establish a drag',()=>{
 const z=new HandZoom();zoomActivate(z);assert.deepEqual(zoomInput(z,180,{pose:'open'}),{consumed:true,active:false,factor:1});assert.deepEqual(zoomInput(z,240,{pose:'open'}),{consumed:false,active:false,factor:1});
});

test('closing into a fist remains consumed until a full palm prevents accidental selection',()=>{
 const z=new HandZoom();zoomActivate(z);for(const t of [180,240,500,1000])assert.deepEqual(zoomInput(z,t,{pose:'fist'}),{consumed:true,active:false,factor:1});
 assert.equal(zoomInput(z,1060).consumed,true,'returning to an L alone cannot release the fist lock');assert.equal(zoomInput(z,1120,{pose:'open'}).consumed,true);assert.equal(zoomInput(z,1180,{pose:'open'}).consumed,false);
});

test('missing or low-confidence frames freeze zoom, preserve ownership and reanchor reacquisition',()=>{
 for(const invalid of ['missing','confidence','two-hands','bad-coordinates']){
  const z=new HandZoom();zoomActivate(z);let points=zoomHand(),sample=describeHand(points,.96,1);if(invalid==='missing'){sample=null;points=null;}if(invalid==='confidence')sample={...sample,confidence:.5};if(invalid==='two-hands')sample=null;if(invalid==='bad-coordinates')points[8].x=NaN;
  const r=z.feed(sample,points,160,true);assert.equal(r.consumed,true);assert.equal(r.factor,1);
  assert.deepEqual(zoomInput(z,220,{gap:1.2}),{consumed:true,active:true,factor:1});assert.ok(zoomInput(z,280,{gap:1.4}).factor<1);
 }
});

test('long tracking loss and a fist after a missing frame stay consumed until reopening',()=>{
 const z=new HandZoom();zoomActivate(z);assert.equal(z.feed(null,null,160,true).consumed,true);assert.deepEqual(zoomInput(z,220,{pose:'fist'}),{consumed:true,active:false,factor:1});
 const a=new HandZoom();zoomActivate(a);assert.equal(a.feed(null,null,500,true).active,false);assert.deepEqual(zoomInput(a,560),{consumed:true,active:false,factor:1});assert.equal(zoomInput(a,620,{pose:'open'}).active,false);assert.equal(zoomInput(a,680,{pose:'open'}).consumed,false);
});

test('duplicate timestamps, abrupt hand relocation and disabled input cannot jump zoom',()=>{
 const z=new HandZoom();zoomActivate(z);assert.equal(zoomInput(z,120,{gap:1.4}).factor,1);assert.equal(zoomInput(z,100,{gap:.3}).factor,1);assert.equal(zoomInput(z,180,{gap:1.2,dx:.2}).factor,1);assert.ok(zoomInput(z,240,{gap:1.4,dx:.2}).factor<1);
 assert.deepEqual(z.feed(null,null,300,false),{consumed:false,active:false,factor:1});assert.equal(zoomInput(z,360).active,false);z.reset();assert.equal(zoomInput(z,0).active,false);
});

test('a large isolated fingertip detection jump only reanchors and leaves no zoom backlog',()=>{
 const z=new HandZoom();zoomActivate(z,.3);assert.deepEqual(zoomInput(z,180,{gap:2.5}),{consumed:true,active:true,factor:1});
 for(const t of [240,300,360])assert.equal(zoomInput(z,t,{gap:2.5}).factor,1);
 assert.ok(zoomInput(z,420,{gap:2.3}).factor>1,'a subsequent measured closing still zooms out');
});

test('a briefly uncertain third finger keeps the measured thumb/index aperture active',()=>{
 const z=new HandZoom();zoomActivate(z);const points=zoomHand();points[12]={x:.49,y:.54,z:0};const sample=describeHand(points,.96,1);assert.equal(z.feed(sample,points,180,true).factor,1);const next=zoomInput(z,240,{gap:1.2});assert.equal(next.consumed,true);assert.equal(next.active,true);assert.ok(next.factor<1);
});

test('bringing thumb and index together can still reduce scale while the index bends',()=>{
 const z=new HandZoom();zoomActivate(z);const points=zoomHand();points[8]={x:.35,y:.60,z:0};points[4]={x:.34,y:.60,z:0};const sample=describeHand(points,.96,1);assert.equal(sample.pose,'fist','the old coarse pose classifier sees a fist during this pinch');const r=z.feed(sample,points,180,true);assert.equal(r.active,true);assert.equal(r.consumed,true);assert.ok(r.factor>1,'the measured closing still shrinks the map');
});
