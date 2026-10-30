import {getStroke} from '../vendor/perfect-freehand/getStroke.js';

const width=512,height=256,maxPoints=512,maxOutlinePoints=32*maxPoints+128,ink='#1f3f8f';
const finite=value=>typeof value==='number'&&Number.isFinite(value);

// Optional Canvas2D brush. No renderer, network, timers or animation loop lives here.
export function createCobaltBrush(canvas){
 if(!canvas||canvas.width!==width||canvas.height!==height)throw new RangeError('Cobalt brush requires a 512 × 256 canvas');
 let main=canvas.getContext('2d',{willReadFrequently:true});
 if(!main)throw new Error('Canvas 2D unavailable');
 let committed=null,active=null,committedContext=null,activeContext=null,stroke=null,disposed=false;

 function reset(context){context.setTransform(1,0,0,1,0,0);context.globalAlpha=1;context.globalCompositeOperation='source-over';context.clearRect(0,0,width,height);}
 function releaseMasks(){
  if(committed){committed.width=committed.height=0;}
  if(active){active.width=active.height=0;}
  committed=active=committedContext=activeContext=null;
 }
 function prepareMasks(){
  if(committed)return;
  try{
   committed=document.createElement('canvas');active=document.createElement('canvas');
   for(const mask of [committed,active]){mask.width=width;mask.height=height;}
   committedContext=committed.getContext('2d',{willReadFrequently:true});activeContext=active.getContext('2d',{willReadFrequently:true});
   if(!committedContext||!activeContext)throw new Error('Canvas 2D ink masks unavailable');
  }catch(error){releaseMasks();throw error;}
 }
 function point(value,pen){
  if(!value||!finite(value.x)||!finite(value.y)||Math.abs(value.x)>2048||value.y<0||value.y>height)return null;
  return [value.x,value.y,pen?(finite(value.pressure)?Math.max(0,Math.min(1,value.pressure)):.5):.5];
 }
 function outline(last,taper=true){
  const points=stroke.points,result=getStroke(points,{size:stroke.width,thinning:.6,smoothing:.5,streamline:.3,simulatePressure:!stroke.pen,start:{cap:true,taper:0},end:{cap:true,taper:last&&taper&&points.length>3?stroke.width*.45:0},last});
  if(!Array.isArray(result)||result.length<3||result.length>maxOutlinePoints)throw new Error('Invalid cobalt outline size');
  let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
  for(const entry of points){left=Math.min(left,entry[0]);right=Math.max(right,entry[0]);top=Math.min(top,entry[1]);bottom=Math.max(bottom,entry[1]);}
  const pad=stroke.width*2+4;
  for(const entry of result)if(!Array.isArray(entry)||entry.length!==2||!finite(entry[0])||!finite(entry[1])||entry[0]<left-pad||entry[0]>right+pad||entry[1]<top-pad||entry[1]>bottom+pad)throw new Error('Invalid cobalt outline coordinates');
  return result;
 }
 function fill(context,polygon){
  let left=Infinity,right=-Infinity;
  for(const entry of polygon){left=Math.min(left,entry[0]);right=Math.max(right,entry[0]);}
  const first=Math.ceil(-right/width),last=Math.floor((width-left)/width);
  if(last-first>12)throw new Error('Invalid cobalt wrap bounds');
  context.globalAlpha=1;context.globalCompositeOperation='source-over';context.fillStyle=ink;context.beginPath();
  for(let copy=first;copy<=last;copy++){
   const offset=copy*width;context.moveTo(polygon[0][0]+offset,polygon[0][1]);
   for(let i=1;i<polygon.length;i++)context.lineTo(polygon[i][0]+offset,polygon[i][1]);
   context.closePath();
  }
  context.fill();
 }
 function commitWindow(){
  // A rare capacity flush may run from move(): every 512 samples, never on
  // the main canvas. Keep already painted sections instead of thinning them.
  const polygon=outline(true,false);fill(committedContext,polygon);
  stroke.points=stroke.points.slice(-2);
 }
 function begin(value,{base,width:brushWidth,density,pen=false}={}){
  if(disposed||stroke||!base||base.width!==width||base.height!==height||!(base.data instanceof Uint8ClampedArray)||base.data.length!==width*height*4||!finite(brushWidth)||brushWidth<2||brushWidth>28||!finite(density)||density<20||density>100)return false;
  const first=point(value,pen===true);if(!first)return false;
  prepareMasks();reset(committedContext);reset(activeContext);
  stroke={base,width:brushWidth,density:density/100,pen:pen===true,points:[first],dirty:true};return true;
 }
 function move(value){
  if(disposed||!stroke)return false;
  const next=point(value,stroke.pen);if(!next)return false;
  const previous=stroke.points[stroke.points.length-1];
  if(previous&&Math.hypot(next[0]-previous[0],next[1]-previous[1])<.05&&(!stroke.pen||Math.abs(next[2]-previous[2])<.01))return false;
  if(stroke.points.length===maxPoints)commitWindow();
  stroke.points.push(next);stroke.dirty=true;return true;
 }
 function breakSegment(){
  if(disposed||!stroke||!stroke.points.length)return false;
  // Keep the same history/base and ink union across gaps. An invalid outline
  // or failed fill must throw before clearing the current bounded samples.
  const polygon=outline(true);fill(committedContext,polygon);
  stroke.points=[];stroke.dirty=true;return true;
 }
 function render(last=false){
  if(disposed||!stroke||(!stroke.dirty&&!last))return false;
  // Compute and validate before changing either mask or the visible canvas.
  const polygon=stroke.points.length?outline(last===true):null;
  reset(activeContext);activeContext.drawImage(committed,0,0);if(polygon)fill(activeContext,polygon);
  main.save();
  try{
   main.setTransform(1,0,0,1,0,0);main.globalCompositeOperation='source-over';main.globalAlpha=1;
   main.putImageData(stroke.base,0,0);main.globalAlpha=stroke.density;main.drawImage(active,0,0);
  }finally{main.restore();}
  stroke.dirty=false;return true;
 }
 function finish(){if(disposed||!stroke)return false;try{return render(true);}finally{stroke=null;}}
 function dispose(){if(disposed)return;disposed=true;stroke=null;releaseMasks();main=null;}
 return {begin,move,breakSegment,render,finish,dispose};
}
