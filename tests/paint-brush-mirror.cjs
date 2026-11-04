'use strict';
// Actual brush/getStroke, draft module and studio bodies. Recording Canvas only:
// these are geometry/ownership/compositing checks, not native raster or UI claims.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),studioFile=path.resolve(process.env.MUSEUM_BRUSH_TEST_SOURCE||path.join(root,'enhancements/paint-studio.js')),studio=fs.readFileSync(studioFile,'utf8'),checks=[];
const image=()=>({width:512,height:256,data:new Uint8ClampedArray(512*256*4)});
function body(name,source=studio){
 const start=new RegExp('^ (?:async )?function '+name+'\\(','m').exec(source)?.index;assert(start!==undefined,name);
 const lineEnd=source.indexOf('\n',start),first=source.slice(start,lineEnd).trim();if(first.endsWith('}'))return first;
 const close=/^ \}/m.exec(source.slice(lineEnd));assert(close,name+' close');return source.slice(start,lineEnd+close.index+close[0].length).trim();
}
function recordingCanvas(){
 const canvas={width:512,height:256},draw={paths:[],fills:[],strokes:[],draws:[],puts:[],globalAlpha:1,stack:[],
  setTransform(){},save(){this.stack.push(this.globalAlpha);},restore(){this.globalAlpha=this.stack.pop();},
  clearRect(){this.fills=[];},beginPath(){this.paths=[];},moveTo(x,y){this.paths.push([[x,y]]);},lineTo(x,y){this.paths.at(-1).push([x,y]);},closePath(){},
  fill(){this.fills.push({paths:this.paths.map(p=>p.map(v=>[...v])),alpha:this.globalAlpha});},
  stroke(){this.strokes.push({paths:this.paths.map(p=>p.map(v=>[...v])),width:this.lineWidth,style:this.strokeStyle});},
  putImageData(pixels){this.puts.push(pixels);},
  drawImage(source){this.draws.push({source,alpha:this.globalAlpha});if(source.draw)this.fills.push(...source.draw.fills.map(f=>({paths:f.paths,alpha:f.alpha})));}
 };
 canvas.draw=draw;canvas.getContext=()=>draw;return canvas;
}
function area(polygon){return polygon.reduce((sum,p,i)=>{const q=polygon[(i+1)%polygon.length];return sum+p[0]*q[1]-q[0]*p[1];},0)/2;}
function winding(polygon,x,y){
 let count=0;for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length],cross=(b[0]-a[0])*(y-a[1])-(x-a[0])*(b[1]-a[1]);if(a[1]<=y&&b[1]>y&&cross>0)count++;else if(a[1]>y&&b[1]<=y&&cross<0)count--;}
 return count;
}
const covered=(fills,x,y)=>fills.some(fill=>fill.paths.reduce((n,p)=>n+winding(p,x,y),0)!==0);
function check(name,fn){fn();checks.push(name);}
(async()=>{
 const {createCobaltBrush}=await import(pathToFileURL(path.join(root,'enhancements/cobalt-brush.js')));
 const {getStroke}=await import(pathToFileURL(path.join(root,'vendor/perfect-freehand/getStroke.js')));
 const draft=await import(pathToFileURL(path.join(root,'enhancements/paint-draft.js')));
 function natural(points,mirror,pen=false){
  const canvas=recordingCanvas(),masks=[];global.document={createElement(type){assert.equal(type,'canvas');const mask=recordingCanvas();masks.push(mask);return mask;}};
  const brush=createCobaltBrush(canvas),settings={base:image(),width:18,density:50,pen};if(mirror!==undefined)settings.brushMirror=mirror;
  assert.equal(brush.begin(points[0],settings),true);for(const p of points.slice(1))brush.move(p);brush.finish();
  return {brush,canvas,masks,fill:masks[1].draw.fills.at(-1)};
 }
 const ordinary=[{x:88,y:45},{x:110,y:68},{x:122,y:101},{x:145,y:136}];
 check('natural-default-off-and-explicit-off-have-identical-real-outlines',()=>{
  const a=natural(ordinary),b=natural(ordinary,false);assert.deepEqual(a.fill,b.fill);assert.equal(a.canvas.draw.draws.length,1);assert.equal(a.canvas.draw.draws[0].alpha,.5);a.brush.dispose();b.brush.dispose();
 });
 for(const [name,points]of Object.entries({offCentre:ordinary,axis:[{x:256,y:40},{x:256,y:80},{x:256,y:140}],crossing:[{x:224,y:45},{x:246,y:70},{x:271,y:100},{x:290,y:135}],seam:[{x:500,y:40},{x:511,y:75},{x:526,y:110}],farPositive:[{x:1295,y:40},{x:1308,y:80},{x:1320,y:120}],farNegative:[{x:-1300,y:40},{x:-1314,y:80},{x:-1327,y:120}]})){
  check('natural-real-getStroke-mirror-winding-union-'+name,()=>{
   const a=natural(points,false),b=natural(points,true),polygons=b.fill.paths;assert.equal(polygons.length,a.fill.paths.length*2);assert.equal(b.fill.alpha,1);
   for(let i=0;i<polygons.length;i+=2){const normal=polygons[i],mirror=polygons[i+1];assert.deepEqual(mirror,[...normal].reverse().map(([x,y])=>[512-x,y]));assert.equal(Math.sign(area(normal)),Math.sign(area(mirror)));}
   const options={size:18,thinning:.6,smoothing:.5,streamline:.3,simulatePressure:true,start:{cap:true,taper:0},end:{cap:true,taper:points.length>3?18*.45:0},last:true};
   const outline=getStroke(points.map(p=>[p.x,p.y,.5]),options),offset=Math.round((polygons[0][0][0]-outline[0][0])/512)*512;assert.deepEqual(polygons[0],outline.map(([x,y])=>[x+offset,y]));
   let hits=0;for(let y=10.37;y<246;y+=5)for(let x=.23;x<512;x+=4){const expected=covered(a.fill?[a.fill]:[],x,y)||covered([a.fill],512-x,y);assert.equal(covered([b.fill],x,y),expected);if(expected)hits++;}
   assert(hits>0);assert.equal(b.canvas.draw.draws.length,1);assert.equal(b.canvas.draw.draws[0].alpha,.5);assert.equal(b.canvas.draw.puts.length,1);a.brush.dispose();b.brush.dispose();
  });
 }
 check('natural-centre-axis-is-not-cancelled-or-alpha-composited-twice',()=>{
  const a=natural([{x:256,y:40},{x:256,y:100},{x:256,y:160}],true);assert(covered([a.fill],256,90));assert.equal(a.canvas.draw.draws.length,1);assert.equal(a.canvas.draw.draws[0].alpha,.5);a.brush.dispose();assert(a.masks.every(c=>c.width===0&&c.height===0));
 });
 check('natural-break-and-capacity-commit-use-the-same-mirrored-opaque-masks',()=>{
  const c=recordingCanvas(),masks=[];global.document={createElement(){const mask=recordingCanvas();masks.push(mask);return mask;}};const b=createCobaltBrush(c);
  b.begin({x:100,y:40},{base:image(),width:10,density:75,brushMirror:true,pen:true});for(let i=1;i<=520;i++)b.move({x:100+i*.2,y:40+i*.1,pressure:.4});
  assert(masks[0].draw.fills.length>0);b.breakSegment();b.move({x:350,y:150,pressure:.8});b.finish();
  for(const mask of masks)for(const fill of mask.draw.fills){assert.equal(fill.alpha,1);assert.equal(fill.paths.length%2,0);for(let i=0;i<fill.paths.length;i+=2)assert.deepEqual(fill.paths[i+1],[...fill.paths[i]].reverse().map(([x,y])=>[512-x,y]));}
  assert.equal(c.draw.draws.length,1);assert.equal(c.draw.draws[0].alpha,.75);b.dispose();assert(masks.every(c=>c.width===0&&c.height===0));
 });
 check('natural-rejects-invalid-mirror-option-before-allocating-masks',()=>{
  let allocations=0;global.document={createElement(){allocations++;return recordingCanvas();}};const b=createCobaltBrush(recordingCanvas());for(const brushMirror of [null,0,1,'true',{},[]])assert.equal(b.begin({x:50,y:50},{base:image(),width:8,density:50,brushMirror}),false);assert.equal(allocations,0);b.dispose();
 });
 function fallback(from,to,mirror,source=studio){const c=recordingCanvas(),context={ctx:c.draw,textureDirty:false};vm.createContext(context);vm.runInContext(body('drawBrush',source),context);context.drawBrush(from,to,18,50,mirror);assert.equal(context.textureDirty,true);return c.draw.strokes;}
 function segmentHit(strokes,x,y){return strokes.some(s=>s.paths.some(p=>{const a=p[0],b=p[1],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy)<=s.width/2;}));}
 for(const [name,from,to]of [['ordinary',{x:80,y:50},{x:140,y:100}],['axis',{x:256,y:50},{x:256,y:140}],['crossing',{x:240,y:50},{x:272,y:140}],['seam',{x:505,y:50},{x:525,y:100}],['negativeSeam',{x:-15,y:50},{x:5,y:100}],['farPositive',{x:1300,y:50},{x:1320,y:100}],['farNegative',{x:-1300,y:50},{x:-1320,y:100}]]){
  check('fallback-single-stroke-periodic-union-'+name,()=>{const a=fallback(from,to,false),b=fallback(from,to,true);assert.equal(b.length,1);assert.equal(b[0].style,'rgba(31,63,143,0.5)');let hits=0;for(let y=20.3;y<180;y+=4)for(let x=.17;x<512;x+=3){const expected=segmentHit(a,x,y)||segmentHit(a,512-x,y);assert.equal(segmentHit(b,x,y),expected);if(expected)hits++;}assert(hits>0);for(const p of b[0].paths)assert(Math.abs(p[1][0]-p[0][0])<=Math.abs(to.x-from.x)+1e-10);});
 }
 check('fallback-normal-visible-inrange-geometry-retains-old-three-copy-result',()=>{
  for(const [from,to]of [[{x:0,y:50},{x:28,y:80}],[{x:490,y:50},{x:525,y:80}],[{x:200,y:50},{x:280,y:80}]]){const old=[{width:18,paths:[-512,0,512].map(o=>[[from.x+o,from.y],[to.x+o,to.y]])}],current=fallback(from,to,false);for(let y=30.3;y<110;y+=3)for(let x=.31;x<512;x+=2)assert.equal(segmentHit(current,x,y),segmentHit(old,x,y));}
 });
 check('fallback-normal-and-mirror-cover-the-expected-farwrap-centres',()=>{const from={x:1300,y:50},to={x:1320,y:100};assert.equal(segmentHit(fallback(from,to,false),286,75),true);assert.equal(segmentHit(fallback(from,to,true),226,75),true);});
 for(const [name,from,to]of [['verticalAxis',{x:256,y:75},{x:256,y:95}],['horizontalAxis',{x:236,y:100},{x:276,y:100}],['verticalSeam0',{x:0,y:75},{x:0,y:95}],['verticalSeam512',{x:512,y:75},{x:512,y:95}],['horizontalSeam',{x:502,y:100},{x:522,y:100}]]){
  check('fallback-coincident-'+name+'-keeps-only-existing-normal-periodic-segments',()=>{const normal=fallback(from,to,false),mirrored=fallback(from,to,true);assert.equal(mirrored.length,1);assert.deepEqual(mirrored[0].paths,normal.flatMap(call=>call.paths));assert.equal(mirrored[0].style,normal[0].style);assert.equal(mirrored[0].width,normal[0].width);});
 }
 for(const [name,from,to]of [['offAxisVertical',{x:245,y:75},{x:245,y:95}],['crossingDiagonal',{x:240,y:75},{x:272,y:115}],['oneULPFromAxis',{x:256+256*Number.EPSILON,y:75},{x:256+256*Number.EPSILON,y:95}],['tinyStart',{x:256,y:55},{x:256.01,y:55}],['nearSeam',{x:2,y:75},{x:2,y:95}]]){
  check('fallback-noncoincident-'+name+'-retains-every-distinct-reflection',()=>{const normal=fallback(from,to,false).flatMap(call=>call.paths),mirrored=fallback(from,to,true);assert.equal(mirrored.length,1);assert.equal(mirrored[0].paths.length,normal.length*2);for(let i=0;i<normal.length;i++){assert.deepEqual(mirrored[0].paths[i*2],normal[i]);const reflected=mirrored[0].paths[i*2+1];for(let j=0;j<2;j++){assert(Math.abs(reflected[j][0]-(512-normal[i][j][0]))<=1e-12);assert.equal(reflected[j][1],normal[i][j][1]);}}});
 }
 let dedupBaselineSHA256=null;
 if(process.argv[3]){
  const old=fs.readFileSync(path.resolve(process.argv[3]),'utf8');dedupBaselineSHA256=crypto.createHash('sha256').update(old).digest('hex');
  const cases=[[{x:80,y:50},{x:140,y:100}],[{x:256,y:75},{x:256,y:95}],[{x:236,y:100},{x:276,y:100}],[{x:0,y:75},{x:0,y:95}],[{x:512,y:75},{x:512,y:95}],[{x:502,y:100},{x:522,y:100}],[{x:2,y:75},{x:2,y:95}],[{x:1300,y:50},{x:1320,y:100}],[{x:-1300,y:50},{x:-1320,y:100}]];
  check('actual-pre-dedup-normal-native-commands-are-unchanged',()=>{for(const [from,to]of cases)assert.deepEqual(fallback(from,to,false),fallback(from,to,false,old));});
  const unique=strokes=>[...new Set(strokes.flatMap(call=>call.paths).map(p=>JSON.stringify([...p].sort((a,b)=>a[0]-b[0]||a[1]-b[1]))))].sort();
  check('actual-pre-dedup-and-new-mirror-have-the-same-unique-unoriented-geometry',()=>{for(const [from,to]of cases)assert.deepEqual(unique(fallback(from,to,true)),unique(fallback(from,to,true,old)));});
  check('actual-pre-dedup-reproduces-all-six-saved-axis-duplicates-and-new-commands-equal-normal',()=>{for(const [y,end]of [[55,75],[75,95],[95,115],[115,135],[135,155],[155,185]]){const from={x:256,y},to={x:256,y:end},prior=fallback(from,to,true,old),current=fallback(from,to,true);assert.equal(prior[0].paths.length,2);assert.deepEqual(prior[0].paths[0],prior[0].paths[1]);assert.deepEqual(current,fallback(from,to,false));}});
 }
 let baselineSourceSHA256=null;
 if(process.argv[2]){
  const old=fs.readFileSync(path.resolve(process.argv[2]),'utf8');baselineSourceSHA256=crypto.createHash('sha256').update(old).digest('hex');
  check('actual-baseline-body-reproduces-farwrap-hole-and-new-normal-fixes-it',()=>{const from={x:1300,y:50},to={x:1320,y:100};assert.equal(segmentHit(fallback(from,to,false,old),286,75),false);assert.equal(segmentHit(fallback(from,to,false),286,75),true);});
  check('actual-baseline-body-and-new-normal-have-equal-inrange-segment-coverage',()=>{for(const [from,to]of [[{x:0,y:50},{x:28,y:80}],[{x:490,y:50},{x:525,y:80}],[{x:200,y:50},{x:280,y:80}]]){const a=fallback(from,to,false,old),b=fallback(from,to,false);for(let y=30.3;y<110;y+=3)for(let x=.31;x<512;x+=2)assert.equal(segmentHit(a,x,y),segmentHit(b,x,y));}});
 }
 const head=Buffer.alloc(33);Buffer.from([137,80,78,71,13,10,26,10]).copy(head);head.writeUInt32BE(13,8);head.write('IHDR',12);head.writeUInt32BE(512,16);head.writeUInt32BE(256,20);head[24]=8;head[25]=6;
 const base={version:2,width:512,height:256,png:'data:image/png;base64,'+head.toString('base64'),tool:'brush',brushWidth:10,density:75,angle:0,glazed:false,shapeJSON:null};
 check('draft-legacy-v1-v2-absent-mirror-do-not-gain-a-result-key',()=>{for(const version of [1,2]){const parsed=draft.parsePaintDraft(JSON.stringify({...base,version}));assert(parsed);assert(!Object.hasOwn(parsed,'brushMirror'));assert(!Object.hasOwn(JSON.parse(draft.stringifyPaintDraft(parsed)),'brushMirror'));}});
 check('draft-v2-boolean-roundtrip-and-only-nondefault-serialization',()=>{for(const brushMirror of [true,false]){const input={...base,brushMirror},parsed=draft.parsePaintDraft(JSON.stringify(input));assert.equal(parsed.brushMirror,brushMirror);const raw=draft.stringifyPaintDraft(Object.freeze(input));assert.equal(Object.hasOwn(JSON.parse(raw),'brushMirror'),brushMirror);assert.equal(draft.parsePaintDraft(raw).brushMirror===true,brushMirror);}});
 check('draft-rejects-invalid-v2-metadata-without-coercion-and-keeps-v1-unknown-policy',()=>{for(const brushMirror of [null,0,1,'true','false',{},[]]){assert.equal(draft.parsePaintDraft(JSON.stringify({...base,brushMirror})),null);assert.throws(()=>draft.stringifyPaintDraft({...base,brushMirror}),/Invalid paint draft/);const old=draft.parsePaintDraft(JSON.stringify({...base,version:1,brushMirror}));assert(old);assert(!Object.hasOwn(old,'brushMirror'));}});
 if(process.argv[2]){
  const oldFile=path.join(path.dirname(path.resolve(process.argv[2])),'paint-draft.js'),oldDraft=await import('data:text/javascript;base64,'+fs.readFileSync(oldFile).toString('base64'));
  check('actual-R25-parser-ignores-new-preference-and-keeps-the-whole-PNG-and-existing-settings',()=>{const raw=draft.stringifyPaintDraft({...base,brushMirror:true}),old=oldDraft.parsePaintDraft(raw);assert.deepEqual(old,oldDraft.parsePaintDraft(JSON.stringify(base)));assert.equal(old.png,base.png);assert(!Object.hasOwn(old,'brushMirror'));});
 }
 function caller(naturalMode=false){
  const nodes=new Map(),events=[],canvas={setPointerCapture(){},releasePointerCapture(){}},preview={...canvas},draws=[],settings=[];
  const $=selector=>{if(!nodes.has(selector))nodes.set(selector,{value:'',hidden:false,setAttribute(){}});return nodes.get(selector);};
  for(const [name,value]of Object.entries({width:'10',density:'75',brushMirror:'mirror',motif:'flower',stampSize:'48',stampAngle:'0',stampRepeat:'1'}))$('[data-control="'+name+'"]').value=value;
  const natural={begin(p,s){settings.push(s);return true;},move(){return true;},finish(){return true;},dispose(){events.push('dispose');},breakSegment(){return true;}};
  const context={$,Uint8ClampedArray,restoring:false,suspended:false,active:true,stroke:null,tool:'brush',canvas,preview,naturalBrush:null,brushFactory:naturalMode?()=>natural:null,brushDisabled:false,
   inkRAF:null,inkDirty:false,textureDirty:false,root:{dataset:{},querySelectorAll:()=>[]},console:{warn(){}},stopGlaze(){},snapshot(){events.push('snapshot');return image();},drawBrush(...args){draws.push(args);},stamp(){events.push('stamp');},scheduleInk(){events.push('ink');},scheduleRender(){events.push('render');},flushSurface(){},surfacePointer:null,surfaceSamples:[],cancelAnimationFrame(){},queueDraft(){events.push('draft');},setStatus(){},renderFailed:false,t:{painted:'painted'},
   currentAngle:0,glazed:false,vase:{rotation:{y:0}},angle:{},cancelComposition(){events.push('cancel');},updateToolControls(){events.push('controls');},stableGlaze(){},labels:{hint:'stamp hint'},brushLabels:{hint:'brush hint'},compositionGroup:{},updateCompositionControls(){},updateStampSample(){},listen(node,event,fn){node[event]=fn;}};
  vm.createContext(context);for(const name of ['beginPaint','movePaint','fallbackInk','disableBrush','finishStroke','paintSettings','applyPaintSettings'])vm.runInContext(body(name),context);
  return {context,$,events,draws,settings,natural,run:code=>vm.runInContext(code,context)};
 }
 for(const source of ['flat','surface'])for(const naturalMode of [false,true])check('caller-'+source+'-'+(naturalMode?'natural':'fallback')+'-captures-mode-for-entire-one-history-stroke',()=>{
  const f=caller(naturalMode);f.context.beginPaint({x:90,y:60},{pointerId:1,pointerType:'pen'},source);assert.equal(f.context.stroke.owner,source==='surface'?f.context.preview:f.context.canvas);assert.equal(f.context.stroke.brushMirror,true);f.$('[data-control="brushMirror"]').value='none';f.context.movePaint({x:110,y:90});assert.equal(f.context.stroke.brushMirror,true);if(naturalMode)assert.equal(f.settings[0].brushMirror,true);else assert(f.draws.every(args=>args[4]===true));f.context.finishStroke();assert.equal(f.context.stroke,null);assert.equal(f.events.filter(v=>v==='snapshot').length,1);assert.equal(f.events.filter(v=>v==='draft').length,1);
 });
 for(const failure of ['begin','move','finish'])check('caller-natural-'+failure+'-failure-keeps-mirrored-classic-fallback',()=>{const f=caller(true);f.natural[failure]=()=>{throw Error('controlled brush failure');};f.context.beginPaint({x:256,y:60},{pointerId:1},'surface');if(failure==='move')f.context.movePaint({x:270,y:90});f.context.finishStroke();assert(f.draws.length>0);assert(f.draws.every(args=>args[4]===true));assert.equal(f.context.root.dataset.brush,'classic');assert.equal(f.events.filter(v=>v==='snapshot').length,1);});
 check('caller-mode-input-finishes-old-captured-stroke-before-settings-save-and-adds-no-history',()=>{
  const f=caller(false),control=f.$('[data-control="brushMirror"]');f.context.root.querySelectorAll=()=>[control];const line=studio.split(/\r?\n/).find(s=>s.includes("for(const control of root.querySelectorAll(")&&s.includes('brushMirror'));assert(line);vm.runInContext(line,f.context);
  f.context.beginPaint({x:80,y:60},{pointerId:1},'flat');control.value='none';control.input();assert.equal(f.context.stroke,null);assert.equal(f.events.filter(v=>v==='snapshot').length,1);assert(f.events.lastIndexOf('controls')>f.events.indexOf('draft'));const count=f.events.length;f.context.restoring=true;control.input();assert.equal(f.events.length,count);
 });
 check('caller-settings-restore-default-off-and-rollback-snapshot-preserve-explicit-mode',()=>{const f=caller();assert.equal(f.context.paintSettings().brushMirror,true);f.context.applyPaintSettings({...base,brushMirror:false});assert.equal(f.$('[data-control="brushMirror"]').value,'none');f.context.applyPaintSettings({...base,brushMirror:true});assert.equal(f.$('[data-control="brushMirror"]').value,'mirror');f.context.applyPaintSettings(base);assert.equal(f.$('[data-control="brushMirror"]').value,'none');});
 check('caller-tool-switch-hides-brush-only-field-and-keeps-preference-for-return',()=>{const f=caller();vm.runInContext(body('updateToolControls'),f.context);f.context.updateToolControls();assert.equal(f.$('[data-brush-mirror-field]').hidden,false);assert.equal(f.$('[data-testid="paintToolHint"]').textContent,'brush hint');f.context.tool='flower';f.context.updateToolControls();assert.equal(f.$('[data-brush-mirror-field]').hidden,true);assert.equal(f.$('[data-control="brushMirror"]').value,'mirror');assert.equal(f.$('[data-testid="paintToolHint"]').textContent,'stamp hint');});
 delete global.document;
 console.log(JSON.stringify({status:'passed',checks:checks.length,cases:checks,studioFile,baselineSourceSHA256,dedupBaselineSHA256,sourceSHA256:Object.fromEntries(['paint-studio.js','cobalt-brush.js','paint-draft.js'].map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(file==='paint-studio.js'?studioFile:path.join(root,'enhancements',file))).digest('hex')])),scope:'Actual getStroke and brush modules; nonzero polygon membership and segment geometry, one-alpha composition calls, draft schema and extracted studio callers with recording Canvas/DOM. No native raster, browser, GPU, physical stylus calibration or real-device claim.'},null,2));
})().catch(error=>{delete global.document;console.error(error);process.exitCode=1;});
