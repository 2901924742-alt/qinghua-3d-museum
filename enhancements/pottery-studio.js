import {createPotteryModel} from './pottery-model.js';

const draftKey='museum-pottery-draft-v1';
const words={
 zh:{title:'虚拟拉坯 · 光场造器',intro:'在轮廓画布中按住并拖动，改变器壁形态；也可选择高度，用滑块或按钮精调。立体预览同步更新。',note:'原创造形 · 艺术模拟。参数为设计比例，不是厘米；不对应馆藏原件，也不模拟真实烧制。',profile:'器形剖轮廓',preview:'白胎与光场',preset:'原创模板',vase:'修长瓶',jar:'丰腹罐',bowl:'敞口碗',band:'调整高度',bands:['底足附近','下腹','腹部','肩部','口沿附近'],radius:'该处半径',narrow:'收窄',widen:'拓宽',undo:'撤销',redo:'重做',reset:'重置此模板',angle:'转动视角',front:'正视',rim:'观察内壁',solid:'白胎釉面',wire:'光场网格',paintShape:'带此器形去绘瓷',saveDesign:'导出设计 JSON',importDesign:'导入设计 JSON',poster:'生成作品 PNG',download:'保存作品 PNG',ready:'拖动轮廓开始造形；静止时预览不会持续刷新。',changed:'器形已更新，可观察内壁或导出作品。',imported:'设计已导入，可继续造形。',importFailed:'设计文件无效或过大，当前作品已保留。',storageNote:'本机仅保存一份造形草稿，不上传。当前浏览器和网址可恢复；清理网站数据后会丢失，请另存设计文件。',draftReady:'编辑后自动保存本机草稿。',draftSaved:'本机造形草稿已保存。',draftRestored:'本机造形草稿已恢复。',draftInvalid:'旧草稿未能恢复，仍保留原记录；开始编辑后才保存新稿。',draftFailed:'本机存储不可用，请导出设计文件保留作品；仍可正常造形。',renderFailed:'三维预览暂不可用；轮廓调整与设计文件导出仍可使用。',posterReady:'作品已生成，可下载或长按图片保存。',posterFailed:'作品图片暂未生成，请重试。',designReady:'设计文件已准备好，请点击保存。',designDownload:'保存设计 JSON',posterTitle:'一器初成 · 我的青花器形',posterFoot:'原创比例设计 / 艺术模拟 · 非文物实测，非真实烧制仿真',posterAlt:'原创器形作品图，包含白胎预览与剖轮廓',units:'设计比例'},
 en:{title:'Shape clay · Light-field studio',intro:'Drag on the profile canvas to shape the vessel. You can also choose a height and use the radius slider or buttons. The 3D preview updates with your edits.',note:'Original shape design · Artistic simulation. Values are relative design units, not centimetres. This is not a museum original or a physical firing simulation.',profile:'Vessel cross-section',preview:'Porcelain and light field',preset:'Original template',vase:'Slender vase',jar:'Full-bodied jar',bowl:'Open bowl',band:'Height to edit',bands:['Near the foot','Lower body','Body','Shoulder','Near the rim'],radius:'Radius here',narrow:'Narrow',widen:'Widen',undo:'Undo',redo:'Redo',reset:'Reset template',angle:'Rotate view',front:'Front',rim:'Inspect interior',solid:'Porcelain glaze',wire:'Light-field grid',paintShape:'Paint this vessel',saveDesign:'Export design JSON',importDesign:'Import design JSON',poster:'Create artwork PNG',download:'Save artwork PNG',ready:'Drag the profile to begin. The preview rests when you stop editing.',changed:'Shape updated. Inspect the interior or export your work.',imported:'Design imported. Continue shaping.',importFailed:'This design is invalid or too large. Your current work is unchanged.',storageNote:'One shape draft stays in this browser at this website, with no upload. Clearing site data removes it. Export the design to keep it.',draftReady:'Your shape draft saves after editing.',draftSaved:'Local shape draft saved.',draftRestored:'Local shape draft restored.',draftInvalid:'The old draft could not be restored and is kept. Only a new edit replaces it.',draftFailed:'Local storage is unavailable. Export the design to keep your work; shaping still works.',renderFailed:'The 3D preview is unavailable. Profile editing and design export still work.',posterReady:'Artwork ready. Download it or hold the image to save.',posterFailed:'The artwork image could not be created. Please retry.',designReady:'Design ready. Choose the save link.',designDownload:'Save design JSON',posterTitle:'A vessel of your own',posterFoot:'Original relative design / artistic simulation. Not a measurement or physical firing model.',posterAlt:'Original vessel artwork with a porcelain preview and profile',units:'relative units'}
};

const sectionWords={
 zh:{section:'横截观察',sectionHeight:'横截高度',sectionNote:'原创网格的横截设计观察 · 相对设计单位 · 艺术可视化，非文物 CT 或实测。',sectionUnavailable:'当前设备暂不支持横截观察，已恢复完整器形；造形、绘瓷和导出仍可使用。'},
 en:{section:'Horizontal section',sectionHeight:'Section height',sectionNote:'Horizontal section of your original design mesh · Relative design units · Artistic visualization, not heritage CT or measurement.',sectionUnavailable:'Section view is unavailable on this device. The complete vessel is restored; shaping, painting and export still work.'}
};

const referenceWords={
 zh:{reference:'参考轮廓',referenceOff:'关闭参考',referenceCurrent:'当前',referenceRatio:'轮廓宽高比',referenceNote:'实线为当前器形，青绿虚线为等比例参考；仅辅助造形，不计分，也不写入作品。',referenceFailed:'参考轮廓暂不可用，当前作品已保留。'},
 en:{reference:'Reference outline',referenceOff:'No reference',referenceCurrent:'Current',referenceRatio:'Outline width / height',referenceNote:'Solid: your vessel. Teal dashes: an equally scaled reference. A shaping guide only; it is not scored or included in your artwork.',referenceFailed:'The reference is unavailable. Your current work is unchanged.'}
};

export function mountPottery(container,{language='zh',THREE,renderPreview,onPaintShape=null}){
 const t={...(words[language]||words.zh),...(sectionWords[language]||sectionWords.zh),...(referenceWords[language]||referenceWords.zh)},root=document.createElement('section'),lifetime=new AbortController();
 root.className='innovation-pottery';root.dataset.testid='potteryStudio';root.dataset.wire='triangles';root.dataset.section='full';root.setAttribute('aria-busy','true');
 root.innerHTML=`<h3>${t.title}</h3><p>${t.intro}</p><p class="innovation-note">${t.note}</p><div class="innovation-toolbar"><label class="innovation-field">${t.preset}<select data-control="preset">${['vase','jar','bowl'].map(kind=>`<option value="${kind}">${t[kind]}</option>`).join('')}</select></label><button type="button" data-action="undo" disabled>${t.undo}</button><button type="button" data-action="redo" disabled>${t.redo}</button><button type="button" data-action="reset">${t.reset}</button></div><div class="innovation-studio-grid"><div class="innovation-canvas-wrap"><h4>${t.profile}</h4><canvas data-testid="potteryProfile" width="512" height="512" aria-label="${t.profile}"></canvas><p class="pottery-readout" aria-live="off"></p></div><div class="innovation-canvas-wrap"><h4>${t.preview}</h4><canvas data-testid="potteryPreview" width="512" height="512" aria-label="${t.preview}"></canvas><div class="innovation-actions"><button type="button" data-mode="solid" aria-pressed="true">${t.solid}</button><button type="button" data-mode="wire" aria-pressed="false">${t.wire}</button><button type="button" data-view="front" aria-pressed="true">${t.front}</button><button type="button" data-view="rim" aria-pressed="false">${t.rim}</button></div><label class="innovation-field">${t.angle}<input data-control="angle" type="range" min="-180" max="180" value="0"></label></div></div><div class="pottery-shape-controls"><label class="innovation-field">${t.band}<select data-control="band">${t.bands.map((name,index)=>`<option value="${index}"${index===2?' selected':''}>${name}</option>`).join('')}</select></label><label class="innovation-field">${t.radius}<input data-control="radius" type="range" min="0.5" max="16" step="0.05" value="5"><output data-value="radius"></output></label><button type="button" data-action="narrow">${t.narrow}</button><button type="button" data-action="widen">${t.widen}</button></div><div class="innovation-actions"><button type="button" data-action="paintShape"${typeof onPaintShape==='function'?'':' hidden'}>${t.paintShape}</button><button type="button" data-action="saveDesign">${t.saveDesign}</button><label class="pottery-file-button">${t.importDesign}<input data-action="importDesign" type="file" accept="application/json,.json"></label><button type="button" data-action="poster">${t.poster}</button><a class="download" data-action="designDownload" hidden>${t.designDownload}</a><a class="download" data-action="download" hidden>${t.download}</a></div><p class="innovation-status" role="status" aria-live="polite">${t.ready}</p><p class="innovation-note">${t.storageNote}</p><p class="pottery-draft-status innovation-note" role="status" aria-live="polite">${t.draftReady}</p><img data-testid="potteryPoster" alt="${t.posterAlt}" hidden>`;
 root.querySelector('.innovation-toolbar').insertAdjacentHTML('afterend',`<div class="pottery-reference-controls"><label class="innovation-field">${t.reference}<select data-control="reference"><option value="off">${t.referenceOff}</option>${['vase','jar','bowl'].map(kind=>`<option value="${kind}">${t[kind]}</option>`).join('')}</select></label><p data-testid="potteryReferenceReadout" class="pottery-reference-readout" hidden></p><p class="innovation-note" data-testid="potteryReferenceNote" hidden>${t.referenceNote}</p></div>`);
 root.querySelector('[data-view="rim"]').insertAdjacentHTML('afterend',`<button type="button" data-view="section" aria-pressed="false">${t.section}</button>`);
 root.querySelector('[data-control="angle"]').closest('label').insertAdjacentHTML('beforebegin',`<div data-testid="potterySectionControls" hidden><label class="innovation-field">${t.sectionHeight}<input data-control="sectionHeight" type="range" min="10" max="90" step="1" value="55"><output data-value="sectionHeight">55%</output></label><p class="innovation-note">${t.sectionNote}</p></div>`);
 container.append(root);
 const $=selector=>root.querySelector(selector),profile=$('[data-testid="potteryProfile"]'),preview=$('[data-testid="potteryPreview"]'),ctx=profile.getContext('2d'),status=$('.innovation-status'),draftStatus=$('.pottery-draft-status'),preset=$('[data-control="preset"]'),radius=$('[data-control="radius"]'),band=$('[data-control="band"]'),angle=$('[data-control="angle"]'),poster=$('[data-action="poster"]'),posterImage=$('[data-testid="potteryPoster"]');
 const sectionButton=$('[data-view="section"]'),sectionControls=$('[data-testid="potterySectionControls"]'),sectionHeight=$('[data-control="sectionHeight"]'),sectionOutput=$('[data-value="sectionHeight"]');
 const reference=$('[data-control="reference"]'),referenceReadout=$('[data-testid="potteryReferenceReadout"]'),references=new Map();let referenceKind='off';
 profile.tabIndex=0;
 const listen=(node,event,fn)=>node.addEventListener(event,(...args)=>{if(!suspended)fn(...args);},{signal:lifetime.signal});
 let active=true,suspended=false,model=null,scene=null,camera=null,mesh=null,material=null,wireMaterial=null,renderTimer=null,saveTimer=null,lastRender=-Infinity,renderFailed=false,draftDirty=false,edit=null,pending=null,rotation=null,mode='solid',view='front',generation=0,importToken=0,pngURL=null,designURL=null;
 let wireAttempted=false,wireTexture=null,wireCanvas=null,section=null,sectionBlocked=false;
 const bands=[.08,.28,.5,.72,.94];let selected=.5,frame=null;
 for(const item of root.querySelectorAll('button,input,select'))item.disabled=true;
 for(const canvas of [profile,preview]){canvas.style.touchAction='none';canvas.style.width='100%';canvas.style.height='auto';}
 const say=text=>{status.textContent=text;};
 function clearExports(){generation++;for(const key of ['download','designDownload']){const link=$(`[data-action="${key}"]`);link.hidden=true;link.removeAttribute('href');}posterImage.hidden=true;posterImage.removeAttribute('src');if(pngURL)URL.revokeObjectURL(pngURL);if(designURL)URL.revokeObjectURL(designURL);pngURL=designURL=null;}
 function updateHistory(p=model.getProfile()){$('[data-action="undo"]').disabled=!p.canUndo;$('[data-action="redo"]').disabled=!p.canRedo;preset.value=p.preset;}
 function flushDraft(){if(saveTimer!==null)clearTimeout(saveTimer);saveTimer=null;if(!draftDirty||!model)return;try{localStorage.setItem(draftKey,model.serialize());draftDirty=false;draftStatus.textContent=t.draftSaved;}catch{draftStatus.textContent=t.draftFailed;}}
 function queueDraft(){if(!active||suspended)return;draftDirty=true;if(saveTimer!==null)clearTimeout(saveTimer);saveTimer=setTimeout(flushDraft,500);}
 function mapping(p,guide=references.get(referenceKind)){
  const ys=p.outer.map(point=>point[1]),minY=Math.min(...ys),height=Math.max(.01,Math.max(...ys)-minY),maxR=Math.max(.1,p.maxR,guide?guide.maxR*height/guide.height:0);
  return {minY,height,scale:Math.min(416/(maxR*2),416/height),cx:256,bottom:464};
 }
 function prepareReference(kind){
  if(kind==='off'||references.has(kind))return;let sample=null;
  try{sample=createPotteryModel({THREE,mobile:matchMedia('(max-width:700px)').matches,preset:kind});const outer=sample.getProfile().outer,minY=outer[0][1],height=outer[outer.length-1][1]-minY,maxR=Math.max(...outer.map(point=>point[0]));references.set(kind,{outer,minY,height,maxR});}
  finally{sample?.dispose();}
 }
 function radiusAt(p,y){for(let i=1;i<p.outer.length;i++){const a=p.outer[i-1],b=p.outer[i];if(y>=Math.min(a[1],b[1])&&y<=Math.max(a[1],b[1])){const f=b[1]===a[1]?0:(y-a[1])/(b[1]-a[1]);return a[0]+(b[0]-a[0])*f;}}return p.outer[0]?.[0]||.5;}
 function point(r,y,map){return [map.cx+r*map.scale,map.bottom-(y-map.minY)*map.scale];}
 function selection(p,map=frame){const y=map.minY+map.height*selected;return {y,r:radiusAt(p,y)};}
 function updateControls(p){const s=selection(p);radius.value=String(Math.max(.5,Math.min(16,s.r)));$('[data-value="radius"]').textContent=s.r.toFixed(2);$('.pottery-readout').textContent=`${t.units} · H ${p.height.toFixed(2)} / R ${p.maxR.toFixed(2)}`;updateHistory(p);}
 function drawProfile(includeReference=true){
  const p=model.getProfile(),guide=includeReference?references.get(referenceKind):null;frame=edit?.map||mapping(p,guide);const map=frame;
  ctx.fillStyle='#071325';ctx.fillRect(0,0,512,512);ctx.lineWidth=1;ctx.strokeStyle='#5b8ebe24';
  for(let x=48;x<=464;x+=32){ctx.beginPath();ctx.moveTo(x,48);ctx.lineTo(x,464);ctx.stroke();}
  for(let y=48;y<=464;y+=32){ctx.beginPath();ctx.moveTo(48,y);ctx.lineTo(464,y);ctx.stroke();}
  ctx.strokeStyle='#82c7ef88';ctx.setLineDash([5,6]);ctx.beginPath();ctx.moveTo(256,32);ctx.lineTo(256,480);ctx.stroke();ctx.setLineDash([]);
  for(const [list,color,lineWidth] of [[p.outer,'#bddfff',3],[p.inner,'#6fa6d0',1.5]])for(const sign of [-1,1]){ctx.strokeStyle=color;ctx.lineWidth=lineWidth;ctx.beginPath();list.forEach(([r,y],i)=>{const q=point(sign*r,y,map);if(i===0)ctx.moveTo(...q);else ctx.lineTo(...q);});ctx.stroke();}
  if(guide){
   const factor=map.height/guide.height;ctx.save();ctx.strokeStyle='#69e5cf';ctx.lineWidth=2;ctx.setLineDash([8,7]);
   for(const sign of [-1,1]){ctx.beginPath();guide.outer.forEach(([r,y],i)=>{const q=point(sign*r*factor,map.minY+(y-guide.minY)*factor,map);if(i===0)ctx.moveTo(...q);else ctx.lineTo(...q);});ctx.stroke();}ctx.restore();
   const height=p.outer[p.outer.length-1][1]-p.outer[0][1],ratio=2*Math.max(...p.outer.map(point=>point[0]))/height;
   referenceReadout.textContent=`${t.referenceRatio} · ${t.referenceCurrent} ${ratio.toFixed(3)} / ${t[referenceKind]} ${(2*guide.maxR/guide.height).toFixed(3)}`;
  }
  referenceReadout.hidden=!guide;$('[data-testid="potteryReferenceNote"]').hidden=!guide;
  const s=selection(p,map),[x,y]=point(s.r,s.y,map);ctx.strokeStyle='#88c9ff77';ctx.setLineDash([6,5]);ctx.beginPath();ctx.moveTo(48,y);ctx.lineTo(464,y);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#d2ecff';ctx.beginPath();ctx.arc(x,y,8,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#58aaff';ctx.lineWidth=3;ctx.beginPath();ctx.arc(x,y,14,0,Math.PI*2);ctx.stroke();
  updateControls(p);
 }
 function applyPending(){if(!pending||!edit)return false;const now=performance.now(),target=pending;pending=null;const changed=model.sculpt(target.r,target.y,Math.max(.016,Math.min(.125,(now-edit.time)/1000)));edit.time=now;if(changed){edit.changed=true;clearExports();queueDraft();return true;}return false;}
 function updateCamera(){const yaw=Number(angle.value)*Math.PI/180,pitch=view==='rim'||view==='section'?.58:.12,distance=7.4;camera.position.set(Math.sin(yaw)*Math.cos(pitch)*distance,Math.sin(pitch)*distance,Math.cos(yaw)*Math.cos(pitch)*distance);camera.lookAt(0,0,0);camera.updateMatrixWorld();}
 function syncView(){for(const button of root.querySelectorAll('[data-view]'))button.setAttribute('aria-pressed',String(button.dataset.view===view));sectionControls.hidden=view!=='section';sectionButton.disabled=sectionBlocked;sectionHeight.disabled=sectionBlocked;root.dataset.section=sectionBlocked?'unavailable':view==='section'&&section?'active':'full';}
 function clearSection(){
  material&&(material.clippingPlanes=null);wireMaterial&&(wireMaterial.clippingPlanes=null);if(material)material.needsUpdate=true;if(wireMaterial)wireMaterial.needsUpdate=true;if(mesh)mesh.renderOrder=0;
  if(!section)return;for(const part of [section.back,section.front,section.cap]){scene.remove(part);part.material.dispose();}section.cap.geometry.dispose();section=null;
 }
 // Adapted from the MIT Three r160 webgl_clipping_stencil example; see vendor/three-clipping.
 // Stencil meshes borrow the real closed pottery geometry. Only their materials and cap are owned here.
 function prepareSection(){
  if(section)return;let backMaterial=null,frontMaterial=null,capMaterial=null,capGeometry=null;
  try{
   const plane=new THREE.Plane(new THREE.Vector3(0,-1,0),0),clips=[plane];
   const base={depthWrite:false,depthTest:false,colorWrite:false,stencilWrite:true,stencilFunc:THREE.AlwaysStencilFunc,clippingPlanes:clips};
   backMaterial=new THREE.MeshBasicMaterial({...base,side:THREE.BackSide,stencilFail:THREE.IncrementWrapStencilOp,stencilZFail:THREE.IncrementWrapStencilOp,stencilZPass:THREE.IncrementWrapStencilOp});
   frontMaterial=new THREE.MeshBasicMaterial({...base,side:THREE.FrontSide,stencilFail:THREE.DecrementWrapStencilOp,stencilZFail:THREE.DecrementWrapStencilOp,stencilZPass:THREE.DecrementWrapStencilOp});
   capMaterial=new THREE.MeshStandardMaterial({color:0x9ccbf0,roughness:.55,metalness:0,stencilWrite:true,stencilRef:0,stencilFunc:THREE.NotEqualStencilFunc,stencilFail:THREE.ReplaceStencilOp,stencilZFail:THREE.ReplaceStencilOp,stencilZPass:THREE.ReplaceStencilOp});
   capGeometry=new THREE.PlaneGeometry(4,4);const back=new THREE.Mesh(model.geometry,backMaterial),front=new THREE.Mesh(model.geometry,frontMaterial),cap=new THREE.Mesh(capGeometry,capMaterial);
   back.name='museum-pottery-section-back';front.name='museum-pottery-section-front';cap.name='museum-pottery-section-cap';back.renderOrder=front.renderOrder=1;cap.renderOrder=1.1;cap.onAfterRender=renderer=>renderer.clearStencil();
   section={plane,back,front,cap};scene.add(back,front,cap);material.clippingPlanes=wireMaterial.clippingPlanes=clips;material.needsUpdate=wireMaterial.needsUpdate=true;mesh.renderOrder=6;
  }catch(error){backMaterial?.dispose();frontMaterial?.dispose();capMaterial?.dispose();capGeometry?.dispose();throw error;}
 }
 function updateSection(box){
  prepareSection();mesh.updateMatrixWorld(true);
  for(const part of [section.back,section.front]){part.position.copy(mesh.position);part.quaternion.copy(mesh.quaternion);part.scale.copy(mesh.scale);}
  const value=Math.max(10,Math.min(90,Number(sectionHeight.value)||55));sectionOutput.textContent=`${value}%`;
  section.plane.set(new THREE.Vector3(0,-1,0),box.min.y+(box.max.y-box.min.y)*value/100).applyMatrix4(mesh.matrixWorld);
  section.plane.coplanarPoint(section.cap.position);section.cap.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),section.plane.normal.clone().negate());
 }
 function prepareWire(){
  if(wireAttempted)return;wireAttempted=true;let tile=null,texture=null;
  try{
   tile=document.createElement('canvas');tile.width=tile.height=64;const draw=tile.getContext('2d');if(!draw)throw new Error('Canvas 2D grid unavailable');
   draw.fillStyle='#05101e';draw.fillRect(0,0,64,64);draw.strokeStyle=matchMedia('(max-width:700px)').matches?'#509cd3':'#3b8bc7';draw.shadowColor='#45b4ff';draw.shadowBlur=5;draw.lineWidth=2.5;draw.strokeRect(0,0,64,64);
   texture=new THREE.CanvasTexture(tile);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(24,32);texture.anisotropy=2;
  }catch(error){texture?.dispose();if(tile)tile.width=tile.height=0;console.warn('Pottery light-field grid unavailable; wireframe remains available:',error);return;}
  wireTexture=texture;wireCanvas=tile;wireMaterial.map=texture;wireMaterial.color.set(0xffffff);wireMaterial.wireframe=false;wireMaterial.side=THREE.FrontSide;wireMaterial.needsUpdate=true;root.dataset.wire='grid';
 }
 function render(){
  renderTimer=null;if(!active||suspended||!model)return;applyPending();drawProfile();lastRender=performance.now();if(renderFailed)return;
  const sliced=view==='section';
  try{const box=model.geometry.boundingBox;mesh.position.y=-(box.min.y+box.max.y)/2;mesh.material=mode==='wire'?wireMaterial:material;if(sliced)updateSection(box);updateCamera();renderPreview(scene,camera,preview,sliced);syncView();}
  catch(error){
   if(sliced){
    const focus=document.activeElement===sectionButton||sectionControls.contains(document.activeElement);sectionBlocked=true;clearSection();view='front';syncView();if(focus)$('[data-view="front"]').focus({preventScroll:true});say(t.sectionUnavailable);console.warn('Pottery section unavailable; complete vessel restored:',error);
    try{updateCamera();renderPreview(scene,camera,preview,false);return;}catch(fallback){error=fallback;}
   }
   renderFailed=true;say(t.renderFailed);console.warn('Pottery preview unavailable:',error);
  }
 }
 function scheduleRender(){if(!active||suspended||renderTimer!==null)return;const delay=Math.max(0,125-(performance.now()-lastRender));if(delay===0)render();else renderTimer=setTimeout(render,delay);}
 function finishEdit(event){if(!edit||event&&event.pointerId!==undefined&&event.pointerId!==edit.id)return;applyPending();const {id,changed}=edit;edit=null;model.endStroke();if(id!==null)try{profile.releasePointerCapture(id);}catch{}if(changed)queueDraft();scheduleRender();updateHistory();}
 function finishRotation(event){if(!rotation||event&&event.pointerId!==undefined&&event.pointerId!==rotation.id)return;const id=rotation.id;rotation=null;try{preview.releasePointerCapture(id);}catch{}}
 function changed(){clearExports();queueDraft();scheduleRender();say(t.changed);}
 function beginBand(){if(edit)return;const p=model.getProfile(),map=mapping(p),s=selection(p,map);model.beginStroke(s.r,s.y);edit={id:null,map,time:performance.now()-100,changed:false};}
 function nudge(delta){finishEdit();const p=model.getProfile(),map=mapping(p),s=selection(p,map);model.beginStroke(s.r,s.y);const edited=model.sculpt(Math.max(.5,Math.min(16,s.r+delta)),s.y,.125);model.endStroke();if(edited)changed();}
 function flushOnLeave(){finishEdit();finishRotation();flushDraft();}
 function suspend(){if(!active||suspended)return;flushOnLeave();suspended=true;generation++;importToken++;if(renderTimer!==null)clearTimeout(renderTimer);renderTimer=null;poster.disabled=false;}
 function resume(){if(!active||!suspended)return;suspended=false;scheduleRender();}
 function dispose(){
  if(!active)return;flushOnLeave();active=false;lifetime.abort();importToken++;clearExports();if(renderTimer!==null)clearTimeout(renderTimer);if(saveTimer!==null)clearTimeout(saveTimer);renderTimer=saveTimer=null;clearSection();material?.dispose();wireMaterial?.dispose();wireTexture?.dispose();if(wireCanvas)wireCanvas.width=wireCanvas.height=0;wireTexture=wireCanvas=null;model?.dispose();references.clear();root.remove();
 }
 try{
  if(!ctx)throw new Error('Canvas 2D unavailable');
  model=createPotteryModel({THREE,mobile:matchMedia('(max-width:700px)').matches,preset:'vase'});
  try{const raw=localStorage.getItem(draftKey);if(raw!==null)draftStatus.textContent=model.restore(raw)?t.draftRestored:t.draftInvalid;}catch{draftStatus.textContent=t.draftFailed;}
  scene=new THREE.Scene();scene.background=new THREE.Color(0x081426);camera=new THREE.PerspectiveCamera(33,1,.1,30);
  scene.add(new THREE.HemisphereLight(0xe4f1ff,0x233b5d,2.2));const key=new THREE.DirectionalLight(0xffffff,2.8);key.position.set(-3,4,5);scene.add(key);const rim=new THREE.DirectionalLight(0x75b5ff,1.8);rim.position.set(3,2,-3);scene.add(rim);
  material=new THREE.MeshPhysicalMaterial({color:0xf7f5eb,roughness:.3,metalness:0,clearcoat:.6,clearcoatRoughness:.2});wireMaterial=new THREE.MeshBasicMaterial({color:0x3b8bc7,wireframe:true});mesh=new THREE.Mesh(model.geometry,material);mesh.name='museum-pottery-vessel';scene.add(mesh);
  for(const item of root.querySelectorAll('button,input,select'))item.disabled=false;root.setAttribute('aria-busy','false');updateHistory();render();
  listen(profile,'pointerdown',event=>{
   if(edit||!event.isPrimary||event.button!==0)return;const rect=profile.getBoundingClientRect(),p=model.getProfile(),map=mapping(p),x=(event.clientX-rect.left)*512/rect.width,y=(event.clientY-rect.top)*512/rect.height,rawY=map.minY+(map.bottom-y)/map.scale;
   if(rawY<map.minY||rawY>map.minY+map.height)return;const r=radiusAt(p,rawY);
   event.preventDefault();selected=Math.max(.02,Math.min(.98,(rawY-map.minY)/map.height));model.beginStroke(r,rawY);edit={id:event.pointerId,map,time:performance.now()-100,side:x<map.cx?-1:1,changed:false,x,y,r,rawY,clientX:event.clientX,clientY:event.clientY};try{profile.setPointerCapture(event.pointerId);}catch{}scheduleRender();
  });
  listen(profile,'pointermove',event=>{if(!edit||event.pointerId!==edit.id)return;if(event.pointerType==='mouse'&&event.buttons!==1){finishEdit(event);return;}if(Math.hypot(event.clientX-edit.clientX,event.clientY-edit.clientY)<3&&!edit.changed)return;event.preventDefault();const rect=profile.getBoundingClientRect(),x=(event.clientX-rect.left)*512/rect.width,y=(event.clientY-rect.top)*512/rect.height,map=edit.map;pending={r:Math.max(.5,Math.min(16,edit.r+(x-edit.x)*edit.side/map.scale)),y:Math.max(map.minY,Math.min(map.minY+map.height,edit.rawY-(y-edit.y)/map.scale))};selected=Math.max(.02,Math.min(.98,(pending.y-map.minY)/map.height));scheduleRender();});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])listen(profile,event,finishEdit);
  listen(radius,'input',()=>{beginBand();const s=selection(model.getProfile(),edit.map);pending={r:Number(radius.value),y:s.y};scheduleRender();});listen(radius,'change',()=>finishEdit());
  listen(band,'change',()=>{finishEdit();selected=bands[Number(band.value)]??.5;scheduleRender();});
  listen($('[data-action="narrow"]'),'click',()=>nudge(-1));listen($('[data-action="widen"]'),'click',()=>nudge(1));
  for(const action of ['undo','redo'])listen($(`[data-action="${action}"]`),'click',()=>{finishEdit();if(model[action]())changed();updateHistory();});
  listen(reference,'change',()=>{finishEdit();try{prepareReference(reference.value);referenceKind=reference.value;drawProfile();if(status.textContent===t.referenceFailed)say(t.ready);}catch(error){reference.value=referenceKind;say(t.referenceFailed);console.warn('Pottery reference unavailable:',error);}});
  listen(preset,'change',()=>{finishEdit();if(model.reset(preset.value))changed();});listen($('[data-action="reset"]'),'click',()=>{finishEdit();if(model.reset(preset.value))changed();});
  for(const button of root.querySelectorAll('[data-mode]'))listen(button,'click',()=>{if(mode===button.dataset.mode)return;mode=button.dataset.mode;if(mode==='wire')prepareWire();for(const item of root.querySelectorAll('[data-mode]'))item.setAttribute('aria-pressed',String(item===button));clearExports();scheduleRender();});
  for(const button of root.querySelectorAll('[data-view]'))listen(button,'click',()=>{if(view===button.dataset.view||button.dataset.view==='section'&&sectionBlocked)return;view=button.dataset.view;if(view!=='section')clearSection();syncView();clearExports();scheduleRender();});
  listen(sectionHeight,'input',()=>{if(view!=='section'||sectionBlocked)return;clearExports();scheduleRender();});
  listen(angle,'input',()=>{clearExports();scheduleRender();});
  listen(preview,'pointerdown',event=>{if(rotation||!event.isPrimary||event.button!==0)return;rotation={id:event.pointerId,x:event.clientX,angle:Number(angle.value)};event.preventDefault();try{preview.setPointerCapture(event.pointerId);}catch{}});
  listen(preview,'pointermove',event=>{if(!rotation||event.pointerId!==rotation.id)return;event.preventDefault();const width=Math.max(1,preview.getBoundingClientRect().width),value=rotation.angle+(event.clientX-rotation.x)*300/width;angle.value=String(((value+180)%360+360)%360-180);clearExports();scheduleRender();});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])listen(preview,event,finishRotation);
  listen(window,'blur',()=>{finishEdit();finishRotation();});listen(window,'pagehide',flushOnLeave);listen(document,'visibilitychange',()=>{if(document.visibilityState==='hidden')flushOnLeave();});
  listen(root,'keydown',event=>{if(!event.ctrlKey&&!event.metaKey||event.target.matches('input,select'))return;const key=event.key.toLowerCase();if(key==='z'||key==='y'){event.preventDefault();$(`[data-action="${key==='y'||event.shiftKey?'redo':'undo'}"]`).click();}});
  listen($('[data-action="saveDesign"]'),'click',()=>{finishEdit();try{const nextURL=URL.createObjectURL(new Blob([model.serialize()],{type:'application/json;charset=utf-8'}));if(designURL)URL.revokeObjectURL(designURL);designURL=nextURL;const link=$('[data-action="designDownload"]');link.href=designURL;link.download='qinghua-original-vessel.json';link.hidden=false;say(t.designReady);}catch{say(t.importFailed);}});
  listen($('[data-action="paintShape"]'),'click',()=>{finishEdit();finishRotation();try{onPaintShape?.(model.serialize());}catch{say(t.importFailed);}});
  listen($('[data-action="importDesign"]'),'change',async event=>{const file=event.target.files?.[0],token=++importToken;event.target.value='';if(!file)return;if(file.size>131072){say(t.importFailed);return;}finishEdit();const revision=generation;try{const text=await file.text();if(!active||token!==importToken||revision!==generation||edit||pending)return;if(model.restore(text)){changed();say(t.imported);}else say(t.importFailed);}catch{if(active&&token===importToken)say(t.importFailed);}});
  listen(poster,'click',async()=>{
   finishEdit();finishRotation();if(renderFailed){say(t.renderFailed);return;}if(renderTimer!==null)clearTimeout(renderTimer);renderTimer=null;render();if(renderFailed){say(t.renderFailed);return;}const token=++generation;poster.disabled=true;
   try{const sheet=document.createElement('canvas');sheet.width=1280;sheet.height=900;const draw=sheet.getContext('2d');if(!draw)throw new Error('Canvas 2D unavailable');draw.fillStyle='#081426';draw.fillRect(0,0,1280,900);draw.strokeStyle='#7eadd7';draw.lineWidth=2;draw.strokeRect(24,24,1232,852);draw.fillStyle='#e8f4ff';draw.font='bold 42px sans-serif';draw.fillText(t.posterTitle,56,92);draw.fillStyle='#9bc7ee';draw.font='21px sans-serif';draw.fillText(view==='section'?t.sectionNote:t.note,56,138,1168);try{drawProfile(false);draw.drawImage(profile,56,198,512,512);}finally{drawProfile();}draw.drawImage(preview,650,198,512,512);draw.font='25px sans-serif';draw.fillText(t.profile,56,764);draw.fillText(view==='section'?t.section:t.preview,650,764);draw.font='18px sans-serif';draw.fillText(t.posterFoot,56,844,1168);
    const blob=await new Promise((resolve,reject)=>sheet.toBlob(value=>value?resolve(value):reject(new Error('PNG encoding failed')),'image/png'));sheet.width=sheet.height=0;if(!active||token!==generation)return;const nextURL=URL.createObjectURL(blob);if(pngURL)URL.revokeObjectURL(pngURL);pngURL=nextURL;const link=$('[data-action="download"]');link.href=pngURL;link.download='qinghua-original-vessel.png';link.hidden=false;posterImage.src=pngURL;posterImage.hidden=false;say(t.posterReady);
   }catch(error){if(active&&token===generation)say(t.posterFailed);console.warn('Pottery poster unavailable:',error);}finally{if(active)poster.disabled=false;}
  });
  return {dispose,suspend,resume};
 }catch(error){dispose();throw error;}
}
