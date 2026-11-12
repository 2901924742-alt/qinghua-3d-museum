import {UnrealBloomPass} from '../vendor/blackhole-postprocessing/examples/jsm/postprocessing/UnrealBloomPass.js';
import {OutputPass} from '../vendor/blackhole-postprocessing/examples/jsm/postprocessing/OutputPass.js';
import {FullScreenQuad} from '../vendor/blackhole-postprocessing/examples/jsm/postprocessing/Pass.js';
import {rayVertex,rayFragment,temporalFragment,screenVertex,nebulaFragment} from './starfield-shaders.js';

// Port of the supplied 50723042 black-hole core; the host owns time, camera and the only animation loop.
export function createStarfieldCore({THREE,renderer,camera,isMobile=false}) {
 const error=(message,code)=>Object.assign(new Error(message),{code});
 const gl=renderer.getContext();
 const requireContext=()=>{if(gl.isContextLost())throw error('WebGL context temporarily unavailable','MUSEUM_CONTEXT_LOST');};
 requireContext();
 if(!renderer.capabilities.isWebGL2||!renderer.extensions.has('EXT_color_buffer_float')||gl.getParameter(gl.MAX_3D_TEXTURE_SIZE)<128||renderer.capabilities.maxTextureSize<2048)
  throw error('This experience needs WebGL2 and renderable half-float textures','MUSEUM_STARFIELD_UNSUPPORTED');
 const params={quality:'auto',checker:isMobile,steps:1000,spin:0,lensing:true,doppler:.75,followIsco:false,inner:1.55,outer:24,thick:0,temp:4200,bright:5,speed:10,hotSpot:false,hotR:4,jets:false,jetBright:1,inset:false,stars:3,nebula:3,bloom:.34,bloomRadius:1,exposure:1.38,freeze:false,autoRotate:true};
 const resources=new Set();let disposed=false,width=0,height=0,checker=null,cur=null,hist=[],bloom=null,bloomResources=[],settings=null,idx=0,parity=0,fresh=true,samples=0,lastTime=null,captureState=null;
 let uniforms,ray,blend,output,rayQuad,blendQuad,nebulaQuad,nebulaTarget;
 const own=value=>{resources.add(value);return value;};
 function release(values,failed=false,primary){
  for(const value of values){resources.delete(value);try{value.dispose();}catch(reason){if(!failed){failed=true;primary=reason;}}}
  if(failed)throw primary;
 }
 function guard(action){
  const saved={target:renderer.getRenderTarget(),face:renderer.getActiveCubeFace(),mip:renderer.getActiveMipmapLevel(),viewport:renderer.getViewport(new THREE.Vector4()),scissor:renderer.getScissor(new THREE.Vector4()),test:renderer.getScissorTest(),color:renderer.getClearColor(new THREE.Color()),alpha:renderer.getClearAlpha(),auto:renderer.autoClear,autoColor:renderer.autoClearColor,autoDepth:renderer.autoClearDepth,autoStencil:renderer.autoClearStencil,xr:renderer.xr.enabled};
  let failed=false,primary,result;
  try{renderer.xr.enabled=false;renderer.setScissorTest(false);renderer.setClearColor(0,1);renderer.autoClear=renderer.autoClearColor=renderer.autoClearDepth=renderer.autoClearStencil=true;result=action();}
  catch(reason){failed=true;primary=reason;}
  finally{
   // Restore logical screen caches before the target reapplies its physical viewport/scissor (r160 DPR).
   for(const restore of [()=>renderer.setViewport(saved.viewport),()=>renderer.setScissor(saved.scissor),()=>renderer.setScissorTest(saved.test),()=>renderer.setClearColor(saved.color,saved.alpha),()=>{renderer.autoClear=saved.auto;renderer.autoClearColor=saved.autoColor;renderer.autoClearDepth=saved.autoDepth;renderer.autoClearStencil=saved.autoStencil;renderer.xr.enabled=saved.xr;},()=>renderer.setRenderTarget(saved.target,saved.face,saved.mip)]){
    try{restore();}catch(reason){if(!failed){failed=true;primary=reason;}}
   }
  }
  if(failed)throw primary;return result;
 }
 const active=()=>{if(disposed)throw error('Experience closed','MUSEUM_STARFIELD_CLOSED');requireContext();};
 function framebuffer(target){
  renderer.setRenderTarget(target);requireContext();
  if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw error('Half-float framebuffer unavailable','MUSEUM_STARFIELD_UNSUPPORTED');
 }
 const target=(w,h)=>own(new THREE.WebGLRenderTarget(w,h,{type:THREE.HalfFloatType,depthBuffer:false}));
 const material=options=>own(new THREE.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,...options}));
 const quad=mat=>own(new FullScreenQuad(mat));
 const isco=spin=>{const z1=1+Math.cbrt(1-spin*spin)*(Math.cbrt(1+spin)+Math.cbrt(1-spin)),z2=Math.sqrt(3*spin*spin+z1*z1);return .5*(3+z2-Math.sqrt((3-z1)*(3+z1+2*z2)));};
 function validate(){
  for(const [name,min,max] of [['steps',100,1000],['spin',0,.998],['doppler',0,1],['inner',.5,6],['outer',4,24],['thick',0,2],['temp',1500,15000],['bright',.2,5],['speed',0,10],['hotR',.6,12],['jetBright',0,4],['stars',0,3],['nebula',0,3],['bloom',0,3],['bloomRadius',0,1],['exposure',.2,3]]){
   if(!Number.isFinite(params[name])||params[name]<min||params[name]>max)throw new RangeError('Invalid black-hole parameter: '+name);
  }
  for(const name of ['checker','lensing','followIsco','hotSpot','jets','inset','freeze','autoRotate'])if(typeof params[name]!=='boolean')throw new TypeError('Invalid black-hole parameter: '+name);
  if(!Number.isInteger(params.steps)||!['auto',.5,.75,1].includes(params.quality)||params.inner>=params.outer)throw new RangeError('Invalid black-hole parameters');
  return {...params,inner:params.followIsco?isco(params.spin):params.inner};
 }
 function makeBloom(w,h){
  // The soft halo uses a smaller buffer; ray tracing and temporal history retain the full reconstruction size.
  const pass=new UnrealBloomPass(new THREE.Vector2(Math.max(2,Math.ceil(w/2)),Math.max(2,Math.ceil(h/2))),settings.bloom,settings.bloomRadius,.85);
  const owned=[pass.renderTargetBright,...pass.renderTargetsHorizontal,...pass.renderTargetsVertical,pass.materialHighPassFilter,...pass.separableBlurMaterials,pass.compositeMaterial,pass.blendMaterial,pass.basic,pass.fsQuad];
  owned.forEach(own);
  // Match the supplied r170 working-space luminance while retaining the museum's r160 engine.
  const luminance='vec3( 0.299, 0.587, 0.114 )',highPass=pass.materialHighPassFilter;
  if(highPass.fragmentShader.split(luminance).length!==2)throw new Error('Unexpected local bloom luminance shader');
  highPass.fragmentShader=highPass.fragmentShader.replace(luminance,'vec3( 0.2126, 0.7152, 0.0722 )');
  for(const rt of [pass.renderTargetBright,...pass.renderTargetsHorizontal,...pass.renderTargetsVertical])rt.depthBuffer=false;
  const draw=pass.fsQuad.render.bind(pass.fsQuad);
  // The final output adds bloom once; preserve the source's skipped additive blend draw.
  pass.fsQuad.render=r=>{if(pass.fsQuad.material!==pass.blendMaterial)draw(r);};
  return {pass,owned};
 }
 function resetHistory(){active();samples=0;fresh=true;lastTime=null;captureState=null;}
 function resize(w,h){
  active();
  if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||w>renderer.capabilities.maxTextureSize||h>renderer.capabilities.maxTextureSize)throw new RangeError('Invalid black-hole render size');
  if(w===width&&h===height&&checker===settings.checker)return;
  const before=new Set(resources);let nextCur,nextHist,nextBloom;
  try{
   nextCur=target(settings.checker?Math.ceil(w/2):w,h);nextHist=[target(w,h),target(w,h)];
   if(w!==width||h!==height)nextBloom=makeBloom(w,h);
   guard(()=>{for(const rt of [nextCur,...nextHist,...(nextBloom?[nextBloom.pass.renderTargetBright,...nextBloom.pass.renderTargetsHorizontal,...nextBloom.pass.renderTargetsVertical]:[])])framebuffer(rt);});
  }catch(reason){release([...resources].filter(r=>!before.has(r)),true,reason);}
  const old=[...(cur?[cur,...hist]:[]),...(nextBloom?bloomResources:[])];
  cur=nextCur;hist=nextHist;if(nextBloom){bloom=nextBloom.pass;bloomResources=nextBloom.owned;}
  width=w;height=h;checker=settings.checker;idx=0;parity=0;uniforms.uResolution.value.set(w,h);
  blend.defines=checker?{CHECKER:''}:{};blend.needsUpdate=true;resetHistory();release(old);
 }
 function sync(){
  active();const next=validate(),previous=settings;settings=next;
  try{if(width&&checker!==next.checker)resize(width,height);}catch(reason){settings=previous;throw reason;}
  const values={uSpin:next.spin*.5,uHorizon:.5+Math.sqrt(.25-(next.spin*.5)**2),uSteps:next.steps,uLensing:next.lensing?1:0,uDoppler:next.doppler,uInner:next.inner,uOuter:next.outer,uThick:next.thick,uTemp:next.temp,uBright:next.bright,uSpeed:next.speed,uHotR:Math.max(next.hotR,isco(next.spin)),uJet:next.jetBright,uStars:next.stars,uNebula:next.nebula};
  for(const [key,value] of Object.entries(values))uniforms[key].value=value;
  const defines={};if(next.spin===0)defines.SPIN_ZERO='';if(next.thick>=.01)defines.THICK_DISK='';if(next.hotSpot)defines.HOTSPOT='';if(next.jets)defines.JETS='';if(next.checker)defines.CHECKER='';
  if(Object.keys(defines).join(',')!==Object.keys(ray.defines).join(',')){ray.defines=defines;ray.needsUpdate=true;}
  if(next.followIsco)params.inner=next.inner;
  bloom&&(bloom.strength=next.bloom,bloom.radius=next.bloomRadius);resetHistory();
 }
 function halton(n,base){let f=1,value=0;for(;n>0;n=Math.floor(n/base)){f/=base;value+=f*(n%base);}return value;}
 const previousPosition=new THREE.Vector3(),previousForward=new THREE.Vector3(),forward=new THREE.Vector3();let previousFov=0;
 function renderFrame(time,observerVelocity,destination=null,frameDelta,captureIndex=null){
  active();
  if(destination!==null&&(destination.isWebGLRenderTarget!==true||destination.isWebGLCubeRenderTarget||destination.isWebGL3DRenderTarget||destination.isWebGLArrayRenderTarget||!Number.isInteger(destination.width)||!Number.isInteger(destination.height)||destination.width<1||destination.height<1||destination.width>renderer.capabilities.maxTextureSize||destination.height>renderer.capabilities.maxTextureSize))throw new TypeError('Invalid black-hole output target');
  if(!Number.isFinite(time)||time<0)throw new RangeError('Invalid black-hole time');
  if(frameDelta!==undefined&&(!Number.isFinite(frameDelta)||frameDelta<0))throw new RangeError('Invalid black-hole frame duration');
  const velocity=observerVelocity===undefined?{x:0,y:0,z:0}:observerVelocity;
  if(!velocity||![velocity.x,velocity.y,velocity.z].every(Number.isFinite)||velocity.x*velocity.x+velocity.y*velocity.y+velocity.z*velocity.z>=1)throw new RangeError('Invalid observer velocity');
  if(!camera.position.toArray().every(Number.isFinite)||camera.position.length()<=0||!Number.isFinite(camera.fov)||camera.fov<=0||camera.fov>=180)throw new RangeError('Invalid black-hole camera');
  camera.updateMatrixWorld();camera.getWorldDirection(forward);
  if(![...camera.matrixWorld.elements,...camera.projectionMatrixInverse.elements,...forward.toArray()].every(Number.isFinite))throw new RangeError('Invalid black-hole camera matrix');
  const delta=frameDelta===undefined?(lastTime===null?0:Math.max(0,Math.min(.1,time-lastTime))):Math.min(.1,frameDelta);
  const motion=previousForward.angleTo(forward)+previousPosition.distanceTo(camera.position)/Math.max(camera.position.length(),.001);
  const pixelAngle=THREE.MathUtils.degToRad(camera.fov)/height,speed=motion/pixelAngle/(Math.max(delta,.001)*60),still=motion<1e-7;
  if(captureIndex===null&&(camera.fov!==previousFov||speed>5||velocity.x||velocity.y||velocity.z||lastTime!==null&&time<lastTime))samples=0;
  previousPosition.copy(camera.position);previousForward.copy(forward);previousFov=camera.fov;
  let weight=1/(samples+1);weight=captureIndex===null?(still?Math.max(weight,settings.freeze?1/4096:.1):Math.max(weight,.25+.75*THREE.MathUtils.smoothstep(speed,1.5,5))):1/(captureIndex+1);
  const frame=captureIndex===null?samples%997:captureIndex,jitter=captureIndex===null?(samples?samples%64+1:0):captureIndex;
  uniforms.uTime.value=time;uniforms.uFrame.value=frame;uniforms.uJitter.value.set(jitter?halton(jitter,2)-.5:0,jitter?halton(jitter,3)-.5:0);
  uniforms.uCamPos.value.copy(camera.position);uniforms.uCamToWorld.value.copy(camera.matrixWorld);uniforms.uInvProj.value.copy(camera.projectionMatrixInverse);uniforms.uObsVel.value.set(velocity.x,velocity.y,velocity.z);
  uniforms.uEscape.value=Math.max(settings.outer*1.05+1,settings.hotSpot?settings.hotR+2:0,settings.jets?46:0,12);
  try{guard(()=>{
   parity=1-parity;uniforms.uParity.value=parity;renderer.setRenderTarget(cur);rayQuad.render(renderer);
   const old=hist[idx],next=hist[1-idx],u=blend.uniforms;u.tCur.value=cur.texture;u.tPrev.value=old.texture;u.uW.value=weight;u.uParity.value=parity;u.uFresh.value=fresh?1:0;
   renderer.setRenderTarget(next);blendQuad.render(renderer);bloom.render(renderer,null,next,0,false);
   output.uniforms.tDiffuse.value=next.texture;output.uniforms.tBloom.value=bloom.renderTargetsHorizontal[0].texture;output.uniforms.toneMappingExposure.value=settings.exposure;
   if(destination)framebuffer(destination);
   else{renderer.setRenderTarget(null);const size=renderer.getSize(new THREE.Vector2());renderer.setViewport(0,0,size.x,size.y);}
   // Render-target viewport is already physical pixels; setViewport would apply screen DPR again.
   output.fsQuad.render(renderer);requireContext();
   idx=1-idx;fresh=false;samples++;lastTime=time;
  });}catch(reason){samples=0;fresh=true;lastTime=null;captureState=null;throw reason;}
 }
 function render(time,observerVelocity,destination=null,frameDelta){
  active();if(captureState)throw error('PNG capture is in progress','MUSEUM_STARFIELD_CAPTURE_BUSY');
  return renderFrame(time,observerVelocity,destination,frameDelta);
 }
 function captureSample(time,observerVelocity,index,destination){
  active();if(!Number.isInteger(index)||index<0||index>=24)throw new RangeError('Invalid PNG sample index');
  if(!destination?.isWebGLRenderTarget||destination.width!==width||destination.height!==height||destination.texture.type!==THREE.UnsignedByteType||destination.texture.format!==THREE.RGBAFormat)throw new RangeError('PNG target must be a matching RGBA byte reconstruction');
  camera.updateMatrixWorld();
  const velocity=observerVelocity===undefined?{x:0,y:0,z:0}:observerVelocity;
  const signature=JSON.stringify([time,velocity?.x,velocity?.y,velocity?.z,camera.fov,camera.matrixWorld.elements,camera.projectionMatrixInverse.elements,width,height,params]);
  if(index===0){
   if(captureState)throw error('PNG capture is already in progress','MUSEUM_STARFIELD_CAPTURE_BUSY');
   resetHistory();idx=0;parity=0;captureState={next:0,signature};
  }
  if(!captureState||captureState.next!==index||captureState.signature!==signature)throw new Error('PNG sample order or frozen state changed');
  try{renderFrame(time,observerVelocity,destination,0,index);captureState.next=index+1;}
  catch(reason){samples=0;fresh=true;lastTime=null;captureState=null;throw reason;}
 }
 function dispose(){if(disposed)return;disposed=true;release([...resources]);}
 try{
  settings=validate();
  const data=new Uint8Array(128**3);let seed=2654435769;for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[i]=seed>>>24;}
  const noise=own(new THREE.Data3DTexture(data,128,128,128));noise.format=THREE.RedFormat;noise.type=THREE.UnsignedByteType;noise.minFilter=noise.magFilter=THREE.LinearFilter;noise.wrapS=noise.wrapT=noise.wrapR=THREE.RepeatWrapping;noise.unpackAlignment=1;noise.needsUpdate=true;
  nebulaTarget=target(isMobile?1024:2048,isMobile?512:1024);nebulaTarget.texture.wrapS=THREE.RepeatWrapping;
  nebulaQuad=quad(material({vertexShader:screenVertex,fragmentShader:nebulaFragment}));
  uniforms={uNebTex:{value:nebulaTarget.texture},uNoise:{value:noise},uResolution:{value:new THREE.Vector2(1,1)},uJitter:{value:new THREE.Vector2()},uFrame:{value:0},uTime:{value:0},uCamPos:{value:new THREE.Vector3()},uCamToWorld:{value:new THREE.Matrix4()},uInvProj:{value:new THREE.Matrix4()},uObsVel:{value:new THREE.Vector3()},uParity:{value:0},uEscape:{value:60}};
  for(const name of ['uSpin','uHorizon','uSteps','uLensing','uDoppler','uInner','uOuter','uThick','uTemp','uBright','uSpeed','uHotR','uJet','uStars','uNebula'])uniforms[name]={value:0};
  ray=material({uniforms,vertexShader:rayVertex,fragmentShader:rayFragment});rayQuad=quad(ray);
  blend=material({uniforms:{tCur:{value:null},tPrev:{value:null},uW:{value:1},uParity:{value:0},uFresh:{value:1}},vertexShader:screenVertex,fragmentShader:temporalFragment});blendQuad=quad(blend);
  output=new OutputPass();own(output.material);own(output.fsQuad);output.material.depthTest=output.material.depthWrite=false;
  const anchors=['uniform sampler2D tDiffuse;','gl_FragColor = texture2D( tDiffuse, vUv );'];
  if(!anchors.every(a=>output.material.fragmentShader.split(a).length===2))throw new Error('Unexpected local OutputPass shader');
  output.uniforms.tBloom={value:null};output.material.fragmentShader=output.material.fragmentShader.replace(anchors[0],anchors[0]+'\nuniform sampler2D tBloom;').replace(anchors[1],'gl_FragColor = texture2D( tDiffuse, vUv ) + texture2D( tBloom, vUv );');
  output.material.defines={ACES_FILMIC_TONE_MAPPING:'',SRGB_TRANSFER:''};output.material.needsUpdate=true;
  guard(()=>{framebuffer(nebulaTarget);nebulaQuad.render(renderer);requireContext();});resize(1,1);sync();
 }catch(reason){disposed=true;release([...resources],true,reason);}
 return {params,sync,resize,render,captureSample,resetHistory,dispose};
}
