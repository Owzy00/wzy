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
 constructor(){this.state='IDLE';this.pose='neutral';this.since=0;this.lastTime=-1;this.lastSeen=-1;this.history=[];this.cooldownUntil=0;this.progress=0;this.lastSelection=null;this.selectionSince=0;this.disarm();}
 disarm(){this.armed=false;this.anchor=null;this.lastFist=-1;this.openSince=null;this.openSamples=0;this.fistSamples=0;}
 reset(now=0,state='IDLE'){this.state=state;this.since=now;this.history=[];this.progress=0;this.pose='neutral';this.disarm();}
 update(sample,now,{selected=null,busy=false,enabled=true}={}){
  if(now<=this.lastTime)return null;const gap=this.lastTime>=0?now-this.lastTime:0;this.lastTime=now;
  if(selected!==this.lastSelection){this.lastSelection=selected;this.selectionSince=now;this.reset(now);}
  if(!enabled||busy){this.reset(now,'BLOCKED');return null;}
  if(this.state==='BLOCKED')this.reset(now);
  if(now<this.cooldownUntil){this.state='COOLDOWN';this.progress=0;this.disarm();return null;}
  if(this.state==='COOLDOWN')this.reset(now);
  if(!sample){this.reset(now,'LOST');return null;}
  if(gap>500)this.reset(now);
  this.lastSeen=now;
  // A new or abruptly relocated hand must start a fresh fist-to-palm sequence.
  if(this.armed&&this.anchor){const ratio=sample.span&&this.anchor.span?sample.span/this.anchor.span:1;if(distance(sample.palm,this.anchor.palm)>.25||ratio<.55||ratio>1.8)this.reset(now);}
  if(sample.pose==='fist'){
   this.history=[];this.openSince=null;this.openSamples=0;this.lastFist=now;
   if(this.pose!=='fist'){this.pose='fist';this.since=now;this.fistSamples=0;}
   this.fistSamples++;
   if(this.armed||(now-this.since>=450&&this.fistSamples>=3)){
    this.armed=true;this.anchor={palm:{...sample.palm},span:sample.span};this.state='FIST_READY';this.progress=.65;
   }else{this.state='FIST_ARMING';this.progress=Math.min(.64,(now-this.since)/450*.65);}
   return null;
  }
  if(this.armed){
   if(now-this.lastFist>1800){this.reset(now);return null;}
   if(sample.pose==='open'){
    this.openSince??=now;this.openSamples++;this.state='OPENING';this.progress=.65+Math.min(1,(now-this.openSince)/180)*.35;
    if(now-this.openSince>=180&&this.openSamples>=2&&selected!==null&&now-this.selectionSince>=750){
     this.disarm();this.history=[];this.cooldownUntil=now+3500;this.state='COOLDOWN';this.progress=1;
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
  if(this.pose!=='open'||['IDLE','LOST'].includes(this.state)){this.pose='open';this.since=now;this.state='ARMING';this.history=[];return null;}
  if(now-this.since<380){this.progress=0;return null;}
  const point=sample.palm;if(this.history.length&&distance(point,this.history.at(-1))>.30){this.reset(now);return null;}
  this.state='WAVE_READY';this.progress=0;this.history.push({...point,t:now});this.history=this.history.filter(p=>now-p.t<=700);
  if(this.history.length>=3){const a=this.history[0],b=this.history.at(-1),duration=(b.t-a.t)/1000,dx=b.x-a.x,dy=b.y-a.y,travel=Math.hypot(dx,dy);let path=0;for(let i=1;i<this.history.length;i++)path+=distance(this.history[i],this.history[i-1]);if(duration>=.16&&travel>.13&&travel/duration>.42&&travel/Math.max(path,.001)>.83){this.cooldownUntil=now+850;this.state='COOLDOWN';this.history=[];return {type:'wave',x:b.x,y:b.y,dx:dx/duration,dy:dy/duration};}}
  return null;
 }
}
