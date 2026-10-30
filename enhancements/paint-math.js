export function canvasPoint(event, rect, width, height) {
 if (!(rect.width > 0 && rect.height > 0) || !Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return null;
 return {x:Math.max(0,Math.min(width,(event.clientX-rect.left)*width/rect.width)),y:Math.max(0,Math.min(height,(event.clientY-rect.top)*height/rect.height))};
}

// CanvasTexture's default vertical flip: high UV.y belongs at the canvas top.
export function uvToCanvasPoint(uv,width=512,height=256){
 if(!uv||!Number.isFinite(uv.x)||!Number.isFinite(uv.y)||!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0||uv.y<-.000001||uv.y>1.000001)return null;
 const u=((uv.x%1)+1)%1,v=Math.max(0,Math.min(1,uv.y));
 const x=u*width,y=(1-v)*height;
 return Number.isFinite(x)&&Number.isFinite(y)?{x,y}:null;
}

// Do not clamp a seam crossing to the edge or inherit the preceding gap's x.
// The caller re-anchors after a break and before its bounded drawing range.
export function unwrapCanvasX(x,lastX,width=512){
 if(!Number.isFinite(x)||!Number.isFinite(lastX)||!Number.isFinite(width)||width<=0)return null;
 const half=width/2,delta=((x-lastX+half)%width+width)%width-half,result=lastX+delta;
 return Number.isFinite(result)?result:null;
}

export function boundedHistory(limit=12) {
 const frames=[];
 return {push(frame){frames.push(frame);if(frames.length>limit)frames.shift();},pop(){return frames.pop();},clear(){frames.length=0;},get size(){return frames.length;}};
}
