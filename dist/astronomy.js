export const TAU = Math.PI * 2;
export const RAD = Math.PI / 180;
export const clamp = (n,a,b) => Math.min(b,Math.max(a,n));
export const wrap = n => ((n % TAU) + TAU) % TAU;
export const deltaAngle = (a,b) => Math.atan2(Math.sin(a-b),Math.cos(a-b));
export function vector(ra,dec){const c=Math.cos(dec);return [c*Math.cos(ra),Math.sin(dec),c*Math.sin(ra)];}
export function centerOf(stars){const v=stars.reduce((s,p)=>{const a=vector(p.ra,p.dec);return s.map((x,i)=>x+a[i]);},[0,0,0]);return {ra:wrap(Math.atan2(v[2],v[0])),dec:Math.atan2(v[1],Math.hypot(v[0],v[2]))};}
export function projectSphere(ra,dec,camera,viewport){const d=deltaAngle(ra,camera.ra),c=Math.cos(dec),s=Math.sin(dec),cp=Math.cos(camera.dec),sp=Math.sin(camera.dec);const z=s*sp+c*cp*Math.cos(d);if(z<=.025)return null;const scale=viewport.h/2/Math.tan(camera.fov/2);return {x:viewport.cx-c*Math.sin(d)/z*scale,y:viewport.cy-(s*cp-c*sp*Math.cos(d))/z*scale,z};}
export function projectAtlas(ra,dec,camera,viewport){const scale=Math.min(viewport.w/TAU,viewport.h/Math.PI)*camera.zoom;return {x:viewport.cx-deltaAngle(ra,camera.ra)*scale,y:viewport.cy-(dec-camera.dec)*scale,z:1};}
export function formatRA(ra){const hours=wrap(ra)/TAU*24;return `${String(Math.floor(hours)).padStart(2,'0')}h ${String(Math.floor(hours%1*60)).padStart(2,'0')}m`;}
export function formatDec(dec){return `${dec>=0?'+':'−'}${Math.abs(dec/RAD).toFixed(1)}°`;}
export function segmentSamples(a,b,steps=12){const va=vector(a.ra,a.dec),vb=vector(b.ra,b.dec),dot=clamp(va.reduce((s,x,i)=>s+x*vb[i],0),-1,1),angle=Math.acos(dot);return Array.from({length:steps+1},(_,i)=>{const t=i/steps,s=Math.sin(angle),u=s<1e-9?1-t:Math.sin((1-t)*angle)/s,v=s<1e-9?t:Math.sin(t*angle)/s,p=va.map((x,k)=>u*x+v*vb[k]);return {ra:wrap(Math.atan2(p[2],p[0])),dec:Math.atan2(p[1],Math.hypot(p[0],p[2]))};});}
