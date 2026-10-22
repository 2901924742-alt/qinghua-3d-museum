const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(path.resolve(__dirname,'../index.html'),'utf8');
const source=html.slice(html.indexOf('const exhibitKeys ='),html.indexOf('let modelLoadStopped=false'));
function fixture(){
 let task,listener,disposed=0,parses=0;const warmed=[],loaded=[],model={},cache={forget(url){this.forgotten=url;},warm:url=>warmed.push(url),cancelWarm(){this.cancelled=true;},load:async url=>{loaded.push(url);return new ArrayBuffer(1);}};
 const gallery={dataset:{exhibit:'original'},getAttribute:()=> 'false'},loading={style:{display:'none'}};
 const context={DOMException,console,navigator:{onLine:true},document:{hidden:false,body:{matches:()=>false},getElementById:id=>id==='loading'?loading:gallery,addEventListener:(type,fn)=>{listener=fn;}},setTimeout:fn=>{task=fn;return 1;},clearTimeout:()=>{task=null;},createExhibitCache:({urls})=>{assert.equal(urls.length,4);return cache;},loader:{parseAsync:async()=>{parses++;return{scene:model};}},THREE:{},addInterior:()=>({ready:Promise.resolve()}),prepareExhibit:value=>value,disposeExhibit:()=>{disposed++;}};
 vm.createContext(context);vm.runInContext(source,context);
 return {context,cache,warmed,loaded,gallery,loading,model,get disposed(){return disposed;},get parses(){return parses;},run(){assert(task);const fn=task;task=null;fn();},visibility(){listener();}};
}
(async()=>{
 for(const block of [()=>{},f=>f.context.document.hidden=true,f=>f.context.navigator.onLine=false,f=>f.context.navigator.connection={saveData:true},f=>f.context.navigator.connection={effectiveType:'slow-2g'},f=>f.context.navigator.connection={effectiveType:'2g'},f=>f.context.navigator.connection={effectiveType:'3g'},f=>f.loading.style.display='block',f=>f.context.document.body.matches=()=>true,f=>f.gallery.getAttribute=()=> 'true']){
  const f=fixture();block(f);f.context.queueNextExhibit();f.run();assert.equal(f.warmed.length,block.toString()==='()=>{}'?1:0);
 }
 const f=fixture();f.context.navigator.connection={effectiveType:'4g'};f.gallery.dataset.exhibit='vase-191';f.context.queueNextExhibit();f.run();assert.deepEqual(f.warmed,['./qinghuaci.glb']);
 f.context.document.hidden=true;f.visibility();assert(f.cache.cancelled);f.context.document.hidden=false;f.visibility();f.run();assert.equal(f.warmed.length,2);
 const signal={aborted:false};assert.equal(await f.context.loadExhibit('./qinghuaci.glb',signal),f.model);assert.equal(f.parses,1);
 signal.aborted=true;await assert.rejects(f.context.loadExhibit('./qinghuaci.glb',signal),{name:'AbortError'});assert.equal(f.parses,1);
 const late=fixture(),abort={aborted:false};late.context.loader.parseAsync=async()=>{abort.aborted=true;return{scene:late.model};};await assert.rejects(late.context.loadExhibit('./qinghuaci.glb',abort),{name:'AbortError'});assert.equal(late.disposed,1);
 const broken=fixture();broken.context.addInterior=()=>({ready:Promise.reject(new Error('Interior failure'))});await assert.rejects(broken.context.loadExhibit('./qinghuaci.glb',{aborted:false}),/Interior failure/);assert.equal(broken.disposed,1);
 const bad=fixture();bad.context.loader.parseAsync=async()=>{throw new Error('Invalid GLB');};await assert.rejects(bad.context.loadExhibit('./qinghuaci.glb',{aborted:false}),/Invalid GLB/);assert.equal(bad.cache.forgotten,'./qinghuaci.glb');assert.equal(bad.disposed,0);bad.run();assert.equal(bad.warmed.length,1);
 const busy=fixture();busy.context.document.body.matches=()=>true;busy.context.queueNextExhibit();busy.run();assert.equal(busy.warmed.length,0);busy.context.document.body.matches=()=>false;busy.run();assert.equal(busy.warmed.length,1);
 console.log('Exhibit loading: idle/connection/background guards, wraparound, legacy abort and late-parser disposal pass');
})().catch(e=>{console.error(e);process.exitCode=1;});
