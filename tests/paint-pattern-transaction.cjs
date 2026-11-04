'use strict';
// Actual pattern transaction/job bodies; controlled pixels/Canvas/timers, no UI, GPU or raster claim.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const sourceFile=path.resolve(__dirname,'../enhancements/paint-studio.js'),source=fs.readFileSync(sourceFile,'utf8');
function body(name){
 const start=new RegExp('^ (?:async )?function '+name+'\\(','m').exec(source)?.index;assert(start!==undefined,name);
 const firstEnd=source.indexOf('\n',start),first=source.slice(start,firstEnd).trim();if(first.endsWith('}'))return first;
 const closing=/^ \}/m.exec(source.slice(firstEnd));assert(closing,name+' closing');return source.slice(start,firstEnd+closing.index+closing[0].length).trim();
}
const image=value=>({width:512,height:256,data:new Uint8ClampedArray(512*256*4).fill(value)});
const copy=pixels=>({...pixels,data:new Uint8ClampedArray(pixels.data)});
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
const digest=pixels=>crypto.createHash('sha256').update(pixels.data).digest('hex');
const checks=[];
(async()=>{
 const math=await import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync(path.join(__dirname,'../enhancements/paint-math.js'))).toString('base64'));
 function fixture(){
  let pixels=image(11),partialFailure=false,readFailure=false,prepared=null,loads=0,renderCalls=0,drafts=0,invalidations=0,glazeStops=0;
  const history=math.boundedHistory(12),future=math.boundedHistory(12);future.push(image(22));
  const nodes=new Map(),moduleWait=deferred(),canvasPreview={width:0,height:0,hidden:true,getContext:()=>({putImageData(value){prepared=copy(value);}})};
  const $=selector=>{if(!nodes.has(selector))nodes.set(selector,{disabled:false,value:'',setAttribute(){}});return nodes.get(selector);};
  for(const [key,value]of Object.entries({motif:'plum',stampSize:48,width:10,density:75,stampAngle:30}))$('[data-control="'+key+'"]').value=String(value);
  const context={Uint8ClampedArray,console:{warn(){}},active:true,suspended:false,restoring:false,contextUnavailable:false,stroke:null,surfacePointer:null,rotation:null,tool:'flower',compositionJob:null,
   compositionGroup:{open:true,setAttribute(){}},compositionCanvas:canvasPreview,compositionStatus:{textContent:'ready'},compositionLabels:{ready:'ready',loading:'loading',prepared:'count {count}',empty:'count 0',waveEmpty:'wave count 0',failed:'failed',applyFailed:'apply failed',applied:'applied'},
   compositionGenerate:{},compositionCancel:{},compositionApply:{},compositionMode:{value:'balanced'},compositionLayout:{value:'free'},compositionHeight:{value:'50'},compositionAmplitude:{value:'24'},compositionWaveControls:{hidden:true},$,history,future,textureDirty:false,saveToken:73,renderFailed:false,templateName:'plum',labels:{applied:'template applied',failed:'template failed'},t:{renderError:'render failed',painted:'painted'},
   ctx:{getImageData(){if(readFailure){readFailure=false;throw Error('read failure');}return copy(pixels);},putImageData(value){if(partialFailure){partialFailure=false;pixels.data[0]=99;throw Error('partial write failure');}pixels=copy(value);}},
   loadComposition(){loads++;return moduleWait.promise;},stopGlaze(){glazeStops++;},updateHistory(){},invalidatePoster(){invalidations++;},queueDraft(){drafts++;},scheduleRender(){renderCalls++;},setStatus(){},finishStroke(){},finishRotation(){},
   document:{createElement(){const canvas={width:0,height:0,getContext:()=>({getImageData:()=>image(77)})};return canvas;}},paintTemplate(){},
   root:{setAttribute(){},querySelectorAll:()=>[context.compositionGenerate,context.compositionCancel,context.compositionApply,context.compositionMode,context.compositionLayout,context.compositionHeight,context.compositionAmplitude]},
   canvas:{setAttribute(){}},angle:{},poster:{},posterJobToken:null,shapeUnavailable:false,updateSurfaceControls(){},updateGLBControls(){},
   cancelArtwork(){},flushDraft(){},renderTimer:null,clearTimeout(){},updateStampSample(){},currentAngle:0,vase:{rotation:{y:0}}};
  vm.createContext(context);
  for(const name of ['validPatternPixels','commitPatternPixels','updateCompositionControls','cancelComposition','currentCompositionJob','generateComposition','applyComposition','snapshot','travelHistory','applyTemplate','updatePosterControls','lockRestore','flushOnLeave','suspend','resume','setAngle']){
   let code=body(name);if(name==='generateComposition'){const specifier="import('./paint-composition.js')";assert.equal(code.split(specifier).length,2);code=code.replace(specifier,'loadComposition()');}vm.runInContext(code,context);
  }
  context.listen=(node,event,fn)=>{node[event]=fn;};
  vm.runInContext(source.split(/\r?\n/).find(line=>line.includes("listen(compositionMode,'change'")),context);
  vm.runInContext(source.split(/\r?\n/).find(line=>line.includes('for(const control of [compositionLayout,compositionHeight,compositionAmplitude])listen(')),context);
  const run=code=>vm.runInContext(code,context);
  const state=()=>({pixels:digest(pixels),history:history.size,future:future.size,drafts,invalidations,glazeStops,saveToken:context.saveToken});
  async function preview(value=33,count=6){const pending=run('generateComposition()');moduleWait.resolve({createComposition(base,settings){assert.equal(digest(base),digest(image(11)));assert(Math.abs(settings.width-1.8)<1e-12);assert.deepEqual(Object.keys(settings).sort(),['density','mode','motif','rotation','size','width']);return {pixels:image(value),count};}});await pending;return pending;}
  async function wavePreview(value=33,count=6){context.compositionLayout.value='wave';const pending=run('generateComposition()');moduleWait.resolve({createWaveComposition(base,settings){assert.equal(digest(base),digest(image(11)));assert.equal(settings.height,50);assert.equal(settings.amplitude,24);return {pixels:image(value),count};}});await pending;return pending;}
  return {context,run,state,history,future,moduleWait,preview,wavePreview,canvasPreview,$,get pixels(){return pixels;},get prepared(){return prepared;},get loads(){return loads;},failWrite(){partialFailure=true;},failRead(){readFailure=true;}};
 }
 async function test(name,fn){await fn(fixture());checks.push(name);}
 await test('preview-and-cancel-have-no-document-side-effects',async f=>{
  const before=f.state();await f.preview();assert.deepEqual(f.state(),before);assert.equal(f.canvasPreview.width,512);assert.equal(f.context.compositionApply.disabled,false);
  const job=f.context.compositionJob;assert.equal(job.base,null);f.run('cancelComposition()');assert.equal(job.base,null);assert.equal(job.result,null);assert.equal(f.canvasPreview.width,0);assert.equal(f.canvasPreview.height,0);assert.equal(f.context.compositionApply.disabled,true);assert.deepEqual(f.state(),before);
 });
 await test('apply-is-exactly-prepared-pixels-and-one-undo-redo',async f=>{
  await f.preview();const prepared=digest(f.prepared);f.run('applyComposition()');assert.equal(digest(f.pixels),prepared);assert.equal(f.history.size,1);assert.equal(f.future.size,0);assert.equal(f.state().drafts,1);assert.equal(f.state().invalidations,1);assert.equal(f.context.compositionJob,null);assert.equal(f.canvasPreview.width,0);
  f.run('travelHistory(history,future)');assert.equal(digest(f.pixels),digest(image(11)));f.run('travelHistory(future,history)');assert.equal(digest(f.pixels),prepared);assert.equal(f.loads,1);
 });
 await test('partial-write-rolls-back-pixels-redo-and-old-outputs',async f=>{
  await f.preview();const before=f.state(),prepared=f.context.compositionJob.result;f.failWrite();f.run('applyComposition()');assert.deepEqual(f.state(),before);assert.equal(digest(f.future.pop()),digest(image(22)));assert.equal(f.context.compositionJob.result,prepared);assert.equal(f.context.compositionStatus.textContent,'apply failed');
 });
 await test('read-or-validation-failure-does-not-register-history',async f=>{
  const before=f.state();f.failRead();assert.throws(()=>f.run('commitPatternPixels({width:512,height:256,data:new Uint8ClampedArray(512*256*4)})'),/read failure/);assert.deepEqual(f.state(),before);
  assert.throws(()=>f.run('commitPatternPixels({width:1,height:1,data:new Uint8ClampedArray(4)})'),/Invalid pattern pixels/);assert.deepEqual(f.state(),before);
 });
 await test('template-reuses-transaction-and-keeps-whole-image-replacement',async f=>{
  f.run('applyTemplate()');assert.equal(digest(f.pixels),digest(image(77)));assert.equal(f.history.size,1);assert.equal(f.future.size,0);f.run('travelHistory(history,future)');assert.equal(digest(f.pixels),digest(image(11)));
 });
 await test('template-write-failure-preserves-history-redo-and-output',async f=>{
  const before=f.state();f.failWrite();f.run('applyTemplate()');assert.deepEqual(f.state(),before);
 });
 await test('cancel-before-late-module-releases-base-with-no-generation',async f=>{
  const before=f.state(),pending=f.run('generateComposition()'),job=f.context.compositionJob;f.run('cancelComposition()');assert.equal(job.base,null);assert.equal(job.result,null);
  f.moduleWait.resolve({createComposition(){throw Error('Cancelled generator must not run');}});await pending;assert.equal(f.context.compositionJob,null);assert.deepEqual(f.state(),before);
 });
 await test('new-job-keeps-ownership-after-old-module-arrives',async f=>{
  const older=deferred(),newer=deferred();let loads=0;f.context.loadComposition=()=>++loads===1?older.promise:newer.promise;
  const old=f.run('generateComposition()'),oldJob=f.context.compositionJob,current=f.run('generateComposition()');assert.equal(oldJob.base,null);
  newer.resolve({createComposition:()=>({pixels:image(44),count:2})});await current;const currentJob=f.context.compositionJob;
  older.resolve({createComposition(){throw Error('Old generator must not run');}});await old;assert.equal(f.context.compositionJob,currentJob);assert.equal(digest(f.prepared),digest(image(44)));
 });
 await test('angle-observation-keeps-prepared-candidate',async f=>{
  await f.preview();const job=f.context.compositionJob,prepared=digest(job.result);f.run('setAngle(45)');assert.equal(f.context.compositionJob,job);assert.equal(digest(job.result),prepared);assert.equal(digest(f.pixels),digest(image(11)));
 });
 await test('closed-details-toggle-and-mode-change-cancel-preview',async f=>{
  await f.preview();const job=f.context.compositionJob;f.context.compositionGroup.open=false;f.context.compositionGroup.toggle();assert.equal(job.result,null);assert.equal(f.canvasPreview.width,0);
  f.context.compositionGroup.open=true;await f.preview();f.context.compositionMode.change();assert.equal(f.context.compositionJob,null);assert.equal(f.canvasPreview.width,0);
 });
 await test('rejected-import-after-close-does-not-write-failure-status',async f=>{
  const pending=f.run('generateComposition()');f.context.compositionGroup.open=false;f.moduleWait.reject(Error('late module failure'));await pending;assert.equal(f.context.compositionStatus.textContent,'ready');assert.equal(f.context.compositionJob,null);
 });
 for(const mutation of ['compositionGroup.open=false','tool="brush"','restoring=true','suspended=true','active=false'])await test('late-module-observes-'+mutation,async f=>{
  const before=f.state(),pending=f.run('generateComposition()'),job=f.context.compositionJob;f.run(mutation);f.moduleWait.resolve({createComposition(){throw Error('Stale generator must not run');}});await pending;
  assert.equal(f.context.compositionJob,null);assert.equal(job.base,null);assert.equal(f.canvasPreview.width,0);assert.deepEqual(f.state(),before);
 });
 for(const mutation of ['stroke={}','surfacePointer={}','rotation={}','restoring=true','suspended=true'])await test('busy-operations-ignore-generate-and-apply-'+mutation,async f=>{
  f.run(mutation);await f.run('generateComposition()');assert.equal(f.loads,0);assert.equal(f.context.compositionJob,null);f.context.compositionJob={base:null,result:image(33),count:3};const before=f.state();f.run('applyComposition()');assert.deepEqual(f.state(),before);
 });
 await test('restore-unlock-recomputes-empty-and-zero-count-controls',async f=>{
  f.run('lockRestore(true);lockRestore(false)');assert.equal(f.context.compositionApply.disabled,true);assert.equal(f.context.compositionCancel.disabled,true);
  await f.preview(11,0);assert.equal(f.context.compositionStatus.textContent,'count 0');f.run('lockRestore(true);lockRestore(false)');assert.equal(f.context.compositionApply.disabled,true);const before=f.state();f.run('applyComposition()');assert.deepEqual(f.state(),before);
 });
 await test('module-rejection-and-invalid-output-keep-document',async f=>{
  const before=f.state(),pending=f.run('generateComposition()');f.moduleWait.reject(Error('module unavailable'));await pending;assert.equal(f.context.compositionStatus.textContent,'failed');assert.equal(f.context.compositionJob,null);assert.deepEqual(f.state(),before);
  f.context.loadComposition=()=>Promise.resolve({createComposition:()=>({pixels:image(33),count:21})});await f.run('generateComposition()');assert.equal(f.context.compositionJob,null);assert.deepEqual(f.state(),before);
 });
 await test('suspend-and-leave-clear-candidates-without-document-change',async f=>{
  await f.preview();const job=f.context.compositionJob,before=f.state();f.run('suspend()');assert.equal(f.context.compositionJob,null);assert.equal(job.result,null);assert.equal(f.canvasPreview.width,0);assert.deepEqual(f.state(),{...before,glazeStops:before.glazeStops+1});f.run('resume()');assert.equal(f.context.compositionApply.disabled,true);
 });
 for(const [name,event,value] of [['compositionLayout','change','free'],['compositionHeight','input','60'],['compositionAmplitude','input','32']])await test('wave-preview-only-control-cancels-'+name,async f=>{
  await f.wavePreview();const before=f.state(),job=f.context.compositionJob;f.context[name].value=value;f.context[name][event]();assert.equal(job.result,null);assert.equal(f.context.compositionJob,null);assert.equal(f.canvasPreview.width,0);assert.equal(f.context.compositionApply.disabled,true);assert.deepEqual(f.state(),before);
 });
 await test('wave-uses-existing-exact-pixel-commit-one-undo-redo',async f=>{
  const before=f.state();await f.wavePreview();assert.deepEqual(f.state(),before);const prepared=digest(f.prepared);f.run('applyComposition()');assert.equal(digest(f.pixels),prepared);assert.equal(f.history.size,1);assert.equal(f.context.compositionJob,null);f.run('travelHistory(history,future)');assert.equal(digest(f.pixels),before.pixels);f.run('travelHistory(future,history)');assert.equal(digest(f.pixels),prepared);
 });
 await test('wave-zero-count-and-restore-unlock-recompute-hidden-controls',async f=>{
  await f.wavePreview(11,0);assert.equal(f.context.compositionStatus.textContent,'wave count 0');assert.equal(f.context.compositionApply.disabled,true);f.run('lockRestore(true);lockRestore(false)');assert.equal(f.context.compositionApply.disabled,true);assert.equal(f.context.compositionWaveControls.hidden,false);assert.equal(f.context.compositionHeight.disabled,false);const before=f.state();f.run('applyComposition()');assert.deepEqual(f.state(),before);f.context.compositionLayout.value='free';f.context.compositionLayout.change();assert.equal(f.context.compositionWaveControls.hidden,true);assert.equal(f.context.compositionHeight.disabled,true);assert.equal(f.context.compositionAmplitude.disabled,true);
 });
 await test('wave-parameter-cancels-delayed-module-without-document-change',async f=>{
  f.context.compositionLayout.value='wave';const before=f.state(),pending=f.run('generateComposition()'),job=f.context.compositionJob;f.context.compositionHeight.value='60';f.context.compositionHeight.input();f.moduleWait.resolve({createWaveComposition(){throw Error('Cancelled wave generator must not run');}});await pending;assert.equal(job.base,null);assert.equal(job.result,null);assert.equal(f.context.compositionJob,null);assert.equal(f.canvasPreview.width,0);assert.deepEqual(f.state(),before);
 });
 console.log(JSON.stringify({status:'passed',checks:checks.length,cases:checks,sourceSHA256:crypto.createHash('sha256').update(source).digest('hex'),scope:'Actual extracted product transaction/job/template/history/lock/suspend bodies. Only dynamic-import transport is replaced. Pixel buffers, Canvas methods, DOM and timers are controlled stubs. No browser, native raster, real generator, GPU, JSON/PNG/GLB or mobile-layout claim.'},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
