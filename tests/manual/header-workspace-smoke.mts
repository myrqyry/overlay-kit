// Production studio in an isolated browser context, with native clipboard access.
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {preview} from 'vite';
import {DEFAULT_OPTIONS} from '../../src/options';
const root=resolve(import.meta.dirname,'../..');
const entry=resolve(process.env.PLAYWRIGHT_ENTRY??resolve(root,'../neural-field-notes/node_modules/playwright/index.mjs'));
const {chromium}=await import(pathToFileURL(entry).href);
const server=await preview({root,preview:{host:'127.0.0.1',port:0},logLevel:'error'});
const base=server.resolvedUrls!.local[0]!;
let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_BIN??'/usr/bin/google-chrome-beta',args:['--no-sandbox','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:1440,height:900},permissions:['clipboard-read','clipboard-write']});
 const page=await context.newPage();
 const errors:string[]=[];page.on('pageerror',(e:Error)=>errors.push(e.message));
 await page.goto(base);await page.waitForFunction(()=>document.querySelector('#wall-preview')?.getAttribute('src')!=='about:blank');
 const open=page.locator('#open-presets'),dialog=page.locator('#presets-dialog');
 const close=async()=>{await dialog.getByRole('button',{name:'Close presets'}).click();assert.ok(await dialog.isHidden());};
 const setFont=async(n:number)=>{
  await page.locator('#search-options').fill('Message text size');
  const font=page.locator('#opt-font');await font.waitFor();
  await font.evaluate((el:HTMLInputElement,value:number)=>{el.value=String(value);el.dispatchEvent(new Event('change',{bubbles:true}));},n);
 };
 const links=['wall','chat','avatars','events'];
 const href=async(view:string)=>await page.locator('#'+view+'-url').evaluate((el:HTMLAnchorElement)=>el.href);
 for(const [w,h] of [[1440,900],[1024,768],[800,700],[390,844],[320,700]]){
  await page.setViewportSize({width:w!,height:h!});
  const geometry=await page.evaluate(`(()=>{
   const rect=(s)=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
   const ids=['.app-chrome','.workspace-header','.chrome-tools','.live-session','.preview-space','.preview-grid'];
   return {boxes:ids.map(rect),viewport:document.documentElement.scrollWidth,mainChildren:[...document.querySelector('main').children].map(e=>e.id)};
  })()`);
  assert.equal(geometry.viewport,w);
  assert.deepEqual(geometry.mainChildren,['preview-grid']);
  for(const r of geometry.boxes)assert.ok(r.x>=0&&r.right<=w!+1,'geometry '+w+' '+JSON.stringify(r));
  for(const id of ['#open-presets','#compare-previews','#open-accounts','#import-all-settings','#export-all-settings']){
   const r=await page.locator(id).boundingBox();assert.ok(r&&r.x>=0&&r.x+r.width<=w!+1,'header action '+id+' '+w);
  }
  assert.equal(await page.locator('.source-copy-chip:visible').count(),0);
  for(const view of links){
   await page.locator('#edit-'+view).hover();
   assert.equal(await page.locator('.source-copy-chip:visible').count(),1);
   const chip=page.locator('#'+view+'-url');
   const r=await chip.boundingBox();assert.ok(r&&r.x>=0&&r.x+r.width<=w!+1,'link '+view+' '+w);
   assert.ok(r.width<=100,'copy chip stretched: '+view+' '+r.width+'px at '+w);
   assert.ok(await page.locator('#enable-'+view).isVisible());
  }
  await open.click();await dialog.waitFor();
  const box=await dialog.boundingBox();assert.ok(box&&box.x>=0&&box.x+box.width<=w!&&box.y>=0&&box.y+box.height<=h!);
  await close();
  await page.locator('#compare-previews').click();
  assert.equal(await page.locator('.preview-card:visible').count(),4);
  await page.locator('#compare-previews').click();
  assert.equal(await page.locator('.preview-card:visible').count(),1);
  if(w!<=720){
   await page.locator('#show-settings').click();assert.ok(await page.locator('#overlay-inspector').isVisible());
   await page.locator('#compare-previews').click();assert.ok(await page.locator('#preview-grid').isVisible());
   await page.locator('#compare-previews').click();
  }
  console.log('HEADER GEOMETRY',JSON.stringify({viewport:w,headerHeight:geometry.boxes[0].height,mainHeight:geometry.boxes[4].height,canvasHeight:geometry.boxes[5].height,headerWidth:geometry.boxes[0].width}));
 }
 await page.setViewportSize({width:1440,height:900});
 await page.locator('#edit-chat').click();await setFont(37);
 const otherUrls=await Promise.all(['wall','avatars','events'].map(href));
 const chat37=await href('chat');assert.equal(new URL(chat37).searchParams.get('font'),'37');
 await open.click();assert.equal(await dialog.locator('#presets-title').textContent(),'Chat presets');
 await dialog.locator('#preset-name').fill('Smoke chat');await dialog.locator('#save-preset').click();
 assert.equal(await dialog.locator('#preset-select').inputValue(),'custom:Smoke chat');
 await dialog.locator('#reset-defaults').click();assert.equal(await href('chat'),chat37);
 await dialog.locator('#cancel-reset').click();assert.equal(await href('chat'),chat37);
 await dialog.locator('#reset-defaults').click();await dialog.locator('#confirm-reset').click();
 assert.equal(new URL(await href('chat')).searchParams.get('font'),null);
 assert.deepEqual(await Promise.all(['wall','avatars','events'].map(href)),otherUrls);
 await dialog.locator('#preset-select').selectOption('custom:Smoke chat');
 await dialog.locator('#load-preset').click();assert.equal(await href('chat'),chat37);
 await close();
 for(const view of links){
  const expected=await href(view);
  await page.locator('#edit-'+view).hover();
  await page.locator('#'+view+'-url').click();
  await page.locator('#'+view+'-url[data-copied=true]').waitFor();
  assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),expected);
  assert.equal(new URL(expected).searchParams.has('preview'),false);
 }
 await page.reload();await page.locator('#edit-chat').click();
 await open.click();await dialog.locator('#preset-select').selectOption('custom:Smoke chat');await close();
 assert.equal(await page.locator('#opt-font').inputValue(),String(37));
 await page.evaluate("Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>Promise.reject(new Error('Access denied'))}})");
 const link=await href('chat');await page.locator('#edit-chat').hover();await page.locator('#chat-url').click();
 await page.locator('#source-link-dialog').waitFor();
 assert.equal(await page.locator('#manual-source-link').inputValue(),link);
 assert.equal(await page.locator('#manual-source-link').evaluate((el:HTMLInputElement)=>(el.selectionEnd??0)-(el.selectionStart??0)),link.length);
 await page.keyboard.press('Escape');
 await page.locator('#edit-chat').focus();await page.keyboard.press('ArrowDown');
 assert.equal(await page.locator('#enable-chat').evaluate((el:HTMLElement)=>document.activeElement===el),true);
 await page.keyboard.press('Space');
 assert.equal(await page.locator('#enable-chat').isChecked(),false);
 await page.keyboard.press('Escape');assert.ok(await page.locator('#workspace-tab-actions').isHidden());
 await page.waitForFunction(()=>document.querySelector<HTMLIFrameElement>('#chat-preview')?.contentDocument?.URL==='about:blank');
 assert.ok(await page.locator('.preview-card[data-view=chat] .preview-disabled').isVisible());
 await setFont(42);
 assert.equal(new URL(await href('chat')).searchParams.get('font'),'42');
 assert.equal(await page.locator('#chat-preview').getAttribute('src'),'about:blank');
 await page.reload();await page.locator('#edit-chat').click();
 await page.locator('#edit-chat').hover();
 assert.equal(await page.locator('#enable-chat').isChecked(),false);
 assert.equal(await page.locator('#chat-preview').getAttribute('src'),'about:blank');
 for(const view of ['wall','avatars','events']){
  await page.locator('#edit-'+view).hover();await page.locator('#enable-'+view).uncheck();
 }
 await page.locator('#compare-previews').click();
 assert.ok(await page.locator('#preview-empty').isVisible());
 assert.equal(await page.locator('.preview-card:visible').count(),0);
 await page.locator('#edit-chat').hover();await page.locator('#enable-chat').check();
 await page.waitForFunction(()=>document.querySelector<HTMLIFrameElement>('#chat-preview')?.contentDocument?.URL.includes('font=42'));
 assert.equal(await page.locator('.preview-card:visible').count(),1);
 assert.ok(await page.locator('#preview-empty').isHidden());
 const touch=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
 try{
  const phone=await touch.newPage();await phone.goto(base);
  await phone.locator('#edit-chat').tap();assert.ok(await phone.locator('#enable-chat').isVisible());
  await phone.locator('#enable-chat').tap();
  assert.equal(await phone.locator('#enable-chat').isChecked(),false);
  await phone.waitForFunction(()=>document.querySelector<HTMLIFrameElement>('#chat-preview')?.contentDocument?.URL==='about:blank');
 }finally{await touch.close();}
 assert.deepEqual(errors,[]);
 console.log('WORKSPACE HEADER PASS',JSON.stringify({copied:links,presetFont:37,defaultFont:DEFAULT_OPTIONS.font,fallback:true,errors}));
}finally{await browser?.close();await new Promise<void>(r=>server.httpServer.close(()=>r()));}
