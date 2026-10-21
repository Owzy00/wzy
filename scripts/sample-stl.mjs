import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';

// Offline, area-weighted sampling. The browser receives this small surface cloud,
// never the original multi-million-triangle STL.
export function sampleSTL(bytes,count=120000){
 if(bytes.length<84)throw new Error('STL header is incomplete');
 const faces=bytes.readUInt32LE(80);if(!faces||bytes.length!==84+faces*50)throw new Error('Expected a complete binary STL');
 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity],cdf=new Float64Array(faces);let area=0;
 const vertex=(face,v)=>Array.from({length:3},(_,d)=>bytes.readFloatLE(84+face*50+12+v*12+d*4));
 const cross=(a,b,c)=>{const u=b.map((x,i)=>x-a[i]),v=c.map((x,i)=>x-a[i]);return [u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];};
 for(let f=0;f<faces;f++){
  const vs=[vertex(f,0),vertex(f,1),vertex(f,2)];
  for(const p of vs)for(let d=0;d<3;d++){if(!Number.isFinite(p[d]))throw new Error('Non-finite STL vertex');min[d]=Math.min(min[d],p[d]);max[d]=Math.max(max[d],p[d]);}
  area+=Math.hypot(...cross(...vs))/2;cdf[f]=area;
 }
 if(!(area>0)||!(max[2]>min[2]))throw new Error('STL has no usable surface or height');
 const center=min.map((x,i)=>(x+max[i])/2),scale=.88/(max[2]-min[2]),data=Buffer.alloc(count*12);
 let face=0,random=0x28c0ffee;const rand=()=>{random^=random<<13;random^=random>>>17;random^=random<<5;return (random>>>0)/4294967296;};
 for(let i=0;i<count;i++){
  const target=(i+rand())/count*area;while(cdf[face]<target)face++;
  const vs=[vertex(face,0),vertex(face,1),vertex(face,2)],s=Math.sqrt(rand()),r=rand(),w=[1-s,s*(1-r),s*r];
  const raw=[0,1,2].map(d=>vs.reduce((sum,p,j)=>sum+p[d]*w[j],0)-center[d]);
  // STL is Z-up. Screen/world coordinates are X right, Y down, Z depth.
  const p=[raw[0]*scale,-raw[2]*scale,raw[1]*scale],n=cross(...vs),length=Math.hypot(...n),normal=[n[0]/length,-n[2]/length,n[1]/length];
  // An untextured STL has no original colors: this is the user's poster palette.
  const tone=Math.max(0,Math.min(1,.5+p[0]*1.7+normal[0]*.30)),a=tone<.36?[68,132,221]:tone>.67?[182,183,112]:[29,179,175],b=tone<.36?[180,213,248]:tone>.67?[250,239,186]:[158,236,220],mix=.25+rand()*.55;
  const o=i*12;for(let d=0;d<3;d++)data.writeInt16LE(Math.round(p[d]*10000),o+d*2);
  for(let d=0;d<3;d++){data[o+6+d]=Math.round(a[d]+(b[d]-a[d])*mix);data.writeInt8(Math.round(normal[d]*127),o+9+d);}
 }
 return {id:1,name:'亢',title:'亢金龙',pinyin:'Kang Jin Long',kind:'mesh3d',format:'xyz16-rgb8-normal8',positionScale:10000,count,data:data.toString('base64'),source:{file:'亢金龙.stl',sha256:createHash('sha256').update(bytes).digest('hex'),triangles:faces,bytes:bytes.length,bounds:{min,max},sampling:'deterministic stratified triangle-area sampling',colors:'procedural jade / ice-blue / pale-gold; STL has no texture'},rotation:{axis:'Y',front:'negative STL Y',up:'STL Z'}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const input=process.argv[2],output=process.argv[3]||'dist/data/kang-3d.json';if(!input)throw new Error('Usage: node scripts/sample-stl.mjs input.stl [output.json]');
 const item=sampleSTL(await readFile(input));await writeFile(output,JSON.stringify(item));console.log(JSON.stringify({output,triangles:item.source.triangles,points:item.count,bytes:Buffer.byteLength(JSON.stringify(item))}));
}
