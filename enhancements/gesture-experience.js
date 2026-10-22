const text={
 zh:{title:'聚纹成器 · 青花全息',hint:'移动手掌或拖动屏幕，转动全息器形。捏合或按住蓄能，松开释放纹样光环，青花随后缓缓归位。',camera:'启用摄像头手势',stop:'关闭摄像头',exit:'返回展馆',privacy:'以当前展品器形与纹饰演绎的艺术光效。手势在本机识别，不上传或录制画面。',ready:'按住蓄能 · 松开舒展',shapeOnly:'纹饰暂未读取，器形光效仍可体验',loading:'正在准备手势识别…',cameraOn:'摄像头已开启，请伸出一只手',tracking:'已识别手掌 · 捏合蓄能，张开释放',noHand:'请把手掌放入画面',denied:'未获得摄像头权限，仍可触控体验',unsupported:'此浏览器暂不支持摄像头手势，仍可触控体验',error:'手势识别暂不可用，仍可触控体验',paused:'摄像头已关闭，可再次手动开启',failed:'体验暂时无法加载，请关闭后重试'},
 en:{title:'Porcelain hologram',hint:'Move your palm or drag to turn the hologram. Pinch or hold to gather energy; release to unfold the patterns into light, then watch the vessel reform.',camera:'Enable camera gestures',stop:'Turn camera off',exit:'Return to museum',privacy:'An artistic light study of the current exhibit’s form and decoration. Tracking stays on this device; video is not uploaded or recorded.',ready:'Hold to gather · Release to unfold',shapeOnly:'Decoration unavailable · The vessel light study still works',loading:'Preparing hand tracking…',cameraOn:'Camera on · Show one hand',tracking:'Hand detected · Pinch to gather, open to release',noHand:'Place your palm in the camera view',denied:'Camera permission was not granted; touch still works',unsupported:'Camera gestures are unavailable here; touch still works',error:'Hand tracking is unavailable; touch still works',paused:'Camera off · Enable it again to resume',failed:'This experience could not load. Close and try again.'}
};

export function createGestureExperience({THREE,scene,camera,renderer,controls,isDesktop,getModel,getLanguage,cancelIntro,pauseEffects,getEffectsPaused}){
 let mode=null,effect=null,pending=null,generation=0,disposed=false,state='ready';
 const lifetime=new AbortController(),pointers=new Map();
 const dock=document.createElement('section');dock.id='museumGestureDock';dock.hidden=true;dock.setAttribute('aria-labelledby','gestureTitle');
 dock.innerHTML='<header><h2 id="gestureTitle"></h2><button type="button" id="gestureExit"></button></header><p id="gestureHint"></p><div class="gesture-camera"><button type="button" id="gestureCamera"></button><span id="gestureStatus" role="status" aria-live="polite"></span></div><p class="note" id="gesturePrivacy"></p>';
 document.body.append(dock);
 const $=id=>dock.querySelector('#'+id);
 function status(value){state=value;translate();}
 function translate(){
  const t=text[getLanguage()]||text.zh;
  $('gestureTitle').textContent=t.title;$('gestureHint').textContent=t.hint;$('gestureExit').textContent=t.exit;$('gesturePrivacy').textContent=t.privacy;
  $('gestureCamera').textContent=effect?.cameraActive?t.stop:t.camera;$('gestureCamera').disabled=state==='loading'||!effect;
  $('gestureStatus').textContent=t[{camera:'cameraOn','no-hand':'noHand',ended:'paused'}[state]||state]||t.ready;
 }
 function close(){
  generation++;if(!mode)return;
  const previous=mode;mode=null;pointers.clear();effect?.setEnabled(false);effect?.stopCamera();
  dock.querySelector('video')?.remove();dock.hidden=true;document.body.classList.remove('museum-gesture');
  controls.enabled=previous.enabled;controls.autoRotate=previous.auto;pauseEffects(previous.paused);
  const canFocus=node=>node?.isConnected&&node!==document.body&&node.getClientRects?.().length!==0;
  const focus=[previous.focus,document.getElementById('museumMore'),document.getElementById('museumLanguage')].find(canFocus);
  focus?.focus({preventScroll:true});state='ready';
 }
 async function open(){
  if(disposed||mode)return;cancelIntro();
  mode={enabled:controls.enabled,auto:controls.autoRotate,paused:getEffectsPaused(),focus:document.activeElement};
  controls.enabled=false;controls.autoRotate=false;pauseEffects(true);document.body.classList.add('museum-gesture');dock.hidden=false;state='loading';translate();$('gestureExit').focus({preventScroll:true});
  const token=++generation;
  try{
   pending ||= import('./gesture-particles.js').catch(error=>{pending=null;throw error;});
   const {createGestureParticles}=await pending;if(!mode||token!==generation||disposed)return;
   effect ||= createGestureParticles({THREE,scene,camera,renderer,isDesktop,getModel,onStatus:result=>{if(mode)status(result.state);}});
   effect.setEnabled(true);status(effect.textureAvailable?'ready':'shapeOnly');
  }catch(error){console.warn('Gesture experience:',error);if(mode&&token===generation)status('failed');}
 }
 async function toggleCamera(){
  if(!effect||!mode)return;
  if(effect.cameraActive){effect.stopCamera();dock.querySelector('video')?.remove();status('ready');return;}
  const token=generation;status('loading');
  try{await effect.startCamera();if(!mode||token!==generation)return;
   if(effect.cameraActive&&effect.video){effect.video.className='gesture-video';effect.video.removeAttribute('style');effect.video.removeAttribute('aria-hidden');effect.video.setAttribute('aria-label',getLanguage()==='zh'?'本机摄像头预览':'Local camera preview');dock.append(effect.video);}
   translate();
  }catch(error){console.warn('Gesture camera:',error);if(mode&&token===generation)status('error');}
 }
 const listen=(target,type,handler,options={})=>target.addEventListener(type,handler,{...options,signal:lifetime.signal});
 listen($('gestureExit'),'click',close);listen($('gestureCamera'),'click',toggleCamera);
 listen(document,'keydown',event=>{if(!mode)return;if(event.key==='Escape'){event.preventDefault();close();}
  if(event.key==='Tab'){const buttons=[...dock.querySelectorAll('button:not(:disabled)')];if(event.shiftKey&&document.activeElement===buttons[0]){event.preventDefault();buttons[buttons.length-1].focus();}else if(!event.shiftKey&&document.activeElement===buttons[buttons.length-1]){event.preventDefault();buttons[0].focus();}}
 });
 const canvas=renderer.domElement;
 function move(event){if(!mode||!effect||effect.cameraActive)return;const rect=canvas.getBoundingClientRect();effect.setPointer((event.clientX-rect.left)/rect.width,(event.clientY-rect.top)/rect.height,pointers.size?1:0);}
 listen(canvas,'pointerdown',event=>{if(!mode)return;event.preventDefault();pointers.set(event.pointerId,event);canvas.setPointerCapture?.(event.pointerId);move(event);});
 listen(canvas,'pointermove',event=>{if(mode){if(pointers.has(event.pointerId))pointers.set(event.pointerId,event);move(event);}});
 for(const type of ['pointerup','pointercancel'])listen(canvas,type,event=>{if(!mode)return;pointers.delete(event.pointerId);move(event);});
 listen(window,'blur',()=>{pointers.clear();if(mode)effect?.setPointer(.5,.5,0);});
 listen(document,'visibilitychange',()=>{if(document.hidden&&mode){pointers.clear();effect?.stopCamera();dock.querySelector('video')?.remove();status('paused');}});
 listen(window,'pagehide',close);listen(canvas,'webglcontextlost',close);
 return {open,close,translate,get active(){return !!mode;},update(delta){if(mode){controls.enabled=false;controls.autoRotate=false;if(!document.hidden)try{effect?.update(delta);}catch(error){console.warn('Gesture frame:',error);close();}}},dispose(){if(disposed)return;close();disposed=true;lifetime.abort();effect?.dispose();effect=null;dock.remove();}};
}
