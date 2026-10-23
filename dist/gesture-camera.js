import {describeHand} from './gesture-core.js?v=41';
export function createHandWorker(){
 if(globalThis.XINGYE_WORKER_SOURCE){const url=URL.createObjectURL(new Blob([globalThis.XINGYE_WORKER_SOURCE],{type:'text/javascript'}));const worker=new Worker(url,{type:'module'});URL.revokeObjectURL(url);return worker;}
 return new Worker(new URL('./hand-worker.js',import.meta.url),{type:'module'});
}
export function modelLocation(){
 if(location.protocol==='file:')return {base:'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/',model:'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'};
 return {base:new URL('./vendor/mediapipe/',location.href).href,model:new URL('./vendor/mediapipe/hand_landmarker.task',location.href).href};
}
export async function createMainHandDetector(){
 const {base,model}=modelLocation(),{HandLandmarker,FilesetResolver}=await import(base+'vision_bundle.mjs');
 const files=await FilesetResolver.forVisionTasks(base+'wasm');
 return HandLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:model,delegate:'CPU'},runningMode:'VIDEO',numHands:2,minHandDetectionConfidence:.72,minHandPresenceConfidence:.72,minTrackingConfidence:.72});
}
export class GestureCamera{
 constructor(video,{onSample,onStatus,workerFactory=createHandWorker,detectorFactory=createMainHandDetector}){this.video=video;this.onSample=onSample;this.onStatus=onStatus;this.workerFactory=workerFactory;this.detectorFactory=detectorFactory;this.generation=0;this.running=false;this.inferenceMs=0;this.sent=0;this.received=0;this.backend='off';this.workerError=null;this.latencyMs=0;this.sampleHz=0;this.lastResultAt=null;this.lastVideoTime=-1;this.sourceWidth=0;this.sourceHeight=0;this.trackBindings=[];}
 async start(){
  if(this.running||this.starting)return;
  if(!navigator.mediaDevices?.getUserMedia||!isSecureContext){this.onStatus('error','摄像头需要 HTTPS，请通过星野在线网址打开。');return;}
  const generation=++this.generation;this.starting=true;this.workerError=null;this.sourceWidth=0;this.sourceHeight=0;this.onStatus('loading','正在准备手势识别，请允许摄像头…');
  try{
   const stream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:480},facingMode:'user'},audio:false});
   if(generation!==this.generation){stream.getTracks().forEach(t=>t.stop());return;}
   this.stream=stream;
   const ended=()=>{if(generation!==this.generation||this.stream!==stream)return;this.stop();this.onStatus('error','摄像头连接已中断，请点击开启或重试。');};
   for(const track of stream.getTracks()){track.addEventListener?.('ended',ended);this.trackBindings.push({track,ended});}
   this.video.srcObject=stream;await this.video.play();if(generation!==this.generation)return;
   this.onStatus('loading','摄像头已接入，正在准备手势识别…');
   try{
    this.worker=this.workerFactory();
    if(typeof globalThis.createImageBitmap!=='function')throw new Error('浏览器不支持视频帧传输。');
    await new Promise((resolve,reject)=>{let settled=false;const finish=error=>{if(settled)return;settled=true;clearTimeout(timeout);this.cancelWorkerReady=null;error?reject(error):resolve();},timeout=setTimeout(()=>finish(new Error('模型线程加载超时。')),20000);this.cancelWorkerReady=()=>finish(new Error('识别准备已取消。'));this.worker.onmessage=({data})=>{if(data.type==='ready')finish();if(data.type==='error')finish(new Error(data.message));};this.worker.onerror=event=>{event.preventDefault?.();finish(new Error([event.message||'浏览器未能启动识别线程',event.filename,event.lineno].filter(Boolean).join(' · ')));};try{this.worker.postMessage({type:'init',...modelLocation()});}catch(error){finish(error);}});
    this.backend='worker';
   }catch(error){
    if(generation!==this.generation)return;
    if(!await this.useMainDetector(generation,error))return;
   }
   if(generation!==this.generation)return;
   this.running=true;this.starting=false;this.busy=false;this.lastVideoTime=-1;this.lastResultAt=null;
   if(this.worker){const worker=this.worker;worker.onmessage=({data})=>{if(generation!==this.generation||this.worker!==worker)return;this.busy=false;if(data.type==='result'){if(!this.matchesFrameSize()){this.schedule(generation,0);return;}this.deliver(data.landmarks,data.confidence,data.handCount,data.timestamp,data.inferenceMs);this.schedule(generation,Math.max(4,33-(performance.now()-(this.lastCaptureAt||0))));}else if(data.type==='error'){this.stop();this.onStatus('error','识别中断：'+data.message);}};worker.onerror=event=>{if(generation!==this.generation||this.worker!==worker)return;const message=event.message||'识别线程运行中断';this.stop();this.onStatus('error',message);};}
   this.onStatus('running','摄像头已接入 · 移手环顾，握拳点亮，张掌化形。收起面板仍可交互。');this.loop(generation);
  }catch(error){if(generation!==this.generation)return;const detail=this.workerError;this.stop();const message=error.name==='NotAllowedError'?'摄像头未获授权：请点击地址栏左侧的权限图标，允许此网页使用摄像头后重试。':error.name==='NotFoundError'?'未找到摄像头，请连接摄像头后重试。':error.name==='NotReadableError'?'摄像头被其他程序占用或无法读取，请关闭其他视频程序后重试。':error.message+(detail?'；线程错误：'+detail:'');this.onStatus('error',message);}
 }
 frameSize(){
  const sourceWidth=this.video.videoWidth||640,sourceHeight=this.video.videoHeight||480,scale=Math.min(1,360/Math.max(sourceWidth,sourceHeight));
  return {sourceWidth,sourceHeight,width:Math.max(1,Math.round(sourceWidth*scale)),height:Math.max(1,Math.round(sourceHeight*scale))};
 }
 matchesFrameSize(){const size=this.frameSize();return this.video.videoWidth!==0&&this.video.videoHeight!==0&&size.sourceWidth===this.sourceWidth&&size.sourceHeight===this.sourceHeight;}
 canvasFrame(size){
  if(!this.captureCanvas){this.captureCanvas=document.createElement('canvas');this.captureContext=this.captureCanvas.getContext('2d');if(!this.captureContext)throw new Error('浏览器未能准备兼容视频画布。');}
  if(this.captureCanvas.width!==size.width)this.captureCanvas.width=size.width;if(this.captureCanvas.height!==size.height)this.captureCanvas.height=size.height;
  this.captureContext.drawImage(this.video,0,0,size.width,size.height);return this.captureCanvas;
 }
 async useMainDetector(generation,error){
  this.workerError=error.message;this.worker?.terminate();this.worker=null;this.onStatus('loading','正在准备兼容手势识别…');
  const detector=await this.detectorFactory();if(generation!==this.generation){detector.close();return false;}
  this.detector=detector;this.backend='main';if(this.running)this.onStatus('running','兼容识别已接入 · 移手环顾，握拳点亮，张掌化形。');return true;
 }
 deliver(landmarks,confidence,handCount,capturedAt,inferenceMs){
  const receivedAt=performance.now(),time=Number.isFinite(capturedAt)&&capturedAt<=receivedAt?capturedAt:receivedAt;
  this.received++;this.inferenceMs=inferenceMs;this.latencyMs=Math.max(0,receivedAt-time);
  if(this.lastResultAt!==null){const hz=1000/Math.max(1,receivedAt-this.lastResultAt);this.sampleHz=this.sampleHz?this.sampleHz*.8+hz*.2:hz;}this.lastResultAt=receivedAt;
  this.onSample(describeHand(landmarks,confidence,handCount),time,landmarks,handCount,{receivedAt,latencyMs:this.latencyMs});
 }
 schedule(generation,delay=33){clearTimeout(this.timer);if(this.running&&generation===this.generation)this.timer=setTimeout(()=>this.loop(generation),delay);}
 async loop(generation){
  if(!this.running||generation!==this.generation||this.busy)return;
  if(this.suspended||this.video.readyState<2){this.schedule(generation,this.suspended?150:33);return;}
  if(this.video.videoWidth===0||this.video.videoHeight===0){this.schedule(generation,33);return;}
  const size=this.frameSize();let capturedAt=performance.now();
  if(this.sourceWidth&&(size.sourceWidth!==this.sourceWidth||size.sourceHeight!==this.sourceHeight)){
   // The coordinator owns palm/fingertip anchors; discard them before a new orientation.
   this.lastVideoTime=-1;this.lastResultAt=null;this.onSample(null,capturedAt,null,0,{receivedAt:capturedAt,latencyMs:0,reset:true});
  }
  this.sourceWidth=size.sourceWidth;this.sourceHeight=size.sourceHeight;
  if(!this.running||generation!==this.generation)return;
  const videoTime=this.video.currentTime;
  if(Number.isFinite(videoTime)&&videoTime===this.lastVideoTime){this.schedule(generation,12);return;}
  this.lastVideoTime=videoTime;this.busy=true;
  this.lastCaptureAt=capturedAt;let bitmap;
  try{
   if(!this.detector){
    try{
     if(typeof globalThis.createImageBitmap!=='function')throw new Error('浏览器不支持视频帧传输。');
     bitmap=await createImageBitmap(this.video,{resizeWidth:size.width,resizeHeight:size.height,resizeQuality:'low'});
     if(!this.running||generation!==this.generation)return;
     if(!this.matchesFrameSize()){this.busy=false;this.schedule(generation,0);return;}
     this.worker.postMessage({type:'frame',bitmap,timestamp:capturedAt},[bitmap]);bitmap=null;this.sent++;return;
    }catch(error){
     bitmap?.close();bitmap=null;if(!this.running||generation!==this.generation)return;
     if(!await this.useMainDetector(generation,error))return;
    }
   }
   if(!this.running||generation!==this.generation)return;
   if(!this.matchesFrameSize()){this.busy=false;this.schedule(generation,0);return;}
   capturedAt=performance.now();this.lastCaptureAt=capturedAt;this.lastVideoTime=this.video.currentTime;
   const frame=this.canvasFrame(size),started=performance.now(),result=this.detector.detectForVideo(frame,capturedAt);this.sent++;
   this.busy=false;this.deliver(result.landmarks[0]||null,result.handedness?.[0]?.[0]?.score||0,result.landmarks.length,capturedAt,performance.now()-started);
   this.schedule(generation,Math.max(8,33-(performance.now()-capturedAt)));
   // Worker completion schedules the next fresh frame: no extra 55 ms polling wait,
   // and never more than one inference in flight.
  }catch(error){if(generation!==this.generation)return;this.stop();this.onStatus('error','视频识别失败：'+error.message);}finally{bitmap?.close();}
 }
 stop(){this.generation++;clearTimeout(this.timer);this.running=false;this.starting=false;this.busy=false;this.cancelWorkerReady?.();this.cancelWorkerReady=null;this.worker?.terminate();this.worker=null;this.detector?.close();this.detector=null;this.backend='off';for(const {track,ended}of this.trackBindings)track.removeEventListener?.('ended',ended);this.trackBindings=[];this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;this.video.pause();this.video.srcObject=null;if(this.captureCanvas){this.captureCanvas.width=0;this.captureCanvas.height=0;}this.captureCanvas=null;this.captureContext=null;this.sourceWidth=0;this.sourceHeight=0;this.onSample(null,performance.now(),null,0);this.onStatus('off','手势已关闭，摄像头已释放。');}
}
