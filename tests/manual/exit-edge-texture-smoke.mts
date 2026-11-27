// Render the production mask onto a white test backing, measure actual
// transparent cutouts, and verify editor hot updates / exported URLs.
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
 async function sample(query:string,edge:'top'|'bottom'|'left'|'none',depths:number[]){
  await page.goto(base+'chat.html?live=0&padding=0&edgeFadeUnit=pixels&edgeFadePixels=160&edgeFadePatternSize=8&'+query);
  await page.waitForSelector('#overlay-root[data-exit-edge="'+edge+'"]');
  await page.locator('#overlay-root').evaluate((el:HTMLElement)=>el.style.background='#fff');
  const png=await page.screenshot({omitBackground:true,animations:'disabled'});
  const result=spawnSync('python3',['-c',`import sys,io,json
from PIL import Image
im=Image.open(io.BytesIO(sys.stdin.buffer.read())).convert("RGBA")
edge,depths=json.loads(sys.argv[1])
out=[]
for y in depths:
 a=[im.getpixel((y,x) if edge=="left" else (x,399-y) if edge=="bottom" else (x,y))[3] for x in range(400)]
 out.append({"zero":sum(v==0 for v in a),"full":sum(v==255 for v in a),"max":max(a),"mean":sum(a)/len(a),"signature":"".join("1" if v>127 else "0" for v in a)})
print(json.dumps(out))`,JSON.stringify([edge,depths])],{input:png});
  assert.equal(result.status,0,result.stderr.toString());
  return JSON.parse(result.stdout.toString()) as {zero:number;full:number;max:number;mean:number;signature:string}[];
 }
 const patterns=['dither','grain','fringe'];
 const signatures=new Set<string>();
 for(const pattern of patterns){
  const settings='edgeFadePattern='+pattern+'&edgeFadeOpacity=100';
  const a=await sample(settings,'top',[0,80,159,170,399]);
  assert.equal(a[0]!.zero,400,pattern+' outer edge must be clear');
  assert.ok(a[1]!.zero>0&&a[1]!.full>0,pattern+' must cut holes, not just uniformly dim');
  for(const i of [2,3,4])assert.equal(a[i]!.full,400,pattern+' inner area must be fully opaque');
  signatures.add(a[1]!.signature);
  for(const [axis,query] of [['left','&layout=strip'],['bottom','&vertical=top']] as const){
   const b=await sample(settings+query,axis,[0,80,159,170]);
   assert.equal(b[0]!.zero,400);
   assert.ok(b[1]!.zero>0&&b[1]!.full>0);
   assert.equal(b[2]!.full,400);assert.equal(b[3]!.full,400);
  }
  const blend=await sample('edgeFadePattern='+pattern+'&edgeFadeOpacity=0','top',[0,80,170]);
  assert.equal(blend[0]!.zero,400);
  assert.equal(blend[1]!.zero,a[1]!.zero);
  assert.ok(blend[1]!.max>=125&&blend[1]!.max<=132);
  assert.equal(blend[2]!.full,400);
  console.log('TEXTURE',pattern,JSON.stringify({midHoles:a[1]!.zero,midOpaque:a[1]!.full,blendedMax:blend[1]!.max}));
 }
 assert.equal(signatures.size,3);
 const disabled=await sample('edgeFadePattern=grain&edgeFadeOpacity=100&layout=spotlight','none',[0,80,399]);
 assert.ok(disabled.every(a=>a.full===400));
 await page.setViewportSize({width:1440,height:1000});
 await page.goto(base+'?edgeFade=24');
 await page.locator('#edit-chat').click();
 await page.locator('#search-options').fill('Exit edge');
 const pattern=page.locator('#opt-edgeFadePattern');
 await pattern.selectOption('grain');
 await page.locator('#opt-edgeFadePatternSize').waitFor();
 await page.waitForFunction(()=>document.querySelector<HTMLIFrameElement>('#chat-preview')?.contentDocument?.querySelector<HTMLElement>('#overlay-root')?.style.maskImage.includes('data:image/svg+xml'));
 assert.equal(new URL(await page.locator('#chat-url').getAttribute('href'),base).searchParams.get('edgeFadePattern'),'grain');
 await pattern.selectOption('none');
 assert.equal(await page.locator('#opt-edgeFadePatternSize').isVisible(),false);
 await page.waitForFunction(()=>!document.querySelector<HTMLIFrameElement>('#chat-preview')?.contentDocument?.querySelector<HTMLElement>('#overlay-root')?.style.maskImage.includes('data:image/svg+xml'));
 assert.deepEqual(errors,[]);
 console.log('EDITOR pattern toggle, source URL and cleanup PASS');
}finally{await browser?.close();await new Promise<void>(resolve=>server.httpServer.close(()=>resolve()));}
