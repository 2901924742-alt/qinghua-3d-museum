import {createStarfieldCore} from './starfield-core.js';

// One world camera drives the complete black hole and galaxy; the host draws museum objects afterward.
export function createStarfieldBackground({THREE,scene,renderer,camera,legacy,sky=[],isDesktop}) {
 if(!camera?.isPerspectiveCamera||!legacy?.isObject3D||!Array.isArray(sky)||sky.some(object=>!object?.isObject3D))throw new TypeError('Invalid museum background objects');
 const mobile=!isDesktop(),observer=new THREE.PerspectiveCamera(),outputScene=new THREE.Scene(),outputCamera=new THREE.Camera(),depthScene=new THREE.Scene(),horizonScale=new THREE.Vector3();
 const visibility=new Map([legacy,...sky].map(object=>[object,object.visible]));
 const world=new THREE.Matrix4(),inverse=new THREE.Matrix4(),view=new THREE.Matrix4(),parentInverse=new THREE.Matrix4(),unitScale=new THREE.Matrix4().makeScale(.4,.4,.4),unusedScale=new THREE.Vector3();
 let core,target,geometry,material,horizon,horizonGeometry,horizonMaterial,disposed=false,ready=false,time=0,width=0,height=0;
 function basis(){
  legacy.updateWorldMatrix(true,false);world.multiplyMatrices(legacy.matrixWorld,unitScale);
  if(!world.elements.every(Number.isFinite)||Math.abs(world.determinant())<1e-12)throw new RangeError('Invalid black-hole world transform');
  inverse.copy(world).invert();
 }
 function projection(from,to){
  for(const key of ['fov','aspect','near','far','zoom','filmGauge','filmOffset','focus'])to[key]=from[key];
  to.view=from.view?{...from.view}:null;to.projectionMatrix.copy(from.projectionMatrix);to.projectionMatrixInverse.copy(from.projectionMatrixInverse);
 }
 function syncObserver(){
  if(disposed)return;
  basis();camera.updateWorldMatrix(true,false);view.multiplyMatrices(inverse,camera.matrixWorld);
  view.decompose(observer.position,observer.quaternion,unusedScale);observer.scale.set(1,1,1);
  projection(camera,observer);observer.updateMatrixWorld(true);
  return observer;
 }
 function applyObserver(){
  if(disposed)return;
  basis();observer.updateMatrixWorld(true);view.multiplyMatrices(world,observer.matrixWorld);
  if(camera.parent){camera.parent.updateWorldMatrix(true,false);parentInverse.copy(camera.parent.matrixWorld).invert();view.premultiply(parentInverse);}
  view.decompose(camera.position,camera.quaternion,unusedScale);projection(observer,camera);camera.updateMatrixWorld(true);
  return camera;
 }
 function resize(frameState,adaptive){
  const aspect=observer.aspect;
  if(!Number.isFinite(aspect)||aspect<=0)throw new RangeError('Invalid museum camera aspect');
  const base=mobile?Math.min(2048,2048*aspect):2048;
  const quality=core.params.quality==='auto'?adaptive:core.params.quality;
  const proposed=base*quality,max=renderer.capabilities.maxTextureSize,maxPixels=mobile?2200000:4000000;
  const fit=Math.min(1,max/proposed,max*aspect/proposed,Math.sqrt(maxPixels*aspect)/proposed);
  const w=Math.max(1,Math.floor(proposed*fit)),h=Math.max(1,Math.min(max,Math.round(w/aspect)));
  // Capture may temporarily resize the shared core; reassert the live budget without changing its parameters.
  core.resize(w,h);
  if(w!==width||h!==height){target.setSize(w,h);width=w;height=h;}
 }
 function update(delta,frameState=null){
  if(disposed||frameState?.capturing)return;
  if(!Number.isFinite(delta)||delta<0)throw new RangeError('Invalid museum frame duration');
  if(frameState?.time!==undefined){
   if(!Number.isFinite(frameState.time)||frameState.time<0)throw new RangeError('Invalid museum background time');
   time=frameState.time;
  }else time+=Math.min(delta,.1);
  const adaptive=frameState?.scale??1;
  if(!Number.isFinite(adaptive)||adaptive<=0||adaptive>1)throw new RangeError('Invalid museum background quality scale');
  if(ready&&frameState?.renderNeeded===false)return;
  syncObserver();resize(frameState,adaptive);core.render(time,frameState?.velocity,target,delta);
  ready=true;for(const object of visibility.keys())object.visible=false;
 }
 function render(){
  if(disposed||!ready)return false;
  const saved={target:renderer.getRenderTarget(),face:renderer.getActiveCubeFace(),mip:renderer.getActiveMipmapLevel(),viewport:renderer.getViewport(new THREE.Vector4()),scissor:renderer.getScissor(new THREE.Vector4()),test:renderer.getScissorTest(),color:renderer.getClearColor(new THREE.Color()),alpha:renderer.getClearAlpha(),auto:renderer.autoClear,xr:renderer.xr.enabled};
  let failed=false,primary;
  try{
   basis();const radius=.5+Math.sqrt(.25-(core.params.spin*.5)**2);
   if(!Number.isFinite(radius)||radius<=0)throw new RangeError('Invalid event-horizon radius');
   horizon.matrix.copy(world).scale(horizonScale.setScalar(radius));
   renderer.autoClear=false;renderer.xr.enabled=false;renderer.render(outputScene,outputCamera);
   if(renderer.getContext().isContextLost())throw Object.assign(new Error('WebGL context temporarily unavailable'),{code:'MUSEUM_CONTEXT_LOST'});
   renderer.clearDepth();renderer.render(depthScene,camera);
   if(renderer.getContext().isContextLost())throw Object.assign(new Error('WebGL context temporarily unavailable'),{code:'MUSEUM_CONTEXT_LOST'});
  }catch(error){failed=true;primary=error;}
  finally{
   for(const restore of [()=>renderer.setViewport(saved.viewport),()=>renderer.setScissor(saved.scissor),()=>renderer.setScissorTest(saved.test),()=>renderer.setClearColor(saved.color,saved.alpha),()=>{renderer.autoClear=saved.auto;renderer.xr.enabled=saved.xr;},()=>renderer.setRenderTarget(saved.target,saved.face,saved.mip)]){
    try{restore();}catch(error){if(!failed){failed=true;primary=error;}}
   }
  }
  if(failed)throw primary;return true;
 }
 function dispose(){
  if(disposed)return;disposed=true;
  for(const [object,visible]of visibility)object.visible=visible;
  let failed=false,primary;
  for(const resource of [core,target,material,geometry,horizonMaterial,horizonGeometry])try{resource?.dispose();}catch(error){if(!failed){failed=true;primary=error;}}
  if(failed)throw primary;
 }
 try{
  syncObserver();core=createStarfieldCore({THREE,renderer,camera:observer,isMobile:mobile});
  core.params.checker=true;core.sync();
  target=new THREE.WebGLRenderTarget(1,1,{depthBuffer:false,stencilBuffer:false});target.texture.colorSpace=THREE.NoColorSpace;
  geometry=new THREE.PlaneGeometry(2,2);
  material=new THREE.ShaderMaterial({uniforms:{image:{value:target.texture}},depthWrite:false,depthTest:false,blending:THREE.NoBlending,toneMapped:false,fog:false,
   vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
   // The core already outputs ACES/sRGB; copy its original color without another transfer or palette.
   fragmentShader:'uniform sampler2D image;varying vec2 vUv;void main(){gl_FragColor=texture2D(image,vUv);}'});
  // Finite event-horizon body occlusion only; nearby museum objects do not receive full GR ray-traced lensing.
  horizonGeometry=new THREE.SphereGeometry(1,24,16);
  horizonMaterial=new THREE.MeshBasicMaterial({colorWrite:false,depthWrite:true,depthTest:true,side:THREE.DoubleSide,toneMapped:false,fog:false});
  horizon=new THREE.Mesh(horizonGeometry,horizonMaterial);horizon.matrixAutoUpdate=false;horizon.frustumCulled=false;depthScene.add(horizon);
  outputScene.add(new THREE.Mesh(geometry,material));update(0);
 }catch(error){try{dispose();}catch{}throw error;}
 return {update,render,dispose,core,observer,syncObserver,applyObserver,get size(){return [width,height];},get time(){return time;}};
}
