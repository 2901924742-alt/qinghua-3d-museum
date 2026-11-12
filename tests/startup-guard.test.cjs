// Node-only regression of real startup code. No browser, GPU, network or added dependency.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
function extract(start, end) {
 const from = html.indexOf(start), to = html.indexOf(end, from + start.length);
 assert(from >= 0 && to > from, `Startup source markers changed: ${start}`);
 return html.slice(from, to);
}
const classic = extract('<script>', '</script>').slice('<script>'.length);
const interiorGuard = extract('const interiorPreparations = new WeakMap();', 'function prepareExhibit(');
const modelBlock = extract('let modelLoadStopped=false, modelLoadTimer;', '/* ================= 动画');
const reveal = extract('async function revealMuseum(){', '</script>');
assert(!/\bcompileAsync\s*\(/.test(reveal), 'Startup must not wait on asynchronous shader readiness');
assert(/renderer\.compile\(scene,camera\)/.test(reveal), 'Synchronous shader preparation is required');
const importMapEnd=html.indexOf('</script>',html.indexOf('<script type="importmap">'));
const backgroundPreload=html.indexOf('<link rel="modulepreload" href="./enhancements/starfield-background.js">');
assert(importMapEnd>=0&&backgroundPreload>importMapEnd,'Background module preload must follow the import map');

function environment(withModel = false) {
 let now = 0, nextId = 0, callbacks;
 const timers = new Map(), elements = new Map(), events = new Map();
 const timer = (fn, delay = 0) => { const id = ++nextId; timers.set(id, {at:now + delay, fn}); return id; };
 const element = id => {
  if (!elements.has(id)) {
   const classes = new Set();
   elements.set(id, {textContent:'', hidden:true, style:{}, addEventListener(){},
    classList:{add:key=>classes.add(key), contains:key=>classes.has(key),
     remove:key=>classes.delete(key), toggle(key,on){if(on) classes.add(key); else classes.delete(key);}}});
  }
  return elements.get(id);
 };
 const metrics = {prepared:0, added:0, revealed:0, disposed:[], warnings:0, disabled:0};
 const context = {console:{warn(){metrics.warnings++;}, error(){}}, setTimeout:timer, clearTimeout:id=>timers.delete(id),
  requestAnimationFrame:fn=>timer(()=>fn(now),16), performance:{now:()=>now},
  matchMedia:()=>({matches:false}), HTMLScriptElement:class {static supports(){return true;}},
  document:{hidden:false, documentElement:element('html'), getElementById:element, addEventListener(){}},
  addEventListener(type,handler){events.set(type,handler);}, location:{reload(){}},
  disableMuseumEnhancements(){metrics.disabled++;},
  loader:{load(url,onLoad,onProgress,onError){callbacks={onLoad,onProgress,onError};}},
  prepareExhibit(model){metrics.prepared++; return model;}, disposeExhibit(model){metrics.disposed.push(model);},
  THREE:{}, addInterior(){return {ready:Promise.resolve()};},
  scene:{add(){metrics.added++;}}, exhibitModel:null, safeExperience(){},
  revealMuseum(){metrics.revealed++; return Promise.resolve();}
 };
 context.window = context;
 vm.createContext(context);
 vm.runInContext(classic, context, {timeout:1000});
 if (withModel) { context.museumLoading.engineReady(); vm.runInContext(`'use strict';\n${interiorGuard}\n${modelBlock}`,context,{timeout:1000}); }
 function advance(ms) {
  const target = now + ms;
  let ticks=0;
  while (true) {
   assert(++ticks<1000,'Unexpected repeating startup timer');
   const due = [...timers].filter(([,t])=>t.at<=target).sort((a,b)=>a[1].at-b[1].at || a[0]-b[0])[0];
   if (!due) break;
   now=due[1].at; timers.delete(due[0]); due[1].fn();
  }
  now=target;
 }
 return {context, metrics, advance, element, events, get callbacks(){return callbacks;}};
}

(async()=>{
// Missing engine: an actionable error appears at 45 seconds, and the first cause is retained.
{
 const e=environment(); e.advance(44999); assert.equal(e.context.museumLoadErrorKey,undefined);
 e.advance(1); assert.equal(e.context.museumLoadErrorKey,'engineTimeout');
 assert.equal(e.element('retryBtn').hidden,false);
 const message=e.element('loadingStatus').textContent;
 e.context.showMuseumLoadError('Later error','startupError');
 assert.equal(e.context.museumLoadErrorKey,'engineTimeout'); assert.equal(e.element('loadingStatus').textContent,message);
}
{
 const e=environment(); e.context.museumLoading.engineReady(); e.advance(60001);
 assert.equal(e.context.museumLoadErrorKey,undefined,'Main module start must cancel the engine deadline');
}

// Both stalled transfer and 100%-reported-but-still-parsing must time out and reject late recovery.
for (const reportedComplete of [false,true]) {
 const e=environment(true);
 if (reportedComplete) e.callbacks.onProgress({loaded:120,total:100,lengthComputable:true});
 e.advance(59999); assert.equal(e.context.museumLoadErrorKey,undefined);
 e.advance(1); assert.equal(e.context.museumLoadErrorKey,'modelTimeout');
 assert.equal(e.element('retryBtn').hidden,false);
 const message=e.element('loadingStatus').textContent, lateModel={name:'late model'};
 await e.callbacks.onLoad({scene:lateModel});
 assert.deepEqual(e.metrics.disposed,[lateModel]);
 assert.equal(e.metrics.prepared,0); assert.equal(e.metrics.added,0); assert.equal(e.metrics.revealed,0);
 e.callbacks.onProgress({loaded:1,total:2,lengthComputable:true}); e.callbacks.onError(new Error('Late failure'));
 assert.equal(e.context.museumLoadErrorKey,'modelTimeout'); assert.equal(e.element('loadingStatus').textContent,message);
 e.advance(60001); assert.equal(e.context.museumLoadErrorKey,'modelTimeout');
}
{
 const e=environment(true); e.advance(40000);
 e.callbacks.onProgress({loaded:50,total:100,lengthComputable:true});
 e.advance(59999); assert.equal(e.context.museumLoadErrorKey,undefined,'Progress must restart the 60-second idle deadline');
 e.advance(1); assert.equal(e.context.museumLoadErrorKey,'modelTimeout');
}
{
 const e=environment(true); await e.callbacks.onLoad({scene:{name:'on-time model'}}); e.advance(60001);
 assert.equal(e.context.museumLoadErrorKey,undefined,'Successful model load must cancel its deadline');
 assert.equal(e.metrics.prepared,1); assert.equal(e.metrics.added,1); assert.equal(e.metrics.revealed,1);
}

// A failure during the 180 ms fade must reveal the retry UI again.
{
 const e=environment(); e.context.museumLoading.engineReady(); e.advance(5000);
 const finishing=e.context.museumLoading.finish(); await Promise.resolve();
 assert.equal(e.element('loading').classList.contains('leaving'),true);
 e.context.showMuseumLoadError('Injected fade failure','startupError');
 assert.equal(e.element('loading').classList.contains('leaving'),false);
 assert.equal(e.element('retryBtn').hidden,false); e.advance(180);
 assert.equal(await finishing,false); assert.notEqual(e.element('loading').style.display,'none');
}
// Core static modules must produce an immediate startup error, not the optional-module fallback.
for(const module of ['interior','interior-data','exhibit-cache']) {
 const e=environment(); e.events.get('error')({filename:`http://museum.local/enhancements/${module}.js`,message:'Injected module error',target:null});
 assert.equal(e.context.museumLoadErrorKey,'startupError',module); assert.equal(e.metrics.disabled,0);
}
{
 const e=environment();e.events.get('error')({filename:'http://museum.local/enhancements/experience.js',message:'Optional failure',target:null});
 assert.equal(e.context.museumLoadErrorKey,undefined);assert.equal(e.metrics.disabled,1);
}
// Reconstruction faults are optional; both synchronous throws and rejected readiness retain the model.
for(const rejected of [false,true]) {
 const e=environment(true);e.context.addInterior=()=>{if(rejected)return{ready:Promise.reject(Error('Injected interior rejection'))};throw Error('Injected interior throw');};
 await e.callbacks.onLoad({scene:{name:'valid model'}});
 assert.equal(e.context.museumLoadErrorKey,undefined);assert.equal(e.metrics.prepared,1);
 assert.equal(e.metrics.added,1);assert.equal(e.metrics.revealed,1);assert.equal(e.metrics.disposed.length,0);assert.equal(e.metrics.warnings,1);
}
{
 const e=environment(true);e.context.prepareExhibit=()=>{throw Error('Invalid exhibit dimensions');};
 await e.callbacks.onLoad({scene:{name:'invalid dimensions'}});
 assert.equal(e.context.museumLoadErrorKey,'modelSizeError');assert.equal(e.metrics.added,0);assert.equal(e.metrics.disposed.length,1);
}

async function checkReveal(compileThrows) {
 const calls={compile:0,render:0,start:0,raf:0,order:[]}, failure=new Error('Injected compile failure');
 const renderer={compile(){calls.compile++; if(compileThrows) throw failure;},
  get compileAsync(){assert.fail('revealMuseum must never access compileAsync');}};
 const warmLifetime=new AbortController();renderer.domElement=new EventTarget();
 const context={Promise,AbortController,setTimeout,clearTimeout,performance:{now:()=>0},document:{hidden:false},backgroundWarmLifetime:warmLifetime,experiencePromise:Promise.resolve({warmBackground({signal,deadline}){assert.equal(signal.aborted,false);assert.equal(deadline,8000);assert.equal(calls.raf,2);assert.equal(calls.compile,0);return Promise.resolve(true);}}),addEventListener(){},removeEventListener(){},renderer,scene:{},camera:{},experienceLoaded:Promise.resolve(),
  museumLoading:{wait:()=>Promise.resolve(),status(){},finish:()=>Promise.resolve(true)},
  requestAnimationFrame(fn){calls.raf++;fn();}, safeExperience(fn){fn({prepareIntro(){calls.order.push('prepareIntro');},afterControls(){calls.order.push('afterControls');},startIntro(){calls.start++;}});},
  updateMistInstances(){},updateBlackHoleView(){},renderMuseum(){calls.order.push('render');calls.render++;},animationClock:{getDelta(){}},
  queueNextExhibit(){},previousFrameAt:0,previousRafAt:0,qualityWindowAt:0,resetViewBtn:{disabled:true}
 };
 context.window=context;vm.createContext(context);
 const result=vm.runInContext(`${reveal}\nrevealMuseum();`,context,{timeout:1000});
 if(compileThrows) {await assert.rejects(result,error=>error===failure);assert.equal(calls.render,0);assert.equal(calls.start,0);}
 else {await result;assert.equal(calls.render,1);assert.equal(calls.start,1);assert.equal(context.resetViewBtn.disabled,false);assert.deepEqual(calls.order,['prepareIntro','afterControls','render'],'The prepared intro camera must reach the background before the first visible render');}
 assert.equal(calls.compile,1);assert.equal(calls.raf,2,'Preparation status needs two animation frames before GPU work');
}

 await checkReveal(false);await checkReveal(true);
 // One eight-second deadline covers both imports; slow success stays inside the preparation mask.
 assert(html.includes('const experiencePromise=import('),'Optional experience readiness must be retained for bounded preparation');
 const flush=async()=>{for(let i=0;i<10;i++)await Promise.resolve();};
 for(const mode of ['late-experience','late-background','ready-after-old-window','ready-near-deadline','pagehide','contextlost','rejected','throwing']){
  let now=0,id=0,resolveExperience,resolveWarm;const timers=new Map(),events=new EventTarget(),canvas=new EventTarget(),counts={compile:0,warm:0,render:0,start:0,warnings:0,raf:0,order:[]};
  const experiencePromise=new Promise(resolve=>{resolveExperience=resolve;}),warmPromise=new Promise(resolve=>{resolveWarm=resolve;});
  const lifetime=new AbortController();events.addEventListener('pagehide',()=>lifetime.abort());let warmSignal;
  const context={Promise,AbortController,performance:{now:()=>now},document:{hidden:false},backgroundWarmLifetime:lifetime,experiencePromise,console:{warn(){counts.warnings++;}},setTimeout(fn,ms){const key=++id;timers.set(key,{at:now+ms,fn});return key;},clearTimeout:key=>timers.delete(key),addEventListener:events.addEventListener.bind(events),removeEventListener:events.removeEventListener.bind(events),renderer:{domElement:canvas,compile(){counts.compile++;}},scene:{},camera:{},museumLoading:{wait:()=>Promise.resolve(),status(){},finish:()=>Promise.resolve(true)},requestAnimationFrame(fn){counts.raf++;fn();},safeExperience(fn){fn({prepareIntro(){counts.order.push('prepareIntro');},afterControls(){counts.order.push('afterControls');},startIntro(){counts.start++;}});},updateMistInstances(){},updateBlackHoleView(){},renderMuseum(){counts.order.push('render');counts.render++;},animationClock:{getDelta(){}},queueNextExhibit(){},previousFrameAt:0,previousRafAt:0,qualityWindowAt:0,resetViewBtn:{disabled:true}};
  context.window=context;vm.createContext(context);const result=vm.runInContext(reveal+'\nrevealMuseum();',context);await flush();assert.equal(counts.raf,2);assert.equal(counts.compile,0,'Downloading optional modules waits only inside the preparation mask');
  const experience={warmBackground({signal,deadline}){counts.warm++;warmSignal=signal;assert.equal(deadline,8000);if(mode==='throwing')throw Error('Injected optional warm exception');if(mode==='rejected')return Promise.reject(Error('Injected optional warm rejection'));return warmPromise;}};
  async function advance(ms){now+=ms;for(const [key,t]of [...timers])if(t.at<=now){timers.delete(key);t.fn();}await flush();}
  if(mode==='late-background'){await advance(600);resolveExperience(experience);await flush();assert.equal(counts.warm,1);await advance(7399);assert.equal(counts.compile,0);await advance(1);}
  else if(mode==='ready-after-old-window'){await advance(2000);assert.equal(counts.compile,0,'The old 1.5-second limit must not reveal the fallback');resolveExperience(experience);await flush();assert.equal(counts.warm,1);await advance(1500);assert.equal(counts.compile,0);resolveWarm(true);await flush();}
  else if(mode==='ready-near-deadline'){resolveExperience(experience);await flush();assert.equal(counts.warm,1);await advance(7999);assert.equal(counts.compile,0);resolveWarm(true);await flush();}
  else if(mode==='pagehide'||mode==='contextlost'){await advance(200);if(mode==='pagehide')events.dispatchEvent(new Event('pagehide'));else canvas.dispatchEvent(new Event('webglcontextlost'));await flush();}
  else if(mode==='rejected'||mode==='throwing'){resolveExperience(experience);await flush();}
  else {await advance(7999);assert.equal(counts.compile,0);await advance(1);}
  await result;assert.equal(counts.compile,1);assert.equal(counts.render,1);assert.equal(counts.start,1);assert.deepEqual(counts.order,['prepareIntro','afterControls','render'],mode+' synchronizes the intro background before first render');assert.equal(timers.size,0);if(warmSignal)assert.equal(warmSignal.aborted,true,'Every admission closes before compile/intro');
  const warmBefore=counts.warm;resolveExperience(experience);resolveWarm(true);await flush();assert.equal(counts.warm,warmBefore,'Late experience cannot begin a background after reveal');assert.equal(counts.compile,1);assert.equal(counts.warnings,mode==='rejected'||mode==='throwing'?1:0);
 }
 
 // BFCache cancels initial far admission without preventing original late optional UI creation.
 {
  const from=html.indexOf('const backgroundWarmLifetime='),to=html.indexOf('async function revealMuseum()',from);assert(from>=0&&to>from);
  const optional=html.slice(from,to).replace("import('./enhancements/experience.js')",'loadExperience()');
  const events=new EventTarget();let resolve,created=0,warmed=0;const waiting=new Promise(done=>{resolve=done;}),noop=()=>{};
  const context={AbortController,window:events,loadExperience:()=>waiting,THREE:{},scene:{},renderer:{},camera:{},controls:{},renderMuseum:noop,isDesktopRenderer:noop,hideInfo:noop,restoreInfo:noop,loadExhibit:noop,disposeExhibit:noop,releaseSceneGPU:noop,blackHoleGroup:{},starSphere:{kind:'stars'},starDust:{kind:'dust'},distantParticles:{kind:'distant'},particles:{kind:'particles'},mistClouds:[{kind:'mist'}],mistComposite:{kind:'composite'},exhibitModel:null,safeExperience:noop,disableExperience:noop};
  vm.createContext(context);vm.runInContext('let museumExperience=null;'+optional+';globalThis.readiness=experiencePromise;globalThis.admission=backgroundWarmLifetime.signal;',context);
  for(const type of ['pagehide','pageshow']){const event=new Event(type);Object.defineProperty(event,'persisted',{value:true});events.dispatchEvent(event);}
  resolve({createExperience(options){created++;assert.deepEqual(Array.from(options.legacySky),[context.starSphere,context.starDust,context.distantParticles,context.particles,...context.mistClouds,context.mistComposite],'Late optional UI borrows the existing sky objects');assert.equal(options.legacyBlackHole,context.blackHoleGroup);return {warmBackground(){warmed++;},ready(){},dispose(){}};}});await context.readiness;assert.equal(created,1);assert(events.museumEnhancements,'Late UI remains available after BFCache return');assert.equal(context.admission.aborted,true,'The cancelled initial far window never reopens');assert.equal(warmed,0);
 }
 console.log('Startup guards pass: engine/model deadlines, progress reset, late disposal, first-error retention, fade-error visibility, core/optional classification, reconstruction isolation and synchronous reveal');
})().catch(error=>{console.error(error);process.exitCode=1;});
