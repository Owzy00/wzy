import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stagePresentation,stageEditorialMarkup} from '../dist/stage-editorial.js';
import {RAD,centerOf} from '../dist/astronomy.js';
const rows=JSON.parse(await readFile(new URL('../dist/data/stars.json',import.meta.url))),extra=JSON.parse(await readFile(new URL('../dist/data/supplement.json',import.meta.url))),catalogue=JSON.parse(await readFile(new URL('../dist/data/mansions.json',import.meta.url)));
const stars=new Map([...rows,...extra].map(([id,ra,dec,mag])=>[id,{id,ra:ra*RAD,dec:dec*RAD,mag}]));
const mansions=catalogue.map(m=>{const members=[...new Set(m.lines.flat())].map(id=>stars.get(id));return {...m,members,center:centerOf(members)};});
test('fixed diagrams retain actual HIP nodes, connectivity, sky orientation and uniform scale for all 28 mansions',()=>{
 const before=JSON.stringify(mansions);
 for(const m of mansions){
  const p=stagePresentation(m,{id:m.id,name:m.name,title:m.name,pinyin:m.pinyin});
  assert.equal(p.points.length,m.members.length);assert.deepEqual(p.lines,m.lines);
  assert.deepEqual(p.points.map(s=>s.id),m.members.map(s=>s.id));assert.equal(p.sequence[p.active],m.name);
  for(const point of p.points)assert.ok(point.x>=33&&point.x<=207&&point.y>=25&&point.y<=159);
  const a=m.members[0],b=m.members[1],pa=p.points[0],pb=p.points[1];assert.equal(Math.sign(pa.y-pb.y),Math.sign(b.dec-a.dec));
  assert.ok(p.coordinates&&!p.coordinates.includes('NaN'));
 }
 assert.equal(JSON.stringify(mansions),before);
});
test('diagram snapshot stays detached from catalogue updates and handles the RA seam locally',()=>{
 const m={id:13,name:'壁',group:1,center:{ra:0,dec:0},members:[{id:1,ra:359*RAD,dec:0,mag:1},{id:2,ra:1*RAD,dec:1*RAD,mag:2}],lines:[[1,2]]};
 const p=stagePresentation(m,{id:13,name:'壁',title:'壁水貐',pinyin:'Bi Shui Yu'}),html=stageEditorialMarkup(p);
 assert.ok(p.points[0].x>p.points[1].x);assert.ok(Math.abs((p.points[0].x-p.points[1].x)/(p.points[0].y-p.points[1].y)-2)<1e-8);
 m.members[0].ra=1;m.lines[0].push(3);assert.deepEqual(stageEditorialMarkup(p),html);assert.deepEqual(p.lines,[[1,2]]);
});
test('poster ornament uses current mansion metadata, not invented stars or poster coordinates',()=>{
 const p=stagePresentation(mansions[0],{id:0,name:'角',title:'角木蛟',pinyin:'Jiao Mu Jiao'}),html=stageEditorialMarkup(p);
 assert.equal(p.points.length,2);assert.match(html.atlas,/角宿星官 · 2 颗主体恒星/);assert.match(html.record,/J2000/);assert.match(html.record,/春生/);assert.match(html.record,/13h/);assert.equal(html.index,'MANSION 01 / 28');
 assert.doesNotMatch(html.atlas,/animate|requestAnimationFrame|transform-origin/);
});
