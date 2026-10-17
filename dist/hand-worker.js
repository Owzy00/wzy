let detector=null;
self.onmessage=async({data})=>{
 try{
  if(data.type==='init'){
   const {HandLandmarker,FilesetResolver}=await import(data.base+'vision_bundle.mjs');
   const files=await FilesetResolver.forVisionTasks(data.base+'wasm',true);
   detector=await HandLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:data.model,delegate:'CPU'},runningMode:'VIDEO',numHands:2,minHandDetectionConfidence:.72,minHandPresenceConfidence:.72,minTrackingConfidence:.72});
   self.postMessage({type:'ready'});
  }else if(data.type==='frame'&&detector){
   const start=performance.now();let result;
   try{result=detector.detectForVideo(data.bitmap,data.timestamp);}finally{data.bitmap.close();}
   self.postMessage({type:'result',landmarks:result.landmarks[0]||null,handCount:result.landmarks.length,confidence:result.handedness?.[0]?.[0]?.score||0,inferenceMs:performance.now()-start,timestamp:data.timestamp});
  }
 }catch(error){data.bitmap?.close();self.postMessage({type:'error',message:error.message||String(error)});}
};
