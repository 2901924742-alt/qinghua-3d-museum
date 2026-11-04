'use strict';
// Actual profile/poster functions and dense CPU pottery model. No native Canvas/PNG/GPU claim.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {pathToFileURL}=require('node:url'),{createHash}=require('node:crypto');
const sourceRoot=path.resolve(__dirname,'..'),sourceFile=path.resolve(process.argv[2]||path.join(sourceRoot,'enhancements/pottery-studio.js')),source=fs.readFileSync(sourceFile,'utf8');
const checks=[],failures=[];
function declaration(name){
 const start=source.indexOf(' function '+name+'(');assert(start>=0,'Missing actual function '+name);const eol=source.indexOf('\n',start),first=source.slice(start,eol).trim();if(first.endsWith('}'))return first;const close=/^ \}/m.exec(source.slice(eol));assert(close);return source.slice(start,eol+close.index+close[0].length).trim();
}
const posterRegistration=/^  listen\(poster,'click',async\(\)=>\{[\s\S]*?^  \}\);/m.exec(source)?.[0];assert(posterRegistration,'Use the actual PNG listener');
const labels=source.slice(source.indexOf('const words='),source.indexOf('export function mountPottery'));
function recorder(){
 const ctx={ops:[],path:[],dash:[],strokeStyle:'',fillStyle:'',lineWidth:1,font:'',stack:[]};
 ctx.fillRect=function(...args){this.ops=[];this.ops.push({name:'fillRect',args});};
 ctx.beginPath=function(){this.path=[];};for(const name of ['moveTo','lineTo'])ctx[name]=function(...args){this.path.push([name,...args]);};
 ctx.arc=function(...args){this.path.push(['arc',...args]);this.ops.push({name:'arc',args});};
 ctx.setLineDash=function(value){this.dash=Array.from(value);};
 ctx.stroke=function(){this.ops.push({name:'stroke',color:this.strokeStyle,width:this.lineWidth,dash:[...this.dash],path:structuredClone(this.path)});};
 ctx.fill=function(){this.ops.push({name:'fill',color:this.fillStyle,path:structuredClone(this.path)});};
 ctx.strokeRect=function(...args){this.ops.push({name:'strokeRect',args});};
 ctx.fillText=function(text,x,y,maxWidth){this.ops.push({name:'text',text:String(text),x,y,maxWidth,font:this.font,color:this.fillStyle});};
 ctx.save=function(){this.stack.push({strokeStyle:this.strokeStyle,lineWidth:this.lineWidth,dash:[...this.dash]});};ctx.restore=function(){Object.assign(this,this.stack.pop());};
 ctx.drawImage=function(node,...args){if(this.failCopy===node.id)throw Error('controlled copy failure');this.ops.push({name:'copy',source:node.id,args,drawing:structuredClone(node.ctx.ops)});};return ctx;
}
(async()=>{
 const THREE=await import(pathToFileURL(path.join(sourceRoot,'vendor/three.module.js'))),{createPotteryModel}=await import(pathToFileURL(path.join(sourceRoot,'enhancements/pottery-model.js')));
 const stationSets=[48,64].map(count=>new Set(Array.from({length:count},(_,j)=>Math.round(j/(count-1)*167)))),peak=Array.from({length:168},(_,i)=>i).find(i=>i>20&&i<147&&stationSets.every(set=>!set.has(i)));assert(Number.isInteger(peak));
 function fixture({language='zh',mobile=false,view='front',cut='55',failCopy=null}={}){
  const model=createPotteryModel({THREE,mobile,preset:'jar'}),doc=JSON.parse(model.serialize());doc.arrays.ro[peak]=14.75;doc.arrays.ox[peak]=1.25;assert(model.restore(JSON.stringify(doc)));const p=model.getProfile(),before=model.serialize();
  let expectedHeight=0;for(let i=0;i<168;i++)expectedHeight+=Math.fround(Math.max(.0005,Math.min(4,doc.arrays.V[i]/(Math.PI*(doc.arrays.ro[i]**2-doc.arrays.ri[i]**2)))));assert(Math.abs(p.height-expectedHeight)<1e-10);assert.equal(p.maxR,14.75);assert(Math.max(...p.outer.map(point=>point[0]))<p.maxR,'Dense radius peak deliberately falls between both sampling grids');assert.notEqual((p.outer.at(-1)[1]-p.outer[0][1]).toFixed(2),p.height.toFixed(2));
  const nodes=new Map(),$=key=>{if(!nodes.has(key))nodes.set(key,{textContent:'',hidden:false,disabled:false,value:''});return nodes.get(key);},profile={id:'profile',width:512,height:512,ctx:recorder()},preview={id:'preview',ctx:recorder()},poster={disabled:false},posterImage={hidden:true},sheets=[],blobs=[],urls=new Set(),revoked=[];
  const guide={outer:[[2,0],[5,10],[3,20]],minY:0,height:20,maxR:5},context=vm.createContext({model,ctx:profile.ctx,profile,preview,poster,posterImage,$,radius:{value:''},preset:{value:''},referenceReadout:{hidden:false,textContent:''},references:new Map([['jar',guide]]),referenceKind:'jar',sectionHeight:{value:cut},Math,
   listen(node,event,callback){node[event]=callback;},finishEdit(){},finishRotation(){},clearTimeout(){},console:{warn(){}},
   document:{createElement(type){assert.equal(type,'canvas');const sheet={id:'sheet',width:0,height:0,ctx:recorder(),getContext(){return this.ctx;},toBlob(callback,type){assert.equal(type,'image/png');blobs.push(callback);}};sheet.ctx.failCopy=failCopy;sheets.push(sheet);return sheet;}},
   URL:{createObjectURL(){const url='blob:poster-'+(urls.size+1);urls.add(url);return url;},revokeObjectURL(url){urls.delete(url);revoked.push(url);}},
   render(){vm.runInContext('drawProfile()',context);return true;}});
  vm.runInContext(labels+';this.t={...words['+JSON.stringify(language)+'],...sectionWords['+JSON.stringify(language)+'],...referenceWords['+JSON.stringify(language)+'],...(typeof posterWords===\'undefined\'?{}:posterWords['+JSON.stringify(language)+'])};',context);
  vm.runInContext("let selected=.5,frame=null,edit=null,active=true,generation=0,renderTimer=null,renderFailed=false,contextUnavailable=false,posterJobToken=null,pngURL=null;let view="+JSON.stringify(view)+";const say=text=>{this.message=text;};"+['updatePosterControls','mapping','radiusAt','point','selection','updateHistory','updateControls','drawProfile'].map(declaration).join('\n')+'\n'+posterRegistration,context,{filename:sourceFile});
  return {model,p,before,context,profile,poster,posterImage,sheets,blobs,urls,revoked,$,run:code=>vm.runInContext(code,context),close(){model.dispose();}};
 }
 async function check(name,options,test){const f=fixture(options);try{await test(f);checks.push(name);}catch(error){failures.push({name,error:String(error),stack:error.stack});}finally{f.close();}}
 const arcs=ops=>ops.filter(op=>op.name==='arc'),walls=ops=>ops.filter(op=>op.name==='stroke'&&['#bddfff','#6fa6d0'].includes(op.color));
 for(const mobile of [false,true])await check('actual-dense-values-'+(mobile?'mobile48':'desktop64'),{mobile},f=>{assert.equal(f.p.outer.length,mobile?48:64);assert.equal(f.p.inner.length,f.p.outer.length);assert.equal(f.model.serialize(),f.before);});
 for(const language of ['zh','en']){
  await check(language+'-clean-export-profile-and-independent-default-ui', {language},f=>{
   f.run('drawProfile()');assert.equal(arcs(f.profile.ctx.ops).length,2);assert(f.profile.ctx.ops.some(op=>op.color==='#69e5cf'));
   f.run('drawProfile(false,false)');const clean=structuredClone(f.profile.ctx.ops);assert.equal(arcs(clean).length,0,'Artwork profile must exclude selected control circles');assert(!clean.some(op=>op.color==='#88c9ff77'||op.color==='#69e5cf'));assert.equal(walls(clean).length,4);
   f.run('selected=.94;drawProfile(false,false)');assert.deepEqual(f.profile.ctx.ops,clean,'Changing only the edit selection must not change an exported profile');
   f.run('drawProfile(true,false)');assert.equal(arcs(f.profile.ctx.ops).length,0);assert(f.profile.ctx.ops.some(op=>op.color==='#69e5cf'));f.run('drawProfile()');assert.equal(arcs(f.profile.ctx.ops).length,2);assert.equal(f.model.serialize(),f.before);
  });
  for(const [view,cut,expected]of [['front','55',null],['section','10',10],['section','55',55],['section','90',90],['section','1',10],['section','99',90]])await check(language+'-poster-'+view+'-'+cut,{language,view,cut,mobile:cut==='90'},async f=>{
   const done=f.poster.click();assert.equal(f.blobs.length,1,'The actual PNG action must reach its existing asynchronous encoder');const sheet=f.sheets[0],copy=sheet.ctx.ops.find(op=>op.name==='copy'&&op.source==='profile');assert(copy);assert.equal(arcs(copy.drawing).length,0);assert.equal(walls(copy.drawing).length,4);assert.equal(arcs(f.profile.ctx.ops).length,2,'The visible UI is restored before encoding finishes');assert.equal(f.context.referenceReadout.hidden,false);
   assert.equal(sheet.width,1280);assert.equal(sheet.height,900);const text=sheet.ctx.ops.filter(op=>op.name==='text').map(op=>op.text);assert(text.some(value=>value.includes(f.p.height.toFixed(2))&&/H/.test(value)));assert(text.some(value=>value.includes('14.75')&&/Rmax/.test(value)),'Metadata uses the full dense radius, not the sampled maximum');assert(text.some(value=>/外轮廓|Outer profile/.test(value)));assert(text.some(value=>/内轮廓|Inner profile/.test(value)));assert(text.some(value=>/采样|Sampled/.test(value)));assert(text.some(value=>/非文物实测|Not a measurement/.test(value)));
   if(expected!==null)assert(text.some(value=>value.includes(expected+'%')&&/模型底部|model base/.test(value)));else assert(!text.some(value=>/\d+%/.test(value)),'Full view must not inherit a stale section caption');
   f.blobs.shift()({type:'image/png'});await done;assert.equal(f.urls.size,1);assert.equal(sheet.width,0);assert.equal(sheet.height,0);assert.equal(f.poster.disabled,false);assert.equal(f.model.serialize(),f.before,'Export must preserve the full editable design');
  });
  for(const failCopy of ['profile','preview'])await check(language+'-copy-failure-restores-ui-'+failCopy,{language,failCopy},async f=>{
   f.run('drawProfile()');const ui=structuredClone(f.profile.ctx.ops);await f.poster.click();assert.equal(f.blobs.length,0);assert.equal(f.urls.size,0);assert.equal(f.poster.disabled,false);assert.deepEqual(f.profile.ctx.ops,ui,'Even an export draw failure must restore UI reference and selection');assert.equal(f.context.message,f.context.t.posterFailed);assert.equal(f.model.serialize(),f.before);
  });
  await check(language+'-late-encoding-retains-fixed-metadata-and-token-guard',{language,view:'section',cut:'55'},async f=>{
   const done=f.poster.click(),text=structuredClone(f.sheets[0].ctx.ops);f.run('generation++;selected=.94;sectionHeight.value="90";');f.blobs.shift()({type:'image/png'});await done;assert.equal(f.urls.size,0,'A stale encode cannot publish a new download');assert.deepEqual(f.sheets[0].ctx.ops,text,'Metadata was fixed before the encoder await');assert.equal(f.poster.disabled,false);assert.equal(f.model.serialize(),f.before);
  });
 }
 console.log(JSON.stringify({status:failures.length?'failed':'passed',checks:checks.length,failures,sourceSHA256:createHash('sha256').update(source).digest('hex'),densePeakStation:peak,scope:'Actual extracted profile/poster code, actual vendored CPU model/dense168-station values; Canvas commands, DOM and PNG encoder are controlled stubs. No native raster, real PNG/browser/GPU or text-layout pass.',cases:checks},null,2));if(failures.length)process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1;});
