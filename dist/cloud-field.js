// A folded, advected sheet, shared by the GPU renderer and Canvas fallback.
// Coordinates belong only to the visual cloud, never to the astronomical catalogue.
const cloudClamp=x=>Math.max(0,Math.min(1,x));
const cloudSmooth=x=>{x=cloudClamp(x);return x*x*(3-2*x);};
export function cloudSettle(seed,formation){const start=.08+seed.y*.18+seed.z*.08,end=.66+seed.y*.30;return cloudSmooth((formation-start)/(end-start));}
export function cloudPresence(amount){return cloudSmooth(amount/.10);}
export function cloudField(seed,time,motion=1,out={}){
 const t=time*.75*motion,u=(seed.x-.5)*2.6,v=(seed.y-.5)*1.7;
 const a=u*2.8+v*1.9-t*.94,b=v*5.1-u*1.65+t*.71;
 out.x=u*.64+Math.sin(a)*.22+Math.sin(b)*.11+Math.sin(v*8.2+t*1.1)*.045;
 out.y=v*.43+Math.sin(u*3.7+v*.8-t*.82)*.23+Math.sin(b)*.12;
 out.z=Math.cos(a)*.19+Math.sin(v*4.3+t*.67)*.12+(seed.z-.5)*.11;
 return out;
}
export function cloudPose(target,seed,time,formation,release,loose=false,motion=1,out={}){
 cloudField(seed,time,motion,out);const settle=cloudSettle(seed,formation),f=loose?settle*.18:settle;
 const arc=Math.sin(f*Math.PI)*(1-release)*motion;
 out.x=out.x*(1-f)+target.x*f+Math.sin(seed.y*6.28+time*.43)*arc*.12;
 out.y=out.y*(1-f)+target.y*f-Math.cos(seed.x*6.28-time*.38)*arc*.09;
 out.z=out.z*(1-f)+target.z*f;
 const u=(seed.x-.5)*2.6,v=(seed.y-.5)*1.7,t=(time+4)*.75*motion;
 const a=u*2.8+v*1.9-t*.94,b=v*5.1-u*1.65+t*.71;
 const ex=u*.83+Math.sin(a)*.27+Math.sin(b)*.16,ey=v*.63+Math.sin(u*3.7+v*.8-t*.82)*.29;
 out.x=out.x*(1-release)+ex*release+Math.sin(release*Math.PI)*Math.sin(seed.y*6.28)*.14*motion;
 out.y=out.y*(1-release)+ey*release-Math.sin(release*Math.PI)*.15*motion;
 return out;
}
export const CLOUD_GLSL=`
float cloudSettle(vec3 seed,float formation){return smoothstep(.08+seed.y*.18+seed.z*.08,.66+seed.y*.30,formation);}
vec3 cloudField(vec3 seed,float time,float motion){
 float t=time*.75*motion,u=(seed.x-.5)*2.6,v=(seed.y-.5)*1.7;
 float a=u*2.8+v*1.9-t*.94,b=v*5.1-u*1.65+t*.71;
 return vec3(u*.64+sin(a)*.22+sin(b)*.11+sin(v*8.2+t*1.1)*.045,
 v*.43+sin(u*3.7+v*.8-t*.82)*.23+sin(b)*.12,
 cos(a)*.19+sin(v*4.3+t*.67)*.12+(seed.z-.5)*.11);
}
vec3 cloudPose(vec3 target,vec3 seed,float time,float formation,float release,float loose,float motion){
 float settle=cloudSettle(seed,formation),f=mix(settle,settle*.18,loose);
 vec3 p=mix(cloudField(seed,time,motion),target,f);
 float arc=sin(f*3.14159265)*(1.-release)*motion;
 p.xy+=vec2(sin(seed.y*6.28+time*.43)*.12,-cos(seed.x*6.28-time*.38)*.09)*arc;
 float u=(seed.x-.5)*2.6,v=(seed.y-.5)*1.7,t=(time+4.)*.75*motion;
 float a=u*2.8+v*1.9-t*.94,b=v*5.1-u*1.65+t*.71;
 vec2 escape=vec2(u*.83+sin(a)*.27+sin(b)*.16,v*.63+sin(u*3.7+v*.8-t*.82)*.29);
 p.xy=mix(p.xy,escape,release)+sin(release*3.14159265)*vec2(sin(seed.y*6.28)*.14,-.15)*motion;
 return p;
}`;
