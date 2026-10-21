export function decodeModel(item){
 if(item.kind!=='mesh3d'||item.format!=='xyz16-rgb8-normal8'||item.positionScale!==10000)throw new Error('Unsupported 3D surface format');
 const binary=atob(item.data),bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));if(bytes.length!==item.count*12)throw new Error('3D surface byte count mismatch');
 const v=new DataView(bytes.buffer),points=[];
 for(let i=0;i<item.count;i++){const o=i*12;points.push({x:v.getInt16(o,true)/10000,y:v.getInt16(o+2,true)/10000,z:v.getInt16(o+4,true)/10000,r:bytes[o+6],g:bytes[o+7],b:bytes[o+8],nx:v.getInt8(o+9)/127,ny:v.getInt8(o+10)/127,nz:v.getInt8(o+11)/127});}
 return points;
}
// Column-major yaw / pitch rotation, shared by WebGL and the Canvas fallback.
export function modelRotation(yaw,pitch=0,out=new Float32Array(9)){
 const c=Math.cos(yaw),s=Math.sin(yaw),a=Math.cos(pitch),b=Math.sin(pitch);
 out.set([c,b*s,-a*s,0,a,b,s,-b*c,a*c]);return out;
}
export function rotateModel(p,m,out={}){out.x=m[0]*p.x+m[3]*p.y+m[6]*p.z;out.y=m[1]*p.x+m[4]*p.y+m[7]*p.z;out.z=m[2]*p.x+m[5]*p.y+m[8]*p.z;return out;}
export function modelProjection(p){return 1/(1+p.z*.85);}
export function posterLight(normal){
 const diffuse=Math.max(0,-normal.x*.35-normal.y*.48-normal.z*.8),rim=Math.pow(1-Math.abs(normal.z),2);
 return {brightness:.22+diffuse*1.15,rim};
}
