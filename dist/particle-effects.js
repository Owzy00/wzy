import {CLOUD_GLSL,cloudPose,cloudSettle,cloudPresence,starFlight,statueSurface,prepareRippleWaves,rippleDisplacement,rippleActivity} from './cloud-field.js?v=17';
const clamp01=n=>Math.max(0,Math.min(1,n));
const smooth=t=>{t=clamp01(t);return t*t*(3-2*t);};
const silk=t=>{t=clamp01(t);return t*t*t*(t*(t*6-15)+10);};
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
  for(const r of this.waves){const radius=r.age*dim*.33,alpha=Math.sin(Math.min(1,r.age/.25)*Math.PI/2)*Math.exp(-r.age*1.9)*.24*r.strength;if(radius<1)continue;context.strokeStyle=`rgba(236,207,134,${alpha})`;context.lineWidth=.55;context.beginPath();context.arc(r.x*width,r.y*height,radius,0,Math.PI*2);context.stroke();for(let i=0;i<12;i++){const angle=i*2.39996+r.time*.001,x=r.x*width+Math.cos(angle)*radius,y=r.y*height+Math.sin(angle)*radius;context.fillStyle=`rgba(255,231,166,${alpha*.8})`;context.fillRect(x,y,1.2,1.2);}}
  context.restore();
 }
}
export class MorphTimeline{
 constructor(){this.state='IDLE';this.started=0;this.returned=0;this.cooldownUntil=0;this.duration={gather:4800,hold:4200,return:3000};}
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

 const tint=(p,o)=>{data[o]=p.x;data[o+1]=p.y;data[o+2]=p.z;data[o+3]=Math.min(1,p.r/255*1.05+.035);data[o+4]=Math.min(1,p.g/255*1.02+.025);data[o+5]=Math.min(1,p.b/255*.94+.015);if(!(data[o+9]>.5&&data[o+8]>=.89)){data[o+6]=clamp01(.5+p.x*.9+(data[o+6]-.5)*.12);data[o+7]=clamp01(.5+p.y*.9+(data[o+7]-.5)*.08);}};
 // Every gathering particle has a surface destination; the cloud is not a separate backdrop.
 if(points.length)for(let i=0;i<flowCount;i++){const o=i*10,p=points[(i*7919+13)%points.length];tint(p,o);data[o]+=(data[o+6]-.5)*.0014;data[o+1]+=(data[o+7]-.5)*.0014;}
 for(let i=0;i<points.length;i++)tint(points[i],(i+flowCount)*10);

 return {data,count:points.length+flowCount,flowCount};
}
const FLOW_VERTEX=`
precision highp float;
attribute vec3 aTarget,aColor,aSeed;attribute float aFlow;
uniform vec2 uViewport,uPointer,uOrigin;uniform vec3 uLayout;
uniform vec2 uSource0,uSource1,uSource2,uSource3,uSource4;uniform float uSourceCount;
uniform float uTime,uAmount,uFormation,uRelease,uDpr,uReduced;
uniform vec4 uRipple0,uRipple1,uRipple2;
uniform vec3 uRippleSpread;
varying vec3 vColor;varying float vAlpha,vSpark;
${CLOUD_GLSL}
vec2 wake(vec2 p,vec4 ripple,float spread){
 if(ripple.w<.001||ripple.z<=0.||ripple.z>=2.5)return vec2(0.);
 float dim=min(uViewport.x,uViewport.y),radius=ripple.z*dim*.36;
 vec2 d=p-ripple.xy*uViewport;float edge=(length(d)-radius)/(dim*.04*spread);
 return d/max(1.,length(d))*exp(-edge*edge)*exp(-ripple.z*1.7)*ripple.w*dim*.045*(1.+(spread-1.)*.4)*smoothstep(0.,.10,ripple.z)*(1.-smoothstep(2.1,2.5,ripple.z));
}
void main(){
 // Explicit morphing still has a quiet, changing flow under reduced motion.
 float motion=mix(1.,.18,uReduced),loose=aFlow*step(.89,aSeed.z);
 float settle=cloudSettle(aSeed,uFormation);
 float breath=1.+sin(uTime*1.22)*.007*motion;
 vec3 target=aTarget;target.xy*=breath;
 target.xy+=target.z*uPointer*vec2(.055,.025)*motion;
 vec3 p=cloudPose(target,aSeed,uTime,uFormation,uRelease,loose,motion);
 float zoom=mix(1.75,1.,smoothstep(.12,.95,uFormation));
 float perspective=1./(1.+p.z*.32*(1.-settle));
 vec2 pos=uLayout.xy+p.xy*uLayout.z*zoom*perspective;
 pos+=uPointer*vec2(46.,16.)*settle*(1.-uRelease)*motion;
 float sourceIndex=floor(fract(aSeed.z*17.31+aSeed.x*7.17)*max(1.,uSourceCount));
 vec2 source=uSource0;if(sourceIndex>.5)source=uSource1;if(sourceIndex>1.5)source=uSource2;if(sourceIndex>2.5)source=uSource3;if(sourceIndex>3.5)source=uSource4;
 vec3 flight=starFlight(aSeed,uTime,source*uViewport,pos,min(uViewport.x,uViewport.y),motion);pos=flight.xy;
 float freeMotion=(1.-smoothstep(0.,.22,uRelease));
 vec2 disturbance=wake(pos,uRipple0,uRippleSpread.x)+wake(pos,uRipple1,uRippleSpread.y)+wake(pos,uRipple2,uRippleSpread.z);
 disturbance*=min(1.,min(uViewport.x,uViewport.y)*.07/max(.001,length(disturbance)));
 pos+=disturbance*freeMotion*motion;
 float sweep=pow(max(0.,sin(aTarget.y*14.-uTime*2.3+aTarget.x*2.5)),20.)*settle*(1.-uRelease);
 float glint=.93+.07*sin(uTime*1.4+aSeed.x*24.)+sweep*.32;
 float visibility=flight.z*(1.-smoothstep(.65,1.,uRelease));
 float layer=mix(1.,.76,aFlow);
 float alpha=mix(.72,.86,settle)*layer;
 alpha=mix(alpha,mix(.34,.065,settle),loose);
 vAlpha=alpha*visibility*glint;
 float shade=.62+.38*(.5+.5*sin(p.z*9.+aSeed.y*3.));
 vec3 gold=mix(vec3(.48,.29,.12),vec3(.96,.83,.58),shade);
 vColor=mix(gold,aColor,settle*(1.-loose)*.86)*glint;
 float size=mix(2.1,1.9,settle)*uDpr*perspective;
 size*=mix(.70,1.3,aSeed.z);
 float spark=fract(sin(dot(aSeed.xy,vec2(127.1,311.7)))*43758.5453);
 vSpark=loose>.5?step(.9985,spark):2.*step(.998,spark);
 if(vSpark>1.5){size=(3.+sweep*6.)*uDpr;vAlpha*=.35+sweep*.65;vColor=mix(vColor,vec3(1.,.90,.66),.5);}
 else if(vSpark>.5){size=(4.+aSeed.y*3.)*uDpr;vAlpha=.62*visibility;}
 gl_Position=vec4(pos.x/uViewport.x*2.-1.,1.-pos.y/uViewport.y*2.,0.,1.);
 gl_PointSize=max(1.,size);
}`;
const FLOW_FRAGMENT=`
precision mediump float;varying vec3 vColor;varying float vAlpha,vSpark;
void main(){vec2 q=gl_PointCoord-.5;float r=length(q)*2.;if(vSpark>1.5){float light=exp(-r*r*5.)*.32+exp(-abs(q.x)*45.-abs(q.y)*6.)+exp(-abs(q.y)*45.-abs(q.x)*6.);gl_FragColor=vec4(vColor,vAlpha*min(1.,light));return;}if(vSpark>.5){if(q.y<abs(q.x)*1.6-.48||q.y>.36)discard;gl_FragColor=vec4(vec3(1.,.83,.40)*(.65+q.x*.6+q.y*.4),vAlpha);return;}if(r>1.)discard;float core=exp(-r*r*6.5),halo=exp(-r*r*2.8)*.24;gl_FragColor=vec4(vColor*(1.+core*.26),vAlpha*(core+halo));}
`;
export class StatueStage{
 constructor(){this.timeline=new MorphTimeline();this.pointer={x:0,y:0};this.pointerTarget={x:0,y:0};this.sources=[];this.ripples=[];this.lastRipple=-Infinity;this.quality=1;this.frameMs=0;this.lastDraw=0;this.renderer='uninitialized';this.intervals=[];this.cadence={};this.opacity=0;this.prepared=new Map();}
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
   this.program=program;this.buffer=gl.createBuffer();this.uniforms={};for(const n of ['uViewport','uPointer','uOrigin','uLayout','uTime','uAmount','uFormation','uRelease','uDpr','uReduced','uRipple0','uRipple1','uRipple2','uRippleSpread','uSource0','uSource1','uSource2','uSource3','uSource4','uSourceCount'])this.uniforms[n]=gl.getUniformLocation(program,n);
   gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
   for(const [name,size,offset]of [['aTarget',3,0],['aColor',3,12],['aSeed',3,24],['aFlow',1,36]]){const loc=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,40,offset);}
   gl.disable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.clearColor(0,0,0,0);this.renderer='webgl';
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
  const bounds={minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity};for(const p of points){bounds.minX=Math.min(bounds.minX,p.x);bounds.maxX=Math.max(bounds.maxX,p.x);bounds.minY=Math.min(bounds.minY,p.y);bounds.maxY=Math.max(bounds.maxY,p.y);}
  const entry={points,packed,bounds};this.prepared.set(item.id,entry);
  if(this.prepared.size>2)this.prepared.delete(this.prepared.keys().next().value);
  return entry;
 }
 start(item,now,sources=[]){
  if(this.busy||now<this.timeline.cooldownUntil)return false;
  this.initRenderer();this.item=item;const prepared=this.prepare(item);this.points=prepared.points;this.bounds=prepared.bounds;this.sources=sources.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)).slice(0,5).map(p=>({x:clamp01(p.x),y:clamp01(p.y)}));this.origin=null;this.intervals=[];this.cadence={};this.ripples=[];this.lastRipple=-Infinity;this.handRippleCount=0;this.pointerRippleCount=0;this.lastRippleSource='';this.pointer={x:0,y:0};this.pointerTarget={x:0,y:0};this.fallbackKey='';
  const packed=prepared.packed;this.particleCount=packed.count;
  if(this.gl){this.gl.bindBuffer(this.gl.ARRAY_BUFFER,this.buffer);this.gl.bufferData(this.gl.ARRAY_BUFFER,packed.data,this.gl.STATIC_DRAW);}else this.prepareFallback();
  // Decode/upload before starting the clock so the first frame never skips ahead.
  this.timeline.start(performance.now());this.lastDraw=this.timeline.started;this.animationStarted=this.timeline.started;this.frames=0;this.canvas.hidden=false;this.canvas.setAttribute('data-renderer',this.renderer);this.canvas.setAttribute('data-effect','star-flight-cloud');this.canvas.setAttribute('data-source-count',String(this.sources.length));this.canvas.setAttribute('data-hand-ripples','0');this.canvas.setAttribute('data-last-ripple-source','');return true;
 }
 finish(now){this.timeline.finish(now);}
 handPoint(x,y){
  const l=this.currentLayout;if(!l)return {x:clamp01(x),y:clamp01(y)};
  const b=this.bounds||{minX:-.32,maxX:.32,minY:-.48,maxY:.48};
  const gainX=Math.min(4.5,l.width/Math.max(1,(b.maxX-b.minX)*l.size)*1.4),gainY=Math.min(2.4,l.height/Math.max(1,(b.maxY-b.minY)*l.size)*1.4);
  const u=.10+.80*clamp01(.5+(x-.5)*gainX),v=.10+.80*clamp01(.5+(y-.5)*gainY);
  return {x:clamp01((l.cx+(b.minX+(b.maxX-b.minX)*u)*l.size+this.pointer.x*46)/l.width),y:clamp01((l.cy+(b.minY+(b.maxY-b.minY)*v)*l.size+this.pointer.y*16)/l.height)};
 }
 interact(x,y,now,strength=0,source='pointer'){
  this.pointerTarget={x:(clamp01(x)-.5)*2,y:(clamp01(y)-.5)*2};
  if(['GATHERING','HOLDING'].includes(this.timeline.state)&&strength>.18&&now-this.lastRipple>260){const p=source==='hand'?this.handPoint(x,y):{x:clamp01(x),y:clamp01(y)};this.lastRipple=now;this.lastRippleSource=source;if(source==='hand')this.handRippleCount=(this.handRippleCount||0)+1;else this.pointerRippleCount=(this.pointerRippleCount||0)+1;this.ripples.push({...p,time:now,strength:Math.min(1.4,strength),spread:source==='hand'?1.35:1});this.ripples=this.ripples.slice(-3);this.canvas?.setAttribute?.('data-last-ripple-source',source);this.canvas?.setAttribute?.('data-hand-ripples',String(this.handRippleCount||0));return true;}
  return false;
 }

 prepareFallback(){
  this.body=document.createElement('canvas');this.body.width=700;this.body.height=700;const c=this.body.getContext('2d');
  for(const p of this.points){c.fillStyle=`rgb(${Math.min(255,p.r*1.05+9)},${Math.min(255,p.g*1.02+6)},${Math.min(255,p.b*.94+4)})`;c.globalAlpha=.82;c.fillRect((p.x+.5)*700,(p.y+.5)*700,.9,.9);}
  const packed=this.prepare(this.item).packed,data=packed.data,count=Math.min(12000,packed.count);
  this.fallbackGroups=Array.from({length:12},()=>[]);
  for(let i=0;i<count;i++){const index=Math.floor(i*packed.count/count),o=index*10,seed={x:data[o+6],y:data[o+7],z:data[o+8]};
   this.fallbackGroups[Math.min(11,Math.floor(seed.z*12))].push({target:{x:data[o],y:data[o+1],z:data[o+2]},seed,loose:data[o+9]>.5&&seed.z>=.89});
  }
  this.fallbackPose={};this.fallbackSurface={};this.fallbackFlight={};this.fallbackScreen={};this.fallbackDisplacement={};this.fallbackPalette=Array.from({length:12},(_,i)=>`rgb(${138+i*9},${102+i*9},${56+i*8})`);
  this.haloSprite=document.createElement('canvas');this.haloSprite.width=this.haloSprite.height=24;const hc=this.haloSprite.getContext('2d'),halo=hc.createRadialGradient(12,12,0,12,12,12);halo.addColorStop(0,'#fff6ce');halo.addColorStop(.12,'#ffdf9bba');halo.addColorStop(.4,'#d8af6030');halo.addColorStop(1,'#d8af6000');hc.fillStyle=halo;hc.fillRect(0,0,24,24);this.glints=this.points.filter((_,i)=>i%1403===0);
 }
 drawFallback(l,now,sample,reduced){
  const c=this.context;c.clearRect(0,0,l.width,l.height);
  const time=(now-this.animationStarted)/1000,motion=reduced?.18:1,solid=smooth((sample.formation-.62)/.38)*(1-sample.release);
  const sources=this.sources.length?this.sources.map(s=>({x:s.x*l.width,y:s.y*l.height})):[this.origin];
  const zoom=1.75-.75*smooth((sample.formation-.12)/.83),p=this.fallbackPose,breath=1+Math.sin(time*1.22)*.007*motion;
  const target=this.fallbackSurface||(this.fallbackSurface={}),screen=this.fallbackScreen||(this.fallbackScreen={});
  const waves=prepareRippleWaves(this.ripples,now,l.width,l.height),freeMotion=1-smooth(sample.release/.22),disturbed=rippleActivity(this.ripples,now)*freeMotion;
  for(let group=0;group<12;group++){
   c.fillStyle=this.fallbackPalette[group];
   for(const particle of this.fallbackGroups[group]){
    if(solid>.95&&!particle.loose&&disturbed<.005)continue;
    target.x=particle.target.x*breath+particle.target.z*this.pointer.x*.055*motion;target.y=particle.target.y*breath+particle.target.z*this.pointer.y*.025*motion;target.z=particle.target.z;
    if(sample.hold&&!particle.loose){p.x=target.x;p.y=target.y;p.z=target.z;}else cloudPose(target,particle.seed,time,sample.formation,sample.release,particle.loose,motion,p);
    const settled=cloudSettle(particle.seed,sample.formation),perspective=1/(1+p.z*.32*(1-settled));
    let x=l.cx+p.x*l.size*zoom*perspective+this.pointer.x*46*settled*(1-sample.release)*motion;
    let y=l.cy+p.y*l.size*zoom*perspective+this.pointer.y*16*settled*(1-sample.release)*motion;
    let visibility=1;if(time<2.5){const source=sources[Math.floor(((particle.seed.z*17.31+particle.seed.x*7.17)%1)*sources.length)];screen.x=x;screen.y=y;const flight=starFlight(particle.seed,time,source,screen,Math.min(l.width,l.height),motion,this.fallbackFlight);x=flight.x;y=flight.y;visibility=flight.visibility;}
    if(waves.length){const d=rippleDisplacement(x,y,waves,Math.min(l.width,l.height)*.07,this.fallbackDisplacement);x+=d.x*freeMotion*motion;y+=d.y*freeMotion*motion;}
    c.globalAlpha=visibility*(1-smooth((sample.release-.65)/.35))*(particle.loose?.19:(.38+.28*settled)*(1-solid*.85+disturbed*.85));
    const size=(.75+particle.seed.z*.55)*perspective*(1+disturbed*.55);c.fillRect(x,y,size,size);
   }
  }
  const size=l.size*breath;
  c.globalAlpha=solid*(1-disturbed);c.drawImage(this.body,l.cx-size/2+this.pointer.x*46*motion,l.cy-size/2+this.pointer.y*16*motion,size,size);c.globalAlpha=1;
  if(this.haloSprite)for(const point of this.glints){const sweep=Math.pow(Math.max(0,Math.sin(point.y*14-time*2.3+point.x*2.5)),20),q=statueSurface(point,time,this.pointer,motion,this.fallbackSurface);c.globalAlpha=solid*(.04+sweep*.45)*(1-disturbed);const x=l.cx+q.x*l.size+this.pointer.x*46*motion,y=l.cy+q.y*l.size+this.pointer.y*16*motion;c.drawImage(this.haloSprite,x-8,y-8,16,16);}c.globalAlpha=1;
 }
 draw(ctx,now,width,height,anchor,reduced=false){
  const started=performance.now(),frameDelta=Math.max(0,Math.min(60,now-this.lastDraw));if(this.busy&&this.lastDraw){const dt=now-this.lastDraw;if(dt>0){this.intervals.push(dt);if(this.intervals.length>180)this.intervals.shift();}}this.lastDraw=now;
  const sample=this.timeline.sample(now);
  sample.presence=cloudPresence(sample.formation||0)*(1-(sample.release||0));if(sample.done){this.ripples=[];if(this.canvas){this.canvas.setAttribute?.('data-active-ripples','0');this.canvas.hidden=true;this.canvas.style.opacity='0';}this.opacity=0;return sample;}if(!this.busy)return sample;
  const phase=sample.release>0?'release':sample.formation<.08?'emerging':sample.formation<.3?'cloud':sample.formation<.9?'silhouette':'formed';if(this.phase!==phase){this.phase=phase;this.canvas.setAttribute?.('data-phase',phase);this.canvas.setAttribute?.('data-phase-time',String(Math.round((now-this.animationStarted)/10)/100));}const l=this.layout(width,height);if(!this.origin)this.origin={x:anchor?.x??width*.5,y:anchor?.y??height*.5};
  this.currentLayout=l;const dpr=Math.min(devicePixelRatio||1,1.5);if(this.canvas.width!==Math.round(width*dpr)||this.canvas.height!==Math.round(height*dpr)){this.canvas.width=Math.round(width*dpr);this.canvas.height=Math.round(height*dpr);}
  this.opacity=sample.presence;this.canvas.style.opacity='1';const ease=reduced?1:1-Math.exp(-frameDelta/120);this.pointer.x+=(this.pointerTarget.x-this.pointer.x)*ease;this.pointer.y+=(this.pointerTarget.y-this.pointer.y)*ease;
  this.ripples=this.ripples.filter(r=>now-r.time<2500);this.canvas.setAttribute?.('data-active-ripples',String(this.ripples.length));
  if(this.gl){const gl=this.gl,u=this.uniforms;gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(this.program);gl.uniform2f(u.uViewport,width,height);gl.uniform2f(u.uPointer,this.pointer.x,this.pointer.y);gl.uniform2f(u.uOrigin,this.origin.x,this.origin.y);gl.uniform3f(u.uLayout,l.cx,l.cy,l.size);gl.uniform1f(u.uTime,(now-this.animationStarted)/1000);gl.uniform1f(u.uAmount,sample.presence);gl.uniform1f(u.uFormation,sample.formation);gl.uniform1f(u.uRelease,sample.release);gl.uniform1f(u.uDpr,dpr);gl.uniform1f(u.uReduced,reduced?1:0);gl.uniform1f(u.uSourceCount,this.sources.length||1);for(let i=0;i<5;i++){const source=this.sources[i]||this.sources[0]||{x:this.origin.x/width,y:this.origin.y/height};gl.uniform2f(u['uSource'+i],source.x,source.y);}gl.uniform3f(u.uRippleSpread,this.ripples[0]?.spread||1,this.ripples[1]?.spread||1,this.ripples[2]?.spread||1);for(let i=0;i<3;i++){const r=this.ripples[i];gl.uniform4f(u['uRipple'+i],r?.x||0,r?.y||0,r?(now-r.time)/1000:0,r?.strength||0);}gl.drawArrays(gl.POINTS,0,this.particleCount);}
  else{this.context.setTransform(dpr,0,0,dpr,0,0);this.drawFallback(l,now,sample,reduced);}
  this.frameMs=performance.now()-started;
  if(this.intervals.length){const sorted=[...this.intervals].sort((a,b)=>a-b),mean=this.intervals.reduce((a,b)=>a+b)/this.intervals.length;this.cadence={fps:Math.round(1000/mean),p95Ms:Math.round(sorted[Math.floor(sorted.length*.95)]*10)/10,samples:sorted.length};}
  this.frames=(this.frames||0)+1;if(this.frames%30===0){this.canvas.setAttribute?.('data-fps',String(this.cadence.fps||0));this.canvas.setAttribute?.('data-p95-ms',String(this.cadence.p95Ms||0));this.canvas.setAttribute?.('data-frame-ms',String(Math.round(this.frameMs*100)/100));}
  return sample;
 }
}
