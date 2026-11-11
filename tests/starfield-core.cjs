'use strict';
// Execute the actual core and official local passes with a recording renderer; no GPU or network.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{pathToFileURL}=require('node:url');
const base=path.resolve(process.argv[2]||path.join(__dirname,'..')),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
(async()=>{
 const THREE=await import(pathToFileURL(path.join(base,'vendor/three.module.js'))),cache=new Map();
 function localModule(file){
  if(cache.has(file))return cache.get(file);
  const source=fs.readFileSync(file,'utf8'),adapted=source.replace(/from\s*(['"])([^'"]+)\1/g,(whole,quote,name)=>{
   if(name==='three')return 'from '+JSON.stringify(pathToFileURL(path.join(base,'vendor/three.module.js')).href);
   assert(name.startsWith('.'),'Unexpected module transport '+name);return 'from '+JSON.stringify(localModule(path.resolve(path.dirname(file),name)));
  });
  const url='data:text/javascript;base64,'+Buffer.from(adapted).toString('base64');cache.set(file,url);return url;
 }
 const {createStarfieldCore}=await import(localModule(path.join(base,'enhancements/starfield-core.js'))),shaders=await import(localModule(path.join(base,'enhancements/starfield-shaders.js')));
 assert.equal(sha(shaders.rayVertex),'ee7891efa6516225ca5c5217fa18ca9323821498079dc3b022b6350264a4501d');
 assert.equal(sha(shaders.rayFragment),'1ddf17a1de79598aa973ae438f013b9ddb7b55ecdb83962d46e0bdb3292215e2');
 assert.equal(sha(shaders.temporalFragment),'560b3e1d5c7bb373036430a5153b0cd233d7f388b24e06c69720d4fd35d38c12');
 const parentInput=path.resolve(base,'../../blackhole-input-2026-11-11/blackhole-windows-dev/blackhole.html');
 if(fs.existsSync(parentInput)){
  const raw=fs.readFileSync(parentInput);assert.equal(sha(raw),'507230420142b0b9ff28ff76edf5d5e891f20caebd4cfb30d1064f9399b8c338');
  const html=raw.toString('utf8'),scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
  assert.equal(shaders.rayVertex,scripts[0]);assert.equal(shaders.rayFragment,scripts[1]);assert.equal(shaders.temporalFragment,/Wg=`([\s\S]*?)`,Xg=/.exec(scripts[2])[1]);
  assert(shaders.nebulaFragment.includes(scripts[1].slice(scripts[1].indexOf('float hash13'),scripts[1].indexOf('vec3 hash33'))));
 }
 const disposed=[],originals=[];let throwDispose=null;
 for(const proto of [THREE.RenderTarget.prototype,THREE.Texture.prototype,THREE.Material.prototype,THREE.BufferGeometry.prototype]){
  const original=proto.dispose;originals.push([proto,original]);proto.dispose=function(){disposed.push(this);if(this===throwDispose)throw new Error('controlled dispose');return original.call(this);};
 }
 function rig(options={}){
  const initial={target:{outside:true,viewport:new THREE.Vector4(11,12,33,44),scissor:new THREE.Vector4(6,7,14,15),scissorTest:false},face:3,mip:2,viewport:new THREE.Vector4(3,4,77,99),scissor:new THREE.Vector4(6,8,9,10),test:true,color:new THREE.Color(.2,.3,.4),alpha:.35,auto:false,autoColor:false,autoDepth:true,autoStencil:false,xr:true};
  let target=initial.target,face=initial.face,mip=initial.mip,viewport=initial.viewport.clone(),scissor=initial.scissor.clone(),test=initial.test,color=initial.color.clone(),alpha=initial.alpha;
  let physicalViewport=initial.target.viewport.clone(),physicalScissor=initial.target.scissor.clone(),physicalTest=initial.target.scissorTest;
  const dpr=2;
  const targets=new Set(),draws=[],viewportCalls=[],gl={MAX_3D_TEXTURE_SIZE:1,FRAMEBUFFER:2,FRAMEBUFFER_COMPLETE:3,isContextLost:()=>!!options.lost,getParameter:()=>256,checkFramebufferStatus:()=>options.incomplete?0:3};
  const r={capabilities:{isWebGL2:options.webgl2!==false,maxTextureSize:8192},extensions:{has:()=>options.hdr!==false},xr:{enabled:initial.xr},autoClear:initial.auto,autoClearColor:initial.autoColor,autoClearDepth:initial.autoDepth,autoClearStencil:initial.autoStencil,toneMapping:THREE.ACESFilmicToneMapping,toneMappingExposure:1.17,outputColorSpace:THREE.SRGBColorSpace,
   getContext:()=>gl,getRenderTarget:()=>target,getActiveCubeFace:()=>face,getActiveMipmapLevel:()=>mip,
   getViewport:v=>v.copy(viewport),getScissor:v=>v.copy(scissor),getScissorTest:()=>test,getClearColor:c=>c.copy(color),getClearAlpha:()=>alpha,getSize:v=>v.set(1440,900),
   setRenderTarget(t,f=0,m=0){target=t;face=f;mip=m;physicalViewport=t?t.viewport.clone():viewport.clone().multiplyScalar(dpr).floor();physicalScissor=t?t.scissor.clone():scissor.clone().multiplyScalar(dpr).floor();physicalTest=t?t.scissorTest:test;if(t?.isWebGLRenderTarget){targets.add(t);assert.equal(t.depthBuffer,false);}},
   setViewport(a,b,c,d){viewportCalls.push([a,b,c,d]);viewport=a?.isVector4?a.clone():new THREE.Vector4(a,b,c,d);physicalViewport=viewport.clone().multiplyScalar(dpr).floor();},setScissor:v=>{scissor=v.clone();physicalScissor=scissor.clone().multiplyScalar(dpr).floor();},setScissorTest:v=>{test=v;physicalTest=v;},setClearColor(c,a){color=c?.isColor?c.clone():new THREE.Color(c);if(a!==undefined)alpha=a;},clear(){},
   render(mesh){draws.push({material:mesh.material,target,physicalViewport:physicalViewport.toArray()});if(options.throwDraw===draws.length)throw options.reason===undefined?new Error('controlled draw'):options.reason;}
  };
  const camera=new THREE.PerspectiveCamera(50,1.6,.1,1000);camera.position.set(20,2,20);camera.lookAt(0,0,0);
  const verify=()=>{assert.equal(target,initial.target);assert.equal(face,initial.face);assert.equal(mip,initial.mip);assert.deepEqual(viewport.toArray(),initial.viewport.toArray());assert.deepEqual(scissor.toArray(),initial.scissor.toArray());assert.equal(test,initial.test);assert.deepEqual(physicalViewport.toArray(),initial.target.viewport.toArray());assert.deepEqual(physicalScissor.toArray(),initial.target.scissor.toArray());assert.equal(physicalTest,initial.target.scissorTest);assert.deepEqual(color.toArray(),initial.color.toArray());assert.equal(alpha,initial.alpha);assert.equal(r.autoClear,initial.auto);assert.equal(r.autoClearColor,initial.autoColor);assert.equal(r.autoClearDepth,initial.autoDepth);assert.equal(r.autoClearStencil,initial.autoStencil);assert.equal(r.xr.enabled,initial.xr);assert.equal(r.toneMappingExposure,1.17);assert.equal(r.outputColorSpace,THREE.SRGBColorSpace);};
  return {r,camera,options,targets,draws,viewportCalls,verify,create:()=>createStarfieldCore({THREE,renderer:r,camera,isMobile:!!options.mobile})};
 }
 try{
  for(const options of [{webgl2:false},{hdr:false},{lost:true}]){
   const h=rig(options);assert.throws(h.create,e=>e.code===(options.lost?'MUSEUM_CONTEXT_LOST':'MUSEUM_STARFIELD_UNSUPPORTED'));assert.equal(h.targets.size,0);assert.equal(h.draws.length,0);h.verify();
  }
  const h=rig(),core=h.create();h.verify();assert.equal(h.targets.size,15);assert.equal(h.draws.length,1);
  assert.equal(core.params.steps,1000);assert.equal(core.params.temp,4200);assert.equal(core.params.spin,0);
  const noise=h.draws[0].material;assert.equal(noise.fragmentShader,shaders.nebulaFragment);
  core.resize(641,399);h.verify();const targetCount=h.targets.size;core.resize(641,399);assert.equal(h.targets.size,targetCount,'Same-size resize must not allocate');
  const before=h.draws.length;core.render(0);h.verify();assert.equal(h.draws.length-before,15,'Full ray/temporal/5-mip bloom/output graph retained');
  const frame=h.draws.slice(before),ray=frame[0].material,blend=frame[1].material,output=frame.at(-1).material;
  assert.equal(ray.fragmentShader,shaders.rayFragment);assert.equal(blend.fragmentShader,shaders.temporalFragment);assert.equal(blend.uniforms.uFresh.value,1);
  assert(frame[2].material.fragmentShader.includes('vec3( 0.2126, 0.7152, 0.0722 )'),'Bloom retains the supplied r170 working-space luminance');
  assert(!frame[2].material.fragmentShader.includes('vec3( 0.299, 0.587, 0.114 )'));
  assert.equal(sha(ray.uniforms.uNoise.value.image.data),'b7204592da5db025e54e6a2881edcceb2ac8d163e5488f357e5cf967aaa924b5');
  assert.deepEqual([ray.uniforms.uNoise.value.image.width,ray.uniforms.uNoise.value.image.height,ray.uniforms.uNoise.value.image.depth],[128,128,128]);
  assert.equal(output.uniforms.toneMappingExposure.value,1.38);assert.deepEqual(output.defines,{ACES_FILMIC_TONE_MAPPING:'',SRGB_TRANSFER:''});assert(output.fragmentShader.includes('texture2D( tBloom, vUv )'));
  const destination=new THREE.WebGLRenderTarget(320,160,{depthBuffer:false}),viewportBefore=h.viewportCalls.length;destination.viewport.set(10,11,224,112);
  core.render(.008,undefined,destination);assert.equal(h.draws.at(-1).target,destination);assert.deepEqual(h.draws.at(-1).physicalViewport,[10,11,224,112]);assert.equal(h.viewportCalls.length-viewportBefore,1,'Offscreen target uses its physical viewport; only the final state restoration calls setViewport');h.verify();
  for(const bad of [{},false,new THREE.WebGLCubeRenderTarget(16)])assert.throws(()=>core.render(.008,undefined,bad),TypeError);
  const oldTargets=new Set(h.targets);core.params.checker=true;core.sync();h.verify();assert.equal(h.targets.size,oldTargets.size+3,'Checker change reuses all bloom targets');
  core.render(.016);assert.equal(h.draws.at(-15).target.width,321);assert.equal(blend.uniforms.uFresh.value,1);core.render(.032);assert.equal(blend.uniforms.uFresh.value,0);
  h.camera.position.x+=1;core.render(.032);assert.equal(blend.uniforms.uW.value,1,'Same-time manual camera move resets history');h.verify();
  const frozen=rig(),frozenCore=frozen.create();frozenCore.params.freeze=true;frozenCore.sync();frozenCore.resize(640,360);
  for(let frame=0;frame<4;frame++)frozenCore.render(5,undefined,null,1/60);
  const frozenAngle=THREE.MathUtils.degToRad(frozen.camera.fov)/360*.25;
  frozen.camera.position.applyAxisAngle(new THREE.Vector3(0,1,0),frozenAngle);frozen.camera.lookAt(0,0,0);
  const beforeRejected=frozen.draws.length;
  for(const bad of [null,false,-1,NaN,Infinity])assert.throws(()=>frozenCore.render(5,undefined,null,bad),RangeError);
  assert.equal(frozen.draws.length,beforeRejected);
  frozenCore.render(5,undefined,null,1/60);
  assert.equal(frozen.draws.at(-14).material.uniforms.uW.value,.25,'Paused small manual movement uses the real frame duration');
  frozenCore.render(5,undefined,null,0);assert.equal(frozen.draws.at(-15).material.uniforms.uFrame.value,5,'Explicit zero duration remains valid for a stationary capture');
  frozenCore.render(4,undefined,null,1/60);assert.equal(frozen.draws.at(-15).material.uniforms.uFrame.value,0,'Simulation rewind still resets history');
  frozenCore.dispose();frozen.verify();
  const following=rig(),follow=following.create(),paramsIdentity=follow.params;follow.params.followIsco=true;follow.sync();assert.equal(follow.params.inner,3,'ISCO-follow readout must reflect the effective inner radius');
  follow.params.spin=.9;follow.params.checker=true;following.options.incomplete=true;assert.throws(()=>follow.sync(),e=>e.code==='MUSEUM_STARFIELD_UNSUPPORTED');assert.equal(follow.params.inner,3,'Failed target transaction must not commit a new follow radius');following.options.incomplete=false;follow.params.checker=false;follow.sync();assert(Math.abs(follow.params.inner-1.1604415208809435)<1e-12);assert.equal(follow.params,paramsIdentity);
  for(const spin of [0,.1,.5,.9,.998]){follow.params.spin=spin;follow.sync();follow.render(1);assert.equal(follow.params.inner,following.draws.at(-15).material.uniforms.uInner.value);following.verify();}follow.params.followIsco=false;follow.params.inner=2.5;follow.sync();assert.equal(follow.params.inner,2.5);follow.dispose();
  for(const [key,bad] of [['steps',100.5],['spin',NaN],['temp',1499],['outer',Infinity],['lensing',1],['quality',2]]){
   const old=core.params[key];core.params[key]=bad;assert.throws(()=>core.sync());core.params[key]=old;
  }
  for(const [key,min,max]of [['steps',100,1000],['spin',0,.998],['doppler',0,1],['inner',.5,6],['outer',4,24],['thick',0,2],['temp',1500,15000],['bright',.2,5],['speed',0,10],['hotR',.6,12],['jetBright',0,4],['stars',0,3],['nebula',0,3],['bloom',0,3],['bloomRadius',0,1],['exposure',.2,3]]){
   const old=core.params[key];for(const bad of [min-1,max+1,NaN,Infinity]){core.params[key]=bad;assert.throws(()=>core.sync(),RangeError);}
   for(const valid of [min,max]){core.params[key]=valid;core.sync();}core.params[key]=old;core.sync();
  }
  for(const key of ['checker','lensing','followIsco','hotSpot','jets','inset','freeze','autoRotate']){const old=core.params[key];core.params[key]='true';assert.throws(()=>core.sync(),TypeError);core.params[key]=old;}
  const oldInner=core.params.inner;core.params.inner=core.params.outer;assert.throws(()=>core.sync(),RangeError);core.params.inner=oldInner;
  for(const [w,hh]of [[0,10],[1.5,2],[8193,1],[1,NaN]])assert.throws(()=>core.resize(w,hh),RangeError);
  for(const [time,velocity]of [[NaN],[0,null],[0,false],[0,{x:1,y:0,z:0}],[0,{x:0,y:NaN,z:0}],[-1]])assert.throws(()=>core.render(time,velocity),RangeError);
  const beforeFailed=new Set(h.targets);h.options.incomplete=true;assert.throws(()=>core.resize(800,500),e=>e.code==='MUSEUM_STARFIELD_UNSUPPORTED');h.options.incomplete=false;h.verify();
  for(const t of h.targets)if(!beforeFailed.has(t))assert(disposed.includes(t),'Failed candidate targets released');core.render(.048);h.verify();
  const activeTargets=[...h.targets].filter(t=>t!==destination&&!disposed.includes(t));core.dispose();const afterDispose=disposed.length;core.dispose();assert.equal(disposed.length,afterDispose);for(const t of activeTargets)assert.equal(disposed.filter(x=>x===t).length,1);assert(!disposed.includes(destination),'Borrowed output target remains host-owned');destination.dispose();assert.throws(()=>core.render(0),e=>e.code==='MUSEUM_STARFIELD_CLOSED');h.verify();
  for(let step=1;step<=15;step++){
   const f=rig(),c=f.create();f.options.throwDraw=f.draws.length+step;const reason=step===7?null:new Error('controlled frame '+step);f.options.reason=reason;
   assert.throws(()=>c.render(0),e=>e===reason);f.verify();f.options.throwDraw=0;c.render(.016);f.verify();c.dispose();
  }
  const init=rig({throwDraw:1});assert.throws(init.create,/controlled draw/);init.verify();for(const t of init.targets)assert(disposed.includes(t));
  const mobile=rig({mobile:true}),m=mobile.create();assert.equal(m.params.checker,true);assert.equal(mobile.draws[0].target.width,1024);assert.equal(mobile.draws[0].target.height,512);
  const live=[...mobile.targets].filter(t=>!disposed.includes(t));throwDispose=live[0];assert.throws(()=>m.dispose(),/controlled dispose/);for(const t of live)assert(disposed.includes(t),'One dispose error must not stop remaining owners');throwDispose=null;m.dispose();mobile.verify();
  const hd=rig(),hc=hd.create(),destinationHD=new THREE.WebGLRenderTarget(640,360,{type:THREE.UnsignedByteType,depthBuffer:false});hc.resize(640,360);const math={sample:function sample(index){
 if(!Number.isInteger(index)||index<0||index>=24)throw new RangeError('Capture sample must be 0..23');
 function halton(n,base){let f=1,value=0;for(;n>0;n=Math.floor(n/base)){f/=base;value+=f*(n%base);}return value;}
 return {frame:index,weight:1/(index+1),jitter:[index?halton(index,2)-.5:0,index?halton(index,3)-.5:0]};
}},velocityHD=new THREE.Vector3(.01,0,0),samplesHD=[];
  for(let index=0;index<24;index++){const begin=hd.draws.length;hc.captureSample(5,velocityHD,index,destinationHD);assert.equal(hd.draws.length-begin,15);const graph=hd.draws.slice(begin),expected=math.sample(index);assert.equal(graph[0].material.uniforms.uFrame.value,expected.frame);assert.deepEqual(graph[0].material.uniforms.uJitter.value.toArray(),expected.jitter);assert.equal(graph[1].material.uniforms.uW.value,expected.weight);assert.equal(graph[0].material.uniforms.uTime.value,5);assert.deepEqual(graph[0].material.uniforms.uObsVel.value.toArray(),velocityHD.toArray());assert.equal(graph[1].material.uniforms.uFresh.value,index===0?1:0);assert.equal(graph.at(-1).target,destinationHD);hd.verify();samplesHD.push({index,weight:expected.weight,jitter:expected.jitter,draws:graph.length});}
  assert.throws(()=>hc.render(5),e=>e.code==='MUSEUM_STARFIELD_CAPTURE_BUSY');hc.resetHistory();hc.render(5);hd.verify();
  for(const bad of [-1,24,.5,NaN,Infinity,'0']){const before=hd.draws.length;assert.throws(()=>hc.captureSample(5,velocityHD,bad,destinationHD),RangeError);assert.equal(hd.draws.length,before);}
  assert.throws(()=>hc.captureSample(NaN,velocityHD,0,destinationHD),RangeError);hc.captureSample(5,velocityHD,0,destinationHD);assert.throws(()=>hc.captureSample(5,velocityHD,2,destinationHD),/order/);hc.captureSample(5,velocityHD,1,destinationHD);
  const beforeDrift=hd.draws.length;hd.camera.position.x+=.01;assert.throws(()=>hc.captureSample(5,velocityHD,2,destinationHD),/frozen/);assert.equal(hd.draws.length,beforeDrift);hc.resetHistory();
  for(let point=1;point<=15;point++){hd.options.throwDraw=hd.draws.length+point;assert.throws(()=>hc.captureSample(5,velocityHD,0,destinationHD),/controlled draw/);hd.verify();hd.options.throwDraw=0;hc.captureSample(5,velocityHD,0,destinationHD);hc.resetHistory();}
  for(const mode of ['time','velocity','parameter']){hc.resetHistory();hc.captureSample(5,velocityHD,0,destinationHD);const count=hd.draws.length;if(mode==='time')assert.throws(()=>hc.captureSample(6,velocityHD,1,destinationHD),/frozen/);else if(mode==='velocity')assert.throws(()=>hc.captureSample(5,new THREE.Vector3(.02,0,0),1,destinationHD),/frozen/);else{hc.params.temp=4300;assert.throws(()=>hc.captureSample(5,velocityHD,1,destinationHD),/frozen/);hc.params.temp=4200;}assert.equal(hd.draws.length,count);hc.resetHistory();}
  const halfTarget=new THREE.WebGLRenderTarget(640,360,{type:THREE.HalfFloatType,depthBuffer:false});assert.throws(()=>hc.captureSample(5,velocityHD,0,halfTarget),RangeError);halfTarget.dispose();
  hc.dispose();assert(!disposed.includes(destinationHD));destinationHD.dispose();hd.verify();
  console.log(JSON.stringify({HDCPU:true,samples:samplesHD,all15CaptureDrawFailurePointsRestored:true,ordinaryOldAssertionsRetained:true,noGPU:true}));
  console.log('PASS: original shader/noise, actual r160 pass graph, all parameter boundaries, state restoration, checker/resize ownership, 15 draw failure points, initialization and cleanup failures. No GPU/network.');
 }finally{for(const [proto,original]of originals)proto.dispose=original;}
})().catch(error=>{console.error(error);process.exitCode=1;});
