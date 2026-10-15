const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(process.argv[2]||path.resolve(__dirname,'../enhancements/experience.js'),'utf8');
const start=source.indexOf('const tapPointers='),end=source.indexOf('const initialPosition=');
assert(start>=0&&end>start,'Hotspot pointer handlers not found');
const handlers={},canvas={},rect=(left,top,right,bottom)=>({left,top,right,bottom});
let opened=[];
const button=(id,box,label)=>({id,hidden:false,getBoundingClientRect:()=>box,querySelector:()=>({getBoundingClientRect:()=>label}),click(){opened.push(id);}});
const right=button('right',rect(100,100,144,144),rect(138,109,268,137));
const left=button('left',rect(300,200,344,244),rect(156,209,306,237));
const ui={buttons:[right,left],hotspotsOn:true,panel:null};
vm.runInNewContext(source.slice(start,end),{Map,Math,ui,renderer:{domElement:canvas},listen(node,type,handler){assert.equal(node,canvas);handlers[type]=handler;}});
function event(type,x,y,extra={}){handlers[type]({pointerId:1,clientX:x,clientY:y,isTrusted:true,button:0,...extra});}
function tap(x,y){opened=[];event('pointerdown',x,y);event('pointerup',x,y);handlers.click();return opened;}
for(const [id,x,y] of [['right',122,122],['right',200,123],['right',267,136],['left',322,222],['left',157,210],['left',230,223]])assert.deepEqual(tap(x,y),[id]);
assert.deepEqual(tap(270,123),[],'Outside both rectangles must not activate');
right.hidden=true;assert.deepEqual(tap(200,123),[]);right.hidden=false;
ui.hotspotsOn=false;assert.deepEqual(tap(200,123),[]);ui.hotspotsOn=true;
ui.panel='explore';assert.deepEqual(tap(200,123),[]);ui.panel=null;
opened=[];event('pointerdown',190,123);event('pointermove',200,123);event('pointerup',200,123);handlers.click();assert.deepEqual(opened,[],'Dragging must not activate');
opened=[];event('pointerdown',200,123);event('pointerdown',230,123,{pointerId:2});event('pointerup',230,123,{pointerId:2});event('pointerup',200,123);handlers.click();assert.deepEqual(opened,[],'Pinching must not activate');
opened=[];event('pointerdown',200,123);event('pointercancel',200,123);event('pointerup',200,123);handlers.click();assert.deepEqual(opened,[]);
opened=[];event('pointerdown',200,123,{isTrusted:false});event('pointerup',200,123);handlers.click();assert.deepEqual(opened,[],'Synthetic reconnect must not activate');
opened=[];event('pointerdown',200,123);event('pointerup',200,123);right.hidden=true;handlers.click();assert.deepEqual(opened,[],'A hidden target must not activate a pending click');right.hidden=false;
assert.deepEqual(tap(200,123),['right'],'A fresh tap must recover after cancelled gestures');
console.log('Hotspot dot/label hit areas and gesture guards pass');
