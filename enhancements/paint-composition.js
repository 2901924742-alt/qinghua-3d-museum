import Poissimple from '../vendor/poissimple/poissimple.js';
import {paintStamp} from './paint-patterns.js';

const modes={sparse:[12,24],balanced:[20,12],rich:[32,4]};
// shortcut: motif-circle estimates follow these stamp paths, recalibrate when their geometry changes.
const radii={flower:.62,plum:.62,bamboo:.85,cloud:.72};
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const pixelsOK=value=>value&&value.width===512&&value.height===256&&value.data instanceof Uint8ClampedArray&&value.data.length===512*256*4;

export function compositionPoints(settings){
 if(!settings||typeof settings!=='object'||Array.isArray(settings)||typeof settings.motif!=='string'||!Object.hasOwn(radii,settings.motif)||typeof settings.mode!=='string'||!Object.hasOwn(modes,settings.mode)||!finite(settings.size)||settings.size<16||settings.size>96||!finite(settings.width)||settings.width<2*.18||settings.width>28*.18||!finite(settings.density)||settings.density<20||settings.density>100||!finite(settings.rotation)||settings.rotation< -180||settings.rotation>180)throw new RangeError('Invalid composition settings');
 const [limit,gap]=modes[settings.mode],radius=radii[settings.motif]*settings.size+settings.width/2+2,margin=radius+3;
 const candidates=new Poissimple({n:limit,dimensions:2,extent:[[0,512],[margin,256-margin]],periodic:[true,false],tries:15}).fill();
 if(!Array.isArray(candidates)||candidates.length>limit)throw new RangeError('Invalid composition candidate count');
 const accepted=[];
 for(const point of candidates){
  if(!Array.isArray(point)||point.length!==2||!finite(point[0])||!finite(point[1])||point[0]<0||point[0]>=512||point[1]<margin||point[1]>256-margin)throw new RangeError('Invalid composition candidate coordinates');
  // Upstream keeps its best candidate after 15 tries; enforce our own periodic gap.
  if(accepted.every(other=>{const dx=Math.abs(point[0]-other[0]);return Math.hypot(Math.min(dx,512-dx),point[1]-other[1])>=2*radius+gap;}))accepted.push([point[0],point[1]]);
 }
 return accepted;
}

export function createComposition(basePixels,settings){
 if(!pixelsOK(basePixels))throw new RangeError('Composition requires 512 x 256 base pixels');
 const points=compositionPoints(settings),canvas=document.createElement('canvas');
 try{
  canvas.width=512;canvas.height=256;const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Composition Canvas 2D unavailable');
  ctx.putImageData(basePixels,0,0);
  for(const [x,y]of points)paintStamp(ctx,{x,y},settings);
  const pixels=ctx.getImageData(0,0,512,256);if(!pixelsOK(pixels))throw new Error('Invalid composition pixels');
  return {pixels,count:points.length};
 }finally{canvas.width=canvas.height=0;}
}
