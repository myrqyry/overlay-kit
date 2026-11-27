// Synthetic paint fixtures through the production editor/preview path.
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {preview} from 'vite';
const root=resolve(import.meta.dirname,'../..');
const entry=resolve(process.env.PLAYWRIGHT_ENTRY??resolve(root,'../neural-field-notes/node_modules/playwright/index.mjs'));
const {chromium}=await import(pathToFileURL(entry).href);
const server=await preview({root,preview:{host:'127.0.0.1',port:0},logLevel:'error'});
let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_BIN??'/usr/bin/google-chrome-beta',args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors:string[]=[];
 page.on('pageerror',(e:Error)=>errors.push(e.message));
 const base=server.resolvedUrls!.local[0]!;
 await page.goto(base+'?messageBg=name-paint&messagePaintBlur=0&background=100&maxMessageWidth=320&uniformMessageWidth=1&enter=none&letterEnter=none&exit=none&ttl=120&messageOutline=2');
 await page.locator('#edit-chat').click();
 await page.locator('#search-options').fill('Name paint background blur');
 const slider=page.locator('#opt-messagePaintBlur');
 await slider.waitFor();
 assert.equal(await slider.getAttribute('max'),'48');
 const frame=page.frameLocator('#chat-preview');
 await frame.locator('#overlay-root[data-chat-layout=stack]').waitFor();
 await page.evaluate(()=>{
  const channel=new BroadcastChannel('myrqyry-overlay-kit-v1');
  const solid={kind:'solid',color:0xff224466,opacity:1};
  const gradient={kind:'linear',angle:90,repeating:true,opacity:.8,stops:[
   {at:0,color:0xffff0022},{at:.025,color:0xffff0022},
   {at:.025,color:0xff00eeff},{at:.05,color:0xff00eeff},
  ]};
  for(const [id,layers] of [
   ['blur-detail',[solid,gradient]],
   ['blur-solid',[solid,{kind:'solid',color:0xff884422,opacity:.4}]],
   ['blur-hidden',[solid,{...gradient,opacity:0}]],
  ]){
   channel.postMessage({type:'message',message:{
    id,timestamp:Date.now(),platform:'twitch',
    user:{name:'Paint sample',color:'#224466',badges:[],namePaint:{id,provider:'7tv',layers}},
    parts:[{type:'text',text:'Sharp text'}],
   }});
  }
  channel.close();
 });
 const detail=frame.locator('[data-message-id=blur-detail]');
 const solid=frame.locator('[data-message-id=blur-solid]');
 const hidden=frame.locator('[data-message-id=blur-hidden]');
 await detail.waitFor();await solid.waitFor();await hidden.waitFor();
 const solidBefore=await solid.screenshot({animations:'disabled'});
 const hiddenBefore=await hidden.screenshot({animations:'disabled'});
 const detailBefore=await detail.screenshot({animations:'disabled'});
 await slider.evaluate((el:HTMLInputElement)=>{el.value='48';el.dispatchEvent(new Event('change',{bubbles:true}));});
 const group=detail.locator('[data-message-paint-blur]');
 await group.waitFor();
 assert.equal(await group.evaluate((el:HTMLElement)=>getComputedStyle(el).filter),'blur(48px)');
 assert.equal(await detail.locator('[data-message-paint-blur]').count(),1);
 assert.equal(await solid.locator('[data-message-paint-surface]').count(),0);
 assert.equal(await hidden.locator('[data-message-paint-surface]').count(),0);
 assert.equal(await detail.locator('.overlay-message-content').evaluate((el:HTMLElement)=>getComputedStyle(el).filter),'none');
 assert.ok(await detail.locator('[data-message-paint-outline]').evaluateAll((els:HTMLElement[])=>els.every(el=>getComputedStyle(el).filter==='none')));
 const url=new URL(await page.locator('#chat-url').getAttribute('href'),base);
 assert.equal(url.searchParams.get('messagePaintBlur'),'48');
 const solidAfter=await solid.screenshot({animations:'disabled'});
 const hiddenAfter=await hidden.screenshot({animations:'disabled'});
 const detailAfter=await detail.screenshot({animations:'disabled'});
 // Compare decoded pixels, not PNG metadata/compression.
 const compare=(before:Buffer,after:Buffer)=>{
  const result=spawnSync('python3',['-c','import sys,io,json,base64; from PIL import Image,ImageChops; a,b=[Image.open(io.BytesIO(base64.b64decode(x))).convert("RGBA") for x in json.load(sys.stdin)]; assert a.size==b.size; print(sum(p!=(0,0,0,0) for p in ImageChops.difference(a,b).getdata()))'],{input:JSON.stringify([before.toString('base64'),after.toString('base64')])});
  assert.equal(result.status,0,result.stderr.toString());return Number(result.stdout.toString());
 };
 const solidDiff=compare(solidBefore,solidAfter),hiddenDiff=compare(hiddenBefore,hiddenAfter),detailDiff=compare(detailBefore,detailAfter);
 assert.equal(solidDiff,0);assert.equal(hiddenDiff,0);assert.ok(detailDiff>100);
 await slider.evaluate((el:HTMLInputElement)=>{el.value='0';el.dispatchEvent(new Event('change',{bubbles:true}));});
 await group.waitFor({state:'detached'});
 assert.equal(compare(detailBefore,await detail.screenshot({animations:'disabled'})),0);
 assert.deepEqual(errors,[]);
 console.log('PAINT BLUR browser',JSON.stringify({max:48,detailFilters:1,uniformFilters:0,invisibleDetailFilters:0,solidDiff,hiddenDiff,detailDiff,errors}));
}finally{await browser?.close();await new Promise<void>(resolve=>server.httpServer.close(()=>resolve()));}
