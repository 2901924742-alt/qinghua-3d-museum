'use strict';
// Actual host with controlled DOM/import transport and core; real THREE cameras and original path mathematics.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{pathToFileURL}=require('node:url');
const base=path.resolve(__dirname,'..'),file=path.join(base,'enhancements/starfield-experience.js'),source=fs.readFileSync(file,'utf8').replace('maxWidth:3840','maxWidth:64').replace('return {open,render,capture,close,dispose','return {get __captureJob(){return current?.captureJob},get __estimate(){return estimate},open,render,capture,close,dispose'),checks=[];
// Only the controlled CPU copy exposes read-only test getters; the product API is unchanged.

const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const defaults={quality:'auto',checker:false,steps:1000,spin:0,lensing:true,doppler:.75,followIsco:false,inner:1.55,outer:24,thick:0,temp:4200,bright:5,speed:10,hotSpot:false,hotR:4,jets:false,jetBright:1,stars:3,nebula:3,bloom:.34,bloomRadius:1,exposure:1.38,freeze:false,autoRotate:true,inset:false};
class Pointer extends Event {constructor(type,values={}){super(type,values);for(const [key,value] of Object.entries(values))if(!['bubbles','cancelable','composed'].includes(key))this[key]=value;}}
class Node extends EventTarget {
 constructor(tag,doc){super();this.tagName=tag.toUpperCase();this.doc=doc;this.children=[];this.parentNode=null;this.attributes=new Map();this.dataset={};this.style={};this.hidden=false;this.disabled=false;this.inert=false;this.value='';this.textContent='';this.isConnected=false;this.controls=[];}
 get nextSibling(){return this.parentNode?.children[this.parentNode.children.indexOf(this)+1]||null;}
 setAttribute(name,value){this.attributes.set(name,String(value));if(name==='id')this.id=String(value);if(name==='disabled')this.disabled=true;if(name==='hidden')this.hidden=true;}
 getAttribute(name){return this.attributes.get(name)??null;}
 removeAttribute(name){this.attributes.delete(name);if(name==='disabled')this.disabled=false;}
 appendChild(node){node.remove();this.children.push(node);node.parentNode=this;node.isConnected=this.isConnected;return node;}
 prepend(node){node.remove();this.children.unshift(node);node.parentNode=this;node.isConnected=this.isConnected;}
 insertBefore(node,next){node.remove();const i=this.children.indexOf(next);assert(i>=0);this.children.splice(i,0,node);node.parentNode=this;node.isConnected=this.isConnected;}
 remove(){if(this.parentNode){const i=this.parentNode.children.indexOf(this);if(i>=0)this.parentNode.children.splice(i,1);}this.parentNode=null;this.isConnected=false;}
 contains(node){return node===this||this.children.some(child=>child.contains(node));}
 focus(){this.doc.activeElement=this;}
 getClientRects(){return this.isConnected&&!this.hidden?[{}]:[];}
 matches(selector){return selector==='[data-param]'&&!!this.dataset.param;}
 closest(){return this.label||null;}
 click(){this.dispatchEvent(new Event('click'));}
 set innerHTML(html){
  this.html=html;this.controls=[];
  // These controlled controls stand in for the host's real HTML, without raster or browser layout claims.
  for(const match of html.matchAll(/<(button|select|input|a|details|p|summary)\b([^>]*)>/g)){
   const node=new Node(match[1],this.doc),attrs=match[2];node.type=/type="([^"]+)"/.exec(attrs)?.[1]||'';
   for(const m of attrs.matchAll(/(data-(?:action|param|testid))="([^"]+)"/g))node.dataset[{action:'action',param:'param',testid:'testid'}[m[1].slice(5)]]=m[2];
   node.disabled=/\bdisabled\b/.test(attrs);node.hidden=/\bhidden\b/.test(attrs);if(node.dataset.param){node.label={querySelector:()=>node.output};node.output={value:''};}
   this.controls.push(node);this.appendChild(node);
  }
  const advanced=this.controls.find(n=>n.tagName==='DETAILS');if(advanced)advanced.controls=this.controls.filter(n=>n.dataset.param);
 }
 querySelector(selector){
  if(selector==='details')return this.controls.find(n=>n.tagName==='DETAILS');
  const m=/\[data-(action|param|testid)=([^\]]+)\]/.exec(selector);if(m)return this.controls.find(n=>n.dataset[m[1]]===m[2]);return null;
 }
 querySelectorAll(selector){if(selector==='[data-param]')return this.controls.filter(n=>n.dataset.param);return [this.doc.canvas,...this.controls].filter(n=>!n.disabled&&!n.hidden);}
}
function near(actual,expected,label){assert(actual.distanceTo(expected)<1e-10,label);}
(async()=>{
 const THREE=await import(pathToFileURL(path.join(base,'vendor/three.module.js')));
 function fixture({mobile=false,apple=false,reduced=false,lang='zh',pending=false,coreFailure=false,secondCoreFailure=false,renderFailure=false,cleanupFailure=false}={}){
  const doc={activeElement:null,hidden:false,images:[],encoders:[]};doc.body=new Node('body',doc);doc.body.isConnected=true;
  doc.addEventListener=EventTarget.prototype.addEventListener.bind(doc.events=new EventTarget());doc.removeEventListener=doc.events.removeEventListener.bind(doc.events);doc.dispatchEvent=doc.events.dispatchEvent.bind(doc.events);
  doc.createElement=tag=>{const node=new Node(tag,doc);if(tag==='canvas'){doc.images.push(node);node.width=node.height=0;node.getContext=kind=>{assert.equal(kind,'2d');return {drawImage(...args){node.copy=args;},createImageData(w,h){return {data:new Uint8ClampedArray(w*h*4)};},putImageData(image){node.rgba=new Uint8ClampedArray(image.data);}};};node.toBlob=fn=>doc.encoders.push(fn);}return node;};
  const before=new Node('nav',doc),canvas=new Node('canvas',doc),after=new Node('aside',doc);doc.canvas=canvas;canvas.width=mobile?780:2880;canvas.height=mobile?1688:1800;
  canvas.setAttribute('style','width:1440px;height:900px;touch-action:pan-y');canvas.setAttribute('tabindex','7');canvas.setAttribute('aria-label','Original museum');before.inert=true;before.setAttribute('aria-hidden','false');doc.body.appendChild(before);doc.body.appendChild(canvas);doc.body.appendChild(after);after.focus();
  const captures=new Set(),cancelled=[];canvas.hasPointerCapture=id=>captures.has(id);canvas.releasePointerCapture=id=>captures.delete(id);canvas.addEventListener('pointercancel',event=>cancelled.push(event.pointerId));
  const win=Object.assign(new EventTarget(),{devicePixelRatio:2}),warnings=[],cores=[],orbits=[],urls=[],revoked=[];let resolves;
  const renderer={domElement:canvas,autoClear:false,autoClearColor:false,autoClearDepth:true,autoClearStencil:false,localClippingEnabled:true,outputColorSpace:THREE.SRGBColorSpace,toneMapping:THREE.ACESFilmicToneMapping,toneMappingExposure:1,
   target:{museum:true,viewport:[5,6,300,200]},face:2,mip:3,physical:[5,6,300,200],viewport:new THREE.Vector4(1,2,1440,900),scissor:new THREE.Vector4(3,4,700,500),test:true,color:new THREE.Color(.1,.2,.3),alpha:.7,
   getSize(v){return v.set(mobile?390:1440,mobile?844:900);},capabilities:{maxTextureSize:8192},getContext(){return {MAX_VIEWPORT_DIMS:1,getParameter:()=>[8192,8192],isContextLost:()=>false};},getDrawingBufferSize(v){return v.set(canvas.width,canvas.height);},getRenderTarget(){return this.target;},getActiveCubeFace(){return this.face;},getActiveMipmapLevel(){return this.mip;},setRenderTarget(v,face=0,mip=0){this.target=v;this.face=face;this.mip=mip;this.physical=v?(v.viewport.toArray?v.viewport.toArray():v.viewport.slice()):this.viewport.toArray().map(x=>x*2);},getViewport(v){return v.copy(this.viewport);},setViewport(v){this.viewport.copy(v);this.physical=v.toArray().map(x=>x*2);},getScissor(v){return v.copy(this.scissor);},setScissor(v){this.scissor.copy(v);},getScissorTest(){return this.test;},setScissorTest(v){this.test=v;},getClearColor(v){return v.copy(this.color);},getClearAlpha(){return this.alpha;},setClearColor(v,a){this.color.copy(v);this.alpha=a;},setSize(){throw Error('Host must not resize shared renderer');},setPixelRatio(){throw Error('Host must not change shared DPR');}};
  class Orbit extends THREE.EventDispatcher {
   constructor(camera,target){super();this.camera=camera;this.domElement=target;this.target=new THREE.Vector3();this.disposals=0;this.enabled=true;orbits.push(this);}
   update(delta){if(this.autoRotate){const p=new THREE.Spherical().setFromVector3(this.camera.position);p.theta+=delta*.02;this.camera.position.setFromSpherical(p);}this.camera.lookAt(this.target);}
   dispose(){this.disposals++;if(cleanupFailure)throw Error('Controlled Orbit disposal failure');}
  }
  const createStarfieldCore=({camera,isMobile})=>{
   if(coreFailure||secondCoreFailure&&cores.length)throw Object.assign(Error('Controlled unsupported core'),{code:'MUSEUM_STARFIELD_UNSUPPORTED'});
   const core={camera,nebulaMobile:isMobile,params:{...defaults,checker:isMobile},calls:[],sizes:[],disposals:0,resets:0,sync(){if(this.failSync){this.failSync--;throw Error('Controlled setting synchronization failure');}assert(this.params.exposure>=.2);assert(this.params.inner<this.params.outer);assert(['auto',.5,.75,1].includes(this.params.quality));if(this.params.followIsco)this.params.inner=this.params.spin===.9?1.1604415208809435:3;},resize(w,h){assert(Number.isInteger(w)&&Number.isInteger(h)&&w>0&&h>0);this.sizes.push([w,h]);},resetHistory(){this.resets++;},render(time,velocity,destination,frameDelta){assert.equal(destination,null);assert(Number.isFinite(frameDelta)&&frameDelta>=0);this.calls.push({time,frameDelta,position:camera.position.clone(),fov:camera.fov,velocity:velocity.clone()});renderer.target=null;renderer.viewport.set(9,8,7,6);renderer.scissor.set(6,7,8,9);renderer.test=false;renderer.color.set(0);renderer.alpha=0;renderer.autoClear=true;renderer.localClippingEnabled=false;renderer.toneMappingExposure=9;if(renderFailure)throw Error('Controlled render failure');},dispose(){this.disposals++;if(cleanupFailure)throw Error('Controlled core disposal failure');}};cores.push(core);return core;
  };
  const modules=[{createStarfieldCore},{OrbitControls:Orbit}],transport=pending?new Promise(resolve=>{resolves=()=>resolve(modules);}):Promise.resolve(modules);
  const code=source.replace('export function createStarfieldExperience','function createStarfieldExperience').replace("Promise.all([import('./starfield-core.js'),import('../vendor/controls/OrbitControls.js')])",'__modules');assert(!code.includes("import("));
  const c=vm.createContext({THREE,renderer,document:doc,window:win,AbortController,Event,performance,Uint8Array,Uint8ClampedArray,PointerEvent:Pointer,matchMedia:()=>({matches:reduced}),navigator:{platform:apple?'MacIntel':'Win32',userAgent:apple?'Mac OS X':'Windows'},console:{warn(...values){warnings.push(values.map(String));}},URL:{createObjectURL(){const url='blob:starfield-'+urls.length;urls.push(url);return url;},revokeObjectURL(url){revoked.push(url);}},__modules:transport});
  vm.runInContext(code+'\nthis.api=createStarfieldExperience({THREE,renderer,getLanguage:()=>'+JSON.stringify(lang)+',isDesktop:()=>'+(!mobile)+'});',c);
  const original=()=>({target:renderer.target,face:renderer.face,mip:renderer.mip,physical:renderer.physical.slice(),viewport:renderer.viewport.toArray(),scissor:renderer.scissor.toArray(),test:renderer.test,color:renderer.color.toArray(),alpha:renderer.alpha,auto:renderer.autoClear,clipping:renderer.localClippingEnabled,exposure:renderer.toneMappingExposure,width:canvas.width,height:canvas.height});
  const shell=()=>doc.body.children.find(n=>n.id==='museumStarfieldOverlay');const action=name=>shell().querySelector('[data-action='+name+']');
  const restored=()=>{assert.deepEqual(doc.body.children,[before,canvas,after]);assert.equal(canvas.nextSibling,after);assert.equal(canvas.getAttribute('style'),'width:1440px;height:900px;touch-action:pan-y');assert.equal(canvas.getAttribute('tabindex'),'7');assert.equal(canvas.getAttribute('aria-label'),'Original museum');assert.equal(before.inert,true);assert.equal(before.getAttribute('aria-hidden'),'false');assert.equal(after.inert,false);assert.equal(after.getAttribute('aria-hidden'),null);assert.equal(doc.activeElement,after);};
  return {api:c.api,doc,win,canvas,cores,orbits,renderer,warnings,urls,revoked,resolve:()=>resolves(),shell,action,restored,original,captures,cancelled};
 }
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
  const f=fixture(),returns=[];await f.api.open({onReturn:r=>returns.push(r)});const h=setup(f),before=f.original(),capture=f.api.capture();assert.equal(capture.copy[0],f.canvas);const normalCalls=h.core.calls.length;
  f.action('png').click();assert.equal(f.shell().dataset.captureStatus,'capturing');assert.equal(f.orbits[0].enabled,false);assert.equal(f.action('return').disabled,false);assert.equal(f.action('png').disabled,false);assert.throws(()=>f.api.capture(),e=>e.code==='MUSEUM_STARFIELD_CAPTURE_BUSY');
  for(let i=0;i<24;i++){frames(f,1);assert.equal(h.samples.length,i+1);assert.equal(h.core.calls.length,normalCalls+1);}
  const first=h.samples[0];for(const row of h.samples){assert.equal(row.time,first.time);assert.deepEqual(row.position,first.position);assert.deepEqual(row.quaternion,first.quaternion);assert.deepEqual(row.velocity,first.velocity);assert.deepEqual(row.params,first.params);}
  assert.equal(f.shell().dataset.captureStatus,'encoding');assert.equal(f.doc.encoders.length,1);assertReleased(h);assert.deepEqual(f.original(),before);frames(f,3);assert.equal(h.samples.length,24);assert.equal(h.core.calls.length,normalCalls+1);
  const image=f.doc.images.at(-1);assert.deepEqual(Array.from(image.rgba.slice(0,4)),[f.read.h-1,0,17,255]);assert.deepEqual(Array.from(image.rgba.slice(-4)),[0,f.read.w-1,17,255]);
  f.doc.encoders[0]({type:'image/png'});await tick();assert.equal(f.shell().dataset.captureStatus,'completed');assert.equal(f.urls.length,1);assert.equal(f.action('download').download,'qinghua-starfield-64x40.png');assert.equal(image.width,0);assert.equal(f.orbits[0].enabled,true);assert.equal(f.action('png').disabled,false);frames(f,1);assert.equal(h.core.calls.length,normalCalls+2);f.api.close();f.restored();assert.deepEqual(returns,['return']);assert.deepEqual(f.revoked,[f.urls[0]]);
 });
 await test('cancel-before-first-during-and-before-last-unlocks-resumes-and-keeps-synchronous-capture',async()=>{
  for(const count of [0,5,23]){const f=fixture();await f.api.open();const h=setup(f);f.action('png').click();frames(f,count);f.action('png').click();assert.equal(f.shell().dataset.captureStatus,'cancelled');assert(f.api.active);assertReleased(h);assert.equal(f.action('png').disabled,false);assert.equal(f.orbits[0].enabled,true);assert.equal(f.doc.encoders.length,0);assert.doesNotThrow(()=>f.api.capture());f.action('png').click();assert.equal(f.shell().dataset.captureStatus,'capturing');f.action('png').click();assertReleased(h);f.api.close();f.restored();}
 });
 await test('return-Escape-pagehide-contextlost-dispose-abort-with-original-DOM-focus-once',async()=>{
  for(const mode of ['return','Escape','pagehide','contextlost','dispose']){const f=fixture(),returns=[];await f.api.open({onReturn:r=>returns.push(r)});const h=setup(f);f.action('png').click();frames(f,4);if(mode==='return')f.action('return').click();else if(mode==='Escape'){const event=new Event('keydown',{cancelable:true});Object.defineProperty(event,'key',{value:'Escape'});f.shell().dispatchEvent(event);}else if(mode==='pagehide')f.win.dispatchEvent(new Event('pagehide'));else if(mode==='contextlost')f.canvas.dispatchEvent(new Event('webglcontextlost'));else f.api.dispose();assert(!f.api.active);f.restored();assertReleased(h);assert.equal(h.core.disposals,1);assert.equal(f.orbits[0].disposals,1);assert.equal(returns.length,1);assert.equal(f.urls.length,0);}
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
 await check('old-encoder-callback-does-not-enable-PNG-on-new-exiting-owner',async()=>{const f=fixture();try{await f.api.open();setup(f);f.action('png').click();frames(f,24);const callback=f.doc.encoders[0];f.action('return').click();await f.api.open();f.action('return').click();assert(f.api.active);assert(f.action('png').disabled);callback({type:'image/png',size:8192});await tick();assert(f.api.active);assert(f.action('png').disabled);assert.equal(f.action('return').disabled,false);return{newOwnerExitingPNGDisabled:true};}finally{f.api.close();}});

 await test('HD-finish-and-cancel-start-a-new-visible-feedback-window-without-pre-capture-samples',async()=>{
  for(const mode of ['completed','cancelled']){
   const f=fixture({mobile:true});try{
    await f.api.open();const h=setup(f),initial=h.core.sizes.at(-1).slice();
    f.api.render(.016);for(let i=0;i<3;i++)f.api.render(.2);
    assert.deepEqual(h.core.sizes.at(-1),initial);
    f.action('png').click();frames(f,mode==='completed'?24:5);
    if(mode==='completed'){f.doc.encoders[0]({type:'image/png',size:8192});await tick();}
    else f.action('png').click();
    assert.equal(f.shell().dataset.captureStatus,mode);
    f.api.render(.016);for(let i=0;i<4;i++)f.api.render(.2);
    assert.deepEqual(h.core.sizes.at(-1),initial,mode+': capture must separate visible feedback windows');
    f.api.render(.2);assert.deepEqual(h.core.sizes.at(-1),[526,1139]);
    assertReleased(h);assert(f.api.capture());
   }finally{f.api.close();f.restored();}
  }
 });
 console.log(JSON.stringify({schema:1,status:results.every(r=>r.passed)?'passed-HD-host-CPU':'failed-HD-host-CPU',checks,regressions:results,caseCount:checks.length+results.length,fixtureTransport:{originalR40ControlledDOM:true,admissionMaxWidthOnly:64,realTHREECameraAndUByteRT:true,coreMock:true,PNGEncoderMock:true,GPU:false},limits:['Host renderer/core/encoder are controlled CPU mocks. Actual core 24x15 graph, uniforms, FBO failure/state restoration are separately executed by tests/starfield-core.cjs.','No native PNG/raster/physical device or memory peak has been measured.']}));
 if(results.some(r=>!r.passed))process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1;});
