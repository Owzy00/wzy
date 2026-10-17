import {describeHand} from './gesture-core.js?v=8';
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
 constructor(video,{onSample,onStatus,workerFactory=createHandWorker,detectorFactory=createMainHandDetector}){this.video=video;this.onSample=onSample;this.onStatus=onStatus;this.workerFactory=workerFactory;this.detectorFactory=detectorFactory;this.generation=0;this.running=false;this.inferenceMs=0;this.sent=0;this.received=0;this.backend='off';this.workerError=null;}
 async start(){
  if(this.running||this.starting)return;
  if(!navigator.mediaDevices?.getUserMedia||!isSecureContext){this.onStatus('error','摄像头需要 HTTPS 或 localhost，请使用完整包的启动脚本。');return;}
  const generation=++this.generation;this.starting=true;this.onStatus('loading','正在准备手势识别，请允许摄像头…');
  try{
   const stream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:480},facingMode:'user'},audio:false});
   if(generation!==this.generation){stream.getTracks().forEach(t=>t.stop());return;}
   this.stream=stream;this.video.srcObject=stream;await this.video.play();
   try{
    this.worker=this.workerFactory();
    await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('模型线程加载超时。')),20000);this.worker.onmessage=({data})=>{if(data.type==='ready'){clearTimeout(timeout);resolve();}if(data.type==='error'){clearTimeout(timeout);reject(new Error(data.message));}};this.worker.onerror=event=>{event.preventDefault?.();clearTimeout(timeout);reject(new Error([event.message||'浏览器未能启动识别线程',event.filename,event.lineno].filter(Boolean).join(' · ')));};this.worker.postMessage({type:'init',...modelLocation()});});
    this.backend='worker';
   }catch(error){
    if(generation!==this.generation)return;
    this.workerError=error.message;this.worker?.terminate();this.worker=null;
    this.onStatus('loading','识别线程不可用，正在切换兼容识别…');
    const detector=await this.detectorFactory();
    if(generation!==this.generation){detector.close();return;}
    this.detector=detector;this.backend='main';
   }
   if(generation!==this.generation)return;
   this.running=true;this.starting=false;this.busy=false;
   if(this.worker){this.worker.onmessage=({data})=>{if(generation!==this.generation)return;this.busy=false;if(data.type==='result'){this.received++;this.inferenceMs=data.inferenceMs;this.onSample(describeHand(data.landmarks,data.confidence,data.handCount),performance.now(),data.landmarks,data.handCount);}else if(data.type==='error'){this.stop();this.onStatus('error','识别中断：'+data.message);}};this.worker.onerror=event=>{const message=event.message||'识别线程运行中断';this.stop();this.onStatus('error',message);};}
   this.onStatus('running',this.backend==='main'?'兼容识别已开启 · 请将一只手放入画面，先握拳再张掌。':'识别已开启 · 请将一只手放入画面。');this.loop(generation);
  }catch(error){if(generation!==this.generation)return;const detail=this.workerError;this.stop();const message=error.name==='NotAllowedError'?'摄像头未获授权：请点击地址栏左侧的权限图标，允许此网页使用摄像头后重试。':error.name==='NotFoundError'?'未找到摄像头，请连接摄像头后重试。':error.name==='NotReadableError'?'摄像头被其他程序占用或无法读取，请关闭其他视频程序后重试。':error.message+(detail?'；线程错误：'+detail:'');this.onStatus('error',message);}
 }
 async loop(generation){
  if(!this.running||generation!==this.generation)return;
  if(!this.suspended&&!this.busy&&this.video.readyState>=2){this.busy=true;try{const bitmap=await createImageBitmap(this.video,{resizeWidth:360,resizeHeight:270,resizeQuality:'low'});if(!this.running||generation!==this.generation){bitmap.close();return;}this.sent++;
   if(this.detector){const started=performance.now();let result;try{result=this.detector.detectForVideo(bitmap,started);}finally{bitmap.close();}this.inferenceMs=performance.now()-started;this.received++;this.busy=false;const landmarks=result.landmarks[0]||null,handCount=result.landmarks.length;this.onSample(describeHand(landmarks,result.handedness?.[0]?.[0]?.score||0,handCount),performance.now(),landmarks,handCount);}
   else this.worker.postMessage({type:'frame',bitmap,timestamp:performance.now()},[bitmap]);
  }catch(error){this.stop();this.onStatus('error','视频识别失败：'+error.message);return;}}
  this.timer=setTimeout(()=>this.loop(generation),65);
 }
 stop(){this.generation++;clearTimeout(this.timer);this.running=false;this.starting=false;this.busy=false;this.worker?.terminate();this.worker=null;this.detector?.close();this.detector=null;this.backend='off';this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;this.video.pause();this.video.srcObject=null;this.onSample(null,performance.now(),null,0);this.onStatus('off','手势已关闭，摄像头已释放。');}
}
