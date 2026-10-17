const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function describeHand(landmarks,confidence=1,handCount=1){
 if(handCount!==1||confidence<.75||!landmarks||landmarks.length!==21||landmarks.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))return null;
 const span=distance(landmarks[5],landmarks[17]);if(span<.045||span>.55)return null;
 const wrist=landmarks[0];
 const extended=[8,12,16,20].map(t=>distance(landmarks[t],wrist)>distance(landmarks[t-2],wrist)*1.16&&distance(landmarks[t],landmarks[t-3])>span*.65);
 const count=extended.filter(Boolean).length;
 const palm=[0,5,9,13,17].reduce((s,i)=>({x:s.x+landmarks[i].x/5,y:s.y+landmarks[i].y/5}),{x:0,y:0});
 return {pose:count>=3?'open':extended[0]&&count===1?'point':'neutral',palm:{x:1-palm.x,y:palm.y},tip:{x:1-landmarks[8].x,y:landmarks[8].y},confidence,span};
}
export function circleMetrics(points){
 if(points.length<16)return null;
 const minX=Math.min(...points.map(p=>p.x)),maxX=Math.max(...points.map(p=>p.x)),minY=Math.min(...points.map(p=>p.y)),maxY=Math.max(...points.map(p=>p.y));
 const rx=(maxX-minX)/2,ry=(maxY-minY)/2;if(rx<.055||ry<.055||rx>.28||ry>.28||rx/ry<.55||rx/ry>1.8)return null;
 const cx=(maxX+minX)/2,cy=(maxY+minY)/2;
 const radii=points.map(p=>Math.hypot((p.x-cx)/rx,(p.y-cy)/ry)),mean=radii.reduce((s,r)=>s+r,0)/radii.length;
 const variation=Math.sqrt(radii.reduce((s,r)=>s+(r-mean)**2,0)/radii.length)/mean;
 let angle=0,total=0,path=0;for(let i=1;i<points.length;i++){const a=Math.atan2((points[i-1].y-cy)/ry,(points[i-1].x-cx)/rx),b=Math.atan2((points[i].y-cy)/ry,(points[i].x-cx)/rx);const d=Math.atan2(Math.sin(b-a),Math.cos(b-a));angle+=d;total+=Math.abs(d);path+=distance(points[i],points[i-1]);}
 const closure=distance(points[0],points.at(-1))/Math.min(rx,ry);
 return {variation,angle,consistency:Math.abs(angle)/Math.max(.001,total),closure,path,radius:(rx+ry)/2,center:{x:cx,y:cy},complete:variation<.28&&Math.abs(angle)>5.35&&Math.abs(angle)<7.5&&Math.abs(angle)/Math.max(.001,total)>.82&&closure<.6&&path>Math.min(rx,ry)*5};
}
export class GestureMachine{
 constructor(){this.state='IDLE';this.pose='neutral';this.since=0;this.lastTime=-1;this.lastSeen=-1;this.history=[];this.cooldownUntil=0;this.progress=0;this.neutralSince=null;this.lastSelection=null;this.selectionSince=0;}
 reset(now=0,state='IDLE'){this.state=state;this.since=now;this.history=[];this.progress=0;this.pose='neutral';this.neutralSince=null;}
 update(sample,now,{selected=null,busy=false,enabled=true}={}){
  if(now<=this.lastTime)return null;const gap=this.lastTime>=0?now-this.lastTime:0;this.lastTime=now;
  if(selected!==this.lastSelection){this.lastSelection=selected;this.selectionSince=now;this.reset(now);}
  if(!enabled||busy){this.reset(now,'BLOCKED');return null;}
  if(this.state==='BLOCKED')this.reset(now);
  if(now<this.cooldownUntil){this.state='COOLDOWN';this.progress=0;return null;}
  if(this.state==='COOLDOWN')this.reset(now,this.needsNeutral?'WAIT_NEUTRAL':'IDLE');
  if(!sample){if(now-this.lastSeen>180)this.reset(now,'LOST');return null;}
  if(gap>500&&this.state!=='WAIT_NEUTRAL')this.reset(now);
  this.lastSeen=now;
  if(this.state==='WAIT_NEUTRAL'){if(sample.pose==='neutral'){this.neutralSince??=now;if(now-this.neutralSince>350){this.needsNeutral=false;this.reset(now);}}else this.neutralSince=null;return null;}
  if(sample.pose!=='open'&&sample.pose!=='point'){this.reset(now);return null;}
  if(sample.pose!==this.pose||['IDLE','LOST'].includes(this.state)){this.pose=sample.pose;this.since=now;this.state='ARMING';this.history=[];return null;}
  if(now-this.since<380){this.progress=(now-this.since)/380*.12;return null;}
  const point=sample.pose==='open'?sample.palm:sample.tip;
  if(this.history.length&&distance(point,this.history.at(-1))>.30){this.reset(now);return null;}
  this.state=sample.pose==='open'?'WAVE_READY':'CIRCLE_TRACKING';
  this.history.push({...point,t:now});
  const windowMs=sample.pose==='open'?700:4500;this.history=this.history.filter(p=>now-p.t<=windowMs);
  if(sample.pose==='open'&&this.history.length>=3){const a=this.history[0],b=this.history.at(-1),duration=(b.t-a.t)/1000,dx=b.x-a.x,dy=b.y-a.y,travel=Math.hypot(dx,dy);let path=0;for(let i=1;i<this.history.length;i++)path+=distance(this.history[i],this.history[i-1]);if(duration>=.16&&travel>.13&&travel/duration>.42&&travel/Math.max(path,.001)>.83){this.cooldownUntil=now+850;this.state='COOLDOWN';this.needsNeutral=false;this.history=[];return {type:'wave',x:b.x,y:b.y,dx:dx/duration,dy:dy/duration};}}
  if(sample.pose==='point'){
   if(selected===null||now-this.selectionSince<750){this.history=[];this.progress=0;return null;}
   const duration=this.history.length?now-this.history[0].t:0;
   const metric=circleMetrics(this.history);this.progress=metric?Math.min(.95,Math.abs(metric.angle)/(Math.PI*2)):.12;
   if(metric?.complete&&duration>=850&&duration<=4500){this.cooldownUntil=now+3500;this.state='COOLDOWN';this.needsNeutral=true;this.history=[];this.progress=1;return {type:'circle',selected,metric};}
  }
  return null;
 }
}
