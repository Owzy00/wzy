const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function describeHand(landmarks,confidence=1,handCount=1){
 if(handCount!==1||confidence<.75||!landmarks||landmarks.length!==21||landmarks.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))return null;
 const span=distance(landmarks[5],landmarks[17]);if(span<.045||span>.55)return null;
 const wrist=landmarks[0],tips=[8,12,16,20];
 const extended=tips.map(t=>distance(landmarks[t],wrist)>distance(landmarks[t-2],wrist)*1.16&&distance(landmarks[t],landmarks[t-3])>span*.65);
 const folded=tips.map(t=>distance(landmarks[t],wrist)<distance(landmarks[t-2],wrist)*1.18&&distance(landmarks[t],landmarks[t-3])<span*.90);
 const count=extended.filter(Boolean).length;
 const palm=[0,5,9,13,17].reduce((s,i)=>({x:s.x+landmarks[i].x/5,y:s.y+landmarks[i].y/5}),{x:0,y:0});
 return {pose:count>=3?'open':count===0&&folded.every(Boolean)?'fist':extended[0]&&count===1?'point':'neutral',palm:{x:1-palm.x,y:palm.y},tip:{x:1-landmarks[8].x,y:landmarks[8].y},confidence,span};
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

// Particle input uses measured displacement, rather than a fast-frame velocity gate.
// Small, consistent motion can emit at low camera rates; jitter/reacquisition cannot.
export class HandParticleInput{
 constructor(){this.reset();}
 reset(){this.previous=null;this.point=null;this.anchor=null;this.lastPulse=-Infinity;}
 feed(sample,now,enabled=true){
  const p=sample?.palm;
  if(!enabled||!p||!Number.isFinite(now)||!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.x>1||p.y<0||p.y>1||sample.confidence<.75){this.reset();return null;}
  const old=this.previous;if(old&&now<=old.t)return null;
  const dt=old?(now-old.t)/1000:0,travel=old?distance(p,old):0,ratio=sample.span&&old?.span?sample.span/old.span:1;
  this.previous={x:p.x,y:p.y,t:now,span:sample.span};
  if(!old||dt>1.2||travel>Math.min(.42,Math.max(.18,dt*.9))||ratio<.6||ratio>1.6){
   this.point={x:p.x,y:p.y};this.anchor={...this.point,t:now};return {...this.point,strength:0};
  }
  const ease=1-Math.exp(-dt/.06);this.point.x+=(p.x-this.point.x)*ease;this.point.y+=(p.y-this.point.y)*ease;
  const net=distance(this.point,this.anchor);let strength=0;
  if(net>=.008&&now-this.lastPulse>=280){strength=Math.min(1.4,.7+travel/Math.max(.04,dt)*1.5+net*1.8);this.lastPulse=now;this.anchor={...this.point,t:now};}
  else if(now-this.anchor.t>700)this.anchor={...this.point,t:now};
  return {...this.point,strength};
 }
}
