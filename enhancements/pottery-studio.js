import {createPotteryModel} from './pottery-model.js';

const draftKey='museum-pottery-draft-v1';
const words={
 zh:{title:'虚拟拉坯 · 光场造器',intro:'在轮廓画布中按住并拖动，改变器壁形态；也可选择高度，用滑块或按钮精调。立体预览同步更新。',note:'原创造形 · 艺术模拟。参数为设计比例，不是厘米；不对应馆藏原件，也不模拟真实烧制。',profile:'器形剖轮廓',preview:'白胎与光场',preset:'原创模板',vase:'修长瓶',jar:'丰腹罐',bowl:'敞口碗',band:'调整高度',bands:['底足附近','下腹','腹部','肩部','口沿附近'],radius:'该处半径',narrow:'收窄',widen:'拓宽',undo:'撤销',redo:'重做',reset:'重置此模板',angle:'转动视角',front:'正视',rim:'观察内壁',solid:'白胎釉面',wire:'光场网格',paintShape:'带此器形去绘瓷',saveDesign:'导出设计 JSON',importDesign:'导入设计 JSON',poster:'生成作品 PNG',download:'保存作品 PNG',ready:'拖动轮廓开始造形；静止时预览不会持续刷新。',changed:'器形已更新，可观察内壁或导出作品。',imported:'设计已导入，可继续造形。',importFailed:'设计文件无效或过大，当前作品已保留。',importCancelled:'器形已更新，已取消先前导入；请重新选择设计文件。',storageNote:'本机仅保存一份造形草稿，不上传。当前浏览器和网址可恢复；清理网站数据后会丢失，请另存设计文件。',draftReady:'编辑后自动保存本机草稿。',draftSaved:'本机造形草稿已保存。',draftRestored:'本机造形草稿已恢复。',draftInvalid:'旧草稿未能恢复，原记录已保护；仍可造形，请先导出设计 JSON。选择模板、重置或成功导入设计后才替换本机草稿。',draftReadFailed:'本机草稿暂时无法读取，原记录已保护；仍可造形，请先导出设计 JSON。',draftProtected:'原草稿仍受保护，本次造形尚未写入本机草稿。请先导出设计 JSON；选择模板、重置或成功导入后才替换原记录。',draftFailed:'本机存储不可用，请导出设计文件保留作品；仍可正常造形。',renderFailed:'三维预览暂不可用；轮廓调整与设计文件导出仍可使用。',posterReady:'作品已生成，可下载或长按图片保存。',posterFailed:'作品图片暂未生成，请重试。',designReady:'设计文件已准备好，请点击保存。',designDownload:'保存设计 JSON',posterTitle:'一器初成 · 我的青花器形',posterFoot:'原创比例设计 / 艺术模拟 · 非文物实测，非真实烧制仿真',posterAlt:'原创器形作品图，包含白胎预览与剖轮廓',units:'设计比例'},
 en:{title:'Shape clay · Light-field studio',intro:'Drag on the profile canvas to shape the vessel. You can also choose a height and use the radius slider or buttons. The 3D preview updates with your edits.',note:'Original shape design · Artistic simulation. Values are relative design units, not centimetres. This is not a museum original or a physical firing simulation.',profile:'Vessel cross-section',preview:'Porcelain and light field',preset:'Original template',vase:'Slender vase',jar:'Full-bodied jar',bowl:'Open bowl',band:'Height to edit',bands:['Near the foot','Lower body','Body','Shoulder','Near the rim'],radius:'Radius here',narrow:'Narrow',widen:'Widen',undo:'Undo',redo:'Redo',reset:'Reset template',angle:'Rotate view',front:'Front',rim:'Inspect interior',solid:'Porcelain glaze',wire:'Light-field grid',paintShape:'Paint this vessel',saveDesign:'Export design JSON',importDesign:'Import design JSON',poster:'Create artwork PNG',download:'Save artwork PNG',ready:'Drag the profile to begin. The preview rests when you stop editing.',changed:'Shape updated. Inspect the interior or export your work.',imported:'Design imported. Continue shaping.',importFailed:'This design is invalid or too large. Your current work is unchanged.',importCancelled:'Your shape changed, so the pending import was cancelled. Select the design file again.',storageNote:'One shape draft stays in this browser at this website, with no upload. Clearing site data removes it. Export the design to keep it.',draftReady:'Your shape draft saves after editing.',draftSaved:'Local shape draft saved.',draftRestored:'Local shape draft restored.',draftInvalid:'The old draft could not be restored and is protected. Keep shaping and export design JSON first. Choose a template, reset, or import a valid design to replace the local draft.',draftReadFailed:'The local draft could not be read and is protected. Keep shaping and export design JSON first.',draftProtected:'The old draft is protected; these edits have not replaced it. Export design JSON first. Choose a template, reset, or import a valid design to replace the old record.',draftFailed:'Local storage is unavailable. Export the design to keep your work; shaping still works.',renderFailed:'The 3D preview is unavailable. Profile editing and design export still work.',posterReady:'Artwork ready. Download it or hold the image to save.',posterFailed:'The artwork image could not be created. Please retry.',designReady:'Design ready. Choose the save link.',designDownload:'Save design JSON',posterTitle:'A vessel of your own',posterFoot:'Original relative design / artistic simulation. Not a measurement or physical firing model.',posterAlt:'Original vessel artwork with a porcelain preview and profile',units:'relative units'}
};

const sectionWords={
 zh:{section:'横截观察',sectionHeight:'横截高度',sectionNote:'原创网格的横截设计观察 · 相对设计单位 · 艺术可视化，非文物 CT 或实测。',sectionUnavailable:'当前设备暂不支持横截观察，已恢复完整器形；造形、绘瓷和导出仍可使用。'},
 en:{section:'Horizontal section',sectionHeight:'Section height',sectionNote:'Horizontal section of your original design mesh · Relative design units · Artistic visualization, not heritage CT or measurement.',sectionUnavailable:'Section view is unavailable on this device. The complete vessel is restored; shaping, painting and export still work.'}
};

const referenceWords={
 zh:{reference:'参考轮廓',referenceOff:'关闭参考',referenceCurrent:'当前',referenceRatio:'轮廓宽高比',referenceNote:'实线为当前器形，青绿虚线为等比例参考；仅辅助造形，不计分，也不写入作品。',referenceFailed:'参考轮廓暂不可用，当前作品已保留。'},
 en:{reference:'Reference outline',referenceOff:'No reference',referenceCurrent:'Current',referenceRatio:'Outline width / height',referenceNote:'Solid: your vessel. Teal dashes: an equally scaled reference. A shaping guide only; it is not scored or included in your artwork.',referenceFailed:'The reference is unavailable. Your current work is unchanged.'}
};

const posterWords={
 zh:{posterHeight:'设计高度 H',posterRadius:'最大半径 Rmax',posterOuter:'外轮廓',posterInner:'内轮廓',posterSampling:'径向采样轮廓示意 · 非文物实测',posterBase:'自模型底部计'},
 en:{posterHeight:'Design height H',posterRadius:'Max radius Rmax',posterOuter:'Outer profile',posterInner:'Inner profile',posterSampling:'Sampled radial profile · not a measured section',posterBase:'from model base'}
};

const shapingWords={
 zh:{fit:'适应画面',fitNeeded:'器形超出当前取景，请点击“适应画面”。设计尺寸未改变。',shapingTool:'造形方式',precision:'轮廓精修',natural:'自然拉坯',precisionHint:'轮廓精修：左右拖动调整所选高度的半径，竖向移动不改变高度。',naturalHint:'自然拉坯：拖动器壁塑形，接触与竖向移动会影响器形。',customHeight:'自选高度',radiusLimited:'已达到该处安全造形范围；半径读数为实际可用值，器形已保留。',profileKeys:'画布方向键：上 / 下选择高度，左 / 右精调半径；按住 Shift 加大步幅。半径滑块与按钮保持设计高度。'},
 en:{fit:'Fit canvas',fitNeeded:'The vessel exceeds this framing. Choose Fit canvas; design dimensions are unchanged.',shapingTool:'Shaping tool',precision:'Precision profile',natural:'Natural clay',precisionHint:'Precision profile: drag sideways to adjust radius at the selected height. Vertical motion keeps this height.',naturalHint:'Natural clay: drag the wall to shape it. Contact and vertical motion affect the form.',customHeight:'Custom height',radiusLimited:'This band has reached its safe shaping range. The radius readout shows the achieved value; your vessel is preserved.',profileKeys:'Canvas arrow keys: Up / Down select height, Left / Right adjust radius. Hold Shift for larger steps. Radius controls keep the design height.'}
};

export function mountPottery(container,{language='zh',THREE,renderPreview,onPaintShape=null,contextCanvas=null,releaseSceneGPU=null}){
 const t={...(words[language]||words.zh),...(sectionWords[language]||sectionWords.zh),...(referenceWords[language]||referenceWords.zh),...(posterWords[language]||posterWords.zh),...(shapingWords[language]||shapingWords.zh)},root=document.createElement('section'),lifetime=new AbortController();
 root.className='innovation-pottery';root.dataset.testid='potteryStudio';root.dataset.wire='triangles';root.dataset.section='full';root.setAttribute('aria-busy','true');
 root.innerHTML=`<h3>${t.title}</h3><p>${t.intro}</p><p class="innovation-note">${t.note}</p><div class="innovation-toolbar"><label class="innovation-field">${t.preset}<select data-control="preset">${['vase','jar','bowl'].map(kind=>`<option value="${kind}">${t[kind]}</option>`).join('')}</select></label><button type="button" data-action="undo" disabled>${t.undo}</button><button type="button" data-action="redo" disabled>${t.redo}</button><button type="button" data-action="reset">${t.reset}</button></div><div class="innovation-studio-grid"><div class="innovation-canvas-wrap"><h4>${t.profile}</h4><canvas data-testid="potteryProfile" width="512" height="512" aria-label="${t.profile}"></canvas><p class="pottery-readout" aria-live="off"></p></div><div class="innovation-canvas-wrap"><h4>${t.preview}</h4><canvas data-testid="potteryPreview" width="512" height="512" aria-label="${t.preview}"></canvas><div class="innovation-actions"><button type="button" data-mode="solid" aria-pressed="true">${t.solid}</button><button type="button" data-mode="wire" aria-pressed="false">${t.wire}</button><button type="button" data-view="front" aria-pressed="true">${t.front}</button><button type="button" data-view="rim" aria-pressed="false">${t.rim}</button></div><label class="innovation-field">${t.angle}<input data-control="angle" type="range" min="-180" max="180" value="0"></label></div></div><div class="pottery-shape-controls"><label class="innovation-field">${t.shapingTool}<select data-control="shapingTool"><option value="precision">${t.precision}</option><option value="natural">${t.natural}</option></select></label><label class="innovation-field">${t.band}<select data-control="band">${t.bands.map((name,index)=>`<option value="${index}"${index===2?' selected':''}>${name}</option>`).join('')}</select></label><label class="innovation-field">${t.radius}<input data-control="radius" type="range" min="0.5" max="16" step="0.05" value="5"><output data-value="radius"></output></label><button type="button" data-action="narrow">${t.narrow}</button><button type="button" data-action="widen">${t.widen}</button></div><div class="innovation-actions"><button type="button" data-action="paintShape"${typeof onPaintShape==='function'?'':' hidden'}>${t.paintShape}</button><button type="button" data-action="saveDesign">${t.saveDesign}</button><label class="pottery-file-button">${t.importDesign}<input data-action="importDesign" type="file" accept="application/json,.json"></label><button type="button" data-action="poster">${t.poster}</button><a class="download" data-action="designDownload" hidden>${t.designDownload}</a><a class="download" data-action="download" hidden>${t.download}</a></div><p class="innovation-status" role="status" aria-live="polite">${t.ready}</p><p class="innovation-note">${t.storageNote}</p><p class="pottery-draft-status innovation-note" role="status" aria-live="polite">${t.draftReady}</p><img data-testid="potteryPoster" alt="${t.posterAlt}" hidden>`;
 root.querySelector('.innovation-toolbar').insertAdjacentHTML('afterend',`<div class="pottery-reference-controls"><label class="innovation-field">${t.reference}<select data-control="reference"><option value="off">${t.referenceOff}</option>${['vase','jar','bowl'].map(kind=>`<option value="${kind}">${t[kind]}</option>`).join('')}</select></label><p data-testid="potteryReferenceReadout" class="pottery-reference-readout" hidden></p><p class="innovation-note" data-testid="potteryReferenceNote" hidden>${t.referenceNote}</p></div>`);
 root.querySelector('[data-view="rim"]').insertAdjacentHTML('afterend',`<button type="button" data-view="section" aria-pressed="false">${t.section}</button>`);
 root.querySelector('[data-control="band"]').insertAdjacentHTML('beforeend',`<option value="custom" data-custom-height hidden disabled>${t.customHeight}</option>`);
 root.querySelector('[data-control="angle"]').closest('label').insertAdjacentHTML('beforebegin',`<div data-testid="potterySectionControls" hidden><label class="innovation-field">${t.sectionHeight}<input data-control="sectionHeight" type="range" min="10" max="90" step="1" value="55"><output data-value="sectionHeight">55%</output></label><p class="innovation-note">${t.sectionNote}</p></div>`);
 container.append(root);
 const contextStatus=document.createElement('p');contextStatus.className='innovation-note';contextStatus.dataset.testid='potteryContextStatus';contextStatus.hidden=true;contextStatus.setAttribute('role','status');contextStatus.setAttribute('aria-live','polite');contextStatus.textContent=language==='en'?'The 3D preview is temporarily unavailable. Your vessel remains on this page. Keep editing its profile, and save design JSON separately.':'三维预览暂不可用，器形仍在当前页面。可继续调整轮廓，并先另存设计 JSON。';root.querySelector('.innovation-status').before(contextStatus);
 const $=selector=>root.querySelector(selector),profile=$('[data-testid="potteryProfile"]'),preview=$('[data-testid="potteryPreview"]'),ctx=profile.getContext('2d'),status=$('.innovation-status'),draftStatus=$('.pottery-draft-status'),preset=$('[data-control="preset"]'),radius=$('[data-control="radius"]'),band=$('[data-control="band"]'),angle=$('[data-control="angle"]'),poster=$('[data-action="poster"]'),posterImage=$('[data-testid="potteryPoster"]');
 const sectionButton=$('[data-view="section"]'),sectionControls=$('[data-testid="potterySectionControls"]'),sectionHeight=$('[data-control="sectionHeight"]'),sectionOutput=$('[data-value="sectionHeight"]');
 const reference=$('[data-control="reference"]'),referenceReadout=$('[data-testid="potteryReferenceReadout"]'),references=new Map();let referenceKind='off';
 profile.tabIndex=0;profile.insertAdjacentHTML('afterend',`<div class="innovation-actions"><button type="button" data-action="fit">${t.fit}</button><span data-testid="potteryFitStatus" role="status" hidden>${t.fitNeeded}</span></div>`);
 profile.setAttribute('aria-label',`${t.profile}. ${t.profileKeys}`);profile.insertAdjacentHTML('afterend',`<p class="innovation-note">${t.profileKeys}</p>`);
 const shapingControls=$('.pottery-shape-controls'),shapingTool=$('[data-control="shapingTool"]');profile.insertAdjacentElement('afterend',shapingControls);shapingControls.insertAdjacentHTML('afterend',`<p class="innovation-note" data-testid="potteryShapingHint">${t.precisionHint}</p>`);const shapingHint=$('[data-testid="potteryShapingHint"]');
 const listen=(node,event,fn)=>node.addEventListener(event,(...args)=>{if(!suspended)fn(...args);},{signal:lifetime.signal});
 let active=true,suspended=false,model=null,scene=null,camera=null,mesh=null,material=null,wireMaterial=null,renderTimer=null,saveTimer=null,lastRender=-Infinity,renderFailed=false,contextUnavailable=false,posterJobToken=null,draftDirty=false,draftProtected=false,edit=null,pending=null,rotation=null,mode='solid',view='front',generation=0,shapeRevision=0,importToken=0,pngURL=null,designURL=null,profileScale=null,previewUnit=null,previewNeedsFit=false;
 let wireAttempted=false,wireTexture=null,wireCanvas=null,section=null,sectionBlocked=false;
 const bands=[.08,.28,.5,.72,.94];let selected=.5,frame=null;
 for(const item of root.querySelectorAll('button,input,select'))item.disabled=true;
 for(const canvas of [profile,preview]){canvas.style.touchAction='none';canvas.style.width='100%';canvas.style.height='auto';}
 const say=text=>{status.textContent=text;};
 function updatePosterControls(){poster.disabled=contextUnavailable||posterJobToken!==null;}
 function clearExports(){generation++;for(const key of ['download','designDownload']){const link=$(`[data-action="${key}"]`);link.hidden=true;link.removeAttribute('href');}posterImage.hidden=true;posterImage.removeAttribute('src');if(pngURL)URL.revokeObjectURL(pngURL);if(designURL)URL.revokeObjectURL(designURL);pngURL=designURL=null;}
 function updateHistory(p=model.getProfile()){$('[data-action="undo"]').disabled=!p.canUndo;$('[data-action="redo"]').disabled=!p.canRedo;preset.value=p.preset;}
 function flushDraft(){if(saveTimer!==null)clearTimeout(saveTimer);saveTimer=null;if(!draftDirty||!model)return;if(draftProtected){draftStatus.textContent=t.draftProtected;return;}try{localStorage.setItem(draftKey,model.serialize());draftDirty=false;draftStatus.textContent=t.draftSaved;}catch{draftStatus.textContent=t.draftFailed;}}
 function queueDraft(){if(!active||suspended)return;draftDirty=true;if(saveTimer!==null)clearTimeout(saveTimer);saveTimer=setTimeout(flushDraft,500);}
 function mapping(p,guide=references.get(referenceKind),fit=false){
  const ys=p.outer.map(point=>point[1]),minY=Math.min(...ys),height=Math.max(.01,Math.max(...ys)-minY),maxR=Math.max(.1,p.maxR,guide?guide.maxR*height/guide.height:0);
  return {minY,height,scale:!fit&&profileScale!==null?profileScale:Math.min(416/(maxR*2),416/height),cx:256,bottom:464};
 }
 function prepareReference(kind){
  if(kind==='off'||references.has(kind))return;let sample=null;
  try{sample=createPotteryModel({THREE,mobile:matchMedia('(max-width:700px)').matches,preset:kind});const outer=sample.getProfile().outer,minY=outer[0][1],height=outer[outer.length-1][1]-minY,maxR=Math.max(...outer.map(point=>point[0]));references.set(kind,{outer,minY,height,maxR});}
  finally{sample?.dispose();}
 }
 function radiusAt(p,y){for(let i=1;i<p.outer.length;i++){const a=p.outer[i-1],b=p.outer[i];if(y>=Math.min(a[1],b[1])&&y<=Math.max(a[1],b[1])){const f=b[1]===a[1]?0:(y-a[1])/(b[1]-a[1]);return a[0]+(b[0]-a[0])*f;}}return p.outer[0]?.[0]||.5;}
 function point(r,y,map){return [map.cx+r*map.scale,map.bottom-(y-map.minY)*map.scale];}
 function selection(p,map=frame){const y=map.minY+map.height*selected;return {y,r:model.getRadius(y)};}
 function syncShapingTool(){shapingHint.textContent=shapingTool.value==='natural'?t.naturalHint:t.precisionHint;}
 function syncHeight(){const index=bands.findIndex(value=>Math.abs(value-selected)<1e-5),custom=band.querySelector('[data-custom-height]');custom.hidden=index>=0;if(index<0)custom.textContent=`${t.customHeight} · ${(selected*100).toFixed(1)}%`;band.value=index<0?'custom':String(index);}
 function updateControls(p){const s=selection(p);if(!edit?.numeric){radius.value=String(Math.max(.5,Math.min(16,s.r)));radius.defaultValue=radius.value;}$('[data-value="radius"]').textContent=s.r.toFixed(2);$('.pottery-readout').textContent=`${t.units} · H ${p.height.toFixed(2)} / R ${p.maxR.toFixed(2)}`;updateHistory(p);}
 function drawProfile(includeReference=true,includeSelection=true){
  const p=model.getProfile(),guide=includeReference?references.get(referenceKind):null;frame=!includeReference&&!includeSelection?mapping(p,null,true):edit?.map||mapping(p,guide);const map=frame;if(includeSelection)$('[data-testid="potteryFitStatus"]').hidden=2*Math.max(p.maxR,guide?guide.maxR*map.height/guide.height:0)*map.scale<=416+1e-6&&map.height*map.scale<=416+1e-6;
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
  if(includeSelection){const s=selection(p,map),[x,y]=point(s.r,s.y,map);ctx.strokeStyle='#88c9ff77';ctx.setLineDash([6,5]);ctx.beginPath();ctx.moveTo(48,y);ctx.lineTo(464,y);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#d2ecff';ctx.beginPath();ctx.arc(x,y,8,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#58aaff';ctx.lineWidth=3;ctx.beginPath();ctx.arc(x,y,14,0,Math.PI*2);ctx.stroke();}
  updateControls(p);
 }
 function applyPending(){if(!pending||!edit)return false;const now=performance.now(),target=pending;pending=null;const changed=edit.numeric||edit.precision?model.setRadius(target.r,target.y):model.sculpt(target.r,target.y,Math.max(.016,Math.min(.125,(now-edit.time)/1000)));edit.time=now;if(changed){shapeRevision++;edit.changed=true;clearExports();queueDraft();return true;}return false;}
 function previewNormalization(){const p=model.getProfile(),box=model.geometry.boundingBox;return (box.max.y-box.min.y)/(p.height+(p.outer[p.outer.length-1][0]-p.inner[p.inner.length-1][0])/4);}
 function fitPreviewUnit(){return previewNormalization()*Math.min(1,7.4*Math.sin(33*Math.PI/360)*.85/model.geometry.boundingSphere.radius);}
 function fitFraming(){profileScale=mapping(model.getProfile(),undefined,true).scale;previewUnit=fitPreviewUnit();previewNeedsFit=false;}
 function placePreview(fit=false){
  const s=(fit?fitPreviewUnit():previewUnit??fitPreviewUnit())/previewNormalization(),r=model.geometry.boundingSphere.radius*s;
  previewNeedsFit=!fit&&r>=7.2;if(!fit&&r>7.4*Math.sin(33*Math.PI/360)*.85)$('[data-testid="potteryFitStatus"]').hidden=false;if(previewNeedsFit)return false;
  mesh.scale.setScalar(s);mesh.position.copy(model.geometry.boundingBox.min).add(model.geometry.boundingBox.max).multiplyScalar(-s/2);return true;
 }
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
  section.plane.coplanarPoint(section.cap.position);section.cap.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),section.plane.normal.clone().negate());section.cap.scale.copy(mesh.scale);
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
 function render(fit=false){
  renderTimer=null;if(!active||suspended||!model)return false;applyPending();drawProfile();lastRender=performance.now();if(renderFailed||contextUnavailable)return false;
  const sliced=view==='section';
  try{const box=model.geometry.boundingBox;if(!placePreview(fit)){say(t.fitNeeded);return false;}mesh.material=mode==='wire'?wireMaterial:material;if(sliced)updateSection(box);updateCamera();renderPreview(scene,camera,preview,sliced);if(contextUnavailable)return false;syncView();return true;}
  catch(error){
   if(error?.code==='MUSEUM_CONTEXT_LOST'){loseContext();return false;}
   if(sliced){
    const focus=document.activeElement===sectionButton||sectionControls.contains(document.activeElement);sectionBlocked=true;clearSection();view='front';syncView();if(focus)$('[data-view="front"]').focus({preventScroll:true});say(t.sectionUnavailable);console.warn('Pottery section unavailable; complete vessel restored:',error);
    try{updateCamera();renderPreview(scene,camera,preview,false);return !contextUnavailable;}catch(fallback){if(fallback?.code==='MUSEUM_CONTEXT_LOST'){loseContext();return false;}error=fallback;}
   }
   renderFailed=true;say(t.renderFailed);console.warn('Pottery preview unavailable:',error);
  }
  return false;
 }
 function scheduleRender(){if(!active||suspended||renderTimer!==null)return;const delay=Math.max(0,125-(performance.now()-lastRender));if(delay===0)render();else renderTimer=setTimeout(render,delay);}
 function loseContext(){
  if(!active||contextUnavailable)return;contextUnavailable=true;contextStatus.hidden=false;if(renderTimer!==null)clearTimeout(renderTimer);renderTimer=null;
  finishEdit();finishRotation();releaseSceneGPU?.(scene);updatePosterControls();
 }
 function restoreContext(){if(!active)return;contextUnavailable=false;contextStatus.hidden=true;updatePosterControls();scheduleRender();}
 function finishEdit(event){if(!edit||event&&event.pointerId!==undefined&&event.pointerId!==edit.id)return;if(event?.type==='pointerup')moveProfile(event,true);applyPending();const {id,changed,numeric,precision,y,requestedR}=edit;edit=null;model.endStroke();if(id!==null)try{profile.releasePointerCapture(id);}catch{}if(changed)queueDraft();if((numeric||precision)&&Math.abs(model.getRadius(y)-requestedR)>1e-4)say(t.radiusLimited);scheduleRender();updateHistory();}
 function finishRotation(event){if(!rotation||event&&event.pointerId!==undefined&&event.pointerId!==rotation.id)return;const id=rotation.id;rotation=null;try{preview.releasePointerCapture(id);}catch{}}
 function changed(){shapeRevision++;clearExports();queueDraft();scheduleRender();say(t.changed);}
 function beginBand(){if(edit)return;const p=model.getProfile(),map=mapping(p),s=selection(p,map);model.beginStroke(s.r,s.y);edit={id:null,map,time:performance.now()-100,changed:false,numeric:true,y:s.y,baseInput:Number(radius.defaultValue),baseRadius:s.r,requestedR:s.r};}
 function nudge(delta){finishEdit();const p=model.getProfile(),map=mapping(p),s=selection(p,map),target=Math.max(.5,Math.min(16,s.r+delta));if(delta<0&&target>=s.r||delta>0&&target<=s.r){say(t.radiusLimited);return;}model.beginStroke(s.r,s.y);const edited=model.setRadius(target,s.y);model.endStroke();if(edited)changed();if(Math.abs(model.getRadius(s.y)-target)>1e-4)say(t.radiusLimited);}
 function moveProfile(event,ending=false){
  if(!edit||event.pointerId!==edit.id)return;if(!ending&&event.pointerType==='mouse'&&event.buttons!==1){finishEdit(event);return;}
  if(edit.precision){if(!edit.moved&&Math.abs(event.clientX-edit.clientX)<3)return;}else if(!edit.moved&&Math.hypot(event.clientX-edit.clientX,event.clientY-edit.clientY)<3)return;edit.moved=true;event.preventDefault();
  const rect=profile.getBoundingClientRect(),x=(event.clientX-rect.left)*512/rect.width,y=(event.clientY-rect.top)*512/rect.height,map=edit.map;if(edit.precision){edit.requestedR=edit.r+(x-edit.x)*edit.side/map.scale;pending={r:Math.max(Math.min(.5,edit.r),Math.min(16,edit.requestedR)),y:edit.rawY};if(!ending)scheduleRender();return;}pending={r:Math.max(.5,Math.min(16,edit.r+(x-edit.x)*edit.side/map.scale)),y:Math.max(map.minY,Math.min(map.minY+map.height,edit.rawY-(y-edit.y)/map.scale))};selected=Math.max(.02,Math.min(.98,(pending.y-map.minY)/map.height));syncHeight();if(!ending)scheduleRender();
 }
 function flushOnLeave(){finishEdit();finishRotation();flushDraft();}
 function suspend(){if(!active||suspended)return;flushOnLeave();suspended=true;generation++;importToken++;if(renderTimer!==null)clearTimeout(renderTimer);renderTimer=null;posterJobToken=null;updatePosterControls();}
 function resume(){if(!active||!suspended)return;suspended=false;scheduleRender();}
 function dispose(){
  if(!active)return;flushOnLeave();active=false;lifetime.abort();importToken++;clearExports();if(renderTimer!==null)clearTimeout(renderTimer);if(saveTimer!==null)clearTimeout(saveTimer);renderTimer=saveTimer=null;clearSection();material?.dispose();wireMaterial?.dispose();wireTexture?.dispose();if(wireCanvas)wireCanvas.width=wireCanvas.height=0;wireTexture=wireCanvas=null;model?.dispose();references.clear();root.remove();
 }
 contextCanvas?.addEventListener('webglcontextlost',loseContext,{signal:lifetime.signal});contextCanvas?.addEventListener('webglcontextrestored',restoreContext,{signal:lifetime.signal});
 try{
  if(!ctx)throw new Error('Canvas 2D unavailable');
  model=createPotteryModel({THREE,mobile:matchMedia('(max-width:700px)').matches,preset:'vase'});
  try{const raw=localStorage.getItem(draftKey);if(raw!==null){draftProtected=!model.restore(raw);draftStatus.textContent=draftProtected?t.draftInvalid:t.draftRestored;}}catch{draftProtected=true;draftStatus.textContent=t.draftReadFailed;}
  scene=new THREE.Scene();scene.background=new THREE.Color(0x081426);camera=new THREE.PerspectiveCamera(33,1,.1,30);
  scene.add(new THREE.HemisphereLight(0xe4f1ff,0x233b5d,2.2));const key=new THREE.DirectionalLight(0xffffff,2.8);key.position.set(-3,4,5);scene.add(key);const rim=new THREE.DirectionalLight(0x75b5ff,1.8);rim.position.set(3,2,-3);scene.add(rim);
  material=new THREE.MeshPhysicalMaterial({color:0xf7f5eb,roughness:.3,metalness:0,clearcoat:.6,clearcoatRoughness:.2});wireMaterial=new THREE.MeshBasicMaterial({color:0x3b8bc7,wireframe:true});mesh=new THREE.Mesh(model.geometry,material);mesh.name='museum-pottery-vessel';scene.add(mesh);
  fitFraming();for(const item of root.querySelectorAll('button,input,select'))item.disabled=false;root.setAttribute('aria-busy','false');updateHistory();render();
  listen(profile,'pointerdown',event=>{
   if(edit||!event.isPrimary||event.button!==0)return;const rect=profile.getBoundingClientRect(),p=model.getProfile(),map=mapping(p),x=(event.clientX-rect.left)*512/rect.width,y=(event.clientY-rect.top)*512/rect.height,rawY=map.minY+(map.bottom-y)/map.scale;
   if(rawY<map.minY||rawY>map.minY+map.height)return;const r=radiusAt(p,rawY);
   event.preventDefault();selected=Math.max(.02,Math.min(.98,(rawY-map.minY)/map.height));syncHeight();if(shapingTool.value!=='natural'){const s=selection(p,map);model.beginStroke(s.r,s.y);edit={id:event.pointerId,map,time:performance.now()-100,side:x<map.cx?-1:1,changed:false,moved:false,x,y,r:s.r,rawY:s.y,clientX:event.clientX,clientY:event.clientY,precision:true,y:s.y,requestedR:s.r};}else{model.beginStroke(r,rawY);edit={id:event.pointerId,map,time:performance.now()-100,side:x<map.cx?-1:1,changed:false,moved:false,x,y,r,rawY,clientX:event.clientX,clientY:event.clientY};}try{profile.setPointerCapture(event.pointerId);}catch{}scheduleRender();
  });
  listen(profile,'pointermove',event=>moveProfile(event));
  for(const event of ['pointerup','pointercancel','lostpointercapture'])listen(profile,event,finishEdit);
  listen(radius,'input',()=>{beginBand();if(!edit.numeric)return;const s=selection(model.getProfile(),edit.map),value=Number(radius.value);edit.requestedR=value===edit.baseInput?edit.baseRadius:value;pending={r:edit.requestedR,y:s.y};scheduleRender();});listen(radius,'change',()=>finishEdit());
  listen(shapingTool,'change',()=>{finishEdit();syncShapingTool();});
  listen(band,'change',()=>{finishEdit();selected=bands[Number(band.value)]??.5;syncHeight();scheduleRender();});
  listen(profile,'keydown',event=>{if(event.ctrlKey||event.metaKey||event.altKey||!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();finishEdit();if(event.key==='ArrowUp'||event.key==='ArrowDown'){selected=Math.max(.02,Math.min(.98,selected+(event.key==='ArrowUp'?1:-1)*(event.shiftKey?.05:.01)));syncHeight();scheduleRender();}else nudge((event.key==='ArrowRight'?1:-1)*(event.shiftKey?.5:.1));});
  listen($('[data-action="narrow"]'),'click',()=>nudge(-1));listen($('[data-action="widen"]'),'click',()=>nudge(1));
  for(const action of ['undo','redo'])listen($(`[data-action="${action}"]`),'click',()=>{finishEdit();if(model[action]())changed();updateHistory();});
  listen($('[data-action="fit"]'),'click',()=>{finishEdit();fitFraming();clearExports();scheduleRender();});
  listen(reference,'change',()=>{finishEdit();try{prepareReference(reference.value);referenceKind=reference.value;drawProfile();if(status.textContent===t.referenceFailed)say(t.ready);}catch(error){reference.value=referenceKind;say(t.referenceFailed);console.warn('Pottery reference unavailable:',error);}});
  listen(preset,'change',()=>{finishEdit();const wasProtected=draftProtected,didReset=model.reset(preset.value);draftProtected=false;if(didReset){fitFraming();changed();}else if(wasProtected)queueDraft();});listen($('[data-action="reset"]'),'click',()=>{finishEdit();const wasProtected=draftProtected,didReset=model.reset(preset.value);draftProtected=false;if(didReset){fitFraming();changed();}else if(wasProtected)queueDraft();});
  for(const button of root.querySelectorAll('[data-mode]'))listen(button,'click',()=>{if(mode===button.dataset.mode)return;mode=button.dataset.mode;if(mode==='wire')prepareWire();for(const item of root.querySelectorAll('[data-mode]'))item.setAttribute('aria-pressed',String(item===button));clearExports();scheduleRender();});
  for(const button of root.querySelectorAll('[data-view]'))listen(button,'click',()=>{if(view===button.dataset.view||button.dataset.view==='section'&&sectionBlocked)return;view=button.dataset.view;if(view!=='section')clearSection();syncView();clearExports();scheduleRender();});
  listen(sectionHeight,'input',()=>{if(view!=='section'||sectionBlocked)return;clearExports();scheduleRender();});
  listen(angle,'input',()=>{clearExports();scheduleRender();});
  listen(preview,'pointerdown',event=>{if(contextUnavailable||rotation||!event.isPrimary||event.button!==0)return;rotation={id:event.pointerId,x:event.clientX,angle:Number(angle.value)};event.preventDefault();try{preview.setPointerCapture(event.pointerId);}catch{}});
  listen(preview,'pointermove',event=>{if(!rotation||event.pointerId!==rotation.id)return;event.preventDefault();const width=Math.max(1,preview.getBoundingClientRect().width),value=rotation.angle+(event.clientX-rotation.x)*300/width;angle.value=String(((value+180)%360+360)%360-180);clearExports();scheduleRender();});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])listen(preview,event,finishRotation);
  for(const event of ['blur','resize'])listen(window,event,()=>{finishEdit();finishRotation();});listen(window,'pagehide',flushOnLeave);listen(document,'visibilitychange',()=>{if(document.visibilityState==='hidden')flushOnLeave();});
  listen(root,'keydown',event=>{if(!event.ctrlKey&&!event.metaKey||event.target.matches('input,select'))return;const key=event.key.toLowerCase();if(key==='z'||key==='y'){event.preventDefault();$(`[data-action="${key==='y'||event.shiftKey?'redo':'undo'}"]`).click();}});
  listen($('[data-action="saveDesign"]'),'click',()=>{finishEdit();try{const nextURL=URL.createObjectURL(new Blob([model.serialize()],{type:'application/json;charset=utf-8'}));if(designURL)URL.revokeObjectURL(designURL);designURL=nextURL;const link=$('[data-action="designDownload"]');link.href=designURL;link.download='qinghua-original-vessel.json';link.hidden=false;say(t.designReady);}catch{say(t.importFailed);}});
  listen($('[data-action="paintShape"]'),'click',()=>{finishEdit();finishRotation();try{onPaintShape?.(model.serialize());}catch{say(t.importFailed);}});
  listen($('[data-action="importDesign"]'),'change',async event=>{const file=event.target.files?.[0],token=++importToken;event.target.value='';if(!file)return;if(file.size>131072){say(t.importFailed);return;}finishEdit();const revision=shapeRevision;try{const text=await file.text();if(!active||token!==importToken)return;if(revision!==shapeRevision||edit||pending){say(t.importCancelled);return;}if(model.restore(text)){draftProtected=false;fitFraming();changed();say(t.imported);}else say(t.importFailed);}catch{if(active&&token===importToken)say(t.importFailed);}});
  listen(poster,'click',async()=>{
   if(contextUnavailable||posterJobToken!==null)return;finishEdit();finishRotation();if(renderFailed){say(t.renderFailed);return;}if(renderTimer!==null)clearTimeout(renderTimer);renderTimer=null;if(!render()){if(!contextUnavailable)say(previewNeedsFit?t.fitNeeded:t.renderFailed);return;}const token=++generation;posterJobToken=token;updatePosterControls();
   try{const p=model.getProfile(),sheet=document.createElement('canvas');sheet.width=1280;sheet.height=900;const draw=sheet.getContext('2d');if(!draw)throw new Error('Canvas 2D unavailable');draw.fillStyle='#081426';draw.fillRect(0,0,1280,900);draw.strokeStyle='#7eadd7';draw.lineWidth=2;draw.strokeRect(24,24,1232,852);draw.fillStyle='#e8f4ff';draw.font='bold 42px sans-serif';draw.fillText(t.posterTitle,56,92);draw.fillStyle='#9bc7ee';draw.font='21px sans-serif';draw.fillText(view==='section'?t.sectionNote:t.note,56,138,1168);
    try{if(!render(true))throw new Error('Pottery capture unavailable');drawProfile(false,false);draw.drawImage(profile,56,198,512,512);draw.drawImage(preview,650,198,512,512);}finally{if(active){placePreview();render();}}draw.font='25px sans-serif';draw.fillText(t.profile,56,764);draw.font=view==='section'?'21px sans-serif':'25px sans-serif';draw.fillText(view==='section'?`${t.section} · ${Math.max(10,Math.min(90,Number(sectionHeight.value)||55))}% ${t.posterBase}`:t.preview,650,764,512);
    draw.font='18px sans-serif';draw.fillText(`${t.posterHeight}: ${p.height.toFixed(2)} · ${t.units}`,56,794,512);draw.fillText(`${t.posterRadius}: ${p.maxR.toFixed(2)} · ${t.units}`,56,820,512);
    for(const [x,color,width,label]of [[650,'#bddfff',3,t.posterOuter],[912,'#6fa6d0',1.5,t.posterInner]]){draw.strokeStyle=color;draw.lineWidth=width;draw.beginPath();draw.moveTo(x,788);draw.lineTo(x+32,788);draw.stroke();draw.fillStyle=color;draw.fillText(label,x+44,794);}
    draw.fillStyle='#9bc7ee';draw.fillText(t.posterSampling,650,820,512);draw.fillText(t.posterFoot,56,844,1168);
    const blob=await new Promise((resolve,reject)=>sheet.toBlob(value=>value?resolve(value):reject(new Error('PNG encoding failed')),'image/png'));sheet.width=sheet.height=0;if(!active||token!==generation)return;const nextURL=URL.createObjectURL(blob);if(pngURL)URL.revokeObjectURL(pngURL);pngURL=nextURL;const link=$('[data-action="download"]');link.href=pngURL;link.download='qinghua-original-vessel.png';link.hidden=false;posterImage.src=pngURL;posterImage.hidden=false;say(t.posterReady);
   }catch(error){if(active&&token===generation)say(t.posterFailed);console.warn('Pottery poster unavailable:',error);}finally{if(posterJobToken===token){posterJobToken=null;if(active)updatePosterControls();}}
  });
  return {dispose,suspend,resume};
 }catch(error){dispose();throw error;}
}
