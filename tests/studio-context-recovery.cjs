'use strict';
// Actual shared-preview functions with CPU renderer stubs; native recovery is a separate browser check.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
const {pathToFileURL}=require('node:url');
const source=path.resolve(process.argv[2]||path.join(__dirname,'../enhancements/studio-renderer.js'));
(async()=>{
 const THREE=await import(pathToFileURL(path.join(path.dirname(source),'../vendor/three.module.js')));
 const {createStudioRenderer}=await import(pathToFileURL(source));
 const checks=[];
 function fixture(){
  const listeners=new Map(),state={lost:false,afterRead:false,afterRender:false,target:null,renders:0,reads:0,copies:0,targets:[]};
  const canvas={addEventListener(type,fn){assert(!listeners.has(type));listeners.set(type,fn);},removeEventListener(type,fn){assert.equal(listeners.get(type),fn);listeners.delete(type);}};
  const gl={isContextLost:()=>state.lost,FRAMEBUFFER:1,FRAMEBUFFER_COMPLETE:2,checkFramebufferStatus:()=>state.lost?0:2};
  const renderer={domElement:canvas,toneMappingExposure:1,capabilities:{isWebGL2:false},extensions:{has:()=>false},localClippingEnabled:false,autoClearStencil:false,autoClear:false,
   getContext:()=>gl,getRenderTarget:()=>state.target,setRenderTarget(t){state.target=t;if(t&&!state.targets.includes(t))state.targets.push(t);},
   getViewport:v=>v.set(0,0,800,600),getScissor:v=>v.set(3,4,500,400),getScissorTest:()=>true,getClearColor:c=>c.set(0x123456),getClearAlpha:()=>.4,
   setViewport(){},setScissor(){},setScissorTest(){},setClearColor(){},
   render(){state.renders++;if(state.failRender)throw state.failRender;if(state.afterRender)state.lost=true;},readRenderTargetPixels(t,x,y,w,h,p){state.reads++;if(state.failRead)throw state.failRead;p.fill(77);if(state.afterRead)state.lost=true;}
  };
  const image={width:4,height:3,getContext:()=>({createImageData(w,h){return {data:new Uint8ClampedArray(w*h*4)};},putImageData(){state.copies++;}})};
  const studio=createStudioRenderer({THREE,renderer,loadExhibit(){throw Error('Unexpected load');},disposeExhibit(){},getModel:()=>null,getIndex:()=>0});
  const render=section=>studio.renderPreview(new THREE.Scene(),new THREE.Camera(),image,section);
  return {state,renderer,canvas,listeners,studio,render};
 }
 const lost=error=>error?.code==='MUSEUM_CONTEXT_LOST';
 {
  const f=fixture();assert.equal(f.studio.contextCanvas,f.canvas);f.state.lost=true;
  assert.throws(()=>f.render(false),lost);assert.equal(f.state.renders,0);assert.equal(f.state.copies,0);checks.push('lost-entry-is-transient-before-any-GPU-or-preview-copy');f.studio.dispose();assert.equal(f.listeners.size,0);
 }
 {
  const f=fixture();assert.equal(f.render(false).width,4);assert.equal(f.state.copies,1);assert.equal(f.state.target,null);assert.equal(f.renderer.autoClear,false);assert.equal(f.renderer.localClippingEnabled,false);assert.equal(f.renderer.autoClearStencil,false);
  const old=[...f.state.targets];let disposed=0;for(const t of old)t.addEventListener('dispose',()=>disposed++);
  f.state.lost=true;assert.equal(typeof f.listeners.get('webglcontextlost'),'function');f.listeners.get('webglcontextlost')();assert.equal(disposed,old.length);f.state.lost=false;
  f.render(true);assert(f.state.targets.slice(old.length).length>=2);assert(f.state.targets.slice(old.length).every(t=>!old.includes(t)));assert.equal(f.state.copies,2);checks.push('lost-retires-only-owned-scratch-targets-before-restoration-and-next-preview-rebuilds');f.studio.dispose();assert.equal(f.listeners.size,0);
 }
 for(const when of ['afterRender','afterRead']){
  const f=fixture();f.state[when]=true;assert.throws(()=>f.render(false),lost);assert.equal(f.state.copies,0);assert.equal(f.state.target,null);assert.equal(f.renderer.autoClear,false);assert.equal(f.renderer.localClippingEnabled,false);assert.equal(f.renderer.autoClearStencil,false);
  f.listeners.get('webglcontextlost')();f.state.lost=f.state[when]=false;f.render(false);assert.equal(f.state.copies,1);checks.push(when+'-loss-rejects-stale-copy-restores-state-and-can-retry');f.studio.dispose();
 }
 for(const when of ['failRender','failRead']){
  const f=fixture(),failure=new Error('Ordinary controlled renderer failure');f.state[when]=failure;
  assert.throws(()=>f.render(false),error=>error===failure&&!error.code);assert.equal(f.state.copies,0);assert.equal(f.state.target,null);assert.equal(f.renderer.autoClear,false);assert.equal(f.renderer.localClippingEnabled,false);assert.equal(f.renderer.autoClearStencil,false);
  f.state[when]=null;f.render(false);assert.equal(f.state.copies,1);checks.push(when+'-ordinary-failure-keeps-its-identity-and-cleanup');f.studio.dispose();
 }
 {
  const f=fixture();assert.throws(()=>f.render('yes'),TypeError);assert.equal(f.state.renders,0);f.studio.dispose();assert.throws(()=>f.render(false),e=>e.name==='AbortError');checks.push('existing-validation-and-dispose-abort-remain');
 }
 const experience=fs.readFileSync(path.join(path.dirname(source),'experience.js'),'utf8');
 function body(name){const re=new RegExp('^ function '+name+'\\(','m'),start=re.exec(experience)?.index;assert(start!==undefined);const line=experience.indexOf('\n',start),end=/^ \}/m.exec(experience.slice(line));assert(end);return experience.slice(start,line+end.index+end[0].length);}
 {
  let unavailable=false,draws=0,renders=0;const context={starfield:null,renderer:{getContext:()=>({isContextLost:()=>unavailable}),domElement:{width:8,height:6}},renderMuseum(){renders++;unavailable=true;},document:{createElement:()=>({getContext:()=>({drawImage(){draws++;}})})}};
  vm.createContext(context);for(const name of ['requireContext','capture'])vm.runInContext(body(name),context);
  assert.throws(()=>vm.runInContext('capture()',context),lost);assert.equal(renders,1);assert.equal(draws,0);checks.push('museum-capture-rejects-loss-during-render-before-copy');
  assert.throws(()=>vm.runInContext('capture()',context),lost);assert.equal(renders,1);assert.equal(draws,0);checks.push('museum-capture-rejects-known-loss-before-render');
 }
 {
  const marker={},failure=Error('Starfield not ready'),context={starfield:{active:true,capture:()=>marker},renderer:{getContext(){throw Error('Museum renderer must not be borrowed');}},renderMuseum(){throw Error('Museum must stay parked');},document:{createElement(){throw Error('No museum copy');}}};
  vm.createContext(context);vm.runInContext(body('capture'),context);assert.equal(context.capture(),marker);context.starfield.capture=()=>{throw failure;};assert.throws(()=>context.capture(),error=>error===failure);checks.push('active-starfield-capture-is-exclusive-and-preserves-not-ready-error');
 }
 const index=fs.readFileSync(path.join(path.dirname(source),'../index.html'),'utf8');
 assert(!/webglcontextrestored[^\n]*location\.reload/.test(index));assert(index.indexOf("addEventListener('webglcontextrestored'")>index.indexOf('const animationClock ='));assert(index.includes('if (renderer.getContext().isContextLost())'));checks.push('main-does-not-automatically-reload-unsaved-editors');
 {
  const start=index.indexOf('function releaseSceneGPU(root) {'),end=index.indexOf('// Register after startup awaits',start);assert(start>0&&end>start);
  const context=vm.createContext({});vm.runInContext(index.slice(start,end),context);const release=context.releaseSceneGPU;
  const scene=new THREE.Scene(),geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,1,0,0,0,1,0],3)),array=geometry.attributes.position.array;
  let closed=0,lostNow=true;const image={close(){closed++;}},map=new THREE.Texture(image),uniform=new THREE.Texture(image),environment=new THREE.Texture(image),material=new THREE.ShaderMaterial({uniforms:{images:{value:[map,uniform]}}});material.map=map;
  scene.add(new THREE.Mesh(geometry,material),new THREE.Mesh(geometry,material));scene.background=uniform;scene.environment=environment;
  const counts=new Map();for(const object of [geometry,material,map,uniform,environment])object.addEventListener('dispose',()=>{assert(lostNow);counts.set(object,(counts.get(object)||0)+1);});
  release(scene);for(const object of [geometry,map,uniform,environment])assert.equal(counts.get(object),1);assert.equal(counts.has(material),false);assert.equal(geometry.attributes.position.array,array);assert.equal(map.image,image);assert.equal(uniform.image,image);assert.equal(closed,0);assert.equal(scene.children.length,2);assert.equal(material.map,map);assert.equal(material.uniforms.images.value[1],uniform);
  release(null);checks.push('lost-GPU-retirement-preserves-material-and-deduplicates-shared-geometry-map-uniform-background-environment-without-destroying-CPU-data');
  const instanced=new THREE.InstancedMesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial(),2),instanceArray=instanced.instanceMatrix.array,colors=new THREE.InstancedBufferAttribute(new Float32Array(6),3);instanced.instanceColor=colors;const instancedScene=new THREE.Scene();instancedScene.add(instanced);let retired=0;instanced.addEventListener('dispose',()=>retired++);release(instancedScene);assert.equal(retired,1);assert.equal(instanced.instanceMatrix.array,instanceArray);assert.equal(instanced.instanceColor,colors);assert.equal(instanced.count,2);checks.push('lost-instanced-mesh-retirement-keeps-matrix-color-and-instance-count');
  const lostListener=index.indexOf("addEventListener('webglcontextlost',()=>{");assert(lostListener>index.indexOf('const animationClock ='));assert(index.slice(lostListener,lostListener+260).includes('releaseSceneGPU(scene);releaseSceneGPU(desktopMistScene);desktopMistTarget?.dispose();mistDepthMaterial?.dispose();'));assert(!index.slice(index.indexOf("addEventListener('webglcontextrestored'"),index.indexOf("addEventListener('webglcontextrestored'")+240).includes('releaseSceneGPU('));checks.push('main-and-private-RT-retirement-is-registered-after-initialization-on-native-loss-only');
  const {addInterior}=await import(pathToFileURL(path.join(path.dirname(source),'interior.js'))),{interiorData}=await import(pathToFileURL(path.join(path.dirname(source),'interior-data.js')));
  const originalDocument=Object.getOwnPropertyDescriptor(globalThis,'document'),originalSetTimeout=globalThis.setTimeout,originalClearTimeout=globalThis.clearTimeout,timers=new Set();
  try{
   globalThis.document={};globalThis.setTimeout=(fn,ms)=>{assert.equal(ms,5000);const timer={fn};timers.add(timer);return timer;};globalThis.clearTimeout=timer=>timers.delete(timer);
   assert.deepEqual(Object.keys(interiorData),['original','covered-192','beaker-193','vase-191']);
   for(const [key,spec] of Object.entries(interiorData)){
    const model=new THREE.Group();for(const signature of spec.signature.split(',')){const [vertices,indices]=signature.split(':').map(Number),geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(vertices*3),3));geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(indices),1));model.add(new THREE.Mesh(geometry,new THREE.MeshStandardMaterial()));}
    const image={pending:key},texture=new THREE.Texture(image);let onLoad,settled=false,materialDisposes=0,textureDisposes=0;texture.addEventListener('dispose',()=>textureDisposes++);
    const controlledTHREE={...THREE,TextureLoader:class{load(url,loaded){assert.equal(url,new URL(`../enhancements/interior-textures/${key}.png`,pathToFileURL(source)).href);onLoad=loaded;return texture;}}};
    const result=addInterior(controlledTHREE,model,key);assert.equal(result.added,true);assert.equal(typeof onLoad,'function');const material=result.meshes[0].material;material.addEventListener('dispose',()=>materialDisposes++);result.ready.then(()=>{settled=true;});await Promise.resolve();assert.equal(settled,false);assert.equal(timers.size,1);assert.equal(material.map,texture);
    release(model);await Promise.resolve();assert.equal(materialDisposes,0);assert.equal(textureDisposes,1);assert.equal(settled,false);assert.equal(timers.size,1);assert.equal(material.map,texture);assert.equal(texture.image,image);
    onLoad(texture);await result.ready;assert.equal(settled,true);assert.equal(timers.size,0);assert.equal(material.map,texture);assert.equal(texture.image,image);assert.equal(result.report.decoration,'Display reconstruction loaded');assert.equal(model.userData.museumInterior.decoration,'Display reconstruction loaded');checks.push(key+'-actual-pending-interior-survives-GPU-retirement-and-late-load');
   }
  }finally{globalThis.setTimeout=originalSetTimeout;globalThis.clearTimeout=originalClearTimeout;if(originalDocument)Object.defineProperty(globalThis,'document',originalDocument);else delete globalThis.document;}
 }
 console.log(JSON.stringify({status:'passed',checks:checks.length,cases:checks,scope:'CPU actual shared renderer and capture bodies with controlled renderer/DOM methods. No native WebGL, raster, phone or restoration timing claim.'},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
