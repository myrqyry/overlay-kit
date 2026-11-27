import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_ENTRY??resolve(import.meta.dirname,'../../../neural-field-notes/node_modules/playwright/index.mjs')).href);
import {existsSync,statSync} from 'node:fs';
import {resolve,extname} from 'node:path';
const origin='https://myrqyry.github.io';
const platform=process.env.OVERLAY_SMOKE_PLATFORM??'twitch';
assert.ok(['twitch','kick'].includes(platform));
const channel=process.env.OVERLAY_SMOKE_CHANNEL??process.env.OVERLAY_SMOKE_TWITCH_CHANNEL??(platform==='twitch'?'xqc':'iceposeidon');
assert.match(channel,/^[a-z0-9_-]{1,40}$/);
const prefix='/overlay-kit/';
const root=resolve(import.meta.dirname,'../../dist-pages');
const browser=await chromium.launch({executablePath:process.env.BROWSER_BIN??'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{
 const ctx=await browser.newContext({viewport:{width:1440,height:900}});
 const missing=[],errors=[],relay=[],sockets=[];
 // Only the site's own files are supplied by the local static build. All
 // provider requests and WebSocket traffic are real browser network traffic.
 if(process.env.OVERLAY_SMOKE_DEPLOYED!=='1')await ctx.route(origin+prefix+'**',async r=>{
  const path=new URL(r.request().url()).pathname.slice(prefix.length)||'index.html';
  const local=resolve(root,path);
  if(!local.startsWith(root+'/')||!existsSync(local)||!statSync(local).isFile()){missing.push(path);return r.fulfill({status:404,body:'missing'});}
  const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.json':'application/json','.txt':'text/plain'}[extname(local)];
  return r.fulfill({path:local,contentType:mime});
 });
 ctx.on('request',r=>{const u=new URL(r.url());if(u.origin===origin&&u.pathname.startsWith('/api/'))relay.push(u.pathname)});
 const track=p=>{p.on('pageerror',e=>errors.push(e.message));p.on('websocket',w=>sockets.push(w.url()));};
 const editor=await ctx.newPage();track(editor);
 await editor.goto(origin+prefix);
 await editor.waitForFunction(()=>document.querySelector('#live-status')?.textContent?.includes('Browser-direct'));
 assert.equal(await editor.locator('#live-platform option:disabled').count(),2);
 for(const id of ['wall-preview','chat-preview'])await editor.locator('#'+id).evaluate(f=>{if(!f.src.startsWith('https://myrqyry.github.io/overlay-kit/'))throw Error('bad preview URL '+f.src)});
 const legal=await editor.locator('#project-attribution a[href*="license.txt"]').getAttribute('href');console.log('legal link:',legal);
 const link=await editor.locator('#project-attribution a[href*="license.txt"]').evaluate(a=>a.href);
 assert.ok(link.startsWith(origin+prefix));
 await editor.locator('#live-platform').selectOption(platform,{force:true});
 await editor.locator('#live-channel').fill(channel);
 await editor.locator('#live-toggle').click();
 await editor.waitForFunction(({platform,channel})=>document.querySelector('#live-status')?.textContent?.includes(platform+' '+channel+': connected'),{platform,channel},{timeout:20000});
 const href=await editor.locator("a[href*='chat.html']").first().getAttribute("href");
 console.log('editor connected, source link:',href);
 await editor.close();
 const source=await ctx.newPage();track(source);
 await source.goto(origin+prefix+'chat.html?source='+platform+':'+channel);
 await source.locator('.overlay-chat-message[data-message-id^="'+platform+':'+channel+':"]').first().waitFor({timeout:35000});
 console.log('independent source live message count',await source.locator('.overlay-chat-message[data-message-id^="'+platform+':'+channel+':"]').count());
 assert.ok(sockets.some(s=>s.includes(platform==='twitch'?'irc-ws.chat.twitch.tv':'.pusher.com')));
 assert.deepEqual(missing,[]);
 assert.deepEqual(relay,[]);
 assert.deepEqual(errors,[]);
 console.log('PASS: project subpath, real browser-direct editor and independent live source, no relay requests or page errors');
}finally{await browser.close()}
