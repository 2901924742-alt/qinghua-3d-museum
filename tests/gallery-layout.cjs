const pw=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),output=process.env.MUSEUM_QA_OUTPUT||path.resolve(root,'../outputs/museum-layout');fs.mkdirSync(output,{recursive:true});
(async()=>{const url=process.argv[2];assert(url);const webkit=process.argv.includes('--webkit'),tag=webkit?'layout-preview-webkit':'layout-preview';const browser=webkit?await pw.webkit.launch({headless:true}):await pw.chromium.launch({channel:'msedge',headless:true});const results=[];
 try{const context=await browser.newContext({viewport:{width:430,height:932},deviceScaleFactor:3,isMobile:true,hasTouch:true}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(url);await page.waitForFunction(()=>window.museumEnhancements&&document.getElementById('loading').style.display==='none');await page.waitForFunction(()=>!museumEnhancements.introActive);
  for(const size of [{width:430,height:932},{width:390,height:844},{width:360,height:740},{width:320,height:568},{width:844,height:390}]){
   await page.setViewportSize(size);for(const language of ['zh-CN','en']){
    if(await page.locator('html').getAttribute('lang')!==language)await page.locator('#museumLanguage').click();
    const r=await page.evaluate(()=>{const rect=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom}};return {nav:rect(document.getElementById('museumGallery')),info:rect(document.getElementById('infoBox'))}});
    assert(r.nav.left>=0&&r.nav.right<=size.width);assert(r.nav.bottom<=r.info.top||r.nav.left>=r.info.right||r.nav.right<=r.info.left,JSON.stringify({size,language,r}));
    const targets=await page.evaluate(()=>['museumPrevious','museumNext','museumLanguage','resetViewBtn','museumMore','museumView'].map(id=>{
     const button=document.getElementById(id),r=button.getBoundingClientRect();return {id,x:r.x,y:r.y,width:r.width,height:r.height,hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')?.id};
    }));
    for(const b of targets){assert(b.width>=44);assert(b.height>=44);assert.equal(b.hit,b.id);assert(b.x>=0&&b.x+b.width<=size.width);}
    assert.equal(targets[0].y,targets[1].y);if(size.width<=560){assert.equal(targets.find(b=>b.id==='museumMore').width,60);assert(r.nav.right-r.nav.left<=210);}
    for(let i=0;i<targets.length;i++)for(let j=i+1;j<targets.length;j++){const a=targets[i],b=targets[j];assert(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y);}
    await page.locator('#museumMore').click();assert.equal(await page.locator('#menuExplore').evaluate(e=>e===document.activeElement),true);
    await page.keyboard.press('Escape');assert.equal(await page.locator('#museumMenu').isHidden(),true);assert.equal(await page.locator('#museumMore').evaluate(e=>e===document.activeElement),true);
    await page.locator('#museumMore').click();await page.locator('#menuExplore').click();await page.locator('#museumClose').click();
    assert.equal(await page.locator('#museumMore').evaluate(e=>e===document.activeElement),true);
    results.push({size,language,...r});
   }
  }
  await page.setViewportSize({width:430,height:932});await page.locator('#museumLanguage').click();await page.locator('#hideBtn').click();
  for(let i=0;i<4;i++){if(i){await page.locator('#museumNext').click();await page.waitForFunction(()=>document.getElementById('museumGallery').getAttribute('aria-busy')==='false');}assert.equal(await page.locator('#museumGallery').getAttribute('data-exhibit'),['original','covered-192','beaker-193','vase-191'][i]);await page.locator('#resetViewBtn').click();await page.screenshot({path:path.join(output,`${tag}-${i}.png`)});}
  const css=await context.request.get(url+'enhancements/museum.css');assert.equal(await css.text(),fs.readFileSync(root+'/enhancements/museum.css','utf8'));assert.deepEqual(errors,[]);await context.close();
 }finally{await browser.close();}fs.writeFileSync(path.join(output,tag+'.json'),JSON.stringify(results,null,2));console.log('All models and five screen sizes pass in Chinese and English');
})().catch(e=>{console.error(e);process.exitCode=1});
