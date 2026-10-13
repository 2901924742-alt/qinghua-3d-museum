const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.resolve(__dirname,'../enhancements/gallery.js'),'utf8')
 .replace("import {exhibits} from './exhibits.js';","const exhibits=['original','next','third','fourth'].map(url=>({url}));")
 .replace('export function createGallery','function createGallery');
class Vector{clone(){return new Vector()}sub(){return this}multiplyScalar(){return this}add(){return this}lerpVectors(){return this}copy(){return this}}
const tick=()=>new Promise(setImmediate);
async function until(test){for(let i=0;i<100;i++){if(test())return;await tick()}throw new Error('Lifecycle test did not progress');}
function fixture({timeout=30000,holdCompile=false,holdFrame=false,withTexture=false,reduced=false,desktop=true}={}){
 let now=0,live=1,peak=1,model={url:'original'},gallery;
 const releases=[],disposed=new Set(),signals=[],states=[],commits=[],loads=[];
 const context={AbortController,DOMException,console,performance:{now:()=>now},
  document:{body:{classList:{add(){},remove(){}}},getElementById:()=>({classList:{contains:()=>false}})},
  window:{museumLoading:{desktopIntro:desktop}},matchMedia:()=>({matches:reduced}),
  setTimeout:(fn,ms)=>setTimeout(fn,ms===30000?timeout:ms),clearTimeout,
  requestAnimationFrame:fn=>holdFrame?1:setImmediate(fn),cancelAnimationFrame:id=>{if(!holdFrame)clearImmediate(id)}
 };
 vm.createContext(context);vm.runInContext(source+';globalThis.createGallery=createGallery;',context);
 gallery=context.createGallery({THREE:{Vector3:Vector,Scene:class{add(){}}},
  renderer:{compileAsync:()=>holdCompile?new Promise(resolve=>releases.push(resolve)):new Promise(resolve=>setTimeout(resolve,20)),initTexture(){}},
  scene:{add(){},remove(){}},camera:{position:new Vector()},
  controls:{target:new Vector(),target0:new Vector(),position0:new Vector(),enableDamping:true,autoRotate:true,update(){}},
  loadExhibit:async(url,signal)=>{signals.push(signal);loads.push(url);live++;peak=Math.max(peak,live);return {url,traverse:fn=>{if(withTexture)fn({isMesh:true,material:{map:{isTexture:true}}})}}},
  disposeExhibit:object=>{assert(!disposed.has(object),'An exhibit was disposed twice');disposed.add(object);live--},
  getModel:()=>model,commit:(next,index)=>{model=next;commits.push({url:next.url,index})},
  ui:{galleryState:(index,target,state)=>states.push(state)},cancelIntro:()=>gallery.cancel(),hideInfo(){},restoreInfo(){}
 });
 return {gallery,releases,signals,states,commits,loads,setNow:value=>now=value,get live(){return live},get peak(){return peak}};
}
async function timeoutDuringCompile(){
 const f=fixture({timeout:5});await f.gallery.step(1);f.setNow(3000);f.gallery.update();
 assert.equal(f.signals[0].aborted,true);assert.equal(f.commits.length,0);
 assert.equal(f.gallery.index,0);assert.equal(f.gallery.active,false);assert.equal(f.live,1);assert.equal(f.states.at(-1),'error');
 console.log('Preparation timeout retains the original and releases its candidate');
}
async function concurrentPreparation(){
 const f=fixture({holdCompile:true}),promises=[];let done=0;
 const step=()=>{const promise=f.gallery.step(1);promises.push(promise);promise.finally(()=>done++);};
 step();await until(()=>f.releases.length===1);step();step();await tick();
 const peakBeforeRelease=f.peak;
 for(let i=0;i<100&&done<3;i++){f.releases.splice(0).forEach(resolve=>resolve());await tick()}
 await Promise.all(promises);f.setNow(3000);f.gallery.update();
 assert.equal(peakBeforeRelease,2);assert.equal(f.peak,2);assert.equal(f.gallery.index,3);
 assert.deepEqual(f.commits,[{url:'fourth',index:3}]);assert.equal(f.live,1);f.gallery.cancel();
 console.log('Concurrent choices prepare one candidate at a time and commit the latest');
}
async function cancelWhileFrameSuspended(){
 const f=fixture({holdCompile:true,holdFrame:true,withTexture:true});let done=false;
 const promise=f.gallery.step(1).finally(()=>done=true);await until(()=>f.releases.length===1);
 f.releases.shift()();await tick();f.gallery.cancel();await until(()=>done);await promise;
 assert.equal(f.commits.length,0);assert.equal(f.gallery.active,false);assert.equal(f.live,1);
 console.log('Cancellation releases a candidate even when animation frames are suspended');
}
async function reducedMotion(){
 const mobile=fixture({reduced:true,desktop:false});await mobile.gallery.step(1);mobile.gallery.update();assert.equal(mobile.gallery.index,1);assert.equal(mobile.gallery.active,false);
 const desktop=fixture({reduced:true});await desktop.gallery.step(1);desktop.gallery.update();assert.equal(desktop.gallery.index,0);desktop.setNow(3000);desktop.gallery.update();assert.equal(desktop.gallery.index,1);
 console.log('Mobile reduced motion skips the transition; desktop keeps its approved default animation');
}
(async()=>{await timeoutDuringCompile();await concurrentPreparation();await cancelWhileFrameSuspended();await reducedMotion()})().catch(error=>{console.error(error);process.exitCode=1});
