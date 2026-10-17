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
const modelBlock = extract('let modelLoadStopped=false, modelLoadTimer;', '/* ================= 动画');
const reveal = extract('async function revealMuseum(){', '</script>');
assert(!/\bcompileAsync\s*\(/.test(reveal), 'Startup must not wait on asynchronous shader readiness');
assert(/renderer\.compile\(scene,camera\)/.test(reveal), 'Synchronous shader preparation is required');

function environment(withModel = false) {
 let now = 0, nextId = 0, callbacks;
 const timers = new Map(), elements = new Map();
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
 const metrics = {prepared:0, added:0, revealed:0, disposed:[]};
 const context = {console:{warn(){}, error(){}}, setTimeout:timer, clearTimeout:id=>timers.delete(id),
  requestAnimationFrame:fn=>timer(()=>fn(now),16), performance:{now:()=>now},
  matchMedia:()=>({matches:false}), HTMLScriptElement:class {static supports(){return true;}},
  document:{hidden:false, documentElement:element('html'), getElementById:element, addEventListener(){}},
  addEventListener(){}, location:{reload(){}},
  loader:{load(url,onLoad,onProgress,onError){callbacks={onLoad,onProgress,onError};}},
  prepareExhibit(model){metrics.prepared++; return model;}, disposeExhibit(model){metrics.disposed.push(model);},
  scene:{add(){metrics.added++;}}, exhibitModel:null, safeExperience(){},
  revealMuseum(){metrics.revealed++; return Promise.resolve();}
 };
 context.window = context;
 vm.createContext(context);
 vm.runInContext(classic, context, {timeout:1000});
 if (withModel) { context.museumLoading.engineReady(); vm.runInContext(`'use strict';\n${modelBlock}`,context,{timeout:1000}); }
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
 return {context, metrics, advance, element, get callbacks(){return callbacks;}};
}

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
 e.callbacks.onLoad({scene:lateModel});
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
 const e=environment(true); e.callbacks.onLoad({scene:{name:'on-time model'}}); e.advance(60001);
 assert.equal(e.context.museumLoadErrorKey,undefined,'Successful model load must cancel its deadline');
 assert.equal(e.metrics.prepared,1); assert.equal(e.metrics.added,1); assert.equal(e.metrics.revealed,1);
}

async function checkReveal(compileThrows) {
 const calls={compile:0,render:0,start:0,raf:0}, failure=new Error('Injected compile failure');
 const renderer={compile(){calls.compile++; if(compileThrows) throw failure;},
  get compileAsync(){assert.fail('revealMuseum must never access compileAsync');}};
 const context={Promise,renderer,scene:{},camera:{},experienceLoaded:Promise.resolve(),
  museumLoading:{wait:()=>Promise.resolve(),status(){},finish:()=>Promise.resolve(true)},
  requestAnimationFrame(fn){calls.raf++;fn();}, safeExperience(fn){fn({prepareIntro(){},startIntro(){calls.start++;}});},
  updateMistInstances(){},updateBlackHoleView(){},renderMuseum(){calls.render++;},animationClock:{getDelta(){}},
  previousFrameAt:0,previousRafAt:0,qualityWindowAt:0,resetViewBtn:{disabled:true}
 };
 context.window=context;vm.createContext(context);
 const result=vm.runInContext(`${reveal}\nrevealMuseum();`,context,{timeout:1000});
 if(compileThrows) {await assert.rejects(result,error=>error===failure);assert.equal(calls.render,0);assert.equal(calls.start,0);}
 else {await result;assert.equal(calls.render,1);assert.equal(calls.start,1);assert.equal(context.resetViewBtn.disabled,false);}
 assert.equal(calls.compile,1);assert.equal(calls.raf,2,'Preparation status needs two animation frames before GPU work');
}
(async()=>{
 await checkReveal(false);await checkReveal(true);
 console.log('Startup guards pass: engine/model deadlines, progress reset, late disposal, first-error retention, synchronous reveal (8 cases)');
})().catch(error=>{console.error(error);process.exitCode=1;});
