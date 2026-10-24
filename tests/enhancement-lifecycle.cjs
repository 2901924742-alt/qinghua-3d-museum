const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const experience=fs.readFileSync(path.join(root,'enhancements/experience.js'),'utf8').replace(/^import .*;\r?\n/gm,'').replace('export function createExperience','function createExperience');
const guard=html.slice(html.indexOf('function disableExperience('),html.indexOf('function safeExperience('));
(async()=>{
 const THREE=await import(pathToFileURL(path.join(root,'vendor/three.module.js')).href);
 for(const cleanupThrows of [false,true]){
  const failure=Error('Injected gesture construction failure');let disposed=0,aborted=0,warnings=0;
  const controls={enabled:true};
  class Lifecycle extends AbortController {abort(){aborted++;super.abort();}}
  const context={THREE,controls,AbortController:Lifecycle,console:{warn(){warnings++;}},matchMedia:()=>({matches:false}),
   createUI:()=>({dispose(){disposed++;if(cleanupThrows)throw Error('Injected UI cleanup failure');}}),
   createGestureExperience:()=>{controls.enabled=false;throw failure;},museumExperience:null};
  context.window=context;vm.createContext(context);vm.runInContext(experience+'\n'+guard,context);
  assert.throws(()=>context.createExperience({THREE,controls}),error=>error===failure);
  assert.equal(disposed,1,'UI disposal must be registered before constructing later enhancements');assert.equal(aborted,1);
  context.disableExperience(failure);assert.equal(controls.enabled,true,'An enhancement construction failure must leave the original controls usable');
  assert.equal(warnings,cleanupThrows?2:1);
 }
 // Dimension validation remains real even if display reconstruction throws synchronously.
 const begin=html.indexOf('const interiorPreparations = new WeakMap();'),end=html.indexOf('function disposeExhibit(',begin);
 const context={THREE,console:{warn(){}},renderer:{capabilities:{getMaxAnisotropy:()=>8}},podium:new THREE.Mesh(new THREE.CylinderGeometry(1,1,1),new THREE.MeshStandardMaterial()),addInterior(){throw Error('Injected interior geometry failure');}};
 vm.createContext(context);vm.runInContext(html.slice(begin,end),context);
 assert.throws(()=>context.prepareExhibit(new THREE.Group()),/Invalid exhibit dimensions/);
 const model=new THREE.Group();model.add(new THREE.Mesh(new THREE.BoxGeometry(1,2,1),new THREE.MeshStandardMaterial()));
 assert.equal(context.prepareExhibit(model),model);assert(model.scale.x>0&&Number.isFinite(model.position.y));
 console.log('Enhancement lifecycle: early UI cleanup, cleanup faults, original controls recovery and real dimension validation pass');
})().catch(error=>{console.error(error);process.exitCode=1;});
