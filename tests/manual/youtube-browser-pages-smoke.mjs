// Fixture-driven browser integration test. Does NOT claim real YouTube access.
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {existsSync,statSync} from 'node:fs';
import {resolve,extname} from 'node:path';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_ENTRY??resolve(import.meta.dirname,'../../../neural-field-notes/node_modules/playwright/index.mjs')).href);
const origin='https://myrqyry.github.io',prefix='/overlay-kit/';
const root=resolve(import.meta.dirname,'../../dist-pages');
const video='jfKfPfyJRdk', key='AIza'+'FixtureKeyForTestingOnly012345678901';
const browser=await chromium.launch({executablePath:process.env.BROWSER_BIN??'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{
 const ctx=await browser.newContext({viewport:{width:1440,height:900}});
 let lookups=0,polls=0;const errors=[],relay=[],missing=[];
 await ctx.route(origin+prefix+'**',async r=>{
  const path=new URL(r.request().url()).pathname.slice(prefix.length)||'index.html';
  const local=resolve(root,path);
  if(!local.startsWith(root+'/')||!existsSync(local)||!statSync(local).isFile()){missing.push(path);return r.fulfill({status:404,body:'missing'});}
  const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.json':'application/json','.txt':'text/plain'}[extname(local)];
  return r.fulfill({path:local,contentType:mime});
 });
 await ctx.route('https://www.googleapis.com/youtube/v3/**',async r=>{
  const req=r.request(),url=new URL(req.url());
  assert.equal(req.headers()['x-goog-api-key'],key);
  assert.equal(url.searchParams.has('key'),false);
  const headers={'access-control-allow-origin':origin,'access-control-allow-headers':'x-goog-api-key','content-type':'application/json'};
  if(url.pathname.endsWith('/videos')){
   lookups++;assert.equal(url.searchParams.get('id'),video);
   return r.fulfill({headers,body:JSON.stringify({items:[{snippet:{channelId:'fixture-channel',channelTitle:'Fixture'},liveStreamingDetails:{activeLiveChatId:'fixture-chat'}}]})});
  }
  assert.ok(url.pathname.endsWith('/liveChat/messages'));
  polls++;
  return r.fulfill({headers,body:JSON.stringify({nextPageToken:'next-'+polls,pollingIntervalMillis:100,items:[{id:'fixture-message-'+polls,snippet:{type:'textMessageEvent',publishedAt:new Date().toISOString(),displayMessage:'Test message'},authorDetails:{channelId:'viewer',displayName:'Fixture viewer'}}]})});
 });
 ctx.on('request',r=>{const u=new URL(r.url());if(u.origin===origin&&u.pathname.startsWith('/api/'))relay.push(u.pathname);assert.ok(!r.url().includes(key));});
 const editor=await ctx.newPage();editor.on('pageerror',e=>errors.push(e.message));
 await editor.goto(origin+prefix);
 await editor.waitForFunction(()=>document.querySelector('#live-status')?.textContent?.includes('Browser-direct'));
 await editor.locator('#live-platform').selectOption('youtube',{force:true});
 await editor.locator('#live-channel').fill(video);
 await editor.locator('#live-toggle').click();
 await editor.waitForFunction(()=>document.querySelector('#live-status')?.textContent?.includes('restricted Data API key'));
 assert.equal(lookups,0);assert.equal(polls,0);
 await editor.locator('#open-accounts').click();
 await editor.locator('.youtube-key-controls input').fill(key);
 await editor.locator('.youtube-key-controls button[type=submit]').click();
 await editor.getByRole('button',{name:'Close accounts'}).click();
 await editor.waitForFunction((video)=>document.querySelector('#live-status')?.textContent?.includes('youtube '+video+': connected'),video);
 await editor.locator('#edit-chat').click();
 await editor.frameLocator('#chat-preview').locator('.overlay-chat-message[data-message-id^="youtube:'+video+':"]').first().waitFor({timeout:18000,state:'attached'});
 assert.equal(lookups,1);assert.equal(polls,2);
 const href=await editor.locator('#chat-url').getAttribute('href');
 assert.ok(href.includes('source=youtube%3A'+video));assert.ok(!href.includes(key));
 await editor.close();
 const source=await ctx.newPage();source.on('pageerror',e=>errors.push(e.message));
 await source.goto(new URL(href,origin+prefix).href);
 await source.locator('.overlay-chat-message[data-message-id^="youtube:'+video+':"]').first().waitFor({timeout:18000,state:'attached'});
 assert.equal(lookups,2);assert.equal(polls,4);
 const setup=await ctx.newPage();await setup.goto(origin+prefix+'youtube-setup.html');
 assert.equal(await setup.locator('input[type=password]').inputValue(),'');
 await setup.getByRole('button',{name:'Forget key'}).click();
 const before=polls;await source.waitForTimeout(11000);assert.equal(polls,before);
 assert.deepEqual(errors,[]);assert.deepEqual(relay,[]);assert.deepEqual(missing,[]);
 console.log('PASS: fixture YouTube chat rendered, one editor poll stream shared by previews, independent source, key only in Google header, forget stops polling.');
}finally{await browser.close();}
