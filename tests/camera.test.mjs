import test from 'node:test';
import assert from 'node:assert/strict';
import {GestureCamera} from '../dist/gesture-camera.js';
import {handLandmarks} from './hand-fixtures.mjs';

const result=()=>({landmarks:[handLandmarks()],handedness:[[{score:.96}]]});

// Exercise real camera scheduling and recovery without browser permissions or WASM.
async function cameraScene(run,{bitmap=true,transferFails=false,detectorFactory=null,workerReady=true}={}){
 const globals=['navigator','isSecureContext','document','location','createImageBitmap'],saved=new Map(globals.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
 const streams=[],workers=[],captures=[],bitmaps=[],canvases=[],draws=[],detections=[],samples=[],statuses=[],scheduled=[],constraints=[];
 let detectorCloses=0;
 const detector={detectForVideo(frame,timestamp){detections.push({frame,timestamp});return result();},close(){detectorCloses++;}};
 const video={readyState:0,currentTime:1,videoWidth:640,videoHeight:480,srcObject:null,play:async()=>{},pause(){}};
 const install=(name,value)=>Object.defineProperty(globalThis,name,{configurable:true,writable:true,value});
 install('navigator',{mediaDevices:{getUserMedia:async options=>{
  constraints.push(options);const listeners=new Set(),track={readyState:'live',stops:0,addEventListener(type,listener){assert.equal(type,'ended');listeners.add(listener);},removeEventListener(type,listener){listeners.delete(listener);},stop(){this.stops++;this.readyState='ended';},end(){this.readyState='ended';for(const listener of [...listeners])listener();}};
  const stream={track,listeners,getTracks:()=>[track]};streams.push(stream);return stream;
 }}});
 install('isSecureContext',true);install('location',{protocol:'https:',href:'https://example.test/xinghe-huaxiang/'});
 install('document',{createElement(type){assert.equal(type,'canvas');const canvas={width:300,height:150,getContext(kind){assert.equal(kind,'2d');return {drawImage(...args){draws.push(args);}};}};canvases.push(canvas);return canvas;}});
 install('createImageBitmap',bitmap===false?undefined:async(source,options)=>{
  captures.push({source,options});if(typeof bitmap==='function')return bitmap(source,options);
  const image={closed:0,close(){this.closed++;}};bitmaps.push(image);return image;
 });
 const camera=new GestureCamera(video,{onSample:(...args)=>samples.push(args),onStatus:(state,message)=>statuses.push({state,message}),detectorFactory:detectorFactory||(async()=>detector),workerFactory:()=>{
  const worker={terminated:0,frames:[],postMessage(data,transfer){if(data.type==='init'){if(workerReady)queueMicrotask(()=>this.onmessage?.({data:{type:'ready'}}));return;}if(transferFails)throw new Error('ImageBitmap transfer unavailable');this.frames.push({data,transfer});},terminate(){this.terminated++;},complete(){const frame=this.frames.at(-1);this.onmessage?.({data:{type:'result',landmarks:handLandmarks(),confidence:.96,handCount:1,inferenceMs:12,timestamp:frame.data.timestamp}});}};
  workers.push(worker);return worker;
 }});
 camera.schedule=(generation,delay)=>{if(camera.running&&generation===camera.generation)scheduled.push(delay);};
 try{await run({camera,video,streams,workers,captures,bitmaps,canvases,draws,detections,samples,statuses,scheduled,constraints,detector,get detectorCloses(){return detectorCloses;}});}
 finally{camera.stop();for(const [name,descriptor]of saved){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}}
}

test('front camera frames keep their native aspect and only one worker inference is in flight',async()=>cameraScene(async s=>{
 await s.camera.start();assert.equal(s.camera.backend,'worker');assert.equal(s.constraints[0].video.facingMode,'user');assert.equal(s.constraints[0].audio,false);
 s.video.readyState=2;s.video.videoWidth=480;s.video.videoHeight=640;s.scheduled.length=0;
 await s.camera.loop(s.camera.generation);await s.camera.loop(s.camera.generation);
 assert.equal(s.captures.length,1);assert.deepEqual(s.captures[0].options,{resizeWidth:270,resizeHeight:360,resizeQuality:'low'});
 assert.equal(s.workers[0].frames.length,1);assert.equal(s.camera.busy,true);assert.deepEqual(s.scheduled,[]);assert.equal(s.bitmaps[0].closed,0);
 s.workers[0].complete();assert.equal(s.camera.busy,false);assert.equal(s.samples.length,1);assert.equal(s.samples[0][0].pose,'open');
 await s.camera.loop(s.camera.generation);assert.equal(s.captures.length,1,'the same video frame is not inferred twice');
 s.video.currentTime=2;s.video.videoWidth=1280;s.video.videoHeight=720;
 await s.camera.loop(s.camera.generation);
 assert.deepEqual(s.captures.at(-1).options,{resizeWidth:360,resizeHeight:203,resizeQuality:'low'});
 assert.equal(s.samples.filter(sample=>sample[4]?.reset).length,1);s.workers[0].complete();
 assert.equal(s.samples.filter(sample=>sample[0]).length,2);assert.equal(s.streams.length,1);
}));

test('an old-orientation worker result is dropped before the new video dimensions reanchor input',async()=>cameraScene(async s=>{
 await s.camera.start();s.video.readyState=2;await s.camera.loop(s.camera.generation);
 s.video.videoWidth=480;s.video.videoHeight=640;s.workers[0].complete();
 assert.equal(s.samples.length,0);assert.equal(s.camera.busy,false);assert.equal(s.scheduled.at(-1),0);
 await s.camera.loop(s.camera.generation);
 assert.equal(s.workers[0].frames.length,2,'a dimension change bypasses duplicate video time suppression');
 assert.equal(s.samples.length,1);assert.equal(s.samples[0][0],null);assert.equal(s.samples[0][4].reset,true);
 s.workers[0].complete();assert.equal(s.samples[1][0].pose,'open');
}));

test('rotation during asynchronous bitmap capture discards and closes the obsolete frame',async()=>{
 let release;
 await cameraScene(async s=>{
  await s.camera.start();s.video.readyState=2;const pending=s.camera.loop(s.camera.generation);
  s.video.videoWidth=480;s.video.videoHeight=640;const image={closed:0,close(){this.closed++;}};release(image);await pending;
  assert.equal(image.closed,1);assert.equal(s.workers[0].frames.length,0);assert.equal(s.samples.length,0);assert.equal(s.camera.busy,false);assert.equal(s.scheduled.at(-1),0);
 },{bitmap:()=>new Promise(resolve=>release=resolve)});
});

test('missing ImageBitmap uses a reusable aspect-correct canvas detector without reopening the camera',async()=>cameraScene(async s=>{
 await s.camera.start();assert.equal(s.camera.backend,'main');assert.equal(s.workers[0].terminated,1);
 s.video.readyState=2;s.video.videoWidth=480;s.video.videoHeight=640;await s.camera.loop(s.camera.generation);
 assert.equal(s.canvases.length,1);assert.equal(s.detections[0].frame,s.canvases[0]);assert.equal(s.canvases[0].width,270);assert.equal(s.canvases[0].height,360);
 assert.deepEqual(s.draws[0],[s.video,0,0,270,360]);assert.equal(s.samples[0][0].pose,'open');
 s.video.currentTime=2;await s.camera.loop(s.camera.generation);assert.equal(s.canvases.length,1);assert.equal(s.detections.length,2);assert.equal(s.camera.busy,false);
 s.video.currentTime=3;s.video.videoWidth=640;s.video.videoHeight=480;await s.camera.loop(s.camera.generation);
 assert.equal(s.canvases.length,1);assert.equal(s.canvases[0].width,360);assert.equal(s.canvases[0].height,270);assert.equal(s.samples.filter(sample=>sample[4]?.reset).length,1);
 assert.equal(s.streams.length,1);assert.equal(s.streams[0].track.stops,0);
},{bitmap:false}));

for(const failure of ['capture','transfer']){
 test(failure+' failure switches once to the canvas detector and preserves the live stream',async()=>cameraScene(async s=>{
  await s.camera.start();const original=s.video.srcObject;s.video.readyState=2;
  await s.camera.loop(s.camera.generation);
  assert.equal(s.camera.backend,'main');assert.equal(s.camera.running,true);assert.equal(s.camera.busy,false);assert.equal(s.video.srcObject,original);assert.equal(s.streams[0].track.stops,0);
  assert.equal(s.workers[0].terminated,1);assert.equal(s.detections.length,1);assert.equal(s.samples.at(-1)[0].pose,'open');
  if(failure==='transfer')assert.equal(s.bitmaps[0].closed,1,'untransferred image memory is released');
  s.video.currentTime=2;await s.camera.loop(s.camera.generation);assert.equal(s.captures.length,1,'the incompatible bitmap path is not retried per frame');
  assert.equal(s.canvases.length,1);assert.equal(s.detections.length,2);assert.equal(s.streams.length,1);
 },failure==='capture'?{bitmap:async()=>{throw new Error('Video bitmap input unavailable');}}:{transferFails:true}));
}

test('stop during fallback initialization closes its late detector without reviving recognition',async()=>{
 let release;
 await cameraScene(async s=>{
  await s.camera.start();s.video.readyState=2;const pending=s.camera.loop(s.camera.generation);
  await new Promise(resolve=>setImmediate(resolve));s.camera.stop();release(s.detector);await pending;
  assert.equal(s.camera.running,false);assert.equal(s.camera.backend,'off');assert.equal(s.detectorCloses,1);assert.equal(s.streams[0].track.stops,1);
  assert.equal(s.samples.filter(sample=>sample[0]).length,0);assert.equal(s.statuses.at(-1).state,'off');
 },{bitmap:async()=>{throw new Error('Video bitmap input unavailable');},detectorFactory:()=>new Promise(resolve=>release=resolve)});
});

test('an ended track releases the old session and allows a fresh explicit start',async()=>cameraScene(async s=>{
 await s.camera.start();const old=s.streams[0];old.track.end();
 assert.equal(s.camera.running,false);assert.equal(s.camera.starting,false);assert.equal(s.camera.backend,'off');assert.equal(s.video.srcObject,null);assert.equal(old.track.stops,1);
 assert.equal(old.listeners.size,0);assert.equal(s.workers[0].terminated,1);assert.equal(s.samples.at(-1)[0],null);assert.equal(s.statuses.at(-1).state,'error');assert.match(s.statuses.at(-1).message,/重试/);
 await s.camera.start();assert.equal(s.camera.running,true);assert.equal(s.streams.length,2);assert.equal(s.video.srcObject,s.streams[1]);
 old.track.end();assert.equal(s.camera.running,true,'a stale ended event cannot stop the replacement session');assert.equal(s.streams[1].track.stops,0);
}));

test('an ended track also cancels a pending worker startup without leaving its timeout alive',async()=>cameraScene(async s=>{
 const pending=s.camera.start();await new Promise(resolve=>setImmediate(resolve));s.streams[0].track.end();await pending;
 assert.equal(s.camera.running,false);assert.equal(s.camera.starting,false);assert.equal(s.camera.cancelWorkerReady,null);assert.equal(s.workers[0].terminated,1);assert.equal(s.statuses.at(-1).state,'error');
},{workerReady:false}));
