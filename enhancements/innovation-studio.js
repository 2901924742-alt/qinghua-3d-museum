export function mountStudio(container,{language,exhibits,getStudioRenderer,openBloom}) {
 const en=language==='en',lifetime=new AbortController();let active=null,serial=0,disposed=false;
 const text=en?{
  title:'Porcelain, reimagined',intro:'Three small experiments connecting observation, gesture and creation.',
  bloom:'Motifs in bloom',bloomNote:'Original cobalt vines unfold around the holographic vessel. Open to bloom, gather to return.',bloomAction:'Enter motif space',
  paint:'Paint your porcelain',paintNote:'Draw on a dedicated blank vessel, reveal an artistic glaze and save your own image.',paintAction:'Start painting',
  compare:'Compare the collection',compareNote:'Compare two real exhibit snapshots at a normalized viewing scale.',compareAction:'Choose two vessels',
  back:'Back to workshop',loading:'Preparing the experiment…',error:'This experiment could not start. Return and try again; the museum remains available.',
  note:'Creative interpretations are labelled separately from original object records. Close or return to leave an experiment.'
 }:{
  title:'让青花从观看走向创作',intro:'观察纹样、以手势舒展，再把自己的青花作品留下。',
  bloom:'纹样活化 · 一器生花',bloomNote:'原创钴蓝缠枝绕器舒展，张掌生花、握拳归拢；也可用触控体验。',bloomAction:'进入纹样空间',
  paint:'数字绘瓷',paintNote:'在独立白胎器形上绘制浓淡青花，以艺术化釉光呈现，保存自己的作品。',paintAction:'开始绘瓷',
  compare:'四器对读',compareNote:'将两件真实展品的正面或侧面快照并列，观察轮廓与纹饰布局。',compareAction:'选择两件展品',
  back:'返回创意工坊',loading:'正在准备创意体验…',error:'这项体验暂时无法启动，请返回重试；仍可正常看展。',
  note:'艺术演绎与原件资料分开标注。关闭或返回会结束当前体验，请先保存创作。'
 };
 function clear(){serial++;active?.dispose();active=null;}
 function focusHeading(){const heading=container.querySelector('h3');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}}
 function home(){
  clear();container.innerHTML=`<div class="innovation-root"><p class="innovation-eyebrow">COBALT LAB · 青花创意工坊</p><h3>${text.title}</h3><p>${text.intro}</p><div class="innovation-cards">${['bloom','paint','compare'].map((kind,i)=>`<article><span class="innovation-number">0${i+1}</span><h3>${text[kind]}</h3><p>${text[kind+'Note']}</p><button type="button" data-studio-mode="${kind}">${text[kind+'Action']}</button></article>`).join('')}</div><p class="note">${text.note}</p></div>`;
  focusHeading();
 }
 async function show(kind){
  if(kind==='home'){home();return;}
  if(kind==='bloom'){openBloom();return;}
  if(!['paint','compare'].includes(kind))return;
  clear();const token=serial;
  container.innerHTML=`<div class="innovation-root"><button type="button" data-studio-mode="home">‹ ${text.back}</button><div class="innovation-workspace" aria-busy="true"><p role="status">${text.loading}</p></div></div>`;
  const body=container.querySelector('.innovation-workspace');container.querySelector('[data-studio-mode=home]').focus({preventScroll:true});
  try {
   const [module,renderer]=await Promise.all([kind==='paint'?import('./paint-studio.js'):import('./compare-studio.js'),getStudioRenderer()]);
   if(disposed||serial!==token)return;
   body.replaceChildren();
   active=kind==='paint'?module.mountPaint(body,{language,THREE:renderer.THREE,renderPreview:renderer.renderPreview}):module.mountCompare(body,{language,exhibits,captureExhibit:renderer.captureExhibit});
  } catch(error) {
   if(disposed||serial!==token)return;
   console.warn('Museum creative experiment unavailable:',error);body.replaceChildren();const status=document.createElement('p');status.setAttribute('role','status');status.textContent=text.error;body.append(status);
  } finally {if(!disposed&&serial===token)body.setAttribute('aria-busy','false');}
 }
 container.addEventListener('click',event=>{const button=event.target.closest('[data-studio-mode]');if(button&&container.contains(button))show(button.dataset.studioMode);},{signal:lifetime.signal});
 home();return {dispose(){if(disposed)return;disposed=true;lifetime.abort();clear();container.replaceChildren();}};
}
