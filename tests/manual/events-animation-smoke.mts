// Production browser check for Events entrance/exit and styling parity.
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {preview} from 'vite';
const root=resolve(import.meta.dirname,'../..');
const entry=resolve(process.env.PLAYWRIGHT_ENTRY??resolve(root,'../neural-field-notes/node_modules/playwright/index.mjs'));
const {chromium}=await import(pathToFileURL(entry).href);
const server=await preview({root,preview:{host:'127.0.0.1',port:0},logLevel:'error'});
let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_BIN??'/usr/bin/google-chrome-beta',args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:960,height:540}});
 const errors:string[]=[];
 page.on('pageerror',(error:Error)=>errors.push(error.message));
 const base=server.resolvedUrls!.local[0]!;
 const query='?preview=1&eventDuration=2&eventMotion=fold-collapse&eventMotionMs=620&eventExit=dissolve&eventExitMs=400&eventAccent=violet&eventFamily=serif';
 await page.goto(base+'events.html'+query);
 await page.waitForSelector('.overlay-event-alert');
 const surface=page.locator('.overlay-events');
 assert.equal(await surface.getAttribute('data-motion'),'fold-collapse');
 assert.equal(await surface.getAttribute('data-exit'),'dissolve');
 assert.equal(await surface.getAttribute('data-accent'),'violet');
 assert.equal(await surface.getAttribute('data-family'),'serif');
 assert.equal(await surface.evaluate((el:HTMLElement)=>el.style.getPropertyValue('--event-enter-duration')),'620ms');
 const entrance=await page.locator('.overlay-event-alert').evaluate((el:HTMLElement)=>{
  const s=getComputedStyle(el), h=getComputedStyle(el.querySelector('.overlay-event-heading')!);
  return {name:s.animationName,duration:s.animationDuration,family:s.fontFamily,color:h.color,transform:s.transform};
 });
 assert.equal(entrance.name,'event-fold-collapse');
 assert.equal(entrance.duration,'0.62s');
 assert.match(entrance.family,/Georgia/i);
 assert.equal(entrance.color,'rgb(201, 180, 255)');
 console.log('ENTRANCE',entrance);
 await page.waitForSelector('.overlay-event-alert[data-phase="exiting"]',{timeout:4000});
 const exit=await page.locator('.overlay-event-alert').evaluate((el:HTMLElement)=>{
  const s=getComputedStyle(el);return {name:s.animationName,duration:s.animationDuration};
 });
 assert.equal(exit.name,'event-out-dissolve');
 assert.equal(exit.duration,'0.4s');
 console.log('EXIT',exit);
 await page.waitForSelector('.overlay-event-alert',{state:'detached',timeout:3000});
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto(base+'events.html'+query);
 await page.waitForSelector('.overlay-event-alert');
 assert.equal(await page.locator('.overlay-event-alert').evaluate((el:HTMLElement)=>getComputedStyle(el).animationName),'none');
 console.log('REDUCED MOTION PASS');
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.goto(base+'events.html?preview=1&eventDuration=2&eventMotion=glitch-split&eventMotionMs=480&eventExit=split-flap&eventExitMs=360&eventAccent=amber&eventFamily=mono&eventStyle=paper');
 await page.waitForSelector('.overlay-event-alert');
 const alternate=await page.locator('.overlay-event-alert').evaluate((el:HTMLElement)=>{
  const s=getComputedStyle(el);return {name:s.animationName,duration:s.animationDuration,family:s.fontFamily,transform:s.transform};
 });
 assert.equal(alternate.name,'event-glitch-split');
 assert.equal(alternate.duration,'0.48s');
 assert.match(alternate.family,/DejaVu Sans Mono|Consolas/i);
 assert.notEqual(alternate.transform,'none');
 console.log('PAPER + ALT ENTRANCE',alternate);
 await page.waitForSelector('.overlay-event-alert[data-phase="exiting"]',{timeout:4000});
 assert.equal(await page.locator('.overlay-event-alert').evaluate((el:HTMLElement)=>getComputedStyle(el).animationName),'event-out-split-flap');

 const rules=[{kind:'subscription',tier:'3',settings:{accent:'violet',fontFamily:'serif',style:'paper',motion:'fold-collapse',motionMs:560,exit:'dissolve',exitMs:300,fontSize:44}}];
 await page.goto(base+'events.html?preview=1&live=0&eventDuration=2&overrides='+encodeURIComponent(JSON.stringify(rules)));
 await page.evaluate(()=>window.postMessage({type:'overlay-kit-event-preview',signal:{
  schemaVersion:1,producer:'chatbus',source:{platform:'twitch',channelName:'preview',origin:'test'},
  event:{type:'subscription',id:'browser-tier-3',occurredAtMs:Date.now(),receivedAtMs:Date.now(),tier:'3'},
  actor:{platform:'twitch',username:'mossy',displayName:'Mossy'},
 }},location.origin));
 await page.waitForSelector('.overlay-event-alert');
 const tiered=await page.locator('.overlay-events').evaluate((el:HTMLElement)=>({
  accent:el.dataset.accent,family:el.dataset.family,style:el.dataset.style,
  motion:el.dataset.motion,exit:el.dataset.exit,
  enter:el.style.getPropertyValue('--event-enter-duration'),
  font:el.style.getPropertyValue('--events-font'),
 }));
 assert.deepEqual(tiered,{accent:'violet',family:'serif',style:'paper',motion:'fold-collapse',exit:'dissolve',enter:'560ms',font:'44px'});
 console.log('TIER OVERRIDE',tiered);
 await page.setViewportSize({width:1440,height:1000});
 await page.goto(base+'?');
 await page.locator('#edit-events').click();
 for(const label of ['Accent','Typeface','Entrance duration']){
  await page.locator('#search-options').fill(label);
  assert.ok((await page.locator('#options-root').innerText()).toLowerCase().includes(label.toLowerCase()),label);
 }
 await page.locator('#search-options').fill('overrides');
 await page.locator('.event-override-add').click();
 assert.equal(await page.locator('.event-override-card').count(),1);
 await page.locator('.event-override-top select').selectOption('subscription');
 await page.locator('.event-override-top input[type=text]').fill('3');
 await page.locator('.event-override-top input[type=text]').blur();
 await page.locator('.event-override-card .event-override-grid select').first().selectOption('paper');
 const stored=await page.locator('#opt-eventOverrides').inputValue();
 assert.ok(stored.includes('subscription')&&stored.includes('"tier":"3"')&&stored.includes('paper'),stored);
 console.log('OVERRIDE EDITOR PASS',stored);
 assert.deepEqual(errors,[]);
 console.log('EDITOR CONTROL SURFACE PASS');
}finally{
 await browser?.close();
 await new Promise<void>(resolveClose=>server.httpServer.close(()=>resolveClose()));
}
