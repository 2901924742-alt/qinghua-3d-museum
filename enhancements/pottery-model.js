import {Clay,NS,STAGE} from '../vendor/celadon/src/sim/clay.js';
import {Hand,radiiAt} from '../vendor/celadon/src/sim/hand.js';
import {clamp} from '../vendor/celadon/src/core/util.js';

// Celadon CPU shaping, MIT, be034263; unchanged originals and license are in vendor/celadon.
const fields=['ri','ro','V','m','ox','oz','ring','scar','comp','stress'];
const limits={ri:[0,16],ro:[.12,16],V:[1e-7,200],m:[0,1],ox:[-4,4],oz:[-4,4],ring:[0,.2],scar:[0,1],comp:[0,1],stress:[0,10]};
const presets={
 vase:{height:25,diameter:16,wall:.5,floor:1,profile:t=>.4+.58*Math.pow(Math.sin(Math.PI*t),.8)-.23*Math.exp(-(((t-.87)/.13)**2))},
 jar:{height:17,diameter:19,wall:.55,floor:1,profile:t=>.76+.24*Math.sin(Math.PI*t)},
 bowl:{height:10,diameter:21,wall:.6,floor:1.2,profile:t=>.36+.64*Math.sin(t*Math.PI/2)}
};
const maximumBytes=128*1024;
const ownKeys=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));

export function createPotteryModel({THREE,mobile=false,preset='vase'}){
 if(typeof preset!=='string'||!Object.hasOwn(presets,preset))throw new RangeError('Unknown pottery preset');
 const clay=new Clay({mass:900,seed:1927,wobble:0}),hand=new Hand(),past=[],future=[];
 const statsKeys=[...Object.keys(clay.stats),'compressed'],booleanStats=new Set(['opened','centered']);
 let currentPreset=preset,rngState=1927,stroke=null,disposed=false;
 clay.stats.compressed=0;
 // Track the original Mulberry32 state so a restored wet/dry stroke remains deterministic.
 clay.rng=()=>{rngState=(rngState+0x6d2b79f5)>>>0;let t=Math.imul(rngState^(rngState>>>15),1|rngState);t=(t+Math.imul(t^(t>>>7),61|t))^t;return ((t^(t>>>14))>>>0)/4294967296;};
 const sections=mobile?48:64,segments=mobile?48:64,rimSteps=9,rows=sections*2+rimSteps+4,stride=segments+1;
 const radial=new Float64Array(rows),vertical=new Float64Array(rows),offsetX=new Float64Array(rows),offsetZ=new Float64Array(rows);
 const geometry=new THREE.BufferGeometry();geometry.name='museum-pottery-blank';
 const positions=new Float32Array(rows*stride*3),normals=new Float32Array(positions.length),uv=new Float32Array(rows*stride*2),indices=[];
 for(let row=0;row<rows;row++)for(let column=0;column<=segments;column++){
  const vertex=row*stride+column;uv[vertex*2]=column/segments;uv[vertex*2+1]=row/(rows-1);
  if(row+1<rows&&column<segments){const a=vertex,b=vertex+stride;indices.push(a,b,b+1,a,b+1,a+1);}
 }
 geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));
 geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3).setUsage(THREE.DynamicDrawUsage));
 geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2).setUsage(THREE.DynamicDrawUsage));geometry.setIndex(indices);
 const station=index=>Math.round(index/(sections-1)*(NS-1));

 function capture(target={arrays:Object.fromEntries(fields.map(field=>[field,new Float32Array(NS)])),stats:{}}){
  for(const field of fields)target.arrays[field].set(clay[field]);
  for(const key of statsKeys)target.stats[key]=clay.stats[key]??0;
  target.preset=currentPreset;target.random=rngState;return target;
 }
 const rollback=capture();
 function apply(state){
  for(const field of fields)clay[field].set(state.arrays[field]);
  for(const key of statsKeys)clay.stats[key]=state.stats[key];
  currentPreset=state.preset;rngState=state.random;clay.dead=false;clay.deadReason='';clay.stage=STAGE.THROW;clay.shrink=1;clay.derive();
 }
 function valid(arrays){
  for(const field of fields){const data=arrays[field],[low,high]=limits[field];if(!data||data.length!==NS)return false;for(const value of data)if(!Number.isFinite(value)||value<low||value>high)return false;}
  let height=0,maxR=0,opened=false;
  for(let i=0;i<NS;i++){
   const inner=arrays.ri[i],outer=arrays.ro[i];if(outer-inner<.055||i<3&&inner!==0)return false;
   if(inner>.012)opened=true;else if(opened)return false;
   const dy=arrays.V[i]/(Math.PI*(outer*outer-inner*inner));if(dy<.000499||dy>4)return false;
   height+=dy;maxR=Math.max(maxR,outer);
  }
  return height>=3&&height<=50&&maxR>=.5&&arrays.ri[NS-1]>=.12;
 }
 function same(state){
  if(state.preset!==currentPreset||state.random!==rngState)return false;
  for(const field of fields)for(let i=0;i<NS;i++)if(state.arrays[field][i]!==clay[field][i])return false;
  for(const key of statsKeys)if(state.stats[key]!==clay.stats[key])return false;
  return true;
 }
 function remember(state){past.push(state);future.length=0;if(past.length>12)past.shift();}
 function makePreset(name){
  const item=presets[name];currentPreset=name;rngState=1927;clay.sculpt(item.profile,item.height,item.diameter,item.wall,item.floor);
  for(const key of statsKeys)clay.stats[key]=booleanStats.has(key)?false:0;
  clay.stats.startMass=clay.mass();clay.stats.maxHeight=clay.height;clay.dead=false;clay.deadReason='';clay.stage=STAGE.THROW;clay.shrink=1;
 }
 function updateGeometry(){
  let row=0;
  const put=(r,y,x=0,z=0)=>{radial[row]=r;vertical[row]=y;offsetX[row]=x;offsetZ[row]=z;row++;};
  const base=clay.ro[0],baseY=Math.min(.05,clay.y[1]*.35);
  put(0,0,clay.ox[0],clay.oz[0]);put(base*.62,0,clay.ox[0],clay.oz[0]);put(base*.985,baseY,clay.ox[0],clay.oz[0]);
  for(let j=0;j<sections;j++){const i=station(j);put(clay.ro[i],clay.ymid(i),clay.ox[i],clay.oz[i]);}
  const top=NS-1,outer=clay.ro[top],inner=clay.ri[top],center=(outer+inner)*.5,radius=(outer-inner)*.5,yTop=clay.ymid(top),peak=clay.height-yTop+radius*.5;
  for(let j=1;j<=rimSteps;j++){const angle=j/(rimSteps+1)*Math.PI;put(center+radius*Math.cos(angle),yTop+peak*Math.sin(angle),clay.ox[top],clay.oz[top]);}
  const floor=Math.max(1,Math.min(NS-1,clay.floorSection())),floorY=clay.y[floor];
  for(let j=sections-1;j>=0;j--){const i=station(j),solid=clay.ymid(i)<floorY;put(solid?0:clay.ri[i],Math.max(floorY,clay.ymid(i)),clay.ox[solid?floor:i],clay.oz[solid?floor:i]);}
  put(0,floorY,clay.ox[floor],clay.oz[floor]);
  let height=0,left=Infinity,right=-Infinity,back=Infinity,front=-Infinity;
  for(let i=0;i<rows;i++){height=Math.max(height,vertical[i]);left=Math.min(left,offsetX[i]-radial[i]);right=Math.max(right,offsetX[i]+radial[i]);back=Math.min(back,offsetZ[i]-radial[i]);front=Math.max(front,offsetZ[i]+radial[i]);}
  const scale=3/Math.max(height,right-left,front-back),centerX=(left+right)*.5,centerZ=(back+front)*.5;
  for(let i=0;i<rows;i++){
   const previous=Math.max(0,i-1),next=Math.min(rows-1,i+1),dr=radial[next]-radial[previous],dy=vertical[next]-vertical[previous],dx=offsetX[next]-offsetX[previous],dz=offsetZ[next]-offsetZ[previous];
   for(let column=0;column<=segments;column++){
    const angle=column===segments?0:column/segments*Math.PI*2,c=Math.cos(angle),s=Math.sin(angle),vertex=(i*stride+column)*3;
    positions[vertex]=(radial[i]*c+offsetX[i]-centerX)*scale;positions[vertex+1]=vertical[i]*scale-1.5;positions[vertex+2]=(radial[i]*s+offsetZ[i]-centerZ)*scale;
    uv[vertex/3*2+1]=vertical[i]/height;
    const nx=dy*c,ny=-dr-dx*c-dz*s,nz=dy*s,length=Math.hypot(nx,ny,nz);
    normals[vertex]=length>1e-10?nx/length:0;normals[vertex+1]=length>1e-10?ny/length:(i<sections?-1:1);normals[vertex+2]=length>1e-10?nz/length:0;
   }
  }
  geometry.attributes.position.needsUpdate=true;geometry.attributes.normal.needsUpdate=true;geometry.attributes.uv.needsUpdate=true;geometry.computeBoundingBox();geometry.computeBoundingSphere();
 }
 function getProfile(){
  const outer=[],inner=[],floor=Math.max(1,Math.min(NS-1,clay.floorSection())),floorY=clay.y[floor];
  for(let j=0;j<sections;j++){const i=station(j),y=clay.ymid(i);outer.push([clay.ro[i],y]);inner.push([y<floorY?0:clay.ri[i],Math.max(floorY,y)]);}
  return {outer,inner,height:clay.height,maxR:clay.maxR,canUndo:!disposed&&past.length>0,canRedo:!disposed&&future.length>0,preset:currentPreset};
 }
 const pointOK=(r,y)=>Number.isFinite(r)&&Number.isFinite(y)&&r>=0&&r<=24&&y>=0&&y<=55;
 function beginStroke(r,y){
  if(disposed||!pointOK(r,y))return false;endStroke();stroke={r,y,before:capture()};hand.grab();return true;
 }
 function sculpt(r,y,dt){
  if(disposed||!stroke||!pointOK(r,y)||!Number.isFinite(dt)||dt<=0)return false;
  if(Math.hypot(r-stroke.r,y-stroke.y)<1e-5)return false;
  capture(rollback);const previousR=stroke.r,previousY=stroke.y;stroke.r=r;stroke.y=y;
  const {ro}=radiiAt(clay,y),contact=Hand.contact(clay,r,y,ro);
  hand.apply(clay,{r,y,pr:previousR,py:previousY,dR:r-previousR,dY:y-previousY,press:1,contact,omega:8.4},clamp(dt,1/240,.1));
  if(!valid(clay)){apply(rollback);hand.grab();return false;}
  if(same(rollback))return false;updateGeometry();return true;
 }
 function endStroke(){
  if(!stroke)return false;const before=stroke.before;stroke=null;hand.release();if(!same(before)){remember(before);return true;}return false;
 }
 function undo(){if(disposed)return false;endStroke();if(!past.length)return false;future.push(capture());apply(past.pop());updateGeometry();return true;}
 function redo(){if(disposed)return false;endStroke();if(!future.length)return false;past.push(capture());apply(future.pop());updateGeometry();return true;}
 function reset(name=currentPreset){
  if(disposed||typeof name!=='string'||!Object.hasOwn(presets,name))return false;endStroke();const before=capture();makePreset(name);if(same(before))return false;remember(before);updateGeometry();return true;
 }
 function serialize(){
  if(disposed)throw new Error('Pottery model closed');
  const state=capture(),arrays=Object.fromEntries(fields.map(field=>[field,Array.from(state.arrays[field])]));
  const text=JSON.stringify({version:1,preset:state.preset,random:state.random,arrays,stats:state.stats});
  if(text.length>maximumBytes)throw new Error('Pottery draft is too large');return text;
 }
 function restore(text){
  if(disposed||typeof text!=='string'||text.length>maximumBytes||new TextEncoder().encode(text).length>maximumBytes)return false;
  let state;
  try{
   const value=JSON.parse(text);
   if(!ownKeys(value,['version','preset','random','arrays','stats'])||value.version!==1||typeof value.preset!=='string'||!Object.hasOwn(presets,value.preset)||!Number.isInteger(value.random)||value.random<0||value.random>0xffffffff||!ownKeys(value.arrays,fields)||!ownKeys(value.stats,statsKeys))return false;
   for(const field of fields)if(!Array.isArray(value.arrays[field])||value.arrays[field].length!==NS)return false;
   if(!valid(value.arrays))return false;
   for(const key of statsKeys){const item=value.stats[key];if(booleanStats.has(key)?typeof item!=='boolean':!Number.isFinite(item)||item<0||item>1e8)return false;}
   state={preset:value.preset,random:value.random,arrays:Object.fromEntries(fields.map(field=>[field,new Float32Array(value.arrays[field])])),stats:value.stats};
   if(!valid(state.arrays))return false;
  }catch{return false;}
  endStroke();const before=capture();apply(state);if(!same(before))remember(before);updateGeometry();return true;
 }
 makePreset(preset);updateGeometry();
 return {geometry,getProfile,beginStroke,sculpt,endStroke,undo,redo,reset,serialize,restore,dispose(){if(disposed)return;disposed=true;stroke=null;hand.release();past.length=future.length=0;geometry.dispose();}};
}
