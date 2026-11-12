const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');const {pathToFileURL}=require('node:url');
(async()=>{
 const root=path.resolve(__dirname,'..');
 // The requested full-world replacement supersedes the old 480px blue billboard/cadence contract.
 // Reuse its actual-math/resource suite instead of keeping assertions for the removed renderer.
 const {execFileSync}=require('node:child_process');
 const worldOutput=execFileSync(process.execPath,[path.join(__dirname,'starfield-world-background.cjs')],{encoding:'utf8'});assert(worldOutput.includes('cleanup pass'));process.stdout.write(worldOutput);

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
 function warmHarness({constructorFails=false,constructorCost=0,updateFails=false}={}){
  let now=0,id=0,resolve,reject,waiting;const timers=new Map(),handlers=new Map(),counts={imports:0,created:0,disposed:0,updates:0,warnings:0,lastFrame:null};
  const reset=()=>{waiting=new Promise((a,b)=>{resolve=a;reject=b;});};reset();
  const module={createStarfieldBackground(){counts.created++;now+=constructorCost;if(constructorFails)throw Error('Injected optional warm constructor failure');return {update(delta,frameState){counts.updates++;counts.lastFrame=frameState;if(updateFails)throw Error('Injected background update failure');},dispose(){counts.disposed++;}};}};
  const loading={style:{display:''}};
  const context={AbortController,Promise,performance:{now:()=>now},setTimeout(fn,ms){const key=++id;timers.set(key,{at:now+ms,fn});return key;},clearTimeout:key=>timers.delete(key),console:{warn(){counts.warnings++;}},document:{hidden:false,getElementById:()=>loading,body:{classList:{remove(){}}}},controls:{},window:{},renderer:{getContext:()=>({isContextLost:()=>false})},THREE:{},scene:{},camera:{},legacyBlackHole:{visible:true},legacySky:[],restoreInfo(){},isDesktop:()=>true,loadBackground:()=>{counts.imports++;return waiting;},listen(node,type,handler){handlers.set(type,handler);},counts};
  vm.createContext(context);vm.runInContext('let disposed=false,background=null,backgroundPromise=null,backgroundFailed=false,backgroundWarm=null,backgroundToken=0,backgroundContextLost=false,backgroundPageHidden=false,starfield=null,starfieldOpening=false,gesture={active:false},intro=null,introCancelled=false,cancelStarfieldPending=null,gallery={cancel(){}};const lifetime=new AbortController(),cleanup=[];'+warmCode+updateCode+cancelCode+pagehide+cleanupLine+disposeLine+';globalThis.api={warm:warmBackground,cancel:cancelBackgroundWarm,update:updateBackground,lose:loseBackground,restore:restoreBackground,dispose,near(){cancelIntro("starfield");starfield={active:true,frameState:{time:4,capturing:false}};},return(){starfield=null;},intro(){intro={running:true,damping:true,auto:true,infoHidden:true};},finishIntro,loadingDone(){document.getElementById("loading").style.display="none";},get owner(){return background;}};',context);
  return {api:context.api,counts,context,resolve:()=>resolve(module),reject:()=>reject(Error('Injected optional warm import failure')),reset,async advance(ms){now+=ms;for(const [key,t]of [...timers])if(t.at<=now){timers.delete(key);t.fn();}await flush();},pagehide:()=>handlers.get('pagehide')(),show:()=>handlers.get('pageshow')?.(),get timerCount(){return timers.size;}};
 }
 {
  const h=warmHarness();h.api.update(.1);assert.equal(h.counts.imports,0,'Natural updates never begin an optional background allocation');
  const preparing=h.api.warm({deadline:1500});await h.advance(900);assert.equal(h.counts.created,0);h.resolve();assert.equal(await preparing,true);const owner=h.api.owner;
  h.api.intro();h.api.update(.1);assert.equal(h.counts.updates,1,'Existing far view can follow the intro camera');h.api.near();h.api.update(.1);assert.equal(h.counts.updates,2,'Near observation samples the same retained background');assert.equal(h.counts.lastFrame.time,4,'Near frame state reaches the shared background');assert.equal(h.api.owner,owner);assert.equal(h.counts.disposed,0);h.api.return();h.api.update(.1);assert.equal(h.counts.updates,3);assert.equal(await h.api.warm({deadline:1500}),true);assert.equal(h.counts.created,1);h.api.dispose();h.api.dispose();assert.equal(h.counts.disposed,1);assert.equal(h.timerCount,0);
 }
 {
  const h=warmHarness(),preparing=h.api.warm({deadline:1500});await h.advance(1499);assert.equal(h.counts.created,0);await h.advance(1);assert.equal(await preparing,false);h.resolve();await flush();assert.equal(h.counts.created,0,'Timed-out continuation must not allocate later');assert.equal(h.timerCount,0);
  h.api.update(.1);await flush();assert.equal(h.counts.created,0,'Fallback remains stable while the loading SVG is visible');
  h.api.loadingDone();h.api.intro();h.api.update(.1);await flush();assert.equal(h.counts.created,0,'Starting an intro does not retry');
  h.api.finishIntro();await h.advance(15000);h.api.update(.1);await flush();assert.equal(h.counts.created,0,'Intro completion and fifteen seconds cannot hot-swap the fallback');
  h.context.document.hidden=true;h.pagehide();h.api.update(.1);await h.advance(1000);h.context.document.hidden=false;h.show();h.api.update(.1);await flush();assert.equal(h.counts.created,0,'Returning visible cannot naturally construct a timed-out background');assert.equal(h.timerCount,0);
  assert.equal(await h.api.warm(),true,'Explicit warm may use the already downloaded module');assert.equal(h.counts.imports,1);assert.equal(h.counts.created,1);assert.equal(await h.api.warm(),true);
  for(let i=0;i<10;i++)h.api.update(.1);assert.equal(h.counts.created,1,'An explicit successful warm retains one background');h.api.dispose();assert.equal(h.counts.disposed,1);assert.equal(h.timerCount,0);
 }
 {
  const h=warmHarness();let settled=false;const preparing=h.api.warm();preparing.then(()=>{settled=true;});
  await h.advance(1499);assert.equal(settled,false,'Default warm remains live before 1500 ms');assert.equal(h.timerCount,1);
  await h.advance(1);assert.equal(await preparing,false,'Default warm still expires at 1500 ms');assert.equal(settled,true);assert.equal(h.timerCount,0);
  h.resolve();await flush();assert.equal(h.counts.created,0,'The default deadline still rejects late allocation');h.api.dispose();
 }
 {
  const h=warmHarness();let settled=false;const preparing=h.api.warm({deadline:8000});preparing.then(()=>{settled=true;});
  await h.advance(1499);assert.equal(settled,false);await h.advance(1);assert.equal(settled,false,'Explicit 8-second warm is not clipped to the default 1500 ms');
  await h.advance(6499);assert.equal(settled,false);assert.equal(h.timerCount,1);h.resolve();assert.equal(await preparing,true,'Admission at 7999 ms remains valid');assert.equal(h.counts.created,1);assert.equal(h.timerCount,0);h.api.dispose();assert.equal(h.counts.disposed,1);
 }
 {
  const h=warmHarness();let settled=false;const preparing=h.api.warm({deadline:8000});preparing.then(()=>{settled=true;});
  await h.advance(7999);assert.equal(settled,false);await h.advance(1);assert.equal(await preparing,false,'8000 ms is the exclusive admission cutoff');h.resolve();await flush();assert.equal(h.counts.created,0,'A module arriving at the cutoff cannot allocate later');assert.equal(h.timerCount,0);
  h.api.loadingDone();await h.advance(15000);h.api.update(.1);await flush();assert.equal(h.counts.created,0,'The long startup deadline also leaves a stable fallback');
  assert.equal(await h.api.warm(),true,'A later explicit action can reuse the resolved module');assert.equal(h.counts.created,1);assert.equal(h.counts.imports,1);h.api.dispose();assert.equal(h.counts.disposed,1);
 }
 {
  const h=warmHarness(),preparing=h.api.warm({deadline:20000});await h.advance(7999);assert.equal(h.timerCount,1);await h.advance(1);assert.equal(await preparing,false,'Callers cannot extend startup admission beyond 8000 ms');h.resolve();await flush();assert.equal(h.counts.created,0);assert.equal(h.timerCount,0);h.api.dispose();
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
 {const h=warmHarness({updateFails:true}),preparing=h.api.warm({deadline:1500});h.resolve();assert.equal(await preparing,true);h.api.update(.1);assert.equal(h.api.owner,null);assert.equal(h.counts.disposed,1,'Failed live background releases its one owner');h.api.loadingDone();await h.advance(5000);h.api.update(.1);await flush();assert.equal(h.counts.created,1,'A live failure does not enter an uncontrolled allocation retry loop');h.api.dispose();assert.equal(h.counts.disposed,1);}
 console.log('Bounded warm admission, cancellation/late rejection, same-world near frames, stable timeout fallback, explicit 8-second admission and one-shot context recovery pass');
 console.log(JSON.stringify({status:'passed-starfield-background-CPU',replacedContracts:['Low-resolution blue billboard and throttled far-only render were replaced by the full original-color world background suite.','Near view retains and updates the shared background with its frame state.','A timed-out optional import leaves a stable fallback through intro completion, elapsed time and visible return; only explicit warm may reuse the cached module. Default admission is 1500 ms and explicit admission is capped at 8000 ms.'],fixture:{actualWorldBackgroundSuite:true,actualExperienceAdmissionAndUpdate:true,controlledCoreAndTimers:true,GPU:false}}));
})().catch(error=>{console.error(error);process.exitCode=1;});
