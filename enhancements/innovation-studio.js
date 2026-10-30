export function mountStudio(container,{language,exhibits,getStudioRenderer,getExhibitIndex,onViewExhibit,openBloom,openScan}) {
 const en=language==='en',lifetime=new AbortController(),parents=[];let current=null,serial=0,disposed=false,paused=false,factoryCancel=null;
 const text=en?{
  title:'Porcelain, reimagined',intro:'Shape a vessel, paint its surface, then export your own 3D artwork. Or start painting directly and explore the experiences below.',
  bloom:'Motifs in bloom',bloomNote:'Original cobalt vines unfold around the holographic vessel. Open to bloom, gather to return.',bloomAction:'Enter motif space',
  paint:'Paint your porcelain',paintNote:'Use the classic blank or your own shaped vessel. Paint on the canvas or directly on its surface, preview an artistic glaze, then export a PNG poster or original artwork GLB.',paintAction:'Start painting',
  compare:'Compare the collection',compareNote:'Compare the shapes and decoration of two exhibits, then choose “View in museum” to inspect either one.',compareAction:'Choose two vessels',
  scan:'Holographic surface scan',scanNote:'A blue-white scan reveals traces sampled from the vessel exterior. Artistic visualization, not CT or measurement.',scanAction:'Enter the scan table',
  pottery:'Shape clay · Light-field studio',potteryNote:'Shape an original vase, jar or bowl; inspect its interior, optional horizontal section and light-field grid. Choose “Paint this vessel” to add your pattern. Relative design units, not a museum measurement.',potteryAction:'Shape your vessel',
  back:'Back to workshop',backPottery:'Back to shaping',loading:'Preparing the experiment…',error:'This experiment could not start. Return and try again; the museum remains available.',
  saveTitle:'Which file should I save?',artworkFile:'Editable artwork',artworkFileNote:'Save and open artwork JSON in the painting studio. Keep the vessel, pattern, current tools and glaze across devices; earlier undo steps are not included.',shapeFile:'Shape design',shapeFileNote:'Export and import it in the shape studio to keep shaping. It does not include painted artwork.',imageFile:'Artwork image',imageFileNote:'Keep or share a poster. It cannot be imported as an editable workshop draft.',modelFile:'3D artwork',modelFileNote:'Export the current original vessel and pattern from the painting studio for use in GLB-compatible 3D software. This site does not import GLB files.',
  note:'Creative interpretations are marked separately from original records. Drafts stay in this browser at this website; clearing site data removes them. Export your work separately. Values are relative design units, not museum measurements.'
 }:{
  title:'让青花从观看走向创作',intro:'塑造器形，在器壁绘制青花，再导出自己的三维作品。也可直接开始绘瓷，或自由探索下方入口。',
  bloom:'纹样活化 · 一器生花',bloomNote:'原创钴蓝缠枝绕器舒展，张掌生花、握拳归拢；也可用触控体验。',bloomAction:'进入纹样空间',
  paint:'数字绘瓷',paintNote:'使用经典白胎或亲手塑造的器形，在画布或器壁直接落笔，预览艺术化釉光，导出 PNG 海报或原创作品 GLB。',paintAction:'开始绘瓷',
  compare:'四器对读',compareNote:'并列比较两件展品的轮廓与纹饰，点击“回展馆细看”继续观察对应展品。',compareAction:'选择两件展品',
  scan:'全息扫描台 · 器形光谱',scanNote:'蓝白扫描带掠过外壁采样，经纬光线随器形浮现。属于艺术演绎，非 CT、非实测。',scanAction:'进入全息扫描台',
  pottery:'虚拟拉坯 · 光场造器',potteryNote:'拖动轮廓塑造瓶、罐或碗，观察内壁、可选横截与光场网格。点击“带此器形去绘瓷”继续绘制纹样。原创比例设计，非文物实测。',potteryAction:'开始造器',
  back:'返回创意工坊',backPottery:'返回造器',loading:'正在准备创意体验…',error:'这项体验暂时无法启动，请返回重试；仍可正常看展。',
  saveTitle:'保存哪一种？',artworkFile:'可编辑作品',artworkFileNote:'在绘瓷中保存、打开作品 JSON，跨设备继续编辑器形、画稿、工具与釉光；不含旧撤销记录。',shapeFile:'造形设计',shapeFileNote:'在造器中导出、导入并继续调整器形；不含绘瓷画稿。',imageFile:'作品图片',imageFileNote:'保存或分享海报；不能作为可编辑画稿导入本工坊。',modelFile:'三维作品',modelFileNote:'在绘瓷中导出当前原创器形与纹样，供支持 GLB 的三维软件使用；本站暂不支持导入 GLB。',
  note:'艺术演绎与原件资料分开标注。草稿仅保存在同一浏览器与网站中；清理网站数据后将丢失，请另行导出。作品使用设计比例，非文物实测。'
 };
 const scroller=container.closest('.museum-panel')||container;
 function remember(entry,trigger=null){if(!entry)return;entry.scrollTop=scroller.scrollTop;entry.scrollLeft=scroller.scrollLeft;const focus=trigger&&entry.element.contains(trigger)?trigger:document.activeElement;if(entry.element.contains(focus))entry.focus=focus;}
 function place(entry,restore=false){
  container.replaceChildren(entry.element);if(!paused){entry.mountReady?.();entry.instance?.resume?.();}
  scroller.scrollTop=restore?entry.scrollTop:0;scroller.scrollLeft=restore?entry.scrollLeft:0;
  const focus=restore&&entry.focus?.isConnected&&!entry.focus.disabled?entry.focus:entry.element.querySelector('[data-studio-mode=home]')||entry.element.querySelector('h3');
  if(focus){if(focus.tagName==='H3')focus.tabIndex=-1;focus.focus({preventScroll:true});}
  scroller.scrollTop=restore?entry.scrollTop:0;scroller.scrollLeft=restore?entry.scrollLeft:0;
 }
 function park(entry,trigger=null){remember(entry,trigger);entry.instance?.suspend?.();entry.renderer?.releasePreview();entry.element.remove();}
 function release(entry){entry.mountReady=null;entry.instance?.dispose();entry.instance=null;entry.renderer?.releasePreview();entry.renderer=null;entry.element.remove();}
 function cancelLoad(){serial++;factoryCancel?.();}
 function back(){
  if(disposed||paused||!parents.length)return false;
  cancelLoad();release(current);current=parents.pop();place(current,true);return true;
 }
 function loadPotteryFactory(){
  return new Promise(resolve=>{
   let done=false;
   const finish=factory=>{if(done)return;done=true;if(factoryCancel===cancel)factoryCancel=null;resolve(factory);};
   const cancel=()=>finish(null);factoryCancel=cancel;
   import('./pottery-model.js').then(module=>finish(typeof module.createPotteryModel==='function'?module.createPotteryModel:null)).catch(cancel);
  });
 }
 function home(){
  const element=document.createElement('div');element.className='innovation-root';
  element.innerHTML=`<p class="innovation-eyebrow">COBALT LAB · 青花创意工坊</p><h3>${text.title}</h3><p>${text.intro}</p><div class="innovation-cards">${['pottery','bloom','scan','paint','compare'].map((kind,i)=>`<article data-studio-kind="${kind}"><span class="innovation-number">0${i+1}</span><h3>${text[kind]}</h3><p>${text[kind+'Note']}</p><button type="button" data-studio-mode="${kind}">${text[kind+'Action']}</button></article>`).join('')}</div><section class="innovation-save-guide"><h4>${text.saveTitle}</h4><dl><dt>JSON · ${text.shapeFile}</dt><dd>${text.shapeFileNote}</dd><dt>JSON · ${text.artworkFile}</dt><dd>${text.artworkFileNote}</dd><dt>PNG · ${text.imageFile}</dt><dd>${text.imageFileNote}</dd><dt>GLB · ${text.modelFile}</dt><dd>${text.modelFileNote}</dd></dl></section><p class="note">${text.note}</p>`;
  current={kind:'home',element,instance:null,renderer:null,focus:null,scrollTop:0,scrollLeft:0};place(current);
 }
 async function show(kind,shapeJSON=null,trigger=null){
  if(disposed||paused)return;
  if(kind==='home'){back();return;}
  if(kind==='bloom'||kind==='scan'){remember(current,trigger);if(trigger&&current.element.contains(trigger))trigger.focus({preventScroll:true});(kind==='bloom'?openBloom:openScan)();return;}
  if(!['paint','compare','pottery'].includes(kind))return;
  // The sole nested route is home → shaping → painting. Keep its parent, not a second live preview.
  if(current.kind!=='home'&&!(current.kind==='pottery'&&kind==='paint'&&typeof shapeJSON==='string'))return;
  const parent=current;park(parent,trigger);parents.push(parent);cancelLoad();const token=serial;
  const element=document.createElement('div');element.className='innovation-root';
  element.innerHTML=`<button type="button" data-studio-mode="home">‹ ${parent.kind==='pottery'?text.backPottery:text.back}</button><div class="innovation-workspace" aria-busy="true"><p role="status">${text.loading}</p></div>`;
  const entry={kind,element,instance:null,renderer:null,focus:null,scrollTop:0,scrollLeft:0};current=entry;place(entry);
  const body=element.querySelector('.innovation-workspace');
  try {
   const [module,renderer,createPotteryModel]=await Promise.all([kind==='paint'?import('./paint-studio.js'):kind==='pottery'?import('./pottery-studio.js'):import('./compare-studio.js'),getStudioRenderer(),kind==='paint'?loadPotteryFactory():null]);
   if(disposed||serial!==token||current!==entry)return;
   const mountReady=()=>{
    entry.mountReady=null;if(disposed||serial!==token||current!==entry)return;
    try{
     entry.renderer=renderer;body.replaceChildren();
     entry.instance=kind==='paint'?module.mountPaint(body,{language,THREE:renderer.THREE,renderPreview:renderer.renderPreview,shapeJSON,createPotteryModel}):kind==='pottery'?module.mountPottery(body,{language,THREE:renderer.THREE,renderPreview:renderer.renderPreview,onPaintShape:shape=>{if(current===entry&&!paused)show('paint',shape,entry.element.querySelector('[data-action=paintShape]'));}}):module.mountCompare(body,{language,exhibits,getExhibitIndex,onViewExhibit,captureExhibit:renderer.captureExhibit});
    }catch(error){console.warn('Museum creative experiment unavailable:',error);body.replaceChildren();const status=document.createElement('p');status.setAttribute('role','status');status.textContent=text.error;body.append(status);}
   };
   if(paused)entry.mountReady=mountReady;else mountReady();
  } catch(error) {
   if(disposed||serial!==token||current!==entry)return;
   console.warn('Museum creative experiment unavailable:',error);body.replaceChildren();const status=document.createElement('p');status.setAttribute('role','status');status.textContent=text.error;body.append(status);
  } finally {if(!disposed&&serial===token&&current===entry)body.setAttribute('aria-busy','false');}
 }
 container.addEventListener('click',event=>{const button=event.target.closest('[data-studio-mode]');if(button&&container.contains(button))show(button.dataset.studioMode,null,button);},{signal:lifetime.signal});
 home();return {
  suspend(){if(disposed||paused)return;remember(current);paused=true;current.instance?.suspend?.();current.renderer?.releasePreview();},
  resume(){if(disposed||!paused)return;paused=false;place(current,true);},
  back,
  dispose(){if(disposed)return;disposed=true;lifetime.abort();cancelLoad();if(current)release(current);for(const entry of parents.reverse())release(entry);parents.length=0;current=null;container.replaceChildren();}
 };
}
