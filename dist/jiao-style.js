const jiaoSmooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
// Each contour particle repeatedly leaves its own silhouette anchor. Staggered
// lifetimes fade to zero before recycling, keeping the face and folds intact.
export function jiaoFringePose(target,seed,time,emission,motion=1,out={}){
 const life=3+seed.z*2.2,cycle=time*motion/life+seed.x*.79+seed.y*.21,phase=cycle-Math.floor(cycle);
 const length=Math.hypot(emission.x,emission.y),nx=emission.x/Math.max(.0001,length),ny=emission.y/Math.max(.0001,length);
 const travel=.003+(Math.min(.13,length)*.9+.024)*phase,swirl=Math.sin(phase*4.5+seed.z*9)*(.002+phase*.010);
 out.x=target.x-emission.x+nx*travel-ny*swirl;
 out.y=target.y-emission.y+ny*travel+nx*swirl-phase*phase*.012;
 out.z=target.z-phase*.012;
 out.alpha=jiaoSmooth(phase/.08)*(1-jiaoSmooth((phase-.26)/.74));out.phase=phase;return out;
}
export const JIAO_FRINGE_GLSL=`
vec4 jiaoFringePose(vec3 target,vec3 seed,float time,vec2 emission,float motion){
 float phase=fract(time*motion/(3.+seed.z*2.2)+seed.x*.79+seed.y*.21);
 float len=length(emission);vec2 normal=emission/max(.0001,len);
 float travel=.003+(min(.13,len)*.9+.024)*phase,swirl=sin(phase*4.5+seed.z*9.)*(.002+phase*.010);
 vec2 xy=target.xy-emission+normal*travel+vec2(-normal.y,normal.x)*swirl-vec2(0.,phase*phase*.012);
 float alpha=smoothstep(0.,.08,phase)*(1.-smoothstep(.26,1.,phase));
 return vec4(xy,target.z-phase*.012,alpha);
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
