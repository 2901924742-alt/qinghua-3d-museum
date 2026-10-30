import {canvasPoint,boundedHistory,uvToCanvasPoint,unwrapCanvasX} from './paint-math.js';
import {paintDraftKey,legacyPaintDraftKey,parsePaintDraft,stringifyPaintDraft,validatePaintPNG} from './paint-draft.js';
import {paintStamp,paintBand,paintTemplate} from './paint-patterns.js';

let glbParseOwner=null;

const words={
 zh:{title:'数字绘瓷',intro:'在平面画布绘制，或切换器壁落笔直接在原创器形上创作。默认拖动预览转动器形，也可用角度滑块查看背面。',note:'用户创作 · 艺术模拟。此处使用原创白胎创作模板，不对应馆藏原件；釉光变化不代表真实烧制过程。',draftNote:'本机仅保留一份草稿，不上传；仅当前浏览器和网址可恢复，清理网站数据后会丢失。请另存作品 JSON 以便换设备继续创作。',draftReady:'绘制后会自动保存本机草稿。',draftRestoring:'正在恢复本机草稿…',draftRestored:'本机草稿已恢复；可继续绘制。',draftSaved:'本机草稿已保存。',draftFailed:'本机草稿暂不能保存或读取；绘画仍可继续，请生成海报保存作品。',draftInvalid:'草稿未能恢复，原记录已保留；新作请导出海报，或明确选择经典白胎后保存。',shapeClassic:'经典原创白胎 · 绘制会环绕此器形。',shapeCustom:'正在使用你亲手塑造的原创器形。',shapeUnavailable:'自定义器形暂不可用，旧草稿已保留。仍可平面绘制、保存纹样海报；也可明确改用经典白胎。',shapeFailed:'新器形未能应用；原有画稿与可用器形已保留。',shapePreserved:'原草稿受保护，暂不自动覆盖；新笔画请先保存海报，或选择使用经典白胎后再保存草稿。',classicShape:'使用经典白胎',posterShapeFoot:'原创造形与纹样创作，不对应馆藏原件。',posterFlatFoot:'自定义器形暂不可用，本图仅保存纹样创作。',flat:'纹样画布',preview:'器形预览',rotateMode:'转动器形',surfaceMode:'器壁落笔',rotateHint:'当前为转动模式。切换器壁落笔可直接在白胎上绘制；移出器形会自动断笔。',surfaceHint:'在器壁上按住绘制；空白处不落墨。切回转动模式或使用角度滑块观察其他面。',surfaceUnavailable:'器形预览暂不可用，请使用平面画布绘制。',surfaceFailed:'器壁落笔暂不可用；平面绘制与转动模式仍可使用。',brush:'毛笔',flower:'花卉印章',width:'笔宽',density:'钴蓝浓度',angle:'转动器形',undo:'撤销',redo:'重做',clear:'清空',glaze:'釉光显现',poster:'生成作品海报',exportGLB:'导出原创作品 GLB',glbDownload:'下载 GLB',glbNote:'GLB 可导入 Blender 等软件继续编辑，仅含当前原创器形与纹样；设计比例非实测。手机内置浏览器无法保存时，请改用系统浏览器。',glbReady:'GLB 将按点击导出时的作品状态保存，不上传。',glbPreparing:'正在准备原创作品 GLB…',glbBusy:'上次导出仍在收尾，请稍后重试。',glbSaved:'GLB 已生成，可下载后继续编辑。',glbChanged:'作品已更新，旧 GLB 已失效；请重新导出。',glbFailed:'GLB 暂未生成；绘制、草稿与 PNG 海报仍可使用，请稍后重试。',download:'下载 PNG',ready:'选择模板，或用毛笔、纹样印章、圆形与色带自由创作。',painted:'纹样已更新；可转动器形查看。',glazed:'釉光已显现（艺术模拟）。',renderError:'器形预览暂不可用；平面绘制与撤销仍可使用。',saveError:'海报生成失败，请重试。',saved:'海报已生成，可点击下载或长按图片保存。',posterAlt:'你的数字青花作品海报，用户创作与艺术模拟',posterTitle:'一器一画 · 青花创作',posterSub:'数字绘瓷 · 用户创作 / 艺术模拟',posterFoot:'原创白胎创作模板，不对应馆藏原件。',cleared:'画布已清空，可撤销。'},
 en:{title:'Paint blue porcelain',intro:'Paint on the flat canvas, or choose surface painting to draw directly on your original vessel. The preview rotates by default; the angle slider also shows its back.',note:'User creation · Artistic simulation. This is an original blank-vessel template, not a museum original. The glaze reveal does not simulate physical firing.',draftNote:'One draft stays in this browser at this website, with no upload. Clearing site data removes it. Save artwork JSON to continue on another device.',draftReady:'Your draft saves on this device after painting.',draftRestoring:'Restoring the local draft…',draftRestored:'Local draft restored. Continue painting.',draftSaved:'Local draft saved.',draftFailed:'Local storage is unavailable. You can keep painting; create a poster to save your work.',draftInvalid:'The draft could not be restored. Its original record is kept. Export new artwork, or explicitly choose the classic blank before saving a new draft.',shapeClassic:'Original classic blank. Your pattern wraps around this vessel.',shapeCustom:'Your own original vessel is in use.',shapeUnavailable:'The custom vessel is unavailable. Its old draft is protected. Flat painting and pattern posters still work, or explicitly choose the classic blank.',shapeFailed:'The new vessel could not be applied. Your existing pattern and available vessel are preserved.',shapePreserved:'The existing draft is protected from replacement. Save new painting as a poster, or choose the classic blank to resume draft saving.',classicShape:'Use classic blank',posterShapeFoot:'Original vessel and pattern creation; not a museum original.',posterFlatFoot:'Custom vessel unavailable. This image preserves only the pattern.',flat:'Pattern canvas',preview:'Vessel preview',rotateMode:'Rotate vessel',surfaceMode:'Paint on vessel',rotateHint:'Rotate mode is on. Choose surface painting to draw on the blank. Leaving the vessel breaks the stroke.',surfaceHint:'Hold and draw on the vessel; empty space leaves no ink. Use rotate mode or the angle slider to see another side.',surfaceUnavailable:'The vessel preview is unavailable. Use the flat canvas to keep painting.',surfaceFailed:'Surface painting is unavailable. Flat painting and rotate mode still work.',brush:'Brush',flower:'Floral stamp',width:'Brush width',density:'Cobalt density',angle:'Rotate vessel',undo:'Undo',redo:'Redo',clear:'Clear',glaze:'Reveal glaze',poster:'Create artwork poster',exportGLB:'Export original artwork GLB',glbDownload:'Download GLB',glbNote:'Continue editing the GLB in Blender or similar software. It contains only your original vessel and pattern, in relative design units, not measured dimensions. If an in-app mobile browser cannot save it, use the system browser.',glbReady:'The GLB captures your artwork when you choose export. Nothing is uploaded.',glbPreparing:'Preparing your original artwork GLB…',glbBusy:'The previous export is still finishing. Please try again shortly.',glbSaved:'GLB ready. Download it to continue editing.',glbChanged:'The artwork changed. The old GLB is invalid; export again.',glbFailed:'GLB export is unavailable. Painting, drafts and PNG posters still work. Please retry later.',download:'Download PNG',ready:'Choose a template, or create with the brush, motif stamps, circles and bands.',painted:'Pattern updated. Rotate the vessel to see more.',glazed:'Glaze revealed (artistic simulation).',renderError:'The 3D preview is unavailable. Flat painting and undo still work.',saveError:'Could not create the poster. Please try again.',saved:'Poster ready. Download it or long-press the image to save.',posterAlt:'Your digital porcelain artwork poster, user creation and artistic simulation',posterTitle:'A vessel of your own',posterSub:'Digital porcelain · User creation / Artistic simulation',posterFoot:'Original creative vessel; not a museum original.',cleared:'Canvas cleared. Undo is available.'}
};

const patternWords={
 zh:{tools:'绘制工具',stamp:'纹样印章',ring:'空心圆环',disc:'圆形填色',band:'环绕色带',motif:'印章纹样',flower:'八瓣花',plum:'梅花',bamboo:'竹叶',cloud:'祥云',size:'纹样大小',sample:'单枚放大示意',stampAngle:'印章角度',stampRepeat:'环绕排列',single:'单枚落印',repeatUnit:'枚',width:'笔宽／线宽',hint:'调好纹样、角度与环绕枚数，再在画布或器壁点一下。整组落印可一步撤销；圆形也能环绕排列，色带只画一圈。大小与线宽分别调整。小样为单枚放大示意，非实际落印大小。',templates:'整器纹样模板',templateNote:'选择模板预览，再点“套用模板”。会替换当前纹样，保留器形；可一键撤销。以下均为原创装饰演绎。',floral:'缠枝花卉',plumPreset:'冰梅留白',border:'祥云边饰',apply:'套用模板（可撤销）',applied:'模板已套用，可撤销；也可继续添加印章或绘制。',failed:'模板暂未套用，原有纹样已保留，请重试。'},
 en:{tools:'Drawing tools',stamp:'Motif stamp',ring:'Outline circle',disc:'Filled circle',band:'Wraparound band',motif:'Stamp motif',flower:'Eight-petal flower',plum:'Plum blossom',bamboo:'Bamboo leaves',cloud:'Cloud scroll',size:'Motif size',sample:'Magnified stamp',stampAngle:'Stamp angle',stampRepeat:'Wraparound repeat',single:'Single stamp',repeatUnit:'stamps',width:'Brush / outline width',hint:'Choose a motif, angle and repeat count, then tap the canvas or vessel. Undo the whole group in one step. Circles can repeat; a band is drawn once. Size and outline width are separate. The magnified sample does not show the actual stamp size.',templates:'Whole-vessel templates',templateNote:'Choose a preview, then Apply template. It replaces the pattern, keeps your vessel and can be undone. These are original decorative interpretations.',floral:'Floral vines',plumPreset:'Plum lattice',border:'Cloud borders',apply:'Apply template (undo available)',applied:'Template applied. Undo it, add stamps or keep painting.',failed:'The template could not be applied. Your existing pattern is kept. Please retry.'}
};

const artworkWords={
 zh:{title:'保存／打开作品',save:'保存可编辑作品',download:'下载作品 JSON',open:'打开作品 JSON',note:'作品 JSON 含器形、画稿、当前工具与釉光，不含分层和旧撤销记录。打开会替换当前绘瓷作品，请先另存；从造器进入时，不会改动上一页的造形。文件仅在本机读取，不上传。',ready:'可保存作品文件，在另一台设备继续创作。',preparing:'正在检查作品文件…',saved:'作品文件已生成，请下载保存。',imported:'作品已打开，并保存为本机草稿；可继续创作。',unsaved:'作品已打开，但本机草稿未保存。请另存作品 JSON，避免丢失。',failed:'文件未能打开，当前作品与原草稿已保留。请使用本工坊导出的有效作品 JSON（不超过 1.7 MB）；旧浏览器请改用新版系统浏览器。',cancelled:'已取消打开文件，当前作品已保留。',saveFailed:'作品文件未能生成。当前画稿已保留，请稍后重试。',changed:'作品已更新，请重新保存作品文件。'},
 en:{title:'Save / open artwork',save:'Save editable artwork',download:'Download artwork JSON',open:'Open artwork JSON',note:'Artwork JSON keeps the vessel, painting, current tools and glaze, without layers or earlier undo steps. Opening replaces this painting document; save it first. A parent shape-studio design stays unchanged. Files are read locally, with no upload.',ready:'Save an artwork file to continue on another device.',preparing:'Checking the artwork file…',saved:'Artwork file ready. Download it to keep it.',imported:'Artwork opened and saved as the local draft. Continue creating.',unsaved:'Artwork opened, but the local draft could not be saved. Download artwork JSON to keep it safe.',failed:'Could not open the file. Your current artwork and previous draft are kept. Use a valid workshop artwork JSON (up to 1.7 MB). Older browsers may need a current system browser.',cancelled:'Opening cancelled. Your current artwork is kept.',saveFailed:'Could not create the artwork file. Your painting is kept. Please retry.',changed:'Artwork changed. Save a fresh artwork file.'}
};

export function mountPaint(container,{language='zh',THREE,renderPreview,shapeJSON=null,createPotteryModel=null}) {
 const t=words[language]||words.zh,labels=patternWords[language]||patternWords.zh,files=artworkWords[language]||artworkWords.zh,lifetime=new AbortController(),history=boundedHistory(12),future=boundedHistory(12),root=document.createElement('section');
 root.className='innovation-paint';root.dataset.testid='paintStudio';root.dataset.brush='classic';root.dataset.previewMode='rotate';root.setAttribute('aria-busy','false');
 root.innerHTML=`<h3>${t.title}</h3><p>${t.intro}</p><p class="innovation-note">${t.note}</p><div class="paint-shape-controls"><p class="innovation-shape-status innovation-note" data-testid="paintShapeNote" role="status">${t.shapeClassic}</p><button type="button" data-action="classicShape" hidden>${t.classicShape}</button></div><div class="paint-template-picker"><h4>${labels.templates}</h4><p class="innovation-note">${labels.templateNote}</p><div class="paint-template-options" role="group" aria-label="${labels.templates}">${['floral','plum','border'].map((name,index)=>`<button type="button" data-template="${name}" aria-pressed="${index===0}"><canvas width="144" height="72" aria-hidden="true"></canvas><span>${labels[name==='plum'?'plumPreset':name]}</span></button>`).join('')}</div><button type="button" data-action="applyTemplate">${labels.apply}</button></div><div class="innovation-toolbar" role="group" aria-label="${labels.tools}"><button type="button" data-tool="brush" aria-pressed="true">${t.brush}</button><button type="button" data-tool="flower" aria-pressed="false">${labels.stamp}</button><button type="button" data-tool="ring" aria-pressed="false">${labels.ring}</button><button type="button" data-tool="disc" aria-pressed="false">${labels.disc}</button><button type="button" data-tool="band" aria-pressed="false">${labels.band}</button></div><div class="paint-tool-settings"><label class="innovation-field" data-motif-field hidden>${labels.motif}<select data-control="motif">${['flower','plum','bamboo','cloud'].map(name=>`<option value="${name}">${labels[name]}</option>`).join('')}</select></label><label class="innovation-field" data-size-field hidden>${labels.size}<input data-control="stampSize" type="range" min="16" max="96" value="48"><output data-value="stampSize">48</output></label><label class="innovation-field" data-stamp-angle-field hidden>${labels.stampAngle}<input data-control="stampAngle" type="range" min="-180" max="180" step="1" value="0"><output data-value="stampAngle">0°</output></label><label class="innovation-field" data-repeat-field hidden>${labels.stampRepeat}<select data-control="stampRepeat">${[1,4,6,8,12].map(count=>`<option value="${count}">${count===1?labels.single:count+" "+labels.repeatUnit}</option>`).join('')}</select></label><label class="innovation-field">${labels.width}<input data-control="width" type="range" min="2" max="28" value="10"><output data-value="width">10</output></label><label class="innovation-field">${t.density}<input data-control="density" type="range" min="20" max="100" value="75"><output data-value="density">75%</output></label></div><div class="paint-tool-help"><figure class="paint-stamp-sample" data-testid="paintStampSampleGroup" hidden><canvas data-testid="paintStampSample" width="192" height="192" aria-hidden="true"></canvas><figcaption>${labels.sample}</figcaption></figure><p class="innovation-note" data-testid="paintToolHint">${labels.hint}</p></div><div class="innovation-studio-grid"><div class="innovation-canvas-wrap"><h4>${t.flat}</h4><canvas data-testid="paintCanvas" width="512" height="256" tabindex="0" aria-label="${t.flat}"></canvas></div><div class="innovation-canvas-wrap"><h4>${t.preview}</h4><canvas data-testid="paintPreview" width="512" height="512" aria-label="${t.preview}"></canvas><div class="innovation-actions"><button type="button" data-preview-mode="rotate" aria-pressed="true">${t.rotateMode}</button><button type="button" data-preview-mode="surface" aria-pressed="false">${t.surfaceMode}</button></div><p class="innovation-note" data-testid="paintSurfaceNote">${t.rotateHint}</p><label class="innovation-field">${t.angle}<input data-control="angle" type="range" min="-180" max="180" value="0"></label></div></div><div class="innovation-actions"><button type="button" data-action="undo" disabled>${t.undo}</button><button type="button" data-action="redo" disabled>${t.redo}</button><button type="button" data-action="clear">${t.clear}</button><button type="button" data-action="glaze">${t.glaze}</button><button type="button" data-action="poster">${t.poster}</button><a data-action="download" class="download" hidden>${t.download}</a><button type="button" data-action="exportGLB">${t.exportGLB}</button><a data-action="glbDownload" class="download" hidden>${t.glbDownload}</a></div><p class="innovation-note">${t.glbNote}</p><p class="innovation-note" data-testid="paintGLBStatus" role="status" aria-live="polite">${t.glbReady}</p><p class="innovation-status" role="status" aria-live="polite">${t.ready}</p><p class="innovation-note">${t.draftNote}</p><p class="innovation-draft-status innovation-note" role="status" aria-live="polite">${t.draftReady}</p><img data-testid="paintPoster" alt="${t.posterAlt}" hidden>`;
 const filePanel=document.createElement('details');filePanel.className='paint-file-panel';
 filePanel.innerHTML=`<summary>${files.title}</summary><p class="innovation-note">${files.note}</p><div class="innovation-actions"><button type="button" data-action="saveArtwork">${files.save}</button><a class="download" data-action="artworkDownload" hidden>${files.download}</a><label class="pottery-file-button">${files.open}<input type="file" accept=".json,application/json" data-action="importArtwork" aria-label="${files.open}"></label></div><p class="innovation-note" data-testid="paintArtworkStatus" role="status" aria-live="polite">${files.ready}</p>`;
 root.querySelector('.paint-shape-controls').before(filePanel);
 container.append(root);
 const $=selector=>root.querySelector(selector),canvas=$('[data-testid="paintCanvas"]'),preview=$('[data-testid="paintPreview"]'),ctx=canvas.getContext('2d',{willReadFrequently:true}),status=$('.innovation-status'),undo=$('[data-action="undo"]'),redo=$('[data-action="redo"]'),draftStatus=$('.innovation-draft-status'),glaze=$('[data-action="glaze"]'),poster=$('[data-action="poster"]'),download=$('[data-action="download"]'),posterImage=$('[data-testid="paintPoster"]'),angle=$('[data-control="angle"]'),shapeNote=$('[data-testid="paintShapeNote"]'),classicButton=$('[data-action="classicShape"]');
 const listen=(node,type,handler)=>node.addEventListener(type,handler,{signal:lifetime.signal});
 for(const item of root.querySelectorAll('button,input,select,a'))item.style.minHeight='44px';
 for(const item of [canvas,preview]){item.style.width='100%';item.style.height='auto';item.style.display='block';item.style.touchAction='none';}
 canvas.style.aspectRatio='2 / 1';preview.style.aspectRatio='1';canvas.style.background='#faf7ed';preview.style.background='#0b1426';preview.tabIndex=0;
 let active=true,scene,camera,vase,texture,material,pedestal,geometry,pedestalGeometry,pedestalMaterial,tool='brush',stroke=null,rotation=null,renderTimer=null,glazeTimer=null,lastRender=-Infinity,renderFailed=false,textureDirty=true,downloadURL=null,saveToken=0;
 let draftTimer=null,restoreTimer=null,restoreImage=null,restoring=false,draftDirty=false,glazed=false,currentAngle=0;
 let shapeOwner=null,currentShapeJSON=null,shapeUnavailable=false,draftProtected=false;
 let brushFactory=null,naturalBrush=null,brushDisabled=false,inkRAF=null,inkDirty=false;
 let previewMode='rotate',surfacePointer=null,surfaceSamples=[],surfaceRAF=null,surfaceDisabled=false,raycaster=null,rayPosition=null;
 let glbJob=null,glbToken=0,glbURL=null,templateName='floral',suspended=false,artworkJob=null,artworkURL=null,posterJobToken=null;
 const rayHits=[],stampSample=$('[data-testid="paintStampSample"]'),stampSampleGroup=$('[data-testid="paintStampSampleGroup"]');
 let stampSampleContext=null,stampSampleKey=null,stampSampleFailed=false;
 const setStatus=text=>{status.textContent=text;};
 function fillBlank(){ctx.fillStyle='#faf7ed';ctx.fillRect(0,0,512,256);textureDirty=true;}
 function invalidatePoster(){saveToken++;download.hidden=true;download.removeAttribute('href');posterImage.hidden=true;posterImage.removeAttribute('src');if(downloadURL){URL.revokeObjectURL(downloadURL);downloadURL=null;}invalidateGLB();}
 function updateGLBControls(){$('[data-action="exportGLB"]').disabled=restoring||shapeUnavailable||glbJob!==null;}
 function invalidateGLB(){
  glbToken++;const hadOutput=glbJob!==null||glbURL!==null,link=$('[data-action="glbDownload"]');link.hidden=true;link.removeAttribute('href');if(glbURL){URL.revokeObjectURL(glbURL);glbURL=null;}
  if(glbJob){glbJob.cancelled=true;glbJob.cancelLoad?.();}if(active&&hadOutput)$('[data-testid="paintGLBStatus"]').textContent=t.glbChanged;
 }
 function releaseGLB(job){
  if(job.released)return;job.released=true;
  for(const resource of [job.geometry,job.material,job.texture])try{resource?.dispose();}catch(error){console.warn('Artwork snapshot cleanup unavailable:',error);}
  if(job.canvas)job.canvas.width=job.canvas.height=0;job.mesh=job.geometry=job.material=job.texture=job.canvas=null;
 }
 function snapshotGLB(job){
  if(material.map!==texture||!texture.isCanvasTexture||texture.image!==canvas)throw new Error('Only the current self-painted CanvasTexture can be exported');
  for(const [key,value] of Object.entries(material))if(value?.isTexture&&(key!=='map'||value!==texture))throw new Error('Additional texture slots cannot be exported');
  job.canvas=document.createElement('canvas');job.canvas.width=512;job.canvas.height=256;const draw=job.canvas.getContext('2d');if(!draw)throw new Error('Canvas 2D snapshot unavailable');draw.drawImage(canvas,0,0);
  job.geometry=geometry.clone();job.material=material.clone();job.texture=new THREE.CanvasTexture(job.canvas);
  for(const key of ['wrapS','wrapT','colorSpace','flipY','minFilter','magFilter','generateMipmaps','anisotropy','rotation','mapping','channel','premultiplyAlpha'])job.texture[key]=texture[key];
  for(const key of ['offset','repeat','center'])job.texture[key].copy(texture[key]);job.material.map=job.texture;
  job.mesh=new THREE.Mesh(job.geometry,job.material);job.mesh.name='Original blue-and-white porcelain artwork';job.mesh.position.copy(vase.position);job.mesh.quaternion.copy(vase.quaternion);job.mesh.scale.copy(vase.scale);
  job.mesh.userData={creation:'User-created original vessel and pattern',disclaimer:'Artistic simulation. Relative design units; not a museum original or measured physical dimensions.'};job.mesh.updateMatrixWorld(true);
 }
 function loadGLBExporter(job){
  return new Promise((resolve,reject)=>{
   let settled=false;const finish=(error,module)=>{if(settled)return;settled=true;clearTimeout(timer);job.cancelLoad=null;error?reject(error):resolve(module);};
   const timer=setTimeout(()=>finish(new Error('Artwork exporter timed out')),4000);job.cancelLoad=()=>finish(new Error('Artwork export cancelled'));
   import('../vendor/three-exporter/examples/jsm/exporters/GLTFExporter.js').then(module=>finish(null,module),error=>finish(error));
  });
 }
 function updateHistory(){undo.disabled=restoring||history.size===0;redo.disabled=restoring||future.size===0;}
 function snapshot(){const base=ctx.getImageData(0,0,512,256);history.push(base);future.clear();updateHistory();invalidatePoster();return base;}
 function paintSettings(){return {tool:tool==='brush'?'brush':'flower',stamp:tool==='brush'?undefined:tool==='flower'?$('[data-control="motif"]').value:tool,stampSize:Number($('[data-control="stampSize"]').value),stampAngle:Number($('[data-control="stampAngle"]').value),stampRepeat:Number($('[data-control="stampRepeat"]').value),brushWidth:Number($('[data-control="width"]').value),density:Number($('[data-control="density"]').value),angle:currentAngle,glazed};}
 function artworkRaw(){return stringifyPaintDraft({...paintSettings(),png:canvas.toDataURL('image/png'),shapeJSON:currentShapeJSON});}
 function applyPaintSettings(draft){
  tool=['ring','disc','band'].includes(draft.stamp)?draft.stamp:draft.tool;
  $('[data-control="motif"]').value=['flower','plum','bamboo','cloud'].includes(draft.stamp)?draft.stamp:'flower';
  for(const [name,value] of [['stampSize',draft.stampSize??48],['stampAngle',draft.stampAngle??0],['stampRepeat',draft.stampRepeat??1],['width',draft.brushWidth],['density',draft.density]])$(`[data-control="${name}"]`).value=String(value);
  updateToolControls();currentAngle=draft.angle;angle.value=String(currentAngle);vase.rotation.y=Math.PI+currentAngle*Math.PI/180;glazed=draft.glazed;stableGlaze();
  for(const item of root.querySelectorAll('[data-tool]'))item.setAttribute('aria-pressed',String(item.dataset.tool===tool));
 }
 function invalidateArtwork(){
  const link=$('[data-action="artworkDownload"]');if(document.activeElement===link)$('[data-action="saveArtwork"]').focus({preventScroll:true});link.hidden=true;link.removeAttribute('href');
  if(artworkURL){URL.revokeObjectURL(artworkURL);artworkURL=null;$('[data-testid="paintArtworkStatus"]').textContent=files.changed;}
 }
 function flushDraft(){
  if(draftTimer!==null)clearTimeout(draftTimer);draftTimer=null;
  if(!draftDirty||restoring||!ctx)return;
  if(shapeUnavailable||draftProtected){draftStatus.textContent=t.shapePreserved;return;}
  try{
   const raw=artworkRaw();
   localStorage.setItem(paintDraftKey,raw);draftDirty=false;draftStatus.textContent=t.draftSaved;
  }catch{draftStatus.textContent=t.draftFailed;}
 }
 function queueDraft(){if(!active||restoring)return;invalidateArtwork();draftDirty=true;if(draftTimer!==null)clearTimeout(draftTimer);draftTimer=setTimeout(flushDraft,500);}
 function lockRestore(locked){
  restoring=locked;root.setAttribute('aria-busy',String(locked));
  for(const item of root.querySelectorAll('button,input,select'))item.disabled=locked;
  canvas.setAttribute('aria-disabled',String(locked));canvas.tabIndex=locked?-1:0;angle.disabled=locked||shapeUnavailable;poster.disabled=locked||posterJobToken!==null;$('[data-action="saveArtwork"]').disabled=locked||shapeUnavailable;updateHistory();updateSurfaceControls();updateGLBControls();
 }
 function stableGlaze(){if(material){material.roughness=glazed ? .22 : .64;material.clearcoat=glazed ? .87 : .12;}}
 function createClassicGeometry(){
  const outer=new THREE.SplineCurve([[0,-1.5],[.37,-1.5],[.42,-1.4],[.43,-1.18],[.65,-.72],[.72,.08],[.68,.7],[.49,1.02],[.24,1.2],[.23,1.42],[.3,1.47]].map(([x,y])=>new THREE.Vector2(x,y))).getPoints(40);
  const points=outer.concat([[.3,1.52],[.255,1.52],[.19,1.4],[.195,1.2],[.45,.95],[.62,.6],[.65,0],[.56,-.75],[.33,-1.3],[0,-1.3]].map(([x,y])=>new THREE.Vector2(x,y)));
  const result=new THREE.LatheGeometry(points,64),uv=result.attributes.uv;
  for(let i=0;i<uv.count;i++)uv.setY(i,(result.attributes.position.getY(i)+1.5)/3.02);
  return result;
 }
 function placeShape(custom){
  if(!custom){vase.position.y=0;pedestal.position.y=-1.56;pedestal.scale.set(1,1,1);return;}
  const box=geometry.boundingBox,height=box.max.y-box.min.y,positions=geometry.attributes.position;let foot=0;
  for(let i=0;i<positions.count;i++)if(positions.getY(i)<=box.min.y+height*.05)foot=Math.max(foot,Math.hypot(positions.getX(i),positions.getZ(i)));
  vase.position.y=-(box.min.y+box.max.y)/2;pedestal.position.y=box.min.y+vase.position.y-.06;
  const scale=Math.max(.4,foot+.12)/.65;pedestal.scale.set(scale,1,scale);
 }
 function shapeUI(key){root.dataset.shape=shapeUnavailable?'unavailable':shapeOwner?'custom':'classic';shapeNote.textContent=t[key];classicButton.hidden=!shapeOwner&&!shapeUnavailable&&!draftProtected;preview.hidden=shapeUnavailable;angle.disabled=restoring||shapeUnavailable;$('[data-action="saveArtwork"]').disabled=restoring||shapeUnavailable;updateSurfaceControls();updateGLBControls();}
 function useClassic(){
  if(shapeOwner){const next=createClassicGeometry(),previous=shapeOwner;geometry=next;vase.geometry=next;shapeOwner=null;previous.dispose();}
  currentShapeJSON=null;shapeUnavailable=false;draftProtected=false;if(material.side!==THREE.DoubleSide){material.side=THREE.DoubleSide;material.needsUpdate=true;}placeShape(false);shapeUI('shapeClassic');
 }
 function prepareCustom(text){
  let candidate;
  try{
   if(typeof createPotteryModel!=='function')throw new Error('Vessel factory unavailable');
   candidate=createPotteryModel({THREE,mobile:matchMedia('(max-width:700px)').matches,preset:'vase'});
   if(!candidate.restore(text))throw new Error('Invalid vessel design');
   const next=candidate.geometry;next.computeBoundingBox();const box=next.boundingBox;
   if(![box.min.x,box.min.y,box.min.z,box.max.x,box.max.y,box.max.z].every(Number.isFinite)||box.max.y<=box.min.y||!next.attributes.uv||!(next.attributes.position?.count>0))throw new Error('Invalid vessel geometry');
   return candidate;
  }catch(error){try{candidate?.dispose?.();}catch{}throw error;}
 }
 function useCustom(text){
  let candidate;try{candidate=prepareCustom(text);}catch(error){console.warn('Paint vessel unavailable:',error);return false;}
  const previousOwner=shapeOwner,previousGeometry=geometry;geometry=candidate.geometry;vase.geometry=geometry;shapeOwner=candidate;currentShapeJSON=text;shapeUnavailable=false;if(material.side!==THREE.FrontSide){material.side=THREE.FrontSide;material.needsUpdate=true;}placeShape(true);shapeUI('shapeCustom');
  if(previousOwner)previousOwner.dispose();else previousGeometry.dispose();return true;
 }
 function chooseShape(savedShape=null){
  const explicit=typeof shapeJSON==='string',desired=explicit?shapeJSON:savedShape;
  if(desired===null){useClassic();return false;}
  if(typeof createPotteryModel==='function'){
   if(useCustom(desired))return explicit;
   if(explicit&&savedShape===null){useClassic();shapeUI('shapeFailed');return false;}
   if(explicit&&savedShape!==desired&&useCustom(savedShape)){shapeUI('shapeFailed');return false;}
  }
  currentShapeJSON=desired;shapeUnavailable=true;shapeUI('shapeUnavailable');return false;
 }
 function restoreDraft(){
  let raw;try{raw=localStorage.getItem(paintDraftKey);if(raw===null)raw=localStorage.getItem(legacyPaintDraftKey);}catch{chooseShape();draftProtected=true;shapeUI(shapeUnavailable?'shapeUnavailable':shapeOwner?'shapeCustom':'shapeClassic');scheduleRender();draftStatus.textContent=t.draftInvalid;return;}
  if(raw===null){const applied=chooseShape();scheduleRender();if(shapeUnavailable)draftStatus.textContent=t.shapePreserved;if(applied)queueDraft();return;}
  const draft=parsePaintDraft(raw);
  if(!draft){chooseShape();draftProtected=true;shapeUI(shapeUnavailable?'shapeUnavailable':shapeOwner?'shapeCustom':'shapeClassic');scheduleRender();draftStatus.textContent=t.draftInvalid;return;}
  lockRestore(true);draftStatus.textContent=t.draftRestoring;
  const image=new Image();restoreImage=image;
  const finish=success=>{
   if(!active||restoreImage!==image)return;
   if(restoreTimer!==null)clearTimeout(restoreTimer);restoreTimer=null;restoreImage=null;image.onload=image.onerror=null;
   let restored=false;
   if(success&&image.naturalWidth===512&&image.naturalHeight===256){
    try{
     ctx.drawImage(image,0,0);applyPaintSettings(draft);
     history.clear();future.clear();textureDirty=true;restored=true;
    }catch{}
   }
   const applied=chooseShape(draft.version===2?draft.shapeJSON:null);
   if(!restored){draftProtected=true;shapeUI(shapeUnavailable?'shapeUnavailable':shapeOwner?'shapeCustom':'shapeClassic');}
   lockRestore(false);scheduleRender();
   draftStatus.textContent=shapeUnavailable?t.shapePreserved:restored?t.draftRestored:t.draftInvalid;
   if(applied&&restored)queueDraft();if(!restored)image.src='';
  };
  image.onload=()=>finish(true);image.onerror=()=>finish(false);restoreTimer=setTimeout(()=>finish(false),2000);image.src=draft.png;
 }
 function currentArtworkJob(job){return active&&!suspended&&artworkJob===job&&!job.cancelled;}
 function releaseArtworkJob(job){
  clearTimeout(job.timer);job.decodeAbort?.abort();job.cancelDecode?.();job.cancelDecode=null;
  if(job.image){job.image.onload=job.image.onerror=null;job.image.src='';job.image=null;}
  if(job.canvas){job.canvas.width=job.canvas.height=0;job.canvas=null;}
  try{if(job.owner)job.owner.dispose();else job.geometry?.dispose();}catch(error){console.warn('Artwork candidate cleanup unavailable:',error);}job.owner=job.geometry=null;
 }
 function cancelArtwork(){
  const job=artworkJob;if(!job)return;job.cancelled=true;job.cancel();artworkJob=null;releaseArtworkJob(job);lockRestore(false);$('[data-testid="paintArtworkStatus"]').textContent=files.cancelled;
 }
 async function prepareArtwork(file,job){
  const raw=await file.text();if(!currentArtworkJob(job))throw new Error('Artwork opening cancelled');
  if(typeof raw!=='string'||raw.length>1700000||new TextEncoder().encode(raw).byteLength>1700000)throw new Error('Artwork file too large');
  const draft=parsePaintDraft(raw);job.decodeAbort=new AbortController();if(!draft||!await validatePaintPNG(draft.png,job.decodeAbort.signal)||!currentArtworkJob(job))throw new Error('Invalid artwork document');
  const image=new Image();job.image=image;
  await new Promise((resolve,reject)=>{job.cancelDecode=()=>reject(new Error('Artwork decoding cancelled'));image.onload=resolve;image.onerror=()=>reject(new Error('Invalid artwork PNG'));image.src=draft.png;});
  if(!currentArtworkJob(job)||image.naturalWidth!==512||image.naturalHeight!==256)throw new Error('Invalid artwork image');
  image.onload=image.onerror=null;job.cancelDecode=null;job.canvas=document.createElement('canvas');job.canvas.width=512;job.canvas.height=256;
  const draw=job.canvas.getContext('2d');if(!draw)throw new Error('Artwork canvas unavailable');draw.drawImage(image,0,0);const pixels=draw.getImageData(0,0,512,256);
  if(draft.version===2&&draft.shapeJSON!==null){job.owner=prepareCustom(draft.shapeJSON);job.geometry=job.owner.geometry;}else job.geometry=createClassicGeometry();
  return {draft,pixels};
 }
 function commitArtwork(job,{draft,pixels}){
  const previous={pixels:ctx.getImageData(0,0,512,256),geometry,owner:shapeOwner,shape:currentShapeJSON,unavailable:shapeUnavailable,protected:draftProtected,settings:paintSettings(),motif:$('[data-control="motif"]').value,note:shapeNote.textContent,side:material.side};
  try{
   ctx.putImageData(pixels,0,0);geometry=job.geometry;vase.geometry=geometry;shapeOwner=job.owner||null;currentShapeJSON=draft.version===2?draft.shapeJSON:null;shapeUnavailable=false;draftProtected=false;
   material.side=shapeOwner?THREE.FrontSide:THREE.DoubleSide;material.needsUpdate=true;placeShape(Boolean(shapeOwner));applyPaintSettings(draft);shapeUI(shapeOwner?'shapeCustom':'shapeClassic');
  }catch(error){
   geometry=previous.geometry;vase.geometry=geometry;shapeOwner=previous.owner;currentShapeJSON=previous.shape;shapeUnavailable=previous.unavailable;draftProtected=previous.protected;material.side=previous.side;material.needsUpdate=true;
   ctx.putImageData(previous.pixels,0,0);placeShape(Boolean(shapeOwner));applyPaintSettings(previous.settings);$('[data-control="motif"]').value=previous.motif;shapeUI(shapeUnavailable?'shapeUnavailable':shapeOwner?'shapeCustom':'shapeClassic');shapeNote.textContent=previous.note;throw error;
  }
  job.geometry=job.owner=null;history.clear();future.clear();textureDirty=true;invalidatePoster();invalidateArtwork();draftDirty=true;
  try{if(previous.owner)previous.owner.dispose();else previous.geometry.dispose();}catch(error){console.warn('Previous artwork cleanup unavailable:',error);}
  // Store only after the complete document is live; quota failures keep the previous raw draft.
  try{localStorage.setItem(paintDraftKey,artworkRaw());draftDirty=false;draftStatus.textContent=t.draftSaved;return files.imported;}catch{draftStatus.textContent=t.draftFailed;return files.unsaved;}
 }
 async function openArtwork(file){
  if(!active||suspended||restoring||artworkJob||!file)return;
  const fileStatus=$('[data-testid="paintArtworkStatus"]');
  if(!Number.isSafeInteger(file.size)||file.size<1||file.size>1700000){fileStatus.textContent=files.failed;return;}
  finishStroke();finishRotation();stopGlaze();const job={pendingDraft:draftTimer!==null,cancelled:false,owner:null,geometry:null};
  if(draftTimer!==null)clearTimeout(draftTimer);draftTimer=null;artworkJob=job;lockRestore(true);fileStatus.textContent=files.preparing;
  const cancellation=new Promise((resolve,reject)=>{job.cancel=()=>reject(new Error('Artwork opening cancelled or timed out'));});job.timer=setTimeout(job.cancel,8000);let committed=false;
  try{const result=await Promise.race([prepareArtwork(file,job),cancellation]);if(!currentArtworkJob(job))return;fileStatus.textContent=commitArtwork(job,result);committed=true;setStatus(t.painted);}
  catch(error){if(currentArtworkJob(job)){fileStatus.textContent=files.failed;console.warn('Artwork file unavailable; current document preserved:',error);}}
  finally{
   releaseArtworkJob(job);if(artworkJob===job){artworkJob=null;lockRestore(false);if(!committed&&job.pendingDraft&&draftDirty)draftTimer=setTimeout(flushDraft,500);scheduleRender();}
  }
 }
 function saveArtwork(){
  if(!active||suspended||restoring||shapeUnavailable)return;finishStroke();finishRotation();stopGlaze();
  try{
   const next=URL.createObjectURL(new Blob([artworkRaw()],{type:'application/json;charset=utf-8'}));invalidateArtwork();artworkURL=next;
   const link=$('[data-action="artworkDownload"]');link.href=next;link.download='qinghua-editable-artwork.json';link.hidden=false;$('[data-testid="paintArtworkStatus"]').textContent=files.saved;
  }catch(error){$('[data-testid="paintArtworkStatus"]').textContent=files.saveFailed;console.warn('Editable artwork unavailable:',error);}
 }
 function travelHistory(from,to){
  if(restoring)return;finishStroke();const frame=from.pop();
  if(frame){to.push(ctx.getImageData(0,0,512,256));stopGlaze();ctx.putImageData(frame,0,0);textureDirty=true;invalidatePoster();queueDraft();scheduleRender();setStatus(renderFailed?t.renderError:t.painted);}
  updateHistory();
 }
 function render(){
  renderTimer=null;if(!active||suspended||!scene||renderFailed||shapeUnavailable)return;
  try{if(textureDirty){texture.needsUpdate=true;textureDirty=false;}renderPreview(scene,camera,preview);lastRender=performance.now();}catch(error){renderFailed=true;updateSurfaceControls();setStatus(t.renderError);console.warn('Paint preview unavailable:',error);}
 }
 function scheduleRender(){if(!active||suspended||renderFailed||renderTimer!==null)return;const delay=Math.max(0,125-(performance.now()-lastRender));if(delay===0)render();else renderTimer=setTimeout(render,delay);}
 function drawBrush(from,to,width,density){
  ctx.strokeStyle=`rgba(31,63,143,${density/100})`;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';
  for(const offset of [-512,0,512]){ctx.beginPath();ctx.moveTo(from.x+offset,from.y);ctx.lineTo(to.x+offset,to.y);ctx.stroke();}
  textureDirty=true;
 }
 function disableBrush(error){
  brushDisabled=true;brushFactory=null;root.dataset.brush='classic';if(stroke)stroke.brush=null;
  if(inkRAF!==null)cancelAnimationFrame(inkRAF);inkRAF=null;inkDirty=false;
  try{naturalBrush?.dispose();}catch{}naturalBrush=null;
  console.warn('Natural brush unavailable; standard brush remains available:',error);
 }
 function fallbackInk(){if(!stroke||stroke.tool!=='brush'||!stroke.last)return;const from=stroke.rendered||stroke.last,to=from.x===stroke.last.x&&from.y===stroke.last.y?{x:stroke.last.x+.01,y:stroke.last.y}:stroke.last;drawBrush(from,to,stroke.width,stroke.density);stroke.rendered=stroke.last;}
 function flushInk(){
  if(inkRAF!==null)cancelAnimationFrame(inkRAF);inkRAF=null;
  if(!active||!stroke||!inkDirty)return;inkDirty=false;
  try{if(stroke.brush?.render()){textureDirty=true;stroke.rendered=stroke.last;scheduleRender();}}
  catch(error){disableBrush(error);fallbackInk();scheduleRender();}
 }
 function scheduleInk(){inkDirty=true;if(inkRAF===null)inkRAF=requestAnimationFrame(flushInk);}
 function brushPoint(event,rect,pen=event?.pointerType==='pen'){
  if(!event)return null;
  const point=canvasPoint(event,rect,512,256);if(!point)return null;
  point.pressure=pen&&Number.isFinite(event.pressure)?Math.max(0,Math.min(1,event.pressure)):.5;
  return point;
 }
 function surfaceAvailable(){return !restoring&&!renderFailed&&!shapeUnavailable&&!surfaceDisabled;}
 function updateSurfaceControls(){
  const available=surfaceAvailable();$('[data-preview-mode="surface"]').disabled=!available;$('[data-preview-mode="rotate"]').disabled=restoring;
  $('[data-testid="paintSurfaceNote"]').textContent=renderFailed||shapeUnavailable?t.surfaceUnavailable:surfaceDisabled?t.surfaceFailed:previewMode==='surface'?t.surfaceHint:t.rotateHint;
  preview.style.cursor=previewMode==='surface'&&available?'crosshair':'grab';preview.setAttribute('aria-disabled',String(!available&&previewMode==='surface'));
 }
 function beginPaint(point,event,source){
  if(restoring||suspended||stroke)return;stopGlaze();const base=snapshot(),owner=source==='surface'?preview:canvas;
  stroke={id:event.pointerId,source,owner,last:point,rendered:point,tool,width:Number($('[data-control="width"]').value),density:Number($('[data-control="density"]').value),pen:event.pointerType==='pen',brush:null,motif:$('[data-control="motif"]').value,size:Number($('[data-control="stampSize"]').value),rotation:Number($('[data-control="stampAngle"]').value),repeat:Number($('[data-control="stampRepeat"]').value)};try{owner.setPointerCapture(event.pointerId);}catch{}
  if(stroke.tool!=='brush'){stamp(point,stroke);scheduleRender();return;}
  if(brushFactory&&!brushDisabled)try{naturalBrush ||= brushFactory(canvas);if(!naturalBrush.begin(point,{base,width:stroke.width,density:stroke.density,pen:stroke.pen}))throw new Error('Natural brush could not start');stroke.brush=naturalBrush;}catch(error){disableBrush(error);}
  if(stroke.brush)scheduleInk();else{drawBrush(point,{x:point.x+.01,y:point.y},stroke.width,stroke.density);scheduleRender();}
 }
 function movePaint(point){
  if(!stroke)return;
  if(stroke.tool==='brush'){
   if(stroke.brush)try{if(stroke.brush.move(point))scheduleInk();}catch(error){disableBrush(error);const from=stroke.rendered||stroke.last||point;drawBrush(from,from===point?{x:point.x+.01,y:point.y}:point,stroke.width,stroke.density);stroke.rendered=point;scheduleRender();}
   else{const from=stroke.last||point;drawBrush(from,stroke.last?point:{x:point.x+.01,y:point.y},stroke.width,stroke.density);stroke.rendered=point;scheduleRender();}
  }
  stroke.last=point;
 }
 function breakPaintSegment(){
  if(!stroke||!stroke.last)return;
  if(stroke.brush)try{if(stroke.brush.breakSegment())scheduleInk();}catch(error){disableBrush(error);fallbackInk();scheduleRender();}
  stroke.last=stroke.rendered=null;
 }
 function screenSample(event,pen){if(!event||!Number.isFinite(event.clientX)||!Number.isFinite(event.clientY))return null;return {clientX:event.clientX,clientY:event.clientY,pressure:pen&&Number.isFinite(event.pressure)?Math.max(0,Math.min(1,event.pressure)):.5};}
 function sampleEvents(event,limit){
  let samples;try{samples=event.getCoalescedEvents?.();}catch{}samples=Array.isArray(samples)&&samples.length?samples.slice(-limit):[event];
  const last=samples[samples.length-1];if(last?.clientX!==event.clientX||last?.clientY!==event.clientY||last?.pressure!==event.pressure)samples=[...samples.slice(1-limit),event];return samples;
 }
 function pickSurface(sample){
  const rect=preview.getBoundingClientRect();if(!(rect.width>0&&rect.height>0)||sample.clientX<rect.left||sample.clientX>rect.right||sample.clientY<rect.top||sample.clientY>rect.bottom)return null;
  scene.updateMatrixWorld(true);camera.updateMatrixWorld();rayPosition.set((sample.clientX-rect.left)/rect.width*2-1,1-(sample.clientY-rect.top)/rect.height*2);raycaster.setFromCamera(rayPosition,camera);rayHits.length=0;raycaster.intersectObject(vase,false,rayHits);
  const point=uvToCanvasPoint(rayHits[0]?.uv);if(point)point.pressure=sample.pressure;return point;
 }
 function flushSurface(){
  if(surfaceRAF!==null)cancelAnimationFrame(surfaceRAF);surfaceRAF=null;
  if(!active||!surfacePointer||!surfaceAvailable()){surfaceSamples=[];return;}
  let samples=surfaceSamples;surfaceSamples=[];
  if(samples.length===1&&surfacePointer.screen){const from=surfacePointer.screen,to=samples[0],distance=Math.hypot(to.clientX-from.clientX,to.clientY-from.clientY),count=Math.min(4,Math.max(1,Math.ceil(distance/16)));samples=Array.from({length:count},(_,index)=>({...to,clientX:from.clientX+(to.clientX-from.clientX)*(index+1)/count,clientY:from.clientY+(to.clientY-from.clientY)*(index+1)/count}));}
  for(const sample of samples){
   let point;try{point=pickSurface(sample);}catch(error){surfaceDisabled=true;surfaceSamples=[];updateSurfaceControls();breakPaintSegment();setStatus(t.surfaceFailed);console.warn('Surface painting unavailable; flat painting remains available:',error);return;}
   if(!point){breakPaintSegment();surfacePointer.screen=null;continue;}
   surfacePointer.screen=sample;
   if(!stroke){beginPaint(point,surfacePointer.event,'surface');continue;}
   if(stroke.last){const x=unwrapCanvasX(point.x,stroke.last.x),distance=x===null?Infinity:Math.hypot(x-stroke.last.x,point.y-stroke.last.y);if(x===null||Math.abs(x)>1536||distance>96)breakPaintSegment();else point.x=x;}
   movePaint(point);
  }
 }
 function queueSurface(event){
  if(!surfacePointer||event.pointerId!==surfacePointer.id||!surfaceAvailable())return;
  const samples=sampleEvents(event,4).map(sample=>screenSample(sample,surfacePointer.pen)).filter(Boolean),all=surfaceSamples.concat(samples);
  surfaceSamples=all.length<=4?all:[all[0],all[Math.floor((all.length-1)/3)],all[Math.floor((all.length-1)*2/3)],all[all.length-1]];
  if(surfaceSamples.length&&surfaceRAF===null)surfaceRAF=requestAnimationFrame(flushSurface);
 }
 function updateStampSample(){
  const visible=tool!=='brush'&&tool!=='band'&&!stampSampleFailed;stampSampleGroup.hidden=!visible;
  if(!visible||!active||suspended||document.visibilityState==='hidden')return;
  const motif=tool==='flower'?$('[data-control="motif"]').value:tool,size=Number($('[data-control="stampSize"]').value),width=tool==='disc'?0:Number($('[data-control="width"]').value)*(tool==='flower'?.18:1),density=Number($('[data-control="density"]').value),rotation=tool==='flower'?Number($('[data-control="stampAngle"]').value):0;
  const key=[motif,size,width,density,rotation].join('/');if(key===stampSampleKey)return;
  try{
   stampSampleContext??=stampSample.getContext('2d');if(!stampSampleContext)throw new Error('Stamp sample canvas unavailable');
   const draw=stampSampleContext;draw.fillStyle='#faf7ed';draw.fillRect(0,0,192,192);draw.save();
   try{draw.translate(96,96);const scale=80/Math.max(size,width+4);draw.scale(scale,scale);paintStamp(draw,{x:0,y:0},{motif,size,width,density,rotation});}finally{draw.restore();}
   stampSampleKey=key;
  }catch(error){stampSampleFailed=true;stampSampleGroup.hidden=true;stampSample.width=stampSample.height=0;stampSampleContext=null;console.warn('Stamp sample unavailable:',error);}
 }
 function updateToolControls(){
  $('[data-motif-field]').hidden=tool!=='flower';$('[data-size-field]').hidden=tool==='brush'||tool==='band';$('[data-stamp-angle-field]').hidden=tool!=='flower';$('[data-repeat-field]').hidden=tool==='brush'||tool==='band';
  for(const name of ['width','stampSize','density','stampAngle'])$(`[data-value="${name}"]`).textContent=$(`[data-control="${name}"]`).value+(name==='density'?'%':name==='stampAngle'?'°':'');
  updateStampSample();
 }
 function stamp(point,settings={tool,width:Number($('[data-control="width"]').value),density:Number($('[data-control="density"]').value),motif:$('[data-control="motif"]').value,size:Number($('[data-control="stampSize"]').value),rotation:Number($('[data-control="stampAngle"]').value),repeat:Number($('[data-control="stampRepeat"]').value)}){
  if(settings.tool==='band')paintBand(ctx,point.y,settings);
  else for(let index=0;index<settings.repeat;index++)paintStamp(ctx,{x:point.x+index*512/settings.repeat,y:point.y},{...settings,width:settings.tool==='flower'?settings.width*.18:settings.width,motif:settings.tool==='flower'?settings.motif:settings.tool});
  textureDirty=true;
 }
 function applyTemplate(){
  if(restoring||suspended)return;let candidate;
  try{
   candidate=document.createElement('canvas');candidate.width=512;candidate.height=256;const draw=candidate.getContext('2d');if(!draw)throw new Error('Template canvas unavailable');
   paintTemplate(draw,templateName,{density:Number($('[data-control="density"]').value)});
   finishStroke();finishRotation();stopGlaze();snapshot();ctx.drawImage(candidate,0,0);textureDirty=true;queueDraft();scheduleRender();setStatus(renderFailed?t.renderError:labels.applied);
  }catch(error){setStatus(labels.failed);console.warn('Porcelain template unavailable:',error);}
  finally{if(candidate)candidate.width=candidate.height=0;}
 }
 function suspend(){if(!active||suspended)return;cancelArtwork();suspended=true;flushOnLeave();stopGlaze();if(renderTimer!==null)clearTimeout(renderTimer);renderTimer=null;}
 function resume(){if(!active||!suspended)return;suspended=false;updateStampSample();scheduleRender();}
 function finishStroke(event){
  const id=stroke?.id??surfacePointer?.id;if(id===undefined||event&&event.pointerId!==undefined&&event.pointerId!==id)return;flushSurface();
  const owner=stroke?.owner||preview;surfacePointer=null;surfaceSamples=[];
  if(!stroke){try{owner.releasePointerCapture(id);}catch{}return;}
  if(inkRAF!==null)cancelAnimationFrame(inkRAF);inkRAF=null;inkDirty=false;
  if(stroke.brush)try{if(stroke.brush.finish())textureDirty=true;}catch(error){disableBrush(error);fallbackInk();}
  stroke=null;try{owner.releasePointerCapture(id);}catch{}queueDraft();scheduleRender();setStatus(renderFailed?t.renderError:t.painted);
 }
 function finishRotation(event){if(!rotation||event&&event.pointerId!==undefined&&event.pointerId!==rotation.id)return;const id=rotation.id;rotation=null;try{preview.releasePointerCapture(id);}catch{}}
 function setAngle(value){if(!Number.isFinite(value)||value===currentAngle)return;finishStroke();currentAngle=value;angle.value=String(value);if(vase){vase.rotation.y=Math.PI+value*Math.PI/180;invalidatePoster();queueDraft();scheduleRender();}}
 function stopGlaze(){if(glazeTimer!==null){clearTimeout(glazeTimer);glazeTimer=null;stableGlaze();scheduleRender();}glaze.disabled=restoring;}
 function flushOnLeave(){cancelArtwork();finishStroke();finishRotation();flushDraft();}
 function dispose(){
  if(!active)return;flushOnLeave();active=false;lifetime.abort();
  if(restoreTimer!==null)clearTimeout(restoreTimer);restoreTimer=null;
  if(restoreImage){restoreImage.onload=restoreImage.onerror=null;restoreImage.src='';restoreImage=null;}
  if(renderTimer!==null)clearTimeout(renderTimer);stopGlaze();invalidatePoster();invalidateArtwork();history.clear();future.clear();
  if(inkRAF!==null)cancelAnimationFrame(inkRAF);inkRAF=null;inkDirty=false;try{naturalBrush?.dispose();}catch{}naturalBrush=null;brushFactory=null;
  if(surfaceRAF!==null)cancelAnimationFrame(surfaceRAF);surfaceRAF=null;surfacePointer=null;surfaceSamples=[];rayHits.length=0;raycaster=rayPosition=null;
  stampSample.width=stampSample.height=0;stampSampleContext=null;
  texture?.dispose();if(shapeOwner)shapeOwner.dispose();else geometry?.dispose();material?.dispose();pedestalGeometry?.dispose();pedestalMaterial?.dispose();root.remove();
 }
 try{
  if(!ctx)throw new Error('Canvas 2D unavailable');fillBlank();
  scene=new THREE.Scene();scene.background=new THREE.Color(0x0b1426);camera=new THREE.PerspectiveCamera(33,1,.1,30);camera.position.set(0,.4,7);camera.lookAt(0,0,0);
  scene.add(new THREE.HemisphereLight(0xdce9ff,0x2c3553,2.1));const key=new THREE.DirectionalLight(0xffffff,2.2);key.position.set(-3,4,4);scene.add(key);const rim=new THREE.DirectionalLight(0x729fff,1.6);rim.position.set(3,1,-2);scene.add(rim);
  geometry=createClassicGeometry();
  texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=THREE.RepeatWrapping;texture.anisotropy=2;
  material=new THREE.MeshPhysicalMaterial({map:texture,color:0xffffff,roughness:.64,metalness:0,clearcoat:.12,clearcoatRoughness:.18,side:THREE.DoubleSide});vase=new THREE.Mesh(geometry,material);vase.name='museum-paint-vessel';vase.rotation.y=Math.PI;scene.add(vase);
  pedestalGeometry=new THREE.CylinderGeometry(.65,.72,.12,48);pedestalMaterial=new THREE.MeshStandardMaterial({color:0x283c60,roughness:.8});pedestal=new THREE.Mesh(pedestalGeometry,pedestalMaterial);pedestal.name='museum-paint-pedestal';pedestal.position.y=-1.56;scene.add(pedestal);
  listen($('[data-action="saveArtwork"]'),'click',saveArtwork);
  listen($('[data-action="importArtwork"]'),'change',event=>{const file=event.target.files?.[0];event.target.value='';void openArtwork(file);});
  listen(classicButton,'click',()=>{if(restoring)return;finishStroke();finishRotation();stopGlaze();useClassic();invalidatePoster();queueDraft();scheduleRender();});
  listen(canvas,'pointerdown',event=>{
   if(restoring||stroke||surfacePointer||!event.isPrimary||event.button!==0)return;const point=brushPoint(event,canvas.getBoundingClientRect());if(!point)return;event.preventDefault();beginPaint(point,event,'flat');
  });
  listen(canvas,'pointermove',event=>{
   if(!stroke||stroke.source!=='flat'||event.pointerId!==stroke.id)return;if(event.pointerType==='mouse'&&event.buttons!==1){finishStroke(event);return;}event.preventDefault();const samples=sampleEvents(event,8);
   const rect=canvas.getBoundingClientRect();
   for(const sample of samples){const point=brushPoint(sample,rect,stroke.pen);if(point)movePaint(point);}
  });
  for(const type of ['pointerup','pointercancel','lostpointercapture'])listen(canvas,type,event=>{if(stroke?.source==='flat')finishStroke(event);});
  for(const button of root.querySelectorAll('[data-preview-mode]'))listen(button,'click',()=>{
   if(restoring||previewMode===button.dataset.previewMode)return;finishStroke();finishRotation();
   if(button.dataset.previewMode==='surface')try{raycaster ||= new THREE.Raycaster();rayPosition ||= new THREE.Vector2();}catch(error){surfaceDisabled=true;updateSurfaceControls();setStatus(t.surfaceFailed);return;}
   previewMode=button.dataset.previewMode;root.dataset.previewMode=previewMode;for(const item of root.querySelectorAll('[data-preview-mode]'))item.setAttribute('aria-pressed',String(item===button));updateSurfaceControls();
  });
  listen(preview,'pointerdown',event=>{
   if(restoring||rotation||stroke||surfacePointer||!event.isPrimary||event.button!==0)return;event.preventDefault();
   if(previewMode==='surface'){if(!surfaceAvailable())return;surfacePointer={id:event.pointerId,pen:event.pointerType==='pen',event:{pointerId:event.pointerId,pointerType:event.pointerType},screen:null};try{preview.setPointerCapture(event.pointerId);}catch{}queueSurface(event);return;}
   rotation={id:event.pointerId,x:event.clientX,angle:Number(angle.value)};try{preview.setPointerCapture(event.pointerId);}catch{}
  });
  listen(preview,'pointermove',event=>{
   if(surfacePointer){if(event.pointerId!==surfacePointer.id)return;if(event.pointerType==='mouse'&&event.buttons!==1){finishStroke(event);return;}event.preventDefault();queueSurface(event);return;}
   if(!rotation||event.pointerId!==rotation.id)return;event.preventDefault();const width=Math.max(1,preview.getBoundingClientRect().width),value=rotation.angle+(event.clientX-rotation.x)*300/width;setAngle(((value+180)%360+360)%360-180);
  });
  for(const type of ['pointerup','pointercancel','lostpointercapture'])listen(preview,type,event=>{if(surfacePointer||stroke?.source==='surface')finishStroke(event);finishRotation(event);});
  listen(root,'pointerdown',event=>{
   if(!active||suspended||restoring||!event.isPrimary||event.button!==0)return;
   const target=event.target;if(target===canvas||target===preview)target.focus({preventScroll:true});
  });
  // WebKit may reset button focus after pointerdown; keep action focus local after click.
  listen(root,'click',event=>{
   if(!active||suspended||restoring)return;
   const target=event.target;if(target.isContentEditable||target.closest?.('input,select,textarea,[contenteditable]:not([contenteditable="false"])'))return;
   const focus=target.closest?.('button,a[href]');if(focus&&root.contains(focus))(focus.disabled?canvas:focus).focus({preventScroll:true});
  });
  listen(window,'blur',()=>{finishStroke();finishRotation();});listen(angle,'input',()=>{if(!restoring){finishRotation();setAngle(Number(angle.value));}});
  listen(window,'pagehide',flushOnLeave);listen(document,'visibilitychange',()=>{if(document.visibilityState==='hidden')flushOnLeave();else updateStampSample();});
  for(const control of root.querySelectorAll('[data-control="width"],[data-control="density"],[data-control="motif"],[data-control="stampSize"],[data-control="stampAngle"],[data-control="stampRepeat"]'))listen(control,'input',()=>{if(restoring)return;finishStroke();updateToolControls();queueDraft();});
  for(const button of root.querySelectorAll('[data-tool]'))listen(button,'click',()=>{if(restoring||tool===button.dataset.tool)return;finishStroke();tool=button.dataset.tool;updateToolControls();for(const item of root.querySelectorAll('[data-tool]'))item.setAttribute('aria-pressed',String(item===button));queueDraft();});
  for(const button of root.querySelectorAll('[data-template]')){
   const swatch=button.querySelector('canvas');try{const draw=swatch.getContext('2d');if(draw){draw.scale(144/512,72/256);paintTemplate(draw,button.dataset.template);}}catch(error){swatch.hidden=true;console.warn('Pattern preview unavailable:',error);}
   listen(button,'click',()=>{if(restoring)return;templateName=button.dataset.template;for(const item of root.querySelectorAll('[data-template]'))item.setAttribute('aria-pressed',String(item===button));});
  }
  listen($('[data-action="applyTemplate"]'),'click',applyTemplate);updateToolControls();
  listen(undo,'click',()=>travelHistory(history,future));listen(redo,'click',()=>travelHistory(future,history));
  listen($('[data-action="clear"]'),'click',()=>{if(restoring)return;finishStroke();stopGlaze();snapshot();fillBlank();queueDraft();scheduleRender();setStatus(renderFailed?t.renderError:t.cleared);});
  listen(root,'keydown',event=>{
   if(!active||suspended||restoring||event.defaultPrevented||event.isComposing||event.keyCode===229||event.altKey||!(event.ctrlKey||event.metaKey))return;
   const target=event.target;if(target.isContentEditable||target.closest?.('input,select,textarea,[contenteditable]:not([contenteditable="false"])'))return;
   const key=event.key.toLowerCase();if(key!=='z'&&key!=='y')return;
   event.preventDefault();(key==='y'||event.shiftKey?redo:undo).click();
  });
  listen(canvas,'keydown',event=>{
   if(restoring)return;
   if(tool!=='brush'&&(event.key==='Enter'||event.key===' ')){event.preventDefault();finishStroke();stopGlaze();snapshot();stamp({x:256,y:128});queueDraft();scheduleRender();setStatus(renderFailed?t.renderError:t.painted);}
  });
  listen(glaze,'click',()=>{
   if(restoring)return;finishStroke();stopGlaze();invalidatePoster();glaze.disabled=true;const start=performance.now(),reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
   const tick=()=>{if(!active)return;const progress=reduced?1:Math.min(1,(performance.now()-start)/1000),eased=progress*progress*(3-2*progress);material.roughness=.75-.53*eased;material.clearcoat=.12+.75*eased;scheduleRender();if(progress<1)glazeTimer=setTimeout(tick,125);else{glazeTimer=null;glazed=true;glaze.disabled=false;queueDraft();setStatus(renderFailed?t.renderError:t.glazed);}};tick();
  });
  listen(poster,'click',async()=>{
   if(restoring||posterJobToken!==null)return;finishStroke();finishRotation();stopGlaze();const token=++saveToken;posterJobToken=token;poster.disabled=true;
   try{
    if(!renderFailed&&!shapeUnavailable)render();const sheet=document.createElement('canvas');sheet.width=1280;sheet.height=900;const draw=sheet.getContext('2d');if(!draw)throw new Error('Canvas 2D unavailable');
    draw.fillStyle='#0b1426';draw.fillRect(0,0,1280,900);draw.strokeStyle='#7da8eb';draw.lineWidth=2;draw.strokeRect(24,24,1232,852);draw.fillStyle='#eaf2ff';draw.font='bold 42px sans-serif';draw.fillText(t.posterTitle,64,95);draw.fillStyle='#a9c9ff';draw.font='22px sans-serif';draw.fillText(t.posterSub,64,137);
    if(!renderFailed&&!shapeUnavailable)draw.drawImage(preview,36,182,630,630);else{draw.fillStyle='#a9c9ff';draw.font='24px sans-serif';draw.fillText(t.flat,80,360);}
    draw.fillStyle='#a9c9ff';draw.font='24px sans-serif';draw.fillText(t.flat,710,264);draw.drawImage(canvas,710,292,512,256);draw.strokeStyle='#7da8eb';draw.strokeRect(710,292,512,256);draw.font='20px sans-serif';draw.fillText(language==='en'?'Cobalt on a canvas. A pattern made by you.':'以钴蓝落笔，让纹样环绕器形。',710,602);draw.fillText(language==='en'?'An original digital creation.':'这一笔，属于你的数字青花。',710,638);draw.fillStyle='#aebbd0';draw.font='18px sans-serif';draw.fillText(shapeUnavailable?t.posterFlatFoot:shapeOwner?t.posterShapeFoot:t.posterFoot,64,841,1152);
    const blob=await new Promise((resolve,reject)=>sheet.toBlob(value=>value?resolve(value):reject(new Error('PNG encoding failed')),'image/png'));if(!active||token!==saveToken)return;
    const nextURL=URL.createObjectURL(blob);if(downloadURL)URL.revokeObjectURL(downloadURL);downloadURL=nextURL;download.href=downloadURL;download.download='qinghua-user-creation.png';download.hidden=false;posterImage.src=downloadURL;posterImage.hidden=false;setStatus(t.saved);
   }catch(error){if(active&&token===saveToken)setStatus(t.saveError);console.warn('Paint poster unavailable:',error);}finally{if(posterJobToken===token){posterJobToken=null;if(active)poster.disabled=restoring;}}
  });
  listen($('[data-action="exportGLB"]'),'click',async()=>{
   if(restoring||shapeUnavailable||glbJob)return;if(glbParseOwner!==null){$('[data-testid="paintGLBStatus"]').textContent=t.glbBusy;return;}finishStroke();finishRotation();stopGlaze();invalidateGLB();
   const job={token:++glbToken,cancelled:false,released:false,phase:'snapshot',cancelLoad:null};glbJob=job;updateGLBControls();const glbStatus=$('[data-testid="paintGLBStatus"]');glbStatus.textContent=t.glbPreparing;
   try{
    snapshotGLB(job);job.phase='loading';const module=await loadGLBExporter(job);if(!active||job.cancelled||job.token!==glbToken)return;
    if(typeof module.GLTFExporter!=='function')throw new Error('Artwork exporter unavailable');if(glbParseOwner!==null){glbStatus.textContent=t.glbBusy;return;}job.phase='parsing';job.parseOwner=Symbol('artwork GLB parse');glbParseOwner=job.parseOwner;const result=await new module.GLTFExporter().parseAsync(job.mesh,{binary:true,maxTextureSize:512,onlyVisible:true});
    if(!active||job.cancelled||job.token!==glbToken)return;
    if(!(result instanceof ArrayBuffer)||result.byteLength<20)throw new Error('Invalid GLB export');const header=new DataView(result);if(header.getUint32(0,true)!==0x46546c67||header.getUint32(4,true)!==2||header.getUint32(8,true)!==result.byteLength)throw new Error('Invalid GLB header');
    glbURL=URL.createObjectURL(new Blob([result],{type:'model/gltf-binary'}));const link=$('[data-action="glbDownload"]');link.href=glbURL;link.download='qinghua-original-artwork.glb';link.hidden=false;glbStatus.textContent=t.glbSaved;
   }catch(error){if(active&&!job.cancelled&&job.token===glbToken){glbStatus.textContent=t.glbFailed;console.warn('Artwork GLB export unavailable:',error);}}
   finally{releaseGLB(job);if(job.parseOwner&&glbParseOwner===job.parseOwner)glbParseOwner=null;if(glbJob===job){glbJob=null;if(active)updateGLBControls();}}
  });
  restoreDraft();
  import('./cobalt-brush.js').then(module=>{if(active&&!brushDisabled&&typeof module.createCobaltBrush==='function'){brushFactory=module.createCobaltBrush;root.dataset.brush='natural';}}).catch(()=>{});
  return {dispose,suspend,resume};
 }catch(error){dispose();throw error;}
}
