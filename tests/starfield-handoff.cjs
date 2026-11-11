const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),literalBase=path.resolve(process.env.MUSEUM_LITERAL_BASE||root),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),exp=fs.readFileSync(path.join(root,'enhancements/experience.js'),'utf8');
const start=html.indexOf('function animate(timestamp'),end=html.indexOf('    const elapsed = animationClock.elapsedTime;',start);assert(start>=0&&end>start);
const animate=html.slice(start,end)+'fallthrough++;}';
for(const desktop of [false,true])for(const active of [false,true])for(const handled of [false,true]){
 const counts={request:0,quality:0,clock:0,near:0};
 const context={document:{hidden:false},renderer:{getContext:()=>({isContextLost:()=>false})},loadingScreen:{style:{display:'none'}},requestAnimationFrame:()=>counts.request++,monitorDesktopQuality:()=>counts.quality++,isDesktopRenderer:()=>desktop,previousFrameAt:0,previousRafAt:11,qualityWindowAt:12,qualitySamples:13,qualityTotalMs:14,fallthrough:0,animationClock:{getDelta:()=>{counts.clock++;return .02;}},safeExperience:fn=>fn({exclusiveActive:active,renderExclusive:delta=>{assert.equal(delta,.02);counts.near++;return handled;}})};
 vm.createContext(context);vm.runInContext(animate+'animate(100);',context);
 assert.equal(counts.request,1);assert.equal(counts.clock,1);assert.equal(counts.quality,active?0:1);assert.equal(counts.near,active?1:0);assert.equal(context.fallthrough,active&&handled?0:1);
 if(active&&handled)assert.deepEqual([context.previousRafAt,context.qualityWindowAt,context.qualitySamples,context.qualityTotalMs],[0,0,0,0]);
 vm.runInContext('animate(101);',context);assert.equal(counts.clock,desktop||active?1:2,'60Hz close-up cap; legacy mobile cadence unchanged');
}
// Closing during a near-frame still consumes that frame; the restored view resumes next rAF.
{const method=exp.match(/  renderExclusive\(delta\)\{[^\n]+/)[0],context={starfieldOpening:false,starfield:{active:true,render(){this.active=false;}}};vm.createContext(context);vm.runInContext('globalThis.api={'+method+'};',context);assert.equal(context.api.renderExclusive(.02),true);assert.equal(context.api.renderExclusive(.02),false);context.starfieldOpening=true;assert.equal(context.api.renderExclusive(.02),true);}

// Raw near feedback and clamped museum motion must originate in one actual clock read.
for(const raw of [.2,.5,1/60])for(const active of [false,true]){
 const counts={clock:0,near:0},context={document:{hidden:false},renderer:{getContext:()=>({isContextLost:()=>false})},loadingScreen:{style:{display:'none'}},requestAnimationFrame(){},monitorDesktopQuality(){},isDesktopRenderer:()=>true,previousFrameAt:0,previousRafAt:0,qualityWindowAt:0,qualitySamples:0,qualityTotalMs:0,animationClock:{getDelta(){counts.clock++;return raw;}},safeExperience:fn=>fn({exclusiveActive:active,renderExclusive(value){counts.near++;assert.equal(value,raw,'Exclusive feedback receives actual raw duration');return true;}})};
 vm.createContext(context);vm.runInContext(html.slice(start,end)+'globalThis.motionDelta=delta;}',context);vm.runInContext('animate(100);',context);assert.equal(counts.clock,1,'One clock read for motion and feedback');assert.equal(counts.near,active?1:0);if(!active)assert.equal(context.motionDelta,Math.min(raw,.1),'Original museum motion remains clamped');
}
{
 const marker="document.addEventListener('visibilitychange', () => {",at=html.indexOf(marker,html.indexOf('const animationClock')),to=html.indexOf('\n});',at);assert(at>0&&to>at);let listener,drains=0;const context={document:{addEventListener(type,fn){assert.equal(type,'visibilitychange');listener=fn;}},previousFrameAt:1,previousRafAt:2,qualityWindowAt:3,qualitySamples:4,qualityTotalMs:5,animationClock:{getDelta(){drains++;return 20;}}};vm.createContext(context);vm.runInContext(html.slice(at,to+4),context);listener();assert.equal(drains,1);assert.deepEqual([context.previousFrameAt,context.previousRafAt,context.qualityWindowAt,context.qualitySamples,context.qualityTotalMs],[0,0,0,0,0]);
}

const opening=exp.slice(exp.indexOf(' async function openStarfield('),exp.indexOf(' function updateBackground(')).replace("import('./starfield-experience.js')",'loadStarfield()');
assert(opening.includes('await starfield.open'));
async function harness(){
 const {pathToFileURL}=require('node:url'),THREE=await import(pathToFileURL(path.join(literalBase,'vendor/three.module.js')).href);let resolve,reject;const waiting=new Promise((a,b)=>{resolve=a;reject=b;});
 const counts={constructed:0,opened:0,returned:[],resumed:0,closed:0,farDisposed:0,warmCancelled:0},controls={enabled:true,autoRotate:true,enableDamping:true,target:new THREE.Vector3(0,1,0),update(){}},camera={position:new THREE.Vector3(0,0,4),quaternion:new THREE.Quaternion()};
 const button=new EventTarget();button.focus=()=>{};const nodes=[];const document={activeElement:{isConnected:true,focus(){}},createElement(){const node=new EventTarget();Object.assign(node,{style:{},setAttribute(){},querySelector:()=>button,show(){this.open=true;},close(){this.open=false;},remove(){this.removed=true;}});nodes.push(node);return node;},body:{append(){}}};
 const context={THREE,controls,camera,document,AbortController,console:{warn(){}},loadStarfield:()=>waiting,options:{onReturn:reason=>counts.returned.push(reason)},resumeMuseum:()=>counts.resumed++,counts};vm.createContext(context);
 const cancel=exp.slice(exp.indexOf(" function cancelIntro(reason="),exp.indexOf(' const interruptView='));
 const getter=exp.match(/  get exclusiveActive\(\)\{[^\n]+/)[0];
 vm.runInContext(`let disposed=false,gesture={active:false},gallery={active:false,cancel(){}},intro=null,introCancelled=false,starfield=null,starfieldPromise=null,starfieldOpening=false,starfieldToken=0,cancelStarfieldPending=null,background={dispose(){counts.farDisposed++;}};const cancelBackgroundWarm=()=>counts.warmCancelled++;const exclusiveActive=()=>starfieldOpening||!!starfield?.active;const renderer={},ui={language:'zh'},isDesktop=()=>true;`+opening+cancel+`;globalThis.run=openStarfield;globalThis.cancel=cancelIntro;globalThis.pending=()=>starfieldOpening;globalThis.loop={${getter}};globalThis.close=()=>starfield?.close('return');globalThis.drop=()=>{disposed=true;cancelStarfieldPending?.('dispose');starfieldToken++;starfieldOpening=false;};globalThis.newOwner=()=>{starfieldToken++;starfield={active:true,close(){counts.closed++;}};};`,context);
 const module={createStarfieldExperience(){counts.constructed++;return {active:false,async open(options){counts.opened++;this.active=true;this.callback=options.onReturn;return true;},close(reason){if(!this.active)return;this.active=false;counts.closed++;this.callback(reason);}};}};
 return {context,counts,controls,camera,nodes,button,resolve:()=>resolve(module),reject:error=>reject(error)};
}
(async()=>{
 {
  const h=await harness(),pending=h.context.run(h.context.options);assert.equal(h.nodes.length,1);assert.equal(h.nodes[0].open,true);assert.equal(h.context.pending(),true);assert.equal(h.context.loop.exclusiveActive,false,'Pending host download never parks the museum loop');assert.equal(h.controls.enabled,true);assert.equal(h.controls.autoRotate,true);assert.equal(await h.context.run({}),false,'No overlapping intent');
  h.camera.position.set(3,2,9);h.controls.target.set(1,.2,0);h.resolve();assert.equal(await pending,true);assert.equal(h.controls.enabled,false);assert.equal(h.context.loop.exclusiveActive,true);assert.equal(h.counts.farDisposed,0,'Near entry retains the warm far owner');h.context.close();h.context.close();assert.equal(h.counts.farDisposed,0,'Return reuses the far owner without a cold constructor');assert(h.counts.warmCancelled>0,'Near entry invalidates pending far preparation');assert.deepEqual(h.camera.position.toArray(),[3,2,9],'Capture the latest view after download, not the earlier click');assert.deepEqual(h.controls.target.toArray(),[1,.2,0]);assert.equal(h.controls.enabled,true);assert.equal(h.controls.autoRotate,true);assert.equal(h.controls.enableDamping,true);assert.deepEqual(h.counts.returned,['return']);assert.equal(h.counts.resumed,1);assert.equal(h.nodes[0].removed,true);assert.equal(h.nodes[0].open,false);
 }
 {
  const h=await harness(),pending=h.context.run(h.context.options);h.button.dispatchEvent(new Event('click'));assert.deepEqual(h.counts.returned,['return']);assert.equal(h.nodes[0].removed,true);h.resolve();assert.equal(await pending,false);assert.equal(h.counts.constructed,0);
 }
 for(const reason of ['ui','interaction','background']){
  const h=await harness(),pending=h.context.run(h.context.options);h.context.cancel(reason);assert.deepEqual(h.counts.returned,['return'],'Cancel immediately restores the parked workshop callback');assert.equal(h.context.pending(),false);assert.equal(h.controls.enabled,true);h.context.cancel(reason);h.resolve();assert.equal(await pending,false);assert.equal(h.counts.constructed,0);assert.equal(h.counts.resumed,0);assert.deepEqual(h.counts.returned,['return']);
 }
 {
  const h=await harness(),pending=h.context.run(h.context.options);h.context.drop();h.context.drop();assert.deepEqual(h.counts.returned,['dispose']);h.resolve();assert.equal(await pending,false);assert.equal(h.counts.constructed,0);assert.equal(h.counts.resumed,0);
 }
 {
  const h=await harness(),pending=h.context.run(h.context.options);h.context.cancel('interaction');h.context.newOwner();h.reject(Error('Old deferred transport failure'));assert.equal(await pending,false);assert.equal(h.counts.closed,0,'Stale rejection cannot close a newer owner');assert.equal(h.context.loop.exclusiveActive,true);assert.deepEqual(h.counts.returned,['return']);
 }
 {
  const h=await harness(),pending=h.context.run(h.context.options);h.reject(Error('Host transport failure'));assert.equal(await pending,false);assert.equal(h.controls.enabled,true);assert.equal(h.context.pending(),false);assert.equal(h.counts.resumed,0);
 }
 // Exercise actual reverse cleanup order together with the real workshop caller.
 {
  const h=await harness(),uiSource=fs.readFileSync(path.join(literalBase,'enhancements/ui.js'),'utf8'),uiCaller=uiSource.slice(uiSource.indexOf(' function openStudioExperience('),uiSource.indexOf(' function sourcesHTML('));
  Object.assign(h.counts,{studioSuspends:0,studioResumes:0,parentShows:0,parentCloses:0});
  const parent={open:true,close(){this.open=false;h.counts.parentCloses++;},showModal(){this.open=true;h.counts.parentShows++;}};h.context.parent=h.context.dialog=parent;h.context.document.body.classList={add(){},remove(){}};h.context.close=()=>parent.close();
  vm.runInContext(`let studioSuspension=null,studioToken=1,panel='explore',tab='studio',uiDisposed=false,callerPending;const studio={suspend(){counts.studioSuspends++;},resume(){counts.studioResumes++;}},core={gestureActive:()=>false};`+uiCaller+`;globalThis.startCaller=()=>openStudioExperience(options=>{callerPending=run({...options,onReturn:reason=>{counts.returned.push(reason);options.onReturn(reason);}});return callerPending;});globalThis.callerPromise=()=>callerPending;`,h.context);
  h.context.startCaller();assert.equal(parent.open,false);assert.equal(h.counts.studioSuspends,1);const closesBeforeDispose=h.counts.parentCloses;
  const lines=exp.split(/\r?\n/),dispose=lines.find(line=>line.startsWith(' function dispose(){')),pendingCleanup=lines.find(line=>line.includes("cleanup.push(()=>{cancelStarfieldPending?.('dispose')")),uiCleanup=lines.find(line=>line.trim()==='cleanup.push(()=>ui.dispose());'),introCleanup=lines.find(line=>line.includes('cleanup.push(()=>{if(intro){')&&line.includes("cancelIntro('dispose')"));assert(dispose&&pendingCleanup&&uiCleanup&&introCleanup);
  vm.runInContext('const cleanup=[],lifetime=new AbortController();ui.dispose=()=>{uiDisposed=true;};'+pendingCleanup+uiCleanup+introCleanup+dispose+';globalThis.actualDispose=dispose;',h.context);
  h.context.actualDispose();h.context.actualDispose();assert.deepEqual(h.counts.returned,['dispose'],'Actual reverse cleanup must cancel pending intent as dispose');assert.equal(h.counts.studioResumes,0,'Disposal must never resume the parked workshop');assert.equal(h.counts.parentShows,0,'Disposal must never reopen its parent dialog');assert.equal(parent.open,false);assert.equal(h.counts.parentCloses,closesBeforeDispose+1);assert.equal(h.nodes[0].removed,true);
  h.resolve();assert.equal(await h.context.callerPromise(),false);assert.equal(h.counts.constructed,0);assert.equal(h.counts.resumed,0);assert.deepEqual(h.counts.returned,['dispose']);
 }
 console.log('Starfield shared-loop cap, consumed close frame, deferred handoff, immediate cancellation, latest-view return and stale failure isolation pass');
})().catch(error=>{console.error(error);process.exitCode=1;});
