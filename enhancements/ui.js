import {copy, introductionEN, hotspots, steps, sources, canonicalURL} from './content.js';

export function createUI(core) {
 const $ = id => document.getElementById(id);
 const original = {intro:$('infoBox').querySelector('p').innerHTML};
 let language='zh'; try { if(localStorage.getItem('museum-language')==='en') language='en'; } catch {}
 let panel=null, saved=null, tab='details', selected=0, hotspotsOn=false, previewURL=null, captured=null, unwrapCanvas=null, exportToken=0;
 let loadingProgress=null, loadingError=window.museumLoadErrorKey || null;
 const t = (key,...args) => typeof copy[language][key]==='function' ? copy[language][key](...args) : copy[language][key];
 const tools=document.createElement('nav'); tools.className='museum-tools'; tools.setAttribute('aria-label','Museum tools');
 tools.innerHTML='<button id="museumLanguage" type="button"></button><button id="museumExplore" class="desktop-tool" type="button"></button><button id="museumExport" class="desktop-tool" type="button"></button><button id="museumMore" class="mobile-more" type="button" aria-expanded="false" aria-controls="museumMenu"></button>';
 document.body.append(tools);
 const menu=document.createElement('div');menu.id='museumMenu';menu.className='museum-menu';menu.hidden=true;
 menu.innerHTML='<button id="menuExplore" type="button"></button><button id="menuExport" type="button"></button>';document.body.append(menu);
 const dialog=document.createElement('dialog');dialog.className='museum-dialog';dialog.id='museumDialog';dialog.setAttribute('aria-labelledby','museumPanelTitle');
 dialog.innerHTML='<section class="museum-panel"><header><h2 id="museumPanelTitle"></h2><button id="museumClose" type="button"></button></header><div id="museumPanelContent"></div></section>';document.body.append(dialog);
 const layer=document.createElement('div');layer.className='hotspots';layer.hidden=true;
 const buttons=hotspots.map((h,i)=>{const b=document.createElement('button');b.type='button';b.className='hotspot';b.hidden=true;b.innerHTML='<span></span>';b.dataset.hotspot=i;layer.append(b);b.addEventListener('click',()=>{selected=i;tab='details';open('explore');});return b;});document.body.append(layer);
 const label=(id,key)=>{$(id).textContent=t(key);};
 function translate() {
  if(window.museumLoading)window.museumLoading.language=language;
  document.documentElement.lang=language==='zh'?'zh-CN':'en';document.title=t('pageTitle');
  document.querySelector('.title').textContent=t('title');document.querySelector('.sub').textContent=t('sub');
  document.querySelector('.info h2').textContent=t('exhibit');$('infoBox').querySelector('p').innerHTML=language==='zh'?original.intro:introductionEN;
  document.querySelector('.tip').textContent=t('tip');
  [['museumLanguage','language'],['museumExplore','explore'],['menuExplore','explore'],['museumExport','export'],['menuExport','export'],['museumMore','more'],['museumClose','close'],['resetViewBtn','reset'],['hideBtn','hide'],['restoreBtn','restore'],['retryBtn','retry']].forEach(([id,key])=>label(id,key));
  tools.setAttribute('aria-label',language==='zh'?'展馆工具':'Museum tools');
  buttons.forEach((b,i)=>{b.setAttribute('aria-label',hotspots[i][language][0]);b.querySelector('span').textContent=hotspots[i][language][0];});
  updateLoading();if(panel) renderPanel();
 }
 function updateLoading(){
  if($('loading').style.display==='none') return;
  $('loadingTitle').textContent=t(loadingError?'failed':'loading');
  $('loadingStatus').textContent=loadingError?t(loadingError):loadingProgress===null?t('modelLoading'):t('progress',loadingProgress);
 }
 function closeMenu(){menu.hidden=true;$('museumMore').setAttribute('aria-expanded','false');}
 function open(kind) {
  core.cancelIntro();closeMenu();
  if(panel){panel=kind;tab='details';renderPanel();return;}
  saved={infoHidden:$('infoBox').classList.contains('hide'),autoRotate:core.controls.autoRotate,enabled:core.controls.enabled,focus:document.activeElement};
  core.hideInfo();core.controls.autoRotate=false;core.controls.enabled=false;document.body.classList.add('museum-panel-open');
  panel=kind; if(kind==='explore') {hotspotsOn=true;layer.hidden=false;}
  if(kind==='export'){captured=null;try{captured=core.capture();}catch{}}
  renderPanel();dialog.showModal();$('museumClose').focus({preventScroll:true});
 }
 function close(){
  if(!panel)return;panel=null;exportToken++;
  dialog.close();document.body.classList.remove('museum-panel-open');
  core.controls.enabled=saved.enabled;core.controls.autoRotate=saved.autoRotate;
  if(!saved.infoHidden)core.restoreInfo();else core.hideInfo();
  if(saved.focus?.isConnected)saved.focus.focus({preventScroll:true});saved=null;
 }
 function sourcesHTML(){return `<p class="note">${t('sourceLabel')}: ${sources.map(([label,url])=>`<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`).join(' · ')}</p>`;}
 function renderPanel(){
  $('museumPanelTitle').textContent=t(panel==='explore'?'explore':'export');label('museumClose','close');
  const content=$('museumPanelContent');
  if(panel==='explore') {
   content.innerHTML=`<div class="museum-tabs">${['details','unwrap','craft'].map(k=>`<button type="button" data-tab="${k}" aria-pressed="${tab===k}">${t(k)}</button>`).join('')}</div><div id="museumKnowledge"></div>`;
   content.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{tab=b.dataset.tab;renderPanel();content.querySelector(`[data-tab="${tab}"]`).focus();}));
   const knowledge=$('museumKnowledge');
   if(tab==='details') {
    knowledge.innerHTML=`<p>${t('exploreIntro')}</p><div class="museum-tabs">${hotspots.map((h,i)=>`<button type="button" data-detail="${i}" aria-pressed="${selected===i}">${h[language][0]}</button>`).join('')}</div><h3>${hotspots[selected][language][0]}</h3><p>${hotspots[selected][language][1]}</p><button id="toggleHotspots" type="button">${t(hotspotsOn?'hotspotOff':'hotspotHint')}</button><p class="note">${t('scope')}</p>`;
    knowledge.querySelectorAll('[data-detail]').forEach(b=>b.addEventListener('click',()=>{selected=+b.dataset.detail;renderPanel();$('museumPanelContent').querySelector(`[data-detail="${selected}"]`).focus();}));
    $('toggleHotspots').onclick=()=>{hotspotsOn=!hotspotsOn;layer.hidden=!hotspotsOn;close();};
   } else if(tab==='craft') {
    knowledge.innerHTML=steps.map((step,i)=>`<article class="craft-step"><h3>${String(i+1).padStart(2,'0')} · ${step[language][0]}</h3><p>${step[language][1]}</p></article>`).join('')+`<p class="note">${t('craftNote')}</p>`+sourcesHTML();
   } else {
    knowledge.innerHTML=`<p>${t('unwrapNote')}</p><p id="unwrapStatus" role="status">${t('unwrapLoading')}</p>`;
    // Lazy construction; one GPU readback, then cache the canvas across language changes.
    setTimeout(()=>{if(panel!=='explore'||tab!=='unwrap'||!$('unwrapStatus'))return;try{
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
    ctx.fillStyle='#f2f6ff';ctx.font='28px "Microsoft YaHei", sans-serif';ctx.fillText(copy[lang].creator,48,header+imageHeight+80);
    ctx.font='23px "Microsoft YaHei", sans-serif';ctx.fillStyle='#a9c9ff';ctx.fillText(copy[lang].posterFooter,48,header+imageHeight+130);
    ctx.font='18px sans-serif';ctx.fillText(new URL(canonicalURL).host,48,header+imageHeight+172);
    const count=qr.getModuleCount(), cell=Math.max(4,Math.floor(190/(count+8))),size=(count+8)*cell,x=width-48-size,y=canvas.height-footer+(footer-size)/2;
    ctx.fillStyle='#fff';ctx.fillRect(x,y,size,size);ctx.fillStyle='#000';
    for(let row=0;row<count;row++)for(let col=0;col<count;col++)if(qr.isDark(row,col))ctx.fillRect(x+(col+4)*cell,y+(row+4)*cell,cell,cell);
   }
   const blob=await toBlob(canvas);if(token!==exportToken||panel!=='export')return;
   if(previewURL)URL.revokeObjectURL(previewURL);previewURL=URL.createObjectURL(blob);
   const img=$('exportPreview');img.src=previewURL;img.alt=t(poster?'posterAlt':'photoAlt');img.hidden=false;
   const link=$('exportDownload');link.href=previewURL;link.download=`qinghua-${poster?'poster':'photo'}-${language}.png`;link.textContent=t('download');link.hidden=false;
   $('exportStatus').textContent='';
  }catch{if(token===exportToken&&panel==='export')$('exportStatus').textContent=t('exportError');}
 }
 $('museumLanguage').onclick=()=>{language=language==='zh'?'en':'zh';try{localStorage.setItem('museum-language',language);}catch{}translate();};
 $('museumMore').onclick=()=>{menu.hidden=!menu.hidden;$('museumMore').setAttribute('aria-expanded',String(!menu.hidden));};
 ['museumExplore','menuExplore'].forEach(id=>{$(id).onclick=()=>{tab='details';open('explore');};});
 ['museumExport','menuExport'].forEach(id=>{$(id).onclick=()=>open('export');});
 $('museumClose').onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 dialog.addEventListener('keydown',e=>{if(e.key!=='Tab')return;const focusable=[...dialog.querySelectorAll('button:not([disabled]),a[href]')].filter(el=>el.getClientRects().length&&!el.hidden);const first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}});
 dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}});
 document.addEventListener('pointerdown',e=>{if(!menu.contains(e.target)&&!tools.contains(e.target))closeMenu();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!menu.hidden){closeMenu();$('museumMore').focus();}});
 const api={t,translate,get language(){return language;},get panel(){return panel;},get hotspotsOn(){return hotspotsOn;},buttons,
  loading(loaded,total){loadingProgress=total>0?Math.min(100,Math.round(loaded/total*100)):null;const loading=$('loading');loading.classList.toggle('unknown',!total);loading.style.setProperty('--draw',total>0?loaded/total:.45);updateLoading();},
  loadError(key){loadingError=key;$('loading').classList.add('failed');updateLoading();},
  close,hideHotspots(){hotspotsOn=false;layer.hidden=true;}
 };
 translate();return api;
}
