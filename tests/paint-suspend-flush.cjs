'use strict';
// Actual input/settlement/lifecycle bodies; drawing, ray hit, DOM and clocks are controlled.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const sourceFile=path.resolve(process.argv[2]||path.join(__dirname,'../enhancements/paint-studio.js')),source=fs.readFileSync(sourceFile,'utf8'),checks=[];
function body(name){
 const start=new RegExp('^ (?:async )?function '+name+'\\(','m').exec(source)?.index;assert(start!==undefined,'Actual '+name+' must exist');
 const end=source.indexOf('\n',start),first=source.slice(start,end).trim();if(first.endsWith('}'))return first;
 const close=/^ \}/m.exec(source.slice(end));assert(close,name+' closing');return source.slice(start,end+close.index+close[0].length).trim();
}
function fixture({tool='flower',natural=false,immediate=false,miss=false,hitFailure=false,finishFailure=false}={}){
 const timers=new Map(),frames=new Map(),events=[],stored=[],nodes=new Map(),history=[],future=[];let next=0,pixels=0;
 const node=()=>({value:'',setAttribute(){},setPointerCapture(){},releasePointerCapture(){events.push('release');},remove(){events.push('remove');}});
 const $=selector=>{if(!nodes.has(selector))nodes.set(selector,node());return nodes.get(selector);};
 for(const [name,value]of Object.entries({width:10,density:75,brushMirror:'none',motif:'flower',stampSize:48,stampAngle:0,stampRepeat:1}))$('[data-control="'+name+'"]').value=String(value);
 const canvas=node(),preview=node(),brush={begin(){events.push('natural begin');return true;},move(){events.push('natural move');return true;},render(){pixels++;return true;},finish(){if(finishFailure)throw Error('brush finish');pixels++;events.push('natural finish');return true;},dispose(){events.push('brush dispose');}};
 const c={$,active:true,suspended:false,restoring:false,tool,stroke:null,rotation:null,surfacePointer:null,surfaceSamples:[],surfaceRAF:null,inkRAF:null,inkDirty:false,
  renderTimer:null,lastRender:immediate?-Infinity:1000,renderFailed:false,contextUnavailable:false,shapeUnavailable:false,surfaceDisabled:false,
  draftTimer:null,draftDirty:false,draftProtected:false,glazeTimer:null,artworkJob:null,restoreTimer:null,restoreImage:null,canvas,preview,glaze:{},draftStatus:{},angle:{},poster:{},
  shapeOwner:null,geometry:{dispose(){}},material:{dispose(){}},texture:{dispose(){}},pedestalGeometry:{dispose(){}},pedestalMaterial:{dispose(){}},
  naturalBrush:null,brushFactory:natural?()=>brush:null,brushDisabled:false,textureDirty:false,stampSample:{width:192,height:192},stampSampleContext:{},rayHits:[],raycaster:{},rayPosition:{},
  t:{painted:'painted',renderError:'render error',draftSaved:'draft saved',draftFailed:'draft failed',shapePreserved:'protected'},files:{cancelled:'cancelled'},paintDraftKey:'draft',
  root:{dataset:{},setAttribute(){},querySelectorAll:()=>[c.glaze,c.poster],remove(){events.push('remove');}},lifetime:{abort(){events.push('abort');}},
  ctx:{getImageData(){return pixels;}},history:{push(value){history.push(value);},clear(){history.length=0;},get size(){return history.length;}},future:{clear(){future.length=0;},get size(){return future.length;}},
  performance:{now:()=>1000},setTimeout(fn,delay){const id=++next;timers.set(id,{fn,delay});return id;},clearTimeout(id){timers.delete(id);},
  requestAnimationFrame(fn){const id=++next;frames.set(id,fn);return id;},cancelAnimationFrame(id){frames.delete(id);},localStorage:{setItem(key,value){stored.push([key,value]);}},artworkRaw(){return String(pixels);},
  cancelAlignment(){},updateAlignmentControls(){},updateViewLightControls(){},cancelComposition(){events.push('cancel composition');},invalidatePoster(){events.push('invalidate poster');},invalidateArtwork(){events.push('invalidate artwork');},
  updateHistory(){},updateSurfaceControls(){},updateGLBControls(){},updateCompositionControls(){},updatePosterControls(){},updateStampSample(){events.push('stamp sample');},
  setStatus(){},stableGlaze(){},render(){c.renderTimer=null;c.lastRender=1000;events.push(c.suspended?'parked render':'visible render');},
  pickSurface(){if(hitFailure)throw Error('surface hit');return miss?null:{x:90,y:100};},unwrapCanvasX:x=>x,breakPaintSegment(){events.push('break');},
  stamp(){pixels++;events.push('stamp');},drawBrush(){pixels++;events.push('fallback brush');},
  console:{warn(){events.push('warning');}}
 };
 vm.createContext(c);
 for(const name of ['snapshot','queueDraft','flushDraft','scheduleRender','surfaceAvailable','beginPaint','movePaint','flushSurface','finishStroke','finishRotation','stopGlaze','flushOnLeave','suspend','resume','cancelArtwork','releaseArtworkJob','lockRestore','disableBrush','fallbackInk','flushInk','scheduleInk','dispose'])vm.runInContext(body(name),c);
 const run=code=>vm.runInContext(code,c);
 function queued(){c.surfacePointer={id:7,pen:false,event:{pointerId:7,pointerType:'touch'},screen:null};c.surfaceSamples=[{clientX:80,clientY:100}];c.surfaceRAF=++next;frames.set(c.surfaceRAF,()=>run('flushSurface()'));}
 function begin(source='surface'){c.point={x:70,y:100};c.event={pointerId:7,pointerType:'touch'};run('beginPaint(point,event,'+JSON.stringify(source)+')');}
 function parked(){assert.equal(c.suspended,true);assert.equal(c.stroke,null);assert.equal(c.surfacePointer,null);assert.equal(c.surfaceSamples.length,0);assert.equal(c.surfaceRAF,null);assert.equal(c.renderTimer,null);assert.equal(c.draftTimer,null);assert.equal(timers.size,0);assert.equal(frames.size,0);assert(!events.includes('parked render'));}
 return {c,run,queued,begin,parked,events,stored,history,timers,frames,get pixels(){return pixels;}};
}
function check(name,fn,options){fn(fixture(options));checks.push(name);}
for(const tool of ['flower','brush'])for(const natural of tool==='brush'?[false,true]:[false])for(const immediate of [false,true])check('queued-first-'+tool+'-natural-'+natural+'-immediate-'+immediate,f=>{
 f.queued();assert.equal(f.history.length,0);f.run('suspend()');f.parked();assert.equal(f.history.length,1,'The first queued surface sample must enter one history transaction');assert.equal(f.stored.length,1);assert(f.pixels>0);assert.equal(f.stored[0][1],String(f.pixels));
 const pixels=f.pixels,history=f.history.length,writes=f.stored.length;f.run('suspend();resume();suspend()');f.parked();assert.equal(f.pixels,pixels);assert.equal(f.history.length,history);assert.equal(f.stored.length,writes);
},{tool,natural,immediate});
for(const source of ['flat','surface'])for(const natural of [false,true])check('existing-'+source+'-brush-settles-once-natural-'+natural,f=>{
 f.begin(source);if(source==='surface')f.queued();f.run('suspend()');f.parked();assert.equal(f.history.length,1);assert.equal(f.stored.length,1);assert(f.pixels>0);assert.equal(f.stored[0][1],String(f.pixels));if(natural)assert.equal(f.events.filter(x=>x==='natural finish').length,1);
},{tool:'brush',natural});
check('missed-surface-sample-does-not-create-history-or-draft',f=>{f.queued();f.run('suspend()');f.parked();assert.equal(f.history.length,0);assert.equal(f.stored.length,0);assert.equal(f.pixels,0);},{miss:true});
check('hit-test-failure-retains-existing-fallback-and-cleans-queued-sample',f=>{f.queued();f.run('suspend()');f.parked();assert.equal(f.c.surfaceDisabled,true);assert.equal(f.history.length,0);assert.equal(f.stored.length,0);assert.equal(f.events.filter(x=>x==='warning').length,1);},{hitFailure:true});
check('natural-finish-failure-falls-back-and-flushes-same-transaction',f=>{f.queued();f.run('suspend()');f.parked();assert.equal(f.c.brushDisabled,true);assert.equal(f.c.root.dataset.brush,'classic');assert.equal(f.history.length,1);assert.equal(f.stored.length,1);assert(f.pixels>0);assert.equal(f.events.filter(x=>x==='warning').length,1);},{tool:'brush',natural:true,finishFailure:true});
check('artwork-cancellation-releases-lock-and-failed-candidate-cleanup-does-not-interrupt-suspend',f=>{
 let cancels=0,aborts=0;const image={onload(){},onerror(){},src:'pending'},canvas={width:512,height:256},job={timer:999,cancelled:false,cancel(){cancels++;},decodeAbort:{abort(){aborts++;}},image,canvas,owner:{dispose(){throw Error('candidate cleanup');}}};
 f.c.artworkJob=job;f.c.restoring=true;f.run('suspend()');f.parked();assert.equal(cancels,1);assert.equal(aborts,1);assert.equal(job.cancelled,true);assert.equal(f.c.artworkJob,null);assert.equal(f.c.restoring,false);assert.equal(image.src,'');assert.equal(canvas.width,0);assert.equal(canvas.height,0);assert.equal(f.events.filter(x=>x==='warning').length,1);assert.equal(f.history.length,0);assert.equal(f.stored.length,0);
});
check('dispose-shares-first-sample-settlement-and-destroys-only-after-flush',f=>{
 f.queued();f.run('dispose()');assert.equal(f.c.active,false);assert.equal(f.history.length,0);assert.equal(f.stored.length,1);assert(f.pixels>0);assert.equal(f.c.surfacePointer,null);assert.equal(f.c.surfaceRAF,null);assert.equal(f.timers.size,0);assert.equal(f.frames.size,0);assert.equal(f.events.filter(x=>x==='remove').length,1);assert(f.events.indexOf('stamp')<f.events.indexOf('abort'));f.run('dispose()');assert.equal(f.stored.length,1);
});
console.log(JSON.stringify({status:'passed',checks:checks.length,cases:checks,sourceFile,sourceSHA256:crypto.createHash('sha256').update(source).digest('hex'),scope:'Actual extracted input, history snapshot, draft queue/flush, scheduling, artwork-cancel/lock and suspend/resume/dispose bodies. Drawing, hit testing, DOM, storage and clocks are controlled. No native raster, real browser, GPU or physical-device timing claim.'},null,2));
