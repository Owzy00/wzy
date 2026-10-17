const clamp01=n=>Math.max(0,Math.min(1,n));
const smooth=t=>{t=clamp01(t);return t*t*(3-2*t);};
export function decodeCloud(item){
 const binary=atob(item.data),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);if(bytes.length!==item.count*9)throw new Error('点云字节数不匹配');
 const v=new DataView(bytes.buffer),points=[];for(let i=0;i<item.count;i++){const o=i*9;points.push({x:v.getInt16(o,true)/1000,y:v.getInt16(o+2,true)/1000,z:v.getInt16(o+4,true)/1000,r:v.getUint8(o+6),g:v.getUint8(o+7),b:v.getUint8(o+8)});}return points;
}
export class WindField{
 constructor(){this.gusts=[];this.active=[];}
 push({x,y,dx,dy},now){this.gusts.push({x,y,dx:Math.max(-1.8,Math.min(1.8,dx)),dy:Math.max(-1.8,Math.min(1.8,dy)),time:now});this.gusts=this.gusts.slice(-4);}
 prepare(now){this.gusts=this.gusts.filter(g=>now-g.time<3200);this.active=this.gusts.map(g=>{const t=(now-g.time)/1000;return {...g,strength:(1-Math.exp(-t*9))*Math.exp(-t*1.5)*180};});}
 offset(x,y,width,height){let dx=0,dy=0;const radius=Math.min(width,height)*.38;for(const g of this.active){const d2=(x-g.x*width)**2+(y-g.y*height)**2;const a=Math.exp(-d2/(radius*radius))*g.strength;dx+=g.dx*a;dy+=g.dy*a;}return [dx,dy];}
}
export class MorphTimeline{
 constructor(){this.state='IDLE';this.started=0;this.returned=0;this.cooldownUntil=0;this.duration={gather:2200,hold:4200,return:1700};}
 get busy(){return ['GATHERING','HOLDING','RETURNING'].includes(this.state);}
 start(now){if(this.busy||now<this.cooldownUntil)return false;this.started=now;this.state='GATHERING';this.earlyReturn=null;return true;}
 finish(now){if(!this.busy||this.state==='RETURNING')return;const current=this.sample(now);this.returnFrom=current.amount;this.earlyReturn=now;this.state='RETURNING';}
 sample(now){
  if(!this.busy)return {state:this.state,amount:0,hold:false,done:false};
  const t=now-this.started,d=this.duration;
  if(this.earlyReturn!==null){const a=1-smooth((now-this.earlyReturn)/d.return);if(a<=0){this.state='COOLDOWN';this.cooldownUntil=now+1200;return {state:this.state,amount:0,done:true};}return {state:'RETURNING',amount:a*this.returnFrom,hold:false,done:false};}
  if(t<d.gather){this.state='GATHERING';return {state:this.state,amount:smooth(t/d.gather),hold:false,done:false};}
  if(t<d.gather+d.hold){this.state='HOLDING';return {state:this.state,amount:1,hold:true,done:false};}
  if(t<d.gather+d.hold+d.return){this.state='RETURNING';return {state:this.state,amount:1-smooth((t-d.gather-d.hold)/d.return),hold:false,done:false};}
  this.state='COOLDOWN';this.cooldownUntil=now+1200;return {state:this.state,amount:0,hold:false,done:true};
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
uniform vec2 uViewport,uPointer,uOrigin;uniform vec3 uLayout;uniform float uTime,uAmount,uDpr,uReduced;
varying vec3 vColor;varying float vAlpha;
float sheet(float x,float band,float t){
 return .49+(band-2.5)*.118+sin(x*6.4+band*1.7-t*.29)*.088+sin(x*13.7-band*2.1+t*.22)*.032;
}
void main(){
 float t=uTime*(1.-uReduced),band=floor(aSeed.y*6.);
 vec2 pos;float size;
 if(aFlow>.5){
  float x=fract(aSeed.x+t*(.034+aSeed.z*.013))*1.55-.32;
  float thickness=sin(aSeed.z*6.28318)*(.014+.082*pow(.5+.5*sin(x*7.2+band*1.6-t*.22),2.));
  float y=sheet(x,band,t)+thickness+sin(aSeed.x*139.+t*.7)*.003;
  pos=vec2(x*uViewport.x,y*uViewport.y);
  // A flowing curtain thins toward the statue; its ribbons stay open, never orbit.
  float silhouetteZone=smoothstep(.29,.49,x)*(1.-smoothstep(.61,.85,x));
  vAlpha=(.30+aSeed.z*.42)*(1.-silhouetteZone*.80)*(1.-smoothstep(.57,1.05,x)*.75)*smoothstep(0.,.12,uAmount);
  size=(1.15+aSeed.z*.65)*uDpr;
 }else{
  float settle=smoothstep(.08+aSeed.x*.30,.70+aSeed.x*.28,uAmount);
  vec2 target=uLayout.xy+(aTarget.xy+vec2(aTarget.z*uPointer.x*.045,aTarget.z*uPointer.y*.026))*uLayout.z;
  // Spread incoming statue points over an open field, independently of ribbon bands.
  float x=-.18+aSeed.y*.95;
  float y=.08+aSeed.z*.84;
  vec2 source=vec2(x*uViewport.x,y*uViewport.y);
  // Selected mansion supplies a subtle bend, rather than a circular emitter.
  source.y+=clamp(uOrigin.y/uViewport.y-.5,-.25,.25)*uViewport.y*.16;
  pos=mix(source,target,settle);
  pos.y+=sin(settle*7.+aSeed.y*6.28)*sin(settle*3.14159)*(1.-settle)*uLayout.z*.10*(1.-uReduced);
  // Reveal only near arrival: travelling statue points must not form bright clumps.
  vAlpha=smoothstep(.38,.95,settle)*.93;
  size=(1.7+aSeed.z*.65)*uDpr;
 }
 vColor=mix(vec3(.94,.74,.46),aColor,aFlow>.5?1.:smoothstep(.35,.98,uAmount));
 gl_Position=vec4(pos.x/uViewport.x*2.-1.,1.-pos.y/uViewport.y*2.,0.,1.);
 gl_PointSize=max(1.,size);
}`;
const FLOW_FRAGMENT=`
precision mediump float;varying vec3 vColor;varying float vAlpha;
void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;float edge=1.-smoothstep(.45,1.,r);gl_FragColor=vec4(vColor,vAlpha*edge);}
`;
export class StatueStage{
 constructor(){this.timeline=new MorphTimeline();this.pointer={x:0,y:0};this.quality=1;this.frameMs=0;this.lastDraw=0;this.renderer='uninitialized';this.intervals=[];this.cadence={};this.opacity=0;this.prepared=new Map();}
 get busy(){return this.timeline.busy;}
 get occludesSky(){return this.busy&&this.opacity>=.995;}
 layout(width,height){const mobile=width<850;return {cx:width*(mobile?.44:.51),cy:height*.52,size:Math.max(100,Math.min(height-(mobile?175:140),width*(mobile?1.05:.72))),width,height};}
 initRenderer(){
  if(this.canvas)return;
  this.canvas=document.createElement('canvas');this.canvas.id='statue-particles';this.canvas.setAttribute('aria-hidden','true');this.canvas.hidden=true;document.body.append(this.canvas);
  if(new URLSearchParams(location.search).has('canvas-fallback'))return this.initFallback();
  try{
   const gl=this.canvas.getContext('webgl',{alpha:false,antialias:false,depth:false,stencil:false,premultipliedAlpha:false,preserveDrawingBuffer:false,powerPreference:'high-performance'});if(!gl)throw new Error('WebGL unavailable');
   this.gl=gl;
   const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;};
   const vs=shader(gl.VERTEX_SHADER,FLOW_VERTEX),fs=shader(gl.FRAGMENT_SHADER,FLOW_FRAGMENT),program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));gl.deleteShader(vs);gl.deleteShader(fs);
   this.program=program;this.buffer=gl.createBuffer();this.uniforms={};for(const n of ['uViewport','uPointer','uOrigin','uLayout','uTime','uAmount','uDpr','uReduced'])this.uniforms[n]=gl.getUniformLocation(program,n);
   gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
   for(const [name,size,offset]of [['aTarget',3,0],['aColor',3,12],['aSeed',3,24],['aFlow',1,36]]){const loc=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,40,offset);}
   gl.disable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.clearColor(0,0,0,1);this.renderer='webgl';
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
  this.initRenderer();this.item=item;const prepared=this.prepare(item);this.points=prepared.points;this.origin=null;this.intervals=[];this.cadence={};this.fallbackKey='';
  const packed=prepared.packed;this.particleCount=packed.count;
  if(this.gl){this.gl.bindBuffer(this.gl.ARRAY_BUFFER,this.buffer);this.gl.bufferData(this.gl.ARRAY_BUFFER,packed.data,this.gl.STATIC_DRAW);}else this.prepareFallback();
  // Decode/upload before starting the clock so the first frame never skips ahead.
  this.timeline.start(performance.now());this.lastDraw=this.timeline.started;this.animationStarted=this.timeline.started;this.canvas.hidden=false;return true;
 }
 finish(now){this.timeline.finish(now);}
 prepareFallback(){
  this.body=document.createElement('canvas');this.body.width=700;this.body.height=700;const c=this.body.getContext('2d');
  for(const p of this.points){c.fillStyle=`rgb(${Math.min(255,p.r*1.3+24)},${Math.min(255,p.g*1.3+16)},${Math.min(255,p.b*1.3+7)})`;c.globalAlpha=.88;c.fillRect((p.x+.5)*700,(p.y+.5)*700,1.1,1.1);}
  this.flow=document.createElement('canvas');this.flow.width=1500;this.flow.height=700;const f=this.flow.getContext('2d');
  // Bake fine grain once. Each frame composites only 14 strips, not 100k points.
  for(let i=0;i<26000;i++){const x=(i*.61803398875)%1,seed=(i*.754877666)%1,band=i%6,y=.49+(band-2.5)*.118+Math.sin(x*6.4+band*1.7)*.088+Math.sin(x*13.7-band*2.1)*.032+(seed-.5)*.027;f.fillStyle=i%3?'#d8b780':'#f1d7a5';f.globalAlpha=.25+seed*.4;f.fillRect(x*1500,y*700,.8,.8);}
 }
 drawFallback(l,now,a,reduced){
  const c=this.context;c.clearRect(0,0,l.width,l.height);const t=reduced?0:(now-this.animationStarted)*.0003;
  c.globalAlpha=smooth(a/.12);for(let j=0;j<12;j++){const x=j/12*l.width,w=l.width/12+1;c.drawImage(this.flow,j/12*1500,0,1500/12,700,x,Math.sin(t+j*.6)*l.height*.012,w,l.height);}
  const settle=smooth((a-.15)/.85),left=l.cx-l.size/2,top=l.cy-l.size/2;
  c.save();c.beginPath();c.rect(left,top,l.size,l.size*settle);c.clip();c.globalAlpha=settle;c.drawImage(this.body,left+this.pointer.x*2,top+this.pointer.y,l.size,l.size);c.restore();
  c.globalAlpha=1;
 }
 draw(ctx,now,width,height,anchor,reduced=false){
  const started=performance.now();if(this.busy&&this.lastDraw){const dt=now-this.lastDraw;if(dt>0){this.intervals.push(dt);if(this.intervals.length>180)this.intervals.shift();}}this.lastDraw=now;
  const sample=this.timeline.sample(now);
  if(sample.done){if(this.canvas){this.canvas.hidden=true;this.canvas.style.opacity='0';}this.opacity=0;return sample;}if(!this.busy)return sample;
  const l=this.layout(width,height);if(!this.origin)this.origin={x:anchor?.x??width*.5,y:anchor?.y??height*.5};
  const dpr=Math.min(devicePixelRatio||1,1.5);if(this.canvas.width!==Math.round(width*dpr)||this.canvas.height!==Math.round(height*dpr)){this.canvas.width=Math.round(width*dpr);this.canvas.height=Math.round(height*dpr);}
  this.opacity=sample.state==='RETURNING'?smooth(sample.amount/.65):smooth((now-this.animationStarted)/480);this.canvas.style.opacity=String(this.opacity);
  if(this.gl){const gl=this.gl,u=this.uniforms;gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(this.program);gl.uniform2f(u.uViewport,width,height);gl.uniform2f(u.uPointer,this.pointer.x,this.pointer.y);gl.uniform2f(u.uOrigin,this.origin.x,this.origin.y);gl.uniform3f(u.uLayout,l.cx,l.cy,l.size);gl.uniform1f(u.uTime,(now-this.animationStarted)/1000);gl.uniform1f(u.uAmount,sample.amount);gl.uniform1f(u.uDpr,dpr);gl.uniform1f(u.uReduced,reduced?1:0);gl.drawArrays(gl.POINTS,0,this.particleCount);}
  else{this.context.setTransform(dpr,0,0,dpr,0,0);this.drawFallback(l,now,sample.amount,reduced);}
  this.frameMs=performance.now()-started;
  if(this.intervals.length){const sorted=[...this.intervals].sort((a,b)=>a-b),mean=this.intervals.reduce((a,b)=>a+b)/this.intervals.length;this.cadence={fps:Math.round(1000/mean),p95Ms:Math.round(sorted[Math.floor(sorted.length*.95)]*10)/10,samples:sorted.length};}
  return sample;
 }
}
