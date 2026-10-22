import {exhibits} from './exhibits.js';
const text={
 zh:{title:'聚纹成器 · 青花全息',hint:'移动手掌或拖动屏幕，转动全息器形。捏合或按住蓄能，松开释放纹样光环，青花随后缓缓归位。',camera:'启用摄像头手势',stop:'关闭摄像头',exit:'返回展馆',privacy:'以当前展品器形与纹饰演绎的艺术光效。手势在本机识别，不上传或录制画面。',ready:'按住蓄能 · 松开舒展',shapeOnly:'纹饰暂未读取，器形光效仍可体验',loading:'正在准备手势识别…',cameraOn:'摄像头已开启，请伸出一只手',tracking:'已识别手掌 · 捏合蓄能，张开释放',noHand:'请把手掌放入画面',denied:'未获得摄像头权限，仍可触控体验',unsupported:'此浏览器暂不支持摄像头手势，仍可触控体验',error:'手势识别暂不可用，仍可触控体验',paused:'摄像头已关闭，可再次手动开启',failed:'体验暂时无法加载，请关闭后重试'},
 en:{title:'Porcelain hologram',hint:'Move your palm or drag to turn the hologram. Pinch or hold to gather energy; release to unfold the patterns into light, then watch the vessel reform.',camera:'Enable camera gestures',stop:'Turn camera off',exit:'Return to museum',privacy:'An artistic light study of the current exhibit’s form and decoration. Tracking stays on this device; video is not uploaded or recorded.',ready:'Hold to gather · Release to unfold',shapeOnly:'Decoration unavailable · The vessel light study still works',loading:'Preparing hand tracking…',cameraOn:'Camera on · Show one hand',tracking:'Hand detected · Pinch to gather, open to release',noHand:'Place your palm in the camera view',denied:'Camera permission was not granted; touch still works',unsupported:'Camera gestures are unavailable here; touch still works',error:'Hand tracking is unavailable; touch still works',paused:'Camera off · Enable it again to resume',failed:'This experience could not load. Close and try again.'}
};
Object.assign(text.zh,{hint:'触屏：拖动旋转，长按后松开星散。摄像头：单指左划下一件／右划上一件，双指转动，张掌散开，握拳聚合。',ready:'选择光效，或拖动与长按体验',tracking:'手势已连接 · 单指切换 / 双指旋转 / 张掌散开 / 握拳聚合',orbit:'器形旋转',vortex:'涡流环绕',scatter:'全域星散',previous:'上一件全息展品',next:'下一件全息展品',switching:'正在准备下一件，当前光效仍可操作…',switchError:'切换未完成，当前展品保留，请重试'});
Object.assign(text.en,{hint:'Touch: drag to rotate; hold and release to scatter. Camera: one finger swipe left/right for next/previous, two fingers rotate, open palm scatters, fist gathers.',ready:'Choose an effect, drag or hold to explore',tracking:'Tracking · One finger switches / two rotate / open scatters / fist gathers',orbit:'Vessel',vortex:'Vortex',scatter:'Starfield',previous:'Previous hologram',next:'Next hologram',switching:'Preparing the next exhibit; you can still interact…',switchError:'Switch failed. The current exhibit is safe; please retry.'});

export function createGestureExperience({THREE,scene,camera,renderer,controls,isDesktop,getModel,getLanguage,cancelIntro,pauseEffects,getEffectsPaused,switchExhibit,cancelSwitch}){
 let mode=null,effect=null,pending=null,generation=0,disposed=false,state='ready',index=0,switchState='idle',holdTimer=0,recognized='';
 const lifetime=new AbortController(),pointers=new Map();
 const dock=document.createElement('section');dock.id='museumGestureDock';dock.hidden=true;dock.setAttribute('aria-labelledby','gestureTitle');
 dock.innerHTML='<header><h2 id="gestureTitle"></h2><button type="button" id="gestureExit"></button></header><div class="gesture-controls"><nav class="gesture-exhibits"><button type="button" id="gesturePrevious">‹</button><div><span id="gestureCounter"></span><strong id="gestureExhibitName"></strong></div><button type="button" id="gestureNext">›</button></nav><div class="gesture-actions"><button type="button" data-action="orbit"></button><button type="button" data-action="vortex"></button><button type="button" data-action="scatter"></button></div></div><p id="gestureSwitchStatus" role="status" aria-live="polite" hidden></p><p id="gestureHint"></p><div class="gesture-camera"><button type="button" id="gestureCamera"></button><span id="gestureStatus" role="status" aria-live="polite"></span></div><p class="note" id="gesturePrivacy"></p>';
 document.body.append(dock);
 const guide=document.createElement('aside');guide.id='museumGestureGuide';guide.hidden=true;
 guide.innerHTML='<strong id="gestureGuideTitle"></strong><div class="gesture-guide-steps"></div><p id="gestureTouchHint"></p>';
 document.body.append(guide);$('gestureHint').remove();
 function $(id){return dock.querySelector('#'+id)||guide.querySelector('#'+id);}
 function status(value){state=value;translate();}
 function translate(){
  const t=text[getLanguage()]||text.zh;
  const zh=getLanguage()==='zh';
  $('gestureTitle').textContent=t.title;$('gestureExit').textContent=t.exit;$('gesturePrivacy').textContent=t.privacy;
  $('gestureGuideTitle').textContent=zh?'摄像头手势 · 在下方手动开启':'Camera gestures · Enable below';
  const instructions=zh?[['食指停顿后划动','左下一件 · 右上一件；收指后可再切'],['双指移动','食指＋中指旋转'],['张开手掌','粒子向四周散开'],['握紧拳头','聚合回当前器形']]:[['One finger','Pause, swipe left: next / right: previous. Lower finger to repeat.'],['Two fingers','Index + middle: move to rotate'],['Open palm','Spread particles in all directions'],['Fist','Gather particles into the vessel']];
  const steps=guide.querySelector('.gesture-guide-steps');
  if(guide.dataset.language!==String(zh)){steps.replaceChildren(...instructions.map(([name,hint])=>{const item=document.createElement('div'),label=document.createElement('b'),detail=document.createElement('span');label.textContent=name;detail.textContent=hint;item.append(label,detail);return item;}));guide.dataset.language=String(zh);}
  $('gestureTouchHint').textContent=zh?'触屏 / 鼠标：拖动旋转 · 长按蓄能，松开星散':'Touch / mouse: drag to rotate; hold then release to scatter, or choose an effect below.';
  $('gestureCamera').textContent=effect?.cameraActive?t.stop:t.camera;$('gestureCamera').disabled=state==='loading'||!effect;
  $('gestureStatus').textContent=t[{camera:'cameraOn','no-hand':'noHand',ended:'paused'}[state]||state]||t.ready;
  if(state==='tracking'&&recognized){const labels=zh?{one:'单指 · 停顿后左右划切换',two:'双指 · 移动旋转',open:'张掌 · 全域星散',fist:'握拳 · 聚合成器',pinch:'捏合 · 蓄能'}:{one:'One finger · Swipe left / right',two:'Two fingers · Move to rotate',open:'Open palm · Scatter',fist:'Fist · Gather',pinch:'Pinch · Charge'};if(labels[recognized])$('gestureStatus').textContent=labels[recognized];}
  const busy=switchState==='loading'||switchState==='moving';
  $('gestureCounter').textContent=`${String(index+1).padStart(2,'0')} / ${String(exhibits.length).padStart(2,'0')}`;
  $('gestureExhibitName').textContent=exhibits[index][getLanguage()]?.exhibit||exhibits[index].zh.exhibit;
  dock.querySelector('.gesture-exhibits').setAttribute('aria-busy',String(busy));
  for(const [id,key] of [['gesturePrevious','previous'],['gestureNext','next']]){$(id).setAttribute('aria-label',t[key]);$(id).disabled=busy||!effect;}
  $('gestureSwitchStatus').hidden=!busy&&switchState!=='error';$('gestureSwitchStatus').textContent=busy?t.switching:t.switchError;
  for(const button of dock.querySelectorAll('[data-action]')){button.textContent=t[button.dataset.action];button.setAttribute('aria-pressed',String((effect?.action||'orbit')===button.dataset.action));button.disabled=!effect;}
 }
 function cancelInputs(){clearTimeout(holdTimer);holdTimer=0;pointers.clear();effect?.cancelInputs();}
 function close(){
  generation++;if(!mode)return;
  const previous=mode;mode=null;cancelSwitch();cancelInputs();effect?.setEnabled(false);
  dock.querySelector('video')?.remove();dock.hidden=guide.hidden=true;document.body.classList.remove('museum-gesture');
  controls.enabled=previous.enabled;controls.autoRotate=previous.auto;pauseEffects(previous.paused);
  const canFocus=node=>node?.isConnected&&node!==document.body&&node.getClientRects?.().length!==0;
  const focus=[previous.focus,document.getElementById('museumMore'),document.getElementById('museumLanguage')].find(canFocus);
  focus?.focus({preventScroll:true});state='ready';
 }
 async function open(){
  if(disposed||mode)return;cancelIntro();
  mode={enabled:controls.enabled,auto:controls.autoRotate,paused:getEffectsPaused(),focus:document.activeElement};
  controls.enabled=false;controls.autoRotate=false;pauseEffects(true);document.body.classList.add('museum-gesture');dock.hidden=guide.hidden=false;state='loading';translate();$('gestureExit').focus({preventScroll:true});
  // Clear the orbit's residual inertia without moving the saved museum viewpoint.
  const position=camera.position.clone(),target=controls.target.clone(),damping=controls.enableDamping;
  controls.enableDamping=false;controls.update(0);camera.position.copy(position);controls.target.copy(target);controls.update(0);controls.enableDamping=damping;
  const token=++generation;
  try{
   pending ||= import('./gesture-particles.js').catch(error=>{pending=null;throw error;});
   const {createGestureParticles}=await pending;if(!mode||token!==generation||disposed)return;
   effect ||= createGestureParticles({THREE,scene,camera,renderer,isDesktop,getModel,onStatus:result=>{if(mode){recognized=result.gesture||'';status(result.state);}},onSwitch:direction=>{if(mode&&(switchState==='idle'||switchState==='error'))switchExhibit(direction);}});
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
 for(const [id,direction] of [['gesturePrevious',-1],['gestureNext',1]])listen($(id),'click',()=>{if(mode&&effect){cancelInputs();switchExhibit(direction);}});
 for(const button of dock.querySelectorAll('[data-action]'))listen(button,'click',()=>{if(mode){cancelInputs();effect?.setAction(button.dataset.action);translate();}});
 listen(document,'keydown',event=>{if(!mode)return;if(event.key==='Escape'){event.preventDefault();close();}
  if(event.key==='Tab'){const buttons=[...dock.querySelectorAll('button:not(:disabled)')];if(event.shiftKey&&document.activeElement===buttons[0]){event.preventDefault();buttons[buttons.length-1].focus();}else if(!event.shiftKey&&document.activeElement===buttons[buttons.length-1]){event.preventDefault();buttons[0].focus();}}
 });
 const canvas=renderer.domElement;
 function move(event,pinch){if(!mode||!effect||effect.cameraActive)return;const rect=canvas.getBoundingClientRect();effect.setPointer((event.clientX-rect.left)/rect.width,(event.clientY-rect.top)/rect.height,pinch);}
 listen(canvas,'pointerdown',event=>{if(!mode||!effect||effect.cameraActive||event.button!==0)return;event.preventDefault();pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});canvas.setPointerCapture?.(event.pointerId);move(event,0);
  clearTimeout(holdTimer);if(pointers.size===1)holdTimer=setTimeout(()=>{holdTimer=0;if(pointers.has(event.pointerId))move(event,1);},320);else cancelInputs();
 });
 listen(canvas,'pointermove',event=>{if(!mode)return;const start=pointers.get(event.pointerId);if(start&&Math.hypot(event.clientX-start.x,event.clientY-start.y)>8){clearTimeout(holdTimer);holdTimer=0;}move(event);});
 listen(canvas,'pointerup',event=>{if(!mode||!pointers.has(event.pointerId))return;pointers.delete(event.pointerId);clearTimeout(holdTimer);holdTimer=0;move(event,0);});
 for(const type of ['pointercancel','lostpointercapture'])listen(canvas,type,event=>{if(mode&&pointers.has(event.pointerId))cancelInputs();});
 listen(window,'blur',cancelInputs);
 listen(document,'visibilitychange',()=>{if(document.hidden&&mode){cancelInputs();effect?.stopCamera();dock.querySelector('video')?.remove();status('paused');}});
 listen(window,'pagehide',close);listen(canvas,'webglcontextlost',close);
 return {open,close,translate,galleryState(current,target,kind){index=current;switchState=kind;effect?.setSwitching(kind==='loading'||kind==='moving');translate();},changeModel(){if(mode&&effect){cancelInputs();effect.changeModel();translate();}},get active(){return !!mode;},update(delta){if(mode){controls.enabled=false;controls.autoRotate=false;if(!document.hidden)try{effect?.update(delta);}catch(error){console.warn('Gesture frame:',error);close();}}},dispose(){if(disposed)return;close();disposed=true;lifetime.abort();effect?.dispose();effect=null;dock.remove();guide.remove();}};
}
