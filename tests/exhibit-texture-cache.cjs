// CPU-only: the real Three Texture, GLTFLoader parser and product cleanup; no browser or GL context.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),checks=[],tick=()=>new Promise(setImmediate);
const glb=fs.readFileSync(path.join(root,'qinghuaci.glb'));
const json=JSON.parse(glb.subarray(20,20+glb.readUInt32LE(12)).toString());
const bytes=()=>glb.buffer.slice(glb.byteOffset,glb.byteOffset+glb.byteLength);
const check=name=>checks.push(name);
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
(async()=>{
 const THREE=await import(pathToFileURL(path.join(root,'vendor/three.module.js')).href);
 const {createExhibitTextureCache}=await import(pathToFileURL(path.join(root,'enhancements/exhibit-cache.js')).href);
 const {addInterior}=await import(pathToFileURL(path.join(root,'enhancements/interior.js')).href);
 assert.equal(crypto.createHash('sha256').update(glb).digest('hex'),'65ae2037c70cf0dfe63fa0b3c5fd779a0c5df9cb8507bb390ec6c744d240bfdd');
 assert.equal(json.materials[0].pbrMetallicRoughness.baseColorTexture.index,0);assert.equal(json.textures[0].source,0);assert.equal(json.images[0].bufferView,4);assert.equal(json.bufferViews[4].byteLength,2320759);
 check('exact-original-asset-base-color-zero-only');
 const texture=(width=4096,height=4096)=>{const image={width,height,closed:0,close(){this.closed++;}},map=new THREE.Texture(image);let disposals=0;map.addEventListener('dispose',()=>disposals++);return {map,image,get disposals(){return disposals;}};};
 const parser=(result,fixtureJSON=json)=>({json:structuredClone(fixtureJSON),associations:new Map(),loads:0,loadTexture(index){this.loads++;assert.equal(index,0);return typeof result==='function'?result():Promise.resolve(result);}});
 assert.throws(()=>createExhibitTextureCache({maxBytes:-1}),RangeError);
 for(const invalid of ['url','index','transform','source','sampler','image','budget']){
  const d=structuredClone(json),cache=createExhibitTextureCache(invalid==='budget'?{maxBytes:80*1024*1024}:{}),l=cache.lease(invalid==='url'?'./models/beaker-vase-193.glb':'./qinghuaci.glb');
  if(invalid==='index')d.materials[0].pbrMetallicRoughness.baseColorTexture.index=1;
  if(invalid==='transform')d.materials[0].pbrMetallicRoughness.baseColorTexture.extensions={KHR_texture_transform:{offset:[.2,0]}};
  if(invalid==='source')d.textures[0].source=1;
  if(invalid==='sampler')d.samplers[0].minFilter=9729;
  if(invalid==='image')d.bufferViews[4].byteLength++;
  const p=parser(null,d),plugin=l.plugin(p);assert.equal(plugin.loadTexture(0),null);assert.equal(plugin.loadTexture(1),null);assert.equal(p.loads,0);l.release();cache.dispose();
 }
 check('identity-transform-sampler-budget-fallback-preserves-normal-loader');
 {
  const cache=createExhibitTextureCache(),t=texture(),a=cache.lease('./qinghuaci.glb'),p=parser(t.map),first=await a.plugin(p).loadTexture(0),model={};a.bind(model);
  const b=cache.lease('./qinghuaci.glb'),q=parser(()=>{throw Error('Retained texture must not load again');}),second=await b.plugin(q).loadTexture(0),other={};b.bind(other);
  assert.equal(first,second);assert.equal(first.source,second.source);assert.equal(p.loads,1);assert.equal(q.loads,0);assert.equal(cache.stats.refs,2);assert.equal(cache.stats.estimatedBytes,89478484);assert(cache.stats.estimatedBytes<=96*1024*1024);
  cache.clearIdle();assert.equal(t.disposals,0);cache.releaseModel(model);cache.releaseModel(model);assert.equal(cache.stats.refs,1);assert.equal(t.image.closed,0);
  cache.releaseModel(other);assert.equal(cache.stats.refs,0);assert.equal(t.disposals,0);cache.clearIdle();cache.clearIdle();assert.equal(t.disposals,1);assert.equal(t.image.closed,1);cache.dispose();
 }
 check('exact-texture-source-shared-once-with-96MiB-mipmap-bound-and-idempotent-model-leases');
 {
  const cache=createExhibitTextureCache(),gate=deferred(),t=texture(),a=cache.lease('./qinghuaci.glb'),b=cache.lease('./qinghuaci.glb'),p=parser(()=>gate.promise),q=parser(()=>{throw Error('Second in-flight producer');});
  const first=a.plugin(p).loadTexture(0),second=b.plugin(q).loadTexture(0),firstRejected=assert.rejects(first,{name:'AbortError'});a.release();await tick();gate.resolve(t.map);await firstRejected;assert.equal(await second,t.map);assert.equal(p.loads,1);assert.equal(q.loads,0);b.release();cache.clearIdle();assert.equal(t.image.closed,1);
 }
 check('concurrent-parsers-share-one-producer-and-one-cancelled-lease-does-not-break-the-other');
 for(const action of ['release','clear-idle','dispose']){
  const cache=createExhibitTextureCache(),gate=deferred(),t=texture(),l=cache.lease('./qinghuaci.glb'),promise=l.plugin(parser(()=>gate.promise)).loadTexture(0),rejected=assert.rejects(promise,{name:'AbortError'});
  await tick();if(action==='dispose')cache.dispose();else{l.release();if(action==='clear-idle')cache.clearIdle();}gate.resolve(t.map);await rejected;l.release();cache.dispose();assert.equal(t.disposals,1);assert.equal(t.image.closed,1);assert.equal(cache.stats.refs,0);
 }
 check('abort-timeout-style-release-and-exit-clean-late-textures-once');
 {
  const cache=createExhibitTextureCache(),l=cache.lease('./qinghuaci.glb'),p=parser(()=>Promise.reject(Error('Texture decode failed')));await assert.rejects(l.plugin(p).loadTexture(0),/decode failed/);l.release();assert.equal(cache.stats.retained,false);
  const next=cache.lease('./qinghuaci.glb'),t=texture();assert.equal(await next.plugin(parser(t.map)).loadTexture(0),t.map);next.release();cache.clearIdle();assert.equal(t.image.closed,1);
 }
 check('decode-failure-allows-clean-retry');
 {
  const cache=createExhibitTextureCache(),l=cache.lease('./qinghuaci.glb'),t=texture(2048,2048);assert.equal(await l.plugin(parser(t.map)).loadTexture(0),t.map);assert.equal(cache.stats.retained,false);l.release();assert.equal(t.image.closed,1);cache.dispose();
 }
 check('actual-dimensions-must-be-4096-square-or-no-retention');
 for(const state of ['idle','staging']){
  const cache=createExhibitTextureCache(),l=cache.lease('./qinghuaci.glb'),t=texture(),p=parser(t.map);await l.plugin(p).loadTexture(0);if(state==='idle')l.release();
  const before={...cache.stats},version=t.map.version,sourceVersion=t.map.source.version;let retired=0;
  const oldRendererListener=()=>{retired++;t.map.removeEventListener('dispose',oldRendererListener);};t.map.addEventListener('dispose',oldRendererListener);
  const index=fs.readFileSync(path.join(root,'index.html'),'utf8'),start=index.indexOf("renderer.domElement.addEventListener('webglcontextlost',()=>{"),end=index.indexOf("renderer.domElement.addEventListener('webglcontextrestored'",start);
  let loss;const scene={};vm.runInNewContext(index.slice(start,end),{renderer:{domElement:{addEventListener(type,fn){assert.equal(type,'webglcontextlost');loss=fn;}}},exhibitTextures:cache,scene,desktopMistScene:{},desktopMistTarget:null,mistDepthMaterial:null,releaseSceneGPU(root){if(state==='staging'&&root===scene)t.map.dispose();}});
  loss();loss();assert.equal(retired,1,'The old renderer disposal listener must retire once even if the scene also disposes this texture');
  assert.deepEqual(cache.stats,before);assert.equal(t.image.closed,0);assert.equal(t.map.version,version);assert.equal(t.map.source.version,sourceVersion);
  const next=state==='idle'?cache.lease('./qinghuaci.glb'):l,q=parser(()=>{throw Error('Restoration must reuse CPU image');});assert.equal(await next.plugin(q).loadTexture(0),t.map);assert.equal(q.loads,0);
  let restoredRetired=0;const restoredListener=()=>{restoredRetired++;t.map.removeEventListener('dispose',restoredListener);};t.map.addEventListener('dispose',restoredListener);cache.releaseGPU();cache.releaseGPU();assert.equal(restoredRetired,1);assert.equal(t.image.closed,0);assert.equal(t.map.version,version);assert.equal(t.map.source.version,sourceVersion);
  next.release();cache.clearIdle();assert.equal(t.image.closed,1);cache.dispose();
 }
 check('native-loss-retires-idle-and-staging-GPU-listeners-without-closing-CPU-source-or-changing-leases-versions');
 // Load the real GLTF parser with only its normal image-loader adapter replaced.
 const moduleURL=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
 const threeURL=pathToFileURL(path.join(root,'vendor/three.module.js')).href;
 const utils=moduleURL(fs.readFileSync(path.join(root,'vendor/utils/BufferGeometryUtils.js'),'utf8').replaceAll("from 'three'",`from '${threeURL}'`));
 const loaderCode=fs.readFileSync(path.join(root,'vendor/loaders/GLTFLoader.js'),'utf8').replaceAll("from 'three'",`from '${threeURL}'`).replace("from '../utils/BufferGeometryUtils.js'",`from '${utils}'`);
 const {GLTFLoader}=await import(moduleURL(loaderCode));
 const previousSelf=globalThis.self;globalThis.self=globalThis;
 try{
  const cache=createExhibitTextureCache(),created=[];
  function session(){const lease=cache.lease('./qinghuaci.glb'),loader=new GLTFLoader();loader.register(p=>{p.textureLoader={load(_url,onLoad){const t=texture();created.push(t);queueMicrotask(()=>onLoad(t.map));return t.map;}};return lease.plugin(p);});return {lease,loader};}
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),begin=html.indexOf('const interiorPreparations = new WeakMap();'),end=html.indexOf('const exhibitKeys =',begin);
  const context={THREE,prepareMuseumFog(){},addInterior,exhibitTextures:cache,console,renderer:{capabilities:{getMaxAnisotropy:()=>8}},podium:new THREE.Mesh(new THREE.CylinderGeometry(1,1,1),new THREE.MeshStandardMaterial())};vm.createContext(context);vm.runInContext(html.slice(begin,end),context);
  const a=session(),first=await a.loader.parseAsync(bytes(),'https://museum.local/');a.lease.bind(first.scene);context.prepareExhibit(first.scene);const firstMap=first.scene.children[0].material.map,version=firstMap.version,sourceVersion=firstMap.source.version;
  assert.equal(firstMap.image.width,4096);assert.equal(firstMap.anisotropy,8);assert.equal(created.length,2);assert.equal(first.scene.userData.museumInterior.key,'original');assert(first.scene.getObjectByName('museum-display-interior-original'));
  context.disposeExhibit(first.scene);assert.equal(cache.stats.refs,0);assert.equal(created.find(t=>t.map===firstMap).image.closed,0);
  const b=session(),second=await b.loader.parseAsync(bytes(),'https://museum.local/');b.lease.bind(second.scene);context.prepareExhibit(second.scene);const secondMap=second.scene.children[0].material.map;
  assert.equal(created.length,3,'Only the MR map decodes on a second original parse');assert.equal(secondMap,firstMap);assert.equal(secondMap.version,version);assert.equal(secondMap.source.version,sourceVersion,'Repeated normalization must not mark the retained Source for upload');assert.notEqual(first.scene.children[0].geometry,second.scene.children[0].geometry);
  check('real-GLTF-plugin-reuses-only-base-color-with-fresh-model-and-unchanged-texture-source-version');
  const shared=secondMap.clone();let sharedDisposals=0;shared.addEventListener('dispose',()=>sharedDisposals++);second.scene.add(new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial({map:shared})));
  context.disposeExhibit(second.scene);context.disposeExhibit(second.scene);assert.equal(sharedDisposals,1);assert.equal(created.find(t=>t.map===firstMap).image.closed,0,'A nonretained Texture alias must not close the retained bitmap');cache.clearIdle();assert.equal(created.find(t=>t.map===firstMap).image.closed,1);assert.equal(cache.stats.retained,false);
  check('actual-model-cleanup-disposes-alias-GPU-texture-without-closing-retained-shared-image');
  const c=session(),third=await c.loader.parseAsync(bytes(),'https://museum.local/');c.lease.bind(third.scene);context.prepareExhibit(third.scene);const map=third.scene.children[0].material.map,img=map.image;
  map.dispose();assert.equal(img.closed,0,'Context-loss GPU retirement must retain CPU image data');cache.clearIdle();assert.equal(img.closed,0,'Current model must survive hidden/BFCache idle cleanup');
  const pagehide=html.slice(html.indexOf("window.addEventListener('pagehide',event=>{"),html.indexOf('const checkExhibitAbort='));let handler,bytesDisposed=0;
  vm.runInNewContext(pagehide,{window:{addEventListener(type,fn){assert.equal(type,'pagehide');handler=fn;}},exhibitTextures:cache,initialExhibitLease:{release(){}},exhibitCache:{dispose(){bytesDisposed++;}}});
  handler({persisted:true});assert.equal(img.closed,0);assert.equal(bytesDisposed,0);handler({persisted:false});handler({persisted:false});assert.equal(img.closed,1);assert.equal(cache.stats.disposed,true);context.disposeExhibit(third.scene);assert.equal(img.closed,1);
  check('context-loss-keeps-CPU-source-BFCache-keeps-current-lease-and-final-exit-disposes-once');
 }finally{if(previousSelf===undefined)delete globalThis.self;else globalThis.self=previousSelf;}
 console.log(JSON.stringify({status:'passed',checks:checks.length,contracts:checks}));
})().catch(error=>{console.error(error);process.exitCode=1;});
