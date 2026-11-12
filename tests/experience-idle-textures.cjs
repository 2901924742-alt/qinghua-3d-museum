'use strict';
// Actual heavyweight-entry functions with the real one-texture cache; no renderer or GPU.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'enhancements/experience.js'),'utf8'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const glb=fs.readFileSync(path.join(root,'qinghuaci.glb')),json=JSON.parse(glb.subarray(20,20+glb.readUInt32LE(12)).toString()),checks=[];
function excerpt(from,to){const start=source.indexOf(from),end=source.indexOf(to,start);assert(start>=0&&end>start);return source.slice(start,end);}
(async()=>{
 const THREE=await import(pathToFileURL(path.join(root,'vendor/three.module.js')).href),{createExhibitTextureCache}=await import(pathToFileURL(path.join(root,'enhancements/exhibit-cache.js')).href);
 assert(html.includes('releaseIdleExhibitTextures:()=>exhibitTextures.clearIdle()'),'The main museum injects only idle-cache eviction');
 assert(source.includes('releaseIdleExhibitTextures=null'),'Existing callers retain an optional dependency');
 const studio=excerpt(' async function getStudioRenderer(){',' const initialPosition=').replace("import('./studio-renderer.js')",'loadStudio()');
 const capture=excerpt(' function capture(){',' function unwrap(){');
 const gesture=source.split(/\r?\n/).find(line=>line.trim().startsWith('gesture=createGestureExperience('));assert(gesture);
 for(const boundary of ['studio','gesture','capture'])for(const active of [false,true]){
  const cache=createExhibitTextureCache(),image={width:4096,height:4096,closed:0,close(){this.closed++;}},map=new THREE.Texture(image),lease=cache.lease('./qinghuaci.glb'),model={};let disposed=0,calls=0;
  map.addEventListener('dispose',()=>disposed++);
  await lease.plugin({json,associations:new Map(),loadTexture:async()=>map}).loadTexture(0);lease.bind(model);if(!active)cache.releaseModel(model);
  function released(){calls++;cache.clearIdle();}
  function beforeAllocation(){assert.equal(calls>0,true,'Eviction precedes heavyweight allocation');assert.equal(image.closed,active?0:1);assert.equal(disposed,active?0:1);}
  const context={releaseIdleExhibitTextures:released,disposed:false,DOMException,THREE,renderer:{domElement:{width:8,height:6}},scene:{},camera:{},controls:{},isDesktop:()=>false,model:null,ui:{language:'zh'},gallery:null,exhibitIndex:0,cleanup:[],loadExhibit(){},disposeExhibit(){},releaseSceneGPU:null,cancelIntro(){},pausedEffects:false,createGestureExperience:options=>options,starfield:null,requireContext:beforeAllocation,updateBackground:beforeAllocation,renderMuseum:beforeAllocation,document:{createElement(){beforeAllocation();return {getContext:()=>({drawImage:beforeAllocation})};}},loadStudio:async()=>{beforeAllocation();return {createStudioRenderer(){beforeAllocation();return {cached:true};}};}};
  vm.createContext(context);
  if(boundary==='studio'){
   vm.runInContext('let studioPromise=null;'+studio+';globalThis.enter=getStudioRenderer;',context);
   assert.equal((await context.enter()).cached,true);assert.equal((await context.enter()).cached,true);assert.equal(calls,2,'Reusing a studio still clears newly idle textures');
   context.disposed=true;await assert.rejects(context.enter(),{name:'AbortError'});assert.equal(calls,2);
  }else if(boundary==='gesture'){
   vm.runInContext('let gesture;'+gesture+';globalThis.enter=gesture.pauseEffects;',context);
   context.enter(false);assert.equal(calls,0);context.enter(true);assert.equal(calls,1);context.enter(false);assert.equal(calls,1,'Closing a gesture must not evict');
  }else{
   vm.runInContext(capture+';globalThis.enter=capture;',context);const canvas=context.enter();assert.equal(canvas.width,8);assert.equal(canvas.height,6);assert.equal(calls,1);
   context.starfield={frameState:{capturing:true}};assert.throws(context.enter,error=>error.code==='MUSEUM_STARFIELD_CAPTURE_BUSY');assert.equal(calls,1,'A rejected overlapping PNG does not change the cache');
   context.starfield=null;context.releaseIdleExhibitTextures=null;context.enter();assert.equal(calls,1,'Omitted injection remains compatible');
  }
  assert.equal(cache.stats.refs,active?1:0);assert.equal(cache.stats.retained,active);assert.equal(image.closed,active?0:1);cache.dispose();lease.release();assert.equal(image.closed,1);assert.equal(disposed,1);
  checks.push(boundary+'-'+(active?'active-original-lease-preserved':'idle-original-GPU-and-image-released-before-allocation'));
 }
 console.log(JSON.stringify({status:'passed',checks:checks.length,cases:checks,scope:'Actual entry code and real Texture/cache ownership; no GPU, native allocation or total-memory measurement.'},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
