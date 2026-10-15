const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const pw=require('playwright');
const root=path.resolve(__dirname,'..'),index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const handlers=index.slice(index.indexOf('const infoBox = document.getElementById("infoBox");'),index.indexOf('// Optional enhancements cannot prevent the original museum from loading.'));
assert(handlers.startsWith('const infoBox ='),'Information-card handlers not found');
const fixture=index.split('<script>')[0]+`<script type="module">
 import {createUI} from './enhancements/ui.js';document.getElementById('loading').style.display='none';
 ${handlers}
 const controls={enabled:true,autoRotate:true},canvas=()=>{const c=document.createElement('canvas');c.width=c.height=128;return c;};
 const ui=createUI({controls,hideInfo,restoreInfo,cancelIntro(){},capture:canvas,unwrap:canvas,switchExhibit(){}});
 window.fixture={ui,controls,hideInfo,restoreInfo};window.__ready=true;
 </script></body></html>`;
const server=http.createServer((req,res)=>{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1)||'index.html',file=path.resolve(root,name);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':{'.html':'text/html','.css':'text/css','.js':'text/javascript'}[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(name==='index.html'?fixture:fs.readFileSync(file));});
const active=page=>page.evaluate(()=>document.activeElement?.id),viewing=page=>page.locator('body').evaluate(n=>n.classList.contains('museum-viewing'));
const state=page=>page.evaluate(()=>{const n=document.getElementById('infoBox');return {infoHidden:n.classList.contains('hide'),inert:n.inert,ariaHidden:n.getAttribute('aria-hidden'),enabled:fixture.controls.enabled,autoRotate:fixture.controls.autoRotate};});
async function explore(page,mobile){if(mobile){await page.locator('#museumMore').click();await page.locator('#menuExplore').click();}else await page.locator('#museumExplore').click();}
(async()=>{let browser,count=0;const errors=[];await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));try{
 browser=process.argv.includes('--webkit')?await pw.webkit.launch({headless:true}):await pw.chromium.launch({channel:'msedge',headless:true,args:['--disable-gpu']});
 for(const mobile of [false,true]){
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:900},hasTouch:mobile,isMobile:mobile}),page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));
  await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.__ready);assert(await page.locator('#museumReturn').isHidden());assert.equal(await page.locator('#museumView').count(),1);assert(await page.locator('#museumView').isVisible());
  for(const hidden of [false,true])for(const hotspots of [false,true])for(const exit of ['button','Escape']){
   await page.evaluate(hidden=>hidden?fixture.hideInfo():fixture.restoreInfo(),hidden);const before=await state(page);
   await explore(page,mobile);assert.equal(await page.locator('#museumView').count(),1);if(!hotspots)await page.evaluate(()=>fixture.ui.hideHotspots());await page.locator('#museumClose').click();await page.locator('#museumView').click();
   assert(await viewing(page));assert.deepEqual(await state(page),before);assert.equal(await page.evaluate(()=>fixture.ui.hotspotsOn),false);assert.equal(await page.evaluate(()=>fixture.ui.panel),null);
   assert.equal(await active(page),'museumReturn');assert(await page.locator('#museumReturn').isVisible());const button=await page.locator('#museumReturn').boundingBox();assert(button.width>=44&&button.height>=44);
   for(const selector of ['.title','.sub','.info','.tip','#restoreBtn','#museumView','.museum-tools','.museum-gallery','#resetViewBtn','.hotspots'])assert.equal(await page.locator(selector).isVisible(),false,selector+' visible during viewing');
   await page.keyboard.press('Tab');assert(['museumReturn',''].includes(await active(page)),'Hidden UI received focus');
   if(exit==='button')await page.locator('#museumReturn').click();else await page.keyboard.press('Escape');
   assert.equal(await viewing(page),false);assert(await page.locator('#museumReturn').isHidden());assert.deepEqual(await state(page),before);assert.equal(await page.evaluate(()=>fixture.ui.hotspotsOn),hotspots);assert.equal(await active(page),'museumView');count++;
  }
  await page.locator('#museumLanguage').click();assert.equal(await page.locator('#museumView').textContent(),'View artwork');await page.locator('#museumView').click();assert.equal(await page.locator('#museumReturn').textContent(),'Return to museum');await page.keyboard.press('Escape');
  for(const action of ['open','setExhibit','dispose']){
   await page.locator('#museumView').click();
   if(action==='open'){await page.locator('#museumExplore').evaluate(n=>n.click());assert.equal(await page.evaluate(()=>fixture.ui.panel),'explore');await page.locator('#museumClose').click();}
   else if(action==='setExhibit')await page.evaluate(()=>fixture.ui.setExhibit(1));else await page.evaluate(()=>fixture.ui.dispose());
   assert.equal(await viewing(page),false);if(action==='dispose'){assert.equal(await page.locator('#museumView').count(),0);assert.equal(await page.locator('#museumReturn').count(),0);await page.evaluate(()=>document.body.classList.add('museum-viewing'));await page.keyboard.press('Escape');assert(await viewing(page),'Disposed Escape listener still active');await page.evaluate(()=>document.body.classList.remove('museum-viewing'));}else assert(await page.locator('#museumReturn').isHidden());
  }
  await context.close();
 }
 assert.deepEqual(errors,[]);console.log('Viewing mode: '+count+' introduction/hotspot/exit combinations, bilingual labels, focus and lifecycle checks pass');
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1});
