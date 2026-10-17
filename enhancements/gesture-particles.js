// Uses the museum's renderer and animation loop. Camera resources are created only on explicit startCamera().
export function createGestureParticles({THREE,scene,camera,renderer,isDesktop,onStatus=()=>{}}){
 const count=720,positions=new Float32Array(count*3),shape=new Float32Array(count*3),colors=new Float32Array(count*3);
 const palette=[0xb8d4ff,0x597dcc,0xf4f8ff,0x315ba9].map(hex=>new THREE.Color(hex));
 for(let i=0;i<count;i++){
  const curve=i%12,u=(Math.floor(i/12)*.61803398875)%1,angle=(curve%5)*Math.PI*2/5;
  let x,y,z;
  if(curve<10){
   const size=curve<5?1:.58,radial=.06+Math.sin(Math.PI*u)*size,side=Math.sin(Math.PI*2*u)*size*.27;
   x=radial*Math.cos(angle)-side*Math.sin(angle);y=radial*Math.sin(angle)+side*Math.cos(angle);z=curve<5?0:.08;
  }else{
   const side=curve===10?-1:1,radius=(1-u)*.62,a=u*Math.PI*3;
   x=side*(.82+Math.cos(a)*radius);y=-.8+Math.sin(a)*radius;z=-.04;
  }
  shape.set([x,y,z],i*3);palette[i%palette.length].toArray(colors,i*3);
 }
 const sprite=document.createElement('canvas');sprite.width=sprite.height=32;
 const context=sprite.getContext('2d'),gradient=context.createRadialGradient(16,16,1,16,16,16);
 gradient.addColorStop(0,'rgba(255,255,255,1)');gradient.addColorStop(.35,'rgba(255,255,255,.95)');gradient.addColorStop(1,'rgba(255,255,255,0)');context.fillStyle=gradient;context.fillRect(0,0,32,32);
 const texture=new THREE.CanvasTexture(sprite),geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
 const material=new THREE.PointsMaterial({map:texture,size:3,vertexColors:true,transparent:true,opacity:.9,depthWrite:false,depthTest:false,sizeAttenuation:false,toneMapped:false,fog:false});
 const points=new THREE.Points(geometry,material);points.name='museum-gesture-flower';points.frustumCulled=false;points.renderOrder=6;points.visible=false;scene.add(points);
 const center=new THREE.Vector3(),target={x:.74,y:.4,pinch:0},current={...target};
 const reduced=typeof matchMedia==='function'?matchMedia('(prefers-reduced-motion:reduce)'):null;
 let enabled=false,disposed=false,time=0,state='',generation=0,stream=null,video=null,worker=null,pending=null;
 let loopTimer=0,initTimer=0,frameTimer=0,rejectInit=null,lastVideoTime=-1;
 const status=next=>{if(state!==next){state=next;onStatus({state:next});}return next;};
 function setPointer(x,y,pinch){
  if(!Number.isFinite(x)||!Number.isFinite(y))return;
  target.x=Math.max(0,Math.min(1,x));target.y=Math.max(0,Math.min(1,y));
  if(Number.isFinite(pinch))target.pinch=Math.max(0,Math.min(1,pinch));
 }
 function update(delta){
  if(!enabled||disposed)return;
  const dt=Number.isFinite(delta)?Math.max(0,Math.min(.05,delta)):0,ease=1-Math.exp(-12*dt);time+=dt;
  current.x+=(target.x-current.x)*ease;current.y+=(target.y-current.y)*ease;current.pinch+=(target.pinch-current.pinch)*ease;
  const open=1-current.pinch,spread=.2+open*.8,breath=reduced?.matches?1:1+Math.sin(time*.8)*.025;
  for(let i=0;i<count;i++){const p=i*3;positions[p]=shape[p]*spread*breath;positions[p+1]=shape[p+1]*(.3+open*.7)*breath;positions[p+2]=shape[p+2]+current.pinch*.18*Math.cos(i*.5);}
  geometry.attributes.position.needsUpdate=true;geometry.setDrawRange(0,isDesktop()?720:360);material.size=isDesktop()?3:2.6;
  const rect=renderer.domElement.getBoundingClientRect(),distance=4;
  camera.updateMatrixWorld();center.set(current.x*2-1,1-current.y*2,.5).unproject(camera).sub(camera.position).normalize().multiplyScalar(distance).add(camera.position);
  points.position.copy(center);points.quaternion.copy(camera.quaternion);
  points.scale.setScalar(2*Math.tan(camera.fov*Math.PI/360)*distance*.12*Math.min(1,rect.width/Math.max(1,rect.height)));
 }
 function stopCamera(next='ready'){
  generation++;clearTimeout(loopTimer);clearTimeout(initTimer);clearTimeout(frameTimer);loopTimer=initTimer=frameTimer=0;
  const reject=rejectInit;rejectInit=null;reject?.(new DOMException('Camera stopped','AbortError'));
  if(worker){worker.onmessage=worker.onerror=null;worker.terminate();worker=null;}
  if(stream){for(const track of stream.getTracks()){track.onended=null;track.stop();}stream=null;}
  if(video){video.pause();video.srcObject=null;video.remove();video=null;}
  pending=null;lastVideoTime=-1;status(next);
 }
 function setEnabled(value){if(disposed)return;enabled=!!value;points.visible=enabled;if(!enabled)stopCamera();else if(!stream)status('ready');}
 function handResult(landmarks,width,height){
  if(!landmarks||landmarks.length!==21){status('no-hand');return;}
  const aspect=width/Math.max(1,height),distance=(a,b)=>Math.hypot((a.x-b.x)*aspect,a.y-b.y),palm=distance(landmarks[0],landmarks[9]);
  if(!Number.isFinite(palm)||palm<.06){status('no-hand');return;}
  const ratio=distance(landmarks[4],landmarks[8])/palm,ids=[0,5,9,13,17];
  const x=ids.reduce((sum,i)=>sum+landmarks[i].x,0)/ids.length,y=ids.reduce((sum,i)=>sum+landmarks[i].y,0)/ids.length;
  // Palm normalization makes pinch independent of the distance to the camera; mirror X with the preview.
  setPointer(1-x,y,1-Math.max(0,Math.min(1,(ratio-.18)/.95)));status('tracking');
 }
 function startCamera(){
  if(disposed||!enabled)return Promise.resolve('ready');if(pending)return pending;if(stream)return Promise.resolve(state);
  if(typeof Worker!=='function'||typeof createImageBitmap!=='function'||typeof OffscreenCanvas!=='function'||!navigator.mediaDevices?.getUserMedia)return Promise.resolve(status('unsupported'));
  const token=++generation;status('loading');
  const task=(async()=>{
   try{
    const acquired=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:320},height:{ideal:240},frameRate:{ideal:15,max:15}},audio:false});
    if(token!==generation||disposed||!enabled){acquired.getTracks().forEach(track=>track.stop());return 'ready';}
    stream=acquired;video=document.createElement('video');video.muted=true;video.autoplay=true;video.playsInline=true;video.width=320;video.height=240;
    video.style.cssText='position:fixed;left:-9999px;top:0;width:1px;height:1px;pointer-events:none';video.setAttribute('aria-hidden','true');video.srcObject=stream;document.body.append(video);
    stream.getTracks().forEach(track=>{track.onended=()=>{if(token===generation)stopCamera('ended');};});
    const currentVideo=video;
    await new Promise((resolve,reject)=>{rejectInit=reject;initTimer=setTimeout(()=>reject(new Error('Camera playback timed out')),30000);currentVideo.play().then(resolve,reject);});
    clearTimeout(initTimer);initTimer=0;rejectInit=null;if(token!==generation)return state;
    const activeWorker=new Worker(new URL('./gesture-tracker-worker.js',import.meta.url));worker=activeWorker;
    await new Promise((resolve,reject)=>{
     rejectInit=reject;initTimer=setTimeout(()=>reject(new Error('Hand tracker initialization timed out')),30000);
     activeWorker.onerror=()=>{if(token!==generation)return;reject(new Error('Hand tracker worker failed'));stopCamera('error');};
     activeWorker.onmessage=event=>{
      if(token!==generation)return;const data=event.data;
      if(data.type==='ready'){clearTimeout(initTimer);initTimer=0;rejectInit=null;resolve();}
      else if(data.type==='result'){clearTimeout(frameTimer);frameTimer=0;handResult(data.landmarks,data.width,data.height);loopTimer=setTimeout(pump,84);}
      else if(data.type==='error'||data.type==='unsupported'){reject(new Error('Hand tracker inference failed'));stopCamera(data.type==='unsupported'?'unsupported':'error');}
     };
     activeWorker.postMessage({type:'init'});
    });
    if(token!==generation)return state;status('camera');pump();return 'camera';
    async function pump(){
     if(token!==generation||!stream||!worker)return;
     if(currentVideo.readyState<2||currentVideo.currentTime===lastVideoTime){loopTimer=setTimeout(pump,84);return;}
     lastVideoTime=currentVideo.currentTime;let bitmap=null;
     try{
      const width=currentVideo.videoWidth||320,height=currentVideo.videoHeight||240,scale=Math.min(1,256/Math.max(width,height));
      bitmap=await createImageBitmap(currentVideo,{resizeWidth:Math.round(width*scale),resizeHeight:Math.round(height*scale)});
      if(token!==generation){bitmap.close();return;}
      frameTimer=setTimeout(()=>{if(token===generation)stopCamera('error');},5000);
      activeWorker.postMessage({type:'frame',image:bitmap,timestamp:performance.now()},[bitmap]);bitmap=null;
     }catch(error){bitmap?.close();if(token===generation)stopCamera('error');}
    }
   }catch(error){if(token!==generation)return state;const next=error.name==='NotAllowedError'?'denied':error.name==='NotFoundError'?'unsupported':'error';stopCamera(next);return next;}
  })();
  pending=task;task.finally(()=>{if(pending===task)pending=null;});return task;
 }
 const onVisibility=()=>{if(document.hidden&&(stream||pending))stopCamera('paused');};document.addEventListener('visibilitychange',onVisibility);
 function dispose(){if(disposed)return;setEnabled(false);disposed=true;document.removeEventListener('visibilitychange',onVisibility);scene.remove(points);geometry.dispose();material.dispose();texture.dispose();}
 status('ready');
 return {setEnabled,update,setPointer,startCamera,stopCamera,dispose,get video(){return video;},get cameraActive(){return !!stream;}};
}
