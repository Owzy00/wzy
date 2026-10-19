const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const vector3=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:(a.z||0)-(b.z||0)});
const length3=v=>Math.hypot(v.x,v.y,v.z);
// Reach along the finger's palm-local axis: translation, scale and hand rotation
// do not become taps. Depth landmarks also capture a finger bending toward camera.
function fingerBend(p,tip){
 const base=p[tip-3],axis=vector3(base,p[0]),reach=vector3(p[tip],base);
 const bones=length3(vector3(p[tip-2],base))+length3(vector3(p[tip-1],p[tip-2]))+length3(vector3(p[tip],p[tip-1]));
 return 1-Math.max(-1,Math.min(1,(reach.x*axis.x+reach.y*axis.y+reach.z*axis.z)/Math.max(.00001,length3(axis)*bones)));
}
export function describeHand(landmarks,confidence=1,handCount=1){
 if(handCount!==1||confidence<.75||!landmarks||landmarks.length!==21||landmarks.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))return null;
 const span=distance(landmarks[5],landmarks[17]);if(span<.045||span>.55)return null;
 const wrist=landmarks[0],tips=[8,12,16,20];
 const extended=tips.map(t=>distance(landmarks[t],wrist)>distance(landmarks[t-2],wrist)*1.16&&distance(landmarks[t],landmarks[t-3])>span*.65);
 const folded=tips.map(t=>distance(landmarks[t],wrist)<distance(landmarks[t-2],wrist)*1.18&&distance(landmarks[t],landmarks[t-3])<span*.90);
 const count=extended.filter(Boolean).length;
 const palm=[0,5,9,13,17].reduce((s,i)=>({x:s.x+landmarks[i].x/5,y:s.y+landmarks[i].y/5}),{x:0,y:0});
 const fingers={index:{x:1-landmarks[8].x,y:landmarks[8].y,extended:extended[0],bend:fingerBend(landmarks,8)},ring:{x:1-landmarks[16].x,y:landmarks[16].y,extended:extended[2],bend:fingerBend(landmarks,16)}};
 return {pose:count>=3?'open':count===0&&folded.every(Boolean)?'fist':extended[0]&&count===1?'point':'neutral',palm:{x:1-palm.x,y:palm.y},tip:{x:fingers.index.x,y:fingers.index.y},fingers,confidence,span};
}
export class GestureMachine{
 constructor(){this.state='IDLE';this.pose='neutral';this.since=0;this.lastTime=-1;this.lastSeen=-1;this.cooldownUntil=0;this.progress=0;this.lastSelection=null;this.disarm();}
 disarm(){this.armed=false;this.anchor=null;this.lastFist=-1;this.openSince=null;this.openSamples=0;this.fistSamples=0;}
 reset(now=0,state='IDLE'){this.state=state;this.since=now;this.progress=0;this.pose='neutral';this.disarm();}
 // Acknowledging our own fist selection keeps this sequence armed. Mouse selection resets it.
 confirmSelection(selected){if(!this.armed)return;this.lastSelection=selected;if(selected===null)this.disarm();}
 update(sample,now,{selected=null,busy=false,enabled=true}={}){
  if(now<=this.lastTime)return null;const gap=this.lastTime>=0?now-this.lastTime:0;this.lastTime=now;
  if(selected!==this.lastSelection){this.lastSelection=selected;this.reset(now);}
  if(!enabled||busy){this.reset(now,'BLOCKED');return null;}
  if(this.state==='BLOCKED')this.reset(now);
  if(now<this.cooldownUntil){this.state='COOLDOWN';this.progress=0;this.disarm();return null;}
  if(this.state==='COOLDOWN')this.reset(now);
  if(!sample){this.reset(now,'LOST');return null;}
  if(gap>500)this.reset(now);
  this.lastSeen=now;
  // A new or abruptly relocated hand must start a fresh fist-to-palm sequence.
  if(this.armed&&this.anchor){const ratio=sample.span&&this.anchor.span?sample.span/this.anchor.span:1;if(distance(sample.palm,this.anchor.palm)>.25||ratio<.55||ratio>1.8){this.reset(now);return null;}}
  if(sample.pose==='fist'){
   this.openSince=null;this.openSamples=0;this.lastFist=now;
   if(this.pose!=='fist'){this.pose='fist';this.since=now;this.fistSamples=0;}
   this.fistSamples++;
   if(this.armed){this.state='FIST_READY';this.progress=.65;return null;}
   if(now-this.since>=350&&this.fistSamples>=3){
    this.armed=true;this.anchor={palm:{...sample.palm},span:sample.span};this.state='FIST_READY';this.progress=.65;
    return {type:'select'};
   }else{this.state='FIST_ARMING';this.progress=Math.min(.64,(now-this.since)/350*.65);}
   return null;
  }
  if(this.armed){
   if(now-this.lastFist>1800){this.reset(now);return null;}
   if(sample.pose==='open'){
    this.openSince??=now;this.openSamples++;this.state='OPENING';this.progress=.65+Math.min(1,(now-this.openSince)/180)*.35;
    if(now-this.openSince>=180&&this.openSamples>=2&&selected!==null){
     this.disarm();this.cooldownUntil=now+1200;this.state='COOLDOWN';this.progress=1;
     return {type:'morph',selected};
    }
   }else{
    this.openSince=null;this.openSamples=0;this.state='FIST_READY';this.progress=.65;
    // Brief intermediate finger positions are natural while opening the fist.
    if(now-this.lastFist>350)this.reset(now);
   }
   return null;
  }
  if(sample.pose!=='open'){this.reset(now);return null;}
  this.pose='open';this.state='NAVIGATING';this.progress=0;
  return null;
 }
}

// Estimate hand velocity at camera cadence; integrate and damp it at display cadence.
// Reacquisition establishes an anchor and never turns a new hand position into a jump.
export class HandNavigator{
 constructor(){this.reset();}
 reset(){this.previous=null;this.velocity={x:0,y:0};this.target={x:0,y:0};this.frameTime=null;this.lastSample=-1;}
 feed(sample,now){
  if(!sample||sample.pose!=='open'){this.reset();return;}
  if(now<=this.lastSample)return;
  const old=this.previous;this.lastSample=now;this.previous={...sample.palm,t:now,span:sample.span};
  if(!old||now-old.t>400){this.velocity={x:0,y:0};this.target={x:0,y:0};return;}
  const dx=sample.palm.x-old.x,dy=sample.palm.y-old.y,travel=Math.hypot(dx,dy),ratio=sample.span&&old.span?sample.span/old.span:1;
  if(travel>.18||ratio<.6||ratio>1.6){this.velocity={x:0,y:0};this.target={x:0,y:0};return;}
  const dt=Math.max(.025,(now-old.t)/1000),gain=travel<.0018?0:Math.min(1,(travel-.0018)/.004);
  this.target={x:Math.max(-.85,Math.min(.85,dx/dt*gain)),y:Math.max(-.7,Math.min(.7,dy/dt*gain))};
 }
 step(now){
  const dt=this.frameTime===null?0:Math.max(0,Math.min(.05,(now-this.frameTime)/1000));this.frameTime=now;
  if(this.lastSample<0||now-this.lastSample>220)this.target={x:0,y:0};
  if(this.lastSample<0||now-this.lastSample>450){this.velocity={x:0,y:0};return {dx:0,dy:0};}
  const ease=1-Math.exp(-dt/.075);this.velocity.x+=(this.target.x-this.velocity.x)*ease;this.velocity.y+=(this.target.y-this.velocity.y)*ease;
  return {dx:this.velocity.x*dt*1.65,dy:this.velocity.y*dt*1.4};
 }
}

// A tap is an observed press AND rebound, never a fingertip displacement.
// Ready -> pressing -> pressed -> rebound; each finger owns its cooldown.
export class FingerTapInput{
 constructor(){this.lastPulse=-Infinity;this.reset();}
 reset(){this.previous=null;this.state='WAITING';this.readySince=null;this.readySamples=0;this.baseline=null;this.pressedSamples=0;this.pressSince=null;this.peak=0;}
 feed(sample,now,enabled=true){
  const p=sample?.point;
  if(!enabled||!p||!Number.isFinite(now)||!Number.isFinite(p.x)||!Number.isFinite(p.y)||!Number.isFinite(p.bend)||p.x<0||p.x>1||p.y<0||p.y>1||!Number.isFinite(sample.confidence)||sample.confidence<.75||!sample.palm||!Number.isFinite(sample.palm.x)||!Number.isFinite(sample.palm.y)){this.reset();return null;}
  const old=this.previous;if(old&&now<=old.t)return null;
  const ratio=sample.span&&old?.span?sample.span/old.span:1;
  if(old&&(now-old.t>400||distance(p,old)>.20||distance(sample.palm,old.palm)>.16||ratio<.7||ratio>1.4))this.reset();
  this.previous={x:p.x,y:p.y,t:now,span:sample.span,palm:{...sample.palm}};
  const output={x:p.x,y:p.y,strength:0,tap:false};
  if(now-this.lastPulse<480)return output;
  if(this.state==='WAITING'){
   if(!p.extended){this.readySince=null;this.readySamples=0;this.baseline=null;return output;}
   if(this.baseline===null||Math.abs(p.bend-this.baseline)>.06){this.baseline=p.bend;this.readySince=now;this.readySamples=1;return output;}
   this.readySamples++;
   if(now-this.readySince>=100&&this.readySamples>=2)this.state='READY';
   return output;
  }
  const delta=p.bend-this.baseline;
  if(this.state==='READY'){
   if(delta<.10){this.baseline+=(p.bend-this.baseline)*.08;return output;}
   this.state='PRESSING';this.pressSince=now;this.peak=delta;
  }
  this.peak=Math.max(this.peak,delta);
  const age=now-this.pressSince;
  if(age>850){this.reset();return output;}
  if(this.state==='PRESSING'){
   if(delta<.07){this.reset();return output;}
   if(age>450){this.reset();return output;}
   if(delta>=.22){this.state='PRESSED';this.pressedSamples=1;this.pressPoint={x:p.x,y:p.y};this.pressedAt=now;}
   return output;
  }
  if(delta>=.17){this.pressedSamples++;this.pressPoint={x:p.x,y:p.y};}
  if(delta<=.07&&p.extended){
   const tapped=this.pressedSamples>=2&&now-this.pressedAt>=50;
   const point=this.pressPoint,peak=this.peak;this.reset();
   if(tapped){this.lastPulse=now;return {...point,strength:Math.min(.95,.65+peak*.35),tap:true};}
  }
  return output;
 }
}
export class FingerParticleInput{
 constructor(){this.tracks={index:new FingerTapInput(),ring:new FingerTapInput()};}
 reset(){for(const track of Object.values(this.tracks))track.reset();}
 get previous(){return this.tracks.index.previous||this.tracks.ring.previous;}
 feed(sample,now,enabled=true){
  const inputs=[];
  for(const finger of ['index','ring']){
   const tip=sample?.fingers?.[finger],valid=enabled&&!!tip;
   const input=this.tracks[finger].feed(valid?{point:tip,palm:sample.palm,span:sample.span,confidence:sample.confidence}:null,now,valid);
   if(input)inputs.push({...input,finger});
  }
  return inputs;
 }
}
