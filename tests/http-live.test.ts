// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { WebSocket } from 'ws';
import type { ChatEvent } from '@myrqyry/chatbus';
import { createLiveServer } from '../server/http';
import type { LiveSource } from '../server/hub';
import { parseTwitchIrcLine, normalizeTwitchIrcFrame } from '@myrqyry/chatbus';
import { resolve } from 'node:path';

function waitPacket(ws: WebSocket, type: string): Promise<any> {
 return new Promise((ok,bad)=>{
  const timer=setTimeout(()=>{ws.off('message',receive);bad(new Error('Packet timeout '+type));},4000);
  const receive=(data:Buffer)=>{
   const packet = JSON.parse(String(data));
   if(packet.type!==type)return;
   clearTimeout(timer);ws.off('message',receive);ok(packet);
  };
  ws.on('message',receive);
 });
}
async function client(url: string, origin: string): Promise<WebSocket> {
 return new Promise((ok,bad)=>{
  const ws=new WebSocket(url,{origin});
  ws.once('open',()=>ok(ws));
  ws.once('error',bad);
 });
}
describe('loopback Chatbus HTTP + independent WebSocket source',()=>{
 it('enforces origin, serves built pages and propagates IRC-normalized Chatbus events',async()=>{
  let onEvent: ((event:ChatEvent)=>void)|undefined;
  const closeSpy=vi.fn();
  const source:LiveSource = {
   connect(opts){onEvent=opts.onEvent;opts.onStateChange?.('connected');return {close:closeSpy};},
   emotes: async()=>({complete:true,emotes:{}}),
  };
  const server=await createLiveServer({port:0,source,root:resolve('dist-demo'),restore:false,cosmetics:()=>({resolve:async()=>null})});
  let ws:WebSocket|undefined;
  try {
   const addr=server.address;
   expect((await fetch(addr+'/')).status).toBe(200);
   expect((await fetch(addr+'/chat.html')).status).toBe(200);
   expect((await fetch(addr+'/events.html')).status).toBe(200);
   expect((await fetch(addr+'/api/live/status').then(r=>r.json())).service).toBe('overlay-kit-live');
   expect((await fetch(addr+'/../../etc/passwd')).status).toBe(404);
   const forbidden=await fetch(addr+'/api/live/connect',{method:'POST',headers:{
    Origin:'https://example.invalid','Content-Type':'application/json'},body:JSON.stringify({channel:'tester'})});
   expect(forbidden.status).toBe(403);
   expect(server.hub.status().channel).toBeNull();
   const invalid=await fetch(addr+'/api/live/connect',{method:'POST',headers:{
    Origin:addr,'Content-Type':'application/json'},body:JSON.stringify({channel:'bad!channel'})});
   expect(invalid.status).toBe(400);
   ws=await client(addr.replace('http:','ws:')+'/live',addr);
   const eventPacket=waitPacket(ws,'event');
   const signalPacket=waitPacket(ws,'signal');
   const response=await fetch(addr+'/api/live/connect',{method:'POST',headers:{
    Origin:addr,'Content-Type':'application/json'},body:JSON.stringify({channel:'example'})});
   expect(response.status).toBe(200);
   expect(server.hub.status().channel).toBe('example');
   expect(onEvent).toBeTypeOf('function');
   const frame=parseTwitchIrcLine(
    '@id=realmsg;display-name=Viewer;color=#ff55aa;user-id=u123 :viewer!viewer@viewer.tmi.twitch.tv PRIVMSG #example :hello world');
   expect(frame).not.toBeNull();
   const normalized=normalizeTwitchIrcFrame(frame!,{channel:'example',fallbackId:'unused'});
   expect(normalized?.type).toBe('message');
   onEvent!(normalized!);
   const packet=await eventPacket;
   expect(await signalPacket).toMatchObject({type:'signal',signal:{
     producer:'chatbus',schemaVersion:1,event:{type:'message'},
     actor:{username:'viewer'},message:{id:'realmsg',text:'hello world'},
   }});
   expect(packet.event).toMatchObject({type:'message',message:{
    id:'twitch:example:realmsg',sourceId:'twitch:example',
    user:{id:'u123',name:'Viewer'},parts:[{type:'text',text:'hello world'}]}});
   expect(JSON.stringify(packet)).not.toContain('tmi.twitch.tv');
   // Verify an actual subscription signal crosses the live socket independent of chat rows.
   const subPacket=waitPacket(ws,'signal');
   onEvent!({type:'subscription',id:'sub-wire-1',platform:'twitch',channelName:'example',
     timestamp:Date.now(),user:{platform:'twitch',id:'sub-user',username:'newsub',displayName:'NewSub'}});
   expect(await subPacket).toMatchObject({type:'signal',signal:{
     schemaVersion:1,producer:'chatbus',event:{type:'subscription',id:'sub-wire-1'},
     actor:{username:'newsub',displayName:'NewSub'},
   }});

   const clearPacket=waitPacket(ws,'event');
   await fetch(addr+'/api/live/disconnect',{method:'POST',headers:{
    Origin:addr,'Content-Type':'application/json'},body:'{}'});
   expect((await clearPacket).event).toEqual({type:'clear',sourceId:'twitch:example'});
   expect(closeSpy).toHaveBeenCalledTimes(1);
  }finally{ws?.close();await server.close();}
 });
 it('combines several local sources on one read-only stream and removes only the selected source',async()=>{
  const callbacks=new Map<string,(event:ChatEvent)=>void>();
  const closed:string[]=[];
  const source:LiveSource={
   connect:options=>{
    const key=(options.platform??'twitch')+':'+options.channel;
    callbacks.set(key,options.onEvent);options.onStateChange?.('connected');
    return {close:()=>{closed.push(key);callbacks.delete(key);}};
   },
   emotes:async()=>({emotes:{},complete:true}),
  };
  const server=await createLiveServer({port:0,source,root:resolve('dist-demo'),restore:false,cosmetics:()=>({resolve:async()=>null})});
  let ws:WebSocket|undefined;
  try{
   ws=await client(server.address.replace('http:','ws:')+'/live',server.address);
   const twitch=await fetch(server.address+'/api/live/connect',{method:'POST',headers:{
    Origin:server.address,'Content-Type':'application/json'},body:JSON.stringify({channel:'alpha'})});
   expect(twitch.status).toBe(200);
   const youtube=await fetch(server.address+'/api/live/connect',{method:'POST',headers:{
    Origin:server.address,'Content-Type':'application/json'},body:JSON.stringify({
      platform:'youtube',channel:'dQw4w9WgXcQ',combine:true})});
   expect(youtube.status).toBe(200);
   const status=await fetch(server.address+'/api/live/status').then(r=>r.json()) as any;
   expect(status.platforms).toContain('youtube');
   expect(status.status.sources.map((s:any)=>[s.platform,s.channel])).toEqual([
    ['twitch','alpha'],['youtube','dQw4w9WgXcQ'],
   ]);
   const packet=waitPacket(ws,'event');
   callbacks.get('youtube:dQw4w9WgXcQ')!({type:'message',platform:'youtube',timestamp:2,
    message:{id:'yt-msg',platform:'youtube',timestamp:2,user:{platform:'youtube',id:'yu',username:'viewer'},
      text:'hi yt',fragments:[{type:'text',text:'hi yt'}]}});
   expect(await packet).toMatchObject({type:'event',event:{type:'message',message:{
    id:'youtube:dQw4w9WgXcQ:yt-msg',sourceId:'youtube:dQw4w9WgXcQ',platform:'youtube'}}});
   const remove=await fetch(server.address+'/api/live/disconnect',{method:'POST',headers:{
    Origin:server.address,'Content-Type':'application/json'},body:JSON.stringify({platform:'youtube',channel:'dQw4w9WgXcQ'})});
   expect(remove.status).toBe(200);
   expect((await remove.json() as any).status.sources.map((s:any)=>s.platform)).toEqual(['twitch']);
   expect(closed).toEqual(['youtube:dQw4w9WgXcQ']);
  }finally{ws?.close();await server.close();}
 });

 it('accepts Kick as a first-class local Chatbus source while old connect bodies remain Twitch',async()=>{
  const seen:any[]=[];
  const source:LiveSource={
   connect:options=>{seen.push({platform:options.platform,channel:options.channel});
    options.onStateChange?.('connected');return {close:()=>{}};},
   emotes:async()=>({emotes:{},complete:true}),
  };
  const server=await createLiveServer({port:0,source,root:resolve('dist-demo'),restore:false,cosmetics:()=>({resolve:async()=>null})});
  try{
   const kick=await fetch(server.address+'/api/live/connect',{method:'POST',headers:{
    Origin:server.address,'Content-Type':'application/json'},
    body:JSON.stringify({platform:'kick',channel:'xqc'})});
   expect(kick.status).toBe(200);
   expect(server.hub.status()).toMatchObject({platform:'kick',channel:'xqc',state:'connected'});
   await fetch(server.address+'/api/live/disconnect',{method:'POST',headers:{
    Origin:server.address,'Content-Type':'application/json'},body:'{}'});
   const twitch=await fetch(server.address+'/api/live/connect',{method:'POST',headers:{
    Origin:server.address,'Content-Type':'application/json'},body:JSON.stringify({channel:'example'})});
   expect(twitch.status).toBe(200);
   expect(server.hub.status()).toMatchObject({platform:'twitch',channel:'example'});
   expect(seen).toEqual([
    {platform:'kick',channel:'xqc'},
    {platform:'twitch',channel:'example'},
   ]);
  }finally{await server.close();}
 });
});

describe('late Twitch badges through real HTTP and WebSocket clients',()=>{
 it('delivers immediate Chatbus message then updates exact badge icons from catalog',async()=>{
  let receive:((e:ChatEvent)=>void)|undefined;
  const source:LiveSource={
    connect:opts=>{receive=opts.onEvent;opts.onStateChange?.('connected');return {close:()=>{}};},
    emotes:async()=>({emotes:{},complete:true}),
  };
  const globalData:any[]=[{set_id:'moderator',versions:[{id:'1',title:'Moderator',
   image_url_1x:'https://static-cdn.jtvnw.net/badges/v1/mod-uuid/1'}]}];
  let completeGlobal:(value:unknown)=>void=()=>{};
  const { createTwitchBadgeCatalog } = await import('../server/twitch-badges');
  const server=await createLiveServer({port:0,restore:false,cosmetics:()=>({resolve:async()=>null}),root:resolve('dist-demo'),source,
    badgeCatalog:()=>createTwitchBadgeCatalog(url=>url.includes('global')
      ? new Promise(ok=>{completeGlobal=ok;}) : Promise.resolve([]))});
  let ws:WebSocket|undefined;
  try {
    ws=await client(server.address.replace('http:','ws:')+'/live',server.address);
    await fetch(server.address+'/api/live/connect',{method:'POST',headers:{
      Origin:server.address,'Content-Type':'application/json'},body:'{"channel":"sample"}'});
    const initial=waitPacket(ws,'event');
    const event=normalizeTwitchIrcFrame(parseTwitchIrcLine(
      '@id=m124;badges=moderator/1;room-id=71092938;display-name=Viewer;user-id=12 :viewer!v@tmi.twitch.tv PRIVMSG #sample :Hello')!,
      {channel:'sample',fallbackId:'fallback'});
    expect(event?.message?.user.badgeRefs).toEqual([{provider:'twitch',id:'moderator',version:'1'}]);
    receive!(event!);
    const message=await initial;
    expect(message.event).toMatchObject({type:'message',message:{user:{badges:[]}}});
    const update=waitPacket(ws,'event');
    completeGlobal(globalData);
    const packet=await update;
    expect(packet.event).toEqual({type:'badges',messageId:'twitch:sample:m124',
      badges:[{provider:'twitch',id:'moderator',name:'Moderator',url:'https://static-cdn.jtvnw.net/badges/v1/mod-uuid/1'}]});
  }finally{ws?.close();await server.close();}
 });
 it('reconnects exactly one configured source and rejects absent or foreign targets',async()=>{
  const opened:string[]=[],closed:string[]=[];
  const source:LiveSource={connect(o){const key=o.platform+':'+o.channel;opened.push(key);o.onStateChange?.('connected');return {close:()=>closed.push(key)};},emotes:async()=>({complete:true,emotes:{}})};
  const s=await createLiveServer({port:0,source,restore:false,cosmetics:()=>({resolve:async()=>null})});
  try{
   const post=(action:string,platform:string,channel:string,origin=s.address)=>fetch(s.address+'/api/live/'+action,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({platform,channel,combine:true})});
   await post('connect','twitch','garden');await post('connect','kick','garden');
   expect((await post('reconnect','kick','garden','https://foreign.invalid')).status).toBe(403);
   expect((await post('reconnect','kick','not_active')).status).toBe(404);
   expect((await post('reconnect','kick','garden')).status).toBe(200);
   expect(opened).toEqual(['twitch:garden','kick:garden','kick:garden']);
   expect(closed).toEqual(['kick:garden']);
   expect(s.hub.status().sources.map(x=>x.platform).sort()).toEqual(['kick','twitch']);
  }finally{await s.close();}
 });

});
