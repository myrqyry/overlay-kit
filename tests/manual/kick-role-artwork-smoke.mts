// Real public artwork lookup, synthetic chat over the production HTTP/WebSocket host.
// Keeps all configuration isolated from running streams and never saves provider artwork.
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createLiveServer} from '../../server/http';
import {createKickRoleArtworkLoader,createKickBadgeCatalog} from '@myrqyry/chatbus';
import {normalizeKickEvent,type ChatEvent} from '@myrqyry/chatbus';
import type {LiveSource} from '../../server/hub';
const root=resolve(import.meta.dirname,'../..');
const entry=resolve(process.env.PLAYWRIGHT_ENTRY??resolve(root,'../neural-field-notes/node_modules/playwright/index.mjs'));
const {chromium}=await import(pathToFileURL(entry).href);
const channel=process.argv[2]??'nickwhite';
const dir=mkdtempSync(join(tmpdir(),'overlay-kick-role-art-'));
let send!:(event:ChatEvent)=>void;
const source:LiveSource={
 connect(options){send=options.onEvent;options.onStateChange?.('connected');return {close(){}};},
 emotes:async()=>({emotes:{},complete:true}),
};
let release!:()=>void;
const gate=new Promise<void>(r=>{release=r;});
const load=createKickRoleArtworkLoader();
let found:Awaited<ReturnType<typeof load>>={};
const server=await createLiveServer({port:0,restore:false,root:resolve(root,'dist-demo'),
 oauthFile:join(dir,'oauth.json'),configPath:join(dir,'state.json'),source,
 kickBadgeCatalog:()=>createKickBadgeCatalog(undefined,async slug=>{found=await load(slug);await gate;return found;}),
});
let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_BIN??'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1000,height:720}});
 const errors:string[]=[];page.on('pageerror',(e:Error)=>errors.push(e.message));
 await page.goto(server.address+'/chat.html?ttl=120&enter=none');
 server.hub.connect(channel,'kick');
 const cases=[['moderator','Moderator',undefined],['verified','Verified',undefined],['sub_gifter','Sub Gifter',1],['sub_gifter','Sub Gifter',25]] as const;
 for(const [i,[type,text,count]] of cases.entries()){
  const event=normalizeKickEvent({type:'ChatMessage',data:{id:'art-'+i,chatroom_id:42,content:'Synthetic artwork test',created_at:new Date().toISOString(),sender:{id:i+100,username:'fixture'+i,identity:{badges:[{type,text,...(count?{count}:{})}]}}}},{channelName:channel})!;
  send(event);
 }
 await page.waitForFunction(()=>document.querySelectorAll('[data-badge-fallback]').length===4);
 const before=await page.locator('.overlay-chat-message').count();assert.equal(before,4);
 await page.locator('[data-message-id]').first().evaluate((el:HTMLElement)=>el.dataset.artSmoke='original');
 assert.deepEqual(Object.keys(await load(channel)).sort(),['gift-1','gift-25','moderator','verified']);
 release();
 await page.waitForFunction(()=>Array.from(document.querySelectorAll<HTMLImageElement>('img.overlay-badge[src^="data:image/svg+xml,"]')).filter(i=>i.complete&&i.naturalWidth>0).length===4);
 assert.equal(await page.locator('.overlay-chat-message').count(),before);
 assert.equal(await page.locator('[data-art-smoke="original"]').count(),1);
 assert.equal(await page.locator('[data-badge-fallback]').count(),0);
 assert.deepEqual(errors,[]);
 console.log('PASS real Kick SVG acquisition -> connection enrichment -> WebSocket -> all four decoded browser images; original message row retained');
}finally{release();await browser?.close();await server.close();rmSync(dir,{recursive:true,force:true});}
