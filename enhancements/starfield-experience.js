// One temporary owner of the museum canvas; the museum's existing loop calls render.
export function createStarfieldExperience({THREE,renderer,getLanguage,isDesktop}) {
 let current=null,generation=0,disposed=false;
 const canvas=renderer.domElement;
 let encoderPending=null;
 // Explicit export reserves; these are admission limits, not measured available VRAM.
 const integer=(n,label)=>{if(!Number.isSafeInteger(n)||n<1)throw new RangeError('Invalid '+label);return n;};
 function bloomSizes(width,height){
 integer(width,'width');integer(height,'height');let w=Math.round(width/2),h=Math.round(height/2);const rows=[[w,h]];
 for(let i=0;i<5;i++){rows.push([w,h],[w,h]);w=Math.round(w/2);h=Math.round(h/2);}return rows;
}
 function privateBytes(width,height,checker=false){
 integer(width,'width');integer(height,'height');if(typeof checker!=='boolean')throw new TypeError('Invalid checker');
 const pixels=width*height;if(!Number.isSafeInteger(pixels))throw new RangeError('Unsafe pixel count');
 const cur=(checker?Math.ceil(width/2):width)*height*8,hist=2*pixels*8,bloom=bloomSizes(width,height).reduce((n,[w,h])=>n+w*h*8,0);
 return {cur,hist,bloom,total:cur+hist+bloom};
}
 function estimate(width,height,{checker=false,liveWidth=1,liveHeight=1,liveChecker=checker,farResidentBytes=0,previewWidth=1,previewHeight=1,ownedBlobBytes=0}={}){
 for(const [n,label]of [[liveWidth,'liveWidth'],[liveHeight,'liveHeight'],[previewWidth,'previewWidth'],[previewHeight,'previewHeight']])integer(n,label);
 if(!Number.isSafeInteger(farResidentBytes)||farResidentBytes<0)throw new RangeError('Invalid far resident bytes');
 if(!Number.isSafeInteger(ownedBlobBytes)||ownedBlobBytes<0)throw new RangeError('Invalid owned PNG bytes');
 const exportCore=privateBytes(width,height,checker),liveCore=privateBytes(liveWidth,liveHeight,liveChecker),pixels=width*height;
 const persistentCoreTextures=128**3+2048*1024*8,persistentCoreCPU=128**3,outputRT=pixels*4,readback=pixels*4,imageData=pixels*4,canvas2D=pixels*4;
 const encoderReserve=pixels*4+height+65536,preview=previewWidth*previewHeight*4;
 const constant=persistentCoreTextures+persistentCoreCPU+ownedBlobBytes+farResidentBytes+preview;
 const phases={allocation:constant+liveCore.total+exportCore.total+outputRT,readback:constant+exportCore.total+outputRT+readback+imageData+canvas2D+encoderReserve,restore:constant+exportCore.total+liveCore.total+readback+imageData+canvas2D+encoderReserve};
 const peakBytes=Math.max(...Object.values(phases));if(!Number.isSafeInteger(peakBytes))throw new RangeError('Unsafe byte estimate');
 return {width,height,pixels,checker,exportCore,liveCore,persistentCoreTextures,persistentCoreCPU,ownedBlobBytes,farResidentBytes,preview,outputRT,readback,imageData,canvas2D,encoderReserve,phases,peakBytes};
}
 function choose({aspect,maxWidth=3840,maxTextureSize,maxViewportDims,maxPixels,budgetBytes,...memory}){
 if(!Number.isFinite(aspect)||aspect<=0)throw new RangeError('Invalid aspect');
 for(const [n,label]of [[maxWidth,'maxWidth'],[maxTextureSize,'maxTextureSize'],[maxPixels,'maxPixels'],[budgetBytes,'budgetBytes']])integer(n,label);
 if(!Array.isArray(maxViewportDims)||maxViewportDims.length!==2)throw new TypeError('Invalid viewport limits');maxViewportDims.forEach(n=>integer(n,'viewport limit'));
 const maxW=Math.min(maxWidth,maxTextureSize,maxViewportDims[0]),maxH=Math.min(maxTextureSize,maxViewportDims[1]);
 const candidate=w=>{const h=Math.max(1,Math.round(w/aspect));if(h>maxH||w*h>maxPixels)return null;const value=estimate(w,h,memory);return value.peakBytes<=budgetBytes?value:null;};
 let low=1,high=maxW,result=null;while(low<=high){const mid=Math.floor((low+high)/2),value=candidate(mid);if(value){result=value;low=mid+1;}else high=mid-1;}
 if(!result)throw new RangeError('No export size within the explicitly supplied limits');return {...result,requestedMaxWidth:maxWidth,limited:result.width!==maxWidth,label:result.width+'×'+result.height};
}
 function flipInto(source,width,height,destination){
 integer(width,'width');integer(height,'height');const length=width*height*4;
 if(!Number.isSafeInteger(length)||!ArrayBuffer.isView(source)||!ArrayBuffer.isView(destination)||source.BYTES_PER_ELEMENT!==1||destination.BYTES_PER_ELEMENT!==1||source.length!==length||destination.length!==length)throw new RangeError('Invalid RGBA image shape');
 if(source.buffer===destination.buffer)throw new TypeError('Flip needs separate source and destination storage');
 for(let y=0;y<height;y++)destination.set(source.subarray((height-1-y)*width*4,(height-y)*width*4),y*width*4);return destination;
}

 const words={
  zh:{title:'青花入星河',subtitle:'星河观景 · 黑洞近景艺术演绎',loading:'正在准备星河近景…',unavailable:'这台设备暂不支持星河近景。可返回原处继续看展。',failed:'星河近景暂时无法使用。可返回原处继续看展。',view:'视角',views:['掠过光环','贴近盘面','俯瞰星河'],pause:'暂停',resume:'继续',plunge:'坠入',orbit:'回到轨道',back:'返回原处',exiting:'再按立即返回',advanced:'高级参数与截图',quality:'渲染分辨率',reconstruction:'重建',sampling:'每帧采样',output:'输出画布',baseline:'100%基准',sizeUnavailable:'此尺寸暂不可用，已保留原设置。可选择自动。',sizeFallback:'窗口尺寸已变化，已切回自动分辨率。',auto:'自动',image:'保存高清 PNG · 24 帧',captureCancel:'取消 PNG',captureCancelled:'已取消 PNG，可继续观景。',captureProgress:'正在累积高清 PNG',captureReady:'PNG 已准备',captureEncoding:'PNG 编码仍在完成，请稍候。',preparing:'正在准备 PNG…',save:'下载观景 PNG',approx:'坠入为无自旋的史瓦西近似，属于艺术演绎，非实测。',spinReset:'坠入期间暂用无自旋近似；回到轨道后恢复原自旋。',end:'已到达近似视界。可回到轨道，或返回原处。',hint:'拖动观察 · 滚轮 / 双指缩放；暂停后仍可手动观察。',reduced:'已按减少动态偏好暂停；可手动观察或点“继续”。',distance:'距离',clock:'固有时间',error:'观景 PNG 未能生成，请重试。',canvas:'星河近景，可拖动观察'},
  en:{title:'Porcelain among the stars',subtitle:'Starfield observatory · Artistic black-hole close-up',loading:'Preparing the starfield…',unavailable:'This device cannot display the close-up. Return to continue viewing the museum.',failed:'The close-up is temporarily unavailable. Return to continue viewing the museum.',view:'View',views:['Across the halo','Along the disk','Above the starfield'],pause:'Pause',resume:'Resume',plunge:'Plunge',orbit:'Back to orbit',back:'Return to where I was',exiting:'Press again to return now',advanced:'Advanced settings and image',quality:'Render resolution',reconstruction:'Reconstruction',sampling:'Samples per frame',output:'Output canvas',baseline:'100% baseline',sizeUnavailable:'This size is unavailable. Your previous setting is retained; choose Automatic.',sizeFallback:'The viewport changed; render resolution has returned to Automatic.',auto:'Automatic',image:'Save HD PNG · 24 samples',captureCancel:'Cancel PNG',captureCancelled:'PNG cancelled. Viewing has resumed.',captureProgress:'Accumulating HD PNG',captureReady:'PNG ready',captureEncoding:'The PNG encoder is still finishing. Please wait.',preparing:'Preparing PNG…',save:'Download observatory PNG',approx:'The plunge uses a non-rotating Schwarzschild approximation: artistic visualization, not a measurement.',spinReset:'The plunge temporarily uses zero spin; returning to orbit restores your spin setting.',end:'The approximate horizon has been reached. Return to orbit or to where you were.',hint:'Drag to look · Wheel / pinch to zoom. Manual viewing remains available while paused.',reduced:'Paused for your reduced-motion preference. Look manually or choose Resume.',distance:'Distance',clock:'Proper time',error:'The observatory PNG could not be created. Try again.',canvas:'Starfield close-up; drag to look'}
 };
 const settings=[
  ['spin','自旋','Spin',0,.998,.001],['steps','光线积分步数','Ray steps',100,1000,10],['doppler','多普勒强度','Doppler strength',0,1,.01],
  ['inner','盘内缘','Inner disk',.5,6,.01],['outer','盘外缘','Outer disk',4,24,.1],['thick','盘厚度','Disk thickness',0,2,.01],
  ['temp','盘温度','Disk temperature',1500,15000,50],['bright','盘亮度','Disk brightness',.2,5,.01],['speed','盘流动速度','Disk speed',0,10,.1],
  ['hotR','热点半径','Hot-spot radius',.6,12,.05],['jetBright','喷流亮度','Jet brightness',0,4,.01],['stars','星光','Stars',0,3,.01],['nebula','星云','Nebula',0,3,.01],
  ['bloom','泛光','Bloom',0,3,.01],['bloomRadius','泛光半径','Bloom radius',0,1,.01],['exposure','曝光','Exposure',.2,3,.01],
  ['lensing','引力透镜','Gravitational lensing'],['followIsco','内缘跟随 ISCO','Follow ISCO'],['hotSpot','盘上热点','Disk hot spot'],['jets','喷流','Jets'],['checker','交错重建（每帧半采样）','Interleaved reconstruction (half samples per frame)'],['autoRotate','自动环绕','Automatic orbit']
 ];
 const language=()=>getLanguage()==='en'?'en':'zh';
 function reportFailure(owner,error){
  owner.shell.dataset.status='error';owner.status.textContent=owner.t[error?.code==='MUSEUM_STARFIELD_UNSUPPORTED'?'unavailable':'failed'];
  console.warn('Museum starfield unavailable:',error);
 }
 function clearPointers(owner){
  for(const [pointerId,pointerType] of owner.pointers){
   try{canvas.dispatchEvent(new PointerEvent('pointercancel',{bubbles:true,pointerId,pointerType}));}catch{}
   try{if(canvas.hasPointerCapture?.(pointerId))canvas.releasePointerCapture(pointerId);}catch{}
  }
  owner.pointers.clear();
 }
 function close(reason='return'){
  generation++;const owner=current;if(!owner)return;current=null;owner.lifetime.abort();
  if(owner.captureJob)cancelCapture(owner,'close',null,false);
  const attempt=fn=>{try{fn();}catch(error){console.warn('Museum starfield cleanup:',error);}};
  for(const [node,event,fn] of owner.listeners)attempt(()=>node.removeEventListener(event,fn));
  attempt(()=>clearPointers(owner));attempt(()=>owner.controls?.dispose());attempt(()=>owner.core?.dispose());
  if(owner.url)attempt(()=>{URL.revokeObjectURL(owner.url);owner.url=null;owner.urlBytes=0;});
  attempt(()=>{
   const {parent,next,style,tabindex,ariaLabel}=owner.original;
   if(next?.parentNode===parent)parent.insertBefore(canvas,next);else parent.appendChild(canvas);
   for(const [name,value] of [['style',style],['tabindex',tabindex],['aria-label',ariaLabel]])if(value===null)canvas.removeAttribute(name);else canvas.setAttribute(name,value);
  });
  for(const state of owner.hidden)attempt(()=>{state.node.inert=state.inert;if(state.aria===null)state.node.removeAttribute('aria-hidden');else state.node.setAttribute('aria-hidden',state.aria);});
  attempt(()=>owner.shell.remove());
  if(owner.original.focus?.isConnected)attempt(()=>owner.original.focus.focus({preventScroll:true}));
  // Recoverable failures restore the parked workshop too; the error remains recorded above.
  if(owner.onReturn)attempt(()=>owner.onReturn(reason==='dispose'?'dispose':'return'));
 }
 function listen(owner,node,event,fn,options={}){node.addEventListener(event,fn,{...options,signal:owner.lifetime.signal});owner.listeners.push([node,event,fn]);}
 function requestReturn(owner){
  if(owner.captureJob){cancelCapture(owner,'return');close();return;}
  if(!owner.core||owner.exiting||owner.paused){close();return;}
  const from=new THREE.Spherical().setFromVector3(owner.camera.position);owner.exiting={from,t:0,fov:owner.camera.fov,velocity:owner.velocity.clone()};owner.transition=null;owner.controls.enabled=false;owner.advanced.open=false;
  for(const input of owner.shell.querySelectorAll('button,select,input'))input.disabled=true;
  owner.returnButton.disabled=false;owner.returnButton.textContent=owner.t.exiting;
 }
 function setView(owner,radius,phi,theta){owner.camera.position.setFromSpherical(new THREE.Spherical(radius,THREE.MathUtils.degToRad(phi),THREE.MathUtils.degToRad(theta)));owner.camera.lookAt(0,0,0);}
 // Original kr / qi / Yg spherical paths, with names expanded and no second animation loop.
 function preset(owner,radius,phi,duration=2.6){const from=new THREE.Spherical().setFromVector3(owner.camera.position);owner.transition={from,to:new THREE.Spherical(radius,THREE.MathUtils.degToRad(phi),from.theta),t:0,duration};owner.core.resetHistory();}
 function updatePreset(owner,delta){
  const move=owner.transition;if(!move)return;move.t=Math.min(1,move.t+delta/move.duration);
  const ease=move.t<.5?4*move.t**3:1-(-2*move.t+2)**3/2,theta=new THREE.Spherical().setFromVector3(owner.camera.position).theta;
  owner.camera.position.setFromSpherical(new THREE.Spherical(THREE.MathUtils.lerp(move.from.radius,move.to.radius,ease),THREE.MathUtils.lerp(move.from.phi,move.to.phi,ease),theta));if(move.t>=1)owner.transition=null;
 }
 function returnToOrbit(owner){
  if(!owner.plunge)return;
  Object.assign(owner.core.params,owner.plunge.saved);owner.plunge=null;owner.velocity.set(0,0,0);owner.core.sync();
  owner.camera.fov=50;owner.camera.updateProjectionMatrix();owner.controls.enabled=true;setView(owner,40,75,25);preset(owner,22,84.5,4);
  owner.view.disabled=false;owner.plungeButton.textContent=owner.t.plunge;owner.status.textContent=owner.t.approx;updateSettings(owner);
 }
 function startPlunge(owner){
  if(!owner.core)return;if(owner.plunge){returnToOrbit(owner);return;}
  const position=new THREE.Spherical().setFromVector3(owner.camera.position);position.phi=THREE.MathUtils.clamp(position.phi,THREE.MathUtils.degToRad(20),THREE.MathUtils.degToRad(70));position.radius=Math.max(position.radius,14);
  const {spin,inner,followIsco,exposure,bloom}=owner.core.params;owner.plunge={dir:new THREE.Vector3().setFromSpherical(position).normalize(),r:position.radius,tau:0,done:false,saved:{spin,inner,followIsco,exposure,bloom}};
  owner.core.params.spin=0;owner.core.sync();owner.transition=null;owner.controls.enabled=false;owner.view.disabled=true;
  owner.plungeButton.textContent=owner.t.orbit;owner.status.textContent=spin?owner.t.spinReset:owner.t.approx;updateSettings(owner);owner.core.resetHistory();
 }
 // Original ah / qg / $g radial integration and camera path; plunge always uses spin zero.
 function updatePlunge(owner,delta){
  const fall=owner.plunge;if(!fall)return;
  if(!fall.done){const step=(.6+.25*fall.r)*delta;for(let i=0;i<8;i++)fall.r-=Math.sqrt(1/fall.r)*step/8;fall.tau+=step;if(fall.r<=1.04){fall.r=1.04;fall.done=true;}}
  const speed=Math.min(Math.sqrt(1/fall.r),.995);owner.camera.position.copy(fall.dir).multiplyScalar(fall.r);owner.camera.fov=THREE.MathUtils.lerp(50,95,1-THREE.MathUtils.smoothstep(fall.r,1.5,10));owner.camera.updateProjectionMatrix();owner.camera.lookAt(0,0,0);owner.velocity.copy(fall.dir).multiplyScalar(-speed);
  const dark=1-THREE.MathUtils.smoothstep(fall.r,1.2,6);owner.core.params.exposure=Math.max(.2,fall.saved.exposure*(1-.55*dark));owner.core.params.bloom=fall.saved.bloom*(1-.85*dark);owner.core.sync();
  owner.status.textContent=fall.done?owner.t.end:`${owner.t.distance} ${fall.r.toFixed(2)} rₛ · ${owner.t.clock} ${fall.tau.toFixed(1)} rₛ/c · ${owner.t.approx}`;
 }
 function updateSettings(owner){
  for(const input of owner.advanced.querySelectorAll('[data-param]')){
   const name=input.dataset.param;input.disabled=!owner.core||!!owner.plunge&&['spin','exposure','bloom','followIsco','inner'].includes(name);
   if(!owner.core)continue;const value=owner.core.params[name];if(input.type==='checkbox')input.checked=value;else input.value=String(value);
   const output=input.closest('label')?.querySelector('output');if(output)output.value=String(value);
  }
 }
 function resize(owner){
  const css=renderer.getSize(new THREE.Vector2()),output=renderer.getDrawingBufferSize(new THREE.Vector2()),dpr=Math.min(window.devicePixelRatio||1,1.5),baseW=css.x*dpr,baseH=css.y*dpr;
  const quality=owner.core.params.quality,budget=Math.min(1,Math.sqrt(2000000/(baseW*baseH)),owner.maxSize/baseW,owner.maxSize/baseH),scale=quality==='auto'?budget*owner.scale:Number(quality);
  const w=Math.max(1,Math.floor(baseW*scale)),h=Math.max(1,Math.floor(baseH*scale));
  if(!Number.isFinite(w*h)||w>owner.maxSize||h>owner.maxSize||w*h>(owner.mobile?2000000:4000000))throw Object.assign(new RangeError('Starfield size exceeds the device budget'),{code:'MUSEUM_STARFIELD_SIZE'});
  const checker=owner.core.params.checker;
  if(owner.size?.[0]!==w||owner.size?.[1]!==h||owner.size?.[2]!==output.x||owner.size?.[3]!==output.y||owner.size?.[4]!==checker||owner.size?.[5]!==baseW||owner.size?.[6]!==baseH){
   owner.core.resize(w,h);owner.camera.aspect=css.x/css.y;owner.camera.updateProjectionMatrix();owner.core.resetHistory();owner.size=[w,h,output.x,output.y,checker,baseW,baseH];
   owner.resolution.textContent=`${owner.t.reconstruction} ${w}×${h} · ${owner.t.sampling} ${checker?Math.ceil(w/2):w}×${h} · ${owner.t.output} ${output.x}×${output.y} · ${owner.t.baseline} ${Math.floor(baseW)}×${Math.floor(baseH)}`;
  }
 }
 function resetFeedback(owner){owner.sampleTime=owner.samples=owner.slowFrames=owner.firstSlowDelta=0;owner.feedbackReady=false;}
 function adapt(owner,delta){
   if(owner.paused||owner.core.params.quality!=='auto'||document.hidden){resetFeedback(owner);return;}
   if(delta<=0)return;
   // Skip the first visible interval after ready/resume; it may include synchronous setup.
   if(!owner.feedbackReady){owner.feedbackReady=true;return;}
   let samples=1;
   if(delta>.25){
    // One isolated stall is not a sustained slow cadence. Require its next visible frame too.
    if(!owner.slowFrames){owner.sampleTime=owner.samples=0;owner.slowFrames=1;owner.firstSlowDelta=delta;return;}
    if(owner.slowFrames===1){delta+=owner.firstSlowDelta;samples=2;owner.slowFrames=2;owner.firstSlowDelta=0;}
   }else if(owner.slowFrames){owner.sampleTime=owner.samples=owner.slowFrames=owner.firstSlowDelta=0;}
   owner.sampleTime+=delta;owner.samples+=samples;if(owner.sampleTime<1)return;
   const rate=owner.samples/owner.sampleTime;owner.scale=THREE.MathUtils.clamp(owner.scale*(rate<45?.9:rate>58?1.02:1),.3,1);owner.sampleTime=owner.samples=0;
  }
 function draw(owner,delta=0){
  const target=renderer.getRenderTarget(),face=renderer.getActiveCubeFace?.()||0,mip=renderer.getActiveMipmapLevel?.()||0,viewport=renderer.getViewport(new THREE.Vector4()),scissor=renderer.getScissor(new THREE.Vector4()),test=renderer.getScissorTest(),color=renderer.getClearColor(new THREE.Color()),alpha=renderer.getClearAlpha();
  const keys=['autoClear','autoClearColor','autoClearDepth','autoClearStencil','localClippingEnabled','outputColorSpace','toneMapping','toneMappingExposure'],state=keys.map(k=>renderer[k]);
  try{
   try{resize(owner);}catch(error){
    if(error.code!=='MUSEUM_STARFIELD_SIZE'||owner.core.params.quality==='auto')throw error;
    owner.core.params.quality='auto';owner.qualityInput.value='auto';owner.scale=1;resetFeedback(owner);owner.core.sync();resize(owner);owner.status.textContent=owner.t.sizeFallback;
   }
   owner.camera.updateMatrixWorld();owner.core.render(owner.time,owner.velocity,null,delta);
  }
  finally{keys.forEach((key,i)=>{renderer[key]=state[i];});renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(test);renderer.setClearColor(color,alpha);renderer.setRenderTarget(target,face,mip);}
 }
 function render(delta){
  const owner=current;if(!owner?.core)return;
  if(owner.captureJob){advanceCapture(owner);return;}
  try{
   if(!Number.isFinite(delta)||delta<0)throw new RangeError('Invalid starfield frame time');
   const step=Math.min(delta,.1);adapt(owner,delta);
   owner.controls.autoRotate=!owner.paused&&!owner.plunge&&!owner.exiting&&owner.core.params.autoRotate;
   if(owner.exiting){
    const move=owner.exiting;move.t=Math.min(1,move.t+step/.5);const ease=move.t*move.t*(3-2*move.t);
    owner.camera.position.setFromSpherical(new THREE.Spherical(THREE.MathUtils.lerp(move.from.radius,Math.max(40,move.from.radius*1.35),ease),move.from.phi,move.from.theta));owner.camera.fov=THREE.MathUtils.lerp(move.fov,50,ease);owner.camera.updateProjectionMatrix();owner.camera.lookAt(0,0,0);owner.velocity.copy(move.velocity).multiplyScalar(1-ease);draw(owner,step);if(move.t===1)close();return;
   }
   if(!owner.paused){owner.time+=step;if(owner.plunge)updatePlunge(owner,step);else updatePreset(owner,step);}
   if(!owner.plunge)owner.controls.update(owner.paused?0:step);
   const css=renderer.getSize(new THREE.Vector2()),view=[...owner.camera.position.toArray(),...owner.camera.quaternion.toArray(),owner.camera.fov,canvas.width,canvas.height,css.x,css.y,window.devicePixelRatio||1].join(',');if(view!==owner.lastView){owner.lastView=view;owner.settled=0;}
   if(!owner.paused||owner.dirty||owner.settled<16){draw(owner,step);owner.dirty=false;owner.settled++;}
  }catch(error){reportFailure(owner,error);close('error');}
 }
 function capture(){
  const owner=current;if(!owner?.core)throw new Error('Starfield is not ready');
  if(owner.captureJob)throw Object.assign(new Error('PNG capture is in progress'),{code:'MUSEUM_STARFIELD_CAPTURE_BUSY'});
  draw(owner,0);return copyCanvas();
 }
 function copyCanvas(){
  const image=document.createElement('canvas');image.width=canvas.width;image.height=canvas.height;
  try{const context=image.getContext('2d');if(!context)throw new Error('Image canvas unavailable');context.drawImage(canvas,0,0);return image;}
  catch(error){image.width=image.height=0;throw error;}
 }
 function captureViewport(){const size=renderer.getSize(new THREE.Vector2());return [size.x,size.y,canvas.width,canvas.height,window.devicePixelRatio||1].join(',');}
 function captureSignature(owner){owner.camera.updateMatrixWorld();return JSON.stringify([owner.time,owner.velocity.toArray(),owner.camera.position.toArray(),owner.camera.quaternion.toArray(),owner.camera.fov,owner.camera.aspect,owner.core.params]);}
 function captureGuard(action){
  const target=renderer.getRenderTarget(),face=renderer.getActiveCubeFace(),mip=renderer.getActiveMipmapLevel(),viewport=renderer.getViewport(new THREE.Vector4()),scissor=renderer.getScissor(new THREE.Vector4()),test=renderer.getScissorTest(),color=renderer.getClearColor(new THREE.Color()),alpha=renderer.getClearAlpha();
  const keys=['autoClear','autoClearColor','autoClearDepth','autoClearStencil','localClippingEnabled','outputColorSpace','toneMapping','toneMappingExposure'],state=keys.map(k=>renderer[k]);let failed=false,primary,result;
  try{result=action();}catch(error){failed=true;primary=error;}
  finally{for(const restore of [()=>keys.forEach((key,i)=>{renderer[key]=state[i];}),()=>renderer.setViewport(viewport),()=>renderer.setScissor(scissor),()=>renderer.setScissorTest(test),()=>renderer.setClearColor(color,alpha),()=>renderer.setRenderTarget(target,face,mip)])try{restore();}catch(error){if(!failed){failed=true;primary=error;}}}
  if(failed)throw primary;return result;
 }
 function restoreCaptureLive(owner,job,restore=true){
  if(job.liveRestored)return;job.liveRestored=true;
  if(job.target){const target=job.target;job.target=null;try{target.dispose();}catch(error){job.cleanupErrors.push(error);}}
  if(!restore||current!==owner||!owner.core||renderer.getContext().isContextLost())return;
  try{
   owner.time=job.time;owner.velocity.copy(job.velocity);owner.camera.position.copy(job.position);owner.camera.quaternion.copy(job.quaternion);owner.camera.fov=job.fov;
   Object.assign(owner.core.params,job.params);owner.core.sync();owner.size=null;resize(owner);owner.core.resetHistory();
  }catch(error){owner.size=null;job.cleanupErrors.push(error);}
  owner.lastView=null;owner.dirty=true;owner.settled=0;
 }
 function finishCapture(owner,job,restore=true){
  if(job.finished)return;job.finished=true;try{restoreCaptureLive(owner,job,restore);}catch(error){job.cleanupErrors.push(error);}
  for(const action of [()=>{if(job.preview){job.preview.remove();job.preview.width=job.preview.height=0;job.preview=null;}},()=>{if(job.image){job.image.width=job.image.height=0;job.image=null;}},()=>{job.pixels=null;},()=>{if(owner.controls){owner.controls.enabled=job.controls.enabled;owner.controls.autoRotate=job.controls.autoRotate;}},()=>{for(const [node,disabled]of job.inputs)node.disabled=disabled;}])try{action();}catch(error){job.cleanupErrors.push(error);}
  if(owner.captureJob===job){owner.captureJob=null;resetFeedback(owner);}
  if(current===owner)try{owner.imageButton.textContent=owner.t.image;owner.imageButton.disabled=!!encoderPending;updateSettings(owner);owner.shell.dataset.captureStatus=job.error?'error':job.cancelled?'cancelled':'completed';}catch(error){job.cleanupErrors.push(error);}
  for(const error of job.cleanupErrors)console.warn('Museum starfield PNG cleanup:',error);
 }
 function cancelCapture(owner,reason='cancel',error=null,restore=true){
  const job=owner.captureJob;if(!job)return;job.cancelled=true;job.error=error;finishCapture(owner,job,restore);
  if(current===owner){owner.status.textContent=error?owner.t.error:owner.t.captureCancelled;if(error)console.warn('Museum starfield PNG:',error);}
 }
 async function encodeCapture(owner,job){
  encoderPending=job;let createdURL=null;
  try{
   const image=job.image,blob=await new Promise((resolve,reject)=>image.toBlob(value=>value?resolve(value):reject(new Error('PNG encoder unavailable')),'image/png'));
   if(current!==owner||owner.captureJob!==job||job.cancelled)return;
   createdURL=URL.createObjectURL(blob);const old=owner.url,link={href:owner.download.href,download:owner.download.download,hidden:owner.download.hidden};
   try{owner.download.href=createdURL;owner.download.download=`qinghua-starfield-${job.size.width}x${job.size.height}.png`;owner.download.hidden=false;}
   catch(error){for(const key of ['href','download','hidden'])try{owner.download[key]=link[key];}catch(cleanupError){job.cleanupErrors.push(cleanupError);}throw error;}
   owner.url=createdURL;owner.urlBytes=Number.isSafeInteger(blob.size)&&blob.size>=0?blob.size:job.size.encoderReserve;createdURL=null;if(old)try{URL.revokeObjectURL(old);}catch(error){job.cleanupErrors.push(error);}owner.status.textContent=`${owner.t.captureReady} ${job.size.label} · 24/24`;
  }catch(error){job.error=error;if(current===owner&&owner.captureJob===job){owner.status.textContent=owner.t.error;console.warn('Museum starfield PNG:',error);}}
  finally{
   if(createdURL)try{URL.revokeObjectURL(createdURL);}catch(error){job.cleanupErrors.push(error);}
   if(encoderPending===job)encoderPending=null;finishCapture(owner,job);
   if(current?.core&&current.shell.dataset.status==='ready'&&!current.exiting&&!current.captureJob&&!encoderPending){current.imageButton.disabled=false;current.imageButton.textContent=current.t.image;}
  }
 }
 function advanceCapture(owner){
  const job=owner.captureJob;if(!job)return;
  try{
   if(captureViewport()!==job.viewport||document.hidden||captureSignature(owner)!==job.signature||performance.now()>job.deadline){cancelCapture(owner,'changed');return;}
   if(job.phase==='encoding')return;
   owner.core.captureSample(job.time,job.velocity,job.index,job.target);job.index++;
   if(current!==owner||owner.captureJob!==job||job.cancelled)return;
   owner.imageButton.textContent=`${owner.t.captureCancel} · ${job.index}/24`;owner.status.textContent=`${owner.t.captureProgress} ${job.size.label} · ${job.index}/24`;
   if(job.index!==24)return;
   const {width,height}=job.size;job.pixels=new Uint8Array(width*height*4);captureGuard(()=>renderer.readRenderTargetPixels(job.target,0,0,width,height,job.pixels));
   if(current!==owner||owner.captureJob!==job||job.cancelled)return;
   job.image=document.createElement('canvas');job.image.width=width;job.image.height=height;const context=job.image.getContext('2d');if(!context)throw new Error('Image canvas unavailable');
   const image=context.createImageData(width,height);flipInto(job.pixels,width,height,image.data);context.putImageData(image,0,0);job.pixels=null;
   restoreCaptureLive(owner,job);if(job.cleanupErrors.length)throw job.cleanupErrors[0];job.phase='encoding';owner.shell.dataset.captureStatus='encoding';encodeCapture(owner,job);
  }catch(error){cancelCapture(owner,'error',error);}
 }
 function savePNG(owner){
  if(current!==owner||!owner.core)return;
  if(owner.captureJob){cancelCapture(owner);return;}
  if(encoderPending){owner.status.textContent=owner.t.captureEncoding;return;}
  let job=null;
  try{
   draw(owner,0);const limits=renderer.getContext().getParameter(renderer.getContext().MAX_VIEWPORT_DIMS),size=choose({aspect:owner.camera.aspect,maxWidth:3840,maxTextureSize:renderer.capabilities.maxTextureSize,maxViewportDims:Array.from(limits),maxPixels:owner.mobile?6000000:9000000,budgetBytes:(owner.mobile?192:512)*2**20,checker:owner.core.params.checker,liveWidth:owner.size[0],liveHeight:owner.size[1],liveChecker:owner.core.params.checker,farResidentBytes:12*2**20,previewWidth:canvas.width,previewHeight:canvas.height,ownedBlobBytes:owner.url?owner.urlBytes:0});
   job={size,time:owner.time,velocity:owner.velocity.clone(),position:owner.camera.position.clone(),quaternion:owner.camera.quaternion.clone(),fov:owner.camera.fov,params:{...owner.core.params},controls:{enabled:owner.controls.enabled,autoRotate:owner.controls.autoRotate},inputs:[...owner.shell.querySelectorAll('button,select,input')].map(node=>[node,node.disabled]),viewport:captureViewport(),signature:captureSignature(owner),deadline:performance.now()+30000,index:0,phase:'capturing',target:null,preview:null,image:null,pixels:null,cancelled:false,finished:false,liveRestored:false,cleanupErrors:[]};
   owner.captureJob=job;clearPointers(owner);owner.controls.enabled=owner.controls.autoRotate=false;
   for(const [input]of job.inputs)input.disabled=true;owner.returnButton.disabled=owner.imageButton.disabled=false;
   job.preview=copyCanvas();job.preview.setAttribute('aria-hidden','true');job.preview.style.pointerEvents='none';job.preview.style.zIndex='0';owner.shell.appendChild(job.preview);
   owner.core.resize(size.width,size.height);owner.core.resetHistory();job.target=new THREE.WebGLRenderTarget(size.width,size.height,{type:THREE.UnsignedByteType,format:THREE.RGBAFormat,depthBuffer:false,stencilBuffer:false});job.target.texture.colorSpace=THREE.NoColorSpace;
   captureGuard(()=>{renderer.setRenderTarget(job.target);const gl=renderer.getContext();if(gl.isContextLost()||gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('PNG framebuffer unavailable');});
   owner.shell.dataset.captureStatus='capturing';owner.imageButton.textContent=`${owner.t.captureCancel} · 0/24`;owner.status.textContent=`${owner.t.captureProgress} ${size.label} · 0/24`;
  }catch(error){if(job)cancelCapture(owner,'error',error);else{owner.status.textContent=owner.t.error;console.warn('Museum starfield PNG:',error);}}
 }
 async function open({onReturn}={}){
  if(disposed||current)return false;
  const lang=language(),t=words[lang],shell=document.createElement('section');shell.id='museumStarfieldOverlay';shell.className='starfield-overlay';shell.dataset.status='loading';shell.setAttribute('role','dialog');shell.setAttribute('aria-modal','true');shell.setAttribute('aria-labelledby','starfieldTitle');
  shell.innerHTML=`<header class="starfield-heading"><h2 id="starfieldTitle">${t.title}</h2><p>${t.subtitle}</p></header><div class="starfield-main"><label>${t.view}<select data-action="view" disabled>${t.views.map((v,i)=>`<option value="${i}">${v}</option>`).join('')}</select></label><button type="button" data-action="pause" disabled>${t.pause}</button><button type="button" data-action="plunge" disabled>${t.plunge}</button><button type="button" data-action="return">${t.back}</button></div><div class="starfield-information"><p data-testid="starfieldStatus" role="status" aria-live="polite">${t.loading}</p><p class="starfield-hint">${t.hint}</p></div><details class="starfield-advanced"><summary>${t.advanced}</summary><div class="starfield-settings"><label>${t.quality}<select data-action="quality" disabled><option value="auto">${t.auto}</option>${[.5,.75,1].map(v=>`<option value="${v}">${v*100}%</option>`).join('')}</select></label>${settings.map(([key,zh,en,min,max,step])=>`<label>${lang==='en'?en:zh}${min===undefined?`<input data-param="${key}" type="checkbox" disabled>`:`<output></output><input data-param="${key}" type="range" min="${min}" max="${max}" step="${step}" disabled>`}</label>`).join('')}</div><p data-testid="starfieldResolution" class="starfield-approximation"></p><p class="starfield-approximation">${t.approx}</p><button type="button" data-action="png" disabled>${t.image}</button><a data-action="download" download="qinghua-starfield.png" hidden>${t.save}</a></details>`;
  const original={parent:canvas.parentNode,next:canvas.nextSibling,style:canvas.getAttribute('style'),tabindex:canvas.getAttribute('tabindex'),ariaLabel:canvas.getAttribute('aria-label'),focus:document.activeElement};
  const owner={shell,t,original,onReturn:typeof onReturn==='function'?onReturn:null,lifetime:new AbortController(),hidden:[],listeners:[],pointers:new Map(),core:null,controls:null,camera:null,velocity:new THREE.Vector3(),time:0,scale:1,sampleTime:0,samples:0,feedbackReady:false,slowFrames:0,firstSlowDelta:0,size:null,plunge:null,transition:null,exiting:null,settled:0,dirty:true,lastView:null,url:null,urlBytes:0,mobile:!isDesktop(),paused:matchMedia('(prefers-reduced-motion: reduce)').matches};current=owner;const token=++generation;
  const find=selector=>shell.querySelector(selector);owner.status=find('[data-testid=starfieldStatus]');owner.view=find('[data-action=view]');owner.plungeButton=find('[data-action=plunge]');owner.pauseButton=find('[data-action=pause]');owner.advanced=find('details');owner.imageButton=find('[data-action=png]');owner.download=find('[data-action=download]');owner.resolution=find('[data-testid=starfieldResolution]');
  try{
   document.body.appendChild(shell);shell.prepend(canvas);canvas.style.touchAction='none';canvas.setAttribute('tabindex','0');canvas.setAttribute('aria-label',t.canvas);
   for(const node of [...document.body.children])if(node!==shell){owner.hidden.push({node,inert:node.inert,aria:node.getAttribute('aria-hidden')});node.inert=true;node.setAttribute('aria-hidden','true');}
   const exit=find('[data-action=return]');owner.returnButton=exit;listen(owner,exit,'click',()=>requestReturn(owner));exit.focus({preventScroll:true});
   listen(owner,shell,'keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();close();return;}
    if(event.key!=='Tab')return;
    const nodes=[...shell.querySelectorAll('button:not(:disabled),select:not(:disabled),input:not(:disabled),a[href],summary,[tabindex="0"]')].filter(node=>!node.hidden&&node.getClientRects().length);
    const first=nodes[0],last=nodes.at(-1);if(!first)return;
    if(!shell.contains(document.activeElement)||event.shiftKey&&document.activeElement===first||!event.shiftKey&&document.activeElement===last){event.preventDefault();(event.shiftKey?last:first).focus({preventScroll:true});}
   });
   listen(owner,canvas,'pointerdown',event=>owner.pointers.set(event.pointerId,event.pointerType),{capture:true});for(const name of ['pointerup','pointercancel','lostpointercapture'])listen(owner,canvas,name,event=>owner.pointers.delete(event.pointerId),{capture:true});
   listen(owner,window,'blur',()=>clearPointers(owner));listen(owner,document,'visibilitychange',()=>{resetFeedback(owner);if(document.hidden){clearPointers(owner);cancelCapture(owner,'hidden');}});listen(owner,window,'resize',()=>{if(owner.captureJob)cancelCapture(owner,'resize');});
   listen(owner,canvas,'webglcontextlost',()=>{reportFailure(owner,Object.assign(new Error('Starfield context lost'),{code:'MUSEUM_CONTEXT_LOST'}));close('contextlost');});listen(owner,window,'pagehide',()=>close('pagehide'));
   const [{createStarfieldCore},{OrbitControls}]=await Promise.all([import('./starfield-core.js'),import('../vendor/controls/OrbitControls.js')]);
   if(current!==owner||token!==generation||disposed)return false;
   owner.camera=new THREE.PerspectiveCamera(50,1,.1,1000);setView(owner,22,84.5,25);
   owner.controls=new OrbitControls(owner.camera,canvas);Object.assign(owner.controls,{enableDamping:!owner.paused,dampingFactor:.06,enablePan:false,minDistance:2.5,maxDistance:70,rotateSpeed:.5,autoRotateSpeed:.25,autoRotate:false});owner.controls.update(0);
   const gl=renderer.getContext(),limits=gl.getParameter(gl.MAX_VIEWPORT_DIMS);owner.maxSize=Math.min(renderer.capabilities.maxTextureSize,...limits);
   // Preserve the source's 2K nebula; interleaved sampling remains an independent setting.
   owner.core=createStarfieldCore({THREE,renderer,camera:owner.camera,isMobile:false});owner.core.params.checker=owner.mobile||/Mac/i.test(navigator.platform||'')||/Mac OS X/.test(navigator.userAgent);owner.core.params.quality='auto';owner.core.params.spin=0;owner.core.params.freeze=owner.paused;owner.core.sync();
   listen(owner,owner.controls,'start',()=>{owner.transition=null;});listen(owner,owner.controls,'change',()=>{owner.dirty=true;});
   listen(owner,owner.view,'change',()=>{const views=[[22,84.5],[16,89.2],[30,18]],view=views[Number(owner.view.value)];if(view&&!owner.plunge)preset(owner,...view);});
   listen(owner,owner.pauseButton,'click',()=>{
    owner.paused=!owner.paused;resetFeedback(owner);const position=owner.camera.position.clone(),target=owner.controls.target.clone();owner.controls.enableDamping=false;owner.controls.autoRotate=false;owner.controls.update(0);owner.camera.position.copy(position);owner.controls.target.copy(target);owner.controls.update(0);owner.controls.enableDamping=!owner.paused;
    owner.core.params.freeze=owner.paused;owner.core.sync();owner.dirty=true;owner.pauseButton.textContent=t[owner.paused?'resume':'pause'];owner.pauseButton.setAttribute('aria-pressed',String(owner.paused));
   });
   listen(owner,owner.plungeButton,'click',()=>startPlunge(owner));listen(owner,owner.imageButton,'click',()=>savePNG(owner));
   const quality=find('[data-action=quality]');owner.qualityInput=quality;quality.value='auto';listen(owner,quality,'change',()=>{
    const old=owner.core.params.quality,scale=owner.scale;owner.core.params.quality=quality.value==='auto'?'auto':Number(quality.value);owner.scale=1;
    try{owner.core.sync();resize(owner);resetFeedback(owner);owner.dirty=true;owner.settled=0;if([owner.t.sizeUnavailable,owner.t.sizeFallback].includes(owner.status.textContent))owner.status.textContent=owner.t.approx;}
    catch(error){if(current!==owner)return;owner.core.params.quality=old;owner.scale=scale;owner.size=null;owner.dirty=true;owner.settled=0;quality.value=String(old);try{owner.core.sync();}catch(recovery){reportFailure(owner,recovery);close('error');return;}owner.status.textContent=owner.t.sizeUnavailable;console.warn('Museum starfield resolution:',error);}
   });
   listen(owner,owner.advanced,'input',event=>{
    const input=event.target;if(!input.matches('[data-param]')||input.disabled)return;const key=input.dataset.param,old={...owner.core.params};
    owner.core.params[key]=input.type==='checkbox'?input.checked:Number(input.value);if(key==='inner')owner.core.params.followIsco=false;
    try{owner.core.sync();owner.core.resetHistory();owner.dirty=true;owner.settled=0;}catch(error){if(current!==owner)return;Object.assign(owner.core.params,old);try{owner.core.sync();}catch(recovery){reportFailure(owner,recovery);close('error');return;}console.warn('Museum starfield setting:',error);}updateSettings(owner);
   });
   if(!owner.paused){setView(owner,26,84.5,25);preset(owner,22,84.5,.8);}draw(owner,0);
   owner.view.disabled=owner.pauseButton.disabled=owner.plungeButton.disabled=owner.imageButton.disabled=quality.disabled=false;owner.pauseButton.textContent=t[owner.paused?'resume':'pause'];owner.pauseButton.setAttribute('aria-pressed',String(owner.paused));updateSettings(owner);
   owner.imageButton.disabled=!!encoderPending;shell.dataset.status='ready';resetFeedback(owner);owner.status.textContent=owner.paused?t.reduced:t.approx;return true;
  }catch(error){
   if(current!==owner||token!==generation)return false;reportFailure(owner,error);
   for(const input of shell.querySelectorAll('button,select,input'))input.disabled=true;owner.returnButton.disabled=false;
   try{owner.controls?.dispose();}catch(cleanupError){console.warn('Museum starfield cleanup:',cleanupError);}owner.controls=null;
   try{owner.core?.dispose();}catch(cleanupError){console.warn('Museum starfield cleanup:',cleanupError);}owner.core=null;
   return true;
  }
 }
 return {open,render,capture,close,dispose(){if(disposed)return;disposed=true;close('dispose');},get active(){return !!current;}};
}
