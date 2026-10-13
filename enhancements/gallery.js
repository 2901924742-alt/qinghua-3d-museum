import {exhibits} from './exhibits.js';

// One scene and one live exhibit; parsed candidates live only until commit or cancellation.
export function createGallery({THREE,renderer,scene,camera,controls,loadExhibit,disposeExhibit,getModel,commit,ui,cancelIntro,hideInfo,restoreInfo}){
 let current=0,requested=0,serial=0,pending=null,motion=null;
 const point=new THREE.Vector3();
 const frame=()=>new Promise(requestAnimationFrame);
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
  const timer=setTimeout(()=>controller.abort(new DOMException('Model request timed out','TimeoutError')),30000);
  let candidate=null;
  try{
   candidate=await loadExhibit(exhibits[target].url,controller.signal);
   if(token!==serial)return;
   // Compile against the existing lights, then spread texture uploads across frames.
   const staging=new THREE.Scene();staging.add(candidate);
   await renderer.compileAsync(staging,camera,scene);
   if(token!==serial)return;
   const textures=new Set();candidate.traverse(mesh=>{if(!mesh.isMesh)return;for(const material of [].concat(mesh.material))for(const value of Object.values(material))if(value?.isTexture)textures.add(value);});
   for(const texture of textures){if(token!==serial)return;renderer.initTexture(texture);await frame();}
   if(token!==serial)return;
   const start=camera.position.clone(),targetStart=controls.target.clone(),targetEnd=controls.target0.clone(),end=controls.position0.clone();
   const far=end.clone().sub(targetEnd).multiplyScalar(4).add(targetEnd);far.x+=2.4;far.y+=1.2;
   motion={next:candidate,index:target,at:performance.now(),instant:matchMedia('(prefers-reduced-motion: reduce)').matches&&!window.museumLoading.desktopIntro,committed:false,start,targetStart,targetEnd,end,far,damping:controls.enableDamping,auto:controls.autoRotate,infoHidden:document.getElementById('infoBox').classList.contains('hide')};candidate=null;
   controls.autoRotate=false;controls.enableDamping=false;controls.update(0);hideInfo();document.body.classList.add('museum-switching');state('moving');
  }catch(error){if(token===serial){requested=current;state('error');console.warn('Exhibit switch failed:',error);}}
  finally{clearTimeout(timer);if(candidate)disposeExhibit(candidate);if(pending===controller)pending=null;}
 }
 function update(){
  if(!motion)return;
  const m=motion,elapsed=m.instant?2.6:(performance.now()-m.at)/1000;
  if(elapsed>=.9&&!m.committed){
   const previous=getModel();scene.add(m.next);
   try{commit(m.next,m.index);}catch(error){
    scene.remove(m.next);try{commit(previous,current);}catch(rollbackError){console.warn('Exhibit UI recovery:',rollbackError);}
    finish();requested=current;state('error');console.warn('Exhibit presentation failed:',error);return;
   }
   current=m.index;m.committed=true;
   scene.remove(previous);disposeExhibit(previous);state('moving');
  }
  const outbound=elapsed<.9,p=Math.min(1,outbound?elapsed/.9:(elapsed-.9)/1.7),ease=p*p*(3-2*p);
  camera.position.lerpVectors(outbound?m.start:m.far,outbound?m.far:m.end,ease);
  point.lerpVectors(outbound?m.targetStart:m.targetEnd,m.targetEnd,ease);controls.target.copy(point);
  if(elapsed>=2.6){finish();requested=current;state();}
 }
 state();
 return {step,cancel,update,dispose:cancel,get index(){return current;},get active(){return !!motion||!!pending;}};
}
