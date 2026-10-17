const text={
 zh:{title:'掌中青花',hint:'拖动屏幕移动花纹；按住或双指触碰，让花瓣收拢。也可启用摄像头，用手掌移动、拇指与食指捏合控制。',camera:'启用摄像头手势',stop:'关闭摄像头',exit:'返回展馆',privacy:'手势在本机识别，不上传或录制画面。',ready:'触控 / 鼠标体验已就绪',loading:'正在准备手势识别…',cameraOn:'摄像头已开启，请伸出一只手',tracking:'已识别手掌 · 捏合收拢，张开舒展',noHand:'请把手掌放入画面',denied:'未获得摄像头权限，仍可触控体验',unsupported:'此浏览器暂不支持摄像头手势，仍可触控体验',error:'手势识别暂不可用，仍可触控体验',paused:'摄像头已关闭，可再次手动开启',failed:'体验暂时无法加载，请关闭后重试'},
 en:{title:'Porcelain in your palm',hint:'Drag to move the pattern; hold or touch with two fingers to gather the petals. Or enable the camera: move your palm and pinch your thumb and index finger.',camera:'Enable camera gestures',stop:'Turn camera off',exit:'Return to museum',privacy:'Hand tracking runs on this device. Video is not uploaded or recorded.',ready:'Touch / mouse interaction ready',loading:'Preparing hand tracking…',cameraOn:'Camera on · Show one hand',tracking:'Hand detected · Pinch to gather, open to bloom',noHand:'Place your palm in the camera view',denied:'Camera permission was not granted; touch still works',unsupported:'Camera gestures are unavailable here; touch still works',error:'Hand tracking is unavailable; touch still works',paused:'Camera off · Enable it again to resume',failed:'This experience could not load. Close and try again.'}
};

export function createGestureExperience({THREE,scene,camera,renderer,controls,isDesktop,getLanguage,cancelIntro,pauseEffects,getEffectsPaused}){
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
   effect ||= createGestureParticles({THREE,scene,camera,renderer,isDesktop,onStatus:result=>{if(mode)status(result.state);}});
   effect.setEnabled(true);status('ready');
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
  if(event.key==='Tab'){const buttons=[...dock.querySelectorAll('button:not(:disabled)')];if(event.shiftKey&&document.activeElement===buttons[0]){event.preventDefault();buttons.at(-1).focus();}else if(!event.shiftKey&&document.activeElement===buttons.at(-1)){event.preventDefault();buttons[0].focus();}}
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
