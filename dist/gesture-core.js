const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export const FINGER_RIPPLE_INTERVAL=300;
export const FINGER_TIPS=Object.freeze({thumb:4,index:8,middle:12,ring:16,pinky:20});
const tipDistance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,((a.z||0)-(b.z||0))*.4);
const sub3=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:(a.z||0)-(b.z||0)});
const dot3=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
const length3=v=>Math.hypot(v.x,v.y,v.z);
function palmFrame(p){
 const across=sub3(p[17],p[5]),size=length3(across),x={x:across.x/size,y:across.y/size,z:across.z/size};
 const up=sub3(p[9],p[0]),along=dot3(up,x),orth={x:up.x-x.x*along,y:up.y-x.y*along,z:up.z-x.z*along},n=length3(orth);
 if(size<.045||n<.015)return null;
 const y={x:orth.x/n,y:orth.y/n,z:orth.z/n},z={x:x.y*y.z-x.z*y.y,y:x.z*y.x-x.x*y.z,z:x.x*y.y-x.y*y.x};
 const origin=[0,5,9,13,17].reduce((a,i)=>({x:a.x+p[i].x/5,y:a.y+p[i].y/5,z:a.z+(p[i].z||0)/5}),{x:0,y:0,z:0});
 return tip=>{const d=sub3(tip,origin);return {x:dot3(d,x)/size,y:dot3(d,y)/size,z:dot3(d,z)/size};};
}
const localDistance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,(a.z-b.z)*.6);
export function describeHand(landmarks,confidence=1,handCount=1){
 if(handCount!==1||confidence<.75||!landmarks||landmarks.length!==21||landmarks.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))return null;
 const span=distance(landmarks[5],landmarks[17]);if(span<.045||span>.55)return null;
 const wrist=landmarks[0],tips=[8,12,16,20];
 const extended=tips.map(t=>distance(landmarks[t],wrist)>distance(landmarks[t-2],wrist)*1.16&&distance(landmarks[t],landmarks[t-3])>span*.65);
 const folded=tips.map(t=>distance(landmarks[t],wrist)<distance(landmarks[t-2],wrist)*1.18&&distance(landmarks[t],landmarks[t-3])<span*.90);
 const count=extended.filter(Boolean).length;
 const palm=[0,5,9,13,17].reduce((s,i)=>({x:s.x+landmarks[i].x/5,y:s.y+landmarks[i].y/5}),{x:0,y:0});
 const local=palmFrame(landmarks);if(!local)return null;
 const fingers=Object.fromEntries(Object.entries(FINGER_TIPS).map(([name,id])=>[name,{x:1-landmarks[id].x,y:landmarks[id].y,z:Number.isFinite(landmarks[id].z)?landmarks[id].z:0,local:local(landmarks[id])}]));
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

// Resample measured palm positions at display cadence. Interpolation stays
// between observations: no velocity extrapolation or post-release inertia.
export class HandNavigator{
 constructor(){this.reset();}
 reset(){this.previous=null;this.anchor=null;this.accepted=null;this.target={x:0,y:0};this.applied={x:0,y:0};this.motion={x:0,y:0};this.frames=[];this.interval=50;this.transport=0;this.lastSample=-1;this.lastArrival=-1;this.lastOpen=-1;this.missing=false;this.precisionUntil=-1;}
 feed(sample,now,receivedAt=now){
  if(!Number.isFinite(now)||now<=this.lastSample)return;
  if(!sample){
   if(!this.previous||now-this.lastSample>180)this.reset();else this.missing=true;
   return;
  }
  const allowed=sample.pose==='open'||(sample.pose==='neutral'&&this.previous&&now-this.lastOpen<=180);
  if(!allowed){this.reset();return;}
  let old=this.previous;
  const ratio=sample.span&&old?.span?sample.span/old.span:1;
  if(old&&(now-old.t>600||distance(sample.palm,old)>.18||ratio<.6||ratio>1.6||(this.missing&&distance(sample.palm,old)>.04))){this.reset();old=null;}
  this.missing=false;this.lastSample=now;this.lastArrival=Math.max(now,receivedAt);if(sample.pose==='open')this.lastOpen=now;
  this.previous={...sample.palm,t:now,span:sample.span};
  if(!old){this.anchor={...sample.palm};this.accepted={...sample.palm};this.frames=[{t:now,x:0,y:0}];return;}
  const dt=now-old.t;
  this.interval=this.frames.length===1?Math.min(120,Math.max(25,dt)):this.interval*.8+Math.min(160,Math.max(16,dt))*.2;
  this.transport=this.transport*.75+Math.min(160,Math.max(0,receivedAt-now))*.25;
  this.motion={x:(sample.palm.x-old.x)/Math.max(.025,dt/1000),y:(sample.palm.y-old.y)/Math.max(.025,dt/1000)};
  if(distance(sample.palm,this.accepted)>=(now<this.precisionUntil?.0007:.0018)){this.precisionUntil=now+200;this.accepted={...sample.palm};this.target={x:sample.palm.x-this.anchor.x,y:sample.palm.y-this.anchor.y};}
  this.frames.push({t:now,...this.target});if(this.frames.length>16)this.frames.shift();
 }
 step(now){
  if(!this.frames.length)return {dx:0,dy:0};
  const time=now-Math.min(220,Math.max(28,this.interval+this.transport));
  while(this.frames.length>2&&this.frames[1].t<=time)this.frames.shift();
  const a=this.frames[0],b=this.frames[1]||a,amount=b.t===a.t?1:Math.max(0,Math.min(1,(time-a.t)/(b.t-a.t)));
  let next={x:a.x+(b.x-a.x)*amount,y:a.y+(b.y-a.y)*amount};
  // The buffer can contain a more recent endpoint after a long paused frame.
  const last=this.frames.at(-1);if(time>=last.t)next={x:last.x,y:last.y};
  const delta={dx:next.x-this.applied.x,dy:next.y-this.applied.y};this.applied=next;return delta;
 }
}

// Fingertip motion is measured in a palm-local 3D frame: moving the whole hand
// does not stir particles. Up to five independent fingers are forwarded per sample.
// Recognition and reacquisition only establish anchors.
export class FingerParticleInput{
 constructor(){this.lastPulse={};this.reset();}
 reset(){this.tracks={};this.lastFrame=null;}
 get previous(){return Object.values(this.tracks)[0]?.previous||null;}
 feed(sample,now,enabled=true){
  if(!enabled||!sample||!Number.isFinite(now)||!Number.isFinite(sample.confidence)||sample.confidence<.75||!sample.palm||![sample.palm.x,sample.palm.y,sample.span].every(Number.isFinite)){this.reset();return [];}
  const old=this.lastFrame;if(old&&now<=old.t)return [];
  const ratio=old?sample.span/old.span:1;
  if(old&&(now-old.t>1200||distance(sample.palm,old.palm)>.25||ratio<.6||ratio>1.6))this.reset();
  this.lastFrame={t:now,palm:{...sample.palm},span:sample.span};
  const candidates=[];
  for(const finger of Object.keys(FINGER_TIPS)){
   const raw=sample.fingers?.[finger];
   if(!raw||![raw.x,raw.y].every(Number.isFinite)||raw.x<0||raw.x>1||raw.y<0||raw.y>1||!raw.local||!Object.values(raw.local).every(Number.isFinite)){delete this.tracks[finger];continue;}
   const p={x:raw.x,y:raw.y,z:Number.isFinite(raw.z)?raw.z:0,local:{...raw.local}},track=this.tracks[finger],previous=track?.previous;
   const dt=previous?(now-previous.t)/1000:0,travel=previous?tipDistance(p,previous):0;
   if(!previous||travel>Math.min(.35,Math.max(.18,dt*.75))){
    this.tracks[finger]={previous:{...p,t:now},point:{x:p.x,y:p.y,z:p.z},local:{...p.local},anchor:{...p.local},anchorTime:now};continue;
   }
   const ease=1-Math.exp(-dt/.045);
   for(const axis of ['x','y','z'])track.point[axis]+=(p[axis]-track.point[axis])*ease;
   track.previous={...p,t:now};
   for(const axis of ['x','y','z'])track.local[axis]+=(p.local[axis]-track.local[axis])*ease;
   const net=localDistance(track.local,track.anchor),localTravel=localDistance(p.local,previous.local);
   if(net>=.035&&localTravel>=Math.max(.0008,dt*.02)&&travel>=Math.max(.00015,dt*.004))candidates.push({...track.point,finger,motion:true,strength:Math.min(.95,.65+net*.3+localTravel/Math.max(.04,dt)*.015),net});
   else if(now-track.anchorTime>650){track.anchor={...track.local};track.anchorTime=now;}
  }
  const chosen=candidates.filter(p=>now-(this.lastPulse[p.finger]??-Infinity)>=FINGER_RIPPLE_INTERVAL).sort((a,b)=>b.net-a.net).slice(0,5);
  for(const input of chosen){this.lastPulse[input.finger]=now;const track=this.tracks[input.finger];track.anchor={...track.local};track.anchorTime=now;}
  return chosen.map(({net,...input})=>input);
 }
}
