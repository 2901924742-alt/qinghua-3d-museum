import {copy, introductionEN, steps, sources, canonicalURL} from './content.js';
import {exhibits} from './exhibits.js';

export function createUI(core) {
 const lifetime=new AbortController(), nodes=[];
 const listen=(node,type,handler)=>node.addEventListener(type,handler,{signal:lifetime.signal});
 try {
 const $ = id => document.getElementById(id);
 const original = {intro:$('infoBox').querySelector('p').innerHTML};
 let language='zh'; try { if(localStorage.getItem('museum-language')==='en') language='en'; } catch {}
 let panel=null, saved=null, tab='details', selected=0, hotspotsOn=false, previewURL=null, captured=null, unwrapCanvas=null, exportToken=0;
 let loadingProgress=null, loadingError=window.museumLoadErrorKey || null, viewing=false;
 let studio=null,studioToken=0;
 function disposeStudio(){studioToken++;studio?.dispose();studio=null;document.getElementById('museumDialog')?.classList.remove('innovation-wide');}
 let exhibit=exhibits[0],hotspots=exhibit.hotspots,currentIndex=0,pendingIndex=0,switchState='idle';
 const t = (key,...args) => {const value=exhibit[language][key]??copy[language][key];return typeof value==='function'?value(...args):value;};
 const gallery=document.createElement('nav');gallery.className='museum-gallery';gallery.id='museumGallery';
 gallery.innerHTML='<button id="museumPrevious" type="button">‹</button><div class="gallery-caption"><span id="museumExhibitCounter"></span><strong id="museumExhibitName"></strong></div><button id="museumNext" type="button">›</button><p id="museumSwitchStatus" role="status" aria-live="polite"></p>';
 document.body.append(gallery);nodes.push(gallery);
 $('museumPrevious').onclick=()=>{closeMenu();core.switchExhibit(-1);};$('museumNext').onclick=()=>{closeMenu();core.switchExhibit(1);};
 const tools=document.createElement('nav'); tools.className='museum-tools'; tools.setAttribute('aria-label','Museum tools');
 tools.innerHTML='<button id="museumLanguage" type="button"></button><button id="museumExplore" class="desktop-tool" type="button"></button><button id="museumExport" class="desktop-tool" type="button"></button><button id="museumGesture" class="desktop-tool" type="button"></button><button id="museumMore" class="mobile-more" type="button" aria-expanded="false" aria-controls="museumMenu"></button>';
 document.body.append(tools);nodes.push(tools);
 const menu=document.createElement('div');menu.id='museumMenu';menu.className='museum-menu';menu.hidden=true;
 menu.innerHTML='<button id="menuExplore" type="button"></button><button id="menuExport" type="button"></button><button id="menuGesture" type="button"></button>';document.body.append(menu);nodes.push(menu);
 const viewButton=document.createElement('button');viewButton.id='museumView';viewButton.type='button';document.body.append(viewButton);nodes.push(viewButton);
 const returnButton=document.createElement('button');returnButton.id='museumReturn';returnButton.type='button';returnButton.hidden=true;document.body.append(returnButton);nodes.push(returnButton);
 const dialog=document.createElement('dialog');dialog.className='museum-dialog';dialog.id='museumDialog';dialog.setAttribute('aria-labelledby','museumPanelTitle');
 dialog.innerHTML='<section class="museum-panel"><header><h2 id="museumPanelTitle"></h2><button id="museumClose" type="button"></button></header><div id="museumPanelContent"></div></section>';document.body.append(dialog);nodes.push(dialog);
 const layer=document.createElement('div');layer.className='hotspots';layer.hidden=true;
 const buttons=hotspots.map((h,i)=>{const b=document.createElement('button');b.type='button';b.className='hotspot';b.hidden=true;b.innerHTML='<span></span>';b.dataset.hotspot=i;layer.append(b);b.addEventListener('click',()=>{selected=i;tab='details';open('explore');});return b;});document.body.append(layer);nodes.push(layer);
 const label=(id,key)=>{$(id).textContent=t(key);};
 function translate() {
  if(window.museumLoading)window.museumLoading.language=language;
  document.documentElement.lang=language==='zh'?'zh-CN':'en';document.title=t('pageTitle');
  document.querySelector('.title').textContent=t('title');document.querySelector('.sub').textContent=t('sub');
  document.querySelector('.info h2').textContent=t('exhibit');$('infoBox').querySelector('p').innerHTML=exhibit[language].intro??(language==='zh'?original.intro:introductionEN);
  document.querySelector('.tip').textContent=t('tip');
  [['museumLanguage','language'],['museumExplore','explore'],['menuExplore','explore'],['museumExport','export'],['menuExport','export'],['museumMore','more'],['museumClose','close'],['museumView','viewArtwork'],['museumReturn','returnToMuseum'],['resetViewBtn','reset'],['hideBtn','hide'],['restoreBtn','restore'],['retryBtn','retry']].forEach(([id,key])=>label(id,key));
  tools.setAttribute('aria-label',language==='zh'?'展馆工具':'Museum tools');
  ['museumGesture','menuGesture'].forEach(id=>{$(id).textContent=language==='zh'?'手势粒子':'Hand particles';});
  buttons.forEach((b,i)=>{b.setAttribute('aria-label',hotspots[i][language][0]);b.querySelector('span').textContent=hotspots[i][language][0];});
  updateGallery();updateLoading();if(panel) renderPanel();
 }
 function updateGallery(){
  gallery.dataset.exhibit=exhibit.id;
  gallery.setAttribute('aria-label',t('collection')+': '+t('exhibit'));gallery.setAttribute('aria-busy',String(switchState==='loading'||switchState==='moving'));
  $('museumPrevious').setAttribute('aria-label',t('previous'));$('museumNext').setAttribute('aria-label',t('next'));
  $('museumExhibitCounter').textContent=`${String(currentIndex+1).padStart(2,'0')} / ${String(exhibits.length).padStart(2,'0')}`;
  $('museumExhibitName').textContent=t('exhibit');$('museumExhibitName').title=t('exhibit');
  const status=$('museumSwitchStatus');status.hidden=switchState==='idle';status.textContent=switchState==='loading'?t('switchLoading',exhibits[pendingIndex][language].exhibit):switchState==='moving'?t('switchMoving'):switchState==='error'?t('switchError'):'';
 }
 function updateLoading(){
  if($('loading').style.display==='none') return;
  $('loadingTitle').textContent=t(loadingError?'failed':'loading');
  $('loadingStatus').textContent=loadingError?t(loadingError):window.museumLoading?.statusKey?t(window.museumLoading.statusKey):loadingProgress===null?t('modelLoading'):t('progress',loadingProgress);
 }
 function closeMenu(){const focused=menu.contains(document.activeElement);menu.hidden=true;$('museumMore').setAttribute('aria-expanded','false');if(focused)($('museumMore').getClientRects().length?$('museumMore'):$('museumLanguage')).focus({preventScroll:true});}
 function stopViewing(){
  if(!viewing)return;viewing=false;document.body.classList.remove('museum-viewing');returnButton.hidden=true;
  viewButton.focus({preventScroll:true});
 }
 function startViewing(){
  if(viewing)return;core.cancelIntro();closeMenu();close();viewing=true;
  buttons.forEach(button=>button.hidden=true);
  document.body.classList.add('museum-viewing');returnButton.hidden=false;returnButton.focus({preventScroll:true});
 }
 function open(kind) {
  stopViewing();
  const fromMenu=!menu.hidden;
  core.cancelIntro();closeMenu();
  if(fromMenu)$('museumMore').focus({preventScroll:true});
  if(panel){panel=kind;tab='details';renderPanel();return;}
  saved={infoHidden:$('infoBox').classList.contains('hide'),autoRotate:core.controls.autoRotate,enabled:core.controls.enabled,focus:document.activeElement};
  core.hideInfo();core.controls.autoRotate=false;core.controls.enabled=false;document.body.classList.add('museum-panel-open');
  panel=kind; if(kind==='explore') {hotspotsOn=true;layer.hidden=false;}
  if(kind==='export'){captured=null;try{captured=core.capture();}catch{}}
  renderPanel();dialog.showModal();$('museumClose').focus({preventScroll:true});
 }
 function close(){
  if(!panel)return;disposeStudio();panel=null;exportToken++;
  dialog.close();document.body.classList.remove('museum-panel-open');
  core.controls.enabled=saved.enabled;core.controls.autoRotate=saved.autoRotate;
  if(!saved.infoHidden)core.restoreInfo();else core.hideInfo();
  if(saved.focus?.isConnected)saved.focus.focus({preventScroll:true});saved=null;
  if(previewURL)URL.revokeObjectURL(previewURL);previewURL=null;captured=null;$('museumPanelContent').replaceChildren();
 }
 function sourcesHTML(){return `<p class="note">${t('sourceLabel')}: ${[...(exhibit.source?[exhibit.source]:[]),...sources].map(([label,url])=>`<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`).join(' · ')}</p>`;}
 function renderPanel(){
  disposeStudio();
  $('museumPanelTitle').textContent=t(panel==='explore'?'explore':'export');label('museumClose','close');
  const content=$('museumPanelContent');
  if(panel==='explore') {
   content.innerHTML=`<div class="museum-tabs">${['details','unwrap','craft','studio'].map(k=>`<button type="button" data-tab="${k}" aria-pressed="${tab===k}">${t(k)}</button>`).join('')}</div><div id="museumKnowledge"></div>`;
   content.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{tab=b.dataset.tab;renderPanel();content.querySelector(`[data-tab="${tab}"]`).focus();}));
   const knowledge=$('museumKnowledge');
   if(tab==='details') {
    knowledge.innerHTML=`<p>${t('exploreIntro')}</p><div class="museum-tabs">${hotspots.map((h,i)=>`<button type="button" data-detail="${i}" aria-pressed="${selected===i}">${h[language][0]}</button>`).join('')}</div><h3>${hotspots[selected][language][0]}</h3><p>${hotspots[selected][language][1]}</p><button id="toggleHotspots" type="button">${t(hotspotsOn?'hotspotOff':'hotspotHint')}</button><p class="note">${t('scope')}</p><p class="note">${language==='zh'?'缺失内腔及其青花纹饰为展示性重建；纹饰借用原模型外壁图案，并非原件内壁记录。厚度与内底形态未经实测，不作为文物结构依据。':'The missing cavity and its blue decoration are display reconstructions. Motifs are adapted from the model’s exterior, not records of the original interior. Wall thickness and floor shape are not measured.'}</p>`+sourcesHTML();
    knowledge.querySelectorAll('[data-detail]').forEach(b=>b.addEventListener('click',()=>{selected=+b.dataset.detail;renderPanel();$('museumPanelContent').querySelector(`[data-detail="${selected}"]`).focus();}));
    $('toggleHotspots').onclick=()=>{hotspotsOn=!hotspotsOn;layer.hidden=!hotspotsOn;close();};
   } else if(tab==='studio') {
    dialog.classList.add('innovation-wide');const token=studioToken;
    knowledge.innerHTML=`<p role="status">${language==='zh'?'正在打开创意工坊…':'Opening the creative workshop…'}</p>`;
    import('./innovation-studio.js').then(({mountStudio})=>{
     if(token!==studioToken||panel!=='explore'||tab!=='studio')return;
     studio=mountStudio(knowledge,{language,exhibits,getStudioRenderer:core.getStudioRenderer,openBloom:()=>{close();core.openBloom();}});
    }).catch(error=>{if(token!==studioToken)return;console.warn('Museum workshop unavailable:',error);knowledge.textContent=language==='zh'?'创意工坊暂不可用，可继续观展。':'The workshop is unavailable. You can continue viewing the museum.';});
   } else if(tab==='craft') {
    knowledge.innerHTML=steps.map((step,i)=>`<article class="craft-step"><h3>${String(i+1).padStart(2,'0')} · ${step[language][0]}</h3><p>${step[language][1]}</p></article>`).join('')+`<p class="note">${t('craftNote')}</p>`+sourcesHTML();
   } else {
    knowledge.innerHTML=`<p>${t('unwrapNote')}</p><p id="unwrapStatus" role="status">${t('unwrapLoading')}</p>`;
    // Ignore a deferred unwrap if the exhibit or panel changed before it ran.
    const unwrapExhibit=exhibit;
    setTimeout(()=>{if(exhibit!==unwrapExhibit||panel!=='explore'||tab!=='unwrap'||!$('unwrapStatus'))return;try{
     unwrapCanvas ||= core.unwrap();unwrapCanvas.setAttribute('role','img');unwrapCanvas.setAttribute('aria-label',t('unwrapAlt'));
     $('unwrapStatus').remove();$('museumKnowledge').append(unwrapCanvas);
     for(const [key,start,fraction] of [['rim',0,.16],['foot',.83,.17]]){
      const heading=document.createElement('h3');heading.textContent=language==='zh'?(key==='rim'?'口沿区域 · 展开细节':'底足区域 · 展开细节'):(key==='rim'?'Rim region · Unwrapped detail':'Foot region · Unwrapped detail');
      const detail=document.createElement('canvas');detail.width=unwrapCanvas.width;detail.height=Math.round(unwrapCanvas.height*fraction);
      detail.getContext('2d').drawImage(unwrapCanvas,0,Math.round(unwrapCanvas.height*start),unwrapCanvas.width,detail.height,0,0,detail.width,detail.height);
      detail.setAttribute('role','img');detail.setAttribute('aria-label',heading.textContent);$('museumKnowledge').append(heading,detail);
     }
    }catch{$('unwrapStatus').textContent=t('unwrapError');}},0);
   }
  } else {
   content.innerHTML=`<p>${t('exportHint')}</p><div class="museum-actions"><button id="makePhoto" type="button">${t('photo')}</button><button id="makePoster" type="button">${t('poster')}</button></div><p id="exportStatus" role="status"></p><img id="exportPreview" hidden><a id="exportDownload" class="download" hidden download></a>`;
   $('makePhoto').onclick=()=>generate(false);$('makePoster').onclick=()=>generate(true);generate(false);
  }
 }
 let qrPromise;
 function loadQR(){return qrPromise ||= new Promise((resolve,reject)=>{
  if(window.qrcode){resolve(window.qrcode);return;}
  const script=document.createElement('script');script.src=new URL('../vendor/qrcode/qrcode.js',import.meta.url).href;
  script.onload=()=>resolve(window.qrcode);script.onerror=()=>{qrPromise=null;script.remove();reject(new Error('QR unavailable'));};document.head.append(script);
 });}
 const toBlob=canvas=>new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Empty image')),'image/png'));
 async function generate(poster){
  const token=++exportToken, lang=language;$('exportStatus').textContent=t('exporting');
  $('exportPreview').hidden=true;$('exportDownload').hidden=true;
  try {
   if(!captured)throw new Error('Capture unavailable');
   let canvas=captured;
   if(poster){
    let QR;try{QR=await loadQR();}catch{if(token===exportToken&&panel==='export')$('exportStatus').textContent=t('qrError');return;}
    if(token!==exportToken||panel!=='export')return;
    const qr=QR(0,'M');qr.addData(canonicalURL,'Byte');qr.make();
    const width=1080, imageHeight=Math.round(captured.height*width/captured.width),header=150,footer=240;
    canvas=document.createElement('canvas');canvas.width=width;canvas.height=header+imageHeight+footer;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#071125';ctx.fillRect(0,0,width,canvas.height);
    ctx.fillStyle='#f2f6ff';ctx.textAlign='left';ctx.font='600 46px "Microsoft YaHei", sans-serif';ctx.fillText(copy[lang].title,48,70);
    ctx.font='20px sans-serif';ctx.fillStyle='#a9c9ff';ctx.fillText(copy[lang].sub,48,110);ctx.drawImage(captured,0,header,width,imageHeight);
    ctx.fillStyle='#f2f6ff';ctx.font='25px "Microsoft YaHei", sans-serif';ctx.fillText(exhibit[lang].exhibit,48,header+imageHeight+45,680);
    ctx.font='28px "Microsoft YaHei", sans-serif';ctx.fillText(copy[lang].creator,48,header+imageHeight+85);
    ctx.font='23px "Microsoft YaHei", sans-serif';ctx.fillStyle='#a9c9ff';ctx.fillText(copy[lang].posterFooter,48,header+imageHeight+130);
    ctx.font='18px sans-serif';ctx.fillText(new URL(canonicalURL).host,48,header+imageHeight+172);
    const count=qr.getModuleCount(), cell=Math.max(4,Math.floor(190/(count+8))),size=(count+8)*cell,x=width-48-size,y=canvas.height-footer+(footer-size)/2;
    ctx.fillStyle='#fff';ctx.fillRect(x,y,size,size);ctx.fillStyle='#000';
    for(let row=0;row<count;row++)for(let col=0;col<count;col++)if(qr.isDark(row,col))ctx.fillRect(x+(col+4)*cell,y+(row+4)*cell,cell,cell);
   }
   const blob=await toBlob(canvas);if(token!==exportToken||panel!=='export')return;
   if(previewURL)URL.revokeObjectURL(previewURL);previewURL=URL.createObjectURL(blob);
   const img=$('exportPreview');img.src=previewURL;img.alt=t(poster?'posterAlt':'photoAlt');img.hidden=false;
   const link=$('exportDownload');link.href=previewURL;link.download=`qinghua-${exhibit.id}-${poster?'poster':'photo'}-${language}.png`;link.textContent=t('download');link.hidden=false;
   $('exportStatus').textContent='';
  }catch{if(token===exportToken&&panel==='export')$('exportStatus').textContent=t('exportError');}
 }
 $('museumLanguage').onclick=()=>{closeMenu();core.cancelIntro();language=language==='zh'?'en':'zh';try{localStorage.setItem('museum-language',language);}catch{}translate();};
 $('museumMore').onclick=()=>{if(!menu.hidden){closeMenu();return;}menu.hidden=false;$('museumMore').setAttribute('aria-expanded','true');$('menuExplore').focus({preventScroll:true});};
 ['museumExplore','menuExplore'].forEach(id=>{$(id).onclick=()=>{tab='details';open('explore');};});
 ['museumExport','menuExport'].forEach(id=>{$(id).onclick=()=>open('export');});
 ['museumGesture','menuGesture'].forEach(id=>{$(id).onclick=()=>{stopViewing();close();closeMenu();$(id==='menuGesture'?'museumMore':id).focus({preventScroll:true});core.openGesture?.();};});
 $('museumClose').onclick=close;listen(dialog,'cancel',e=>{e.preventDefault();close();});
 listen(viewButton,'click',startViewing);
 listen(returnButton,'click',stopViewing);
 listen(dialog,'keydown',e=>{if(e.key!=='Tab')return;const focusable=[...dialog.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])')].filter(el=>el.getClientRects().length&&!el.hidden);const first=focusable[0],last=focusable[focusable.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}});
 listen(dialog,'click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}});
 listen(document,'pointerdown',e=>{if(!menu.contains(e.target)&&!tools.contains(e.target))closeMenu();});
 listen(document,'keydown',e=>{if(e.key==='Escape'){stopViewing();if(!menu.hidden){closeMenu();$('museumMore').focus();}}});
 listen(matchMedia('(max-width:900px)'),'change',closeMenu);
 const api={t,translate,get language(){return language;},get panel(){return panel;},get hotspotsOn(){return hotspotsOn&&!viewing&&!core.gestureActive?.();},buttons,
  setExhibit(index){stopViewing();close();exportToken++;captured=unwrapCanvas=null;currentIndex=index;exhibit=exhibits[index];hotspots=exhibit.hotspots;selected=0;buttons.forEach(b=>b.hidden=true);translate();},
  galleryState(index,target,state){currentIndex=index;pendingIndex=target;switchState=state;updateGallery();},
  loading(loaded,total){loadingProgress=total>0?Math.min(100,Math.max(0,Math.round(loaded/total*100))):null;updateLoading();},
  loadError(key){loadingError=key;$('loading').classList.add('failed');updateLoading();},
  close,hideHotspots(){hotspotsOn=false;layer.hidden=true;},
  dispose(){stopViewing();close();lifetime.abort();exportToken++;if(previewURL)URL.revokeObjectURL(previewURL);captured=unwrapCanvas=null;nodes.forEach(node=>node.remove());}
 };
 translate();return api;
 } catch(error) {lifetime.abort();nodes.forEach(node=>node.remove());throw error;}
}
