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
 return {gap,entry:extended[0]&&folded.slice(1).every(Boolean)&&thumbOut&&gap>=.2&&gap<=2.6,otherFolded:folded.slice(1).every(Boolean),open:extended.every(Boolean),fist:sample.pose==='fist'||folded.every(Boolean),palm:sample.palm,span:sample.span};
}

// A stable L shape takes ownership before it changes the zoom. Opening the
// whole palm releases that ownership and lets navigation establish a new anchor.
export class HandZoom{
 constructor(){this.reset();}
 reset(){this.phase='idle';this.active=false;this.lastTime=-Infinity;this.lastValid=-Infinity;this.pendingSince=null;this.pendingSamples=0;this.uncertainSince=null;this.previous=null;this.filteredGap=null;this.acceptedGap=null;}
 result(factor=1,consumed=this.phase!=='idle'){return {consumed,active:this.active,factor};}
 anchor(geometry,now){this.previous={t:now,palm:{...geometry.palm},span:geometry.span,gap:geometry.gap};this.filteredGap=geometry.gap;this.acceptedGap=geometry.gap;}
 awaitOpen(){this.phase='await-open';this.active=false;this.previous=null;this.filteredGap=null;this.acceptedGap=null;this.pendingSince=null;this.pendingSamples=0;this.uncertainSince=null;}
 feed(sample,landmarks,now,enabled=true){
  if(!enabled){this.reset();return this.result();}
  if(!Number.isFinite(now)||now<=this.lastTime)return this.result();
  this.lastTime=now;
  const geometry=zoomGeometry(sample,landmarks);
  if(!geometry){
   this.previous=null;this.filteredGap=null;this.acceptedGap=null;this.pendingSince=null;this.pendingSamples=0;
   if(this.phase!=='idle'&&now-this.lastValid>250)this.awaitOpen();
   return this.result();
  }
  const gap=now-this.lastValid;this.lastValid=now;
  if(this.phase!=='idle'&&geometry.open){this.phase='idle';this.active=false;this.previous=null;this.filteredGap=null;this.acceptedGap=null;this.pendingSince=null;this.pendingSamples=0;this.uncertainSince=null;return this.result(1,true);}
  if(this.phase==='await-open')return this.result();
  if(this.phase!=='idle'&&geometry.fist){this.awaitOpen();return this.result();}
  if(this.phase!=='idle'&&gap>250){this.awaitOpen();return this.result();}
  if(!this.active){
   if(!geometry.entry){
    if(this.phase==='pending'){this.pendingSince=null;this.pendingSamples=0;this.uncertainSince??=now;if(now-this.uncertainSince>=180)this.awaitOpen();}
    return this.result();
   }
   this.phase='pending';this.uncertainSince=null;this.pendingSince??=now;this.pendingSamples++;
   if(now-this.pendingSince<120||this.pendingSamples<3)return this.result();
   this.phase='active';this.active=true;this.anchor(geometry,now);return this.result();
  }
  if(!geometry.otherFolded||geometry.gap>3.2){
   this.previous=null;this.filteredGap=null;this.acceptedGap=null;this.uncertainSince??=now;if(now-this.uncertainSince>=180)this.awaitOpen();return this.result();
  }
  this.uncertainSince=null;
  const previous=this.previous,scale=previous?geometry.span/previous.span:1;
  // A detector jump must establish a fresh baseline, not slam the zoom limit
  // or leave a backlog that keeps changing the view after the hand stops.
  if(!previous||zoomDistance2(geometry.palm,previous.palm)>.18||scale<.6||scale>1.6||Math.abs(geometry.gap-previous.gap)>.65){this.anchor(geometry,now);return this.result();}
  const elapsed=Math.max(1,now-previous.t),ease=1-Math.exp(-elapsed/45);
  this.filteredGap+=(geometry.gap-this.filteredGap)*ease;
  const delta=this.filteredGap-this.acceptedGap;let factor=1;
  if(Math.abs(delta)>=.012){factor=Math.exp(-1.35*delta);this.acceptedGap=this.filteredGap;}
  this.previous={t:now,palm:{...geometry.palm},span:geometry.span,gap:geometry.gap};
  return this.result(factor);
 }
}
