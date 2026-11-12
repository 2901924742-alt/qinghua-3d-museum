const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
(async()=>{
 const root=path.resolve(__dirname,'..'),THREE=await import(pathToFileURL(path.join(root,'vendor/three.module.js')).href),{createViewTravel}=await import(pathToFileURL(path.join(root,'enhancements/view-travel.js')).href);
 const camera=new THREE.PerspectiveCamera(45,1.6,.1,1000);camera.position.set(0,.8,5);const controls={target:new THREE.Vector3(0,.1,0)};
 const api=createViewTravel({THREE,camera,controls}),end=new THREE.Vector3(-4,4,-18),target=new THREE.Vector3(-7.5,3.2,-26),before=camera.position.clone();
 const moving=api.start(end,target,{fov:50});assert.deepEqual(camera.position.toArray(),before.toArray());
 api.update(.1);assert(camera.position.distanceTo(controls.target)>before.distanceTo(new THREE.Vector3(0,.1,0)),'Pull out before approaching');
 let previous=camera.position.clone();for(let i=0;i<180;i++){api.update(1/60);assert(camera.position.toArray().every(Number.isFinite));assert(camera.position.distanceTo(previous)<1.1,'No discontinuous camera teleport');previous.copy(camera.position);}
 assert.equal(await moving,true);assert.deepEqual(camera.position.toArray(),end.toArray());assert.deepEqual(controls.target.toArray(),target.toArray());assert.equal(camera.fov,50);assert.equal(api.active,false);
 const interrupted=api.start(before,new THREE.Vector3());api.update(.1);const partial=camera.position.clone();api.cancel();assert.equal(await interrupted,false);api.update(.1);assert.deepEqual(camera.position.toArray(),partial.toArray(),'Cancellation retains the actual current view');
 const old=api.start(end,target),newest=api.start(before,new THREE.Vector3(),{fov:45});assert.equal(await old,false);for(let i=0;i<200;i++)api.update(1/60);assert.equal(await newest,true);assert.equal(camera.fov,45);
 assert.throws(()=>api.start(new THREE.Vector3(NaN,0,0),target),RangeError);assert.throws(()=>api.start(end,target,{duration:0}),RangeError);api.start(end,target);assert.throws(()=>api.update(-1),RangeError);api.cancel();
 console.log('World travel: real camera/projection, pull-back, continuous path, exact endpoint, cancellation, replacement and input validation pass');
})().catch(e=>{console.error(e);process.exitCode=1});
