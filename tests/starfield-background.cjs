const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');const {pathToFileURL}=require('node:url');
(async()=>{
 const root=path.resolve(__dirname,'..'),literalBase=path.resolve(process.env.MUSEUM_LITERAL_BASE||root),THREE=await import(pathToFileURL(path.join(literalBase,'vendor/three.module.js')).href),source=fs.readFileSync(path.join(literalBase,'enhancements/starfield-background.js'),'utf8').replace(/^import .*;\r?\n/,'').replace('export function createStarfieldBackground','function createStarfieldBackground');
 for(const mobile of [false,true]){
  const scene=new THREE.Scene(),legacy=new THREE.Group(),camera=new THREE.PerspectiveCamera();legacy.position.set(-7,3,-26);camera.position.set(0,0,4);scene.add(legacy);
  let disposed=0,frames=0,size,borrowed;const params={};const context={THREE,scene,camera,legacy,isDesktop:()=>!mobile,renderer:{},createStarfieldCore:({isMobile})=>{assert.equal(isMobile,true,'Far view never allocates the large unused nebula');return {params,sync(){},resize(w,h){size=[w,h];},render(t,v,target){frames++;borrowed=target;assert(Number.isFinite(t));assert(target.isWebGLRenderTarget);},dispose(){disposed++;}};}};
  vm.createContext(context);vm.runInContext(source+';globalThis.api=createStarfieldBackground({THREE,scene,camera,legacy,renderer,isDesktop});',context);
  assert.deepEqual(size,mobile?[256,128]:[480,240]);assert.equal(frames,1);assert.equal(legacy.visible,false);assert.equal(params.stars,0);assert.equal(params.nebula,0);assert.equal(params.temp,10000);assert.equal(params.steps,mobile?400:500);
  const mesh=scene.getObjectByName('museum-starfield-background');assert(mesh&&mesh.visible);assert.equal(mesh.material.toneMapped,false);assert.equal(mesh.material.depthWrite,false);assert.equal(borrowed.width,size[0]);
  context.api.update(.01);assert.equal(frames,1);for(let i=0;i<30;i++)context.api.update(.1);assert(frames<=1+(mobile?12:24),'Far update rate must remain bounded');
  const before=frames;context.api.dispose();context.api.dispose();context.api.update(1);assert.equal(disposed,1);assert.equal(frames,before);assert.equal(legacy.visible,true);assert.equal(scene.getObjectByName('museum-starfield-background'),undefined);
 }
 const scene=new THREE.Scene(),legacy=new THREE.Group(),camera=new THREE.PerspectiveCamera();scene.add(legacy);let disposed=0;
 const context={THREE,scene,camera,legacy,renderer:{},isDesktop:()=>true,createStarfieldCore:()=>({params:{},sync(){},resize(){},render(){throw Error('Injected cold far frame failure');},dispose(){disposed++;}})};
 vm.createContext(context);vm.runInContext(source,context);assert.throws(()=>context.createStarfieldBackground(context),/Injected cold/);assert.equal(disposed,1);assert.equal(scene.children.length,1);assert.equal(legacy.visible,true);

 // Execute the actual experience admission/update/context handlers without constructing UI or a GPU.
 const exp=fs.readFileSync(path.join(root,'enhancements/experience.js'),'utf8');
 const warmStart=exp.indexOf(' function cancelBackgroundWarm('),warmEnd=exp.indexOf(' async function openStarfield(');
 assert(warmStart>=0&&warmEnd>warmStart,'Explicit bounded warm admission is required');
 const warmCode=exp.slice(warmStart,warmEnd).replace("import('./starfield-background.js')",'loadBackground()');
 const updateCode=exp.slice(exp.indexOf(' function updateBackground('),exp.indexOf('\n const ui='));
 const cancelCode=exp.slice(exp.indexOf(" function cancelIntro(reason="),exp.indexOf(' const interruptView='));
 const pagehide=exp.split(/\r?\n/).filter(line=>line.includes("listen(window,'pagehide'")||line.includes("listen(window,'pageshow'")).join('\n');assert(pagehide,'Pagehide must invalidate admission');
 const cleanupLine=exp.split(/\r?\n/).find(line=>line.includes('cleanup.push(')&&line.includes('background?.dispose()'));
 const disposeLine=exp.split(/\r?\n/).find(line=>line.startsWith(' function dispose(){'));assert(cleanupLine&&disposeLine);
 const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
 function warmHarness({constructorFails=false,constructorCost=0}={}){
  let now=0,id=0,resolve,reject,waiting;const timers=new Map(),handlers=new Map(),counts={imports:0,created:0,disposed:0,updates:0,warnings:0};
  const reset=()=>{waiting=new Promise((a,b)=>{resolve=a;reject=b;});};reset();
  const module={createStarfieldBackground(){counts.created++;now+=constructorCost;if(constructorFails)throw Error('Injected optional warm constructor failure');return {update(){counts.updates++;},dispose(){counts.disposed++;}};}};
  const context={AbortController,Promise,performance:{now:()=>now},setTimeout(fn,ms){const key=++id;timers.set(key,{at:now+ms,fn});return key;},clearTimeout:key=>timers.delete(key),console:{warn(){counts.warnings++;}},document:{hidden:false,body:{classList:{remove(){}}}},controls:{},window:{},renderer:{getContext:()=>({isContextLost:()=>false})},THREE:{},scene:{},camera:{},legacyBlackHole:{visible:true},isDesktop:()=>true,loadBackground:()=>{counts.imports++;return waiting;},listen(node,type,handler){handlers.set(type,handler);},counts};
  vm.createContext(context);vm.runInContext('let disposed=false,background=null,backgroundPromise=null,backgroundFailed=false,backgroundWarm=null,backgroundToken=0,backgroundContextLost=false,backgroundPageHidden=false,starfield=null,starfieldOpening=false,gesture={active:false},intro=null,introCancelled=false,cancelStarfieldPending=null,gallery={cancel(){}};const lifetime=new AbortController(),cleanup=[];'+warmCode+updateCode+cancelCode+pagehide+cleanupLine+disposeLine+';globalThis.api={warm:warmBackground,cancel:cancelBackgroundWarm,update:updateBackground,lose:loseBackground,restore:restoreBackground,dispose,near(){cancelIntro("starfield");starfield={active:true};},return(){starfield=null;},intro(){intro={damping:true,auto:true,infoHidden:true};},get owner(){return background;}};',context);
  return {api:context.api,counts,context,resolve:()=>resolve(module),reject:()=>reject(Error('Injected optional warm import failure')),reset,async advance(ms){now+=ms;for(const [key,t]of [...timers])if(t.at<=now){timers.delete(key);t.fn();}await flush();},pagehide:()=>handlers.get('pagehide')(),show:()=>handlers.get('pageshow')?.(),get timerCount(){return timers.size;}};
 }
 {
  const h=warmHarness();h.api.update(.1);assert.equal(h.counts.imports,0,'Natural update never begins module download or allocation');
  const preparing=h.api.warm({deadline:1500});await h.advance(900);assert.equal(h.counts.created,0);h.resolve();assert.equal(await preparing,true);const owner=h.api.owner;
  h.api.intro();h.api.update(.1);assert.equal(h.counts.updates,1,'Existing far view can follow the intro camera');h.api.near();h.api.update(.1);assert.equal(h.counts.updates,1,'Near ownership performs no far draw');assert.equal(h.api.owner,owner);assert.equal(h.counts.disposed,0);h.api.return();h.api.update(.1);assert.equal(h.counts.updates,2);assert.equal(await h.api.warm({deadline:1500}),true);assert.equal(h.counts.created,1);h.api.dispose();h.api.dispose();assert.equal(h.counts.disposed,1);assert.equal(h.timerCount,0);
 }
 {
  const h=warmHarness();const preparing=h.api.warm({deadline:1500});await h.advance(1499);assert.equal(h.counts.created,0);await h.advance(1);assert.equal(await preparing,false);h.resolve();await flush();h.api.update(.1);assert.equal(h.counts.created,0,'Timed-out import cannot construct after the museum begins');assert.equal(h.counts.imports,1);assert.equal(h.timerCount,0);
 }
 for(const reason of ['signal','pagehide','near','dispose']){
  const h=warmHarness(),controller=new AbortController(),preparing=h.api.warm({signal:controller.signal,deadline:1500});
  if(reason==='signal')controller.abort();else if(reason==='pagehide')h.pagehide();else if(reason==='near')h.api.near();else h.api.dispose();
  assert.equal(await preparing,false,reason);h.resolve();await flush();assert.equal(h.counts.created,0,reason+' rejects late allocation');assert.equal(h.timerCount,0);
  if(reason==='pagehide'||reason==='dispose')assert.equal(await h.api.warm({deadline:1500}),false);
 }
 {
  const h=warmHarness(),old=h.api.warm({deadline:1500});h.api.lose();assert.equal(await old,false);const restored=h.api.restore();assert.equal(await h.api.restore(),false,'Only one restore warm per native loss epoch');h.resolve();assert.equal(await restored,true);assert.equal(h.counts.created,1,'Old and restored continuations cannot both construct');h.api.lose();assert.equal(h.counts.disposed,1);assert.equal(await h.api.restore(),true);assert.equal(h.counts.created,2);h.api.dispose();assert.equal(h.counts.disposed,2);assert.equal(h.timerCount,0);
 }
 {
  const h=warmHarness();const preparing=h.api.warm({deadline:1500});h.reject();assert.equal(await preparing,false);assert.equal(h.counts.warnings,1);h.api.update(.1);assert.equal(h.counts.created,0);h.reset();h.api.lose();const restored=h.api.restore();h.resolve();assert.equal(await restored,true,'A new loss/restore epoch permits one recovery after an optional import failure');assert.equal(h.counts.imports,2);h.api.dispose();
 }
 {
  const h=warmHarness({constructorFails:true}),preparing=h.api.warm({deadline:1500});h.resolve();assert.equal(await preparing,false);assert.equal(h.counts.warnings,1);assert.equal(h.api.owner,null);h.api.update(.1);assert.equal(h.counts.created,1,'Optional constructor failure cannot retry in the animation loop');h.api.dispose();
 }
 {const h=warmHarness({constructorCost:1600}),preparing=h.api.warm({deadline:1500});h.resolve();assert.equal(await preparing,true,'A constructor admitted before deadline remains valid after synchronous work crosses it');assert.equal(h.counts.created,1,'The deadline cannot preempt the synchronous constructor');assert.equal(h.counts.disposed,0);assert(h.api.owner);assert.equal(h.timerCount,0);h.api.dispose();assert.equal(h.counts.disposed,1);}
 for(const bfcache of [false,true]){
  const h=warmHarness(),initial=h.api.warm({deadline:1500});h.resolve();assert.equal(await initial,true);h.api.lose();h.context.document.hidden=true;if(bfcache)h.pagehide({persisted:true});assert.equal(await h.api.restore(),false);h.context.document.hidden=false;if(bfcache)h.show({persisted:true});h.api.update(.1);await flush();assert(h.api.owner,'A hidden restored page keeps its pending loss until visible recovery');assert.equal(h.counts.created,2);assert.equal(h.counts.disposed,1);assert.equal(await h.api.restore(),false);h.api.update(.1);assert.equal(h.counts.created,2,'Recovery admission occurs once per native loss epoch');h.api.dispose();assert.equal(h.counts.disposed,2);assert.equal(h.timerCount,0);
 }
 console.log('Bounded warm admission, cancellation/late rejection, retained near owner and one-shot context recovery pass');
 console.log('Starfield far budget, shared borrowed output, cadence, fallback and idempotent cleanup pass');
})().catch(error=>{console.error(error);process.exitCode=1;});
