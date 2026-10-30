export const paintDraftKey='museum-paint-draft-v2';
export const legacyPaintDraftKey='museum-paint-draft-v1';
const maxPNGBytes=1048576,maxJSONChars=1700000,maxShapeBytes=131072,prefix='data:image/png;base64,';

function validPNG(png){
 if(typeof png!=='string'||!png.startsWith(prefix)||png.length>prefix.length+1398104)return false;
 const data=png.slice(prefix.length);
 if(data.length<44||data.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(data))return false;
 const bytes=data.length/4*3-(data.endsWith('==')?2:data.endsWith('=')?1:0);
 if(bytes>maxPNGBytes)return false;
 try{
  const head=Uint8Array.from(atob(data.slice(0,44)),char=>char.charCodeAt(0)),view=new DataView(head.buffer);
  return [137,80,78,71,13,10,26,10].every((value,index)=>head[index]===value)&&view.getUint32(8)===13&&view.getUint32(12)===0x49484452&&view.getUint32(16)===512&&view.getUint32(20)===256;
 }catch{return false;}
}

export function isStaticPaintPNG(png){
 if(!validPNG(png))return false;
 try{
  const bytes=Uint8Array.from(atob(png.slice(prefix.length)),char=>char.charCodeAt(0)),view=new DataView(bytes.buffer);let offset=8,count=0,hasData=false;
  while(offset+12<=bytes.length&&++count<=1024){
   const length=view.getUint32(offset),type=view.getUint32(offset+4),end=offset+length+12;
   if(end>bytes.length||count>1&&type===0x49484452||[0x6163544c,0x6663544c,0x66644154].includes(type))return false;
   if(type===0x49444154)hasData=true;
   if(type===0x49454e44)return length===0&&hasData&&end===bytes.length;
   offset=end;
  }
 }catch{}
 return false;
}

export async function validatePaintPNG(png,signal){
 if(!isStaticPaintPNG(png)||signal?.aborted||typeof DecompressionStream!=='function')return false;
 let reader,cancel;
 try{
  const bytes=Uint8Array.from(atob(png.slice(prefix.length)),char=>char.charCodeAt(0)),view=new DataView(bytes.buffer),channels=bytes[25]===6?4:bytes[25]===2?3:0;
  // Workshop canvas exports are non-interlaced 8-bit RGB/RGBA, not arbitrary PNG documents.
  if(bytes[24]!==8||!channels||bytes[26]!==0||bytes[27]!==0||bytes[28]!==0)return false;
  const parts=[];for(let offset=8;offset<bytes.length;){const size=view.getUint32(offset);if(view.getUint32(offset+4)===0x49444154)parts.push(bytes.subarray(offset+8,offset+8+size));offset+=size+12;}
  let part=0,position=0,stopped=false;const inflater=new AbortController();
  // Small compressed chunks limit each native inflater input before output can be checked.
  const compressed=new ReadableStream({pull(controller){
   if(stopped){controller.close();return;}
   while(part<parts.length&&position===parts[part].length){part++;position=0;}
   if(part===parts.length){controller.close();return;}
   const end=Math.min(position+256,parts[part].length);controller.enqueue(parts[part].subarray(position,end));position=end;
  }});
  reader=compressed.pipeThrough(new DecompressionStream('deflate'),{signal:inflater.signal}).getReader();
  cancel=()=>{stopped=true;inflater.abort();void reader.cancel().catch(()=>{});};signal?.addEventListener('abort',cancel,{once:true});
  const row=512*channels+1,expected=row*256;let count=0;
  while(true){
   const {done,value}=await reader.read();if(done)break;
   if(signal?.aborted||count+value.length>expected)return false;
   for(let index=(row-count%row)%row;index<value.length;index+=row)if(value[index]>4)return false;
   count+=value.length;
  }
  return count===expected&&!signal?.aborted;
 }catch{return false;}
 finally{if(cancel){signal?.removeEventListener('abort',cancel);cancel();}}
}

function validShapeJSON(value){
 if(value===null)return true;
 if(typeof value!=='string'||value.length>maxShapeBytes)return false;
 try{
  if(new TextEncoder().encode(value).byteLength>maxShapeBytes)return false;
  const shape=JSON.parse(value);
  // This is an envelope check only. The optional pottery factory must call
  // model.restore(value) before using any shape; keep its schema in one place.
  return shape!==null&&typeof shape==='object'&&!Array.isArray(shape);
 }catch{return false;}
}

export function parsePaintDraft(raw){
 if(typeof raw!=='string'||raw.length>maxJSONChars)return null;
 try{
  const draft=JSON.parse(raw),range=(value,min,max)=>typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max;
  if(!draft||Array.isArray(draft)||(draft.version!==1&&draft.version!==2)||draft.width!==512||draft.height!==256||!['brush','flower'].includes(draft.tool)||!Number.isInteger(draft.brushWidth)||!range(draft.brushWidth,2,28)||!Number.isInteger(draft.density)||!range(draft.density,20,100)||!range(draft.angle,-180,180)||typeof draft.glazed!=='boolean'||!validPNG(draft.png)||(draft.version===2&&!validShapeJSON(draft.shapeJSON)))return null;
  const result={version:draft.version,width:512,height:256,png:draft.png,tool:draft.tool,brushWidth:draft.brushWidth,density:draft.density,angle:draft.angle,glazed:draft.glazed};
  if(draft.version===2){
   result.shapeJSON=draft.shapeJSON;
   if(draft.stamp!==undefined){if(draft.tool!=='flower'||!['flower','plum','bamboo','cloud','ring','disc','band'].includes(draft.stamp))return null;result.stamp=draft.stamp;}
   if(draft.stampSize!==undefined){if(!Number.isInteger(draft.stampSize)||!range(draft.stampSize,16,96))return null;result.stampSize=draft.stampSize;}
   if(draft.stampAngle!==undefined){if(!Number.isInteger(draft.stampAngle)||!range(draft.stampAngle,-180,180))return null;result.stampAngle=draft.stampAngle;}
   if(draft.stampRepeat!==undefined){if(![1,4,6,8,12].includes(draft.stampRepeat))return null;result.stampRepeat=draft.stampRepeat;}
  }
  return result;
 }catch{return null;}
}

export function stringifyPaintDraft(state){
 const draft={version:2,width:512,height:256,png:state.png,tool:state.tool,brushWidth:state.brushWidth,density:state.density,angle:state.angle,glazed:state.glazed,shapeJSON:state.shapeJSON===undefined?null:state.shapeJSON};
 if(state.stamp!==undefined)draft.stamp=state.stamp;
 if(state.stampSize!==undefined)draft.stampSize=state.stampSize;
 if(state.stampAngle!==undefined)draft.stampAngle=state.stampAngle;
 if(state.stampRepeat!==undefined)draft.stampRepeat=state.stampRepeat;
 const raw=JSON.stringify(draft);
 if(!parsePaintDraft(raw))throw new Error('Invalid paint draft');
 return raw;
}
