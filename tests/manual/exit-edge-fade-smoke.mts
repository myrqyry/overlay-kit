// Actual Chromium alpha sampling of the built chat page. Test-only white
// root backing isolates the applied mask from text/artwork transparency.
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
 const page=await browser.newPage({viewport:{width:400,height:400}});
 const errors:string[]=[];
 page.on('pageerror',(e:Error)=>errors.push(e.message));
 const base=server.resolvedUrls!.local[0]!;
 async function sample(query:string,edge:'top'|'bottom'|'left'|'none',distances:number[]){
  await page.goto(base+'chat.html?live=0&enter=none&padding=0&'+query);
  await page.waitForSelector('#overlay-root[data-exit-edge="'+edge+'"]');
  await page.locator('#overlay-root').evaluate((el:HTMLElement)=>el.style.background='#fff');
  const png=await page.screenshot({omitBackground:true,animations:'disabled'});
  const coordinates=distances.map(n=>edge==='left'?[n,200]:edge==='bottom'?[200,399-n]:[200,n]);
  const result=spawnSync('python3',['-c','import sys,io,json; from PIL import Image; im=Image.open(io.BytesIO(sys.stdin.buffer.read())).convert("RGBA"); print(json.dumps([im.getpixel(tuple(p))[3] for p in json.loads(sys.argv[1])]))',JSON.stringify(coordinates)],{input:png});
  assert.equal(result.status,0,result.stderr.toString());
  return JSON.parse(result.stdout.toString()) as number[];
 }
 const approx=(actual:number,expected:number,tolerance=5)=>assert.ok(Math.abs(actual-expected)<=tolerance,JSON.stringify({actual,expected}));
 const curves:Record<string,number[]>={linear:[0,64,128,192,255],smooth:[0,40,128,215,255],quick:[0,112,191,239,255],linger:[0,16,64,143,255],steps:[0,64,128,191,255],cut:[0,0,0,0,255]};
 for(const [style,expected] of Object.entries(curves)){
  const a=await sample('edgeFade=40&edgeFadeStyle='+style,'top',[0,40,80,120,161]);
  a.forEach((n,i)=>approx(n,expected[i]!,6));
  console.log('ALPHA',style,a);
 }
 const held=await sample('edgeFadeUnit=pixels&edgeFadePixels=160&edgeFadeOpacity=25&edgeFadeHold=50','top',[0,40,79,120,161]);
 [64,64,64,160,255].forEach((n,i)=>approx(held[i]!,n));
 const top=await sample('edgeFadeUnit=pixels&edgeFadePixels=100&vertical=top','bottom',[0,25,50,75,101]);
 const strip=await sample('edgeFadeUnit=pixels&edgeFadePixels=100&layout=strip','left',[0,25,50,75,101]);
 for(const a of [top,strip])a.forEach((n,i)=>approx(n,[0,64,128,192,255][i]!));
 const clamped=await sample('edgeFadeUnit=pixels&edgeFadePixels=1200','top',[0,100,200,300,399]);
 clamped.forEach((n,i)=>approx(n,[0,64,128,192,255][i]!));
 for(const q of ['layout=spotlight&edgeFade=40','edgeFade=0','edgeFade=40&edgeFadeOpacity=100']){
  const a=await sample(q,'none',[0,100,399]);assert.deepEqual(a,[255,255,255]);
 }
 console.log('ALPHA hold / direction / clamped / disabled',held,top,strip,clamped);
 await page.setViewportSize({width:1440,height:1000});
 await page.goto(base+'?edgeFade=24');
 await page.locator('#edit-chat').click();
 await page.locator('#search-options').fill('Exit edge');
 const style=page.locator('#opt-edgeFadeStyle');
 await style.selectOption('steps');
 await page.locator('#opt-edgeFadeSteps').waitFor();
 await page.locator('#opt-edgeFadeUnit').selectOption('pixels');
 await page.locator('#opt-edgeFadePixels').waitFor();
 assert.equal(await page.locator('#opt-edgeFade').isVisible(),false);
 const frame=page.frameLocator('#chat-preview');
 await frame.locator('#overlay-root[data-exit-edge=top]').waitFor();
 await frame.locator('#overlay-root').evaluate((el:HTMLElement)=>el.style.maskImage);
 await page.waitForFunction(()=>document.querySelector<HTMLIFrameElement>('#chat-preview')?.contentDocument?.querySelector<HTMLElement>('#overlay-root')?.style.maskImage.includes('120px'));
 const url=new URL(await page.locator('#chat-url').getAttribute('href'),base);
 assert.equal(url.searchParams.get('edgeFadeStyle'),'steps');
 assert.equal(url.searchParams.get('edgeFadeUnit'),'pixels');
 await style.selectOption('cut');
 assert.equal(await page.locator('#opt-edgeFadeHold').isVisible(),false);
 assert.equal(await page.locator('#opt-edgeFadeSteps').isVisible(),false);
 await page.locator('#opt-edgeFadeUnit').selectOption('percent');
 await page.locator('#opt-edgeFade').waitFor();
 assert.equal(await page.locator('#opt-edgeFade').inputValue(),'24');
 assert.deepEqual(errors,[]);
 console.log('EDITOR options, hot preview and source URL PASS');
}finally{await browser?.close();await new Promise<void>(resolve=>server.httpServer.close(()=>resolve()));}
