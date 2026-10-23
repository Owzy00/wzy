const zoomDistance2=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const zoomDistance3=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,((a.z||0)-(b.z||0))*.4);
function zoomGeometry(sample,points){
 if(!sample||!Number.isFinite(sample.confidence)||sample.confidence<.75||!sample.palm||![sample.palm.x,sample.palm.y,sample.span].every(Number.isFinite)||sample.span<.045||sample.span>.55||sample.handCount>1)return null;
 if(!points||points.length!==21||points.some(p=>!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)||(p.z!==undefined&&!Number.isFinite(p.z))))return null;
 if([4,8].some(id=>points[id].x<0||points[id].x>1||points[id].y<0||points[id].y>1))return null;
 const width=zoomDistance2(points[5],points[17]),depthWidth=zoomDistance3(points[5],points[17]);if(width<.045||depthWidth<.045)return null;
 const extended=[8,12,16,20].map(id=>zoomDistance2(points[id],points[0])>zoomDistance2(points[id-2],points[0])*1.16&&zoomDistance2(points[id],points[id-3])>width*.65);
 const folded=[8,12,16,20].map(id=>zoomDistance2(points[id],points[0])<zoomDistance2(points[id-2],points[0])*1.18&&zoomDistance2(points[id],points[id-3])<width*.90);
 const gap=zoomDistance3(points[4],points[8])/depthWidth;
 const thumbOut=zoomDistance2(points[4],points[2])>=width*.35&&zoomDistance2(points[4],points[5])>=width*.50;
 return {gap,entry:extended[0]&&folded.slice(1).every(Boolean)&&thumbOut&&gap>=.2&&gap<=2.6,otherFolded:folded.slice(1).every(Boolean),open:extended.every(Boolean),fist:folded.every(Boolean)&&zoomDistance2(points[8],points[5])<width*.55&&zoomDistance2(points[4],points[5])<width*.65,palm:sample.palm,span:sample.span};
}

// A stable L shape takes ownership before it changes the zoom. Opening the
// whole palm releases that ownership and lets navigation establish a new anchor.
export class HandZoom{
 constructor(){this.reset();}
 reset(){this.phase='idle';this.active=false;this.lastTime=-Infinity;this.lastValid=-Infinity;this.pendingSince=null;this.pendingSamples=0;this.previous=null;this.acceptedGap=null;this.direction=0;this.clearOutput();}
 clearOutput(){this.frames=[];this.targetLog=0;this.appliedLog=0;this.interval=50;this.lastArrival=-Infinity;this.lastStep=-Infinity;this.outputSamples=0;}
 result(factor=1,consumed=this.phase!=='idle'){return {consumed,active:this.active,factor};}
 anchor(geometry,now,arrived=now){this.previous={t:now,palm:{...geometry.palm},span:geometry.span,gap:geometry.gap};this.acceptedGap=geometry.gap;this.direction=0;this.clearOutput();this.lastArrival=arrived;this.frames=[{t:arrived,log:0}];}
 awaitOpen(){this.phase='await-open';this.active=false;this.previous=null;this.acceptedGap=null;this.pendingSince=null;this.pendingSamples=0;this.direction=0;this.clearOutput();}
 feed(sample,landmarks,now,enabled=true,receivedAt=now){
  if(!enabled){this.reset();return this.result();}
  if(!Number.isFinite(now)||now<=this.lastTime)return this.result();
  this.lastTime=now;const geometry=zoomGeometry(sample,landmarks),arrival=Math.max(now,receivedAt);
  if(!geometry){this.previous=null;this.acceptedGap=null;this.pendingSince=null;this.pendingSamples=0;this.clearOutput();if(this.phase!=='idle'&&now-this.lastValid>250)this.awaitOpen();return this.result();}
  const gap=now-this.lastValid;this.lastValid=now;
  if(this.phase!=='idle'&&geometry.open){this.reset();this.lastTime=now;return this.result(1,true);}
  if(this.phase==='await-open')return this.result();
  if(this.phase!=='idle'&&geometry.fist){this.awaitOpen();return this.result();}
  if(this.phase!=='idle'&&gap>250){this.awaitOpen();return this.result();}
  if(!this.active){
   if(!geometry.entry){this.pendingSince=null;this.pendingSamples=0;return this.result();}
   this.phase='pending';this.pendingSince??=now;this.pendingSamples++;
   if(now-this.pendingSince<80||this.pendingSamples<2)return this.result();
   this.phase='active';this.active=true;this.anchor(geometry,now,arrival);return this.result();
  }
  // Once acquired, neutral movement of the other fingers cannot restart zoom.
  if(geometry.gap>3.2){this.previous=null;this.acceptedGap=null;this.clearOutput();return this.result();}
  const previous=this.previous,scale=previous?geometry.span/previous.span:1,elapsed=previous?Math.max(1,now-previous.t):1;
  // The same opening speed is accepted at either 10 Hz or 30 Hz. Isolated
  // impossible jumps establish a fresh baseline without a deferred zoom burst.
  if(!previous||zoomDistance2(geometry.palm,previous.palm)>.18||scale<.6||scale>1.6||Math.abs(geometry.gap-previous.gap)>.18+12*elapsed/1000){this.anchor(geometry,now,arrival);return this.result();}
  const delta=geometry.gap-this.acceptedGap,sign=Math.sign(delta);let log=0;
  // Confirm small changes cumulatively, then follow a real continuous opening
  // without quantizing every subsequent sample into the original dead zone.
  if(Math.abs(delta)>=.008||(sign===this.direction&&Math.abs(delta)>.0001)){
   this.direction=sign;log=-1.35*delta;this.acceptedGap=geometry.gap;this.targetLog+=log;
  }
  const interval=Math.min(160,Math.max(16,arrival-this.lastArrival));this.interval=this.outputSamples++?this.interval*.8+interval*.2:interval;this.lastArrival=arrival;
  this.frames.push({t:arrival,log:this.targetLog});if(this.frames.length>32)this.frames.shift();
  this.previous={t:now,palm:{...geometry.palm},span:geometry.span,gap:geometry.gap};
  return this.result(Math.exp(log));
 }
 step(now){
  if(!Number.isFinite(now)||now<=this.lastStep)return 1;this.lastStep=now;
  if(!this.active||!this.frames.length)return 1;
  if(now-this.lastArrival>Math.max(180,this.interval*2)){this.clearOutput();this.previous=null;this.acceptedGap=null;return 1;}
  const time=now-Math.min(140,Math.max(16,this.interval));
  while(this.frames.length>2&&this.frames[1].t<=time)this.frames.shift();
  const a=this.frames[0],b=this.frames[1]||a,u=b.t===a.t?1:Math.max(0,Math.min(1,(time-a.t)/(b.t-a.t)));
  const last=this.frames.at(-1),next=time>=last.t?last.log:a.log+(b.log-a.log)*u;
  const delta=next-this.appliedLog;this.appliedLog=next;return Math.exp(delta);
 }
}
