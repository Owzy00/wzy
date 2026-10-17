import {projectSphere} from './astronomy.js?v=11';
const clamp01=n=>Math.max(0,Math.min(1,n));
const smooth=t=>{t=clamp01(t);return t*t*(3-2*t);};
const silk=t=>{t=clamp01(t);return t*t*t*(t*(t*6-15)+10);};
// The decorative band uses its own frozen camera, independent of sky navigation and wind.
export class FixedStarBand{
 constructor(referenceCamera){this.reference=Object.freeze({...referenceCamera});}
 project(particle,viewport){const ra=particle.t,dec=Math.sin(particle.t-2.6)*.67+particle.width*.23+Math.sin(particle.t*5+particle.phase)*.018;return projectSphere(ra,dec,this.reference,viewport);}
}
export function statueTransform(pointer,width,height){
 const x=Math.max(-1,Math.min(1,pointer.x)),y=Math.max(-1,Math.min(1,pointer.y));
 return {x:x*Math.min(width*.065,105),y:y*Math.min(height*.02,18),yaw:x*.018};
}
export function decodeCloud(item){
 const binary=atob(item.data),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);if(bytes.length!==item.count*9)throw new Error('点云字节数不匹配');
 const v=new DataView(bytes.buffer),points=[];for(let i=0;i<item.count;i++){const o=i*9;points.push({x:v.getInt16(o,true)/1000,y:v.getInt16(o+2,true)/1000,z:v.getInt16(o+4,true)/1000,r:v.getUint8(o+6),g:v.getUint8(o+7),b:v.getUint8(o+8)});}return points;
}
export class WindField{
 constructor(){this.gusts=[];this.active=[];this.ripples=[];this.waves=[];this.lastStir=-Infinity;}
 stir(event,now){if(now-this.lastStir<90)return;this.lastStir=now;this.push(event,now);}
 ripple({x,y,strength=1},now){this.ripples.push({x,y,strength:Math.min(1.5,strength),time:now});this.ripples=this.ripples.slice(-3);}
 push({x,y,dx,dy},now){this.gusts.push({x,y,dx:Math.max(-1.8,Math.min(1.8,dx)),dy:Math.max(-1.8,Math.min(1.8,dy)),time:now});this.gusts=this.gusts.slice(-4);}
 prepare(now){this.gusts=this.gusts.filter(g=>now-g.time<3200);this.active=this.gusts.map(g=>{const t=(now-g.time)/1000;return {...g,strength:(1-Math.exp(-t*9))*Math.exp(-t*1.5)*180};});this.ripples=this.ripples.filter(r=>now-r.time<2400);this.waves=this.ripples.map(r=>({...r,age:(now-r.time)/1000}));}
 offset(x,y,width,height){let dx=0,dy=0;const dim=Math.min(width,height),radius=dim*.38;for(const g of this.active){const d2=(x-g.x*width)**2+(y-g.y*height)**2;const a=Math.exp(-d2/(radius*radius))*g.strength;dx+=g.dx*a;dy+=g.dy*a;}for(const r of this.waves){const x0=x-r.x*width,y0=y-r.y*height,d=Math.hypot(x0,y0),delta=d-r.age*dim*.33,force=Math.exp(-delta*delta/(dim*.035)**2)*Math.exp(-r.age*1.7)*r.strength*23;dx+=x0/Math.max(1,d)*force;dy+=y0/Math.max(1,d)*force;}return [dx,dy];}
 draw(context,width,height){
  const dim=Math.min(width,height);context.save();context.globalCompositeOperation='lighter';
  // Free motes carry input feedback; the fixed star band is never displaced.
  for(const g of this.active){const x=g.x*width,y=g.y*height,reach=g.strength*.22;context.fillStyle='#e8ce8e';context.globalAlpha=Math.min(.35,g.strength/700);for(let i=0;i<20;i++){const seed=i*.61803398875%1,angle=i*2.39996;context.fillRect(x+g.dx*reach*seed+Math.cos(angle)*reach*.25,y+g.dy*reach*seed+Math.sin(angle)*reach*.25,.8+seed,.8+seed);}}
  context.globalAlpha=1;
  for(const r of this.waves){const radius=r.age*dim*.33,alpha=Math.sin(Math.min(1,r.age/.25)*Math.PI/2)*Math.exp(-r.age*1.9)*.24*r.strength;if(radius<1)continue;context.strokeStyle=`rgba(236,207,134,${alpha})`;context.lineWidth=.55;context.beginPath();context.arc(r.x*width,r.y*height,radius,0,Math.PI*2);context.stroke();for(let i=0;i<12;i++){const angle=i*2.39996+r.time*.001,x=r.x*width+Math.cos(angle)*radius,y=r.y*height+Math.sin(angle)*radius;context.fillStyle=`rgba(255,231,166,${alpha*.8})`;context.fillRect(x,y,1.2,1.2);}}
  context.restore();
 }
}
export class MorphTimeline{
 constructor(){this.state='IDLE';this.started=0;this.returned=0;this.cooldownUntil=0;this.duration={gather:2800,hold:4200,return:2400};}
 get busy(){return ['GATHERING','HOLDING','RETURNING'].includes(this.state);}
 start(now){if(this.busy||now<this.cooldownUntil)return false;this.started=now;this.state='GATHERING';this.earlyReturn=null;this.pendingDone=false;return true;}
 finish(now){if(!this.busy||this.state==='RETURNING')return;const current=this.sample(now);if(current.done){this.pendingDone=true;return;}this.returnFrom=current.amount;this.earlyReturn=now;this.state='RETURNING';}
 sample(now){
  if(this.pendingDone){this.pendingDone=false;return {state:this.state,amount:0,formation:1,release:1,hold:false,done:true};}
  if(!this.busy)return {state:this.state,amount:0,formation:0,release:0,hold:false,done:false};
  const t=now-this.started,d=this.duration;
  if(this.earlyReturn!==null){const release=silk((now-this.earlyReturn)/d.return);if(release>=1){this.state='COOLDOWN';this.cooldownUntil=now+1200;return {state:this.state,amount:0,formation:this.returnFrom,release:1,done:true};}return {state:'RETURNING',amount:(1-release)*this.returnFrom,formation:this.returnFrom,release,hold:false,done:false};}
  if(t<d.gather){this.state='GATHERING';const amount=silk(t/d.gather);return {state:this.state,amount,formation:amount,release:0,hold:false,done:false};}
  if(t<d.gather+d.hold){this.state='HOLDING';return {state:this.state,amount:1,formation:1,release:0,hold:true,done:false};}
  if(t<d.gather+d.hold+d.return){this.state='RETURNING';const release=silk((t-d.gather-d.hold)/d.return);return {state:this.state,amount:1-release,formation:1,release,hold:false,done:false};}
  this.state='COOLDOWN';this.cooldownUntil=now+1200;return {state:this.state,amount:0,formation:1,release:1,hold:false,done:true};
 }
}
// Static interleaved GPU data. No star catalogue object is passed into this renderer.
const particleTemplates=new Map();
export function createParticleBuffer(points,flowCount=96000){
 const count=points.length+flowCount;
 let template=particleTemplates.get(flowCount);
 if(!template||template.length<count*10){
  // Reuse all random attributes and the 96k flow particles across mansion changes.
  template=new Float32Array(Math.max(count,flowCount+48000)*10);
  const rand=i=>{const x=Math.sin(i*127.13+3.1)*43758.5453;return x-Math.floor(x);};
  for(let i=0;i<template.length/10;i++){const o=i*10;if(i<flowCount){template[o+3]=.93;template[o+4]=.68+rand(i+90)*.18;template[o+5]=.34+rand(i+190)*.20;template[o+9]=1;}template[o+6]=rand(i+1);template[o+7]=rand(i+100001);template[o+8]=rand(i+200001);}
  particleTemplates.set(flowCount,template);if(particleTemplates.size>2)particleTemplates.delete(particleTemplates.keys().next().value);
 }
 const data=template.slice(0,count*10);
 for(let i=0;i<points.length;i++){const p=points[i],o=(i+flowCount)*10;data[o]=p.x;data[o+1]=p.y;data[o+2]=p.z;const lift=Math.max(p.r,p.g,p.b)<75?1.8:1.25;data[o+3]=Math.min(1,p.r*lift/255*.8+.2);data[o+4]=Math.min(1,p.g*lift/255*.8+.15);data[o+5]=Math.min(1,p.b*lift/255*.8+.07);}
 return {data,count:points.length+flowCount,flowCount};
}
const FLOW_VERTEX=`
precision highp float;
attribute vec3 aTarget;attribute vec3 aColor;attribute vec3 aSeed;attribute float aFlow;
uniform vec2 uViewport,uOrigin;uniform vec3 uLayout,uModel;uniform float uTime,uAmount,uFormation,uRelease,uDpr,uReduced;
uniform vec4 uRipple0,uRipple1,uRipple2;
varying vec3 vColor;varying float vAlpha;
vec2 wake(vec2 p,vec4 ripple){
 if(ripple.w<.001)return vec2(0.);
 float dim=min(uViewport.x,uViewport.y),radius=ripple.z*dim*.36;
 vec2 d=p-ripple.xy*uViewport;float dist=length(d),edge=(dist-radius)/(dim*.035);
 float strength=exp(-edge*edge)*exp(-ripple.z*1.7)*ripple.w;
 return d/max(1.,dist)*strength*dim*.045;
}
void main(){
 float motion=1.-uReduced,t=uTime*motion,depth=.45+aSeed.z*.9;
 vec2 pos;float size,glint=.88+.12*sin(t*1.5+aSeed.x*15.);
 if(aFlow>.5){
  float x=fract(aSeed.x+t*(.017+aSeed.z*.014))*1.6-.3,y=aSeed.y;
  if(aSeed.z<.64){
   float band=floor(aSeed.y*11.),thread=fract(aSeed.y*11.)-.5;
   y=.04+band*.088+sin(x*5.8+band*1.37-t*.28)*.07+sin(x*10.9-band+t*.19)*.025;
   y+=thread*(.009+.027*pow(.5+.5*sin(x*5.+band-t*.2),2.));
  }else{y+=sin(x*6.3+aSeed.z*8.+t*.18)*.035;}
  pos=vec2(x*uViewport.x,y*uViewport.y);
  float centerFade=smoothstep(.28,.46,x)*(1.-smoothstep(.63,.82,x));
  float flowLight=aSeed.z<.64?.58:.22;
  vAlpha=flowLight*(1.-centerFade*.88)*(.7+aSeed.z*.35)*smoothstep(0.,.28,uAmount);
  size=(aSeed.z>.993?6.2:1.9+aSeed.z*.9)*uDpr*depth;
 }else{
  float settle=smoothstep(aSeed.z*.22,.76+aSeed.z*.22,uFormation);
  vec3 body=aTarget;float yaw=uModel.z*motion;
  float bodyX=body.x*cos(yaw)+body.z*sin(yaw),bodyZ=body.z*cos(yaw)-body.x*sin(yaw);
  float breath=sin(t*1.42)*.006*motion;
  vec2 shape=vec2(bodyX,body.y)*(1.+breath);
  // A single bounded transform moves the entire statue; no per-point input distortion.
  vec2 target=uLayout.xy+uModel.xy+shape*uLayout.z;
  // Broad independent source positions prevent rings or dense starting clumps.
  vec2 source=vec2(aSeed.x*uViewport.x,aSeed.y*uViewport.y);
  vec2 bend=mix(source,uOrigin,.19);bend+=vec2((aSeed.y-.5)*uViewport.x*.18,-uViewport.y*(.10+aSeed.z*.18));
  float inv=1.-settle;
  pos=inv*inv*source+2.*inv*settle*bend+settle*settle*target;
  pos+=vec2(sin(settle*8.+aSeed.x*6.),cos(settle*6.+aSeed.y*7.))*sin(settle*3.14159)*uLayout.z*.035*motion;
  // Returning stars travel out through a different, gently curling path.
  vec2 destination=vec2(fract(aSeed.x+.23)*uViewport.x,fract(aSeed.y+.37)*uViewport.y);
  vec2 escape=vec2(sin(aSeed.y*6.28),-1.)*uLayout.z*.12*sin(uRelease*3.14159)*motion;
  pos=mix(pos,destination,uRelease)+escape;
  vAlpha=mix(.11,.94,smoothstep(.12,.88,settle))*smoothstep(0.,.16,uFormation)*(1.-smoothstep(.18,1.,uRelease))*glint;
  size=mix(.95,2.6+aSeed.z*.65,settle)*uDpr;
  if(aSeed.x>.991){size*=1.9;vAlpha*=.78+.22*sin(t*2.+aSeed.y*30.);}
 }
 // Ripples affect free motes only, never the statue or the background ribbons.
 if(aFlow>.5&&aSeed.z>=.64)pos+=(wake(pos,uRipple0)+wake(pos,uRipple1)+wake(pos,uRipple2))*motion;
 vColor=mix(vec3(.94,.77,.46),aColor,aFlow>.5?1.:smoothstep(.18,.9,uFormation))*glint;
 gl_Position=vec4(pos.x/uViewport.x*2.-1.,1.-pos.y/uViewport.y*2.,0.,1.);
 gl_PointSize=max(1.,size);
}`;
const FLOW_FRAGMENT=`
precision mediump float;varying vec3 vColor;varying float vAlpha;
void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;float core=exp(-r*r*6.5),halo=exp(-r*r*2.8)*.20;gl_FragColor=vec4(vColor*(1.+core*.26),vAlpha*(core+halo));}
`;
export class StatueStage{
 constructor(){this.timeline=new MorphTimeline();this.pointer={x:0,y:0};this.pointerTarget={x:0,y:0};this.ripples=[];this.lastRipple=-Infinity;this.quality=1;this.frameMs=0;this.lastDraw=0;this.renderer='uninitialized';this.intervals=[];this.cadence={};this.opacity=0;this.prepared=new Map();}
 get busy(){return this.timeline.busy;}
 // Reuse the last sky frame as a dimmed backdrop; transparent particles keep moving above it.
 get occludesSky(){return this.busy&&this.opacity>.01;}
 layout(width,height){const mobile=width<850;return {cx:width*(mobile?.44:.51),cy:height*.52,size:Math.max(100,Math.min(height-(mobile?175:140),width*(mobile?1.05:.72))),width,height};}
 initRenderer(){
  if(this.canvas)return;
  this.canvas=document.createElement('canvas');this.canvas.id='statue-particles';this.canvas.setAttribute('aria-hidden','true');this.canvas.hidden=true;document.body.append(this.canvas);
  if(new URLSearchParams(location.search).has('canvas-fallback'))return this.initFallback();
  try{
   const gl=this.canvas.getContext('webgl',{alpha:true,antialias:false,depth:false,stencil:false,premultipliedAlpha:true,preserveDrawingBuffer:false,powerPreference:'high-performance'});if(!gl)throw new Error('WebGL unavailable');
   this.gl=gl;
   const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;};
   const vs=shader(gl.VERTEX_SHADER,FLOW_VERTEX),fs=shader(gl.FRAGMENT_SHADER,FLOW_FRAGMENT),program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));gl.deleteShader(vs);gl.deleteShader(fs);
   this.program=program;this.buffer=gl.createBuffer();this.uniforms={};for(const n of ['uViewport','uModel','uOrigin','uLayout','uTime','uAmount','uFormation','uRelease','uDpr','uReduced','uRipple0','uRipple1','uRipple2'])this.uniforms[n]=gl.getUniformLocation(program,n);
   gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
   for(const [name,size,offset]of [['aTarget',3,0],['aColor',3,12],['aSeed',3,24],['aFlow',1,36]]){const loc=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,40,offset);}
   gl.disable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.clearColor(0,0,0,0);this.renderer='webgl';
   this.canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.error='WebGL context lost; Canvas fallback';this.initFallback();if(this.points)this.prepareFallback();});
  }catch(error){this.error=error.message;this.initFallback();}
 }
 initFallback(){
  // A canvas with an established WebGL context cannot acquire a 2D context.
  const replacement=document.createElement('canvas');replacement.id='statue-particles';replacement.setAttribute('aria-hidden','true');this.canvas.replaceWith(replacement);this.canvas=replacement;this.gl=null;this.context=replacement.getContext('2d');this.renderer='canvas2d';
 }
 prepare(item){
  if(this.prepared.has(item.id))return this.prepared.get(item.id);
  const points=decodeCloud(item),packed=createParticleBuffer(points);
  const entry={points,packed};this.prepared.set(item.id,entry);
  if(this.prepared.size>2)this.prepared.delete(this.prepared.keys().next().value);
  return entry;
 }
 start(item,now){
  if(this.busy||now<this.timeline.cooldownUntil)return false;
  this.initRenderer();this.item=item;const prepared=this.prepare(item);this.points=prepared.points;this.origin=null;this.intervals=[];this.cadence={};this.ripples=[];this.pointer={x:0,y:0};this.pointerTarget={x:0,y:0};this.fallbackKey='';
  const packed=prepared.packed;this.particleCount=packed.count;
  if(this.gl){this.gl.bindBuffer(this.gl.ARRAY_BUFFER,this.buffer);this.gl.bufferData(this.gl.ARRAY_BUFFER,packed.data,this.gl.STATIC_DRAW);}else this.prepareFallback();
  // Decode/upload before starting the clock so the first frame never skips ahead.
  this.timeline.start(performance.now());this.lastDraw=this.timeline.started;this.animationStarted=this.timeline.started;this.frames=0;this.canvas.hidden=false;this.canvas.setAttribute('data-renderer',this.renderer);return true;
 }
 finish(now){this.timeline.finish(now);}
 interact(x,y,now){
  this.pointerTarget={x:(clamp01(x)-.5)*2,y:(clamp01(y)-.5)*2};
 }
 ripple(x,y,now,strength=1){
  if(strength>.18&&now-this.lastRipple>260){this.lastRipple=now;this.ripples.push({x:clamp01(x),y:clamp01(y),time:now,strength:Math.min(1.4,strength)});this.ripples=this.ripples.slice(-3);}
 }
 prepareFallback(){
  this.body=document.createElement('canvas');this.body.width=700;this.body.height=700;const c=this.body.getContext('2d');
  for(const p of this.points){c.fillStyle=`rgb(${Math.min(255,p.r*1.3+24)},${Math.min(255,p.g*1.3+16)},${Math.min(255,p.b*1.3+7)})`;c.globalAlpha=.88;c.fillRect((p.x+.5)*700,(p.y+.5)*700,1.1,1.1);}
  this.flow=document.createElement('canvas');this.flow.width=1500;this.flow.height=700;const f=this.flow.getContext('2d');
  // Bake fine grain once. Each fallback frame composites one field and one statue.
  for(let i=0;i<26000;i++){const x=(i*.61803398875)%1,seed=(i*.754877666)%1,band=i%6,y=.49+(band-2.5)*.118+Math.sin(x*6.4+band*1.7)*.088+Math.sin(x*13.7-band*2.1)*.032+(seed-.5)*.027;f.fillStyle=i%3?'#d8b780':'#f1d7a5';f.globalAlpha=.25+seed*.4;f.fillRect(x*1500,y*700,.8,.8);}
 }
 drawFallback(l,now,sample,reduced){
  const c=this.context;c.clearRect(0,0,l.width,l.height);const t=reduced?0:(now-this.animationStarted)*.0003;
  c.globalAlpha=smooth(sample.amount/.4)*.24;c.drawImage(this.flow,-l.width*.05+Math.sin(t*.5)*l.width*.025,Math.sin(t*.7)*l.height*.01,l.width*1.1,l.height);
  const settle=smooth(sample.formation),scale=1+(reduced?0:Math.sin(t*4.73)*.006)+(1-settle)*.12+sample.release*.12,size=l.size*scale,left=l.cx-size/2,top=l.cy-size/2-sample.release*l.height*.08,model=statueTransform(this.pointer,l.width,l.height);
  c.save();c.globalAlpha=settle*(1-sample.release);c.drawImage(this.body,left+model.x,top+model.y,size,size);c.restore();
  c.globalAlpha=1;
 }
 draw(ctx,now,width,height,anchor,reduced=false){
  const started=performance.now(),frameDelta=Math.max(0,Math.min(60,now-this.lastDraw));if(this.busy&&this.lastDraw){const dt=now-this.lastDraw;if(dt>0){this.intervals.push(dt);if(this.intervals.length>180)this.intervals.shift();}}this.lastDraw=now;
  const sample=this.timeline.sample(now);
  if(sample.done){this.ripples=[];if(this.canvas){this.canvas.hidden=true;this.canvas.style.opacity='0';}this.opacity=0;return sample;}if(!this.busy)return sample;
  const l=this.layout(width,height);if(!this.origin)this.origin={x:anchor?.x??width*.5,y:anchor?.y??height*.5};
  const dpr=Math.min(devicePixelRatio||1,1.5);if(this.canvas.width!==Math.round(width*dpr)||this.canvas.height!==Math.round(height*dpr)){this.canvas.width=Math.round(width*dpr);this.canvas.height=Math.round(height*dpr);}
  this.opacity=sample.amount;this.canvas.style.opacity='1';const ease=reduced?1:1-Math.exp(-frameDelta/120);this.pointer.x+=(this.pointerTarget.x-this.pointer.x)*ease;this.pointer.y+=(this.pointerTarget.y-this.pointer.y)*ease;
  this.ripples=this.ripples.filter(r=>now-r.time<2500);
  if(this.gl){const gl=this.gl,u=this.uniforms,model=statueTransform(this.pointer,width,height);gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(this.program);gl.uniform2f(u.uViewport,width,height);gl.uniform3f(u.uModel,model.x,model.y,model.yaw);gl.uniform2f(u.uOrigin,this.origin.x,this.origin.y);gl.uniform3f(u.uLayout,l.cx,l.cy,l.size);gl.uniform1f(u.uTime,(now-this.animationStarted)/1000);gl.uniform1f(u.uAmount,sample.amount);gl.uniform1f(u.uFormation,sample.formation);gl.uniform1f(u.uRelease,sample.release);gl.uniform1f(u.uDpr,dpr);gl.uniform1f(u.uReduced,reduced?1:0);for(let i=0;i<3;i++){const r=this.ripples[i];gl.uniform4f(u['uRipple'+i],r?.x||0,r?.y||0,r?(now-r.time)/1000:0,r?.strength||0);}gl.drawArrays(gl.POINTS,0,this.particleCount);}
  else{this.context.setTransform(dpr,0,0,dpr,0,0);this.drawFallback(l,now,sample,reduced);}
  this.frameMs=performance.now()-started;
  if(this.intervals.length){const sorted=[...this.intervals].sort((a,b)=>a-b),mean=this.intervals.reduce((a,b)=>a+b)/this.intervals.length;this.cadence={fps:Math.round(1000/mean),p95Ms:Math.round(sorted[Math.floor(sorted.length*.95)]*10)/10,samples:sorted.length};}
  this.frames=(this.frames||0)+1;if(this.frames%30===0){this.canvas.setAttribute?.('data-fps',String(this.cadence.fps||0));this.canvas.setAttribute?.('data-p95-ms',String(this.cadence.p95Ms||0));this.canvas.setAttribute?.('data-frame-ms',String(Math.round(this.frameMs*100)/100));}
  return sample;
 }
}
