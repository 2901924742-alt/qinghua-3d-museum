// Original floral line art, interpreted for this exhibit; it is not a tracing of a historical pattern.
export function createMotifBloom({THREE,isDesktop}){
 const group=new THREE.Group();group.name='museum-motif-bloom';
 const positions=[],opened=[],edges=[],growth=[],seeds=[];
 const strands=isDesktop?4:3,segments=isDesktop?80:56;
 function vine(t,angle,open){
  const a=angle+t*3.6,r=.46+Math.sin(t*Math.PI)*.11+open*(.14+t*.34);
  return [Math.cos(a)*r,-.88+t*1.78+open*Math.sin(t*Math.PI)*.18,Math.sin(a)*r];
 }
 function stroke(sample,steps,start,length,width,seed){
  const closed=[],wide=[];
  for(let i=0;i<=steps;i++){closed.push(sample(i/steps,0));wide.push(sample(i/steps,1));}
  const ribbon=(points,i,edge)=>{
   const p=points[i],a=points[Math.max(0,i-1)],b=points[Math.min(steps,i+1)];
   const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],scale=width/Math.max(.0001,Math.hypot(dx,dy));
   return [p[0]-dy*scale*edge,p[1]+dx*scale*edge,p[2]+dz*scale*edge*.12];
  };
  for(let i=0;i<steps;i++)for(const [n,edge] of [[i,-1],[i,1],[i+1,-1],[i+1,-1],[i,1],[i+1,1]]){
   positions.push(...ribbon(closed,n,edge));opened.push(...ribbon(wide,n,edge));edges.push(edge);growth.push(start+n/steps*length);seeds.push(seed);
  }
 }
 for(let s=0;s<strands;s++){
  const angle=s/strands*Math.PI*2;
  stroke((t,open)=>vine(t,angle,open),segments,0,.77,.007,s);
  for(let branch=0;branch<4;branch++){
   const level=.17+branch*.19,side=branch%2?1:-1;
   stroke((t,open)=>{
    const p=vine(level,angle,open),leaf=Math.sin(t*Math.PI),length=(.19+open*.14)*leaf;
    p[0]+=Math.cos(angle+level*3.6+side*.9)*length;p[1]+=Math.sin(t*Math.PI*2)*(.038+open*.018)+leaf*.11;p[2]+=Math.sin(angle+level*3.6+side*.9)*length;
    return p;
   },24,level*.76,.14,.006,s+branch*.13);
  }
  for(let petal=0;petal<6;petal++){
   const a=petal/6*Math.PI*2;
   stroke((t,open)=>{
    const p=vine(.9,angle,open),radius=Math.sin(t*Math.PI)*(.17+open*.075),curve=a+Math.sin(t*Math.PI*2)*.35;
    p[0]+=Math.cos(curve)*radius;p[1]+=Math.sin(curve)*radius;p[2]+=(Math.cos(t*Math.PI*2)-1)*.025;
    return p;
   },24,.72,.25,.006,s+petal*.09);
  }
 }
 const geometry=new THREE.BufferGeometry();
 for(const [name,array,size] of [['position',positions,3],['opened',opened,3],['edge',edges,1],['growth',growth,1],['seed',seeds,1]])geometry.setAttribute(name,new THREE.Float32BufferAttribute(array,size));
 const uniforms={time:{value:0},open:{value:0},reveal:{value:0},charge:{value:0},reduced:{value:0}};
 const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,depthTest:false,blending:THREE.AdditiveBlending,toneMapped:false,fog:false,side:THREE.DoubleSide,uniforms,
  vertexShader:`attribute vec3 opened;attribute float edge,growth,seed;uniform float time,open,reveal,charge,reduced;varying float side,ink,visible,tip;void main(){vec3 p=mix(position,opened,open);float breathe=sin(time*.8+seed*2.1)*(1.0-reduced)*.006;p.xy*=1.0+breathe;side=edge;ink=seed;visible=1.0-smoothstep(reveal-.025,reveal+.015,growth);tip=exp(-abs(growth-reveal)*55.0);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}`,
  fragmentShader:`varying float side,ink,visible,tip;uniform float charge;void main(){float core=exp(-side*side*7.0),halo=1.0-smoothstep(.25,1.0,abs(side));vec3 cobalt=mix(vec3(.10,.28,.95),vec3(.24,.64,1.0),fract(ink*.37));vec3 tint=mix(cobalt,vec3(.78,.94,1.0),core*.7+tip*.25);gl_FragColor=vec4(tint,visible*(core*.75+halo*.3+tip*.15)*(1.0+charge*.3));}`});
 const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;mesh.renderOrder=11;group.add(mesh);
 let disposed=false;
 return {group,update(time,spread,charge,reduced){if(disposed)return;uniforms.time.value=time;uniforms.open.value=spread;uniforms.charge.value=charge;uniforms.reduced.value=reduced?1:0;uniforms.reveal.value=reduced?1.05:Math.min(1.05,time/2.6);},dispose(){if(disposed)return;disposed=true;group.removeFromParent();geometry.dispose();material.dispose();}};
}
