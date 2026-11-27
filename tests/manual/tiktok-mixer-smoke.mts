// Explicit live smoke against public streams; keeps config isolated and logs counts only.
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createLiveServer} from '../../server/http';
const root=resolve(import.meta.dirname,'../..');
const playwright=resolve(process.env.PLAYWRIGHT_ENTRY??resolve(root,'../neural-field-notes/node_modules/playwright/index.mjs'));
const {chromium}=await import(pathToFileURL(playwright).href);
const [tiktok='tv_asahi_news',kick='westcol']=process.argv.slice(2);
const dir=mkdtempSync(join(tmpdir(),'overlay-tiktok-live-'));
const server=await createLiveServer({port:0,restore:false,root:resolve(root,'dist-demo'),oauthFile:join(dir,'oauth.json'),configPath:join(dir,'state.json'),kickClient:{clientId:'unused-test-id',clientSecret:'unused-test-secret'}});
let browser;
const errors:string[]=[],counts:Record<string,number>={};
try {
 browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_BIN??'/usr/bin/google-chrome-beta',args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 page.on('pageerror',(e:Error)=>errors.push(e.message));
 page.on('websocket',(ws:{url():string;on(event:'framereceived',fn:(frame:{payload:string|Buffer})=>void):void})=>{
  if(!ws.url().endsWith('/live'))return;
  // Count one local feed rather than multiplying by open previews.
  if(Object.keys(counts).length===0&&!seenSocket){seenSocket=true;ws.on('framereceived',frame=>{
    try{const packet=JSON.parse(String(frame.payload));if(packet.type==='signal'&&packet.signal.event.type==='message'&&packet.signal.source.origin==='live'){
      const platform=packet.signal.source.platform;counts[platform]=(counts[platform]??0)+1;
    }}catch{}
  });}
 });
 let seenSocket=false;
 await page.goto(server.address);
 await page.waitForFunction(()=>!(document.querySelector<HTMLOptionElement>('#live-platform option[value=tiktok]')?.disabled));
 await page.locator('#edit-chat').click();
 await page.locator('#live-platform-trigger').click();
 await page.locator('#live-platform-menu button[data-platform=tiktok]').click();
 await page.locator('#open-accounts').click();
 assert.ok((await page.locator('#accounts-list [data-provider=tiktok]').textContent()).includes('No sign-in'));
 await page.locator('#accounts-dialog button[aria-label="Close accounts"]').click();
 await page.locator('#live-channel').fill('https://www.tiktok.com/@'+tiktok+'/live');
 await page.locator('#live-toggle').click();
 await page.waitForFunction(()=>document.querySelectorAll('#live-sources .live-source-chip[data-platform=tiktok]').length===1);
 await page.locator('#live-platform-trigger').click();
 await page.locator('#live-platform-menu button[data-platform=kick]').click();
 await page.locator('#live-channel').fill(kick);
 await page.locator('#live-toggle').click();
 await page.waitForFunction(()=>document.querySelectorAll('#live-sources .live-source-chip').length===2);
 await page.waitForFunction(()=>fetch('/api/live/status').then(r=>r.json()).then(p=>p.status.sources.length===2&&p.status.sources.every((s:{state:string})=>s.state==='connected')),undefined,{timeout:35000});
 const chat=page.frameLocator('#chat-preview');
 await chat.locator('.overlay-service-badge[data-platform=tiktok]').first().waitFor({timeout:30000});
 await chat.locator('.overlay-service-badge[data-platform=kick]').first().waitFor({timeout:30000});
 console.log('MIXED',JSON.stringify({sources:server.hub.status().sources.map(s=>[s.platform,s.channel,s.state]),liveCounts:counts,tiktokBadges:await chat.locator('.overlay-service-badge[data-platform=tiktok]').count(),kickBadges:await chat.locator('.overlay-service-badge[data-platform=kick]').count()}));
 await page.locator('#live-sources .live-source-chip[data-platform=tiktok]').click();
 await page.locator('#live-source-menu [data-action=disconnect]').click();
 await page.waitForFunction(()=>document.querySelectorAll('#live-sources .live-source-chip[data-platform=tiktok]').length===0);
 const before=counts.tiktok,otherBefore=counts.kick??0;
 const deadline=Date.now()+8000;
 while(Date.now()<deadline&&(counts.kick??0)<=otherBefore)await page.waitForTimeout(200);
 assert.ok((counts.kick??0)>otherBefore,'Kick must continue delivering');
 await page.waitForTimeout(500);
 assert.equal(counts.tiktok,before,'no more TikTok messages after removing source');
 assert.deepEqual(server.hub.status().sources.map(s=>s.platform),['kick']);
 console.log('AFTER_REMOVE',JSON.stringify({sources:server.hub.status().sources.map(s=>[s.platform,s.state]),liveCounts:counts,errors}));
 assert.deepEqual(errors,[]);
 await page.locator('#live-sources .live-source-chip[data-platform=kick]').click();
 await page.locator('#live-source-menu [data-action=disconnect]').click();
 await page.waitForFunction(()=>document.querySelectorAll('#live-sources .live-source-chip').length===0);
 assert.equal(server.hub.status().sources.length,0);
 console.log('PASS local editor and actual mixed chat feed');
}finally{await browser?.close();await server.close();rmSync(dir,{recursive:true,force:true});}
