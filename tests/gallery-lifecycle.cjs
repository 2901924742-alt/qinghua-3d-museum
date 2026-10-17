const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.resolve(__dirname,'../enhancements/gallery.js'),'utf8')
 .replace("import {exhibits} from './exhibits.js';","const exhibits=['original','next','third','fourth'].map(url=>({url}));")
 .replace('export function createGallery','function createGallery');
let Vector,forbiddenAsyncReads=0;
const unhandled=[];
process.on('unhandledRejection',error=>unhandled.push(error));
const tick=()=>new Promise(setImmediate);
async function until(test){for(let i=0;i<100;i++){if(test())return;await tick()}throw new Error('Lifecycle test did not progress');}
function fixture({timeout=30000,holdLoads=0,compileFailures=0,holdFrame=false,withTexture=false,reduced=false,desktop=true}={}){
 let now=0,live=1,peak=1,model={url:'original'},gallery;
 let compileCalls=0,frameId=0;
 const loadGates=[],frames=new Map(),disposed=new Set(),signals=[],states=[],commits=[],loads=[],commitDistances=[];
 const camera={position:new Vector(0,.8,5)},controls={target:new Vector(0,.1,0),target0:new Vector(0,.1,0),position0:new Vector(0,.8,5),maxDistance:40,enableDamping:true,autoRotate:true,update(){}};
 const scene={add(){},remove(){}};
 const makeModel=url=>{live++;peak=Math.max(peak,live);return {url,traverse:fn=>{if(withTexture)fn({isMesh:true,material:{map:{isTexture:true}}})}}};
 const context={AbortController,DOMException,console,performance:{now:()=>now},
  document:{body:{classList:{add(){},remove(){}}},getElementById:()=>({classList:{contains:()=>false}})},
  window:{museumLoading:{desktopIntro:desktop}},matchMedia:()=>({matches:reduced}),
  setTimeout:(fn,ms)=>setTimeout(fn,ms===30000?timeout:ms),clearTimeout,
  requestAnimationFrame:fn=>{if(!holdFrame)return setImmediate(fn);const id=++frameId;frames.set(id,fn);return id;},
  cancelAnimationFrame:id=>{if(holdFrame)frames.delete(id);else clearImmediate(id)}
 };
 vm.createContext(context);vm.runInContext(source+';globalThis.createGallery=createGallery;',context);
 gallery=context.createGallery({THREE:{Vector3:Vector,Scene:class{add(candidate){this.candidate=candidate;}}},
  renderer:{compile(staging,view,lighting){compileCalls++;assert(staging.candidate);assert.equal(view,camera);assert.equal(lighting,scene);if(compileFailures>0){compileFailures--;throw new Error('Injected compile failure');}},get compileAsync(){forbiddenAsyncReads++;assert.fail('Exhibit preparation must not access compileAsync');},initTexture(){}},
  scene,camera,controls,
  loadExhibit:(url,signal)=>{signals.push(signal);loads.push(url);if(holdLoads>0){holdLoads--;return new Promise((resolve,reject)=>loadGates.push({resolve(){const candidate=makeModel(url);resolve(candidate);return candidate;},reject}));}return Promise.resolve(makeModel(url));},
  disposeExhibit:object=>{assert(!disposed.has(object),'An exhibit was disposed twice');disposed.add(object);live--},
  getModel:()=>model,commit:(next,index)=>{model=next;commits.push({url:next.url,index});commitDistances.push(camera.position.distanceTo(controls.target))},
  ui:{galleryState:(index,target,state)=>states.push(state)},cancelIntro:()=>gallery.cancel(),hideInfo(){},restoreInfo(){}
 });
 return {gallery,loadGates,disposed,signals,states,commits,loads,commitDistances,camera,controls,setNow:value=>now=value,
  flushFrames(){const ready=[...frames.values()];frames.clear();ready.forEach(fn=>fn());},get frames(){return frames.size;},get compileCalls(){return compileCalls;},get live(){return live},get peak(){return peak}};
}
async function timeoutDuringPreparation(){
 const f=fixture({timeout:5,holdLoads:1});await f.gallery.step(1);f.setNow(3000);f.gallery.update();
 assert.equal(f.signals[0].aborted,true);assert.equal(f.commits.length,0);
 assert.equal(f.gallery.index,0);assert.equal(f.gallery.active,false);assert.equal(f.live,1);assert.equal(f.states.at(-1),'error');
 // The first loader never settles; the preparation chain must still permit a fresh choice.
 await f.gallery.step(1);f.setNow(6000);f.gallery.update();f.setNow(8000);f.gallery.update();
 assert.equal(f.loads.length,2);assert.equal(f.gallery.index,1);assert.equal(f.gallery.active,false);assert.equal(f.live,1);
 console.log('Permanently pending parsing times out, retains the original, and permits another choice');
}
async function concurrentPreparation(){
 const f=fixture({holdFrame:true,withTexture:true}),promises=[];
 const step=()=>promises.push(f.gallery.step(1));
 step();await until(()=>f.frames===1);step();step();await until(()=>f.loads.length===2&&f.frames===1);
 const peakBeforeRelease=f.peak;
 f.flushFrames();
 await Promise.all(promises);f.setNow(3000);f.gallery.update();f.setNow(5000);f.gallery.update();
 assert.equal(peakBeforeRelease,2);assert.equal(f.peak,2);assert.equal(f.gallery.index,3);
 assert.deepEqual(f.commits,[{url:'fourth',index:3}]);assert.equal(f.live,1);f.gallery.cancel();
 console.log('Concurrent choices prepare one candidate at a time and commit the latest');
}
async function cancelWhileFrameSuspended(){
 const f=fixture({holdFrame:true,withTexture:true});let done=false;
 const promise=f.gallery.step(1).finally(()=>done=true);await until(()=>f.frames===1);
 f.gallery.cancel();await until(()=>done);await promise;
 assert.equal(f.commits.length,0);assert.equal(f.gallery.active,false);assert.equal(f.live,1);assert.equal(f.frames,0);
 console.log('Cancellation releases a candidate even when animation frames are suspended');
}
async function timeoutWhileFrameSuspended(){
 const f=fixture({timeout:5,holdFrame:true,withTexture:true});await f.gallery.step(1);
 assert.equal(f.gallery.active,false);assert.equal(f.live,1);assert.equal(f.frames,0);assert.equal(f.states.at(-1),'error');
 console.log('The preparation deadline also releases a suspended texture upload');
}
async function lateLoaderResults(){
 for(const action of ['cancel','timeout']){
  const f=fixture({holdLoads:1,timeout:action==='timeout'?5:30000});const first=f.gallery.step(1);
  await until(()=>f.loadGates.length===1);if(action==='cancel')f.gallery.cancel();await first;
  assert.equal(f.gallery.active,false);assert.equal(f.live,1);
  await f.gallery.step(1);f.setNow(3000);f.gallery.update();f.setNow(5000);f.gallery.update();
  assert.equal(f.gallery.index,1);assert.equal(f.gallery.active,false);assert.equal(f.live,1);
  const disposedBefore=f.disposed.size;
  const late=f.loadGates[0].resolve();await tick();await tick();
  assert(f.disposed.has(late));assert.equal(f.disposed.size,disposedBefore+1);assert.equal(f.live,1);assert.equal(f.commits.length,1);assert.equal(f.compileCalls,1);assert.equal(f.gallery.index,1);
 }
 for(const action of ['cancel','timeout']){
  const f=fixture({holdLoads:1,timeout:action==='timeout'?5:30000});const first=f.gallery.step(1);await until(()=>f.loadGates.length===1);
  if(action==='cancel')f.gallery.cancel();await first;f.loadGates[0].reject(new Error('Late parser rejection'));await tick();await tick();
  assert.equal(f.live,1);assert.equal(f.commits.length,0);assert.equal(f.gallery.active,false);
 }
 console.log('Cancelled/timed-out late models are disposed once; late rejections are handled');
}
async function compileFailureRecovery(){
 const f=fixture({compileFailures:1});await f.gallery.step(1);
 assert.equal(f.gallery.index,0);assert.equal(f.gallery.active,false);assert.equal(f.live,1);assert.equal(f.states.at(-1),'error');
 await f.gallery.step(1);f.setNow(3000);f.gallery.update();f.setNow(5000);f.gallery.update();
 assert.equal(f.gallery.index,1);assert.equal(f.gallery.active,false);assert.equal(f.live,1);assert.equal(f.compileCalls,2);
 console.log('Synchronous compile failure releases its candidate and allows retry');
}
async function reducedMotion(){
 const mobile=fixture({reduced:true,desktop:false});await mobile.gallery.step(1);mobile.gallery.update();assert.equal(mobile.gallery.index,1);assert.equal(mobile.gallery.active,false);
 const desktop=fixture({reduced:true});await desktop.gallery.step(1);desktop.gallery.update();assert.equal(desktop.gallery.index,0);desktop.setNow(3000);desktop.gallery.update();assert.equal(desktop.gallery.index,1);desktop.setNow(5000);desktop.gallery.update();assert.equal(desktop.gallery.active,false);
 console.log('Mobile reduced motion skips the transition; desktop keeps its approved default animation');
}
async function distantSwap(){
 const f=fixture();await f.gallery.step(1);f.setNow(1060);f.gallery.update();
 assert.equal(f.gallery.index,0);assert(Math.abs(f.camera.position.distanceTo(f.controls.target)-40)<1e-6);
 f.setNow(1200);f.gallery.update();assert.equal(f.gallery.index,1);assert(Math.abs(f.commitDistances[0]-40)<1e-6);
 f.setNow(1300);f.gallery.update();assert(Math.abs(f.camera.position.distanceTo(f.controls.target)-40)<1e-6);
 f.setNow(2000);f.gallery.update();assert(f.camera.position.distanceTo(f.controls.target)<40);
 f.setNow(3100);f.gallery.update();assert.equal(f.gallery.active,false);assert(f.camera.position.distanceTo(f.controls.position0)<1e-6);
 assert.equal(f.controls.maxDistance,40);assert.equal(f.controls.autoRotate,true);assert.equal(f.controls.enableDamping,true);
 const delayed=fixture();await delayed.gallery.step(1);delayed.setNow(4000);delayed.gallery.update();assert.equal(delayed.gallery.index,1);assert.equal(delayed.gallery.active,true);assert(Math.abs(delayed.commitDistances[0]-40)<1e-6);delayed.setNow(6000);delayed.gallery.update();assert.equal(delayed.gallery.active,false);
 const cancelled=fixture();await cancelled.gallery.step(1);cancelled.setNow(1060);cancelled.gallery.update();cancelled.gallery.cancel();assert.equal(cancelled.gallery.index,0);assert.equal(cancelled.live,1);assert.equal(cancelled.controls.autoRotate,true);
 console.log('Swap occurs at 40m during the distant hold, including delayed frames; approach and cancellation restore controls');
}
(async()=>{({Vector3:Vector}=await import(require('node:url').pathToFileURL(path.resolve(__dirname,'../vendor/three.module.js')).href));await timeoutDuringPreparation();await concurrentPreparation();await cancelWhileFrameSuspended();await timeoutWhileFrameSuspended();await lateLoaderResults();await compileFailureRecovery();await reducedMotion();await distantSwap();await tick();assert.equal(forbiddenAsyncReads,0);assert.deepEqual(unhandled,[]);console.log('Gallery lifecycle checks pass without asynchronous shader polling or unhandled rejections');})().catch(error=>{console.error(error);process.exitCode=1});
