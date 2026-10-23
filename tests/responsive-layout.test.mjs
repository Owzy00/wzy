import test from 'node:test';
import assert from 'node:assert/strict';
import {compactViewport,phoneLayout} from '../dist/responsive-layout.js';
test('all poster proportions fit phone portrait and short landscape with safe areas',()=>{
 for(const [w,h] of [[360,640],[390,844],[430,932],[844,390],[932,430]])for(const aspect of [.4,.6,.9]){
  const {statue:s,rect}=phoneLayout(w,h,{safeTop:20,safeBottom:16,aspect});
  assert.ok(s.cx-s.size*aspect/2>=rect.left-.001);assert.ok(s.cx+s.size*aspect/2<=w-rect.right+.001);
  assert.ok(s.cy-s.size/2>=rect.top-.001);assert.ok(s.cy+s.size/2<=h-rect.bottom+.001);
 }
});
test('wide phones in landscape use the compact layout without changing desktop',()=>{
 assert.equal(compactViewport(932,430,true),true);assert.equal(compactViewport(932,430,false),false);assert.equal(compactViewport(1280,720,true),false);
 const {sky}=phoneLayout(390,844);assert.ok(sky.cy>196&&sky.cy<604);assert.ok(sky.h>200);
});
