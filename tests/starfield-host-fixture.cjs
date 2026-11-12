'use strict';
// Shared CPU harness for migrated host tests. Actual background/observer/budget code; mocked GPU core and DOM.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
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
  for(const match of html.matchAll(/<(button|select|input|a|details|p|summary|output|progress|span)\b([^>]*)>/g)){
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
 querySelectorAll(selector){if(selector==='[data-param]')return this.controls.filter(n=>n.dataset.param);return this.controls.filter(n=>['BUTTON','SELECT','INPUT'].includes(n.tagName));}
}
function fixture(THREE,source,{mobile=false,apple=false,reduced=false,lang='zh',pending=false,coreFailure=false,secondCoreFailure=false,renderFailure=false,cleanupFailure=false,orbitClass=null}={}){
  const doc={activeElement:null,hidden:false,images:[],encoders:[]};doc.body=new Node('body',doc);doc.body.isConnected=true;
  doc.addEventListener=EventTarget.prototype.addEventListener.bind(doc.events=new EventTarget());doc.removeEventListener=doc.events.removeEventListener.bind(doc.events);doc.dispatchEvent=doc.events.dispatchEvent.bind(doc.events);
  doc.createElement=tag=>{const node=new Node(tag,doc);if(tag==='canvas'){doc.images.push(node);node.width=node.height=0;node.getContext=kind=>{assert.equal(kind,'2d');return {drawImage(...args){node.copy=args;},createImageData(w,h){return{data:new Uint8ClampedArray(w*h*4)};},putImageData(image){node.rgba=new Uint8ClampedArray(image.data);}};};node.toBlob=fn=>doc.encoders.push(fn);}return node;};
  const before=new Node('nav',doc),canvas=new Node('canvas',doc),after=new Node('aside',doc);doc.canvas=canvas;canvas.width=mobile?780:2880;canvas.height=mobile?1688:1800;
  canvas.setAttribute('style','width:1440px;height:900px;touch-action:pan-y');canvas.setAttribute('tabindex','7');canvas.setAttribute('aria-label','Original museum');before.inert=true;before.setAttribute('aria-hidden','false');doc.body.appendChild(before);doc.body.appendChild(canvas);doc.body.appendChild(after);after.focus();
  const captures=new Set(),cancelled=[];canvas.hasPointerCapture=id=>captures.has(id);canvas.releasePointerCapture=id=>captures.delete(id);canvas.addEventListener('pointercancel',event=>cancelled.push(event.pointerId));
  const win=Object.assign(new EventTarget(),{devicePixelRatio:2}),warnings=[],cores=[],orbits=[],urls=[],revoked=[];let resolves;
  const renderer={domElement:canvas,xr:{enabled:false},render(){},autoClear:false,autoClearColor:false,autoClearDepth:true,autoClearStencil:false,localClippingEnabled:true,outputColorSpace:THREE.SRGBColorSpace,toneMapping:THREE.ACESFilmicToneMapping,toneMappingExposure:1,
   target:{museum:true,viewport:[5,6,300,200]},face:2,mip:3,physical:[5,6,300,200],viewport:new THREE.Vector4(1,2,1440,900),scissor:new THREE.Vector4(3,4,700,500),test:true,color:new THREE.Color(.1,.2,.3),alpha:.7,
   getSize(v){return v.set(mobile?390:1440,mobile?844:900);},capabilities:{maxTextureSize:8192},getContext(){return {MAX_VIEWPORT_DIMS:1,FRAMEBUFFER:2,FRAMEBUFFER_COMPLETE:3,checkFramebufferStatus:()=>3,getParameter:()=>[8192,8192],isContextLost:()=>false};},getDrawingBufferSize(v){return v.set(canvas.width,canvas.height);},getRenderTarget(){return this.target;},getActiveCubeFace(){return this.face;},getActiveMipmapLevel(){return this.mip;},setRenderTarget(v,face=0,mip=0){this.target=v;this.face=face;this.mip=mip;this.physical=v?(v.viewport.toArray?v.viewport.toArray():v.viewport.slice()):this.viewport.toArray().map(x=>x*2);},getViewport(v){return v.copy(this.viewport);},setViewport(v){this.viewport.copy(v);this.physical=v.toArray().map(x=>x*2);},getScissor(v){return v.copy(this.scissor);},setScissor(v){this.scissor.copy(v);},getScissorTest(){return this.test;},setScissorTest(v){this.test=v;},getClearColor(v){return v.copy(this.color);},getClearAlpha(){return this.alpha;},setClearColor(v,a){this.color.copy(v);this.alpha=a;},setSize(){throw Error('Host must not resize shared renderer');},setPixelRatio(){throw Error('Host must not change shared DPR');},readRenderTargetPixels(target,x,y,w,h,data){data.fill(17);}};
  class Orbit extends THREE.EventDispatcher {
   constructor(camera,target){super();this.camera=camera;this.domElement=target;this.target=new THREE.Vector3();this.disposals=0;this.enabled=true;orbits.push(this);}
   update(delta){if(this.autoRotate){const p=new THREE.Spherical().setFromVector3(this.camera.position);p.theta+=delta*.02;this.camera.position.setFromSpherical(p);}this.camera.lookAt(this.target);}
   dispose(){this.disposals++;if(cleanupFailure)throw Error('Controlled Orbit disposal failure');}
  }
  const createStarfieldCore=({camera,isMobile})=>{
   const core={camera,nebulaMobile:isMobile,params:{...defaults,checker:isMobile},calls:[],sizes:[],disposals:0,resets:0,sync(){if(this.failSync){this.failSync--;throw Error('Controlled setting synchronization failure');}assert(this.params.exposure>=.2);assert(this.params.inner<this.params.outer);assert(['auto',.5,.75,1].includes(this.params.quality));if(this.params.followIsco)this.params.inner=this.params.spin===.9?1.1604415208809435:3;},resize(w,h){assert(Number.isInteger(w)&&Number.isInteger(h)&&w>0&&h>0);this.sizes.push([w,h]);},captureSample(time,velocity,index,target){assert.equal(target.texture.type,THREE.UnsignedByteType);},resetHistory(){this.resets++;},render(time,velocity=new THREE.Vector3(),destination,frameDelta=0){assert(destination?.isWebGLRenderTarget,'Sampling must target the shared background RT');assert(Number.isFinite(frameDelta)&&frameDelta>=0);this.calls.push({time,frameDelta:Math.min(frameDelta,.1),position:camera.position.clone(),fov:camera.fov,velocity:velocity.clone(),destination});},dispose(){this.disposals++;if(cleanupFailure)throw Error('Controlled core disposal failure');}};cores.push(core);return core;
  };
  let background=null,backgroundRequests=0,applyCount=0;
  const worldCamera=new THREE.PerspectiveCamera(50,(mobile?390:1440)/(mobile?844:900),.1,1000),legacy=new THREE.Group(),scene=new THREE.Scene();
  worldCamera.position.setFromSpherical(new THREE.Spherical(22*.4,THREE.MathUtils.degToRad(84.5),THREE.MathUtils.degToRad(25)));worldCamera.lookAt(0,0,0);scene.add(legacy);
  const transport=pending?new Promise(resolve=>{resolves=()=>resolve({OrbitControls:orbitClass||Orbit});}):Promise.resolve({OrbitControls:orbitClass||Orbit});
  const code=source.replace('export function createStarfieldExperience','function createStarfieldExperience').replace("import('../vendor/controls/OrbitControls.js')",'__orbit');assert(!code.includes('import('));
  const backgroundCode=fs.readFileSync(path.join(__dirname,'../enhancements/starfield-background.js'),'utf8').replace("import {createStarfieldCore} from './starfield-core.js';",'').replace('export function createStarfieldBackground','function createStarfieldBackground');
  const getBackground=()=>{
   backgroundRequests++;if(coreFailure||secondCoreFailure&&backgroundRequests>1)throw Object.assign(Error('Controlled unavailable shared core'),{code:'MUSEUM_STARFIELD_UNSUPPORTED'});
   if(!background){background=c.makeBackground({THREE,scene,renderer,camera:worldCamera,legacy,isDesktop:()=>!mobile});const apply=background.applyObserver;background.applyObserver=()=>{applyCount++;if(renderFailure)throw Error('Controlled observer projection failure');return apply();};}
   return background;
  };
  const c=vm.createContext({THREE,renderer,createStarfieldCore,document:doc,window:win,AbortController,Event,performance,Uint8Array,Uint8ClampedArray,PointerEvent:Pointer,matchMedia:()=>({matches:reduced}),navigator:{platform:apple?'MacIntel':'Win32',userAgent:apple?'Mac OS X':'Windows'},console:{warn(...values){warnings.push(values.map(String));}},URL:{createObjectURL(){const url='blob:starfield-'+urls.length;urls.push(url);return url;},revokeObjectURL(url){revoked.push(url);}},__orbit:transport,__getBackground:getBackground});
  vm.runInContext(backgroundCode+'\nthis.makeBackground=createStarfieldBackground;',c);
  vm.runInContext(code+'\nthis.host=createStarfieldExperience({THREE,renderer,getLanguage:()=>'+JSON.stringify(lang)+',isDesktop:()=>'+(!mobile)+',getBackground:__getBackground});',c);
  // This is the root loop contract: controls first, then offscreen background sampling and composite.
  const pump=(delta=0)=>{if(!background)return;const css=renderer.getSize(new THREE.Vector2());worldCamera.aspect=css.x/css.y;worldCamera.updateProjectionMatrix();background.update(delta,c.host.active?c.host.frameState:null);background.render();};
  const api=new Proxy(c.host,{get(host,key){if(key==='render')return delta=>{host.render(delta);if(host.active&&shell()?.dataset.status==='ready')pump(delta);};if(key==='open')return async options=>{const result=await host.open(options);if(host.active&&shell()?.dataset.status==='ready')pump();return result;};return host[key];}});
  const original=()=>({target:renderer.target,face:renderer.face,mip:renderer.mip,physical:renderer.physical.slice(),viewport:renderer.viewport.toArray(),scissor:renderer.scissor.toArray(),test:renderer.test,color:renderer.color.toArray(),alpha:renderer.alpha,auto:renderer.autoClear,clipping:renderer.localClippingEnabled,exposure:renderer.toneMappingExposure,width:canvas.width,height:canvas.height});
  const shell=()=>doc.body.children.find(n=>n.id==='museumStarfieldOverlay');const action=name=>shell().querySelector('[data-action='+name+']');
  const restored=()=>{assert.deepEqual(doc.body.children,[before,canvas,after]);assert.equal(canvas.nextSibling,after);assert.equal(canvas.getAttribute('style'),'width:1440px;height:900px;touch-action:pan-y');assert.equal(canvas.getAttribute('tabindex'),'7');assert.equal(canvas.getAttribute('aria-label'),'Original museum');assert.equal(before.inert,true);assert.equal(before.getAttribute('aria-hidden'),'false');assert.equal(after.inert,false);assert.equal(after.getAttribute('aria-hidden'),null);assert.equal(doc.activeElement,after);assert(cores.every(core=>core.disposals===0),'Context must never dispose the shared core');};
  return {api,pump,get background(){return background;},worldCamera,get applyCount(){return applyCount;},get backgroundRequests(){return backgroundRequests;},doc,win,canvas,cores,orbits,renderer,warnings,urls,revoked,resolve:()=>resolves(),shell,action,restored,original,captures,cancelled};
 }

module.exports={fixture};
