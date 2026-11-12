'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
(async()=>{
 const THREE=await import(pathToFileURL(path.join(root,'vendor/three.module.js')).href);
 const start=html.indexOf('const museumBackgroundFog ='),end=html.indexOf('/* =================',start);assert(start>0&&end>start);
 const context={THREE};vm.createContext(context);vm.runInContext(html.slice(start,end)+';globalThis.fog= museumBackgroundFog;',context);
 for(const [name,Material] of [['standard',THREE.MeshStandardMaterial],['physical',THREE.MeshPhysicalMaterial],['basic',THREE.MeshBasicMaterial]]){
  const material=new Material(),vertex=THREE.ShaderLib[name].vertexShader,fragment=THREE.ShaderLib[name].fragmentShader;
  let oldHook=0;material.onBeforeCompile=shader=>{oldHook++;shader.uniforms.previousHook={value:7};};material.customProgramCacheKey=()=>name;
  context.prepareMuseumFog(material);const callback=material.onBeforeCompile,key=material.customProgramCacheKey();context.prepareMuseumFog(material);
  assert.equal(material.onBeforeCompile,callback,'Repeated normalization must not stack hooks');assert.equal(material.customProgramCacheKey(),key);assert(key.startsWith(name+'|'));
  const shader={uniforms:{},vertexShader:vertex,fragmentShader:fragment};material.onBeforeCompile(shader,{});
  assert.equal(oldHook,1);assert.equal(shader.uniforms.previousHook.value,7);assert.equal(shader.uniforms.museumBackgroundFog,context.fog);assert.equal(shader.vertexShader,vertex);
  assert(shader.fragmentShader.includes('if (coverage <= 0.0) discard;'));assert(shader.fragmentShader.includes('if (!museumBackgroundFog)'));
  assert(shader.fragmentShader.indexOf('if (coverage <= 0.0) discard;')<shader.fragmentShader.indexOf('#include <lights_fragment_begin>')||name==='basic','Far fragments leave before PBR lighting');
  assert.equal(material.transparent,false);assert.equal(material.depthWrite,true);assert.equal(material.depthTest,true);assert.equal(material.opacity,1);assert.equal(material.fog,true);
 }
 assert(html.includes('prepareMuseumFog(podium.material);'),'The pedestal needs the same distance coverage');
 const from=html.indexOf('const interiorPreparations ='),to=html.indexOf('function disposeExhibit(',from);
 Object.assign(context,{console,renderer:{capabilities:{getMaxAnisotropy:()=>8}},addInterior:()=>({ready:Promise.resolve()}),podium:new THREE.Mesh(new THREE.CylinderGeometry(1,1,1),new THREE.MeshStandardMaterial())});
 vm.runInContext(html.slice(from,to),context);
 const model=new THREE.Group(),outside=new THREE.MeshStandardMaterial(),inside=new THREE.MeshStandardMaterial();
 model.add(new THREE.Mesh(new THREE.BoxGeometry(1,2,1),outside),new THREE.Mesh(new THREE.BoxGeometry(.5,1,.5),inside));context.prepareExhibit(model);
 for(const material of [outside,inside]){const shader={uniforms:{},fragmentShader:THREE.ShaderLib.standard.fragmentShader};material.onBeforeCompile(shader,{});assert.equal(shader.uniforms.museumBackgroundFog,context.fog);}
 const composite=html.slice(html.indexOf('function renderMuseum()'),html.indexOf('\nconst sortedMistClouds'));
 for(const ready of [false,true])for(const fail of [false,true]){
  let draws=0;Object.assign(context,{scene:{background:{old:true}},camera:{},useInstancedMist:false,renderer:{autoClear:true,getContext:()=>({isContextLost:()=>false}),render(){draws++;assert.equal(context.fog.value,ready);if(fail)throw Error('foreground');}},safeExperience:fn=>fn({renderBackground(){assert.equal(context.fog.value,false);return ready;}})});
  vm.runInContext(composite,context);if(fail)assert.throws(()=>context.renderMuseum(),/foreground/);else assert.equal(context.renderMuseum(),true);
  assert.equal(draws,1);assert.equal(context.fog.value,false,'The next studio/legacy draw must not inherit world-fog state');assert.equal(context.renderer.autoClear,true);assert.equal(context.scene.background.old,true);
 }
 console.log(JSON.stringify({status:'passed',checks:10,contracts:['real standard/physical/basic shader integration','opaque queue and original vertex/depth/opacity preserved','prior callback and program key preserved','idempotence','pedestal and both vessel surfaces','world-only uniform restored on success and failure'],limits:'GPU near/far coverage and Bayer samples are verified separately in native browser pixel QA.'}));
})().catch(error=>{console.error(error);process.exitCode=1;});
