const jiaoSmooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
export const jiaoSmokeLife=seed=>7.5+seed.z*3.5;
// Integrate a shared, slowly evolving curl field from each real surface sample.
// Neighboring grains share eddies; release starts at rest without a gap.
export function jiaoFringePose(target,seed,time,emission,motion=1,out={}){
 const clock=time*motion,life=jiaoSmokeLife(seed),cycle=clock/life+seed.x*.79+seed.y*.21,phase=cycle-Math.floor(cycle);
 const length=Math.hypot(emission.x,emission.y),nx=emission.x/Math.max(.0001,length),ny=emission.y/Math.max(.0001,length);
 if(length<.0001){out.x=target.x;out.y=target.y;out.z=target.z;out.alpha=1;out.phase=phase;return out;}
 const age=Math.max(0,phase-.14)*life,step=age/4,speed=.85+seed.y*.25;
 let x=target.x,y=target.y;
 if(length>.0001)for(let i=0;i<4;i++){
  const t=clock-age+step*(i+.5),a=x*18+t*.10,b=y*14-t*.08,ramp=jiaoSmooth(step*(i+.5)/1.8);
  const drift=Math.sin(target.y*12+target.x*5+t*.14)*.003;
  const vx=Math.sin(a)*Math.cos(b)*.014+nx*.005-ny*drift;
  const vy=-Math.cos(a)*Math.sin(b)*.018+ny*.005+nx*drift-.0045;
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
 vec2 normal=emission/len,xy=target.xy;float age=max(0.,phase-.14)*life,dt=age/4.,speed=.85+seed.y*.25;
 for(int i=0;i<4;i++){
  float t=clock-age+dt*(float(i)+.5),a=xy.x*18.+t*.10,b=xy.y*14.-t*.08,ramp=smoothstep(0.,1.8,dt*(float(i)+.5));
  float drift=sin(target.y*12.+target.x*5.+t*.14)*.003;
  vec2 v=vec2(sin(a)*cos(b)*.014,-cos(a)*sin(b)*.018)+normal*.005+vec2(-normal.y,normal.x)*drift-vec2(0.,.0045);
  xy+=v*dt*ramp*speed;float inward=min(0.,dot(xy-target.xy,normal));xy-=normal*inward;
 }
 float alpha=smoothstep(0.,.04,phase)*(1.-smoothstep(.45,1.,phase));
 return vec4(xy,target.z-min(.012,age*.0012*smoothstep(0.,1.8,age)),alpha);
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
