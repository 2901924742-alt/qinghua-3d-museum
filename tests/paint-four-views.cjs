'use strict';
// Actual capture/export/lifecycle bodies. Controlled Canvas and encoding; no renderer, GPU or raster claim.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
const sourceFile=path.resolve(process.argv[2]||path.join(__dirname,'../enhancements/paint-studio.js')),source=fs.readFileSync(sourceFile,'utf8');
function body(name){
 const start=new RegExp('^ (?:async )?function '+name+'\\(','m').exec(source)?.index;assert(start!==undefined,'Actual '+name+' must exist');
 const firstEnd=source.indexOf('\n',start),first=source.slice(start,firstEnd).trim();if(first.endsWith('}'))return first;
 const close=/^ \}/m.exec(source.slice(firstEnd));assert(close,name+' closing');return source.slice(start,firstEnd+close.index+close[0].length).trim();
}
const checks=[];
(async()=>{
 const THREE=await import(pathToFileURL(path.join(__dirname,'../vendor/three.module.js')));
 function fixture(options={}){
  const created=[],encodings=[],renderCalls=[],messages=[],revoked=[],made=[],urls=new Set(['blob:old']),nodes=new Map();let captureCount=0,copyCount=0,flushes=0,removed=0;
  const node=(extra={})=>({disabled:false,hidden:false,setAttribute(name,value){this[name]=String(value);},removeAttribute(name){delete this[name];},...extra});
  const $=selector=>{if(!nodes.has(selector))nodes.set(selector,node());return nodes.get(selector);};
  const flat=node({width:512,height:256,marker:'current-paint'}),preview=node({width:512,height:512,marker:'visible-preview'}),poster=node(),four=$('[data-action="fourViews"]'),download=node({href:'blob:old',download:'old.png'}),posterImage=node({src:'blob:old'});
  const texture=new THREE.CanvasTexture(flat),material=new THREE.MeshPhysicalMaterial({map:texture,roughness:.64,clearcoat:.12}),geometry=new THREE.BufferGeometry(),vase=new THREE.Mesh(geometry,material),scene=new THREE.Scene();scene.add(vase);vase.rotation.set(.14,Math.PI+.37,-.29,'ZXY');vase.position.set(.2,-.1,.3);vase.updateMatrixWorld(true);
  function drawing(owner){return {copies:[],texts:[],fillRect(){},strokeRect(){},fillText(...args){this.texts.push(args);},drawImage(image,...args){
   if(image!==flat&&image!==preview&&image.width===512&&image.height===512&&++copyCount===options.copyFailure)throw Error('Injected tile copy failure');
   this.copies.push({image,marker:image.marker,args:[...args]});if(owner)owner.marker=image.marker;
  }};}
  function createCanvas(){
   const canvas={width:0,height:0,marker:null},draw=drawing(canvas);canvas.draw=draw;created.push(canvas);
   canvas.getContext=()=>options.noSheetContext&&canvas.width===1280?null:draw;
   canvas.toBlob=callback=>{if(options.encodeThrow)throw Error('Injected encoder failure');encodings.push({canvas,callback,images:draw.copies.map(({marker,args})=>({marker,args:[...args]})),texts:draw.texts.map(args=>[...args])});};return canvas;
  }
  const history={size:2,clear(){this.size=0;}},future={size:1,clear(){this.size=0;}};
  const context={THREE,console:{warn(){}},document:{createElement(tag){assert.equal(tag,'canvas');return createCanvas();}},URL:{createObjectURL(blob){assert(blob);const value='blob:new-'+(made.length+1);made.push(value);urls.add(value);return value;},revokeObjectURL(value){revoked.push(value);urls.delete(value);}},
   active:true,suspended:false,restoring:false,renderFailed:false,contextUnavailable:false,shapeUnavailable:false,shapeOwner:null,draftProtected:false,scene,camera:new THREE.PerspectiveCamera(),vase,geometry,material,texture,textureDirty:true,canvas:flat,preview,poster,download,posterImage,downloadURL:'blob:old',saveToken:10,posterJobToken:null,language:'en',
   t:{posterTitle:'Old title',posterSub:'User creation',flat:'Flat pattern',posterFoot:'Original creative vessel',posterShapeFoot:'Your original vessel',posterFlatFoot:'Flat only',saveError:'save failed',saved:'saved',renderError:'render failed'},viewWords:{title:'One vessel, four views',direction:'Design direction',unavailable:'four views unavailable'},
   $,root:{setAttribute(){},querySelectorAll:()=>[poster,four,$('[data-action="saveArtwork"]')],remove(){removed++;}},angle:{value:String(.37*180/Math.PI)},currentAngle:.37*180/Math.PI,shapeNote:{},classicButton:{},history,future,
   cancelAlignment(){},updateAlignmentControls(){},updateViewLightControls(){},finishStroke(){},finishRotation(){},stopGlaze(){},setStatus(value){messages.push(value);},invalidateGLB(){},updateHistory(){},updateSurfaceControls(){},updateGLBControls(){},updateCompositionControls(){},cancelComposition(){},cancelArtwork(){},flushDraft(){flushes++;},invalidateArtwork(){},updateStampSample(){},scheduleRender(){},
   renderTimer:null,lastRender:0,performance:{now:()=>1000},clearTimeout(){},restoreTimer:null,restoreImage:null,lifetime:{abort(){}},inkRAF:null,inkDirty:false,naturalBrush:null,brushFactory:null,surfaceRAF:null,surfacePointer:null,surfaceSamples:[],rayHits:[],raycaster:null,rayPosition:null,stampSample:{width:192,height:192},stampSampleContext:null,pedestalGeometry:{dispose(){}},pedestalMaterial:{dispose(){}},
   renderPreview(currentScene,camera,target){assert.equal(currentScene,scene);vase.updateMatrixWorld(true);const capture=target!==preview;if(capture)captureCount++;renderCalls.push({target,angle:vase.rotation.y,x:vase.rotation.x,z:vase.rotation.z,order:vase.rotation.order,textureVersion:texture.version});if(capture&&captureCount===options.renderFailure)throw Error('Injected capture failure');target.marker=flat.marker+' @ '+vase.rotation.y;}
  };
  vm.createContext(context);for(const name of ['updatePosterControls','captureFourViews','exportPNG','invalidatePoster','lockRestore','render','flushOnLeave','suspend','resume','dispose','snapshotGLB','releaseGLB'])vm.runInContext(body(name),context);
  const run=code=>vm.runInContext(code,context),direct=drawing();
  const documentState=()=>({flat:flat.marker,visible:preview.marker,angle:context.currentAngle,input:context.angle.value,history:history.size,future:future.size,geometry:vase.geometry.uuid,material:vase.material.uuid,map:vase.material.map.uuid,rotation:vase.rotation.toArray(),quaternion:vase.quaternion.toArray(),matrix:vase.matrixWorld.toArray(),roughness:material.roughness,clearcoat:material.clearcoat});
  const outputs=()=>({href:download.href,hidden:download.hidden,image:posterImage.src,imageHidden:posterImage.hidden,active:[...urls]});
  return {context,run,direct,created,encodings,renderCalls,messages,revoked,made,urls,poster,four,download,posterImage,documentState,outputs,complete(value={}){assert(encodings.length);encodings.at(-1).callback(value);},get flushes(){return flushes;},get removed(){return removed;}};
 }
 async function test(name,fn,options){await fn(fixture(options));checks.push(name);}
 function viewLightFixture(f){
  const c=f.context,node=(extra={})=>({disabled:false,value:'0',textContent:'',setAttribute(name,value){this[name]=String(value);},...extra});
  Object.assign(c,{key:null,viewLightAngle:0,lightAngle:node(),lightOutput:node({textContent:'0°'}),lightPresets:[0,-55,125].map(degrees=>node({dataset:{lightAngle:String(degrees)},'aria-pressed':String(degrees===0)})),glbToken:31,glbJob:null,glbURL:'blob:glb',artworkURL:'blob:json',artworkJob:{token:7},draftDirty:false,draftTimer:null,alignmentShift:128});
  c.texture.offset.x=-.25;c.texture.updateMatrix();c.textureDirty=false;f.urls.add('blob:glb');c.$('[data-action="glbDownload"]').href='blob:glb';c.$('[data-action="glbDownload"]').hidden=false;
  const effects=[];for(const name of ['finishStroke','finishRotation','stopGlaze','cancelAlignment','cancelComposition','snapshot','queueDraft','invalidateArtwork'])c[name]=()=>{effects.push(name);};
  c.t.glbChanged='GLB changed';let schedules=0,cancellations=0;c.scheduleRender=()=>{schedules++;};c.listen=(node,type,handler)=>{node[type]=handler;};
  for(const name of ['invalidateGLB','updateViewLightControls','setViewLight'])f.run(body(name));
  const lighting=source.split(/\r?\n/).filter(line=>line.includes('scene.add(new THREE.HemisphereLight'));assert.equal(lighting.length,1);f.run(lighting[0]);
  const binding=source.split(/\r?\n/).filter(line=>line.startsWith("  listen(lightAngle,'input'"));assert.equal(binding.length,1);f.run(binding[0]);
  const invariant=()=>({document:f.documentState(),textureVersion:c.texture.version,materialVersion:c.material.version,textureDirty:c.textureDirty,offset:c.texture.offset.toArray(),alignment:c.alignmentShift,artworkURL:c.artworkURL,artworkJob:c.artworkJob,draftDirty:c.draftDirty,draftTimer:c.draftTimer,effects:[...effects]});
  const glbState=()=>({token:c.glbToken,job:c.glbJob,url:c.glbURL,href:c.$('[data-action="glbDownload"]').href,hidden:c.$('[data-action="glbDownload"]').hidden});
  return {c,invariant,glbState,get schedules(){return schedules;},get cancellations(){return cancellations;},pending(phase){c.glbJob={phase,cancelled:false,cancelLoad(){cancellations++;}};},input(degrees){c.lightAngle.value=String(degrees);c.lightAngle.input();},preset(index){c.lightPresets[index].click();}};
 }
 await test('four-fixed-design-angles-copy-immediately-and-restore-complete-transform',async f=>{
  const before=f.documentState(),version=f.context.texture.version;f.context.draw=f.direct;f.run('captureFourViews(draw)');assert.deepEqual(f.documentState(),before);assert.equal(f.context.textureDirty,true);assert.equal(f.context.texture.version,version+1);
  assert.deepEqual(f.renderCalls.map(c=>c.angle),[0,1,2,3].map(i=>Math.PI+i*Math.PI/2));assert(f.renderCalls.every(c=>c.x===before.rotation[0]&&c.z===before.rotation[2]&&c.order===before.rotation[3]));
  assert.deepEqual(f.direct.copies.map(c=>c.args),[[80,168,512,512],[688,168,512,512],[80,736,512,512],[688,736,512,512]]);assert.equal(new Set(f.direct.copies.map(c=>c.marker)).size,4);assert(f.renderCalls.every(c=>c.target!==f.context.preview));assert(f.created.every(c=>c.width===0&&c.height===0));assert.equal(f.encodings.length,0);assert.equal(f.context.saveToken,10);
 });
 await test('clean-texture-does-not-request-another-upload',async f=>{f.context.textureDirty=false;const version=f.context.texture.version;f.context.draw=f.direct;f.run('captureFourViews(draw)');assert.equal(f.context.texture.version,version);assert.equal(f.context.textureDirty,false);});
 for(const [name,options]of [['render',{renderFailure:3}],['copy',{copyFailure:3}]])await test('third-'+name+'-failure-restores-transform-keeps-old-output-and-can-retry',async f=>{
  const before=f.documentState(),old=f.outputs();await f.run('exportPNG(true)');assert.deepEqual(f.documentState(),before);assert.deepEqual(f.outputs(),old);assert.equal(f.context.renderFailed,false);assert.equal(f.encodings.length,0);assert.equal(f.context.posterJobToken,null);assert.equal(f.poster.disabled,false);assert.equal(f.four.disabled,false);assert.equal(f.messages.at(-1),'save failed');assert(f.created.every(c=>c.width===0&&c.height===0));
  const retry=f.run('exportPNG(true)');assert.equal(f.encodings.length,1);f.complete();await retry;assert.equal(f.download.download,'qinghua-four-views.png');
 },options);
 await test('four-view-pixels-fixed-before-first-await-and-one-shared-png-slot',async f=>{
  const before=f.documentState(),pending=f.run('exportPNG(true)');assert.deepEqual(f.documentState(),before);assert.equal(f.encodings.length,1);const encoding=f.encodings[0];assert.equal(encoding.canvas.width,1280);assert.equal(encoding.canvas.height,1664);assert.equal(encoding.images.length,5);assert.equal(encoding.images[4].marker,'current-paint');assert.deepEqual(encoding.images[4].args,[384,1320,512,256]);assert.equal(new Set(encoding.images.slice(0,4).map(c=>c.marker)).size,4);assert(f.poster.disabled&&f.four.disabled);assert.equal(f.download.href,'blob:old');assert.deepEqual(f.revoked,[]);
  const token=f.context.saveToken;await f.run('exportPNG()');assert.equal(f.encodings.length,1);assert.equal(f.context.saveToken,token);assert.equal(encoding.canvas.height,1664);assert(f.created.filter(c=>c!==encoding.canvas).every(c=>c.width===0&&c.height===0));f.complete();await pending;assert.equal(f.download.download,'qinghua-four-views.png');assert.equal(f.posterImage.src,f.download.href);assert.deepEqual(f.revoked,['blob:old']);assert.equal(encoding.canvas.width,0);assert.equal(encoding.canvas.height,0);assert(!f.poster.disabled&&!f.four.disabled);
 });
 await test('old-poster-keeps-1280x900-layout-and-filename',async f=>{
  const pending=f.run('exportPNG()'),encoding=f.encodings[0];assert.equal(encoding.canvas.width,1280);assert.equal(encoding.canvas.height,900);assert.equal(f.renderCalls.length,1);assert.equal(f.renderCalls[0].target,f.context.preview);assert.deepEqual(encoding.images.map(c=>c.args),[[36,182,630,630],[710,292,512,256]]);assert(encoding.texts.some(args=>args[0]==='Old title'));f.complete();await pending;assert.equal(f.download.download,'qinghua-user-creation.png');assert(encoding.canvas.width===0&&encoding.canvas.height===0);
 });
 for(const unavailable of ['shapeUnavailable','renderFailed'])await test(unavailable+'-blocks-only-four-views-and-old-poster-still-saves-flat-pattern',async f=>{
  f.context[unavailable]=true;f.run('updatePosterControls()');assert(f.four.disabled&&!f.poster.disabled);await f.run('exportPNG(true)');assert.equal(f.encodings.length,0);assert.equal(f.messages.at(-1),'four views unavailable');const pending=f.run('exportPNG()'),encoding=f.encodings[0];assert.deepEqual(encoding.images.map(c=>c.args),[[710,292,512,256]]);f.complete();await pending;assert(!f.poster.disabled&&f.four.disabled);
 });
 for(const mode of ['null','throw','context'])await test('encoder-or-sheet-'+mode+'-failure-preserves-old-url-and-releases-canvas',async f=>{
  const old=f.outputs(),pending=f.run('exportPNG(true)');if(mode==='null')f.complete(null);await pending;assert.deepEqual(f.outputs(),old);assert.equal(f.made.length,0);assert.equal(f.messages.at(-1),'save failed');assert(f.created.every(c=>c.width===0&&c.height===0));assert(!f.poster.disabled&&!f.four.disabled);
 },{encodeThrow:mode==='throw',noSheetContext:mode==='context'});
 await test('edit-invalidates-held-png-without-publishing-a-late-url',async f=>{
  const pending=f.run('exportPNG(true)'),encoding=f.encodings[0];f.context.canvas.marker='new paint';f.run('invalidatePoster()');assert.equal(encoding.images[4].marker,'current-paint');f.complete();await pending;assert.equal(f.made.length,0);assert.equal(f.download.hidden,true);assert.equal(f.posterImage.hidden,true);assert.equal(f.urls.size,0);assert(encoding.canvas.width===0&&encoding.canvas.height===0);
 });
 await test('old-png-finally-cannot-unlock-an-in-progress-import',async f=>{
  const pending=f.run('exportPNG(true)');f.run('lockRestore(true)');f.complete();await pending;assert(f.poster.disabled&&f.four.disabled);assert.equal(f.context.restoring,true);f.run('invalidatePoster();lockRestore(false)');assert(!f.poster.disabled&&!f.four.disabled);assert.equal(f.download.hidden,true);
 });
 await test('failed-import-with-the-same-document-keeps-held-png-valid',async f=>{
  const pending=f.run('exportPNG(true)');f.run('lockRestore(true);lockRestore(false)');assert(f.poster.disabled&&f.four.disabled);f.complete();await pending;assert.equal(f.download.download,'qinghua-four-views.png');assert.equal(f.download.hidden,false);
 });
 await test('suspended-session-may-finish-encoding-and-resume-with-the-same-output',async f=>{
  const pending=f.run('exportPNG(true)'),token=f.context.saveToken;f.run('suspend()');assert.equal(f.context.saveToken,token);assert.equal(f.context.suspended,true);f.complete();await pending;assert.equal(f.download.hidden,false);assert.equal(f.download.download,'qinghua-four-views.png');const href=f.download.href;f.run('resume()');assert.equal(f.download.href,href);assert.equal(f.context.suspended,false);
 });
 await test('dispose-revokes-old-output-and-late-encoding-cannot-publish',async f=>{
  const pending=f.run('exportPNG(true)'),encoding=f.encodings[0];f.run('dispose()');assert.equal(f.context.active,false);assert.equal(f.removed,1);assert.equal(f.urls.size,0);f.complete();await pending;assert.equal(f.made.length,0);assert.equal(f.download.hidden,true);assert(encoding.canvas.width===0&&encoding.canvas.height===0);
 });
 await test('restore-unlock-recomputes-png-busy-and-unavailable-states',async f=>{
  f.context.renderFailed=true;f.run('lockRestore(true);lockRestore(false)');assert(!f.poster.disabled&&f.four.disabled);f.context.renderFailed=false;f.run('updatePosterControls()');const pending=f.run('exportPNG()');f.run('lockRestore(true);lockRestore(false)');assert(f.poster.disabled&&f.four.disabled);f.complete();await pending;assert(!f.poster.disabled&&!f.four.disabled);
 });
 await test('actual-glb-snapshot-still-copies-original-pose-map-and-paint-after-capture',async f=>{
  const pose=f.context.vase.quaternion.toArray(),map=f.context.material.map;f.context.beforeJob={};f.run('snapshotGLB(beforeJob)');f.context.draw=f.direct;f.run('captureFourViews(draw)');f.context.afterJob={};f.run('snapshotGLB(afterJob)');assert.deepEqual(f.context.beforeJob.mesh.quaternion.toArray(),pose);assert.deepEqual(f.context.afterJob.mesh.quaternion.toArray(),pose);assert.equal(f.context.material.map,map);assert.equal(f.context.texture.image,f.context.canvas);assert.equal(f.context.beforeJob.canvas.draw.copies[0].marker,'current-paint');assert.equal(f.context.afterJob.canvas.draw.copies[0].marker,'current-paint');f.run('releaseGLB(beforeJob);releaseGLB(afterJob)');
 });
 await test('view-light-PNG-only-invalidation-does-not-invalidate-GLB',async f=>{let glbInvalidations=0;f.context.invalidateGLB=()=>{glbInvalidations++;};f.run('invalidatePoster(false)');assert.equal(glbInvalidations,0);assert.equal(f.context.saveToken,11);assert.equal(f.download.hidden,true);assert.deepEqual(f.revoked,['blob:old']);});
 await test('view-light-default-reuses-the-original-three-lights-and-native-bindings',async f=>{
  const light=viewLightFixture(f),c=light.c,before=light.invariant(),old=f.outputs();assert.deepEqual(c.key.position.toArray(),[-3,4,4]);assert.equal(c.key.color.getHex(),0xffffff);assert.equal(c.key.intensity,2.2);assert.equal(c.viewLightAngle,0);assert.equal(c.lightOutput.textContent,'0°');assert.deepEqual(c.lightPresets.map(n=>n['aria-pressed']),['true','false','false']);assert(c.lightPresets.every(n=>!n.disabled));
  assert.deepEqual(c.scene.children.filter(n=>n.isLight).map(n=>[n.type,n.intensity,n.color.getHex(),n.position.toArray()]),[['HemisphereLight',2.1,0xdce9ff,[0,1,0]],['DirectionalLight',2.2,0xffffff,[-3,4,4]],['DirectionalLight',1.6,0x729fff,[3,1,-2]]]);
  light.preset(0);f.run('setViewLight(-0)');assert.equal(light.schedules,0);assert.equal(c.saveToken,10);assert.deepEqual(light.invariant(),before);assert.deepEqual(f.outputs(),old);
  assert(source.includes('data-control="lightAngle" type="range" min="-180" max="180" step="1" value="0"'));assert(source.includes("lightGroup.dataset.testid='paintLightGroup'"));assert(source.includes('data-value="lightAngle">0°</output>'));
 });
 await test('view-light-presets-and-keyboard-angles-change-only-key-position-and-PNG',async f=>{
  const light=viewLightFixture(f),c=light.c,before=light.invariant(),glb=light.glbState(),initial=c.key.position.clone();
  for(const degrees of [-55,125,1,8,-180,180,12.5,0]){light.input(degrees);assert.equal(c.viewLightAngle,degrees);assert.equal(c.lightOutput.textContent,degrees+'°');assert.equal(c.lightAngle.value,String(degrees));assert.deepEqual(c.lightPresets.map(n=>n['aria-pressed']),[0,-55,125].map(n=>String(n===degrees)));assert(Math.abs(Math.hypot(c.key.position.x,c.key.position.z)-5)<1e-12);assert.equal(c.key.position.y,4);assert(Math.abs(c.key.position.lengthSq()-41)<1e-12);const expected=initial.clone().applyAxisAngle(new THREE.Vector3(0,1,0),degrees*Math.PI/180);assert(c.key.position.distanceTo(expected)<1e-12);assert.deepEqual(light.invariant(),before);assert.deepEqual(light.glbState(),glb);}
  assert.deepEqual(c.key.position.toArray(),[-3,4,4]);assert.equal(light.schedules,8);assert.equal(c.saveToken,18);assert.deepEqual(f.revoked,['blob:old']);assert.equal(f.download.hidden,true);assert.equal(f.posterImage.hidden,true);light.preset(1);assert.equal(c.viewLightAngle,-55);light.preset(2);assert.equal(c.viewLightAngle,125);
 });
 await test('view-light-invalid-same-and-unavailable-inputs-do-not-draw-or-invalidate',async f=>{
  const light=viewLightFixture(f),c=light.c;light.preset(2);const before=light.invariant(),glb=light.glbState(),token=c.saveToken,schedules=light.schedules,position=c.key.position.toArray();
  for(const value of [125,NaN,Infinity,-Infinity,181,-181,'1',null,undefined]){c.invalid=value;f.run('setViewLight(invalid)');}
  for(const flag of ['active','suspended','restoring','renderFailed','shapeUnavailable','contextUnavailable']){const original=c[flag];c[flag]=flag!=='active';f.run('updateViewLightControls();setViewLight(-55)');assert(c.lightAngle.disabled&&c.lightPresets.every(n=>n.disabled));c[flag]=original;f.run('updateViewLightControls()');assert(!c.lightAngle.disabled&&c.lightPresets.every(n=>!n.disabled));}
  const key=c.key;c.key=null;f.run('updateViewLightControls();setViewLight(-55)');assert(c.lightAngle.disabled);c.key=key;f.run('updateViewLightControls()');assert.equal(c.saveToken,token);assert.equal(light.schedules,schedules);assert.deepEqual(c.key.position.toArray(),position);assert.deepEqual(light.invariant(),before);assert.deepEqual(light.glbState(),glb);
 });
 for(const phase of ['snapshot','loading','parsing'])await test('view-light-keeps-pending-GLB-'+phase+'-and-its-download',async f=>{
  const light=viewLightFixture(f),c=light.c;light.pending(phase);const before=light.invariant(),glb=light.glbState();f.run('updatePosterControls()');assert(!c.lightAngle.disabled);light.preset(1);assert.deepEqual(light.glbState(),glb);assert.equal(c.glbJob.cancelled,false);assert.equal(light.cancellations,0);assert.deepEqual(light.invariant(),before);assert(f.urls.has('blob:glb'));assert.deepEqual(f.revoked,['blob:old']);
  f.run('invalidatePoster()');assert.equal(c.glbToken,32);assert.equal(c.glbJob.cancelled,true);assert.equal(light.cancellations,1);assert(!f.urls.has('blob:glb'));assert.equal(c.$('[data-action="glbDownload"]').hidden,true);
 });
 await test('view-light-while-PNG-pending-invalidates-late-result-without-blocking-light',async f=>{
  const light=viewLightFixture(f),c=light.c,pending=f.run('exportPNG(true)'),encoding=f.encodings[0],token=c.posterJobToken;assert(c.poster.disabled);assert(!c.lightAngle.disabled);light.preset(1);assert.equal(c.posterJobToken,token);assert.equal(c.saveToken,token+1);assert.equal(c.glbToken,31);f.complete();await pending;assert.equal(c.posterJobToken,null);assert.equal(f.made.length,0);assert.equal(f.download.hidden,true);assert(!c.lightAngle.disabled);assert(encoding.canvas.width===0&&encoding.canvas.height===0);
 });
 await test('view-light-retains-current-light-through-four-views-errors-and-GLB-snapshots',async f=>{
  const light=viewLightFixture(f),c=light.c;light.preset(2);const position=c.key.position.toArray(),rotation=c.vase.rotation.toArray(),original=c.renderPreview,seen=[];c.renderPreview=(...args)=>{seen.push(c.key.position.toArray());return original(...args);};c.draw=f.direct;f.run('captureFourViews(draw)');assert.equal(seen.length,4);assert(seen.every(p=>JSON.stringify(p)===JSON.stringify(position)));assert.deepEqual(c.vase.rotation.toArray(),rotation);c.job={};f.run('snapshotGLB(job)');assert.equal(c.job.mesh.children.length,0);assert.equal(c.job.mesh.isLight,undefined);assert.equal(c.job.material.roughness,c.material.roughness);assert.deepEqual(c.key.position.toArray(),position);f.run('releaseGLB(job)');
  c.renderPreview=()=>{assert.deepEqual(c.key.position.toArray(),position);throw Error('capture fails');};assert.throws(()=>f.run('captureFourViews(draw)'),/capture fails/);assert.deepEqual(c.vase.rotation.toArray(),rotation);assert.deepEqual(c.key.position.toArray(),position);
 });
 await test('view-light-same-retained-session-survives-suspend-and-resume',async f=>{
  const light=viewLightFixture(f),c=light.c;light.preset(1);const position=c.key.position.toArray(),token=c.saveToken;f.run('suspend()');assert(c.lightAngle.disabled&&c.lightPresets.every(n=>n.disabled));f.run('setViewLight(125)');assert.deepEqual(c.key.position.toArray(),position);assert.equal(c.saveToken,token);f.run('resume()');assert(!c.lightAngle.disabled&&c.lightPresets.every(n=>!n.disabled));assert.deepEqual(c.key.position.toArray(),position);assert.equal(c.viewLightAngle,-55);assert.equal(c.saveToken,token);const fresh=viewLightFixture(fixture());assert.deepEqual(fresh.c.key.position.toArray(),[-3,4,4]);assert.equal(fresh.c.viewLightAngle,0);
 });
 console.log(JSON.stringify({status:'passed',checks:checks.length,cases:checks,sourceSHA256:crypto.createHash('sha256').update(source).digest('hex'),scope:'Actual extracted product capture/PNG/control/invalidation/restore/suspend/dispose/GLB-snapshot bodies, real THREE transforms and CPU objects. Canvas, renderPreview, encoding, DOM and URL methods are controlled stubs. No real PNG/GLB raster, browser, GPU, mobile layout or physical-device timing claim.'},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
