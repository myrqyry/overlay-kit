import {describe,it,expect,vi} from 'vitest';
import {normalizeViewerChannel,readViewerSources,withViewerSources} from '../src/channel-choice';
import {createLiveMixer,chatbusLiveSource,type LiveSource} from '../server/hub';
import {normalizeTikTokEvent} from '@myrqyry/chatbus';
import {createChatMessageElement} from '../src/renderers';
import {formatSocialAlert} from '../src/events';
import {hostedPlatforms} from '../server/hosted-channel';
import {createHostedLiveServer} from '../server/hosted';
import {createLiveServer} from '../server/http';
import {WebSocket} from 'ws';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const context={channel:'creator',roomId:'1234567890123456789',receivedAt:1700000000000};
const common={msgId:'9876543210987654321',roomId:context.roomId,createTime:'1700000000000'};
const user={id:'1234567890123456780',displayId:'viewer',nickname:'Viewer'};
describe('TikTok source in existing overlay mixer',()=>{
 it('validates handles and URLs and preserves mixed source selection',()=>{
  expect(normalizeViewerChannel('@Creator','tiktok')).toBe('creator');
  expect(normalizeViewerChannel('https://www.tiktok.com/@Creator/live','tiktok')).toBe('creator');
  expect(normalizeViewerChannel('https://evil.test/@creator/live','tiktok')).toBeNull();
  const sources=[{platform:'kick' as const,channel:'creator'},{platform:'tiktok' as const,channel:'creator'}];
  expect(readViewerSources(withViewerSources('chat.html',sources).split('?')[1]!)).toEqual(sources);
  expect(withViewerSources('chat.html',[])).toBe('chat.html?live=0');
 });
 it('advertises TikTok without extra configuration and honors explicit host opt-out',()=>{
  vi.stubEnv('OVERLAY_HOSTED_TIKTOK',undefined);
  try{
   expect(hostedPlatforms()).toContain('tiktok');
   vi.stubEnv('OVERLAY_HOSTED_TIKTOK','0');
   expect(hostedPlatforms()).not.toContain('tiktok');
   vi.stubEnv('OVERLAY_HOSTED_TIKTOK','1');
   expect(hostedPlatforms()).toContain('tiktok');
  }finally{vi.unstubAllEnvs();}
 });
 it('mixes normalized TikTok chat and gift signals without leaking raw fields, removes only TikTok',async()=>{
  const callbacks=new Map<string,Parameters<LiveSource['connect']>[0]>();
  const close=vi.fn();
  const source:LiveSource={connect(options){const key=options.platform+':'+options.channel;callbacks.set(key,options);options.onStateChange?.('connected');return {close:()=>close(key)};},emotes:async()=>({emotes:{},complete:true})};
  const packets:any[]=[];
  const hub=createLiveMixer(source,p=>packets.push(p),undefined,()=>({resolve:async()=>null}));
  try{
   hub.addSource('creator','kick');hub.addSource('@creator','tiktok');
   const tt=callbacks.get('tiktok:creator')!;
   const message=normalizeTikTokEvent('chat',{common,user,content:'hello'},context)!;
   tt.onEvent({...message,origin:'live'});
   const gift=normalizeTikTokEvent('gift',{common:{...common,msgId:'gift1'},user,giftId:'1',repeatCount:3,repeatEnd:1,gift:{type:1,name:'Rose',diamondCount:1}},context)!;
   tt.onEvent({...gift,origin:'live'});
   expect(packets.find(p=>p.event?.type==='message')?.event.message).toMatchObject({platform:'tiktok',sourceId:'tiktok:creator',id:'tiktok:creator:'+common.msgId,parts:[{type:'text',text:'hello'}]});
   const row=createChatMessageElement(packets.find(p=>p.event?.type==='message').event.message);
   expect(row.querySelector('.overlay-service-badge[data-platform="tiktok"]')?.getAttribute('aria-label')).toBe('TikTok');
   const signal=packets.find(p=>p.signal?.event.type==='donation').signal;
   expect(formatSocialAlert(signal)).toMatchObject({kind:'donation',title:'TikTok gift',message:'Viewer sent 3 gifts on TikTok!'});
   expect(signal.measurements).toEqual({count:3});
   expect(JSON.stringify(packets)).not.toContain('"raw":');
   hub.removeSource('creator','tiktok');
   expect(close).toHaveBeenCalledWith('tiktok:creator');
   expect(close).not.toHaveBeenCalledWith('kick:creator');
   expect(hub.status().sources.map(s=>s.platform)).toEqual(['kick']);
   const before=packets.length;tt.onEvent(message);expect(packets).toHaveLength(before);
  }finally{hub.close();}
 });
 it('advertises TikTok in the existing local server and routes an add/remove without touching other channels',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'overlay-tiktok-'));
  const close=vi.fn();
  const source:LiveSource={connect(o){o.onStateChange?.('connected');return {close:()=>close(o.platform+':'+o.channel)};},emotes:async()=>({emotes:{},complete:true})};
  const s=await createLiveServer({port:0,source,restore:false,configPath:join(dir,'state.json'),oauthFile:join(dir,'oauth.json'),cosmetics:()=>({resolve:async()=>null})});
  try{
   expect((await fetch(s.address+'/api/live/status').then(r=>r.json())).platforms).toContain('tiktok');
   const command=(action:string,platform:string,channel:string)=>fetch(s.address+'/api/live/'+action,{method:'POST',headers:{Origin:s.address,'Content-Type':'application/json'},body:JSON.stringify({platform,channel,combine:true})});
   expect((await command('connect','tiktok','@Creator')).status).toBe(200);
   expect((await command('connect','youtube','dQw4w9WgXcQ')).status).toBe(200);
   expect((await command('disconnect','tiktok','creator')).status).toBe(200);
   expect(s.hub.status().sources.map(x=>x.platform)).toEqual(['youtube']);
   expect(close).toHaveBeenCalledTimes(1);
  }finally{await s.close();rmSync(dir,{recursive:true,force:true});}
 });
 it('admits TikTok by default and enforces explicit hosted opt-out',async()=>{
  const connect=vi.fn((o:Parameters<LiveSource['connect']>[0])=>{
    o.onStateChange?.('connected');return {close:vi.fn()};
  });
  const source:LiveSource={connect,emotes:async()=>({emotes:{},complete:true})};
  for(const enabled of ['0', undefined]){
   vi.stubEnv('OVERLAY_HOSTED_TIKTOK',enabled);
   const server=createHostedLiveServer({source,channel:'default'});
   await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
   const a=server.address();if(!a||typeof a==='string')throw Error('No address');
   const origin='http://127.0.0.1:'+a.port;
   let socket:WebSocket|undefined;
   try{
    const result=await new Promise<number>((resolve,reject)=>{
     socket=new WebSocket(origin.replace('http:','ws:')+'/api/live?platform=tiktok&channel=creator',{origin});
     socket.once('open',()=>resolve(101));
     socket.once('unexpected-response',(_req,res)=>{res.resume();resolve(res.statusCode!);});
     socket.once('error',reject);
    });
    expect(result).toBe(enabled==='0'?403:101);
    if(enabled!=='0')await vi.waitFor(()=>expect(connect).toHaveBeenCalledTimes(1));
    else expect(connect).not.toHaveBeenCalled();
   }finally{socket?.terminate();await new Promise<void>(resolve=>server.close(()=>resolve()));vi.unstubAllEnvs();}
  }
 });

});
