import {exhibits} from './exhibits.js';

// On-demand previews reuse the museum context; no second WebGL renderer or loop.
export function createStudioRenderer({THREE,renderer,loadExhibit,disposeExhibit,getModel,getIndex}) {
 let target=null,linear=null,outputScene=null,outputMaterial=null,outputGeometry=null,disposed=false;
 const outputCamera=new THREE.Camera();
 const abort=signal=>{if(disposed||signal?.aborted)throw signal?.reason||new DOMException('Studio closed','AbortError');};
 function renderPreview(scene,camera,canvas) {
  abort();
  if(renderer.getContext().isContextLost())throw new Error('WebGL context unavailable');
  const width=canvas.width,height=canvas.height;
  if(!(width>0&&height>0&&width<=1024&&height<=1024))throw new RangeError('Invalid preview size');
  if(!target){
   target=new THREE.WebGLRenderTarget(width,height,{depthBuffer:false});
   const hdr=renderer.capabilities.isWebGL2?renderer.extensions.has('EXT_color_buffer_float'):renderer.extensions.has('EXT_color_buffer_half_float');
   // shortcut: older GPUs use LDR previews; calibrate highlights if their output clips.
   linear=new THREE.WebGLRenderTarget(width,height,{type:hdr?THREE.HalfFloatType:THREE.UnsignedByteType,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter});linear.texture.colorSpace=THREE.LinearSRGBColorSpace;
   outputMaterial=new THREE.RawShaderMaterial({depthTest:false,depthWrite:false,blending:THREE.NoBlending,toneMapped:false,
    uniforms:{image:{value:linear.texture},toneMappingExposure:{value:renderer.toneMappingExposure}},
    vertexShader:'precision highp float;attribute vec3 position;attribute vec2 uv;varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:'precision highp float;uniform sampler2D image;varying vec2 vUv;\n#include <tonemapping_pars_fragment>\n#include <colorspace_pars_fragment>\nvoid main(){vec4 c=texture2D(image,vUv);gl_FragColor=sRGBTransferOETF(vec4(ACESFilmicToneMapping(c.rgb),c.a));}'});
   outputGeometry=new THREE.PlaneGeometry(2,2);outputScene=new THREE.Scene();outputScene.add(new THREE.Mesh(outputGeometry,outputMaterial));
  } else if(target.width!==width||target.height!==height){target.setSize(width,height);linear.setSize(width,height);}
  const previous=renderer.getRenderTarget(),viewport=renderer.getViewport(new THREE.Vector4()),scissor=renderer.getScissor(new THREE.Vector4()),test=renderer.getScissorTest();
  const color=renderer.getClearColor(new THREE.Color()),alpha=renderer.getClearAlpha(),auto=renderer.autoClear;
  const pixels=new Uint8Array(width*height*4);
  try {
   // setRenderTarget uses physical pixels; setViewport would apply screen DPR a second time.
   renderer.setRenderTarget(linear);renderer.setScissorTest(false);renderer.setClearColor(0x000000,0);renderer.autoClear=true;
   renderer.render(scene,camera);
   outputMaterial.uniforms.toneMappingExposure.value=renderer.toneMappingExposure;
   renderer.setRenderTarget(target);renderer.render(outputScene,outputCamera);renderer.readRenderTargetPixels(target,0,0,width,height,pixels);
  } finally {
   renderer.setRenderTarget(previous);renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(test);renderer.setClearColor(color,alpha);renderer.autoClear=auto;
  }
  const context=canvas.getContext('2d');if(!context)throw new Error('Canvas unavailable');
  const image=context.createImageData(width,height);
  for(let y=0;y<height;y++)image.data.set(pixels.subarray((height-1-y)*width*4,(height-y)*width*4),y*width*4);
  context.putImageData(image,0,0);return canvas;
 }
 async function captureExhibit(index,signal,angle=0) {
  abort(signal);
  if(!Number.isInteger(index)||!exhibits[index]||![0,Math.PI/2].includes(angle))throw new RangeError('Invalid comparison selection');
  let owned=null;
  try {
   const current=index===getIndex()?getModel():null;
   const object=current?current.clone(true):(owned=await loadExhibit(exhibits[index].url,signal));
   abort(signal);
   const scene=new THREE.Scene(),group=new THREE.Group();group.add(object);group.rotation.y=angle;scene.add(group);scene.updateMatrixWorld(true);
   const box=new THREE.Box3().setFromObject(group,true),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
   if(![size.x,size.y,size.z].every(Number.isFinite)||size.y<=0)throw new Error('Invalid comparison geometry');
   const scale=1.8/size.y;group.scale.setScalar(scale);group.position.copy(center).multiplyScalar(-scale);
   scene.add(new THREE.HemisphereLight(0xffffff,0x455675,2.2));
   const key=new THREE.DirectionalLight(0xffffff,3);key.position.set(3,4,5);scene.add(key);
   const fill=new THREE.DirectionalLight(0xc8dcff,1.2);fill.position.set(-3,1,-2);scene.add(fill);
   const canvas=document.createElement('canvas');canvas.width=480;canvas.height=600;
   const halfHeight=1.08,halfWidth=halfHeight*canvas.width/canvas.height;
   const camera=new THREE.OrthographicCamera(-halfWidth,halfWidth,halfHeight,-halfHeight,.05,30);
   camera.position.set(0,0,5);camera.lookAt(0,0,0);camera.updateMatrixWorld();
   abort(signal);return renderPreview(scene,camera,canvas);
  } finally {if(owned)disposeExhibit(owned);}
 }
 return {renderPreview,captureExhibit,dispose(){disposed=true;target?.dispose();linear?.dispose();outputMaterial?.dispose();outputGeometry?.dispose();target=linear=outputScene=outputMaterial=outputGeometry=null;}};
}
