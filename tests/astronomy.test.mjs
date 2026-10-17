import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {RAD,TAU,wrap,deltaAngle,vector,centerOf,projectSphere,projectAtlas,segmentSamples,formatRA,formatDec,panSky,nearestMansion} from '../dist/astronomy.js';
const stars=[...JSON.parse(await readFile(new URL('../dist/data/stars.json',import.meta.url),'utf8')),...JSON.parse(await readFile(new URL('../dist/data/supplement.json',import.meta.url),'utf8'))];
const ms=JSON.parse(await readFile(new URL('../dist/data/mansions.json',import.meta.url),'utf8'));
const byId=new Map(stars.map(([id,ra,dec,mag])=>[id,{ra:wrap(ra*RAD),dec:dec*RAD,mag}]));
const viewport={w:1000,h:600,cx:500,cy:300};
const camera={ra:0,dec:0,fov:90*RAD,zoom:1};
function near(a,b,tolerance=1e-8){assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);}
test('28 unique principal mansions, seven in each symbol, all HIP endpoints resolved',()=>{assert.equal(ms.length,28);assert.equal(new Set(ms.map(m=>m.name)).size,28);for(let g=0;g<4;g++)assert.equal(ms.filter(m=>m.group===g).length,7);for(const m of ms)for(const id of m.lines.flat())assert.ok(byId.has(id),`${m.name}: missing HIP ${id}`);});
test('catalogue has 5049 distinct finite J2000 records with valid declinations',()=>{assert.equal(stars.length,5049);assert.equal(byId.size,stars.length);for(const s of stars){assert.ok(s.every(Number.isFinite));assert.ok(Math.abs(s[2])<=90);}});
test('Spica source position and magnitude remain correct after unit conversion',()=>{const s=byId.get(65474);near(s.ra/RAD,201.2983,.001);near(s.dec/RAD,-11.1613,.001);near(s.mag,.98,.05);});
test('sphere camera center maps to viewport center at several sky directions',()=>{for(const [ra,dec]of [[0,0],[6.27,.6],[3.5,-1.3]]){const p=projectSphere(ra,dec,{...camera,ra,dec},viewport);near(p.x,500);near(p.y,300);near(p.z,1);}});
test('sphere rejects the rear hemisphere and correctly scales fov',()=>{assert.equal(projectSphere(Math.PI,0,camera,viewport),null);const a=projectSphere(.1,0,camera,viewport),b=projectSphere(.1,0,{...camera,fov:45*RAD},viewport);assert.ok(Math.abs(b.x-500)>Math.abs(a.x-500));});
test('sky chart convention has east / increasing RA on the left',()=>{assert.ok(projectSphere(.1,0,camera,viewport).x<500);assert.ok(projectAtlas(.1,0,camera,viewport).x<500);assert.ok(projectSphere(0,.1,camera,viewport).y<300);});
test('RA wrap is continuous across 0h for camera interpolation and atlas',()=>{near(deltaAngle(.001,TAU-.001),.002);const p=projectAtlas(.001,0,{...camera,ra:TAU-.001},viewport);assert.ok(Math.abs(p.x-500)<1);near(wrap(-.1),TAU-.1);});
test('spherical member average handles the 24h seam',()=>{const c=centerOf([{ra:359*RAD,dec:0},{ra:1*RAD,dec:0}]);near(Math.sin(c.ra),0);near(c.dec,0);});
test('great-circle samples preserve endpoint coordinates including RA seam',()=>{const a={ra:359*RAD,dec:12*RAD},b={ra:2*RAD,dec:17*RAD};const samples=segmentSamples(a,b,24);near(deltaAngle(samples[0].ra,a.ra),0);near(samples.at(-1).dec,b.dec);for(const p of samples){const v=vector(p.ra,p.dec);near(Math.hypot(...v),1);assert.ok(Math.abs(deltaAngle(p.ra,0))<4*RAD);}});
test('projection and sampling never mutate catalogue objects',()=>{const before=JSON.stringify([...byId]);for(let tick=0;tick<100;tick++)for(const m of ms){const members=[...new Set(m.lines.flat())].map(id=>byId.get(id));centerOf(members);for(const s of members){projectSphere(s.ra,s.dec,{...camera,ra:tick*.05},viewport);projectAtlas(s.ra,s.dec,{...camera,zoom:1+tick*.01},viewport);}}assert.equal(JSON.stringify([...byId]),before);});
test('coordinate formatting includes hemisphere and wrapped hours',()=>{assert.equal(formatRA(TAU),'00h 00m');assert.equal(formatDec(-10*RAD),'−10.0°');assert.equal(formatDec(20*RAD),'+20.0°');});

test('hand panning moves the view in both projections without mutating camera or star positions',()=>{
 const original=JSON.stringify(camera),source=Object.freeze({ra:.1,dec:.1});
 for(const mode of ['sphere','atlas']){const project=mode==='sphere'?projectSphere:projectAtlas,before=project(source.ra,source.dec,camera,viewport),next=panSky(camera,mode,viewport,.02,.03),after=project(source.ra,source.dec,next,viewport);assert.ok(after.x>before.x&&after.y>before.y);near(source.ra,.1);near(source.dec,.1);}
 assert.equal(JSON.stringify(camera),original);const edge=panSky({...camera,ra:TAU-.001,dec:84*RAD},'sphere',viewport,.1,.5);assert.ok(edge.ra>=0&&edge.ra<TAU);near(edge.dec,85*RAD);
});
test('fist selection uses the visible reticle neighborhood and never selects behind the camera',()=>{
 const mansions=[{id:0,center:{ra:Math.PI,dec:0},members:[]},{id:1,center:{ra:.2,dec:0},members:[]},{id:2,center:{ra:.04,dec:0},members:[]}];
 assert.equal(nearestMansion(mansions,(ra,dec)=>projectSphere(ra,dec,camera,viewport),viewport),2);
 assert.equal(nearestMansion(mansions.slice(0,1),(ra,dec)=>projectSphere(ra,dec,camera,viewport),viewport),null);
 const seam={...camera,ra:TAU-.01};assert.equal(nearestMansion(mansions,(ra,dec)=>projectAtlas(ra,dec,seam,viewport),viewport),2);
});
