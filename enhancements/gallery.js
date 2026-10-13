import {exhibits} from './exhibits.js';

// One scene and one live exhibit; parsed candidates live only until commit or cancellation.
export function createGallery({THREE,renderer,scene,camera,controls,loadExhibit,disposeExhibit,getModel,commit,ui,cancelIntro,hideInfo,restoreInfo}){
 let current=0,requested=0,serial=0,pending=null,motion=null,preparing=Promise.resolve();
 const pullOut=1.05,hold=.3,pushIn=1.65,duration=pullOut+hold+pushIn;
 const point=new THREE.Vector3();
 const frame=signal=>new Promise((resolve,reject)=>{
  const abort=()=>{cancelAnimationFrame(id);signal.removeEventListener('abort',abort);reject(signal.reason);};
  const id=requestAnimationFrame(()=>{signal.removeEventListener('abort',abort);resolve();});
  signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();
 });
 function state(kind='idle'){ui.galleryState(current,requested,kind);}
 function finish(){
  if(!motion)return;
  const old=motion;motion=null;
  controls.enableDamping=old.damping;controls.autoRotate=old.auto;
  document.body.classList.remove('museum-switching');
  if(!old.infoHidden)restoreInfo();
  if(!old.committed)disposeExhibit(old.next);
 }
 function cancel(){serial++;pending?.abort();pending=null;finish();requested=current;state();}
 async function step(direction){
  const target=(requested+direction+exhibits.length)%exhibits.length;
  cancelIntro();requested=target;
  if(target===current){state();return;}
  const token=++serial,controller=new AbortController();pending=controller;state('loading');
  const previous=preparing;let release;preparing=new Promise(resolve=>{release=resolve;});
  let candidate=null,timer=null;
  try{
   // Native shader compilation cannot be aborted; wait for its candidate to be released.
   await previous;if(token!==serial)return;controller.signal.throwIfAborted();
   timer=setTimeout(()=>controller.abort(new DOMException('Model preparation timed out','TimeoutError')),30000);
   candidate=await loadExhibit(exhibits[target].url,controller.signal);
   controller.signal.throwIfAborted();
   if(token!==serial)return;
   // Compile against the existing lights, then spread texture uploads across frames.
   const staging=new THREE.Scene();staging.add(candidate);
   await renderer.compileAsync(staging,camera,scene);
   controller.signal.throwIfAborted();
   if(token!==serial)return;
   const textures=new Set();candidate.traverse(mesh=>{if(!mesh.isMesh)return;for(const material of [].concat(mesh.material))for(const value of Object.values(material))if(value?.isTexture)textures.add(value);});
   for(const texture of textures){if(token!==serial)return;controller.signal.throwIfAborted();renderer.initTexture(texture);await frame(controller.signal);}
   controller.signal.throwIfAborted();
   if(token!==serial)return;
   const start=camera.position.clone(),targetStart=controls.target.clone(),targetEnd=controls.target0.clone(),end=controls.position0.clone();
   const far=end.clone().sub(targetEnd);far.x+=2.4;far.y+=1.2;far.setLength(controls.maxDistance).add(targetEnd);
   motion={next:candidate,index:target,at:performance.now(),instant:matchMedia('(prefers-reduced-motion: reduce)').matches&&!window.museumLoading.desktopIntro,committed:false,start,targetStart,targetEnd,end,far,damping:controls.enableDamping,auto:controls.autoRotate,infoHidden:document.getElementById('infoBox').classList.contains('hide')};candidate=null;
   controls.autoRotate=false;controls.enableDamping=false;controls.update(0);hideInfo();document.body.classList.add('museum-switching');state('moving');
  }catch(error){if(token===serial){requested=current;state('error');console.warn('Exhibit switch failed:',error);}}
  finally{clearTimeout(timer);if(candidate)disposeExhibit(candidate);if(pending===controller)pending=null;release();}
 }
 function update(){
  if(!motion)return;
  const m=motion;let elapsed=m.instant?duration:(performance.now()-m.at)/1000;
  if(elapsed>=pullOut+hold/2&&!m.committed){
   // A delayed frame must still show the distant swap before the approach begins.
   if(!m.instant){elapsed=pullOut+hold/2;m.at=performance.now()-elapsed*1000;camera.position.copy(m.far);controls.target.copy(m.targetEnd);}
   const previous=getModel();scene.add(m.next);
   try{commit(m.next,m.index);}catch(error){
    scene.remove(m.next);try{commit(previous,current);}catch(rollbackError){console.warn('Exhibit UI recovery:',rollbackError);}
    finish();requested=current;state('error');console.warn('Exhibit presentation failed:',error);return;
   }
   current=m.index;m.committed=true;
   scene.remove(previous);disposeExhibit(previous);state('moving');
  }
  const outbound=elapsed<pullOut,p=Math.min(1,outbound?elapsed/pullOut:Math.max(0,elapsed-pullOut-hold)/pushIn),ease=p*p*(3-2*p);
  camera.position.lerpVectors(outbound?m.start:m.far,outbound?m.far:m.end,ease);
  point.lerpVectors(outbound?m.targetStart:m.targetEnd,m.targetEnd,ease);controls.target.copy(point);
  if(elapsed>=duration){finish();requested=current;state();}
 }
 state();
 return {step,cancel,update,dispose:cancel,get index(){return current;},get active(){return !!motion||!!pending;}};
}
