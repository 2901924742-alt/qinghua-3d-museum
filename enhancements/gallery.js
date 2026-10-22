import {exhibits} from './exhibits.js';

// One scene and one live exhibit; parsed candidates live only until commit or cancellation.
export function createGallery({THREE,renderer,scene,camera,controls,loadExhibit,disposeExhibit,getModel,commit,ui,cancelIntro,hideInfo,restoreInfo}){
 let current=0,requested=0,serial=0,pending=null,motion=null,preparing=Promise.resolve();
 const pullOut=1.05,hold=.3,pushIn=1.65,duration=pullOut+hold+pushIn;
 const point=new THREE.Vector3();
 const abortReason=signal=>signal.reason||new DOMException('Exhibit preparation cancelled','AbortError');
 const checkAbort=signal=>{if(signal.aborted)throw abortReason(signal);};
 const frame=signal=>new Promise((resolve,reject)=>{
  const abort=()=>{cancelAnimationFrame(id);signal.removeEventListener('abort',abort);reject(abortReason(signal));};
  const id=requestAnimationFrame(()=>{signal.removeEventListener('abort',abort);resolve();});
  signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();
 });
 // Parsing can ignore abort; release the queue now and dispose any result that arrives later.
 const loadCandidate=(url,signal)=>new Promise((resolve,reject)=>{
  let settled=false;
  const abort=()=>{if(settled)return;settled=true;signal.removeEventListener('abort',abort);reject(abortReason(signal));};
  signal.addEventListener('abort',abort,{once:true});if(signal.aborted){abort();return;}
  Promise.resolve().then(()=>{checkAbort(signal);return loadExhibit(url,signal);}).then(model=>{
   if(settled){try{disposeExhibit(model);}catch(error){console.warn('Cancelled exhibit cleanup:',error);}return;}
   settled=true;signal.removeEventListener('abort',abort);resolve(model);
  },error=>{if(settled)return;settled=true;signal.removeEventListener('abort',abort);reject(error);});
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
 function present(next,index){
  const previous=getModel();scene.add(next);
  try{commit(next,index);}catch(error){
   scene.remove(next);try{commit(previous,current);}catch(rollbackError){console.warn('Exhibit UI recovery:',rollbackError);}throw error;
  }
  current=index;scene.remove(previous);
  try{disposeExhibit(previous);}catch(error){console.warn('Previous exhibit cleanup:',error);}
 }
 async function step(direction,{animate=true}={}){
  const target=(requested+direction+exhibits.length)%exhibits.length;
  cancelIntro();requested=target;
  if(target===current){state();return;}
  const token=++serial,controller=new AbortController();pending=controller;state('loading');
  const previous=preparing;let release;preparing=new Promise(resolve=>{release=resolve;});
  let candidate=null,timer=null;
  try{
   // Release a previous candidate before preparing the newest request.
   await previous;if(token!==serial)return;checkAbort(controller.signal);
   timer=setTimeout(()=>controller.abort(new DOMException('Model preparation timed out','TimeoutError')),30000);
   candidate=await loadCandidate(exhibits[target].url,controller.signal);
   checkAbort(controller.signal);
   if(token!==serial)return;
   // Compile against the existing lights, then spread texture uploads across frames.
   const staging=new THREE.Scene();staging.add(candidate);
   renderer.compile(staging,camera,scene);
   checkAbort(controller.signal);
   if(token!==serial)return;
   const textures=new Set();candidate.traverse(mesh=>{if(!mesh.isMesh)return;for(const material of [].concat(mesh.material))for(const value of Object.values(material))if(value?.isTexture)textures.add(value);});
   for(const texture of textures){if(token!==serial)return;checkAbort(controller.signal);renderer.initTexture(texture);await frame(controller.signal);}
   checkAbort(controller.signal);
   if(token!==serial)return;
   if(!animate){present(candidate,target);candidate=null;requested=current;state();return;}
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
   try{present(m.next,m.index);}catch(error){
    finish();requested=current;state('error');console.warn('Exhibit presentation failed:',error);return;
   }
   m.committed=true;state('moving');
  }
  const outbound=elapsed<pullOut,p=Math.min(1,outbound?elapsed/pullOut:Math.max(0,elapsed-pullOut-hold)/pushIn),ease=p*p*(3-2*p);
  camera.position.lerpVectors(outbound?m.start:m.far,outbound?m.far:m.end,ease);
  point.lerpVectors(outbound?m.targetStart:m.targetEnd,m.targetEnd,ease);controls.target.copy(point);
  if(elapsed>=duration){finish();requested=current;state();}
 }
 state();
 return {step,cancel,update,dispose:cancel,get index(){return current;},get active(){return !!motion||!!pending;}};
}
