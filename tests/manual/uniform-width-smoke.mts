// Production browser geometry check using deliberately synthetic preview messages.
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
 const page=await browser.newPage({viewport:{width:800,height:600}});
 const errors:string[]=[];
 page.on('pageerror',(error:Error)=>errors.push(error.message));
 const base=server.resolvedUrls!.local[0]!;
 async function seed(target:typeof page,ids=['short','long']){
  await target.evaluate((ids:string[])=>{
   const channel=new BroadcastChannel('myrqyry-overlay-kit-v1');
   ids.forEach(id=>channel.postMessage({type:'message',message:{
    id,timestamp:Date.now(),platform:'twitch',user:{name:'A',badges:[]},
    parts:[{type:'text',text:id==='short'?'Hi':'A longer message with enough words to wrap without changing font size.'}],
   }}));
   channel.close();
  },ids);
 }
 const rows=page.locator('.overlay-chat-message');
 const widths=()=>rows.evaluateAll((elements:HTMLElement[])=>elements.map(el=>Math.round(el.getBoundingClientRect().width)));
 for(const nameplate of ['inline','floating']){
  for(const layout of ['stack','strip','spotlight']){
   for(const uniform of [false,true]){
    await page.goto(base+'chat.html?live=0&enter=none&ttl=120&padding=10&font=20&layout='+layout+'&nameplate='+nameplate+'&maxMessageWidth=240&uniformMessageWidth='+(uniform?'1':'0'));
    await page.waitForSelector('#overlay-root[data-uniform-message-width="'+uniform+'"]');
    await seed(page,layout==='spotlight'?['short']:['short','long']);
    await page.waitForFunction((n:number)=>document.querySelectorAll('.overlay-chat-message').length===n,layout==='spotlight'?1:2);
    const sizes=await widths();
    if(uniform)assert.ok(sizes.every((w:number)=>Math.abs(w-240)<=1),JSON.stringify({layout,nameplate,sizes}));
    else assert.ok(sizes[0]<240,JSON.stringify({layout,nameplate,sizes}));
    console.log('GEOMETRY',layout,nameplate,uniform,sizes);
   }
  }
 }
 await page.setViewportSize({width:320,height:600});
 await page.goto(base+'chat.html?live=0&enter=none&ttl=120&padding=10&layout=stack&maxMessageWidth=600&uniformMessageWidth=1');
 await page.waitForSelector('#overlay-root[data-uniform-message-width=true]');
 await seed(page);
 await rows.first().waitFor();
 assert.deepEqual(await widths(),[300,300]);
 await page.goto(base+'chat.html?live=0&enter=none&ttl=120&padding=10&maxMessageWidth=0&uniformMessageWidth=1');
 await page.waitForSelector('#overlay-root[data-uniform-message-width=false]');
 await seed(page);
 await rows.first().waitFor();
 assert.ok((await widths())[0]<300);
 console.log('NARROW AND ZERO PASS');
 // The real editor: width is restored from URL; toggle updates its preview
 // and exported OBS settings without needing to recreate the iframe.
 await page.setViewportSize({width:1440,height:1000});
 await page.goto(base+'?maxMessageWidth=240&enter=none&ttl=120');
 await page.locator('#edit-chat').click();
 await page.locator('#search-options').fill('Uniform message width');
 const toggle=page.locator('[data-option-key=uniformMessageWidth] input');
 await toggle.waitFor();
 assert.equal(await toggle.isChecked(),false);
 const frame=page.frameLocator('#chat-preview');
 await frame.locator('#overlay-root[data-uniform-message-width=false]').waitFor();
 await seed(page);
 await frame.locator('[data-message-id=short]').waitFor();
 const before=await frame.locator('[data-message-id=short]').evaluate((el:HTMLElement)=>el.getBoundingClientRect().width);
 await toggle.check();
 assert.equal(new URL(await page.locator('#chat-url').getAttribute('href'),base).searchParams.get('uniformMessageWidth'),'1');
 await frame.locator('#overlay-root[data-uniform-message-width=true]').waitFor();
 const after=await frame.locator('[data-message-id=short]').evaluate((el:HTMLElement)=>el.getBoundingClientRect().width);
 assert.ok(before<240);assert.ok(Math.abs(after-240)<=1);
 await toggle.uncheck();
 assert.equal(new URL(await page.locator('#chat-url').getAttribute('href'),base).searchParams.has('uniformMessageWidth'),false);
 await frame.locator('#overlay-root[data-uniform-message-width=false]').waitFor();
 assert.ok(await frame.locator('[data-message-id=short]').evaluate((el:HTMLElement)=>el.getBoundingClientRect().width)<240);
 assert.deepEqual(errors,[]);
 console.log('EDITOR TOGGLE',JSON.stringify({before,after,errors}));
}finally{await browser?.close();await new Promise<void>(resolve=>server.httpServer.close(()=>resolve()));}
