'use strict';
// Migrated same-world host: actual background budgets/observer, controlled core/DOM/encoder, real THREE cameras.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{pathToFileURL}=require('node:url');
const base=path.resolve(__dirname,'..'),file=path.join(base,'enhancements/starfield-experience.js'),source=fs.readFileSync(file,'utf8').replace('maxWidth:3840','maxWidth:64').replace('return {open,render,capture,close,dispose','return {get __captureJob(){return current?.captureJob},get __estimate(){return estimate},open,render,capture,close,dispose'),checks=[];
// Only the controlled CPU copy exposes read-only test getters; the product API is unchanged.

const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function near(actual,expected,label){assert(actual.distanceTo(expected)<1e-10,label);}
(async()=>{
 const THREE=await import(pathToFileURL(path.join(base,'vendor/three.module.js')));
 const fixture=options=>require('./starfield-host-fixture.cjs').fixture(THREE,source,options);
 async function test(name,fn){await fn();checks.push(name);}
 function setup(f){
  const core=f.cores.at(-1),targets=[],samples=[],faults={},gl={MAX_VIEWPORT_DIMS:1,FRAMEBUFFER:2,FRAMEBUFFER_COMPLETE:3,getParameter:()=>[8192,8192],isContextLost:()=>!!faults.lost,checkFramebufferStatus:()=>faults.incomplete?0:3};
  f.renderer.getContext=()=>gl;
  const setTarget=f.renderer.setRenderTarget,initialized=new WeakSet();
  f.renderer.setRenderTarget=function(target,face=0,mip=0){const result=setTarget.call(this,target,face,mip);if(target?.isWebGLRenderTarget&&target.texture.type===THREE.UnsignedByteType&&!initialized.has(target)){initialized.add(target);targets.push(target);target.disposals=0;target.addEventListener('dispose',()=>{target.disposals++;if(faults.dispose)throw Error('controlled RT disposal');});if(faults.init)throw Error('controlled RT init');}return result;};
  f.renderer.readRenderTargetPixels=(target,x,y,w,h,data)=>{if(faults.read)throw Error('controlled read');assert.equal(target.texture.type,THREE.UnsignedByteType);assert.equal(data.length,w*h*4);for(let row=0;row<h;row++)for(let col=0;col<w;col++){const at=(row*w+col)*4;data.set([row,col,17,255],at);}f.read={target,w,h};};
  core.captureSample=function(time,velocity,index,target){if(faults.sample===index)throw Error('controlled capture draw');assert.equal(index,samples.length%24);assert.equal(target.texture.type,THREE.UnsignedByteType);samples.push({time,index,velocity:velocity.toArray(),position:this.camera.position.toArray(),quaternion:this.camera.quaternion.toArray(),params:{...this.params},target});};
  return {core,targets,samples,faults};
 }
 const frames=(f,n)=>{for(let i=0;i<n;i++)f.api.render(.016);},tick=async()=>{for(let i=0;i<5;i++)await Promise.resolve();};
 const assertReleased=h=>{assert(h.targets.length);for(const t of h.targets)assert.equal(t.disposals,1);};
 await test('actual-r160-public-setRenderTarget-lazily-initializes-and-HD-needs-no-initRenderTarget-method',async()=>{
  const vendor=fs.readFileSync(path.join(base,'vendor/three.module.js'),'utf8');assert.equal(THREE.REVISION,'160');assert(!vendor.includes('this.initRenderTarget'));
  const start=vendor.indexOf('this.setRenderTarget = function ( renderTarget, activeCubeFace = 0, activeMipmapLevel = 0 )'),end=vendor.indexOf('this.readRenderTargetPixels = function',start);assert(start>=0&&end>start);
  const target=new THREE.WebGLRenderTarget(2,2,{type:THREE.UnsignedByteType,depthBuffer:false,stencilBuffer:false}),sentinel=Error('native setup reached'),seen=[];
  const native=vm.createContext({_currentRenderTarget:null,_currentActiveCubeFace:0,_currentActiveMipmapLevel:0,properties:{get:()=>({})},textures:{setupRenderTarget(value){seen.push(value);throw sentinel;}}});
  try{vm.runInContext(vendor.slice(start,end),native);assert.equal(native.initRenderTarget,undefined);assert.throws(()=>native.setRenderTarget(target,2,3),error=>error===sentinel);assert.deepEqual(seen,[target]);assert.equal(native._currentRenderTarget,target);assert.equal(native._currentActiveCubeFace,2);assert.equal(native._currentActiveMipmapLevel,3);}finally{target.dispose();}
  const f=fixture();try{await f.api.open();const h=setup(f),before=f.original();assert.equal(f.renderer.initRenderTarget,undefined);f.action('png').click();assert.equal(f.shell().dataset.captureStatus,'capturing','r160 must admit HD without an invented public initialization API');assert.equal(h.targets.length,1);frames(f,2);f.action('png').click();assert.equal(f.shell().dataset.captureStatus,'cancelled');assertReleased(h);assert.deepEqual(f.original(),before);}finally{f.api.close();f.restored();}
 });
 await test('24-existing-main-loop-steps-frozen-time-camera-velocity-params-and-one-sample-per-frame',async()=>{
  const f=fixture(),returns=[];await f.api.open({onReturn:r=>returns.push(r)});const h=setup(f),before=f.original(),capture=f.api.capture();assert.equal(capture.copy[0],f.canvas);const normalCalls=h.core.calls.length,backgroundTarget=h.core.calls.at(-1).destination,backgroundSize=[backgroundTarget.width,backgroundTarget.height];let backgroundDisposals=0;backgroundTarget.addEventListener('dispose',()=>backgroundDisposals++);
  f.action('png').click();assert.equal(f.shell().dataset.captureStatus,'capturing');assert.equal(f.orbits[0].enabled,false);assert.equal(f.action('return').disabled,false);assert.equal(f.action('png').disabled,false);assert.throws(()=>f.api.capture(),e=>e.code==='MUSEUM_STARFIELD_CAPTURE_BUSY');
  for(let i=0;i<24;i++){frames(f,1);assert.equal(h.samples.length,i+1);assert.equal(h.core.calls.length,normalCalls);assert.equal(f.api.frameState.capturing,true);assert.equal(f.canvas.parentNode,f.doc.body);assert.deepEqual([backgroundTarget.width,backgroundTarget.height],backgroundSize);assert.equal(backgroundDisposals,0);assert.notEqual(h.samples.at(-1).target,backgroundTarget);}
  const first=h.samples[0];for(const row of h.samples){assert.equal(row.time,first.time);assert.deepEqual(row.position,first.position);assert.deepEqual(row.quaternion,first.quaternion);assert.deepEqual(row.velocity,first.velocity);assert.deepEqual(row.params,first.params);}
  assert.equal(f.shell().dataset.captureStatus,'encoding');assert.deepEqual(h.core.sizes.at(-1),Array.from(f.background.size));assert.equal(backgroundDisposals,0);assert.equal(f.doc.encoders.length,1);assertReleased(h);assert.deepEqual(f.original(),before);frames(f,3);assert.equal(h.samples.length,24);assert.equal(h.core.calls.length,normalCalls);
  const image=f.doc.images.at(-1);assert.deepEqual(Array.from(image.rgba.slice(0,4)),[f.read.h-1,0,17,255]);assert.deepEqual(Array.from(image.rgba.slice(-4)),[0,f.read.w-1,17,255]);
  f.doc.encoders[0]({type:'image/png'});await tick();assert.equal(f.shell().dataset.captureStatus,'completed');assert.equal(f.urls.length,1);assert.equal(f.action('download').download,'qinghua-starfield-64x40.png');assert.equal(image.width,0);assert.equal(f.orbits[0].enabled,true);assert.equal(f.action('png').disabled,false);frames(f,1);assert.equal(h.core.calls.length,normalCalls+1);f.api.close();f.restored();assert.deepEqual(returns,['return']);assert.deepEqual(f.revoked,[f.urls[0]]);
 });
 await test('cancel-before-first-during-and-before-last-unlocks-resumes-and-keeps-synchronous-capture',async()=>{
  for(const count of [0,5,23]){const f=fixture();await f.api.open();const h=setup(f);f.action('png').click();frames(f,count);f.action('png').click();assert.equal(f.shell().dataset.captureStatus,'cancelled');assert(f.api.active);assertReleased(h);assert.equal(f.action('png').disabled,false);assert.equal(f.orbits[0].enabled,true);assert.equal(f.doc.encoders.length,0);assert.doesNotThrow(()=>f.api.capture());f.action('png').click();assert.equal(f.shell().dataset.captureStatus,'capturing');f.action('png').click();assertReleased(h);f.api.close();f.restored();}
 });
 await test('return-Escape-pagehide-contextlost-dispose-abort-with-original-DOM-focus-once',async()=>{
  for(const mode of ['return','Escape','pagehide','contextlost','dispose']){const f=fixture(),returns=[];await f.api.open({onReturn:r=>returns.push(r)});const h=setup(f);f.action('png').click();frames(f,4);if(mode==='return')f.action('return').click();else if(mode==='Escape'){const event=new Event('keydown',{cancelable:true});Object.defineProperty(event,'key',{value:'Escape'});f.doc.dispatchEvent(event);}else if(mode==='pagehide')f.win.dispatchEvent(new Event('pagehide'));else if(mode==='contextlost')f.canvas.dispatchEvent(new Event('webglcontextlost'));else f.api.dispose();assert(!f.api.active);f.restored();assertReleased(h);assert.equal(h.core.disposals,0);assert.equal(f.orbits[0].disposals,1);assert.equal(returns.length,1);assert.equal(f.urls.length,0);}
 });
 await test('resize-hidden-and-frozen-state-drift-cancel-without-extra-draw-or-feature-close',async()=>{
  for(const mode of ['resize','hidden','camera','params','timeSignature']){const f=fixture();await f.api.open();const h=setup(f);f.action('png').click();frames(f,3);if(mode==='resize')f.win.dispatchEvent(new Event('resize'));else if(mode==='hidden'){f.doc.hidden=true;f.doc.dispatchEvent(new Event('visibilitychange'));}else if(mode==='camera')h.core.camera.position.x+=1;else if(mode==='params')h.core.params.temp=4300;else f.canvas.width+=1;frames(f,1);assert(f.api.active);assert.equal(h.samples.length,3);assert.equal(f.shell().dataset.captureStatus,'cancelled');assertReleased(h);assert.equal(f.orbits[0].enabled,true);f.doc.hidden=false;assert.doesNotThrow(()=>f.api.capture());f.api.close();f.restored();}
 });
 await test('late-encoder-after-return-cannot-create-URL-or-open-overlay-and-budget-lock-clears-on-callback',async()=>{
  const f=fixture();await f.api.open();const h=setup(f);f.action('png').click();frames(f,24);const callback=f.doc.encoders[0];f.action('return').click();assert(!f.api.active);f.restored();assertReleased(h);assert.equal(f.urls.length,0);await f.api.open();assert(f.api.active);assert(f.action('png').disabled);callback({type:'image/png'});await tick();assert.equal(f.urls.length,0);assert.equal(f.action('png').disabled,false);f.api.close();f.restored();
 });
 await test('cancel-native-encoding-resumes-view-keeps-only-real-native-encoding-reservation',async()=>{
  const f=fixture();await f.api.open();const h=setup(f);f.action('png').click();frames(f,24);f.action('png').click();assert(f.api.active);assert.equal(f.shell().dataset.captureStatus,'cancelled');assert(f.action('png').disabled);const calls=h.core.calls.length;frames(f,1);assert.equal(h.core.calls.length,calls+1);f.doc.encoders[0]({type:'image/png'});await tick();assert.equal(f.urls.length,0);assert.equal(f.action('png').disabled,false);f.action('png').click();assert.equal(f.shell().dataset.captureStatus,'capturing');f.action('png').click();assertReleased(h);f.api.close();
 });
 await test('allocation-FBO-each-capture-step-readback-and-encoder-errors-release-and-retry',async()=>{
  for(const mode of ['init','incomplete','sample0','sample11','sample23','read','encoderNull','encoderThrow','imageContext']){const f=fixture();await f.api.open();const h=setup(f);if(mode==='init')h.faults.init=true;if(mode==='incomplete')h.faults.incomplete=true;if(mode.startsWith('sample'))h.faults.sample=Number(mode.slice(6));if(mode==='read')h.faults.read=true;f.action('png').click();let restoreCreate=null;if(mode==='encoderThrow'||mode==='imageContext'){const original=f.doc.createElement;restoreCreate=original;f.doc.createElement=tag=>{const node=original(tag);if(tag==='canvas'){if(mode==='encoderThrow')node.toBlob=()=>{throw Error('controlled encoder throw');};else node.getContext=()=>null;}return node;};}frames(f,24);if(mode==='encoderNull')f.doc.encoders[0](null);await tick();if(restoreCreate)f.doc.createElement=restoreCreate;assert(f.api.active,mode);assertReleased(h);assert.equal(f.orbits[0].enabled,true,mode);assert.equal(f.action('png').disabled,false,mode);assert.equal(f.shell().dataset.captureStatus,'error',mode);assert.equal(f.urls.length,0);assert.doesNotThrow(()=>f.api.capture());f.api.close();f.restored();}
 });
 await test('existing-successful-download-retained-on-next-encode-failure-and-revoked-on-next-success',async()=>{
  const f=fixture();await f.api.open();const h=setup(f);f.action('png').click();frames(f,24);f.doc.encoders[0]({});await tick();const first=f.action('download').href;f.action('png').click();frames(f,24);f.doc.encoders[1](null);await tick();assert.equal(f.action('download').href,first);assert.equal(f.revoked.length,0);f.action('png').click();frames(f,24);f.doc.encoders[2]({});await tick();assert.equal(f.urls.length,2);assert.deepEqual(f.revoked,[first]);assertReleased(h);f.api.close();assert.deepEqual(f.revoked,f.urls);f.restored();
 });
 await test('target-dispose-throw-still-restores-controls-image-arrays-and-DOM',async()=>{
  const f=fixture();await f.api.open();const h=setup(f);f.action('png').click();frames(f,2);h.faults.dispose=true;f.action('png').click();assert(f.api.active);assertReleased(h);assert.equal(f.action('png').disabled,false);assert.equal(f.orbits[0].enabled,true);assert(f.warnings.length);f.api.close();f.restored();
 });
 await test('invalid-export-limits-and-preview-fail-before-GPU-allocation-with-no-busy-lock',async()=>{
  for(const mode of ['limits','preview']){const f=fixture();await f.api.open();const h=setup(f);if(mode==='limits')f.renderer.getContext().getParameter=()=>[0,0];else{const create=f.doc.createElement;f.doc.createElement=tag=>{const node=create(tag);if(tag==='canvas')node.getContext=()=>null;return node;};}f.action('png').click();assert.equal(h.targets.length,0);assert.equal(h.samples.length,0);assert(f.api.active);assert.equal(f.orbits[0].enabled,true);assert.equal(f.action('png').disabled,false);assert(f.doc.images.every(i=>i.width===0&&i.height===0));f.api.close();f.restored();}
 });
 await test('URL-DOM-commit-failure-rolls-back-old-download-and-revokes-only-new-uncommitted-URL',async()=>{
  const f=fixture();await f.api.open();const h=setup(f);f.action('png').click();frames(f,24);f.doc.encoders[0]({});await tick();const link=f.action('download'),old=f.urls[0];let href=old,throws=true;Object.defineProperty(link,'href',{configurable:true,get:()=>href,set(value){if(throws&&value!==old){throws=false;throw Error('controlled URL link assignment');}href=value;}});f.action('png').click();frames(f,24);f.doc.encoders[1]({});await tick();assert.equal(href,old);assert.equal(f.urls.length,2);assert.deepEqual(f.revoked,[f.urls[1]]);assert.equal(f.action('png').disabled,false);assertReleased(h);f.api.close();assert.deepEqual(f.revoked,[f.urls[1],old]);f.restored();
 });
 await test('live-FBO-restore-failure-invalidates-size-and-next-normal-frame-retries-current-viewport',async()=>{
  const f=fixture();await f.api.open();const h=setup(f),resize=h.core.resize;f.action('png').click();frames(f,2);let fail=true;h.core.resize=function(w,height){if(fail&&w>64){fail=false;throw Error('controlled live restore');}return resize.call(this,w,height);};f.action('png').click();assert(f.api.active);assert.equal(f.orbits[0].enabled,true);assert.equal(f.action('png').disabled,false);assertReleased(h);frames(f,1);assert(f.api.active);assert(h.core.sizes.at(-1)[0]>64);assert(f.warnings.some(row=>row.some(v=>v.includes('controlled live restore'))));f.api.close();f.restored();
 });
 const results=[];
 async function check(name,fn){try{const data=await fn();results.push({name,passed:true,data});}catch(error){results.push({name,passed:false,error:String(error),stack:error.stack});}}
 await check('near-R8-CPU-array-and-GPU-texture-both-counted-in-every-budget-phase',async()=>{
  const f=fixture();try{await f.api.open();const value=f.api.__estimate(64,40,{liveWidth:1788,liveHeight:1118,farResidentBytes:12*2**20,previewWidth:2880,previewHeight:1800});
   const minimumConstant=2048*1024*8+2*(128**3)+12*2**20+2880*1800*4;
   const minimumAllocation=minimumConstant+value.liveCore.total+value.exportCore.total+value.outputRT;
   assert(value.phases.allocation>=minimumAllocation,'CPU Data3DTexture.image.data stays resident in addition to its native R8 texture: '+value.phases.allocation+' < '+minimumAllocation);
   return {actual:value.phases.allocation,minimum:minimumAllocation};
  }finally{f.api.close();f.restored();}
 });
 await check('previous-successful-owned-PNG-Blob-is-resident-during-second-export-allocation',async()=>{
  const f=fixture();try{await f.api.open();setup(f);f.action('png').click();const first=f.api.__captureJob.size;frames(f,24);f.doc.encoders[0]({type:'image/png',size:8192});await tick();assert.equal(f.urls.length,1);
   f.action('png').click();const next=f.api.__captureJob.size;assert.equal(next.width,first.width);assert.equal(next.height,first.height);
   assert(next.phases.allocation>=first.phases.allocation+8192,'Old owned download Blob remains alive until the replacement succeeds, but estimated allocation increased by '+(next.phases.allocation-first.phases.allocation));
   return {oldBlobBytes:8192,first:first.phases.allocation,second:next.phases.allocation};
  }finally{f.api.close();f.restored();}
 });
 await check('old-native-encoder-callback-does-not-enable-PNG-on-new-failed-startup-owner',async()=>{
  const f=fixture({secondCoreFailure:true});try{await f.api.open();setup(f);f.action('png').click();frames(f,24);const callback=f.doc.encoders[0];f.action('return').click();assert(!f.api.active);f.restored();
   assert(await f.api.open());assert.equal(f.shell().dataset.status,'error');assert(f.action('png').disabled);assert.equal(f.action('return').disabled,false);
   callback({type:'image/png',size:8192});await tick();assert.equal(f.shell().dataset.status,'error');assert(f.action('png').disabled,'Late encoder only releases its reservation; new failed owner must keep every non-Return control disabled');assert.equal(f.urls.length,0);
   return {status:f.shell().dataset.status,PNGDisabled:f.action('png').disabled};
  }finally{f.api.close();f.restored();}
 });

 await check('owned-Blob-and-near-CPU-residents-are-in-every-phase-and-invalid-byte-counts-reject',async()=>{const f=fixture();try{await f.api.open();const estimate=f.api.__estimate,options={liveWidth:1788,liveHeight:1118,farResidentBytes:12*2**20,previewWidth:2880,previewHeight:1800},zero=estimate(64,40,options),old=estimate(64,40,{...options,ownedBlobBytes:8192});assert.equal(zero.persistentCoreCPU,128**3);for(const phase of ['allocation','readback','restore'])assert.equal(old.phases[phase]-zero.phases[phase],8192);for(const bad of [-1,NaN,Infinity,.5])assert.throws(()=>estimate(64,40,{...options,ownedBlobBytes:bad}));return {persistentNearCPU:zero.persistentCoreCPU,ownedBlobEveryPhase:8192};}finally{f.api.close();}});
 await check('failed-replacement-keeps-old-byte-accounting-and-successful-replacement-updates-it',async()=>{const f=fixture();try{await f.api.open();setup(f);f.action('png').click();const initial=f.api.__captureJob.size;frames(f,24);f.doc.encoders[0]({type:'image/png',size:8192});await tick();f.action('png').click();assert.equal(f.api.__captureJob.size.phases.allocation-initial.phases.allocation,8192);frames(f,24);f.doc.encoders[1](null);await tick();f.action('png').click();assert.equal(f.api.__captureJob.size.phases.allocation-initial.phases.allocation,8192);frames(f,24);f.doc.encoders[2]({type:'image/png',size:4096});await tick();f.action('png').click();assert.equal(f.api.__captureJob.size.phases.allocation-initial.phases.allocation,4096);return {failedRetains:8192,replacementOwns:4096};}finally{f.api.close();}});
 await check('old-encoder-callback-cannot-revive-returned-owner-or-dispose-shared-background',async()=>{
  const f=fixture();try{await f.api.open();setup(f);const shared=f.cores[0],size=f.background.size.slice();f.action('png').click();frames(f,24);const callback=f.doc.encoders[0];f.action('return').click();assert(!f.api.active);await f.api.open();assert.equal(f.cores[0],shared);assert.equal(f.cores.length,1);f.action('return').click();assert(!f.api.active);assert.equal(f.shell(),undefined);callback({type:'image/png',size:8192});await tick();assert(!f.api.active);assert.equal(f.shell(),undefined);assert.equal(f.urls.length,0);assert.equal(shared.disposals,0);assert.deepEqual(f.background.size,size);f.restored();return{immediateRootHandoff:true,closedOwnerNotRevived:true,borrowedCoreDisposed:false};}finally{f.api.close();}
 });

 await test('HD-finish-and-cancel-start-a-new-visible-feedback-window-without-pre-capture-samples',async()=>{
  for(const mode of ['completed','cancelled']){
   const f=fixture({mobile:true});try{
    await f.api.open();const h=setup(f),initial=h.core.sizes.at(-1).slice(),initialScale=f.api.frameState.scale;
    f.api.render(.016);for(let i=0;i<3;i++)f.api.render(.2);
    assert.deepEqual(h.core.sizes.at(-1),initial);
    f.action('png').click();frames(f,mode==='completed'?24:5);
    if(mode==='completed'){f.doc.encoders[0]({type:'image/png',size:8192});await tick();}
    else f.action('png').click();
    assert.equal(f.shell().dataset.captureStatus,mode);
    f.api.render(.016);for(let i=0;i<4;i++)f.api.render(.2);
    assert.deepEqual(h.core.sizes.at(-1),initial,mode+': capture must separate visible feedback windows');
    f.api.render(.2);assert.equal(f.api.frameState.scale,initialScale*.9);assert(h.core.sizes.at(-1)[0]<=initial[0]);assert.equal(h.core.disposals,0);
    assertReleased(h);assert(f.api.capture());
   }finally{f.api.close();f.restored();}
  }
 });
 console.log(JSON.stringify({schema:1,status:results.every(r=>r.passed)?'passed-HD-host-CPU':'failed-HD-host-CPU',checks,regressions:results,caseCount:checks.length+results.length,replacedContracts:['Private core creation/disposal becomes a borrowed persistent core with zero context disposals.','Canvas relocation and modal Escape become canvas-in-body and document Escape.','Controller full-screen draws become root-owned background RT sampling; capture must stop that sampling.','Private exit easing becomes immediate onReturn; old encoder callbacks cannot revive the returned context.','DPR-sized adaptive targets become budgeted background targets; feedback timing is asserted through frameState.scale.'],fixtureTransport:{originalR40ControlledDOM:true,actualBackgroundModule:true,rootFramePump:true,admissionMaxWidthOnly:64,realTHREECameraAndUByteRT:true,coreMock:true,PNGEncoderMock:true,GPU:false},limits:['Host renderer/core/encoder are controlled CPU mocks. Actual core 24x15 graph, uniforms, FBO failure/state restoration are separately executed by tests/starfield-core.cjs.','No native PNG/raster/physical device or memory peak has been measured.']}));
 if(results.some(r=>!r.passed))process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1;});
