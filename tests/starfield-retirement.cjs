'use strict';
// Actual host catch blocks plus actual context cleanup; controlled shader core, DOM and renderer.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),experience=fs.readFileSync(path.join(root,'enhancements/experience.js'),'utf8'),controller=fs.readFileSync(path.join(root,'enhancements/starfield-experience.js'),'utf8');
function block(marker){const at=experience.indexOf(marker);assert(at>=0,marker);const start=experience.indexOf('{',at);let depth=1,end=start+1;for(;depth;end++){assert(end<experience.length);if(experience[end]==='{')depth++;else if(experience[end]==='}')depth--;}return experience.slice(at,end);}
const update=block('function updateBackground('),render=block('renderBackground(){'),owns=experience.split(/\r?\n/).find(line=>line.includes('get ownsCamera(){')).trim().replace(/,$/,'');assert(owns);
(async()=>{
 const THREE=await import(pathToFileURL(path.join(root,'vendor/three.module.js'))),checks=[];
 for(const phase of ['update','render'])for(const closeThrows of [false,true])for(const disposeThrows of [false,true]){
  const f=require('./starfield-host-fixture.cjs').fixture(THREE,controller),events=[],warnings=[],failure=Error('Injected '+phase+' failure');let returns=0;
  await f.api.open({onReturn(reason){events.push('return');returns++;assert.equal(reason,'return');}});const core=f.cores[0],pause=f.action('pause'),plunge=f.action('plunge'),sync=core.sync;
  core.sync=function(){assert.equal(this.disposals,0,'A stale context accessed the retired shared core');return sync.call(this);};
  const starfield={get active(){return f.api.active;},get frameState(){return f.api.frameState;},close(reason){events.push('close');assert.equal(reason,'error');assert.equal(core.disposals,0);f.api.close(reason);if(closeThrows)throw Error('Injected close wrapper failure after actual cleanup');}};
  const background={core,update(){events.push('fault');throw failure;},render(){events.push('fault');throw failure;},dispose(){events.push('dispose');assert.equal(f.api.active,false,'Context must leave before its borrowed core retires');assert.equal(returns,1);assert.equal(f.orbits[0].disposals,1);f.background.dispose();if(disposeThrows)throw Error('Injected background disposal wrapper failure');}};
  const context=vm.createContext({starfield,background,travel:{active:false},disposed:false,backgroundFailed:false,backgroundContextLost:false,backgroundPageHidden:false,document:{hidden:false},gesture:{active:false},console:{warn(...args){warnings.push(args);}}});
  vm.runInContext(update+'\nthis.api={'+render+','+owns+'};this.update=updateBackground;this.state=()=>({background,failed:backgroundFailed});',context);
  assert.equal(context.api.ownsCamera,true);if(phase==='update')assert.doesNotThrow(()=>context.update(.016));else assert.equal(context.api.renderBackground(),false);
  assert.deepEqual(events,['fault','close','return','dispose']);assert.equal(context.api.ownsCamera,false);assert.equal(f.api.active,false);assert.equal(f.api.frameState,null);assert.equal(returns,1);assert.equal(core.disposals,1);assert.equal(context.state().background,null);assert.equal(context.state().failed,true);assert(warnings.some(args=>args.includes(failure)),'Original background failure remains reported');
  if(closeThrows)assert(warnings.some(args=>String(args[0]).includes('context return')),'Escaping close failures are reported separately');
  const params={...core.params},count=events.length;assert.doesNotThrow(()=>{pause.click();plunge.click();context.update(.016);context.api.renderBackground();});assert.deepEqual(core.params,params);assert.equal(events.length,count,'Retired owner cannot draw or dispose twice');assert.equal(f.canvas.parentNode,f.doc.body);assert.equal(f.doc.body.children.some(node=>node.id==='museumStarfieldOverlay'),false);
  checks.push(phase+'-fault-closeThrows='+closeThrows+'-disposeThrows='+disposeThrows);
 }
 console.log(JSON.stringify({status:'passed',checks:checks.length,cases:checks,scope:'Actual experience catch blocks, ownsCamera getter, context controller close/listeners and background disposal; CPU controlled core/DOM, no GPU.'},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
