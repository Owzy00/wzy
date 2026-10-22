import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {OTHER_POSTERS,POSTER_DEFINITIONS,posterDefinition,posterPalette} from '../dist/qinglong-posters.js';
import {StatueStage,decodeCloud,drawRegionalAtmosphere} from '../dist/particle-effects.js';
import {drawJiaoAtmosphere} from '../dist/jiao-style.js';
const baseline={
 "dist/data/jiao-poster.json": "52a71b6e6cd62854392067c9695c11ea3343954f6d0ecb1715a6fe8d64acfb8e",
 "dist/data/qinglong/01-kang.json": "988ede66c338e47757edcbfaa47342cd5ad1dbbe2b50c32761c5c76911d451de",
 "dist/data/qinglong/02-di.json": "e6d34f903e25a691ebd68ed340369173773a27583973c815c4aa208b14aea4bf",
 "dist/data/qinglong/03-fang.json": "c3340825fb80b8633f6c6a3175945ad9d11c6bfb5739c165ba35405477797206",
 "dist/data/qinglong/04-xin.json": "55ec5c26f37e297365baca29dfaa1eb0a40312a9bb1065d971eb483af3710b46",
 "dist/data/qinglong/05-wei.json": "3ea3f7cb14bc5c2a93abb9f7e35598b72734c62bceba53bd9ecabdf2215a8ff7",
 "dist/data/qinglong/06-ji.json": "d2d987ce031288a549593e8c7419d63fa8d457f3058a44052d003bc49f52fc91"
};
const sources={
 "7": [
  "Frame 153.png",
  "e5e724b531bd296a36c5504c7bc9fcf59262a286d1f46f9890cb7cea9b73abb6"
 ],
 "8": [
  "Frame 157.png",
  "a20bfb0a14c2df1302f8aab542f843b2efd4ae8af2e82385998079486e9971a4"
 ],
 "9": [
  "Frame 155.png",
  "1d98d7aa114854ce6dbe23e4f13cb24cac10c5068380419f8abf3962c8b5c969"
 ],
 "10": [
  "Frame 159.png",
  "ba6384ebf3abf0cf4dc5e089cf0dc93df8a38bc34581b1c348f46dcc9c5427a4"
 ],
 "11": [
  "Frame 154.png",
  "2c049f5eed137ea5a7664277513242b8291446f1353b1d1f97e7dc68e3e92f0a"
 ],
 "12": [
  "Frame 158.png",
  "873b3bb8670f1977d04e18770aff6639f5a5a5d9326029322a857da947ee015a"
 ],
 "13": [
  "Frame 156.png",
  "e14f029cc9bf11eb55a1e4efd11fa660fa3f69246dff9757d4ccdf2d3908335e"
 ],
 "14": [
  "Frame 169.png",
  "56ac5f4639db15cf4ac12259cef2fc8f3705b235434278b6ae64d03e843ba471"
 ],
 "15": [
  "Frame 173.png",
  "d68edc69e0d46260b117ef7a3147cd127bbdbdfb9e51013fbd500d4572fcc718"
 ],
 "16": [
  "03_胃土雉 1.png",
  "d89550deb71cae2ae239f153bbe970680ed923465aa207ef8d8d66c29dfe5e5d"
 ],
 "17": [
  "04_昴日鸡 1.png",
  "b30740232572b33ac62dea8e1b5a1847277fed60507f3923b2fc7420ef524f24"
 ],
 "18": [
  "image 686.png",
  "e2c3f6bc9fc3828be8c5688d9435338346ae9c69d0acd1b00ee8aeca75ce1a15"
 ],
 "19": [
  "image 687.png",
  "379852f9ba01aecfd3afc58afd1ffee1fd2efd5479835af5934f71dbc7f04f86"
 ],
 "20": [
  "image 688.png",
  "f2d3bc4c110cef87e6624196be9920081b01b3c919eb26f81037aac3931cf56a"
 ],
 "21": [
  "Frame 161.png",
  "b708ffd253e1cb3292d7b36dca3587f8139eb9ab8aa644854b2c79c54a019cbf"
 ],
 "22": [
  "Frame 165.png",
  "edaea393e34dceb306b30832170dcef1c02994655b867c9975f7733731b884c7"
 ],
 "23": [
  "Frame 163.png",
  "c99d84a9929c70a27b7149d7029a471cac1b0dae516404fc988183a9042bc845"
 ],
 "24": [
  "Frame 167.png",
  "f1c9b56e3bc521f5c4af0a292244bb8b013824e8b1290eba304ce805b7dbf8b7"
 ],
 "25": [
  "Frame 162.png",
  "729dd8385223602a2b3d6ff017172dd4fa0826116713d45f321d148931ad218f"
 ],
 "26": [
  "Frame 166.png",
  "9eb0a69077ca948a80f9681da0446bf6d743b0468ec6444aaf5510ded781055c"
 ],
 "27": [
  "Frame 164.png",
  "4c9ead121dbbc84d08485df245cfbb757beef9bb402ba12c545cd5dd41bdb66e"
 ]
};
test('v33 preserves all seven accepted Azure Dragon poster files exactly',async()=>{
 for(const [path,sha]of Object.entries(baseline)){
  const bytes=await readFile(new URL('../'+path,import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),sha,path);
 }
});
test('all 28 mansion definitions are unique and the 21 new clouds preserve source identity and face detail',async()=>{
 assert.equal(POSTER_DEFINITIONS.length,28);assert.equal(OTHER_POSTERS.length,21);
 assert.deepEqual(POSTER_DEFINITIONS.map(s=>s.id),Array.from({length:28},(_,i)=>i));
 assert.equal(new Set(POSTER_DEFINITIONS.map(s=>s.url)).size,28);
 const hashes=new Set(),stage=new StatueStage();
 for(const spec of OTHER_POSTERS){
  assert.equal(posterDefinition(spec.id),spec);
  const item=JSON.parse(await readFile(new URL('../dist/'+spec.url.split('?')[0].slice(2),import.meta.url),'utf8'));
  assert.equal(item.id,spec.id);assert.equal(item.name,spec.name);assert.equal(item.title,spec.title);assert.equal(item.pinyin,spec.pinyin);
  assert.equal(item.group,Math.floor(spec.id/7));assert.equal(spec.group,item.group);assert.equal(item.style,'heritage-poster');
  assert.equal(item.source,sources[spec.id][0]);assert.equal(item.sourceSha256,sources[spec.id][1]);assert.equal(item.count,96000);
  assert.deepEqual(item.sourceSize,[707,1060]);assert.equal(Buffer.from(item.data,'base64').length,864000);
  hashes.add(createHash('sha256').update(item.data).digest('hex'));
  const points=decodeCloud(item),entry=stage.prepare(item),alpha=Buffer.from(item.edgeAlpha,'base64');
  assert.equal(entry.packed.count,144000);assert.equal(entry.packed.flowCount,48000);assert.equal(entry.points.length,96000);
  assert.equal(stage.prepared.get('heritage-poster:'+item.id),entry);assert.equal(stage.prepare(item),entry);assert.ok(stage.prepared.size<=2);
  assert.equal(alpha.length,96000);assert.equal(item.weathering.kind,'surface-edge');
  assert.equal(Buffer.from(item.weathering.data,'base64').length,384000);
  assert.equal(points.filter(p=>p.emitX||p.emitY).length,item.weathering.active);
  assert.ok(item.weathering.active>4000&&item.weathering.active<=10500);
  let facePoints=0;
  for(let i=0;i<points.length;i++){
   const p=points[i];assert.ok(Number.isFinite(p.x)&&Math.abs(p.x)<.45&&Math.abs(p.y)<.51&&Math.abs(p.z)<.06);
   const x=(p.x+item.aspect/2)*item.crop[3]+item.crop[0],y=(p.y+.5)*item.crop[3]+item.crop[1];
   if(item.protectedFaces.some(([x1,y1,x2,y2])=>x>x1+2&&x<x2-2&&y>y1+2&&y<y2-2)){
    facePoints++;assert.equal(p.emitX,0);assert.equal(p.emitY,0);assert.equal(alpha[i],255);
   }
  }
  assert.ok(facePoints>400,spec.title+' must retain protected face samples');
  assert.ok([...alpha].some(v=>v>60&&v<250),spec.title+' must have a gradual contour');
 }
 assert.equal(hashes.size,21);
 assert.equal(posterDefinition(15).source,'Frame 173.png');
 assert.equal(posterDefinition(14).source,'Frame 169.png');
 assert.equal(posterDefinition(25).source,'Frame 162.png');
});
test('regional GPU colors reset to the original Azure Dragon colors without additional uploads or draw calls',()=>{
 const calls={heritage:[],colors:[],uploads:0,draws:0},gl=new Proxy({
  uniform1f(name,value){if(name==='heritage')calls.heritage.push(value);},
  uniform3f(name,...value){if(['low','high','accent'].includes(name))calls.colors.push([name,...value]);},
  bufferData(){calls.uploads++;},drawArrays(){calls.draws++;}
 },{get:(o,k)=>o[k]||(()=>{})}),stage=new StatueStage();
 stage.gl=gl;stage.program={};stage.uniforms={uHeritage:'heritage',uPosterLow:'low',uPosterHigh:'high',uPosterAccent:'accent'};
 stage.canvas={width:0,height:0,style:{},setAttribute(){}};stage.particleCount=144000;stage.origin={x:500,y:350};stage.animationStarted=0;
 stage.timeline.start(0);stage.posterMode=true;stage.drawPosterLines=()=>{};
 const prior=globalThis.devicePixelRatio;globalThis.devicePixelRatio=1;
 try{
  for(const [i,id]of [7,14,21,0].entries()){stage.item=posterDefinition(id);stage.draw(null,1000+i*100,1280,720);}
  assert.deepEqual(calls.heritage,[1,1,1,0]);assert.equal(calls.uploads,0);assert.equal(calls.draws,4);
  assert.deepEqual(calls.colors.filter(x=>x[0]==='accent').map(x=>x.slice(1)),[posterPalette(7).accent,posterPalette(14).accent,posterPalette(21).accent]);
 }finally{if(prior===undefined)delete globalThis.devicePixelRatio;else globalThis.devicePixelRatio=prior;}
});
test('regional orbital decoration retains v30 geometry and draws no connected constellation nodes',()=>{
 function trace(){const positions=[],colors=[];return {positions,colors,ctx:{clearRect(){},save(){},restore(){},translate(){},scale(){},setLineDash(){},beginPath(){},moveTo(x,y){positions.push([x,y]);},lineTo(x,y){positions.push([x,y]);},stroke(){},set strokeStyle(value){colors.push(value);}}};}
 const base=trace(),next=trace(),l={cx:500,cy:350,size:600,width:1280,height:720},pointer={x:.2,y:-.1};
 drawJiaoAtmosphere(base.ctx,l,5.6,1,0,pointer,false);
 drawRegionalAtmosphere(next.ctx,l,5.6,1,0,pointer,false,posterPalette(21));
 assert.deepEqual(next.positions,base.positions);assert.equal(next.colors.length,4);assert.equal(new Set(next.colors).size,2);
 assert.deepEqual(next.colors,[...posterPalette(21).orbits,...posterPalette(21).orbits]);
});
