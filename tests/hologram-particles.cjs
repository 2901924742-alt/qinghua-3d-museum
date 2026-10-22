const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{pathToFileURL}=require('node:url');
const file=path.resolve(__dirname,'../enhancements/gesture-particles.js');
const source=fs.readFileSync(file,'utf8').replaceAll('export function ','function ').replaceAll('import.meta.url',JSON.stringify(pathToFileURL(file).href));
const handCode=source.slice(source.indexOf('function handResult('),source.indexOf('function startCamera('));
for(const landmarks of [null,Array.from({length:21},()=>({x:0,y:0}))]){
 const target={x:.2,y:.7,pinch:1};vm.runInNewContext(handCode+';handResult(landmarks,320,240);',{target,landmarks,status(){},setPointer(){}});assert.deepEqual(target,{x:.2,y:.7,pinch:0},'Lost or invalid tracking releases the pinch without moving the hologram');
}
(async()=>{
 const THREE=await import(pathToFileURL(path.resolve(__dirname,'../vendor/three.module.js')).href);
 let reads=0,reduced=false,desktop=true,resolvePermission,stops=0,failImage=false,warnings=0;
 const document=new EventTarget();document.hidden=false;document.getElementById=()=>null;
 document.createElement=type=>{assert.equal(type,'canvas');return {width:2,height:2,getContext(){return {drawImage(){if(failImage)throw new DOMException('Cannot read this image','SecurityError');},getImageData(){reads++;return {data:new Uint8ClampedArray([0,0,255,255,255,255,255,255,255,0,0,255,0,255,0,255])};}};}};};
 const context={THREE,document,console:{...console,warn(){warnings++;}},performance,DOMException,setTimeout,clearTimeout,URL,matchMedia:()=>({get matches(){return reduced;}}),Worker:function(){throw Error('Inference must not start before camera permission');},OffscreenCanvas:function(){},createImageBitmap(){},navigator:{mediaDevices:{getUserMedia(){return new Promise(resolve=>resolvePermission=resolve);}}}};
 vm.createContext(context);vm.runInContext(source+';globalThis.api={sampleExhibit,createGestureParticles};',context);
 const {sampleExhibit,createGestureParticles}=context.api;
 function model(){
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([-1,-1,0,1,-1,0,0,1,0],3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute([.25,.25,.25,.25,.25,.25],2));
  const texture=new THREE.Texture({width:2,height:2});texture.colorSpace=THREE.SRGBColorSpace;texture.flipY=false;
  const material=new THREE.MeshStandardMaterial({map:texture});const group=new THREE.Group();group.add(new THREE.Mesh(geometry,material));return group;
 }
 const first=model(),unchanged=Array.from(first.children[0].geometry.attributes.position.array),one=sampleExhibit(THREE,first,200),two=sampleExhibit(THREE,first,200);
 assert.deepEqual(one.positions,two.positions,'Sampling is stable across re-entry');assert(Array.from(one.positions).every(Number.isFinite));assert(Array.from(one.normals).every(Number.isFinite));assert.equal(one.textureAvailable,true);
 for(let i=0;i<200;i++){assert.equal(one.colors[i*3],0);assert.equal(one.colors[i*3+1],0);assert.equal(one.colors[i*3+2],1,'UV reads blue texel instead of substituting a palette');}
 first.children[0].material.map.flipY=true;const flipped=sampleExhibit(THREE,first,3);assert.equal(flipped.colors[0],1);assert.equal(flipped.colors[2],0,'Texture flipY is respected');first.children[0].material.map.flipY=false;
 const interior=new THREE.Mesh(new THREE.BoxGeometry(100,100,100),new THREE.MeshBasicMaterial());interior.name='museum-display-interior-original';first.add(interior);
 assert.deepEqual(sampleExhibit(THREE,first,200).positions,one.positions,'Added reconstruction cannot distort the original sampled silhouette');
 assert.deepEqual(Array.from(first.children[0].geometry.attributes.position.array),unchanged,'Source mesh remains unchanged');
 failImage=true;const fallback=sampleExhibit(THREE,first,20);failImage=false;assert.equal(fallback.textureAvailable,false);assert.equal(warnings,1,'Unreadable image is caught once per map');assert(Array.from(fallback.colors).every(value=>value===1),'Unreadable images retain the source material color');
 assert.throws(()=>sampleExhibit(THREE,new THREE.Group(),10),/no surface/);assert.throws(()=>sampleExhibit(THREE,null,10),/No exhibit/);
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(45,390/844,.1,100);camera.position.set(0,.8,5);camera.lookAt(0,0,0);camera.updateMatrixWorld();
 let currentModel=first;const cameraPosition=camera.position.clone(),cameraQuaternion=camera.quaternion.clone(),states=[];
 const viewport={width:390,height:844,top:0};
 const effect=createGestureParticles({THREE,scene,camera,renderer:{domElement:{getBoundingClientRect:()=>viewport},getPixelRatio:()=>2},isDesktop:()=>desktop,getModel:()=>currentModel,onStatus:s=>states.push(s.state)});
 const group=scene.getObjectByName('museum-gesture-hologram'),points=scene.getObjectByName('museum-gesture-vessel'),line=group.children[0].children.find(object=>object.isLineSegments),trail=group.children[0].children.find(object=>object.isPoints&&object!==points);
 const resources=[];group.traverse(o=>{if(o.geometry)resources.push(o.geometry);if(o.material)resources.push(o.material);});const disposed=new Map(resources.map(r=>[r,0]));resources.forEach(r=>r.addEventListener('dispose',()=>disposed.set(r,disposed.get(r)+1)));
 assert.equal(group.visible,false);assert.equal(resources.length,8);effect.setEnabled(true);assert.equal(first.visible,false);assert.equal(points.geometry.attributes.position.count,12000);assert.equal(reads,5);
 const cached=points.geometry.attributes.position.array,beforeReads=reads;
 for(let i=0;i<160;i++)effect.update(1/60);assert.equal(points.material.uniforms.scan.value,1.2,'Bottom-to-top scan completes');
 effect.setPointer(.8,.3,1);for(let i=0;i<40;i++)effect.update(1/60);assert(points.material.uniforms.charge.value>.9);
 effect.setPointer(.2,.6,0);effect.update(1/60);assert.equal(line.material.uniforms.release.value,0,'Releasing a charge emits one light ring');
 for(let i=0;i<65;i++)effect.update(1/60);assert(points.material.uniforms.spread.value>.7,'Release opens the spatial pattern');
 for(let i=0;i<180;i++)effect.update(1/60);assert.equal(points.material.uniforms.spread.value,0,'Pattern returns to the vessel');
 effect.setPointer(.5,.5,1);for(let i=0;i<40;i++)effect.update(1/60);effect.stopCamera();for(let i=0;i<250;i++)effect.update(1/60);assert(points.material.uniforms.charge.value<.01);assert.equal(points.material.uniforms.spread.value,0,'Stopping camera cannot leave a charged or spread vessel');
 assert(camera.position.equals(cameraPosition)&&camera.quaternion.equals(cameraQuaternion),'Hologram never rewrites the viewing camera');
 assert(Array.from(trail.geometry.attributes.position.array).every(Number.isFinite));
 desktop=false;effect.update(0);assert.equal(points.geometry.drawRange.count,6000,'Resizing to mobile bounds transparency load');
 reduced=true;effect.update(1/60);assert.equal(trail.visible,false);assert.equal(line.material.uniforms.release.value,-1);assert.equal(points.material.uniforms.reduced.value,1);reduced=false;
 for(const view of [{width:320,height:568,dockTop:320},{width:844,height:390,dockTop:191}]){
  Object.assign(viewport,view);camera.aspect=view.width/view.height;camera.updateProjectionMatrix();document.getElementById=()=>({hidden:false,getBoundingClientRect:()=>({top:view.dockTop})});effect.update(0);group.updateMatrixWorld(true);
  const v=new THREE.Vector3(),position=points.geometry.attributes.position;for(let i=0;i<position.count;i+=20){v.fromBufferAttribute(position,i).applyMatrix4(points.matrixWorld).project(camera);assert((-v.y*.5+.5)*view.height<view.dockTop-6,'A short-screen dock cannot cover the formed vessel');}
 }
 Object.assign(viewport,{width:390,height:844});camera.aspect=390/844;camera.updateProjectionMatrix();document.getElementById=()=>null;
 effect.setEnabled(false);assert.equal(first.visible,true);assert.equal(group.visible,false);effect.setEnabled(true);assert.equal(reads,beforeReads,'Re-entry reuses surface and texture samples');assert.equal(points.geometry.attributes.position.array,cached);
 const pending=effect.startCamera();effect.setEnabled(false);resolvePermission({getTracks:()=>[{stop(){stops++;}}]});await pending;assert.equal(stops,1,'Late camera permission cannot leave an active track');assert.equal(effect.cameraActive,false);
 currentModel=model();currentModel.visible=false;effect.setEnabled(true);assert.notEqual(points.geometry.attributes.position.array,cached,'Another exhibit gets its own silhouette');effect.setEnabled(false);assert.equal(currentModel.visible,false,'Exit preserves a previously hidden model');
 effect.dispose();effect.dispose();assert.equal(scene.getObjectByName('museum-gesture-hologram'),undefined);for(const resource of resources)assert.equal(disposed.get(resource),resource===points.geometry?2:1,'Every owned GPU resource is disposed exactly once per allocation');
 console.log('Hologram: UV/flipY color sampling, deterministic geometry, interior exclusion, scan/charge/release/return, bounded mobile points, reduced motion, cache, camera race, source visibility and disposal pass.');
})().catch(error=>{console.error(error);process.exitCode=1;});
