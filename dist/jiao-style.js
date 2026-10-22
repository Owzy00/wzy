const jiaoSmooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
export const jiaoSmokeLife=seed=>7.5+seed.z*3.5;
// Two scales of evolving eddies carry neighboring surface grains together.
// Small outward release keeps their initial path attached to the silhouette.
export function jiaoFringePose(target,seed,time,emission,motion=1,out={}){
 const clock=time*motion,life=jiaoSmokeLife(seed),cycle=clock/life+seed.x*.79+seed.y*.21,phase=cycle-Math.floor(cycle);
 const length=Math.hypot(emission.x,emission.y),nx=emission.x/Math.max(.0001,length),ny=emission.y/Math.max(.0001,length);
 if(length<.0001){out.x=target.x;out.y=target.y;out.z=target.z;out.alpha=1;out.phase=phase;return out;}
 const age=Math.max(0,phase-.14)*life,step=age/6,speed=.85+seed.y*.25;
 let x=target.x,y=target.y;
 for(let i=0;i<6;i++){
  const t=clock-age+step*(i+.5),a=x*11+t*.16,b=y*11-t*.13,c=x*25-t*.21,d=y*25+t*.18,ramp=jiaoSmooth(step*(i+.5)/1.8);
  const drift=Math.sin(target.y*9+target.x*6+t*.23)*.006;
  const vx=Math.sin(a)*Math.cos(b)*.025+Math.sin(c)*Math.cos(d)*.008+nx*.004-ny*drift;
  const vy=-Math.cos(a)*Math.sin(b)*.025-Math.cos(c)*Math.sin(d)*.008+ny*.004+nx*drift-.0015;
  x+=vx*step*ramp*speed;y+=vy*step*ramp*speed;
  const inward=Math.min(0,(x-target.x)*nx+(y-target.y)*ny);x-=nx*inward;y-=ny*inward;
 }
 out.x=x;out.y=y;out.z=target.z-Math.min(.012,age*.0012*jiaoSmooth(age/1.8));
 out.alpha=jiaoSmooth(phase/.04)*(1-jiaoSmooth((phase-.45)/.55));out.phase=phase;return out;
}
export const JIAO_FRINGE_GLSL=`
vec4 jiaoFringePose(vec3 target,vec3 seed,float time,vec2 emission,float motion){
 float len=length(emission);if(len<.0001)return vec4(target,1.);
 float clock=time*motion,life=7.5+seed.z*3.5,phase=fract(clock/life+seed.x*.79+seed.y*.21);
 vec2 normal=emission/len,xy=target.xy;float age=max(0.,phase-.14)*life,dt=age/6.,speed=.85+seed.y*.25;
 for(int i=0;i<6;i++){
  float t=clock-age+dt*(float(i)+.5),a=xy.x*11.+t*.16,b=xy.y*11.-t*.13,c=xy.x*25.-t*.21,d=xy.y*25.+t*.18,ramp=smoothstep(0.,1.8,dt*(float(i)+.5));
  float drift=sin(target.y*9.+target.x*6.+t*.23)*.006;
  vec2 v=vec2(sin(a)*cos(b)*.025+sin(c)*cos(d)*.008,-cos(a)*sin(b)*.025-cos(c)*sin(d)*.008)+normal*.004+vec2(-normal.y,normal.x)*drift-vec2(0.,.0015);
  xy+=v*dt*ramp*speed;float inward=min(0.,dot(xy-target.xy,normal));xy-=normal*inward;
 }
 float alpha=smoothstep(0.,.04,phase)*(1.-smoothstep(.45,1.,phase));
 return vec4(xy,target.z-min(.012,age*.0012*smoothstep(0.,1.8,age)),alpha);
}`;

// Gesture locations / cooldowns are unchanged. Only this poster's visual wake
// becomes a localized pair of counter-rotating puffs instead of a radial ring.
export function prepareSmokeWaves(ripples,now,width,height,animationStarted=0){
 const dim=Math.min(width,height),waves=[];
 for(const r of ripples.slice(-5)){
  const age=(now-r.time)/1000,hand=(r.spread||1)<1,life=hand?1.35:2.5;
  if(age<=0||age>=life)continue;
  const angle=Math.sin(r.x*12.7+r.y*39.1+(r.time-animationStarted)*.00013)*Math.PI,reach=hand?.052:.085;
  waves.push({x:r.x*width,y:r.y*height,age,dim,reach,cos:Math.cos(angle),sin:Math.sin(angle),
   force:Math.min(1.4,r.strength)*(hand?.78:1)*jiaoSmooth(age/.12)*Math.exp(-age*.55)*(1-jiaoSmooth((age-(hand?1:2.1))/(hand?.35:.4)))});
 }
 return waves;
}
export function smokeDisplacement(x,y,waves,limit,out={}){
 let dx=0,dy=0;
 for(const wave of waves){
  const qx=(x-wave.x)/wave.dim,qy=(y-wave.y)/wave.dim;
  if(qx*qx+qy*qy>(wave.reach*3.5)**2)continue;
  const ox=qx*wave.cos+qy*wave.sin,oy=-qx*wave.sin+qy*wave.cos,dt=wave.age/4;
  let px=ox,py=oy;
  for(let i=0;i<4;i++){
   const t=dt*(i+.5),r=wave.reach*(.75+t*.28),ax=px-r*.35,ay=py+r*.15,bx=px+r*.55,by=py-r*.28;
   const a=Math.exp(-(ax*ax+ay*ay)/(r*r)),b=Math.exp(-(bx*bx+by*by)/(r*r*.49)),e=Math.exp(-(px*px+py*py)/(r*r*1.96)),ramp=jiaoSmooth(t/.35);
   px+=(-ay*a*2.6+by*b*1.9+px*e*.32)*dt*ramp;
   py+=( ax*a*2.6-bx*b*1.9+py*e*.32-.007*e)*dt*ramp;
  }
  const sx=(px-ox)*wave.force,sy=(py-oy)*wave.force;
  dx+=(sx*wave.cos-sy*wave.sin)*wave.dim;dy+=(sx*wave.sin+sy*wave.cos)*wave.dim;
 }
 const scale=Math.min(1,limit/Math.max(.001,Math.hypot(dx,dy)));out.x=dx*scale;out.y=dy*scale;return out;
}
export const JIAO_SMOKE_GLSL=`
vec2 smokeWake(vec2 p,vec4 ripple,float spread,vec2 viewport,float clock){
 float hand=spread<1.?1.:0.,life=mix(2.5,1.35,hand),age=ripple.z;
 if(ripple.w<.001||age<=0.||age>=life)return vec2(0.);
 float dim=min(viewport.x,viewport.y),reach=mix(.085,.052,hand);
 vec2 q=(p-ripple.xy*viewport)/dim;if(dot(q,q)>reach*reach*12.25)return vec2(0.);
 float angle=sin(dot(ripple.xy,vec2(12.7,39.1))+(clock-age)*.13)*3.14159265,cs=cos(angle),sn=sin(angle);
 vec2 origin=vec2(q.x*cs+q.y*sn,-q.x*sn+q.y*cs),xy=origin;float dt=age/4.;
 for(int i=0;i<4;i++){
  float t=dt*(float(i)+.5),r=reach*(.75+t*.28),ramp=smoothstep(0.,.35,t);
  vec2 a=xy-vec2(r*.35,-r*.15),b=xy-vec2(-r*.55,r*.28);
  float ga=exp(-dot(a,a)/(r*r)),gb=exp(-dot(b,b)/(r*r*.49)),e=exp(-dot(xy,xy)/(r*r*1.96));
  xy+=(vec2(-a.y,a.x)*ga*2.6-vec2(-b.y,b.x)*gb*1.9+xy*e*.32-vec2(0.,.007*e))*dt*ramp;
 }
 float force=min(1.4,ripple.w)*mix(1.,.78,hand)*smoothstep(0.,.12,age)*exp(-age*.55)*(1.-smoothstep(mix(2.1,1.,hand),life,age));
 vec2 d=(xy-origin)*force;return vec2(d.x*cs-d.y*sn,d.x*sn+d.y*cs)*dim;
}`;
export function jiaoPresence(formation,release=0){return jiaoSmooth((formation-.12)/.64)*(1-jiaoSmooth(release));}
// Fine dotted orbital arcs behind this one poster figure. These never
// alter the celestial catalogue, navigation, or another mansion's appearance.
export function jiaoOrbit(u,time,layer=0,motion=1,out={}){
 const angle=u*Math.PI*2+time*.10*motion,tilt=-.38+layer*.19+Math.sin(time*.27)*.025*motion;
 const x=Math.cos(angle)*(.36+layer*.035),y=Math.sin(angle)*(.12+layer*.024);
 out.x=x*Math.cos(tilt)-y*Math.sin(tilt);
 out.y=x*Math.sin(tilt)+y*Math.cos(tilt)-.32+layer*.20;
 return out;
}
export function drawJiaoAtmosphere(c,l,time,formation,release,pointer={x:0,y:0},reduced=false){
 const presence=jiaoPresence(formation,release);c.clearRect(0,0,l.width,l.height);if(presence<.001)return;
 const motion=reduced?.18:1,p={};c.save();c.translate(l.cx+pointer.x*46,l.cy+pointer.y*16);c.scale(l.size,l.size);
 c.lineWidth=.00065;c.setLineDash([.0014,.004]);
 for(let k=0;k<4;k++){
  c.strokeStyle=k%2?'#a8c4da':'#93dcd6';c.globalAlpha=presence*(k%2?.22:.31);c.lineDashOffset=-time*.014*motion;
  c.beginPath();for(let i=0;i<=140;i++){jiaoOrbit(i/140,time,k,motion,p);if(i)c.lineTo(p.x,p.y);else c.moveTo(p.x,p.y);}c.stroke();
 }
 c.restore();
}
