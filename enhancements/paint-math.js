export function canvasPoint(event, rect, width, height) {
 if (!(rect.width > 0 && rect.height > 0) || !Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return null;
 return {x:Math.max(0,Math.min(width,(event.clientX-rect.left)*width/rect.width)),y:Math.max(0,Math.min(height,(event.clientY-rect.top)*height/rect.height))};
}

export function boundedHistory(limit=12) {
 const frames=[];
 return {push(frame){frames.push(frame);if(frames.length>limit)frames.shift();},pop(){return frames.pop();},clear(){frames.length=0;},get size(){return frames.length;}};
}
