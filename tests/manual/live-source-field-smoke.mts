// Production editor with an isolated, explicitly synthetic provider boundary.
// Uses real local HTTP + WebSocket hub; no public live joins or account changes.
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createLiveServer} from '../../server/http';
import type {LiveSource} from '../../server/hub';
const root=resolve(import.meta.dirname,'../..');
const entry=resolve(process.env.PLAYWRIGHT_ENTRY??resolve(root,'../neural-field-notes/node_modules/playwright/index.mjs'));
const {chromium}=await import(pathToFileURL(entry).href);
const dir=mkdtempSync(join(tmpdir(),'overlay-source-field-'));
const opened:string[]=[],closed:string[]=[];
const source:LiveSource={connect(o){const id=o.platform+':'+o.channel;opened.push(id);o.onStateChange?.('connected');return {close:()=>closed.push(id)};},emotes:async()=>({emotes:{},complete:true})};
const server=await createLiveServer({port:0,restore:false,root:resolve(root,'dist-demo'),source,configPath:join(dir,'state.json'),oauthFile:join(dir,'oauth.json'),cosmetics:()=>({resolve:async()=>null})});
let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_BIN??'/usr/bin/google-chrome-beta',args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 const errors:string[]=[];page.on('pageerror',(e:Error)=>errors.push(e.message));
 await page.goto(server.address);
 await page.waitForFunction(()=>!(document.querySelector<HTMLOptionElement>('#live-platform option[value=tiktok]')?.disabled));
 const trigger=page.locator('#live-platform-trigger'),channel=page.locator('#live-channel'),toggle=page.locator('#live-toggle'),menu=page.locator('#live-platform-menu');
 assert.equal(await trigger.textContent(),'');
 assert.ok(await trigger.locator('.live-platform-chevron').isVisible());
 assert.equal(await channel.getAttribute('placeholder'),'Twitch username');
 assert.ok(await toggle.isDisabled());
 async function choose(platform:string){
  await trigger.click();await menu.locator('button[data-platform='+platform+']').click();
  assert.equal(await trigger.locator('.overlay-service-badge').getAttribute('data-platform'),platform);
 }
 for(const [w,h] of [[1440,900],[1024,768],[390,844]]){
  await page.setViewportSize({width:w!,height:h!});
  const g=await page.evaluate(`(()=>{
   const rect=(id)=>{const r=document.querySelector(id).getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
   return {field:rect('.live-source-field'),trigger:rect('#live-platform-trigger'),channel:rect('#live-channel'),toggle:rect('#live-toggle'),inputPadding:parseFloat(getComputedStyle(document.querySelector('#live-channel')).paddingRight),toggleBackground:getComputedStyle(document.querySelector('#live-toggle')).backgroundImage,documentWidth:document.documentElement.scrollWidth};
  })()`);
  assert.ok(g.field.left<=g.trigger.left&&g.trigger.right<=g.channel.left+1);
  assert.ok(g.toggle.left>=g.channel.left&&g.toggle.right<=g.field.right);
  assert.ok(g.toggle.top>=g.field.top&&g.toggle.bottom<=g.field.bottom);
  assert.ok(g.inputPadding>=g.channel.right-g.toggle.left);
  assert.equal(await page.locator('.live-session #live-account').count(),0);
  assert.equal(g.toggleBackground,'none');
  assert.ok(g.documentWidth<=w!);
  await trigger.click();await menu.waitFor();
  assert.equal(await trigger.locator('.live-platform-chevron').evaluate((el:SVGElement)=>getComputedStyle(el).transform),'matrix(-1, 0, 0, -1, 0, 0)');
  assert.deepEqual(await menu.locator('button').allTextContents(),['Twitch','Kick','YouTube','TikTok']);
  const menuBox=await menu.boundingBox();assert.ok(menuBox&&menuBox.x>=0&&menuBox.x+menuBox.width<=w!);
  await page.keyboard.press('Escape');assert.ok(await menu.isHidden());
  await page.locator('#open-accounts').click();
  const accounts=page.locator('#accounts-dialog');
  await accounts.waitFor();
  await page.waitForFunction(()=>document.querySelector('#accounts-notice')?.textContent?.includes('Manage account authorization'));
  assert.equal(await accounts.locator('.account-row').count(),4);
  assert.ok((await accounts.locator('[data-provider=tiktok]').textContent()).includes('No sign-in'));
  const accountBox=await accounts.boundingBox();assert.ok(accountBox&&accountBox.x>=0&&accountBox.x+accountBox.width<=w!&&accountBox.y>=0&&accountBox.y+accountBox.height<=h!);
  await page.keyboard.press('Escape');assert.ok(await accounts.isHidden());
  console.log('GEOMETRY',JSON.stringify({viewport:w,fieldWidth:g.field.width,inputWidth:g.channel.width,menuWidth:menuBox.width}));
 }
 await page.setViewportSize({width:1440,height:900});
 const clients=async()=>Number((await (await fetch(server.address+'/api/live/status')).json()).clients);
 const waitClients=async(n:number)=>{
  const deadline=Date.now()+10000;
  while(await clients()!==n&&Date.now()<deadline)await new Promise(r=>setTimeout(r,50));
  assert.equal(await clients(),n);
 };
 await waitClients(5);
 await page.locator('#edit-avatars').hover();await page.locator('#enable-avatars').uncheck();
 await waitClients(4);
 await page.locator('#edit-avatars').hover();await page.locator('#enable-avatars').check();
 await waitClients(5);
 await channel.fill('fixture_twitch');await toggle.click();
 await page.locator('#live-sources .live-source-chip[data-platform=twitch]').waitFor();
 await choose('youtube');assert.equal(await channel.getAttribute('placeholder'),'YouTube live URL or video ID');
 await choose('tiktok');assert.equal(await channel.getAttribute('placeholder'),'TikTok username or LIVE URL');
 await channel.fill('@fixture_tiktok');await channel.press('Enter');
 await page.locator('#live-sources .live-source-chip[data-platform=tiktok]').waitFor();
 assert.deepEqual(opened,['twitch:fixture_twitch','tiktok:fixture_tiktok']);
 const twitchChip=page.locator('#live-sources .live-source-chip[data-platform=twitch]');
 const tiktokChip=page.locator('#live-sources .live-source-chip[data-platform=tiktok]');
 const sourceMenu=page.locator('#live-source-menu');
 for(const chip of [twitchChip,tiktokChip]){
  assert.equal(await chip.locator('.live-status-dot').count(),3);
  await chip.locator('.live-status-dot[data-mingcute=signal][data-state=connected]').waitFor();
 }
 await twitchChip.click();
 await sourceMenu.waitFor();
 assert.equal(await trigger.locator('.overlay-service-badge').getAttribute('data-platform'),'twitch');
 assert.equal(await channel.inputValue(),'fixture_twitch');
 assert.equal(await toggle.getAttribute('data-action'),'disconnect');
 await sourceMenu.locator('[data-action=reconnect]').click();
 await page.waitForFunction(()=>document.querySelectorAll('#live-sources .live-source-chip[data-platform=twitch] .live-status-dot[data-state=connected]').length===1);
 assert.deepEqual(opened,['twitch:fixture_twitch','tiktok:fixture_tiktok','twitch:fixture_twitch']);
 assert.deepEqual(closed,['twitch:fixture_twitch']);
 await twitchChip.click();await sourceMenu.locator('[data-action=disconnect]').click();
 await twitchChip.waitFor({state:'detached'});
 assert.deepEqual(closed,['twitch:fixture_twitch','twitch:fixture_twitch']);
 await tiktokChip.click();await sourceMenu.locator('[data-action=disconnect]').click();
 await tiktokChip.waitFor({state:'detached'});
 assert.deepEqual(closed,['twitch:fixture_twitch','twitch:fixture_twitch','tiktok:fixture_tiktok']);
 assert.deepEqual(errors,[]);
 console.log('SOURCE FIELD PASS',JSON.stringify({opened,closed,errors}));
}finally{await browser?.close();await server.close();rmSync(dir,{recursive:true,force:true});}
