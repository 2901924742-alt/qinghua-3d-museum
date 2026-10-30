// Artistic surface traces join nearby original samples, never fill a missing scan region.
export function createSurfaceScanGeometry({THREE,positions,normals,isDesktop}) {
 if(!positions||positions.length%3||!normals||normals.length!==positions.length)throw new TypeError('Invalid surface samples');
 const rows=isDesktop?24:16,columns=isDesktop?64:32,count=positions.length/3,bins=new Int32Array(rows*columns).fill(-1),scores=new Float32Array(rows*columns).fill(Infinity);
 let low=Infinity,high=-Infinity;
 for(let i=0;i<positions.length;i+=3){
  if(![positions[i],positions[i+1],positions[i+2],normals[i],normals[i+1],normals[i+2]].every(Number.isFinite))throw new TypeError('Non-finite surface sample');
  low=Math.min(low,positions[i+1]);high=Math.max(high,positions[i+1]);
 }
 if(!(high>low))throw new RangeError('Surface samples have no height');
 for(let index=0;index<count;index++){
  const i=index*3,x=positions[i],y=positions[i+1],z=positions[i+2],radius=Math.hypot(x,z);
  if(radius<.015||(normals[i]*x+normals[i+2]*z)/radius<-.12)continue;
  const v=(y-low)/(high-low)*rows,u=((Math.atan2(z,x)/(Math.PI*2)+1)%1)*columns,row=Math.min(rows-1,Math.floor(v)),column=Math.floor(u),slot=row*columns+column;
  const score=(v-row-.5)**2+(u-column-.5)**2;
  if(score<scores[slot]){scores[slot]=score;bins[slot]=index;}
 }
 const vertices=[],directions=[],kinds=[],maximum=((high-low)/rows*2.25)**2;
 function connect(first,second,kind){
  if(first<0||second<0)return;
  const a=first*3,b=second*3,dx=positions[a]-positions[b],dy=positions[a+1]-positions[b+1],dz=positions[a+2]-positions[b+2],distance=dx*dx+dy*dy+dz*dz;
  if(distance<1e-10||distance>maximum)return;
  for(const offset of [a,b]){vertices.push(positions[offset],positions[offset+1],positions[offset+2]);directions.push(normals[offset],normals[offset+1],normals[offset+2]);kinds.push(kind);}
 }
 for(let row=0;row<rows;row++)for(let column=0;column<columns;column++){
  const slot=row*columns+column;
  connect(bins[slot],bins[row*columns+(column+1)%columns],0);
  if(row+1<rows)connect(bins[slot],bins[slot+columns],1);
 }
 if(!vertices.length)throw new Error('Surface samples are too sparse for traces');
 const geometry=new THREE.BufferGeometry();geometry.name='museum-surface-scan-grid';
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(directions,3));geometry.setAttribute('kind',new THREE.Float32BufferAttribute(kinds,1));
 geometry.userData={surfaceScan:true,rows,columns,sampleCount:count};return geometry;
}
