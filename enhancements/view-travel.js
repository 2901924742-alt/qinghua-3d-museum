// The host keeps the only museum camera and decides when controls can resume.
export function createViewTravel({THREE,camera,controls}) {
 let motion=null;
 function cancel(){const old=motion;motion=null;old?.finish(false);}
 function start(position,target,{fov=camera.fov,duration=2.6}={}){
  if(![...position.toArray(),...target.toArray(),fov,duration].every(Number.isFinite)||duration<=0||fov<=0||fov>=180)throw new RangeError('Invalid museum travel');
  cancel();const from=camera.position.clone(),fromTarget=controls.target.clone(),pull=from.clone().sub(fromTarget);
  if(pull.lengthSq()<1e-8)pull.set(0,0,1);pull.setLength(Math.min(6,Math.max(2,pull.length())));
  let finish;const promise=new Promise(resolve=>{finish=resolve;});
  motion={from,fromTarget,pull,position:position.clone(),target:target.clone(),fov,fromFov:camera.fov,elapsed:0,duration,finish};return promise;
 }
 function update(delta){
  if(!motion)return;if(!Number.isFinite(delta)||delta<0)throw new RangeError('Invalid museum travel time');
  const m=motion;m.elapsed=Math.min(m.duration,m.elapsed+Math.min(delta,.1));const p=m.elapsed/m.duration;
  if(p<.22){const u=p/.22,e=u*u*(3-2*u);camera.position.copy(m.from).addScaledVector(m.pull,e);controls.target.copy(m.fromTarget);}
  else{const u=(p-.22)/.78,e=u*u*(3-2*u);camera.position.lerpVectors(m.from.clone().add(m.pull),m.position,e);camera.position.y+=Math.sin(Math.PI*e)*5;controls.target.lerpVectors(m.fromTarget,m.target,e);}
  camera.lookAt(controls.target);
  const e=p*p*(3-2*p);camera.fov=THREE.MathUtils.lerp(m.fromFov,m.fov,e);camera.updateProjectionMatrix();
  if(p>=1){motion=null;camera.position.copy(m.position);controls.target.copy(m.target);m.finish(true);}
 }
 return {start,update,cancel,get active(){return !!motion;}};
}
