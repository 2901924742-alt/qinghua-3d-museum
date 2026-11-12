'use strict';
// CPU contract: real THREE cameras, borrowed background, controlled DOM and PNG transport.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
const base=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(base,'enhancements/starfield-experience.js'),'utf8'),checks=[];
const defaults={quality:'auto',checker:false,steps:1000,spin:.42,lensing:true,doppler:.75,followIsco:false,inner:1.55,outer:24,thick:0,temp:4200,bright:5,speed:10,hotSpot:false,hotR:4,jets:false,jetBright:1,stars:3,nebula:3,bloom:.34,bloomRadius:1,exposure:1.38,freeze:false,autoRotate:true,inset:false};
class Node extends EventTarget{
 constructor(tag,doc){super();Object.assign(this,{tagName:tag.toUpperCase(),doc,children:[],parentNode:null,attributes:new Map(),dataset:{},style:{},hidden:false,disabled:false,inert:false,value:'',textContent:'',isConnected:false,controls:[]});}
 get nextSibling(){return this.parentNode?.children[this.parentNode.children.indexOf(this)+1]||null;}
 setAttribute(name,value){this.attributes.set(name,String(value));if(name==='id')this.id=String(value);}
 getAttribute(name){return this.attributes.get(name)??null;}
 removeAttribute(name){this.attributes.delete(name);}
 appendChild(node){node.remove();this.children.push(node);node.parentNode=this;node.isConnected=this.isConnected;return node;}
 remove(){if(this.parentNode){const at=this.parentNode.children.indexOf(this);if(at>=0)this.parentNode.children.splice(at,1);}this.parentNode=null;this.isConnected=false;}
 focus(){this.doc.activeElement=this;}
 getClientRects(){return this.isConnected&&!this.hidden?[{}]:[];}
 matches(selector){return selector==='[data-param]'&&!!this.dataset.param;}
 closest(){return this.label||null;}
 click(){this.dispatchEvent(new Event('click'));}
 set innerHTML(html){
  this.html=html;this.controls=[];
  for(const match of html.matchAll(/<(button|select|input|a|details|p|summary|output|progress|span)\b([^>]*)>/g)){
   const node=new Node(match[1],this.doc),attrs=match[2];node.type=/type="([^"]+)"/.exec(attrs)?.[1]||'';
   for(const m of attrs.matchAll(/data-(action|param|testid)="([^"]+)"/g))node.dataset[m[1]]=m[2];
   node.disabled=/\bdisabled\b/.test(attrs);node.hidden=/\bhidden\b/.test(attrs);if(node.dataset.param){node.output={value:''};node.label={querySelector:()=>node.output};}
   this.controls.push(node);this.appendChild(node);
  }
  const advanced=this.controls.find(n=>n.tagName==='DETAILS');if(advanced)advanced.controls=this.controls.filter(n=>n.dataset.param);
 }
 querySelector(selector){if(selector==='details')return this.controls.find(n=>n.tagName==='DETAILS');const m=/\[data-(action|param|testid)=([^\]]+)\]/.exec(selector);return m?this.controls.find(n=>n.dataset[m[1]]===m[2]):null;}
 querySelectorAll(selector){if(selector==='[data-param]')return this.controls.filter(n=>n.dataset.param);return this.controls.filter(n=>['BUTTON','SELECT','INPUT'].includes(n.tagName));}
}
(async()=>{
 const THREE=await import(pathToFileURL(path.join(base,'vendor/three.module.js')));
 function fixture({reduced=false,pending=false,lang='zh'}={}){
  const document=Object.assign(new EventTarget(),{hidden:false,images:[],encoders:[],activeElement:null});document.body=new Node('body',document);document.body.isConnected=true;
  document.createElement=tag=>{const node=new Node(tag,document);if(tag==='canvas'){document.images.push(node);node.width=node.height=0;node.getContext=()=>({drawImage(...args){node.copy=args;},createImageData(w,h){return {data:new Uint8ClampedArray(w*h*4)};},putImageData(image){node.rgba=new Uint8ClampedArray(image.data);}});node.toBlob=callback=>document.encoders.push(callback);}return node;};
  const nav=new Node('nav',document),canvas=new Node('canvas',document),opener=new Node('button',document);canvas.width=320;canvas.height=200;canvas.setAttribute('style','width:320px;height:200px');canvas.setAttribute('tabindex','7');nav.setAttribute('aria-hidden','false');document.body.appendChild(nav);document.body.appendChild(canvas);document.body.appendChild(opener);opener.focus();
  const window=Object.assign(new EventTarget(),{devicePixelRatio:1}),warnings=[],urls=[],revoked=[],targets=[],orbits=[];
  const gl={lost:false,MAX_VIEWPORT_DIMS:1,FRAMEBUFFER:2,FRAMEBUFFER_COMPLETE:3,getParameter:()=>[8192,8192],isContextLost(){return this.lost;},checkFramebufferStatus:()=>3};
  const renderer={domElement:canvas,capabilities:{maxTextureSize:8192},autoClear:false,autoClearColor:false,autoClearDepth:true,autoClearStencil:false,localClippingEnabled:true,outputColorSpace:THREE.SRGBColorSpace,toneMapping:THREE.ACESFilmicToneMapping,toneMappingExposure:1,target:null,face:0,mip:0,viewport:new THREE.Vector4(0,0,320,200),scissor:new THREE.Vector4(0,0,320,200),test:false,color:new THREE.Color(.1,.2,.3),alpha:1,
   getContext:()=>gl,getSize:v=>v.set(320,200),getDrawingBufferSize:v=>v.set(320,200),getRenderTarget(){return this.target;},getActiveCubeFace(){return this.face;},getActiveMipmapLevel(){return this.mip;},setRenderTarget(target,face=0,mip=0){this.target=target;this.face=face;this.mip=mip;if(target?.isWebGLRenderTarget&&!targets.includes(target)){targets.push(target);target.disposals=0;target.addEventListener('dispose',()=>target.disposals++);}},getViewport(v){return v.copy(this.viewport);},setViewport(v){this.viewport.copy(v);},getScissor(v){return v.copy(this.scissor);},setScissor(v){this.scissor.copy(v);},getScissorTest(){return this.test;},setScissorTest(v){this.test=v;},getClearColor(v){return v.copy(this.color);},getClearAlpha(){return this.alpha;},setClearColor(c,a){this.color.copy(c);this.alpha=a;},setSize(){assert.fail('Shared canvas resized');},setPixelRatio(){assert.fail('Shared DPR changed');},readRenderTargetPixels(target,x,y,w,h,data){if(this.failRead)throw Error('Controlled read failure');for(let row=0;row<h;row++)for(let col=0;col<w;col++)data.set([row,col,17,255],(row*w+col)*4);}};
  const observer=new THREE.PerspectiveCamera(50,1.6,.01,200);observer.position.setFromSpherical(new THREE.Spherical(22,1.2,.6));observer.lookAt(0,0,0);const main=observer.clone(),initial=observer.position.clone();
  const core={params:{...defaults},disposals:0,resets:0,sizes:[],samples:[],sync(){if(this.failSync){this.failSync--;throw Error('Controlled synchronization failure');}assert(['auto',.5,.75,1].includes(this.params.quality));assert(this.params.inner<this.params.outer);},resetHistory(){this.resets++;},resize(w,h){assert(w>0&&h>0);this.sizes.push([w,h]);},render(){assert.fail('Controller must never draw the borrowed core to the museum canvas');},captureSample(time,velocity,index,target){this.samples.push({time,velocity:velocity.toArray(),index,position:observer.position.toArray(),params:{...this.params},target});},dispose(){this.disposals++;}};
  const background={core,observer,time:7,syncs:0,applies:0,get size(){return [320,200];},syncObserver(){this.syncs++;observer.position.copy(main.position);observer.quaternion.copy(main.quaternion);observer.fov=main.fov;},applyObserver(){this.applies++;main.position.copy(observer.position);main.quaternion.copy(observer.quaternion);main.fov=observer.fov;},update(){assert.fail('Root owns background sampling');},render(){assert.fail('Root owns background rendering');},dispose(){assert.fail('Controller must not dispose background');}};
  class Orbit extends THREE.EventDispatcher{constructor(camera,element){super();Object.assign(this,{camera,element,target:new THREE.Vector3(),enabled:true,disposals:0});orbits.push(this);}update(delta){if(this.autoRotate){const p=new THREE.Spherical().setFromVector3(this.camera.position);p.theta+=delta*.02;this.camera.position.setFromSpherical(p);}this.camera.lookAt(this.target);}dispose(){this.disposals++;}}
  let resolve;const orbit=pending?new Promise(done=>{resolve=()=>done({OrbitControls:Orbit});}):Promise.resolve({OrbitControls:Orbit});
  const code=source.replace('export function createStarfieldExperience','function createStarfieldExperience').replace('maxWidth:3840','maxWidth:64').replace("import('../vendor/controls/OrbitControls.js')",'__orbit');assert(!code.includes('import('));
  const context=vm.createContext({THREE,renderer,document,window,Event,AbortController,performance,Uint8Array,Uint8ClampedArray,matchMedia:()=>({matches:reduced}),console:{warn(...args){warnings.push(args);}},URL:{createObjectURL(){const url='blob:context-'+urls.length;urls.push(url);return url;},revokeObjectURL(url){revoked.push(url);}},__orbit:orbit,__background:background});
  vm.runInContext(code+'\nthis.api=createStarfieldExperience({THREE,renderer,getLanguage:()=>'+JSON.stringify(lang)+',isDesktop:()=>true,getBackground:()=>__background});',context);
  const api=context.api,shell=()=>document.body.children.find(n=>n.id==='museumStarfieldOverlay'),action=name=>shell().querySelector('[data-action='+name+']');
  const intact=()=>{assert.equal(canvas.parentNode,document.body);assert.equal(document.body.children.indexOf(canvas),1);assert.equal(canvas.nextSibling,opener);assert.equal(canvas.getAttribute('style'),'width:320px;height:200px');assert.equal(canvas.getAttribute('tabindex'),'7');assert.equal(nav.inert,false);assert.equal(nav.getAttribute('aria-hidden'),'false');assert.equal(opener.inert,false);};
  return {api,document,window,canvas,core,observer,main,initial,background,orbits,renderer,gl,targets,urls,revoked,warnings,shell,action,intact,resolve:()=>resolve()};
 }
 const frames=(f,n,delta=.1)=>{for(let i=0;i<n;i++)f.api.render(delta);},tick=async()=>{for(let i=0;i<5;i++)await Promise.resolve();};
 const input=(f,key,value)=>{const panel=f.shell().querySelector('details'),node=panel.querySelector('[data-param='+key+']');if(node.type==='checkbox')node.checked=value;else node.value=String(value);const event=new Event('input');Object.defineProperty(event,'target',{value:node});panel.dispatchEvent(event);};
 async function test(name,fn){await fn();checks.push(name);}
 await test('context-source-has-no-private-core-canvas-migration-modal-or-tab-trap',async()=>{
  for(const forbidden of ['createStarfieldCore','shell.prepend(canvas)','canvas.parentNode','aria-modal',"setAttribute('role','dialog')","event.key!=='Tab'"])assert(!source.includes(forbidden),forbidden);
  const css=fs.readFileSync(path.join(base,'enhancements/museum.css'),'utf8');assert(css.includes('.starfield-overlay.starfield-context'));assert(css.includes('max-height:min(74dvh,700px)'));assert(css.includes('body.museum-blackhole-view .hotspots'));
 });
 await test('loading-cancellation-does-not-touch-body-canvas-or-borrowed-core',async()=>{
  const f=fixture({pending:true}),returns=[],opening=f.api.open({onReturn:r=>returns.push(r)});assert(f.api.active);f.intact();assert.equal(f.shell().tagName,'ASIDE');assert.equal(f.shell().getAttribute('aria-modal'),null);f.action('return').click();assert(!f.api.active);f.resolve();assert.equal(await opening,false);assert.equal(f.orbits.length,0);assert.equal(f.core.disposals,0);assert.deepEqual(returns,['return']);f.intact();
 });
 await test('open-borrows-camera-and-core-and-preserves-arrived-pose-without-independent-intro',async()=>{
  const f=fixture();await f.api.open();assert.equal(f.background.syncs,1);assert.equal(f.orbits[0].camera,f.observer);assert(f.observer.position.distanceTo(f.initial)<1e-10);assert.equal(f.core.params.spin,.42);assert.equal(f.core.params.steps,1000);assert.equal(f.core.sizes.length,0);assert.equal(f.api.frameState.time,7);assert.equal(f.api.frameState.capturing,false);assert(f.shell().html.includes('黑洞观测'));assert(f.shell().html.includes('>观瓷<'));f.intact();f.api.render(.016);assert.equal(f.api.frameState.time,7.016);assert(f.background.applies>=2);assert(f.main.position.distanceTo(f.observer.position)<1e-10);f.api.close();assert.equal(f.core.disposals,0);assert.equal(f.orbits[0].disposals,1);assert.equal(f.api.frameState,null);f.intact();
 });
 await test('pause-manual-observation-parameters-quality-and-rollback-still-use-shared-state',async()=>{
  const f=fixture();await f.api.open();frames(f,2);f.action('pause').click();const time=f.api.frameState.time;f.observer.position.x+=.02;frames(f,1);assert.equal(f.api.frameState.time,time);assert.equal(f.core.params.freeze,true);assert(f.main.position.distanceTo(f.observer.position)<1e-10);input(f,'spin',.8);assert.equal(f.core.params.spin,.8);input(f,'inner',2.5);assert.equal(f.core.params.followIsco,false);const before={...f.core.params};f.core.failSync=1;input(f,'spin',.7);assert.deepEqual(f.core.params,before);f.action('quality').value='.75';f.action('quality').dispatchEvent(new Event('change'));assert.equal(f.core.params.quality,.75);assert.equal(f.core.sizes.length,0);f.action('pause').click();frames(f,1);assert(f.api.frameState.time>time);f.api.close();assert.equal(f.core.params.freeze,false);
 });
 await test('presets-and-plunge-drive-the-main-world-proxy-and-return-immediately-delegates',async()=>{
  const f=fixture(),returns=[];await f.api.open({onReturn:r=>returns.push(r)});f.action('view').value='2';f.action('view').dispatchEvent(new Event('change'));frames(f,30);assert(Math.abs(f.observer.position.length()-30)<1e-9);f.action('plunge').click();assert.equal(f.core.params.spin,0);assert.equal(f.orbits[0].enabled,false);frames(f,500);assert(Math.abs(f.observer.position.length()-1.04)<1e-9);assert(f.api.frameState.velocity.length()<1);assert(f.observer.fov>90);assert(f.main.position.distanceTo(f.observer.position)<1e-10);f.action('return').click();assert.equal(f.api.active,false);assert.deepEqual(returns,['return']);assert.equal(f.core.params.spin,.42);assert.equal(f.core.params.exposure,defaults.exposure);assert.equal(f.core.disposals,0);f.intact();
 });
 await test('PNG-keeps-24-frozen-samples-own-byte-target-and-restores-borrowed-live-size',async()=>{
  const f=fixture();await f.api.open();frames(f,2);const time=f.api.frameState.time;f.action('png').click();assert.equal(f.api.frameState.capturing,true);assert.deepEqual(f.core.sizes.at(-1),[64,40]);assert.equal(f.targets.length,1);assert.equal(f.targets[0].texture.type,THREE.UnsignedByteType);assert(f.document.body.children.some(n=>n.className==='starfield-capture-preview'));f.intact();assert.throws(()=>f.api.capture(),e=>e.code==='MUSEUM_STARFIELD_CAPTURE_BUSY');
  for(let i=0;i<24;i++){frames(f,1);assert.equal(f.core.samples.length,i+1);assert.equal(f.api.frameState.time,time);}
  const first=f.core.samples[0];for(const row of f.core.samples){assert.equal(row.time,first.time);assert.deepEqual(row.position,first.position);assert.deepEqual(row.velocity,first.velocity);assert.deepEqual(row.params,first.params);}assert.deepEqual(f.core.sizes.at(-1),[320,200]);assert.equal(f.targets[0].disposals,1);assert.equal(f.shell().dataset.captureStatus,'encoding');assert.equal(f.api.frameState.capturing,true);frames(f,2);assert.equal(f.core.samples.length,24);const image=f.document.images.at(-1);assert.deepEqual(Array.from(image.rgba.slice(0,4)),[39,0,17,255]);f.document.encoders[0]({size:64*40*4,type:'image/png'});await tick();assert.equal(f.api.frameState.capturing,false);assert.equal(f.shell().dataset.captureStatus,'completed');assert.equal(f.action('download').download,'qinghua-starfield-64x40.png');assert.equal(f.orbits[0].enabled,true);assert.equal(f.document.body.children.some(n=>n.className==='starfield-capture-preview'),false);f.api.close();assert.equal(f.core.disposals,0);assert.deepEqual(f.revoked,f.urls);f.intact();
 });
 await test('PNG-cancel-close-context-loss-and-read-failure-release-only-owned-resources',async()=>{
  for(const mode of ['cancel','return','contextlost','read']){
   const f=fixture(),returns=[];await f.api.open({onReturn:r=>returns.push(r)});f.action('png').click();frames(f,4);
   if(mode==='cancel'){f.action('png').click();assert(f.api.active);assert.equal(f.api.frameState.capturing,false);assert.deepEqual(f.core.sizes.at(-1),[320,200]);f.api.close();}
   else if(mode==='return')f.action('return').click();else if(mode==='contextlost'){f.gl.lost=true;f.canvas.dispatchEvent(new Event('webglcontextlost'));}else{f.renderer.failRead=true;frames(f,20);assert(f.api.active);assert.equal(f.shell().dataset.captureStatus,'error');f.api.close();}
   assert.equal(f.api.active,false);assert.equal(f.core.disposals,0);assert.equal(f.targets[0].disposals,1);assert.equal(f.orbits[0].disposals,1);assert.equal(returns.length,1);f.intact();
  }
 });
 await test('Escape-works-from-shared-canvas-without-trapping-Tab-and-errors-keep-return',async()=>{
  const f=fixture();await f.api.open();const tab=new Event('keydown',{cancelable:true});Object.defineProperty(tab,'key',{value:'Tab'});f.document.dispatchEvent(tab);assert.equal(tab.defaultPrevented,false);f.canvas.focus();const escape=new Event('keydown',{cancelable:true});Object.defineProperty(escape,'key',{value:'Escape'});f.document.dispatchEvent(escape);assert.equal(f.api.active,false);f.intact();
  const g=fixture();g.core.failSync=1;await g.api.open();assert.equal(g.shell().dataset.status,'error');assert.equal(g.action('return').disabled,false);assert.equal(g.core.disposals,0);g.action('return').click();assert.equal(g.api.active,false);g.intact();
 });
 console.log(JSON.stringify({ok:true,checks},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
