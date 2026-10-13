import {createUI} from './ui.js';
import {exhibits} from './exhibits.js';
import {createGallery} from './gallery.js';

// Enhancements share the existing animation loop and never change the porcelain renderer settings.
export function createExperience({THREE,scene,renderer,camera,controls,renderMuseum,isDesktop,hideInfo,restoreInfo,loadExhibit,disposeExhibit,onExhibitChange}) {
 const lifetime=new AbortController(),cleanup=[];
 const listen=(node,type,handler,options={})=>node.addEventListener(type,handler,{...options,signal:lifetime.signal});
 function dispose(){lifetime.abort();cleanup.reverse().forEach(fn=>{try{fn();}catch(error){console.warn('Museum enhancement cleanup:',error);}});cleanup.length=0;}
 try {
 let model=null,anchors=null,intro=null,introCancelled=false,time=0,meteorAt=10,meteorStart=-1,pausedEffects=false,gallery=null,exhibitIndex=0;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const dummy=new THREE.Object3D(),tmp=new THREE.Vector3(),tmpNormal=new THREE.Vector3();
 const ui=createUI({controls,hideInfo,restoreInfo,cancelIntro,capture,unwrap,switchExhibit:direction=>gallery?.step(direction)});
 cleanup.push(()=>ui.dispose(),()=>{if(intro){camera.position.copy(initialPosition);controls.target.copy(initialTarget);controls.update(0);}cancelIntro();});
 // Let OrbitControls receive every pointer. Activate a hotspot only after a stationary single-pointer tap.
 const tapPointers=new Map();let multiplePointers=false,pendingHotspot=null;
 // OrbitControls reconnects a remaining finger with synthetic events. That is not a new tap.
 listen(renderer.domElement,'pointerdown',e=>{if(!e.isTrusted)return;pendingHotspot=null;if(tapPointers.size===0)multiplePointers=false;tapPointers.set(e.pointerId,{x:e.clientX,y:e.clientY,moved:false});if(tapPointers.size>1)multiplePointers=true;});
 listen(renderer.domElement,'pointermove',e=>{const p=tapPointers.get(e.pointerId);if(p&&Math.hypot(e.clientX-p.x,e.clientY-p.y)>7)p.moved=true;});
 listen(renderer.domElement,'pointercancel',e=>{tapPointers.delete(e.pointerId);multiplePointers=true;pendingHotspot=null;});
 listen(renderer.domElement,'pointerup',e=>{const p=tapPointers.get(e.pointerId);tapPointers.delete(e.pointerId);if(!p||p.moved||multiplePointers||e.button!==0||!ui.hotspotsOn||ui.panel)return;
  pendingHotspot=ui.buttons.find(b=>{if(b.hidden)return false;const r=b.getBoundingClientRect();return e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom;});
 });
 // Open on the completed native click; opening during pointerup can retarget a touch's
 // following compatibility click to the dialog backdrop and immediately close it.
 listen(renderer.domElement,'click',()=>{const button=pendingHotspot;pendingHotspot=null;if(button&&!button.hidden&&ui.hotspotsOn&&!ui.panel)button.click();});
 const initialPosition=controls.position0.clone(),initialTarget=controls.target0.clone();
 gallery=createGallery({THREE,renderer,scene,camera,controls,loadExhibit,disposeExhibit,getModel:()=>model,commit:ready,ui,cancelIntro,hideInfo,restoreInfo});
 cleanup.push(()=>gallery.dispose());
 function cancelIntro(){
  introCancelled=true;finishIntro();gallery?.cancel();
 }
 function finishIntro(){if(!intro)return;controls.enableDamping=intro.damping;controls.autoRotate=intro.auto;if(!intro.infoHidden)restoreInfo();intro=null;document.body.classList.remove('museum-opening');}
 listen(renderer.domElement,'pointerdown',cancelIntro,{capture:true});listen(renderer.domElement,'wheel',cancelIntro,{capture:true,passive:true});
 listen(document.getElementById('resetViewBtn'),'click',cancelIntro,{capture:true});
 listen(document,'visibilitychange',()=>{if(document.hidden)cancelIntro();});
 listen(document,'keydown',e=>{if(e.key==='Escape')cancelIntro();});
 controls.addEventListener('start',cancelIntro);
 const onControlsEnd=()=>{if(ui.panel)controls.autoRotate=false;};controls.addEventListener('end',onControlsEnd);
 cleanup.push(()=>{controls.removeEventListener('start',cancelIntro);controls.removeEventListener('end',onControlsEnd);});
 function prepareIntro(){
  if(introCancelled||(reduced.matches&&!window.museumLoading.desktopIntro))return;
  intro={elapsed:0,running:false,damping:controls.enableDamping,auto:controls.autoRotate,infoHidden:document.getElementById('infoBox').classList.contains('hide'),start:initialPosition.clone().sub(initialTarget).multiplyScalar(6.5).add(initialTarget)};
  controls.autoRotate=false;controls.enableDamping=false;controls.update(0);controls.target.copy(initialTarget);camera.position.copy(intro.start);controls.update(0);hideInfo();document.body.classList.add('museum-opening');
 }
 function startIntro(){if(intro){intro.running=true;intro.startAt=performance.now();}}
 const atlas=document.createElement('canvas');atlas.width=384;atlas.height=128;
 const ctx=atlas.getContext('2d');ctx.strokeStyle='#91b8ff';ctx.lineWidth=2.5;ctx.lineCap='round';
 // Original vector flourishes, not reproductions of the model's decoration.
 ctx.beginPath();ctx.moveTo(20,92);ctx.bezierCurveTo(110,83,89,17,55,32);ctx.bezierCurveTo(21,42,47,72,68,56);ctx.moveTo(50,75);ctx.bezierCurveTo(24,61,30,45,47,53);ctx.stroke();
 ctx.save();ctx.translate(192,64);ctx.beginPath();for(let i=0;i<6;i++){ctx.rotate(Math.PI/3);ctx.moveTo(0,0);ctx.bezierCurveTo(-20,-45,20,-45,0,0);}ctx.stroke();ctx.beginPath();ctx.arc(0,0,7,0,Math.PI*2);ctx.stroke();ctx.restore();
 ctx.beginPath();ctx.moveTo(282,78);ctx.bezierCurveTo(271,59,289,46,302,59);ctx.bezierCurveTo(306,34,335,36,337,57);ctx.bezierCurveTo(355,40,376,63,360,78);ctx.lineTo(282,78);ctx.stroke();
 const texture=new THREE.CanvasTexture(atlas);texture.colorSpace=THREE.SRGBColorSpace;
 cleanup.push(()=>texture.dispose());
 const geometry=new THREE.PlaneGeometry(1,1);const uv=geometry.attributes.uv;
 cleanup.push(()=>geometry.dispose());
 // Shared atlas index per instance, preserving a single draw call.
 const indices=new Float32Array(20);for(let i=0;i<20;i++)indices[i]=i%3;
 geometry.setAttribute('motifIndex',new THREE.InstancedBufferAttribute(indices,1));
 const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,opacity:.24,depthWrite:false,fog:false,toneMapped:false});
 cleanup.push(()=>material.dispose());
 material.onBeforeCompile=shader=>{
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float motifIndex;').replace('#include <uv_vertex>','#include <uv_vertex>\n#ifdef USE_MAP\nvMapUv.x = (vMapUv.x + motifIndex) / 3.0;\n#endif');
 };
 material.customProgramCacheKey=()=> 'museum-motif-atlas-v1';
 const motifs=new THREE.InstancedMesh(geometry,material,20);motifs.name='museum-motifs';motifs.frustumCulled=false;motifs.count=isDesktop()?20:8;scene.add(motifs);
 cleanup.push(()=>{scene.remove(motifs);motifs.dispose();});
 const seedData=Array.from({length:20},(_,i)=>({x:(i%2?1:-1)*(2.5+(i*1.31%7)),y:-3+(i*1.67%9),z:-9-(i*1.13%8),size:.22+(i%3)*.08,phase:i*1.6}));
 const meteorGeometry=new THREE.BufferGeometry();meteorGeometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(6),3));
 cleanup.push(()=>meteorGeometry.dispose());
 const meteorMaterial=new THREE.LineBasicMaterial({color:0xc0daff,transparent:true,opacity:0,depthWrite:false,fog:false,toneMapped:false});
 cleanup.push(()=>meteorMaterial.dispose());
 const meteor=new THREE.Line(meteorGeometry,meteorMaterial);meteor.name='museum-meteor';meteor.visible=false;meteor.frustumCulled=false;scene.add(meteor);
 cleanup.push(()=>scene.remove(meteor));
 let heavySamples=0,sampleFrames=0,effectsTier=0;
 function setReduced(){if(reduced.matches&&!window.museumLoading.desktopIntro)cancelIntro();motifs.visible=!reduced.matches&&!pausedEffects;meteor.visible=false;}
 listen(reduced,'change',setReduced);setReduced();
 function ready(exhibit,index=0){
  ui.setExhibit(index);model=exhibit;exhibitIndex=index;anchors=null;pendingHotspot=null;
  onExhibitChange(exhibit);
 }
 function locateHotspots(){
  model.updateWorldMatrix(true,true);const box=new THREE.Box3().setFromObject(model),center=box.getCenter(new THREE.Vector3()),height=box.max.y-box.min.y;
  anchors=exhibits[exhibitIndex].hotspots.map(h=>{
   let best=null,score=Infinity;
   model.traverse(mesh=>{if(!mesh.isMesh)return;const p=mesh.geometry.attributes.position,n=mesh.geometry.attributes.normal;if(!n)return;
    const nm=new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
    const stride=exhibitIndex===0?1:Math.max(1,Math.ceil(p.count/5000));
    for(let i=0;i<p.count;i+=stride){
     tmp.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);tmpNormal.fromBufferAttribute(n,i).applyMatrix3(nm).normalize();
     const radius=Math.hypot(tmp.x-center.x,tmp.z-center.z);if(radius<.04||(tmpNormal.x*(tmp.x-center.x)+tmpNormal.z*(tmp.z-center.z))<.04)continue;
     const angle=Math.atan2(tmp.x-center.x,tmp.z-center.z),level=(tmp.y-box.min.y)/height;
     const cost=Math.abs(level-h.level)*5+Math.abs(Math.atan2(Math.sin(angle-h.angle),Math.cos(angle-h.angle)));
     if(cost<score){score=cost;best={position:tmp.clone(),normal:tmpNormal.clone()};}
    }
   });return best;
  });
 }
 function update(delta){
  time+=delta;
  gallery.update();
  if(intro?.running){intro.elapsed=(performance.now()-intro.startAt)/1000;const p=Math.min(1,intro.elapsed/2.6),ease=p*p*(3-2*p);camera.position.lerpVectors(intro.start,initialPosition,ease);camera.position.x-=3*Math.sin(Math.PI*ease);camera.position.y+=1.5*Math.sin(Math.PI*ease);controls.target.copy(initialTarget);}
  if(ui.panel)controls.autoRotate=false;
  if(time>5&&!reduced.matches&&!pausedEffects){sampleFrames++;if(delta>.04)heavySamples++;
   if(sampleFrames>=90){if(heavySamples>60){effectsTier=Math.min(2,effectsTier+1);}sampleFrames=heavySamples=0;}}
  motifs.count=effectsTier===2?0:Math.ceil((isDesktop()?20:8)/(effectsTier+1));motifs.visible=!reduced.matches&&!pausedEffects&&motifs.count>0;
  if(motifs.visible){seedData.slice(0,motifs.count).forEach((p,i)=>{dummy.position.set(p.x+Math.sin(time*.08+p.phase)*.4,p.y+Math.sin(time*.12+p.phase)*.3,p.z);dummy.quaternion.copy(camera.quaternion);dummy.rotateZ(Math.sin(time*.05+p.phase)*.3);dummy.scale.setScalar(p.size);dummy.updateMatrix();motifs.setMatrixAt(i,dummy.matrix);});motifs.instanceMatrix.needsUpdate=true;}
  if(time>=meteorAt&&!reduced.matches&&!pausedEffects&&effectsTier===0){meteorStart=time;meteorAt=time+8+Math.random()*7;}
  const age=time-meteorStart;meteor.visible=meteorStart>=0&&age<1.2&&!reduced.matches&&!pausedEffects&&effectsTier===0;
  if(meteor.visible){const p=meteorGeometry.attributes.position;p.setXYZ(0,-7+age*8,6-age*3,-16);p.setXYZ(1,-8+age*8,6.4-age*3,-16);p.needsUpdate=true;meteorMaterial.opacity=.55*Math.sin(age/1.2*Math.PI);}
 }
 function updateHotspots(){
  if(intro?.elapsed>=2.6)finishIntro();
  if(!ui.hotspotsOn||!model)return;camera.updateMatrixWorld();
  if(!anchors)locateHotspots();
  const info=document.getElementById('infoBox'),r=info.getBoundingClientRect();
  ui.buttons.forEach((button,i)=>{
   const a=anchors[i];if(!a){button.hidden=true;return;}
   const front=a.normal.dot(tmp.copy(camera.position).sub(a.position).normalize())>.18;
   tmp.copy(a.position).project(camera);const x=(tmp.x*.5+.5)*innerWidth,y=(-tmp.y*.5+.5)*innerHeight;
   const overInfo=!info.classList.contains('hide')&&x>r.left-22&&x<r.right+22&&y>r.top-22&&y<r.bottom+22;
   button.hidden=!front||overInfo||tmp.z>=1||tmp.z<=-1||x<25||x>innerWidth-25||y<150||y>innerHeight-28;
   if(!button.hidden){button.style.left=`${x}px`;button.style.top=`${y}px`;const label=button.querySelector('span');label.style.left=x>innerWidth-170?'auto':'38px';label.style.right=x>innerWidth-170?'38px':'auto';}
  });
 }
 function capture(){
  // WebGL's default drawing buffer is captured synchronously after the complete mist composition.
  renderMuseum();const canvas=document.createElement('canvas');canvas.width=renderer.domElement.width;canvas.height=renderer.domElement.height;
  canvas.getContext('2d').drawImage(renderer.domElement,0,0);return canvas;
 }
 function unwrap(){
  if(!model)throw new Error('Model not ready');model.updateWorldMatrix(true,true);
  const box=new THREE.Box3().setFromObject(model),center=box.getCenter(new THREE.Vector3()),height=box.max.y-box.min.y;
  const flatScene=new THREE.Scene();flatScene.background=new THREE.Color(0xeef0ec);const disposable=[];
  model.traverse(mesh=>{if(!mesh.isMesh||!mesh.material.map)return;
   const original=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();const pos=original.attributes.position,uv=original.attributes.uv,norm=original.attributes.normal;if(!uv||!norm){original.dispose();return;}
   const outPos=[],outUV=[],pts=[new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()],normal=new THREE.Vector3(),nm=new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
   for(let i=0;i<pos.count;i+=3){
    const angles=[];let radial=0;
    for(let j=0;j<3;j++){pts[j].fromBufferAttribute(pos,i+j).applyMatrix4(mesh.matrixWorld);normal.fromBufferAttribute(norm,i+j).applyMatrix3(nm);radial+=normal.x*(pts[j].x-center.x)+normal.z*(pts[j].z-center.z);angles.push(Math.atan2(pts[j].x-center.x,pts[j].z-center.z));}
    if(radial<=.015)continue;
    if(Math.max(...angles)-Math.min(...angles)>Math.PI)for(let j=0;j<3;j++)if(angles[j]<0)angles[j]+=Math.PI*2;
    for(const shift of [0,-Math.PI*2]){
     for(let j=0;j<3;j++){outPos.push(angles[j]+shift,(pts[j].y-box.min.y)/height*3,0);outUV.push(uv.getX(i+j),uv.getY(i+j));}
    }
   }
   original.dispose();const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(outPos,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(outUV,2));
   const mat=new THREE.MeshBasicMaterial({map:mesh.material.map,side:THREE.DoubleSide,toneMapped:false});flatScene.add(new THREE.Mesh(geo,mat));disposable.push(geo,mat);
  });
  const target=new THREE.WebGLRenderTarget(1536,768);target.texture.colorSpace=THREE.SRGBColorSpace;
  const flatCamera=new THREE.OrthographicCamera(-Math.PI,Math.PI,3,0,.1,10);flatCamera.position.z=2;
  const oldTarget=renderer.getRenderTarget(),oldAuto=renderer.autoClear,oldColor=renderer.getClearColor(new THREE.Color()),oldAlpha=renderer.getClearAlpha();
  const pixels=new Uint8Array(1536*768*4);
  try{renderer.setRenderTarget(target);renderer.autoClear=true;renderer.render(flatScene,flatCamera);renderer.readRenderTargetPixels(target,0,0,1536,768,pixels);}
  finally{renderer.setRenderTarget(oldTarget);renderer.autoClear=oldAuto;renderer.setClearColor(oldColor,oldAlpha);target.dispose();disposable.forEach(resource=>resource.dispose());}
  const canvas=document.createElement('canvas');canvas.width=1536;canvas.height=768;const context=canvas.getContext('2d'),image=context.createImageData(1536,768);
  for(let y=0;y<768;y++)image.data.set(pixels.subarray((767-y)*1536*4,(768-y)*1536*4),y*1536*4);context.putImageData(image,0,0);return canvas;
 }
 const api={...ui,ready,prepareIntro,startIntro,update,afterControls:updateHotspots,cancelIntro,capture,unwrap,dispose,
  get introActive(){return !!intro;},get panel(){return ui.panel;},get hotspotsOn(){return ui.hotspotsOn;},get language(){return ui.language;},get effectsTier(){return effectsTier;},
  pauseEffects(value=true){pausedEffects=value;setReduced();}
 };
 return api;
 } catch(error) {dispose();throw error;}
}
