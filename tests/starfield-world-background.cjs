'use strict';
// Execute world-camera transforms and resource ownership with real Three math; no GPU or network.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{pathToFileURL}=require('node:url');
(async()=>{
 const root=path.resolve(__dirname,'..'),THREE=await import(pathToFileURL(path.join(root,'vendor/three.module.js')).href);
 const source=fs.readFileSync(path.join(root,'enhancements/starfield-background.js'),'utf8').replace(/^import .*;\r?\n/,'').replace('export function createStarfieldBackground','function createStarfieldBackground');
 const close=(a,b,label)=>assert(Math.abs(a-b)<1e-8,label+': '+a+' != '+b);
 const vector=(a,b,label)=>a.toArray().forEach((value,i)=>close(value,b.toArray()[i],label));
 const quaternion=(a,b,label)=>close(Math.abs(a.dot(b)),1,label);
 function harness({mobile=false,failCore=false,failFrame=false,disposeFails=false}={}){
  const scene=new THREE.Scene(),parent=new THREE.Group(),legacy=new THREE.Group(),sky=[new THREE.Group(),new THREE.Group()],camera=new THREE.PerspectiveCamera(45,16/9,.1,1000);
  parent.position.set(3,-2,1);parent.rotation.y=.2;parent.scale.setScalar(1.3);legacy.position.set(-7.5,3.2,-26);legacy.rotation.set(.1,.3,-.2);legacy.scale.setScalar(.55);parent.add(legacy);scene.add(parent,...sky);sky[1].visible=false;
  const basis=new THREE.Matrix4(),local=new THREE.Vector3(0,1,80);
  function place(position){legacy.updateWorldMatrix(true,false);basis.multiplyMatrices(legacy.matrixWorld,new THREE.Matrix4().makeScale(.4,.4,.4));camera.position.copy(position).applyMatrix4(basis);camera.lookAt(new THREE.Vector3().setFromMatrixPosition(basis));camera.updateMatrixWorld(true);}
  place(local);
  const initial={target:{outside:true},face:2,mip:1,viewport:new THREE.Vector4(3,4,100,80),scissor:new THREE.Vector4(5,6,70,60),test:true,color:new THREE.Color(.1,.2,.3),alpha:.4,auto:true,xr:true};
  const state={...initial,viewport:initial.viewport.clone(),scissor:initial.scissor.clone(),color:initial.color.clone()};
  const counts={frames:[],sizes:[],disposed:0,draws:[],sync:0};let borrowed,throwRender=false,lost=false;
  const renderer={capabilities:{maxTextureSize:8192},xr:{enabled:true},autoClear:true,
   getContext:()=>({isContextLost:()=>lost}),getRenderTarget:()=>state.target,getActiveCubeFace:()=>state.face,getActiveMipmapLevel:()=>state.mip,
   getViewport:v=>v.copy(state.viewport),getScissor:v=>v.copy(state.scissor),getScissorTest:()=>state.test,getClearColor:c=>c.copy(state.color),getClearAlpha:()=>state.alpha,
   setRenderTarget(t,f,m){state.target=t;state.face=f;state.mip=m;},setViewport:v=>state.viewport.copy(v),setScissor:v=>state.scissor.copy(v),setScissorTest:v=>state.test=v,setClearColor(c,a){state.color.copy(c);state.alpha=a;},
   render(outputScene,outputCamera){
    assert.equal(state.target,initial.target,'Copy draws into the caller current target');assert.equal(renderer.autoClear,false);assert.equal(renderer.xr.enabled,false);
    const material=outputScene.children[0].material;assert.equal(material.depthTest,false);assert.equal(material.depthWrite,false);assert.equal(material.toneMapped,false);assert.equal(material.blending,THREE.NoBlending);
    assert.equal(material.uniforms.image.value,borrowed.texture);assert(material.fragmentShader.includes('gl_FragColor=texture2D(image,vUv)'),'Original encoded color is copied directly');counts.draws.push(outputCamera);
    state.viewport.set(0,0,1,1);state.scissor.set(0,0,1,1);state.test=false;state.color.set(0);state.alpha=0;
    if(throwRender)throw new Error('Injected copy failure');
   }};
  const params={quality:'auto',checker:mobile,steps:1000,stars:3,nebula:3,temp:4200,outer:24,bright:5,exposure:1.38,bloom:.34,autoRotate:true};
  const defaults={...params},context={THREE,createStarfieldCore:options=>{
   assert.equal(options.isMobile,mobile);if(failCore)throw new Error('Unsupported core');
   return {params,sync(){counts.sync++;},resize(w,h){counts.sizes.push([w,h]);},render(time,velocity,target,delta){if(failFrame)throw new Error('Injected first frame failure');borrowed=target;counts.frames.push({time,velocity,delta,width:target.width,height:target.height});},dispose(){counts.disposed++;if(disposeFails)throw new Error('Injected core dispose failure');}};
  }};
  vm.createContext(context);vm.runInContext(source+';globalThis.create=createStarfieldBackground;',context);
  const create=()=>context.create({THREE,scene,renderer,camera,legacy,sky,isDesktop:()=>!mobile});
  function verify(){assert.equal(state.target,initial.target);assert.equal(state.face,initial.face);assert.equal(state.mip,initial.mip);assert.deepEqual(state.viewport.toArray(),initial.viewport.toArray());assert.deepEqual(state.scissor.toArray(),initial.scissor.toArray());assert.equal(state.test,initial.test);assert.equal(state.color.getHex(),initial.color.getHex());assert.equal(state.alpha,initial.alpha);assert.equal(renderer.autoClear,initial.auto);assert.equal(renderer.xr.enabled,initial.xr);}
  return {scene,legacy,sky,camera,renderer,params,defaults,counts,create,place,basis,verify,set throwRender(value){throwRender=value;},set lost(value){lost=value;},get target(){return borrowed;}};
 }
 for(const mobile of [false,true]){
  const h=harness({mobile}),children=h.scene.children.slice(),api=h.create();
  assert.equal(api.core.params,h.params);assert.deepEqual(h.params,{...h.defaults,checker:true},'Only temporal interleaving changes; galaxy, palette and integration parameters remain original');assert.equal(h.counts.sync,1);
  vector(api.observer.position,new THREE.Vector3(0,1,80),'Translated, rotated and scaled world camera maps into black-hole coordinates');assert.equal(api.observer.fov,h.camera.fov);assert.deepEqual(api.observer.projectionMatrix.elements,h.camera.projectionMatrix.elements);
  assert.deepEqual([...api.size],mobile?[1977,1112]:[2048,1152]);assert.equal(h.counts.frames.length,1);assert.equal(h.legacy.visible,false);assert.equal(h.sky[0].visible,false);assert.equal(h.sky[1].visible,false);assert.deepEqual(h.scene.children,children,'No billboard is added to the museum scene');
  api.render();h.verify();
  h.throwRender=true;assert.throws(()=>api.render(),/Injected copy failure/);h.verify();h.throwRender=false;
  h.lost=true;assert.throws(()=>api.render(),error=>error.code==='MUSEUM_CONTEXT_LOST');h.verify();h.lost=false;
  for(let i=0;i<5;i++){h.camera.position.x+=.1;api.update(.016);}assert.equal(h.counts.frames.length,6,'Every moving frame resamples; no 4Hz throttle');
  h.place(new THREE.Vector3(1,2,20));api.update(.016,{time:8,velocity:{x:.1,y:0,z:0}});
  assert.deepEqual([...api.size],mobile?[1977,1112]:[2048,1152]);assert.equal(h.counts.frames.at(-1).time,8);assert.equal(h.counts.frames.at(-1).velocity.x,.1);
  const frozen={frames:h.counts.frames.length,sizes:h.counts.sizes.length,size:[...api.size],position:api.observer.position.clone()};
  api.update(NaN,{time:-1,capturing:true});assert.equal(h.counts.frames.length,frozen.frames);assert.equal(h.counts.sizes.length,frozen.sizes);assert.deepEqual([...api.size],frozen.size);vector(api.observer.position,frozen.position,'Capture observer remains frozen');
  h.params.quality=.5;api.update(.016,{time:8,scale:.3});assert.deepEqual([...api.size],[1024,576]);assert.equal(h.params.steps,1000);assert.equal(h.params.quality,.5);
  h.params.quality='auto';api.update(.016,{time:8,scale:.5});assert.deepEqual([...api.size],[1024,576]);
  h.camera.aspect=.4;h.camera.updateProjectionMatrix();api.update(.016);assert(h.target.width*h.target.height<=(mobile?2200000:4000000));assert(Math.abs(h.target.width/h.target.height-.4)<.001,'Portrait size follows camera aspect');
  api.observer.position.set(3,2,18);api.observer.lookAt(0,0,0);api.observer.fov=52;api.observer.updateProjectionMatrix();const localPosition=api.observer.position.clone(),localRotation=api.observer.quaternion.clone();api.applyObserver();api.syncObserver();
  vector(api.observer.position,localPosition,'Observer-to-world round trip');quaternion(api.observer.quaternion,localRotation,'Observer orientation round trip');assert.equal(h.camera.fov,52);
  const cameraParent=new THREE.Group();cameraParent.position.set(4,2,1);cameraParent.rotation.y=.3;h.scene.add(cameraParent);cameraParent.attach(h.camera);api.observer.position.set(-2,4,19);api.observer.lookAt(0,0,0);const parentPosition=api.observer.position.clone(),parentRotation=api.observer.quaternion.clone();api.applyObserver();api.syncObserver();vector(api.observer.position,parentPosition,'Parented main camera round trip');quaternion(api.observer.quaternion,parentRotation,'Parented main orientation round trip');
  let targetDisposed=0;h.target.addEventListener('dispose',()=>targetDisposed++);api.dispose();api.dispose();api.update(.1);assert.equal(api.render(),false);assert.equal(h.counts.disposed,1);assert.equal(targetDisposed,1);assert.equal(h.legacy.visible,true);assert.equal(h.sky[0].visible,true);assert.equal(h.sky[1].visible,false);
 }
 {
  const h=harness(),api=h.create();for(let i=0;i<45;i++)api.update(.05,{scale:.6});assert.equal(api.size[0],1228,'Auto feedback adjusts only the independent ray-trace budget');api.update(.016);assert.equal(api.size[0],2048,'No controller feedback uses the base budget');assert.deepEqual(h.params,{...h.defaults,checker:true});api.dispose();
 }
 {
  const h=harness(),api=h.create(),frames=h.counts.frames.length;
  for(const delta of [NaN,-1,Infinity])assert.throws(()=>api.update(delta),/frame duration/);
  for(const time of [NaN,-1,Infinity])assert.throws(()=>api.update(0,{time}),/background time/);
  for(const scale of [NaN,0,-1,1.1,Infinity])assert.throws(()=>api.update(0,{scale}),/quality scale/);
  h.camera.aspect=0;assert.throws(()=>api.update(0),/camera aspect/);h.camera.aspect=16/9;
  h.legacy.scale.setScalar(0);assert.throws(()=>api.syncObserver(),/world transform/);
  assert.equal(h.counts.frames.length,frames,'Rejected boundaries never trace a corrupt camera');
  api.dispose();assert.equal(h.legacy.visible,true);assert.equal(h.sky[0].visible,true);
 }
 for(const options of [{failCore:true},{failFrame:true}]){
  const h=harness(options),children=h.scene.children.slice();assert.throws(h.create,/Unsupported core|Injected first frame/);assert.equal(h.legacy.visible,true);assert.equal(h.sky[0].visible,true);assert.equal(h.sky[1].visible,false);assert.deepEqual(h.scene.children,children);assert.equal(h.counts.disposed,options.failCore?0:1);
 }
 {
  const h=harness({disposeFails:true}),api=h.create();let released=0;h.target.addEventListener('dispose',()=>released++);assert.throws(()=>api.dispose(),/Injected core dispose/);api.dispose();assert.equal(released,1,'Other resources are released after a core disposal failure');assert.equal(h.counts.disposed,1);assert.equal(h.legacy.visible,true);
 }
 console.log('Same-scene black-hole transforms, original galaxy/color, bounded responsive sampling, capture isolation and cleanup pass');
})().catch(error=>{console.error(error);process.exitCode=1;});
