import {createStarfieldCore} from './starfield-core.js';

// The distant view borrows the same ray tracer at a small, bounded offscreen size.
export function createStarfieldBackground({THREE,scene,renderer,camera,legacy,isDesktop}) {
 const observer=new THREE.PerspectiveCamera(50,2,.01,200),direction=new THREE.Vector3();
 const mobile=!isDesktop(),width=mobile?256:480,height=width/2;
 let core,target,geometry,material,mesh,disposed=false,time=0,next=0;
 const originalVisible=legacy.visible;
 function dispose(){
  if(disposed)return;disposed=true;legacy.visible=originalVisible;
  if(mesh)scene.remove(mesh);
  let failed=false,failure;
  for(const resource of [core,target,geometry,material])try{resource?.dispose();}catch(error){if(!failed){failed=true;failure=error;}}
  if(failed)throw failure;
 }
 function update(delta){
  if(disposed)return;
  time+=Math.min(.1,Math.max(0,delta));
  mesh.position.copy(legacy.position);mesh.scale.copy(legacy.scale);mesh.quaternion.copy(camera.quaternion);
  if(time<next)return;
  // A changing observer direction gives the disk and lens a shared world orientation.
  direction.copy(camera.position).sub(legacy.position).normalize().applyAxisAngle(THREE.Object3D.DEFAULT_UP,.20);
  direction.y+=.20;direction.normalize();observer.position.copy(direction).multiplyScalar(22);observer.lookAt(0,0,0);
  core.render(time,undefined,target);next=time+(mobile?.25:.125);
  mesh.visible=true;legacy.visible=false;
 }
 try{
  core=createStarfieldCore({THREE,renderer,camera:observer,isMobile:true});
  Object.assign(core.params,{steps:mobile?400:500,checker:false,stars:0,nebula:0,outer:8,temp:10000,bright:3.6,exposure:1.15,bloom:.24,autoRotate:false});core.sync();core.resize(width,height);
  target=new THREE.WebGLRenderTarget(width,height,{depthBuffer:false});
  geometry=new THREE.PlaneGeometry(15,7.5);
  material=new THREE.ShaderMaterial({uniforms:{image:{value:target.texture}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`
   uniform sampler2D image;varying vec2 vUv;
   void main(){
    vec3 color=texture2D(image,vUv).rgb;
    float light=max(color.r,max(color.g,color.b));
    color=light*mix(vec3(.22,.45,.85),vec3(.85,.95,1.),smoothstep(.2,1.,light));
    float horizon=1.-smoothstep(.105,.13,length((vUv-.5)*vec2(2.,1.)));
    float alpha=max(horizon,smoothstep(.005,.10,light));
    alpha*=smoothstep(0.,.04,min(min(vUv.x,1.-vUv.x),min(vUv.y,1.-vUv.y)));
    if(alpha<.002)discard;
    // The ray-tracer output already contains ACES and sRGB; do not map it twice.
    gl_FragColor=vec4(color,alpha);
   }`,transparent:true,depthWrite:false,depthTest:true,toneMapped:false,fog:false});
  mesh=new THREE.Mesh(geometry,material);mesh.name='museum-starfield-background';mesh.frustumCulled=false;mesh.visible=false;scene.add(mesh);
  update(0);
 }catch(error){try{dispose();}catch{}throw error;}
 return {update,dispose};
}
