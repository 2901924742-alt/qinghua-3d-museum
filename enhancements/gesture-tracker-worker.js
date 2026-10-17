// Classic worker keeps the Tasks Vision WASM loader's importScripts path off the museum UI thread.
let detector=null,initializing=null;
self.onmessage=async event=>{
 const data=event.data;
 try{
  if(data.type==='init'){
   if(typeof OffscreenCanvas!=='function'){self.postMessage({type:'unsupported'});return;}
   initializing=(async()=>{
    const {FilesetResolver,HandLandmarker}=await import('../vendor/mediapipe/vision_bundle.mjs');
    const files=await FilesetResolver.forVisionTasks(new URL('../vendor/mediapipe/wasm',self.location.href).href);
    detector=await HandLandmarker.createFromOptions(files,{canvas:new OffscreenCanvas(1,1),baseOptions:{modelAssetPath:new URL('../vendor/mediapipe/hand_landmarker.task',self.location.href).href,delegate:'CPU'},runningMode:'VIDEO',numHands:1,minHandDetectionConfidence:.55,minHandPresenceConfidence:.55,minTrackingConfidence:.5});
   })();await initializing;self.postMessage({type:'ready'});
  }else if(data.type==='frame'){
   await initializing;const result=detector.detectForVideo(data.image,data.timestamp);
   self.postMessage({type:'result',landmarks:result.landmarks[0]||null,width:data.image.width,height:data.image.height});
  }
 }catch(error){self.postMessage({type:'error',reason:String(error)});}
 finally{if(data.type==='frame')data.image.close();}
};
