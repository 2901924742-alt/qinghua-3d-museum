import {canvasPoint,boundedHistory} from './paint-math.js';

const words={
 zh:{title:'数字绘瓷',intro:'在平面画布绘制，纹样会环绕右侧创作器形。拖动器形或使用角度滑块查看背面。',note:'用户创作 · 艺术模拟。此处使用原创白胎创作模板，不对应馆藏原件；釉光变化不代表真实烧制过程。',flat:'纹样画布',preview:'器形预览',brush:'毛笔',flower:'花卉印章',width:'笔宽',density:'钴蓝浓度',angle:'转动器形',undo:'撤销',clear:'清空',glaze:'釉光显现',poster:'生成作品海报',download:'下载 PNG',ready:'选择毛笔自由绘制，或选花卉印章后在画布点按。',painted:'纹样已更新；可转动器形查看。',glazed:'釉光已显现（艺术模拟）。',renderError:'器形预览暂不可用；平面绘制与撤销仍可使用。',saveError:'海报生成失败，请重试。',saved:'海报已生成，可点击下载或长按图片保存。',posterAlt:'你的数字青花作品海报，用户创作与艺术模拟',posterTitle:'一器一画 · 青花创作',posterSub:'数字绘瓷 · 用户创作 / 艺术模拟',posterFoot:'原创白胎创作模板，不对应馆藏原件。',cleared:'画布已清空，可撤销。'},
 en:{title:'Paint blue porcelain',intro:'Paint on the flat canvas; your pattern wraps around the creative vessel. Drag the preview or use the rotation slider to see its back.',note:'User creation · Artistic simulation. This is an original blank-vessel template, not a museum original. The glaze reveal does not simulate physical firing.',flat:'Pattern canvas',preview:'Vessel preview',brush:'Brush',flower:'Floral stamp',width:'Brush width',density:'Cobalt density',angle:'Rotate vessel',undo:'Undo',clear:'Clear',glaze:'Reveal glaze',poster:'Create artwork poster',download:'Download PNG',ready:'Paint freely, or select the floral stamp and tap the canvas.',painted:'Pattern updated. Rotate the vessel to see more.',glazed:'Glaze revealed (artistic simulation).',renderError:'The 3D preview is unavailable. Flat painting and undo still work.',saveError:'Could not create the poster. Please try again.',saved:'Poster ready. Download it or long-press the image to save.',posterAlt:'Your digital porcelain artwork poster, user creation and artistic simulation',posterTitle:'A vessel of your own',posterSub:'Digital porcelain · User creation / Artistic simulation',posterFoot:'Original creative vessel; not a museum original.',cleared:'Canvas cleared. Undo is available.'}
};

export function mountPaint(container,{language='zh',THREE,renderPreview}) {
 const t=words[language]||words.zh,lifetime=new AbortController(),history=boundedHistory(12),root=document.createElement('section');
 root.className='innovation-paint';root.dataset.testid='paintStudio';
 root.innerHTML=`<h3>${t.title}</h3><p>${t.intro}</p><p class="innovation-note">${t.note}</p><div class="innovation-toolbar"><button type="button" data-tool="brush" aria-pressed="true">${t.brush}</button><button type="button" data-tool="flower" aria-pressed="false">${t.flower}</button><label class="innovation-field">${t.width}<input data-control="width" type="range" min="2" max="28" value="10"></label><label class="innovation-field">${t.density}<input data-control="density" type="range" min="20" max="100" value="75"></label></div><div class="innovation-studio-grid"><div class="innovation-canvas-wrap"><h4>${t.flat}</h4><canvas data-testid="paintCanvas" width="512" height="256" tabindex="0" aria-label="${t.flat}"></canvas></div><div class="innovation-canvas-wrap"><h4>${t.preview}</h4><canvas data-testid="paintPreview" width="512" height="512" aria-label="${t.preview}"></canvas><label class="innovation-field">${t.angle}<input data-control="angle" type="range" min="-180" max="180" value="0"></label></div></div><div class="innovation-actions"><button type="button" data-action="undo" disabled>${t.undo}</button><button type="button" data-action="clear">${t.clear}</button><button type="button" data-action="glaze">${t.glaze}</button><button type="button" data-action="poster">${t.poster}</button><a data-action="download" class="download" hidden>${t.download}</a></div><p class="innovation-status" role="status" aria-live="polite">${t.ready}</p><img data-testid="paintPoster" alt="${t.posterAlt}" hidden>`;
 container.append(root);
 const $=selector=>root.querySelector(selector),canvas=$('[data-testid="paintCanvas"]'),preview=$('[data-testid="paintPreview"]'),ctx=canvas.getContext('2d',{willReadFrequently:true}),status=$('.innovation-status'),undo=$('[data-action="undo"]'),glaze=$('[data-action="glaze"]'),poster=$('[data-action="poster"]'),download=$('[data-action="download"]'),posterImage=$('[data-testid="paintPoster"]'),angle=$('[data-control="angle"]');
 const listen=(node,type,handler)=>node.addEventListener(type,handler,{signal:lifetime.signal});
 for(const item of root.querySelectorAll('button,input,a'))item.style.minHeight='44px';
 for(const item of [canvas,preview]){item.style.width='100%';item.style.height='auto';item.style.display='block';item.style.touchAction='none';}
 canvas.style.aspectRatio='2 / 1';preview.style.aspectRatio='1';canvas.style.background='#faf7ed';preview.style.background='#0b1426';
 let active=true,scene,camera,vase,texture,material,pedestal,geometry,pedestalGeometry,pedestalMaterial,tool='brush',stroke=null,rotation=null,renderTimer=null,glazeTimer=null,lastRender=-Infinity,renderFailed=false,textureDirty=true,downloadURL=null,saveToken=0;
 const setStatus=text=>{status.textContent=text;};
 function fillBlank(){ctx.fillStyle='#faf7ed';ctx.fillRect(0,0,512,256);textureDirty=true;}
 function invalidatePoster(){saveToken++;download.hidden=true;download.removeAttribute('href');posterImage.hidden=true;posterImage.removeAttribute('src');if(downloadURL){URL.revokeObjectURL(downloadURL);downloadURL=null;}}
 function snapshot(){history.push(ctx.getImageData(0,0,512,256));undo.disabled=false;invalidatePoster();}
 function render(){
  renderTimer=null;if(!active||!scene||renderFailed)return;
  try{if(textureDirty){texture.needsUpdate=true;textureDirty=false;}renderPreview(scene,camera,preview);lastRender=performance.now();}catch(error){renderFailed=true;setStatus(t.renderError);console.warn('Paint preview unavailable:',error);}
 }
 function scheduleRender(){if(!active||renderFailed||renderTimer!==null)return;const delay=Math.max(0,125-(performance.now()-lastRender));if(delay===0)render();else renderTimer=setTimeout(render,delay);}
 function drawBrush(from,to){
  ctx.strokeStyle=`rgba(31,63,143,${Number($('[data-control="density"]').value)/100})`;ctx.lineWidth=Number($('[data-control="width"]').value);ctx.lineCap='round';ctx.lineJoin='round';
  for(const offset of [-512,0,512]){ctx.beginPath();ctx.moveTo(from.x+offset,from.y);ctx.lineTo(to.x+offset,to.y);ctx.stroke();}
  textureDirty=true;
 }
 function stamp(point){
  const size=Number($('[data-control="width"]').value)*1.3+11,alpha=Number($('[data-control="density"]').value)/100;
  for(const offset of [-512,0,512]){
   ctx.save();ctx.translate(point.x+offset,point.y);ctx.strokeStyle=`rgba(31,63,143,${alpha})`;ctx.fillStyle=`rgba(31,63,143,${alpha*.2})`;ctx.lineWidth=1.1;
   for(let n=0;n<8;n++){ctx.save();ctx.rotate(n*Math.PI/4);ctx.beginPath();ctx.ellipse(0,-size*.47,size*.2,size*.48,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore();}
   ctx.beginPath();ctx.arc(0,0,size*.16,0,Math.PI*2);ctx.fillStyle=`rgba(31,63,143,${alpha})`;ctx.fill();ctx.restore();
  }
  textureDirty=true;
 }
 function finishStroke(event){
  if(!stroke||event&&event.pointerId!==undefined&&event.pointerId!==stroke.id)return;
  const id=stroke.id;stroke=null;try{canvas.releasePointerCapture(id);}catch{}scheduleRender();setStatus(renderFailed?t.renderError:t.painted);
 }
 function finishRotation(event){if(!rotation||event&&event.pointerId!==undefined&&event.pointerId!==rotation.id)return;const id=rotation.id;rotation=null;try{preview.releasePointerCapture(id);}catch{}}
 function setAngle(value){angle.value=String(value);if(vase){vase.rotation.y=Math.PI+Number(angle.value)*Math.PI/180;scheduleRender();}}
 function stopGlaze(){if(glazeTimer!==null)clearTimeout(glazeTimer);glazeTimer=null;glaze.disabled=false;}
 function dispose(){if(!active)return;active=false;lifetime.abort();finishStroke();finishRotation();if(renderTimer!==null)clearTimeout(renderTimer);stopGlaze();invalidatePoster();history.clear();texture?.dispose();geometry?.dispose();material?.dispose();pedestalGeometry?.dispose();pedestalMaterial?.dispose();root.remove();}
 try{
  if(!ctx)throw new Error('Canvas 2D unavailable');fillBlank();
  scene=new THREE.Scene();scene.background=new THREE.Color(0x0b1426);camera=new THREE.PerspectiveCamera(33,1,.1,30);camera.position.set(0,.4,7);camera.lookAt(0,0,0);
  scene.add(new THREE.HemisphereLight(0xdce9ff,0x2c3553,2.1));const key=new THREE.DirectionalLight(0xffffff,2.2);key.position.set(-3,4,4);scene.add(key);const rim=new THREE.DirectionalLight(0x729fff,1.6);rim.position.set(3,1,-2);scene.add(rim);
  const outer=new THREE.SplineCurve([[0,-1.5],[.37,-1.5],[.42,-1.4],[.43,-1.18],[.65,-.72],[.72,.08],[.68,.7],[.49,1.02],[.24,1.2],[.23,1.42],[.3,1.47]].map(([x,y])=>new THREE.Vector2(x,y))).getPoints(40);
  const points=outer.concat([[.3,1.52],[.255,1.52],[.19,1.4],[.195,1.2],[.45,.95],[.62,.6],[.65,0],[.56,-.75],[.33,-1.3],[0,-1.3]].map(([x,y])=>new THREE.Vector2(x,y)));
  geometry=new THREE.LatheGeometry(points,64);const uv=geometry.attributes.uv;
  for(let i=0;i<uv.count;i++)uv.setY(i,(geometry.attributes.position.getY(i)+1.5)/3.02);
  texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=THREE.RepeatWrapping;texture.anisotropy=2;
  material=new THREE.MeshPhysicalMaterial({map:texture,color:0xffffff,roughness:.64,metalness:0,clearcoat:.12,clearcoatRoughness:.18,side:THREE.DoubleSide});vase=new THREE.Mesh(geometry,material);vase.rotation.y=Math.PI;scene.add(vase);
  pedestalGeometry=new THREE.CylinderGeometry(.65,.72,.12,48);pedestalMaterial=new THREE.MeshStandardMaterial({color:0x283c60,roughness:.8});pedestal=new THREE.Mesh(pedestalGeometry,pedestalMaterial);pedestal.position.y=-1.56;scene.add(pedestal);
  listen(canvas,'pointerdown',event=>{
   if(stroke||!event.isPrimary||event.button!==0)return;const point=canvasPoint(event,canvas.getBoundingClientRect(),512,256);if(!point)return;event.preventDefault();stopGlaze();snapshot();stroke={id:event.pointerId,last:point};try{canvas.setPointerCapture(event.pointerId);}catch{}
   if(tool==='flower')stamp(point);else drawBrush(point,{x:point.x+.01,y:point.y});scheduleRender();
  });
  listen(canvas,'pointermove',event=>{
   if(!stroke||event.pointerId!==stroke.id)return;if(event.pointerType==='mouse'&&event.buttons!==1){finishStroke(event);return;}event.preventDefault();const point=canvasPoint(event,canvas.getBoundingClientRect(),512,256);if(!point)return;if(tool==='brush')drawBrush(stroke.last,point);stroke.last=point;scheduleRender();
  });
  for(const type of ['pointerup','pointercancel','lostpointercapture'])listen(canvas,type,finishStroke);
  listen(preview,'pointerdown',event=>{if(rotation||!event.isPrimary||event.button!==0)return;event.preventDefault();rotation={id:event.pointerId,x:event.clientX,angle:Number(angle.value)};try{preview.setPointerCapture(event.pointerId);}catch{}});
  listen(preview,'pointermove',event=>{if(!rotation||event.pointerId!==rotation.id)return;event.preventDefault();const width=Math.max(1,preview.getBoundingClientRect().width),value=rotation.angle+(event.clientX-rotation.x)*300/width;setAngle(((value+180)%360+360)%360-180);});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])listen(preview,type,finishRotation);
  listen(window,'blur',()=>{finishStroke();finishRotation();});listen(angle,'input',()=>setAngle(Number(angle.value)));
  for(const button of root.querySelectorAll('[data-tool]'))listen(button,'click',()=>{tool=button.dataset.tool;for(const item of root.querySelectorAll('[data-tool]'))item.setAttribute('aria-pressed',String(item===button));});
  listen(undo,'click',()=>{finishStroke();const frame=history.pop();if(frame){stopGlaze();ctx.putImageData(frame,0,0);textureDirty=true;invalidatePoster();scheduleRender();setStatus(renderFailed?t.renderError:t.painted);}undo.disabled=history.size===0;});
  listen($('[data-action="clear"]'),'click',()=>{finishStroke();stopGlaze();snapshot();fillBlank();scheduleRender();setStatus(renderFailed?t.renderError:t.cleared);});
  listen(canvas,'keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();undo.click();}else if(tool==='flower'&&(event.key==='Enter'||event.key===' ')){event.preventDefault();snapshot();stamp({x:256,y:128});scheduleRender();setStatus(renderFailed?t.renderError:t.painted);}});
  listen(glaze,'click',()=>{
   finishStroke();stopGlaze();invalidatePoster();glaze.disabled=true;const start=performance.now(),reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
   const tick=()=>{if(!active)return;const progress=reduced?1:Math.min(1,(performance.now()-start)/1000),eased=progress*progress*(3-2*progress);material.roughness=.75-.53*eased;material.clearcoat=.12+.75*eased;scheduleRender();if(progress<1)glazeTimer=setTimeout(tick,125);else{glazeTimer=null;glaze.disabled=false;setStatus(renderFailed?t.renderError:t.glazed);}};tick();
  });
  listen(poster,'click',async()=>{
   finishStroke();finishRotation();const token=++saveToken;poster.disabled=true;
   try{
    if(!renderFailed)render();const sheet=document.createElement('canvas');sheet.width=1280;sheet.height=900;const draw=sheet.getContext('2d');if(!draw)throw new Error('Canvas 2D unavailable');
    draw.fillStyle='#0b1426';draw.fillRect(0,0,1280,900);draw.strokeStyle='#7da8eb';draw.lineWidth=2;draw.strokeRect(24,24,1232,852);draw.fillStyle='#eaf2ff';draw.font='bold 42px sans-serif';draw.fillText(t.posterTitle,64,95);draw.fillStyle='#a9c9ff';draw.font='22px sans-serif';draw.fillText(t.posterSub,64,137);
    if(!renderFailed)draw.drawImage(preview,36,182,630,630);else{draw.fillStyle='#a9c9ff';draw.font='24px sans-serif';draw.fillText(t.flat,80,360);}
    draw.fillStyle='#a9c9ff';draw.font='24px sans-serif';draw.fillText(t.flat,710,264);draw.drawImage(canvas,710,292,512,256);draw.strokeStyle='#7da8eb';draw.strokeRect(710,292,512,256);draw.font='20px sans-serif';draw.fillText(language==='en'?'Cobalt on a canvas. A pattern made by you.':'以钴蓝落笔，让纹样环绕器形。',710,602);draw.fillText(language==='en'?'An original digital creation.':'这一笔，属于你的数字青花。',710,638);draw.fillStyle='#aebbd0';draw.font='18px sans-serif';draw.fillText(t.posterFoot,64,841);
    const blob=await new Promise((resolve,reject)=>sheet.toBlob(value=>value?resolve(value):reject(new Error('PNG encoding failed')),'image/png'));if(!active||token!==saveToken)return;
    if(downloadURL)URL.revokeObjectURL(downloadURL);downloadURL=URL.createObjectURL(blob);download.href=downloadURL;download.download='qinghua-user-creation.png';download.hidden=false;posterImage.src=downloadURL;posterImage.hidden=false;setStatus(t.saved);
   }catch(error){if(active)setStatus(t.saveError);console.warn('Paint poster unavailable:',error);}finally{if(active)poster.disabled=false;}
  });
  render();return {dispose};
 }catch(error){dispose();throw error;}
}
