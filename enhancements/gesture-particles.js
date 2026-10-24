// Area-weighted surface samples retain the original UV colors; added display interiors are excluded.
export function sampleExhibit(THREE,model,count){
 if(!model)throw new Error('No exhibit is ready');
 model.updateWorldMatrix(true,true);
 const box=new THREE.Box3(),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),cross=new THREE.Vector3(),entries=[];
 let area=0;
 model.traverse(mesh=>{
  if(!mesh.isMesh||mesh.name.startsWith('museum-display-interior-'))return;
  const geometry=mesh.geometry,position=geometry.attributes.position,index=geometry.index;if(!position)return;
  const length=index?index.count:position.count,groups=geometry.groups.length?geometry.groups:[{start:0,count:length,materialIndex:0}];
  for(const group of groups){
   const start=Math.max(group.start,geometry.drawRange.start),end=Math.min(group.start+group.count,length,geometry.drawRange.start+geometry.drawRange.count);
   const triangles=Math.floor((end-start)/3);if(triangles<1)continue;
   const cumulative=new Float64Array(triangles);let total=0;
   for(let t=0;t<triangles;t++){
    const k=start+t*3;
    a.fromBufferAttribute(position,index?index.getX(k):k).applyMatrix4(mesh.matrixWorld);
    b.fromBufferAttribute(position,index?index.getX(k+1):k+1).applyMatrix4(mesh.matrixWorld);
    c.fromBufferAttribute(position,index?index.getX(k+2):k+2).applyMatrix4(mesh.matrixWorld);
    box.expandByPoint(a);box.expandByPoint(b);box.expandByPoint(c);
    total+=cross.subVectors(b,a).cross(c.sub(a)).length()*.5;cumulative[t]=total;
   }
   if(total>0){area+=total;entries.push({mesh,start,cumulative,total,end:area,normalMatrix:new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld),material:Array.isArray(mesh.material)?mesh.material[group.materialIndex]:mesh.material});}
  }
 });
 if(!area||box.isEmpty())throw new Error('The exhibit has no surface to sample');
 const center=box.getCenter(new THREE.Vector3()),scale=2/Math.max(.0001,box.max.y-box.min.y),uv=new THREE.Vector2(),color=new THREE.Color(),sampleColor=new THREE.Color();
 const positions=new Float32Array(count*3),colors=new Float32Array(count*3),normals=new Float32Array(count*3),textures=new Map();
 let seed=1927;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 function pixels(texture){
  if(textures.has(texture))return textures.get(texture);
  let result=null;try{
   const image=texture.image,width=image?.width||image?.videoWidth,height=image?.height||image?.videoHeight;
   if(width&&height){
    const canvas=document.createElement('canvas'),ratio=Math.min(1,512/Math.max(width,height));canvas.width=Math.max(1,Math.round(width*ratio));canvas.height=Math.max(1,Math.round(height*ratio));
    const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(image,0,0,canvas.width,canvas.height);
    result={data:context.getImageData(0,0,canvas.width,canvas.height).data,width:canvas.width,height:canvas.height};
   }
  }catch(error){console.warn('Hologram texture sampling: using material color',error);}
  textures.set(texture,result);return result;
 }
 for(let i=0;i<count;i++){
  const value=random()*area,entry=entries.find(item=>value<item.end)||entries[entries.length-1];
  const local=value-(entry.end-entry.total),cdf=entry.cumulative;let lo=0,hi=cdf.length-1;
  while(lo<hi){const mid=(lo+hi)>>1;if(cdf[mid]<local)lo=mid+1;else hi=mid;}
  const geometry=entry.mesh.geometry,index=geometry.index,k=entry.start+lo*3,ids=[0,1,2].map(n=>index?index.getX(k+n):k+n);
  const r=Math.sqrt(random()),weights=[1-r,r*(1-random()),0];weights[2]=1-weights[0]-weights[1];
  a.set(0,0,0);uv.set(0,0);
  for(let n=0;n<3;n++){b.fromBufferAttribute(geometry.attributes.position,ids[n]).applyMatrix4(entry.mesh.matrixWorld);a.addScaledVector(b,weights[n]);if(geometry.attributes.uv){uv.x+=geometry.attributes.uv.getX(ids[n])*weights[n];uv.y+=geometry.attributes.uv.getY(ids[n])*weights[n];}}
  a.sub(center).multiplyScalar(scale).toArray(positions,i*3);color.copy(entry.material?.color||new THREE.Color(0xffffff));
  const map=entry.material?.map,tex=map&&geometry.attributes.uv?pixels(map):null;
  if(tex){if(map.matrixAutoUpdate)map.updateMatrix();map.transformUv(uv);const x=Math.min(tex.width-1,Math.max(0,Math.floor(uv.x*tex.width))),y=Math.min(tex.height-1,Math.max(0,Math.floor(uv.y*tex.height))),p=(y*tex.width+x)*4;
   sampleColor.setRGB(tex.data[p]/255,tex.data[p+1]/255,tex.data[p+2]/255,map.colorSpace===THREE.SRGBColorSpace?THREE.SRGBColorSpace:THREE.LinearSRGBColorSpace);color.multiply(sampleColor);
  }
  const vertex=entry.material?.vertexColors&&geometry.attributes.color;
  if(vertex){b.set(0,0,0);for(let n=0;n<3;n++)b.addScaledVector(c.fromBufferAttribute(vertex,ids[n]),weights[n]);color.r*=b.x;color.g*=b.y;color.b*=b.z;}
  color.toArray(colors,i*3);
  const normal=geometry.attributes.normal;
  if(normal){a.set(0,0,0);for(let n=0;n<3;n++)a.addScaledVector(b.fromBufferAttribute(normal,ids[n]),weights[n]);a.applyMatrix3(entry.normalMatrix).normalize();}
  else{a.fromBufferAttribute(geometry.attributes.position,ids[0]);b.fromBufferAttribute(geometry.attributes.position,ids[1]);c.fromBufferAttribute(geometry.attributes.position,ids[2]);a.copy(b.sub(a).cross(c.sub(a))).applyMatrix3(entry.normalMatrix).normalize();}
  a.toArray(normals,i*3);
 }
 return {positions,colors,normals,textureAvailable:textures.size>0&&[...textures.values()].every(Boolean)};
}

export function classifyHand(landmarks,width,height,previous=''){
 if(!Array.isArray(landmarks)||landmarks.length!==21||!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0||!landmarks.every(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)))return null;
 const aspect=width/Math.max(1,height),distance=(a,b)=>Math.hypot((a.x-b.x)*aspect,a.y-b.y),palm=distance(landmarks[0],landmarks[9]);
 if(!Number.isFinite(palm)||palm<.06)return null;
 const ratio=distance(landmarks[4],landmarks[8])/palm,fingers=[8,12,16,20].map(i=>distance(landmarks[i],landmarks[0])>distance(landmarks[i-2],landmarks[0])*1.12),extended=fingers.filter(Boolean).length;
 const gesture=fingers[0]&&extended===1?'one':fingers[0]&&fingers[1]&&extended===2?'two':extended<=1?'fist':extended>=3&&ratio<(previous==='pinch' ? .65 : .42)?'pinch':extended>=3?'open':'neutral',ids=[0,5,9,13,17];
 return {x:1-ids.reduce((sum,i)=>sum+landmarks[i].x,0)/5,y:ids.reduce((sum,i)=>sum+landmarks[i].y,0)/5,gesture,pinch:gesture==='pinch'?1-Math.max(0,Math.min(1,(ratio-.12)/.65)):0};
}

// Shares the museum's renderer and loop; inference starts only after the camera button is pressed.
export function createGestureParticles({THREE,scene,camera,renderer,isDesktop,getModel,onStatus=()=>{},onSwitch=()=>{},onSwitchBlocked=()=>{}}){
 const count=isDesktop()?12000:6000,group=new THREE.Group(),art=new THREE.Group(),geometry=new THREE.BufferGeometry(),cache=new WeakMap();
 group.name='museum-gesture-hologram';group.visible=false;group.add(art);scene.add(group);
 const seeds=new Float32Array(count);for(let i=0;i<count;i++)seeds[i]=(i*.61803398875)%1;
 geometry.setAttribute('seed',new THREE.BufferAttribute(seeds,1));
 const uniforms={time:{value:0},scan:{value:-1.15},spread:{value:0},swirl:{value:0},charge:{value:0},pointSize:{value:4},reduced:{value:0},layoutSeed:{value:1},previousSeed:{value:1},layoutMix:{value:1},fieldCenter:{value:new THREE.Vector2()},fieldSize:{value:new THREE.Vector2(1,1)},fieldParallax:{value:new THREE.Vector2()}};
 const common={transparent:true,depthWrite:false,depthTest:false,toneMapped:false,fog:false};
 const material=new THREE.ShaderMaterial({...common,blending:THREE.AdditiveBlending,uniforms,vertexColors:true,
  vertexShader:`attribute float seed;uniform float time,scan,spread,swirl,charge,pointSize,reduced,layoutSeed,previousSeed,layoutMix;uniform vec2 fieldCenter,fieldSize,fieldParallax;varying vec3 tint;varying float strength;
  float noise(float n){return fract(sin(n*127.1+seed*311.7)*43758.5453);}
  vec3 cloud(float patternSeed){float z=noise(patternSeed)*2.0-1.0,r=pow(noise(patternSeed+1.0),.3333333),a=noise(patternSeed+2.0)*6.2831853+time*.11*(1.0-reduced);vec3 ball=vec3(cos(a)*sqrt(max(0.0,1.0-z*z)),sin(a)*sqrt(max(0.0,1.0-z*z)),z)*r;float turn=time*.09*(1.0-reduced),c=cos(turn),s=sin(turn);ball.xz=mat2(c,-s,s,c)*ball.xz;float depth=-4.0+ball.z*2.4;vec2 xy=ball.xy*fieldSize*.40+fieldCenter*(-depth*.25)+fieldParallax*ball.z*fieldSize*.12;return vec3(xy,depth);}
  void main(){float phase=seed*6.2831853;vec3 p=position*(1.0-charge*.1);vec4 mv=modelViewMatrix*vec4(p,1.0);
  float u=fract(seed*3.0),a=u*15.08+floor(seed*3.0)*2.094+time*.65*(1.0-reduced),radius=.3+.65*sqrt(noise(9.0));float depth=-4.0+sin(a)*radius*.85;
  vec2 spiral=vec2(cos(a)*radius*fieldSize.x*.43,(u-.5)*fieldSize.y*.84)+fieldCenter;vec3 vortex=vec3(spiral*(-depth*.25),depth);
  float open=spread*(1.0-charge);mv.xyz=mix(mv.xyz,vortex,swirl*(1.0-charge));mv.xyz=mix(mv.xyz,mix(cloud(previousSeed),cloud(layoutSeed),smoothstep(0.0,1.0,layoutMix)),open);
  float reveal=1.0-smoothstep(scan-.08,scan+.05,position.y);float band=exp(-abs(position.y-scan)*22.0);float ink=clamp((color.b-color.r)*3.0+.15,0.0,1.0);tint=mix(vec3(.22,.48,1.0),vec3(.50,.82,1.0),ink);tint=mix(tint,vec3(.82,.94,1.0),band*.7+charge*.14);float depthScale=clamp(4.0/max(1.6,-mv.z),.55,2.2);tint=mix(tint,vec3(.72,.9,1.0),open*clamp(depthScale-1.0,0.0,1.0)*.45);float front=mix(.12,1.0,smoothstep(-.1,.65,normalize(normalMatrix*normal).z));strength=reveal*(mix(.38,.95,ink)+band*.8+charge*.35)*mix(front,1.0,max(open,swirl))*mix(1.0,depthScale,open*.65);gl_Position=projectionMatrix*mv;gl_PointSize=pointSize*(.72+seed*.45+band*.3)*(1.0-open*.26)*mix(1.0,depthScale,max(open,swirl));}`,
  fragmentShader:`varying vec3 tint;varying float strength;void main(){float r=length(gl_PointCoord-.5)*2.0;if(r>1.0)discard;float core=exp(-r*r*10.0),glow=exp(-r*r*4.8)*.25;gl_FragColor=vec4(tint,(core+glow)*strength);}`});
 const points=new THREE.Points(geometry,material);points.name='museum-gesture-vessel';points.frustumCulled=false;points.renderOrder=8;art.add(points);
 const backdropGeometry=new THREE.PlaneGeometry(2,2),backdropMaterial=new THREE.MeshBasicMaterial({...common,color:0x020812,opacity:.94});
 const backdrop=new THREE.Mesh(backdropGeometry,backdropMaterial);backdrop.position.z=-.3;backdrop.renderOrder=7;backdrop.frustumCulled=false;group.add(backdrop);
 const linePositions=[],lineTags=[];
 for(let strand=0;strand<4;strand++)for(let i=0;i<128;i++)for(const n of [i,i+1]){linePositions.push(n/128,strand,0);lineTags.push(strand);}
 const lineGeometry=new THREE.BufferGeometry();lineGeometry.setAttribute('position',new THREE.Float32BufferAttribute(linePositions,3));lineGeometry.setAttribute('kind',new THREE.Float32BufferAttribute(lineTags,1));
 const lineUniforms={time:uniforms.time,scan:uniforms.scan,charge:uniforms.charge,swirl:uniforms.swirl,fieldCenter:uniforms.fieldCenter,fieldSize:uniforms.fieldSize,release:{value:-1},reduced:uniforms.reduced};
 const lineMaterial=new THREE.ShaderMaterial({...common,blending:THREE.AdditiveBlending,uniforms:lineUniforms,
  vertexShader:`attribute float kind;uniform float time,scan,charge,release,reduced,swirl;uniform vec2 fieldCenter,fieldSize;varying float alpha;varying vec3 tint;void main(){float angle=position.x*6.2831853;vec3 p;alpha=.0;tint=vec3(.18,.48,1.0);
  if(kind<.5){float radius=.78;p=vec3(cos(angle)*radius,scan,sin(angle)*radius);alpha=(1.0-step(1.12,scan))*.65;tint=vec3(.6,.9,1.0);}
  else if(kind<2.5){float drift=time*.24*(1.0-reduced)*(1.0+charge*2.0);float a=angle+drift+kind*3.14;p=vec3(cos(a)*(.88+charge*.08),sin(angle*2.0+kind)*.32,sin(a)*.58);alpha=.16+charge*.24;}
  else{float age=clamp(release,0.0,1.0),r=.4+age*1.3;p=vec3(cos(angle)*r,sin(angle)*r*.25,0.18);alpha=release>=0.0?(1.0-age)*.7:0.0;tint=vec3(.5,.82,1.0);}vec4 mv=modelViewMatrix*vec4(p,1.0);if(kind>.5&&kind<2.5){float a=position.x*15.08+kind*2.094+time*.65*(1.0-reduced),depth=-4.0+sin(a)*.72;vec2 xy=vec2(cos(a)*fieldSize.x*.36,(position.x-.5)*fieldSize.y*.84)+fieldCenter;mv.xyz=mix(mv.xyz,vec3(xy*(-depth*.25),depth),swirl*(1.0-charge));}gl_Position=projectionMatrix*mv;}`,
  fragmentShader:`varying float alpha;varying vec3 tint;void main(){gl_FragColor=vec4(tint,alpha);}`});
 const lines=new THREE.LineSegments(lineGeometry,lineMaterial);lines.renderOrder=9;lines.frustumCulled=false;art.add(lines);
 const trailCount=64,trailPositions=new Float32Array(trailCount*3),trailAges=new Float32Array(trailCount);for(let i=0;i<trailCount;i++)trailAges[i]=i/trailCount;
 const trailGeometry=new THREE.BufferGeometry();trailGeometry.setAttribute('position',new THREE.BufferAttribute(trailPositions,3).setUsage(THREE.DynamicDrawUsage));trailGeometry.setAttribute('age',new THREE.BufferAttribute(trailAges,1));
 const trailUniforms={pointSize:uniforms.pointSize,visible:{value:0}};
 const trailMaterial=new THREE.ShaderMaterial({...common,blending:THREE.AdditiveBlending,uniforms:trailUniforms,
  vertexShader:`attribute float age;uniform float pointSize,visible;varying float opacity;void main(){opacity=(1.0-age)*visible;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);gl_PointSize=pointSize*(1.5-age*.8);}`,
  fragmentShader:`varying float opacity;void main(){float r=length(gl_PointCoord-.5)*2.0;if(r>1.0)discard;gl_FragColor=vec4(.35,.7,1.0,exp(-r*r*7.0)*opacity);}`});
 const trail=new THREE.Points(trailGeometry,trailMaterial);trail.frustumCulled=false;trail.renderOrder=10;art.add(trail);
 const target={x:.5,y:.5,pinch:0},current={...target},rotation={yaw:-.24,pitch:0};let rotationAnchor=null,framedScale=0,framedCenter=0,framedHeight=0;
 const reduced=typeof matchMedia==='function'?matchMedia('(prefers-reduced-motion:reduce)'):null;
 let enabled=false,disposed=false,time=0,state='',generation=0,stream=null,video=null,worker=null,pending=null,shownModel=null,previousVisible=true,charged=false,releaseAt=-10,textureAvailable=false;
 let loopTimer=0,initTimer=0,frameTimer=0,rejectInit=null,lastVideoTime=-1,action='orbit',handPose='',handCandidate='',handSince=0,oneStartX=null,oneStartY=0,oneStarted=0,switchAfter=0,switchArmed=true,oneConsumed=false,switching=false,layoutAt=-10,notifiedPose='';
 let missingSince=null,lastHand=null,blockedAfter=0,frameStartedAt=null,inFlight=false,lastCaptureAt=null,metrics;
 function resetDiagnostics(){metrics={startedAt:performance.now(),endedAt:null,frames:0,hands:0,misses:0,graceRecoveries:0,discontinuities:0,poseFlips:0,switches:0,blockedSwitches:0,actualVideoWidth:0,actualVideoHeight:0,inputWidth:0,inputHeight:0,firstResultAt:null,lastResultAt:null};lastCaptureAt=null;}
 function measure(name,value){if(!Number.isFinite(value)||value<0)return;metrics[name+'Count']=(metrics[name+'Count']||0)+1;metrics[name+'Total']=(metrics[name+'Total']||0)+value;metrics[name+'LastMs']=value;metrics[name+'MaxMs']=Math.max(metrics[name+'MaxMs']||0,value);metrics[name+'MinMs']=Math.min(metrics[name+'MinMs']??value,value);}
 function diagnostics(){
  const result={startedAt:metrics.startedAt,elapsedMs:Math.max(0,(metrics.endedAt??performance.now())-metrics.startedAt),state,cameraActive:!!stream};
  for(const key of ['frames','hands','misses','graceRecoveries','discontinuities','poseFlips','switches','blockedSwitches','actualVideoWidth','actualVideoHeight','inputWidth','inputHeight'])result[key]=metrics[key];
  for(const name of ['inference','roundTrip','capture','sampleInterval'])for(const suffix of ['LastMs','MaxMs','MinMs','MeanMs'])result[name+suffix]=suffix==='MeanMs'?(metrics[name+'Total']||0)/(metrics[name+'Count']||1):metrics[name+suffix]||0;
  result.detectedRatio=metrics.frames?metrics.hands/metrics.frames:0;result.resultHz=metrics.frames>1&&metrics.lastResultAt>metrics.firstResultAt?(metrics.frames-1)*1000/(metrics.lastResultAt-metrics.firstResultAt):0;return result;
 }
 resetDiagnostics();
 const status=next=>{if(state!==next||notifiedPose!==handPose){state=next;notifiedPose=handPose;onStatus({state:next,action,gesture:handPose});}return next;};
 function setPointer(x,y,pinch,rotate=false){
  if(!Number.isFinite(x)||!Number.isFinite(y))return;
  target.x=Math.max(0,Math.min(1,x));target.y=Math.max(0,Math.min(1,y));
  if(rotate&&rotationAnchor){rotation.yaw+=(target.x-rotationAnchor.x)*12;rotation.pitch=Math.max(-1.15,Math.min(1.15,rotation.pitch+(target.y-rotationAnchor.y)*4));}
  rotationAnchor=rotate?{x:target.x,y:target.y}:null;
  if(Number.isFinite(pinch))target.pinch=Math.max(0,Math.min(1,pinch));
 }
 function cancelCharge(){
  target.pinch=current.pinch=0;charged=false;releaseAt=-10;uniforms.charge.value=0;lineUniforms.release.value=-1;
 }
 function cancelInputs(){
  cancelCharge();handPose=handCandidate='';oneStartX=null;rotationAnchor=null;switchArmed=!oneConsumed;missingSince=null;lastHand=null;
 }
 function setSwitching(value){switching=!!value;if(switching){oneConsumed=true;switchArmed=false;}}
 function nextLayout(){uniforms.previousSeed.value=uniforms.layoutSeed.value;uniforms.layoutSeed.value=(uniforms.layoutSeed.value+1.618033989)%1024;layoutAt=time;}
 function setAction(next){
  if(disposed||!['orbit','vortex','scatter'].includes(next))return false;
  if(next==='scatter')nextLayout();if(next!==action){cancelInputs();action=next;onStatus({state,action,gesture:handPose});}return true;
 }
 function update(delta){
  if(!enabled||disposed)return;
  const dt=Number.isFinite(delta)?Math.max(0,Math.min(.05,delta)):0,ease=1-Math.exp(-8*dt),oldX=current.x,oldY=current.y;time+=dt;
  current.x+=(target.x-current.x)*ease;current.y+=(target.y-current.y)*ease;current.pinch+=(target.pinch-current.pinch)*ease;
  if(current.pinch>.6)charged=true;if(charged&&target.pinch<.15){charged=false;if(time-releaseAt>.5){releaseAt=time;nextLayout();}}
  const age=time-releaseAt,release=age<1.2?age/1.2:-1,unfold=age<3.4?Math.sin(Math.min(1,age/3.4)*Math.PI):0;
  uniforms.swirl.value+=((action==='vortex'?1:0)-uniforms.swirl.value)*ease;
  const spread=action==='scatter'?1:unfold*(reduced?.matches ? .3 : 1);uniforms.spread.value+=(spread-uniforms.spread.value)*ease;if(spread===0&&uniforms.spread.value<.001)uniforms.spread.value=0;
  uniforms.layoutMix.value=Math.max(0,Math.min(1,(time-layoutAt)/.65));
  uniforms.time.value=time;uniforms.reduced.value=reduced?.matches?1:0;uniforms.scan.value=reduced?.matches?1.2:Math.min(1.2,-1.15+time*1.05);uniforms.charge.value=current.pinch;
  geometry.setDrawRange(0,isDesktop()?count:Math.min(count,6000));uniforms.pointSize.value=(isDesktop()?4.3:3.7)*Math.min(2,renderer.getPixelRatio());lineUniforms.release.value=reduced?.matches?-1:release;
  const rect=renderer.domElement.getBoundingClientRect(),viewHeight=2*Math.tan(camera.fov*Math.PI/360)*4,viewWidth=viewHeight*rect.width/Math.max(1,rect.height);
  const dock=document.getElementById('museumGestureDock'),guide=document.getElementById('museumGestureGuide');
  const uiHidden=document.body.classList.contains('museum-gesture-ui-hidden');
  const freeTop=!uiHidden&&guide&&!guide.hidden?Math.max(0,guide.getBoundingClientRect().bottom-rect.top+12):0,freeBottom=!uiHidden&&dock&&!dock.hidden?Math.min(rect.height,dock.getBoundingClientRect().top-rect.top-16):rect.height,freeHeight=Math.max(0,freeBottom-freeTop);
  const fieldHeight=viewHeight*freeHeight/Math.max(1,rect.height),scale=Math.min(viewHeight*.24,viewWidth*.34,fieldHeight*.42);
  const center=viewHeight*.5-viewHeight*(freeTop+freeHeight*.5)/Math.max(1,rect.height);
  if(!uiHidden||!framedScale){framedScale=scale;framedCenter=center;framedHeight=fieldHeight;}
  const fieldEase=dt?1-Math.exp(-6*dt):1;
  uniforms.fieldCenter.value.y+=(center-uniforms.fieldCenter.value.y)*fieldEase;uniforms.fieldSize.value.x+=(viewWidth*.88-uniforms.fieldSize.value.x)*fieldEase;uniforms.fieldSize.value.y+=(fieldHeight*.9-uniforms.fieldSize.value.y)*fieldEase;
  uniforms.fieldParallax.value.set((current.x-.5)*2,(.5-current.y)*2);
  camera.updateMatrixWorld();group.position.set(0,0,-4).applyMatrix4(camera.matrixWorld);group.quaternion.copy(camera.quaternion);backdrop.scale.set(viewWidth*.55,viewHeight*.55,1);
  art.position.set((current.x-.5)*viewWidth*.08,framedCenter+(.5-current.y)*framedHeight*.03,0);art.scale.setScalar(Math.min(scale,framedScale));
  const inGrace=missingSince!==null&&performance.now()/1000-missingSince<.3;
  if(!rotationAnchor&&!inGrace&&!reduced?.matches)rotation.yaw+=dt*.09;
  art.rotation.x+=(rotation.pitch-art.rotation.x)*ease;art.rotation.y+=(rotation.yaw-art.rotation.y)*ease;
  const speed=Math.min(1,Math.hypot(current.x-oldX,current.y-oldY)*55);trailUniforms.visible.value+=(speed-trailUniforms.visible.value)*(1-Math.exp(-5*dt));
  trailPositions.copyWithin(3,0,trailPositions.length-3);trailPositions[0]=(current.x-.5)*2.4;trailPositions[1]=(.5-current.y)*2;trailPositions[2]=.5;trailGeometry.attributes.position.needsUpdate=true;trail.visible=!reduced?.matches;
 }
 function stopCamera(next='ready'){
  if(stream||pending||worker)metrics.endedAt=performance.now();
  cancelInputs();
  generation++;clearTimeout(loopTimer);clearTimeout(initTimer);clearTimeout(frameTimer);loopTimer=initTimer=frameTimer=0;
  const reject=rejectInit;rejectInit=null;reject?.(new DOMException('Camera stopped','AbortError'));
  if(worker){worker.onmessage=worker.onerror=null;worker.terminate();worker=null;}
  if(stream){for(const track of stream.getTracks()){track.onended=null;track.stop();}stream=null;}
  if(video){video.pause();video.srcObject=null;video.remove();video=null;}
  pending=null;lastVideoTime=-1;frameStartedAt=null;inFlight=false;lastCaptureAt=null;status(next);
 }
 function loadModel(){
  const model=getModel();if(model===shownModel)return;let sample=cache.get(model);if(!sample){sample=sampleExhibit(THREE,model,count);cache.set(model,sample);}
  // Sampling must succeed before we release the old exhibit or its GPU buffers.
  if(shownModel)shownModel.visible=previousVisible;
  if(geometry.attributes.position?.array!==sample.positions){if(geometry.attributes.position)geometry.dispose();geometry.setAttribute('position',new THREE.BufferAttribute(sample.positions,3));geometry.setAttribute('color',new THREE.BufferAttribute(sample.colors,3));geometry.setAttribute('normal',new THREE.BufferAttribute(sample.normals,3));}
  shownModel=model;previousVisible=model.visible;model.visible=false;textureAvailable=sample.textureAvailable;time=0;layoutAt=-10;if(stream||pending)oneConsumed=true;cancelInputs();target.x=current.x=.5;target.y=current.y=.5;rotation.yaw=-.24;rotation.pitch=0;art.rotation.set(0,-.24,0);
  trailPositions.fill(0);trailUniforms.visible.value=0;uniforms.scan.value=-1.15;uniforms.spread.value=uniforms.swirl.value=0;setAction('orbit');
 }
 function changeModel(){if(!enabled||disposed)return false;loadModel();update(0);return true;}
 function setEnabled(value){
  if(disposed)return;
  if(value&&!enabled)loadModel();
  enabled=!!value;group.visible=enabled;
  if(!enabled){if(shownModel){shownModel.visible=previousVisible;shownModel=null;}stopCamera();}else{update(0);if(!stream)status(textureAvailable?'ready':'shapeOnly');}
 }
 function handResult(landmarks,width,height){
  const hand=classifyHand(landmarks,width,height,handPose);
  const now=performance.now()/1000;
  metrics.frames++;metrics.lastResultAt=now*1000;metrics.firstResultAt??=now*1000;
  if(!hand){
   metrics.misses++;if(missingSince===null){missingSince=now;cancelCharge();rotationAnchor=null;}
   if(now-missingSince>=.3){const began=missingSince;oneConsumed=false;cancelInputs();missingSince=began;status('no-hand');}return;
  }
  metrics.hands++;
  const recovered=missingSince!==null;
  if(recovered){
   const gap=now-missingSince,continuous=gap<.3&&lastHand&&hand.gesture===lastHand.gesture&&Math.abs(hand.x-lastHand.x)<.06&&Math.abs(hand.y-lastHand.y)<.08&&(hand.gesture!=='one'||oneStartX===null||Math.abs(hand.x-oneStartX)<.10);
   rotationAnchor=null;
   if(continuous){metrics.graceRecoveries++;handSince+=gap;oneStarted+=gap;}
   else{if(gap>=.3)oneConsumed=false;else metrics.discontinuities++;cancelInputs();}
   missingSince=null;
  }
  if(lastHand&&hand.gesture!==lastHand.gesture)metrics.poseFlips++;
  if(hand.gesture!==handCandidate){handCandidate=hand.gesture;handSince=now;rotationAnchor=null;if(handCandidate==='one'){oneStartX=hand.x;oneStartY=hand.y;oneStarted=now;}}
  if(handCandidate!==handPose&&now-handSince>.12){
   handPose=handCandidate;
   if(handPose==='fist'||handPose==='two')setAction('orbit');else if(handPose==='open')setAction('scatter');
   handPose=handCandidate=hand.gesture;
   if(handPose!=='one'){oneStartX=null;oneConsumed=false;switchArmed=true;}
  }
  if(handPose==='one'&&hand.gesture==='one'&&!recovered){
   if(now-oneStarted>1.2){oneStartX=hand.x;oneStartY=hand.y;oneStarted=now;}
   const movement=hand.x-oneStartX,vertical=Math.abs(hand.y-oneStartY);
   if(Math.abs(movement)>.10&&Math.abs(movement)>vertical*1.4){
    if(switching){if(now>blockedAfter){blockedAfter=now+.8;metrics.blockedSwitches++;onSwitchBlocked();}}
    else if(switchArmed&&now>switchAfter){
     oneConsumed=true;switchArmed=false;switchAfter=now+.65;metrics.switches++;
     try{Promise.resolve(onSwitch(movement<0?1:-1)).catch(error=>console.warn('Gesture exhibit switch:',error));}catch(error){console.warn('Gesture exhibit switch:',error);}
    }
   }
  }
  // A stable two-finger pose rotates; index-only movement is reserved for a single armed exhibit swipe.
  if(hand.gesture==='two'&&handPose==='two')setPointer(hand.x,hand.y,0,true);
  else setPointer(hand.x,hand.y,hand.gesture==='pinch'&&handPose==='pinch'?hand.pinch:0);
  lastHand={x:hand.x,y:hand.y,gesture:hand.gesture};
  status('tracking');
 }
 function startCamera(){
  if(disposed||!enabled)return Promise.resolve('ready');if(pending)return pending;if(stream)return Promise.resolve(state);
  if(typeof Worker!=='function'||typeof createImageBitmap!=='function'||typeof OffscreenCanvas!=='function'||!navigator.mediaDevices?.getUserMedia)return Promise.resolve(status('unsupported'));
  oneConsumed=false;cancelInputs();resetDiagnostics();const token=++generation;status('loading');
  const task=(async()=>{
   try{
    const acquired=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:320},height:{ideal:240},frameRate:{ideal:15,max:15}},audio:false});
    if(token!==generation||disposed||!enabled){acquired.getTracks().forEach(track=>track.stop());return 'ready';}
    stream=acquired;video=document.createElement('video');video.muted=true;video.autoplay=true;video.playsInline=true;video.width=320;video.height=240;
    video.style.cssText='position:fixed;left:-9999px;top:0;width:1px;height:1px;pointer-events:none';video.setAttribute('aria-hidden','true');video.srcObject=stream;document.body.append(video);
    stream.getTracks().forEach(track=>{track.onended=()=>{if(token===generation)stopCamera('ended');};});
    const currentVideo=video;
    await new Promise((resolve,reject)=>{rejectInit=reject;initTimer=setTimeout(()=>reject(new Error('Camera playback timed out')),30000);currentVideo.play().then(resolve,reject);});
    clearTimeout(initTimer);initTimer=0;rejectInit=null;if(token!==generation)return state;
    const activeWorker=new Worker(new URL('./gesture-tracker-worker.js',import.meta.url));worker=activeWorker;
    await new Promise((resolve,reject)=>{
     rejectInit=reject;initTimer=setTimeout(()=>reject(new Error('Hand tracker initialization timed out')),30000);
     activeWorker.onerror=()=>{if(token!==generation)return;reject(new Error('Hand tracker worker failed'));stopCamera('error');};
     activeWorker.onmessage=event=>{
      if(token!==generation)return;const data=event.data;
      if(data.type==='ready'){clearTimeout(initTimer);initTimer=0;rejectInit=null;resolve();}
      else if(data.type==='result'){
       clearTimeout(frameTimer);frameTimer=0;inFlight=false;
       const started=frameStartedAt;frameStartedAt=null;
       try{
        if(started!==null)measure('roundTrip',performance.now()-started);measure('inference',data.inferMs);
        metrics.inputWidth=Number.isFinite(data.width)&&data.width>0?data.width:0;metrics.inputHeight=Number.isFinite(data.height)&&data.height>0?data.height:0;
        handResult(data.landmarks,data.width,data.height);
       }catch(error){console.warn('Hand tracking result:',error);stopCamera('error');}
       if(token===generation&&stream&&worker)schedule(Math.max(0,84-(performance.now()-(started??performance.now()))));
      }
      else if(data.type==='error'||data.type==='unsupported'){reject(new Error('Hand tracker inference failed'));stopCamera(data.type==='unsupported'?'unsupported':'error');}
     };
     activeWorker.postMessage({type:'init'});
    });
    if(token!==generation)return state;status('camera');pump();return 'camera';
    function schedule(delay){clearTimeout(loopTimer);loopTimer=setTimeout(()=>{loopTimer=0;pump();},delay);}
    async function pump(){
     if(token!==generation||!stream||!worker||inFlight)return;
     if(currentVideo.readyState<2||currentVideo.currentTime===lastVideoTime){schedule(16);return;}
     lastVideoTime=currentVideo.currentTime;inFlight=true;frameStartedAt=performance.now();if(lastCaptureAt!==null)measure('sampleInterval',frameStartedAt-lastCaptureAt);lastCaptureAt=frameStartedAt;let bitmap=null;
     try{
      const width=currentVideo.videoWidth||320,height=currentVideo.videoHeight||240,scale=Math.min(1,256/Math.max(width,height));
      metrics.actualVideoWidth=width;metrics.actualVideoHeight=height;
      bitmap=await createImageBitmap(currentVideo,{resizeWidth:Math.round(width*scale),resizeHeight:Math.round(height*scale)});
      if(token!==generation){bitmap.close();return;}
      measure('capture',performance.now()-frameStartedAt);
      frameTimer=setTimeout(()=>{if(token===generation)stopCamera('error');},5000);
      activeWorker.postMessage({type:'frame',image:bitmap,timestamp:performance.now()},[bitmap]);bitmap=null;
     }catch(error){bitmap?.close();if(token===generation)stopCamera('error');}
    }
   }catch(error){if(token!==generation)return state;const next=error.name==='NotAllowedError'?'denied':error.name==='NotFoundError'?'unsupported':'error';stopCamera(next);return next;}
  })();
  pending=task;task.finally(()=>{if(pending===task)pending=null;});return task;
 }
 const onVisibility=()=>{if(document.hidden&&(stream||pending))stopCamera('paused');};document.addEventListener('visibilitychange',onVisibility);
 function dispose(){if(disposed)return;setEnabled(false);disposed=true;document.removeEventListener('visibilitychange',onVisibility);scene.remove(group);for(const item of [geometry,material,backdropGeometry,backdropMaterial,lineGeometry,lineMaterial,trailGeometry,trailMaterial])item.dispose();}
 status('ready');
 return {setEnabled,update,setPointer,setAction,changeModel,cancelInputs,setSwitching,startCamera,stopCamera,dispose,resetDiagnostics,get diagnostics(){return diagnostics();},get action(){return action;},get textureAvailable(){return textureAvailable;},get video(){return video;},get cameraActive(){return !!stream;}};
}
