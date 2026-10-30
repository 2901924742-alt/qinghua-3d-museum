const tau=Math.PI*2;

// Reuse the canvas stamp path; periodic copies keep decoration continuous at the UV seam.
export function paintStamp(ctx,point,{motif='flower',size=48,width=3,density=75,rotation=0}={}) {
 const alpha=density/100;
 for(const offset of [-512,0,512]){
  ctx.save();ctx.translate(((point.x%512)+512)%512+offset,point.y);ctx.strokeStyle=`rgba(31,63,143,${alpha})`;ctx.fillStyle=`rgba(31,63,143,${alpha*.2})`;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';
  if(rotation&&motif!=='ring'&&motif!=='disc')ctx.rotate(rotation*Math.PI/180);
  if(motif==='ring'||motif==='disc'){
   ctx.beginPath();ctx.arc(0,0,motif==='ring'?Math.max(size/2,width/2+2):size/2,0,tau);
   if(motif==='disc'){ctx.fillStyle=ctx.strokeStyle;ctx.fill();}else ctx.stroke();
  }else if(motif==='bamboo'){
   ctx.beginPath();ctx.moveTo(-size*.25,size*.42);ctx.quadraticCurveTo(0,0,size*.18,-size*.44);ctx.stroke();
   for(let i=0;i<5;i++){
    const y=size*(.25-i*.14),side=i%2?1:-1;
    ctx.beginPath();ctx.moveTo(0,y);ctx.quadraticCurveTo(side*size*.5,y-size*.34,side*size*.4,y-size*.05);ctx.quadraticCurveTo(side*size*.2,y+size*.05,0,y);ctx.fill();ctx.stroke();
   }
  }else if(motif==='cloud'){
   ctx.beginPath();ctx.moveTo(-size*.46,size*.15);ctx.bezierCurveTo(-size*.65,-size*.16,-size*.23,-size*.3,-size*.16,-size*.12);ctx.bezierCurveTo(-size*.22,-size*.55,size*.37,-size*.46,size*.3,-size*.12);ctx.bezierCurveTo(size*.66,-size*.25,size*.64,size*.2,size*.34,size*.2);ctx.quadraticCurveTo(size*.04,size*.2,-size*.16,size*.35);ctx.stroke();
   ctx.beginPath();ctx.moveTo(-size*.35,size*.15);ctx.quadraticCurveTo(0,size*.04,size*.25,size*.08);ctx.stroke();
  }else{
   const petals=motif==='plum'?5:8;
   for(let n=0;n<petals;n++){
    ctx.save();ctx.rotate(n*tau/petals);ctx.beginPath();ctx.ellipse(0,-size*.29,size*(motif==='plum'?.19:.13),size*.28,0,0,tau);ctx.fill();ctx.stroke();ctx.restore();
   }
   ctx.beginPath();ctx.arc(0,0,size*.09,0,tau);ctx.fillStyle=ctx.strokeStyle;ctx.fill();
  }
  ctx.restore();
 }
}

export function paintBand(ctx,y,{width=8,density=75}={}) {
 ctx.save();ctx.strokeStyle=`rgba(31,63,143,${density/100})`;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(512,y);ctx.stroke();ctx.restore();
}

export function paintTemplate(ctx,name,{density=75}={}) {
 if(!['floral','plum','border'].includes(name))throw new Error('Unknown porcelain template');
 ctx.save();ctx.fillStyle='#faf7ed';ctx.fillRect(0,0,512,256);ctx.restore();
 for(const y of [16,23,233,240])paintBand(ctx,y,{width:y===16||y===240?3:1,density});
 if(name==='floral'){
  ctx.save();ctx.strokeStyle=`rgba(31,63,143,${density/140})`;ctx.lineWidth=2;
  for(const row of [82,174]){ctx.beginPath();ctx.moveTo(0,row);for(let x=0;x<512;x+=64)ctx.bezierCurveTo(x+16,row-28,x+48,row+28,x+64,row);ctx.stroke();}
  ctx.restore();
  for(const y of [74,166])for(let x=32;x<512;x+=64)paintStamp(ctx,{x,y},{motif:'flower',size:40,width:1.4,density});
  for(let x=0;x<512;x+=64)paintStamp(ctx,{x,y:124},{motif:'bamboo',size:32,width:1,density:density*.8});
 }else if(name==='plum'){
  ctx.save();ctx.strokeStyle=`rgba(31,63,143,${density/180})`;ctx.lineWidth=1;
  for(let x=-64;x<576;x+=64)for(let y=32;y<232;y+=48){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+32,y+24);ctx.lineTo(x+64,y);ctx.stroke();}
  ctx.restore();
  for(let row=0;row<3;row++)for(let x=32;x<512;x+=96)paintStamp(ctx,{x:x+(row%2?48:0),y:64+row*64},{motif:'plum',size:34,width:1.5,density});
 }else{
  for(const y of [48,208]){
   paintBand(ctx,y-14,{width:2,density});paintBand(ctx,y+14,{width:2,density});
   ctx.save();ctx.strokeStyle=`rgba(31,63,143,${density/100})`;ctx.lineWidth=2;
   for(let x=0;x<512;x+=32){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+8,y-8);ctx.lineTo(x+24,y-8);ctx.lineTo(x+24,y+8);ctx.lineTo(x+16,y+8);ctx.lineTo(x+16,y);ctx.stroke();}ctx.restore();
  }
  for(let x=32;x<512;x+=64)paintStamp(ctx,{x,y:128},{motif:'cloud',size:46,width:1.8,density});
 }
}
