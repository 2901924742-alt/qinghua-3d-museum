const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.resolve(__dirname,'../enhancements/gallery.js'),'utf8')
 .replace("import {exhibits} from './exhibits.js';","const exhibits=['original','next','third','fourth'].map(url=>({url}));")
 .replace('export function createGallery','function createGallery');
let Vector,forbiddenAsyncReads=0;
const unhandled=[];
process.on('unhandledRejection',error=>unhandled.push(error));
const tick=()=>new Promise(setImmediate);
async function until(test){for(let i=0;i<100;i++){if(test())return;await tick()}throw new Error('Lifecycle test did not progress');}
function fixture({timeout=30000,holdLoads=0,compileFailures=0,commitFailures=0,holdFrame=false,withTexture=false,reduced=false,desktop=true}={}){
 let now=0,hidden=false,live=1,peak=1,model={url:'original'},gallery;
 let compileCalls=0,frameId=0,controlUpdates=0,infoChanges=0;
 const loadGates=[],frames=new Map(),disposed=new Set(),signals=[],states=[],galleryStates=[],commits=[],loads=[],commitDistances=[],sceneObjects=new Set([model]);
 const camera={position:new Vector(0,.8,5)},controls={target:new Vector(0,.1,0),target0:new Vector(0,.1,0),position0:new Vector(0,.8,5),maxDistance:40,enabled:true,enableDamping:true,autoRotate:true,update(){controlUpdates++;}};
 const scene={add(object){sceneObjects.add(object);},remove(object){sceneObjects.delete(object);}};
 const makeModel=url=>{live++;peak=Math.max(peak,live);return {url,traverse:fn=>{if(withTexture)fn({isMesh:true,material:{map:{isTexture:true}}})}}};
 // Older Safari exposes aborted/events but neither reason nor throwIfAborted.
 class LegacyAbortController extends AbortController{constructor(){super();Object.defineProperties(this.signal,{reason:{get:()=>undefined},throwIfAborted:{value:undefined}});}}
 const context={AbortController:process.env.LEGACY_ABORT==='1'?LegacyAbortController:AbortController,DOMException,console,performance:{now:()=>now},
  document:{get hidden(){return hidden;},body:{classList:{add(){},remove(){}}},getElementById:()=>({classList:{contains:()=>false}})},
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
  getModel:()=>model,commit:(next,index)=>{model=next;commits.push({url:next.url,index});commitDistances.push(camera.position.distanceTo(controls.target));if(commitFailures>0){commitFailures--;throw new Error('Injected presentation failure');}},
  ui:{galleryState:(index,target,state)=>{states.push(state);galleryStates.push({index,target,state});}},cancelIntro:reason=>assert.equal(reason,'gallery-step'),hideInfo(){infoChanges++;},restoreInfo(){infoChanges++;}
 });
 return {gallery,loadGates,disposed,signals,states,galleryStates,commits,loads,commitDistances,camera,controls,sceneObjects,setNow:value=>now=value,setHidden:value=>hidden=value,get model(){return model;},get controlUpdates(){return controlUpdates;},get infoChanges(){return infoChanges;},
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
 const cancelled=fixture();await cancelled.gallery.step(1);cancelled.setNow(1060);cancelled.gallery.update();cancelled.gallery.cancel('interaction');assert.equal(cancelled.gallery.index,0);assert.equal(cancelled.live,1);assert.equal(cancelled.controls.autoRotate,true);
 console.log('Swap occurs at 40m during the distant hold, including delayed frames; approach and cancellation restore controls');
}
async function cancelledMotionRecovery(){
 for(const committed of [false,true]){
  const f=fixture();await f.gallery.step(1);f.setNow(committed?1200:1060);f.gallery.update();
  const selected=f.model,start=f.camera.position.clone(),at=committed?1200:1060;
  f.gallery.cancel();
  assert.equal(f.gallery.index,committed?1:0);assert.equal(f.live,1);assert.equal(f.model,selected);assert(!f.disposed.has(selected));
  assert.equal(f.gallery.active,true);assert.equal(f.controls.autoRotate,true);assert(f.camera.position.equals(start));assert.equal(f.states.at(-1),'idle');
  f.setNow(at+150);f.gallery.update();
  assert(f.camera.position.distanceTo(f.controls.target)<40);assert(!f.camera.position.equals(start));assert(!f.camera.position.equals(f.controls.position0));
  f.setNow(at+300);f.gallery.update();
  assert.equal(f.gallery.active,false);assert(f.camera.position.distanceTo(f.controls.position0)<1e-6);assert(f.controls.target.distanceTo(f.controls.target0)<1e-6);
  assert.equal(f.controls.autoRotate,true);assert.equal(f.controls.enableDamping,true);assert.equal(f.controls.enabled,true);assert.equal(f.controls.maxDistance,40);assert.equal(f.live,1);
 }
 const background=fixture();background.controls.autoRotate=false;background.controls.enableDamping=false;
 await background.gallery.step(1);background.setNow(1200);background.gallery.update();background.setHidden(true);background.gallery.cancel('background');
 const distant=background.camera.position.clone();background.setNow(10000);background.gallery.update();assert(background.camera.position.equals(distant));assert.equal(background.live,1);
 background.setHidden(false);background.gallery.update();assert(background.camera.position.equals(distant));
 background.setNow(10150);background.gallery.update();assert(!background.camera.position.equals(distant));
 background.setNow(10300);background.gallery.update();assert.equal(background.gallery.active,false);assert(background.camera.position.distanceTo(background.controls.position0)<1e-6);
 assert.equal(background.controls.autoRotate,false);assert.equal(background.controls.enableDamping,false);
 const states=background.states.length;background.gallery.cancel();assert.equal(background.states.length,states);
 const panel=fixture();await panel.gallery.step(1);panel.setNow(1200);panel.gallery.update();panel.gallery.cancel();
 assert.equal(panel.controls.autoRotate,true);panel.controls.autoRotate=false;panel.controls.enabled=false;panel.setNow(1500);panel.gallery.update();
 assert.equal(panel.gallery.active,false);assert.equal(panel.controls.autoRotate,false);assert.equal(panel.controls.enabled,false);
 console.log('UI cancellation before/after commit disposes only the unused model and recovers smoothly; background recovery waits until visible');
}
async function interruptRecovery(){
 for(const reason of ['interaction','reset','dispose','contextlost']){
  const f=fixture();await f.gallery.step(1);f.setNow(1200);f.gallery.update();f.gallery.cancel();f.setNow(1300);f.gallery.update();
  const manual=f.camera.position.clone();f.gallery.cancel(reason);f.setNow(5000);f.gallery.update();
  assert(f.camera.position.equals(manual));assert.equal(f.gallery.active,false);assert.equal(f.controls.autoRotate,true);assert.equal(f.controls.enableDamping,true);assert.equal(f.live,1);
 }
 const direct=fixture();await direct.gallery.step(1);direct.setNow(1060);direct.gallery.update();
 const manual=direct.camera.position.clone();direct.gallery.cancel('interaction');direct.setNow(5000);direct.gallery.update();assert(direct.camera.position.equals(manual));assert.equal(direct.gallery.active,false);assert.equal(direct.live,1);
 const next=fixture();await next.gallery.step(1);next.setNow(1200);next.gallery.update();next.gallery.cancel();next.setNow(1350);next.gallery.update();
 await next.gallery.step(1);assert.equal(next.loads.at(-1),'third');next.setNow(2600);next.gallery.update();next.setNow(4500);next.gallery.update();
 assert.equal(next.gallery.index,2);assert.equal(next.gallery.active,false);assert.equal(next.live,1);assert.equal(next.controls.autoRotate,true);assert.equal(next.controls.enableDamping,true);
 console.log('Dragging/reset/dispose/context loss cancel recovery without camera takeover; a new step supersedes recovery and restores settings');
}
async function enterGestureDuringMotion(){
 for(const stage of ['outbound','committed','recovery']){
  const f=fixture();await f.gallery.step(1);f.setNow(stage==='outbound'?1060:1200);f.gallery.update();
  if(stage==='recovery'){f.gallery.cancel();f.setNow(1350);f.gallery.update();}
  const selected=f.model;assert(f.camera.position.distanceTo(f.controls.position0)>1);
  f.gallery.cancel('gesture');
  assert.equal(f.gallery.active,false);assert(f.camera.position.equals(f.controls.position0));assert(f.controls.target.equals(f.controls.target0));
  assert.equal(f.model,selected);assert.equal(f.gallery.index,stage==='outbound'?0:1);assert(!f.disposed.has(selected));assert.equal(f.live,1);
  assert.equal(f.controls.autoRotate,true);assert.equal(f.controls.enableDamping,true);
  const home=f.camera.position.clone();f.setNow(5000);f.gallery.update();assert(f.camera.position.equals(home));
 }
 const idle=fixture();idle.camera.position.set(2,1.5,8);idle.controls.target.set(.4,.3,0);
 const manual=idle.camera.position.clone(),target=idle.controls.target.clone(),states=idle.states.length;
 idle.gallery.cancel('gesture');idle.setNow(5000);idle.gallery.update();
 assert(idle.camera.position.equals(manual));assert(idle.controls.target.equals(target));assert.equal(idle.states.length,states);assert.equal(idle.gallery.active,false);
 console.log('Entering gestures during outbound/committed/recovery motion restores the normal view synchronously; an idle user view stays unchanged');
}
async function directSwitches(){
 const f=fixture({withTexture:true});f.controls.enabled=false;f.controls.autoRotate=false;
 const initialCamera=f.camera.position.clone(),initialTarget=f.controls.target.clone();
 for(const [index,url] of [[1,'next'],[2,'third'],[3,'fourth'],[0,'original']]){
  const previous=f.model;await f.gallery.step(1,{animate:false});
  assert.equal(f.gallery.index,index);assert.equal(f.model.url,url);assert.equal(f.gallery.active,false);
  assert(f.disposed.has(previous));assert(!f.disposed.has(f.model));assert.deepEqual([...f.sceneObjects],[f.model]);assert.equal(f.live,1);
  assert.deepEqual(f.galleryStates.at(-1),{index,target:index,state:'idle'});
  f.setNow(100000);f.gallery.update();
  assert(f.camera.position.equals(initialCamera));assert(f.controls.target.equals(initialTarget));
  assert.equal(f.controls.enabled,false);assert.equal(f.controls.autoRotate,false);assert.equal(f.controls.enableDamping,true);assert.equal(f.controls.maxDistance,40);
  assert.equal(f.controlUpdates,0);assert.equal(f.infoChanges,0);assert(!f.states.includes('moving'));
 }
 assert.equal(f.compileCalls,4);assert.equal(f.commits.length,4);assert.equal(f.peak,2);
 console.log('Direct switching cycles all exhibits and disposes replaced models without camera, controls, or info changes');
}
async function directFailureRecovery(){
 for(const failure of [{compileFailures:1},{commitFailures:1}]){
  const f=fixture(failure),original=f.model,initialCamera=f.camera.position.clone();
  await f.gallery.step(1,{animate:false});
  assert.equal(f.gallery.index,0);assert.equal(f.model,original);assert(!f.disposed.has(original));assert.deepEqual([...f.sceneObjects],[original]);
  assert.equal(f.gallery.active,false);assert.equal(f.live,1);assert.equal(f.disposed.size,1);assert.equal(f.states.at(-1),'error');
  if(failure.commitFailures)assert.deepEqual(f.commits,[{url:'next',index:1},{url:'original',index:0}]);
  assert(f.camera.position.equals(initialCamera));assert.equal(f.controlUpdates,0);assert.equal(f.infoChanges,0);
  await f.gallery.step(1,{animate:false});
  assert.equal(f.gallery.index,1);assert.equal(f.model.url,'next');assert(f.disposed.has(original));assert.equal(f.live,1);assert.deepEqual([...f.sceneObjects],[f.model]);
 }
 console.log('Direct compile/presentation failures preserve the old exhibit, roll back partial commits, and allow retry');
}
async function directCancellation(){
 const suspended=fixture({holdFrame:true,withTexture:true});
 const upload=suspended.gallery.step(1,{animate:false});await until(()=>suspended.frames===1);suspended.gallery.cancel();await upload;
 assert.equal(suspended.frames,0);assert.equal(suspended.commits.length,0);assert.equal(suspended.live,1);assert.equal(suspended.gallery.active,false);
 for(const action of ['cancel','timeout']){
  const f=fixture({holdLoads:1,timeout:action==='timeout'?5:30000}),original=f.model;
  const first=f.gallery.step(1,{animate:false});await until(()=>f.loadGates.length===1);if(action==='cancel')f.gallery.cancel();await first;
  assert.equal(f.model,original);assert.equal(f.gallery.active,false);assert.equal(f.commits.length,0);assert.equal(f.live,1);
  await f.gallery.step(1,{animate:false});const selected=f.model,disposedBefore=f.disposed.size;
  const late=f.loadGates[0].resolve();await tick();await tick();
  assert(f.disposed.has(late));assert.equal(f.disposed.size,disposedBefore+1);assert.equal(f.model,selected);assert.equal(f.gallery.index,1);assert.equal(f.commits.length,1);
  assert.equal(f.live,1);assert.deepEqual([...f.sceneObjects],[selected]);assert.equal(f.infoChanges,0);assert.equal(f.controlUpdates,0);
 }
 const concurrent=fixture({holdFrame:true,withTexture:true}),choices=[];
 choices.push(concurrent.gallery.step(1,{animate:false}));await until(()=>concurrent.frames===1);
 choices.push(concurrent.gallery.step(1,{animate:false}));choices.push(concurrent.gallery.step(1,{animate:false}));await until(()=>concurrent.loads.length===2&&concurrent.frames===1);
 concurrent.flushFrames();await Promise.all(choices);
 assert.deepEqual(concurrent.commits,[{url:'fourth',index:3}]);assert.equal(concurrent.gallery.index,3);assert.equal(concurrent.live,1);assert.equal(concurrent.peak,2);
 console.log('Direct cancellation/timeout releases preparation; late results and rapid choices cannot replace the latest exhibit');
}
(async()=>{({Vector3:Vector}=await import(require('node:url').pathToFileURL(path.resolve(__dirname,'../vendor/three.module.js')).href));await timeoutDuringPreparation();await concurrentPreparation();await cancelWhileFrameSuspended();await timeoutWhileFrameSuspended();await lateLoaderResults();await compileFailureRecovery();await reducedMotion();await distantSwap();await cancelledMotionRecovery();await interruptRecovery();await enterGestureDuringMotion();await directSwitches();await directFailureRecovery();await directCancellation();await tick();assert.equal(forbiddenAsyncReads,0);assert.deepEqual(unhandled,[]);console.log('Gallery lifecycle checks pass without asynchronous shader polling or unhandled rejections');})().catch(error=>{console.error(error);process.exitCode=1});
