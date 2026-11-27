// @vitest-environment node
import {describe,expect,it,vi} from 'vitest';
import {WebSocket} from 'ws';
import type {ChatEvent} from '@myrqyry/chatbus';
import {normalizeTwitchIrcFrame,parseTwitchIrcLine} from '@myrqyry/chatbus';
import {createHostedLiveServer} from '../server/hosted';
import type {LiveSource} from '../server/hub';

function listen(server:ReturnType<typeof createHostedLiveServer>):Promise<string>{
 return new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',()=>{
  const addr=server.address() as {port:number};
  resolve('http://127.0.0.1:'+addr.port);
 }));
}
function connect(origin:string,channel:string,platform:'twitch'|'kick'|'youtube'='twitch'):Promise<WebSocket>{
 return new Promise((resolve,reject)=>{
  const params=new URLSearchParams({channel});
  if(platform!=='twitch')params.set('platform',platform);
  const ws=new WebSocket(origin.replace('http:','ws:')+'/api/live?'+params.toString(),{origin});
  ws.once('open',()=>resolve(ws));ws.once('error',reject);
  ws.once('unexpected-response',(_req,r)=>reject(Error('HTTP '+r.statusCode)));
 });
}
const waitForPacket=(ws:WebSocket,test:(packet:any)=>boolean)=>new Promise<any>((resolve,reject)=>{
 const timer=setTimeout(()=>{ws.off('message',onMsg);reject(Error('packet timed out'));},3500);
 const onMsg=(raw:unknown)=>{const value=JSON.parse(String(raw));if(test(value)){
  clearTimeout(timer);ws.off('message',onMsg);resolve(value);
 }};
 ws.on('message',onMsg);
});
describe('per-source hosted channels',()=>{
 it('allows two independent channel URLs without leaking either rooms events',async()=>{
  const callbacks=new Map<string,(event:ChatEvent)=>void>();
  const closeSpy=vi.fn();
  const source:LiveSource={
   connect({channel,onEvent,onStateChange}){
    callbacks.set(channel,onEvent);
    onStateChange?.('connected');
    return {close:()=>{closeSpy(channel);callbacks.delete(channel);}};
   },
   emotes:async()=>({emotes:{},complete:true})
  };
  const server=createHostedLiveServer({channel:'default',source,cosmetics:()=>({resolve:async()=>null}),maxRooms:2});
  const address=await listen(server);
  let left:WebSocket|undefined,right:WebSocket|undefined;
  try{
   left=await connect(address,'alpha');
   right=await connect(address,'beta');
   const statuses=await Promise.all([
    waitForPacket(left,p=>p.type==='status'&&p.status.channel==='alpha'),
    waitForPacket(right,p=>p.type==='status'&&p.status.channel==='beta'),
   ]);
   expect(statuses.map(x=>x.status.channel)).toEqual(['alpha','beta']);
   const received=waitForPacket(right,p=>p.type==='event'&&p.event?.type==='message');
   callbacks.get('beta')!(normalizeTwitchIrcFrame(parseTwitchIrcLine(
     '@id=b;display-name=Beta;user-id=20 :beta!beta@beta.tmi.twitch.tv PRIVMSG #beta :Hi beta')!,
     {channel:'beta',fallbackId:'unused'})!);
   expect((await received).event.message.parts).toEqual([{type:'text',text:'Hi beta'}]);
   expect(callbacks.has('alpha')).toBe(true);
   const exit=new Promise(r=>left!.once('close',r));left.close();await exit;
   await vi.waitFor(()=>expect(closeSpy).toHaveBeenCalledWith('alpha'));
   expect(closeSpy).not.toHaveBeenCalledWith('beta');
  }finally{left?.terminate();right?.terminate();await new Promise(r=>server.close(r));}
 });
 it('keeps Twitch and Kick rooms separate even when the channel slug is identical',async()=>{
  const callbacks=new Map<string,(event:ChatEvent)=>void>();
  const source:LiveSource={
   connect({platform='twitch',channel,onEvent,onStateChange}){
    callbacks.set(platform+':'+channel,onEvent);onStateChange?.('connected');
    return {close:()=>callbacks.delete(platform+':'+channel)};
   },
   emotes:async()=>({emotes:{},complete:true}),
  };
  const server=createHostedLiveServer({channel:'same',source,cosmetics:()=>({resolve:async()=>null}),maxRooms:2});
  const address=await listen(server);
  let twitch:WebSocket|undefined,kick:WebSocket|undefined;
  try{
   twitch=await connect(address,'same','twitch');
   kick=await connect(address,'same','kick');
   await vi.waitFor(()=>expect([...callbacks.keys()].sort()).toEqual(['kick:same','twitch:same']));
   const twitchEvent=waitForPacket(twitch,p=>p.type==='event'&&p.event?.message?.id==='twitch:same:t-same');
   const kickEvent=waitForPacket(kick,p=>p.type==='event'&&p.event?.message?.id==='kick:same:k-same');
   callbacks.get('twitch:same')!({
    type:'message',platform:'twitch',channelName:'same',timestamp:1,
    message:{id:'t-same',platform:'twitch',channelName:'same',timestamp:1,
      user:{platform:'twitch',username:'tviewer'},text:'Twitch',fragments:[{type:'text',text:'Twitch'}]},
   });
   callbacks.get('kick:same')!({
    type:'message',platform:'kick',channelName:'same',timestamp:2,
    message:{id:'k-same',platform:'kick',channelName:'same',timestamp:2,
      user:{platform:'kick',username:'kviewer'},text:'Kick',fragments:[{type:'text',text:'Kick'}]},
   });
   expect((await twitchEvent).event.message).toMatchObject({id:'twitch:same:t-same',sourceId:'twitch:same',platform:'twitch'});
   expect((await kickEvent).event.message).toMatchObject({id:'kick:same:k-same',sourceId:'kick:same',platform:'kick'});
  }finally{twitch?.terminate();kick?.terminate();await new Promise(r=>server.close(r));}
 });

 it('routes a YouTube video ID as its own hosted room without lowering its case-sensitive target',async()=>{
  const seen:any[]=[];
  const source:LiveSource={connect:options=>{seen.push([options.platform,options.channel]);options.onStateChange?.('connected');return {close:()=>{}};},
    emotes:async()=>({emotes:{},complete:true})};
  const server=createHostedLiveServer({channel:'default',source,maxRooms:2});
  const address=await listen(server);let youtube:WebSocket|undefined;
  try{
    youtube=await connect(address,'dQw4w9WgXcQ','youtube');
    await vi.waitFor(()=>expect(seen).toContainEqual(['youtube','dQw4w9WgXcQ']));
  }finally{youtube?.terminate();await new Promise(r=>server.close(r));}
 });

 it('rejects malformed channels and caps concurrent independently connected rooms',async()=>{
  const source:LiveSource={connect:vi.fn(()=>({close:vi.fn()})),emotes:async()=>({emotes:{},complete:true})};
  const server=createHostedLiveServer({channel:'default',source,maxRooms:1});
  const address=await listen(server);
  let first:WebSocket|undefined;
  try{
   first=await connect(address,'alpha');
   await expect(connect(address,'beta')).rejects.toThrow();
   await expect(connect(address,'bad!channel')).rejects.toThrow();
   expect(source.connect).toHaveBeenCalledTimes(1);
  }finally{first?.terminate();await new Promise(r=>server.close(r));}
 });
});
