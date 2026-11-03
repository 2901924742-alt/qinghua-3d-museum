'use strict';
// Exercise the actual loader body with a deferred module and virtual timers; no network or GPU.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.resolve(process.argv[2]||path.join(__dirname,'../enhancements/paint-studio.js')),'utf8');
const start=source.indexOf(' function loadGLBExporter(job){'),end=source.indexOf('\n function updateHistory()',start);
assert(start>=0&&end>start,'Actual exporter loader must exist');
const original=source.slice(start,end),specifier="import('../vendor/three-exporter/examples/jsm/exporters/GLTFExporter.js')";
assert.equal(original.split(specifier).length,2,'Replace only the module transport');
const body=original.replace(specifier,'load()');
function harness(){
 let resolve,reject,id=0;const timers=new Map(),message={textContent:'preparing'};
 const loaded=new Promise((yes,no)=>{resolve=yes;reject=no;});
 const context={Promise,Error,active:true,glbToken:1,t:{glbLoading:'still loading'},$:()=>message,load:()=>loaded,
  setTimeout(fn,ms){const key=++id;timers.set(key,{fn,ms});return key;},clearTimeout(key){timers.delete(key);}};
 const load=vm.runInNewContext(body+'\nloadGLBExporter',context);
 return {context,timers,message,resolve,reject,load,tick(){for(const [key,timer]of [...timers])if(timer.ms===4000){timers.delete(key);timer.fn();}}};
}
const settle=async()=>{for(let i=0;i<5;i++)await Promise.resolve();};
(async()=>{
 const slow=harness(),job={token:1,cancelled:false};let state='pending';
 const pending=slow.load(job);pending.then(()=>{state='resolved';},()=>{state='rejected';});
 slow.tick();await settle();assert.equal(state,'pending','A slow valid import must not become a false failure at four seconds');
 assert.equal(slow.message.textContent,'still loading');
 const module={GLTFExporter:class{}};slow.resolve(module);assert.equal(await pending,module);await settle();assert.equal(state,'resolved');assert.equal(job.cancelLoad,null);assert.equal(slow.timers.size,0);

 const failed=harness(),badJob={token:1,cancelled:false},bad=failed.load(badJob),reason=new Error('real transport failure');
 failed.reject(reason);await assert.rejects(bad,error=>error===reason);assert.equal(badJob.cancelLoad,null);assert.equal(failed.timers.size,0);

 const cancelled=harness(),oldJob={token:1,cancelled:false};let settlements=0;
 const old=cancelled.load(oldJob);old.then(()=>settlements++,()=>settlements++);oldJob.cancelLoad();
 await assert.rejects(old,/Artwork export cancelled/);cancelled.resolve(module);cancelled.tick();await settle();
 assert.equal(settlements,1,'Late module cannot revive cancelled export');assert.equal(oldJob.cancelLoad,null);assert.equal(cancelled.timers.size,0);

 for(const stale of ['closed','changed','cancelled']){
  const h=harness(),j={token:1,cancelled:false},p=h.load(j);p.catch(()=>{});
  if(stale==='closed')h.context.active=false;else if(stale==='changed')h.context.glbToken=2;else j.cancelled=true;
  h.tick();assert.equal(h.message.textContent,'preparing','Stale soft timer must not touch current UI');j.cancelLoad();await assert.rejects(p,/cancelled/);assert.equal(h.timers.size,0);
 }
 console.log('PASS: slow exporter resolves, real errors reject, cancellation owns late results, stale UI is untouched.');
})().catch(error=>{console.error(error);process.exitCode=1;});
