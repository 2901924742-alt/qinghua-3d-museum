import {exhibits} from './exhibits.js';
const text={
 zh:{title:'聚纹成器 · 青花全息',hint:'移动手掌或拖动屏幕，转动全息器形。捏合或按住蓄能，松开释放纹样光环，青花随后缓缓归位。',camera:'启用摄像头手势',stop:'关闭摄像头',exit:'返回展馆',privacy:'以当前展品器形与纹饰演绎的艺术光效。手势在本机识别，不上传或录制画面。',ready:'按住蓄能 · 松开舒展',shapeOnly:'纹饰暂未读取，器形光效仍可体验',loading:'正在准备手势识别…',cameraOn:'摄像头已开启，请伸出一只手',tracking:'已识别手掌 · 捏合蓄能，张开释放',noHand:'请把手掌放入画面',denied:'未获得摄像头权限，仍可触控体验',unsupported:'此浏览器暂不支持摄像头手势，仍可触控体验',error:'手势识别暂不可用，仍可触控体验',paused:'摄像头已关闭，可再次手动开启',failed:'体验暂时无法加载，请关闭后重试'},
 en:{title:'Porcelain hologram',hint:'Move your palm or drag to turn the hologram. Pinch or hold to gather energy; release to unfold the patterns into light, then watch the vessel reform.',camera:'Enable camera gestures',stop:'Turn camera off',exit:'Return to museum',privacy:'An artistic light study of the current exhibit’s form and decoration. Tracking stays on this device; video is not uploaded or recorded.',ready:'Hold to gather · Release to unfold',shapeOnly:'Decoration unavailable · The vessel light study still works',loading:'Preparing hand tracking…',cameraOn:'Camera on · Show one hand',tracking:'Hand detected · Pinch to gather, open to release',noHand:'Place your palm in the camera view',denied:'Camera permission was not granted; touch still works',unsupported:'Camera gestures are unavailable here; touch still works',error:'Hand tracking is unavailable; touch still works',paused:'Camera off · Enable it again to resume',failed:'This experience could not load. Close and try again.'}
};
Object.assign(text.zh,{hint:'触屏：拖动旋转，长按后松开星散。摄像头：单指左划下一件／右划上一件，双指转动，张掌散开，握拳聚合。',ready:'选择光效，或拖动与长按体验',tracking:'手势已连接 · 单指切换 / 双指旋转 / 张掌散开 / 握拳聚合',orbit:'器形旋转',vortex:'涡流环绕',scatter:'全域星散',previous:'上一件全息展品',next:'下一件全息展品',switching:'正在准备下一件，当前光效仍可操作…',switchError:'切换未完成，当前展品保留，请重试'});
Object.assign(text.en,{hint:'Touch: drag to rotate; hold and release to scatter. Camera: one finger swipe left/right for next/previous, two fingers rotate, open palm scatters, fist gathers.',ready:'Choose an effect, drag or hold to explore',tracking:'Tracking · One finger switches / two rotate / open scatters / fist gathers',orbit:'Vessel',vortex:'Vortex',scatter:'Starfield',previous:'Previous hologram',next:'Next hologram',switching:'Preparing the next exhibit; you can still interact…',switchError:'Switch failed. The current exhibit is safe; please retry.'});

text.zh.insecure='手机摄像头需要可信 HTTPS；电脑请使用 localhost 地址打开。触控仍可使用。';
text.en.insecure='Camera access needs trusted HTTPS on a phone. On this computer, open the localhost address. Touch still works.';

export function createGestureExperience({THREE,scene,camera,renderer,controls,isDesktop,getModel,getLanguage,cancelIntro,pauseEffects,getEffectsPaused,switchExhibit,cancelSwitch}){
 let mode=null,effect=null,pending=null,generation=0,disposed=false,state='ready',index=0,switchState='idle',holdTimer=0,recognized='',uiHidden=false,blockedUntil=0,diagnosticAt=0,diagnosticURL=null;
 const diagnosticsEnabled=new URLSearchParams(location.search).has('diagnostics');
 const lifetime=new AbortController(),pointers=new Map();
 const dock=document.createElement('section');dock.id='museumGestureDock';dock.hidden=true;dock.setAttribute('aria-labelledby','gestureTitle');
 dock.innerHTML='<header><h2 id="gestureTitle"></h2><div class="gesture-window-controls"><button type="button" id="gestureHideUI"></button><button type="button" id="gestureExit"></button></div></header><div class="gesture-controls"><nav class="gesture-exhibits"><button type="button" id="gesturePrevious">‹</button><div><span id="gestureCounter"></span><strong id="gestureExhibitName"></strong></div><button type="button" id="gestureNext">›</button></nav><div class="gesture-actions"><button type="button" data-action="orbit"></button><button type="button" data-action="vortex"></button><button type="button" data-action="scatter"></button></div></div><p id="gestureSwitchStatus" role="status" aria-live="polite" hidden></p><p id="gestureHint"></p><div class="gesture-camera"><button type="button" id="gestureCamera"></button><span id="gestureStatus" role="status" aria-live="polite"></span></div><p class="note" id="gesturePrivacy"></p>';
 document.body.append(dock);
 const guide=document.createElement('aside');guide.id='museumGestureGuide';guide.hidden=true;
 guide.innerHTML='<strong id="gestureGuideTitle"></strong><div class="gesture-guide-steps"></div><p id="gestureTouchHint"></p>';
 document.body.append(guide);$('gestureHint').remove();
 const showUI=document.createElement('button');showUI.id='gestureShowUI';showUI.type='button';showUI.hidden=true;showUI.setAttribute('aria-controls','museumGestureDock museumGestureGuide');document.body.append(showUI);
 if(diagnosticsEnabled){
  const panel=document.createElement('details');panel.className='gesture-diagnostics';
  panel.innerHTML='<summary id="gestureDiagnosticTitle"></summary><p id="gestureDiagnosticNote" class="note"></p><pre id="gestureDiagnosticStats"></pre><div class="gesture-diagnostic-actions"><button type="button" id="gestureDiagnosticReset"></button><button type="button" id="gestureDiagnosticExport"></button></div>';
  dock.append(panel);
 }
 function $(id){return dock.querySelector('#'+id)||guide.querySelector('#'+id);}
 function status(value){state=value;translate();}
 function translate(){
  const t=text[getLanguage()]||text.zh;
  const zh=getLanguage()==='zh',bloom=!!mode?.bloom,scan=!!mode?.scan;
  dock.dataset.mode=scan?'scan':bloom?'bloom':'particles';
  $('gestureTitle').textContent=scan?(zh?'全息扫描台 · 器形光谱':'Surface scan · Porcelain spectrum'):bloom?(zh?'纹样活化 · 一器生花':'Living ornament · Porcelain in bloom'):t.title;
  $('gestureExit').textContent=mode?.onReturn?(zh?'返回创意工坊':'Back to workshop'):t.exit;
  $('gesturePrivacy').textContent=scan?(zh?'外壁采样的艺术扫描，非 CT、非实测，不推断内部结构。摄像头仅本机识别，不上传或录制画面。':'Artistic traces of sampled exterior surfaces, not CT or measurement. No interior is inferred. Camera tracking stays on this device; no video is uploaded or recorded.'):bloom?(zh?'取青花花卉意象绘制的原创光纹，属于艺术演绎，非原件纹样复原。摄像头仅在本机识别，不上传或录制画面。':'Original floral light art inspired by blue-and-white porcelain, not a reconstruction of an original decoration. Camera tracking remains on this device; no video is uploaded or recorded.'):t.privacy;
  $('gestureHideUI').textContent=zh?'隐藏界面':'Hide interface';showUI.textContent=zh?'显示界面':'Show interface';
  if(diagnosticsEnabled){
   $('gestureDiagnosticTitle').textContent=zh?'本机诊断（不上传）':'Local diagnostics (not uploaded)';
   $('gestureDiagnosticNote').textContent=zh?'检测到手的比例不等于准确率。正确、漏触发和误触发请记录到测试表；导出不含画面或关键点。':'Hand detection ratio is not accuracy. Log correct, missed and false actions separately. Exports contain no images or landmarks.';
   $('gestureDiagnosticReset').textContent=zh?'重置统计':'Reset statistics';$('gestureDiagnosticExport').textContent=zh?'导出测试数据':'Export diagnostics';
   updateDiagnostics();
  }
  $('gestureGuideTitle').textContent=zh?'摄像头手势 · 在下方手动开启':'Camera gestures · Enable below';
  const instructions=zh?[['食指左右划动','左下一件 · 右上一件；收指后可再切'],['双指转动','横移转整圈 · 上下看俯仰；收指再移可接着转'],['张开手掌',scan?'光谱向四面八方散解':bloom?'缠枝向外舒展 · 一器生花':'向前后左右扩散成粒子云'],['握紧拳头',scan?'聚合回器形 · 继续扫描':bloom?'花枝收拢 · 聚纹成器':'聚合回当前器形']]:[['One finger','Swipe left: next / right: previous. Lower finger to repeat.'],['Two fingers','Move sideways to spin, vertically to tilt. Lower and reposition to continue.'],['Open palm',scan?'Disperse the spectrum in all directions':bloom?'Unfold the flowering vines':'Expand into a cloud with depth'],['Fist',scan?'Reform the vessel and continue scanning':bloom?'Gather the vines around the vessel':'Gather particles into the vessel']];
  const steps=guide.querySelector('.gesture-guide-steps');
  const guideKey=String(zh)+'-'+bloom+'-'+scan;if(guide.dataset.language!==guideKey){steps.replaceChildren(...instructions.map(([name,hint])=>{const item=document.createElement('div'),label=document.createElement('b'),detail=document.createElement('span');label.textContent=name;detail.textContent=hint;item.append(label,detail);return item;}));guide.dataset.language=guideKey;}
  $('gestureTouchHint').textContent=scan?(zh?'触屏 / 鼠标：拖动旋转 · 长按松开散解；点“表面扫描”重新聚合，无需开启摄像头。':'Touch / mouse: drag to rotate; hold and release to disperse. Choose Surface scan to reform; a camera is optional.'):bloom?(zh?'触屏 / 鼠标：拖动旋转 · 长按后松开生花；也可用下方按钮舒展、回旋与收拢。':'Touch / mouse: drag to rotate; hold and release to bloom, or use the effect buttons below.'):(zh?'触屏 / 鼠标：拖动旋转 · 长按蓄能，松开星散':'Touch / mouse: drag to rotate; hold then release to scatter, or choose an effect below.');
  $('gestureCamera').textContent=effect?.cameraActive?t.stop:t.camera;$('gestureCamera').disabled=state==='loading'||!effect||!mode?.ready;
  $('gestureStatus').textContent=t[{camera:'cameraOn','no-hand':'noHand',ended:'paused'}[state]||state]||t.ready;
  if(scan&&state==='ready')$('gestureStatus').textContent=zh?'蓝白光谱扫描中 · 拖动旋转，或长按松开散解':'Blue-white scan active · Drag to rotate, or hold and release to disperse';
  if(state==='tracking'&&recognized){const labels=zh?{one:'单指 · 左右划动切换',two:'双指 · 横移旋转，上下俯仰',open:'张掌 · 立体星散',fist:'握拳 · 聚合成器',pinch:'捏合 · 蓄能'}:{one:'One finger · Swipe left / right',two:'Two fingers · Spin and tilt',open:'Open palm · Spatial cloud',fist:'Fist · Gather',pinch:'Pinch · Charge'};if(bloom){labels.open=zh?'张掌 · 缠枝生花':'Open palm · Unfold flowers';labels.fist=zh?'握拳 · 聚纹成器':'Fist · Gather floral light';}if(labels[recognized])$('gestureStatus').textContent=labels[recognized];}
  if(blockedUntil>performance.now())$('gestureStatus').textContent=zh?'正在切换展品，完成后收指再划动':'Switch in progress; lower your finger and swipe again when ready';
  const busy=switchState==='loading'||switchState==='moving';
  $('gestureCounter').textContent=`${String(index+1).padStart(2,'0')} / ${String(exhibits.length).padStart(2,'0')}`;
  $('gestureExhibitName').textContent=exhibits[index][getLanguage()]?.exhibit||exhibits[index].zh.exhibit;
  dock.querySelector('.gesture-exhibits').setAttribute('aria-busy',String(busy));
  for(const [id,key] of [['gesturePrevious','previous'],['gestureNext','next']]){$(id).setAttribute('aria-label',t[key]);$(id).disabled=busy||!effect||!mode?.ready;}
  $('gestureSwitchStatus').hidden=!busy&&switchState!=='error';$('gestureSwitchStatus').textContent=busy?t.switching:t.switchError;
  for(const button of dock.querySelectorAll('[data-action]')){button.textContent=scan?(zh?{orbit:'表面扫描',vortex:'光谱回旋',scatter:'全域散解'}:{orbit:'Surface scan',vortex:'Light vortex',scatter:'Disperse'})[button.dataset.action]:bloom?(zh?{orbit:'聚纹成器',vortex:'缠枝回旋',scatter:'一器生花'}:{orbit:'Gather',vortex:'Floral orbit',scatter:'Bloom'})[button.dataset.action]:t[button.dataset.action];button.setAttribute('aria-pressed',String((effect?.action||'orbit')===button.dataset.action));button.disabled=!effect||!mode?.ready;}
 }
 function cancelInputs(){clearTimeout(holdTimer);holdTimer=0;pointers.clear();effect?.cancelInputs();}
 function updateDiagnostics(force=false){
  if(!diagnosticsEnabled||(!force&&!dock.querySelector('.gesture-diagnostics').open))return;
  const now=performance.now();if(!force&&now-diagnosticAt<1000)return;diagnosticAt=now;
  const d=effect?.diagnostics,zh=getLanguage()==='zh';
  if(!d){$('gestureDiagnosticStats').textContent=zh?'进入体验后可查看统计。':'Statistics appear when the experience is ready.';return;}
  const n=value=>Number.isFinite(value)?value.toFixed(1):'—';
  $('gestureDiagnosticStats').textContent=(zh?[
   `结果频率：${n(d.resultHz)} 次/秒 · 样本 ${d.frames}`,
   `检测到手：${n(d.detectedRatio*100)}% · 漏检 ${d.misses}`,
   `推理：平均 ${n(d.inferenceMeanMs)} / 最大 ${n(d.inferenceMaxMs)} ms`,
   `帧往返：平均 ${n(d.roundTripMeanMs)} ms`,
   `送检间隔：平均 ${n(d.sampleIntervalMeanMs)} ms`,
   `姿势变化 ${d.poseFlips} · 切换 ${d.switches} · 忙碌拦截 ${d.blockedSwitches}`,
   `短暂恢复 ${d.graceRecoveries} · 不连续恢复 ${d.discontinuities}`,
   `实际采集 ${d.actualVideoWidth}×${d.actualVideoHeight} · 送检 ${d.inputWidth}×${d.inputHeight}`
  ]:[
   `Results: ${n(d.resultHz)} Hz · ${d.frames} samples`,
   `Hand detected: ${n(d.detectedRatio*100)}% · ${d.misses} misses`,
   `Inference: mean ${n(d.inferenceMeanMs)} / max ${n(d.inferenceMaxMs)} ms`,
   `Frame round trip: mean ${n(d.roundTripMeanMs)} ms`,
   `Input start interval: mean ${n(d.sampleIntervalMeanMs)} ms`,
   `Pose changes ${d.poseFlips} · switches ${d.switches} · busy ${d.blockedSwitches}`,
   `Grace recoveries ${d.graceRecoveries} · discontinuities ${d.discontinuities}`,
   `Capture ${d.actualVideoWidth}×${d.actualVideoHeight} · input ${d.inputWidth}×${d.inputHeight}`
  ]).join('\n');
 }
 function exportDiagnostics(){
  if(!effect)return;
  const data={schema:1,testVersion:'offline-20261025-innovation-r1',exportedAt:new Date().toISOString(),exhibit:exhibits[index].id,userAgent:navigator.userAgent,secureContext:window.isSecureContext,viewport:{width:innerWidth,height:innerHeight},diagnostics:effect.diagnostics};
  if(diagnosticURL)URL.revokeObjectURL(diagnosticURL);
  diagnosticURL=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
  const link=document.createElement('a');link.href=diagnosticURL;link.download='museum-gesture-diagnostics-'+Date.now()+'.json';document.body.append(link);link.click();link.remove();
 }
 function setUIHidden(hidden,focus=true){
  uiHidden=hidden;document.body.classList.toggle('museum-gesture-ui-hidden',hidden);showUI.hidden=!mode||!hidden;
  if(focus&&mode&&hidden)showUI.focus({preventScroll:true});
  dock.inert=hidden;dock.toggleAttribute('aria-hidden',hidden);if(hidden)dock.setAttribute('aria-hidden','true');guide.hidden=!mode||hidden;
  if(focus&&mode&&!hidden)$('gestureHideUI').focus({preventScroll:true});
 }
 function close(reason='return'){
  generation++;if(!mode)return;
  const previous=mode;mode=null;blockedUntil=0;cancelSwitch();cancelInputs();effect?.setEnabled(false);effect?.setScanMode(false);effect?.setBloomMode(false);
  if(diagnosticURL){URL.revokeObjectURL(diagnosticURL);diagnosticURL=null;}
  dock.querySelector('video')?.remove();dock.hidden=guide.hidden=true;setUIHidden(false,false);document.body.classList.remove('museum-gesture');
  controls.enabled=previous.enabled;controls.autoRotate=previous.auto;pauseEffects(previous.paused);
  const canFocus=node=>node?.isConnected&&node!==document.body&&node.getClientRects?.().length!==0;
  const focus=[previous.focus,document.getElementById('museumMore'),document.getElementById('museumLanguage')].find(canFocus);
  focus?.focus({preventScroll:true});state='ready';
  if(previous.onReturn)try{previous.onReturn(reason);}catch(error){console.warn('Museum experience return unavailable:',error);}
 }
 async function open(variant='particles',options={}){
  if(disposed||mode)return false;cancelIntro('gesture');
  mode={enabled:controls.enabled,auto:controls.autoRotate,paused:getEffectsPaused(),focus:document.activeElement,bloom:variant==='bloom',scan:variant==='scan',ready:false,onReturn:typeof options?.onReturn==='function'?options.onReturn:null};
  controls.enabled=false;controls.autoRotate=false;pauseEffects(true);document.body.classList.add('museum-gesture');dock.hidden=guide.hidden=false;state='loading';translate();$('gestureExit').focus({preventScroll:true});
  // Clear the orbit's residual inertia without moving the saved museum viewpoint.
  const position=camera.position.clone(),target=controls.target.clone(),damping=controls.enableDamping;
  controls.enableDamping=false;controls.update(0);camera.position.copy(position);controls.target.copy(target);controls.update(0);controls.enableDamping=damping;
  const token=++generation;
  try{
   pending ||= import('./gesture-particles.js').catch(error=>{pending=null;throw error;});
   const {createGestureParticles}=await pending;if(!mode||token!==generation||disposed)return;
   effect ||= createGestureParticles({THREE,scene,camera,renderer,isDesktop,getModel,onStatus:result=>{if(mode){recognized=result.gesture||'';status(result.state);}},onSwitch:direction=>{if(mode?.ready&&(switchState==='idle'||switchState==='error'))switchExhibit(direction);},onSwitchBlocked:()=>{if(mode?.ready){blockedUntil=performance.now()+750;translate();}}});
   await effect.setScanMode(false);if(!mode||token!==generation||disposed)return;
   if(mode.bloom)try{await effect.setBloomMode(true);}catch(error){console.warn('Floral light: original particles remain available',error);if(!mode||token!==generation||disposed)return;mode.bloom=false;await effect.setBloomMode(false);}
   else await effect.setBloomMode(false);
   if(!mode||token!==generation||disposed)return;
   if(mode.scan)try{await effect.setScanMode(true);}catch(error){console.warn('Surface scan: original particles remain available',error);if(!mode||token!==generation||disposed)return;mode.scan=false;await effect.setScanMode(false);}
   if(!mode||token!==generation||disposed)return;effect.setEnabled(true);if(mode.scan&&!effect.scanActive)mode.scan=false;mode.ready=true;status(effect.textureAvailable?'ready':'shapeOnly');
  }catch(error){console.warn('Gesture experience:',error);if(mode&&token===generation)status('failed');}
  return !!mode&&token===generation;
 }
 async function toggleCamera(){
  if(!effect||!mode?.ready)return;
  if(effect.cameraActive){effect.stopCamera();dock.querySelector('video')?.remove();status('ready');return;}
  if(window.isSecureContext===false){status('insecure');return;}
  const token=generation;status('loading');
  try{await effect.startCamera();if(!mode||token!==generation)return;
   if(effect.cameraActive&&effect.video){effect.video.className='gesture-video';effect.video.removeAttribute('style');effect.video.removeAttribute('aria-hidden');effect.video.setAttribute('aria-label',getLanguage()==='zh'?'本机摄像头预览':'Local camera preview');dock.append(effect.video);}
   translate();
  }catch(error){console.warn('Gesture camera:',error);if(mode&&token===generation)status('error');}
 }
 const listen=(target,type,handler,options={})=>target.addEventListener(type,handler,{...options,signal:lifetime.signal});
 listen($('gestureExit'),'click',()=>close());listen($('gestureCamera'),'click',toggleCamera);
 listen($('gestureHideUI'),'click',()=>setUIHidden(true));listen(showUI,'click',()=>setUIHidden(false));
 if(diagnosticsEnabled){listen($('gestureDiagnosticReset'),'click',()=>{effect?.resetDiagnostics();updateDiagnostics(true);});listen($('gestureDiagnosticExport'),'click',exportDiagnostics);listen(dock.querySelector('.gesture-diagnostics'),'toggle',()=>updateDiagnostics(true));}
 for(const [id,direction] of [['gesturePrevious',-1],['gestureNext',1]])listen($(id),'click',()=>{if(mode?.ready&&effect){cancelInputs();switchExhibit(direction);}});
 for(const button of dock.querySelectorAll('[data-action]'))listen(button,'click',()=>{if(mode?.ready){cancelInputs();effect?.setAction(button.dataset.action);translate();}});
 listen(document,'keydown',event=>{if(!mode)return;if(event.key==='Escape'){event.preventDefault();close();}
  if(event.key==='Tab'){const buttons=uiHidden?[showUI]:[...dock.querySelectorAll('button:not(:disabled),summary')].filter(node=>node.getClientRects().length);if(event.shiftKey&&document.activeElement===buttons[0]){event.preventDefault();buttons[buttons.length-1].focus();}else if(!event.shiftKey&&document.activeElement===buttons[buttons.length-1]){event.preventDefault();buttons[0].focus();}}
 });
 const canvas=renderer.domElement;
 function move(event,pinch){if(!mode?.ready||!effect||effect.cameraActive)return;const rect=canvas.getBoundingClientRect();effect.setPointer((event.clientX-rect.left)/rect.width,(event.clientY-rect.top)/rect.height,pinch,pointers.size===1&&pointers.has(event.pointerId));}
 listen(canvas,'pointerdown',event=>{if(!mode?.ready||!effect||effect.cameraActive||event.button!==0)return;event.preventDefault();pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});canvas.setPointerCapture?.(event.pointerId);move(event,0);
  clearTimeout(holdTimer);if(pointers.size===1)holdTimer=setTimeout(()=>{holdTimer=0;if(pointers.has(event.pointerId))move(event,1);},320);else cancelInputs();
 });
 listen(canvas,'pointermove',event=>{if(!mode)return;const start=pointers.get(event.pointerId);if(start&&Math.hypot(event.clientX-start.x,event.clientY-start.y)>8){clearTimeout(holdTimer);holdTimer=0;}move(event);});
 listen(canvas,'pointerup',event=>{if(!mode||!pointers.has(event.pointerId))return;pointers.delete(event.pointerId);clearTimeout(holdTimer);holdTimer=0;move(event,0);});
 for(const type of ['pointercancel','lostpointercapture'])listen(canvas,type,event=>{if(mode&&pointers.has(event.pointerId))cancelInputs();});
 listen(window,'blur',cancelInputs);
 listen(document,'visibilitychange',()=>{if(document.hidden&&mode){cancelInputs();effect?.stopCamera();dock.querySelector('video')?.remove();status('paused');}});
 listen(window,'pagehide',()=>close('pagehide'));listen(canvas,'webglcontextlost',()=>close('contextlost'));
 return {open,openBloom:options=>open('bloom',options),openScan:options=>open('scan',options),close,translate,galleryState(current,target,kind){index=current;switchState=kind;effect?.setSwitching(kind==='loading'||kind==='moving');translate();},changeModel(){if(mode&&effect){cancelInputs();const changed=effect.changeModel();if(changed&&mode.scan&&!effect.scanActive)mode.scan=false;translate();}},get active(){return !!mode;},update(delta){if(mode){controls.enabled=false;controls.autoRotate=false;if(!document.hidden)try{effect?.update(delta);updateDiagnostics();if(blockedUntil&&performance.now()>=blockedUntil){blockedUntil=0;translate();}}catch(error){console.warn('Gesture frame:',error);close('error');}}},dispose(){if(disposed)return;close('dispose');disposed=true;lifetime.abort();effect?.dispose();effect=null;dock.remove();guide.remove();showUI.remove();}};
}
