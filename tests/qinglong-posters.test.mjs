import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {QINGLONG_POSTERS,createPosterLoader} from '../dist/qinglong-posters.js';
import {StatueStage,decodeCloud} from '../dist/particle-effects.js';
const names=['角','亢','氐','房','心','尾','箕'],files=[null,146,147,148,149,151,150];
test('six distinct poster clouds map to the correct Azure Dragon mansions, including Wei and Ji',async()=>{
 const hashes=new Set(),stage=new StatueStage();
 for(const spec of QINGLONG_POSTERS.slice(1)){
  const item=JSON.parse(await readFile(new URL('../dist/'+spec.url.split('?')[0].slice(2),import.meta.url),'utf8'));
  assert.equal(item.id,spec.id);assert.equal(item.name,names[spec.id]);assert.equal(item.title,spec.title);assert.equal(item.source,'Frame '+files[spec.id]+'.png');
  assert.equal(item.style,'qinglong-poster');assert.equal(item.count,96000);assert.equal(item.encoding,'base64-int16le-xyz-uint8-rgb/9bytes');assert.deepEqual(item.sourceSize,[707,1060]);
  assert.equal(Buffer.from(item.data,'base64').length,item.count*9);assert.equal(Buffer.from(item.edgeAlpha,'base64').length,item.count);
  hashes.add(createHash('sha256').update(item.data).digest('hex'));
  const points=decodeCloud(item),entry=stage.prepare(item),alpha=Buffer.from(item.edgeAlpha,'base64');
  assert.equal(entry.packed.count,144000);assert.equal(entry.points.length,96000);
  assert.equal(stage.prepared.get('qinglong-poster:'+item.id),entry);assert.equal(stage.prepare(item),entry);assert.ok(stage.prepared.size<=2);
  assert.equal(item.weathering.kind,'surface-edge');assert.equal(Buffer.from(item.weathering.data,'base64').length,item.count*4);
  const active=points.filter(p=>p.emitX||p.emitY).length;assert.equal(active,item.weathering.active);assert.ok(active>4000&&active<11000);
  let facePoints=0;
  for(let i=0;i<points.length;i++){
   const p=points[i],x=(p.x+item.aspect/2)*item.crop[3]+item.crop[0],y=(p.y+.5)*item.crop[3]+item.crop[1];
   if(item.protectedFaces.some(([x1,y1,x2,y2])=>x>x1+2&&x<x2-2&&y>y1+2&&y<y2-2)){facePoints++;assert.equal(p.emitX,0);assert.equal(p.emitY,0);assert.equal(alpha[i],255);}
  }
  assert.ok(facePoints>800);assert.ok(points.every(p=>Math.abs(p.x)<.42&&Math.abs(p.y)<.51&&Math.abs(p.z)<.06));
  assert.ok(points.filter(p=>p.b>p.r&&p.g>p.r).length>item.count*.6);
 }
 assert.equal(hashes.size,6);
 const jiao=await readFile(new URL('../dist/data/jiao-poster.json',import.meta.url));
 assert.equal(createHash('sha256').update(jiao).digest('hex'),'52a71b6e6cd62854392067c9695c11ea3343954f6d0ecb1715a6fe8d64acfb8e');
});
test('poster loader fetches lazily, deduplicates, caches two and retries failures',async()=>{
 const calls=[],fetcher=async url=>{calls.push(url);const p=QINGLONG_POSTERS.find(p=>p.url===url);return {ok:true,json:async()=>({...p,count:96000})};},load=createPosterLoader(fetcher);
 assert.equal(calls.length,0);
 const [a,b]=await Promise.all([load(1),load(1)]);assert.equal(a,b);assert.equal(calls.length,1);
 await load(2);assert.equal(await load(1),a);await load(3);await load(2);assert.equal(calls.length,4);
 await assert.rejects(load(28),/没有海报/);
 let attempts=0;const retry=createPosterLoader(async()=>({ok:++attempts>1,json:async()=>({...QINGLONG_POSTERS[4],count:96000})}));
 await assert.rejects(retry(4),/请重试/);assert.equal((await retry(4)).id,4);assert.equal(attempts,2);
 const wrong=createPosterLoader(async()=>({ok:true,json:async()=>({...QINGLONG_POSTERS[5],count:96000})}));
 await assert.rejects(wrong(6),/映射错误/);
});
