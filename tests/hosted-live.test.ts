// @vitest-environment node
import {describe,expect,it,vi} from 'vitest';
import {WebSocket} from 'ws';
import type {ChatEvent} from '@myrqyry/chatbus';
import {normalizeTwitchIrcFrame,parseTwitchIrcLine} from '@myrqyry/chatbus';
import type {LiveSource} from '../server/hub';
import {createHostedLiveServer,normalizeHostedChannel} from '../server/hosted';

function listen(server:ReturnType<typeof createHostedLiveServer>):Promise<string>{
 return new Promise((resolve,reject)=>{
  server.once('error',reject);
  server.listen(0,'127.0.0.1',()=>{
   server.off('error',reject);
   const port=(server.address() as {port:number}).port;
   resolve('http://127.0.0.1:'+port);
  });
 });
}
function packet(ws:WebSocket,type:string,predicate:(value:any)=>boolean=()=>true):Promise<any>{
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{ws.off('message',onMessage);reject(new Error('Timed out: '+type));},4000);
  const onMessage=(raw:unknown)=>{
   const result=JSON.parse(String(raw));
   if(result.type!==type||!predicate(result))return;
   clearTimeout(timer);ws.off('message',onMessage);resolve(result);
  };
  ws.on('message',onMessage);
 });
}
function open(addr:string,origin=addr):Promise<WebSocket>{
 return new Promise((resolve,reject)=>{
  const ws=new WebSocket(addr.replace('http:','ws:')+'/api/live?channel=allowed',{origin});
  ws.once('open',()=>resolve(ws));ws.once('error',reject);
 });
}
function close(server:ReturnType<typeof createHostedLiveServer>){
 return new Promise<void>(resolve=>server.close(()=>resolve()));
}
describe('hosted WebSocket Chatbus adapter',()=>{
 it('accepts same-origin listeners on their chosen channel, sends real Chatbus projection, and closes upstream when idle',async()=>{
  let onEvent:((event:ChatEvent)=>void)|undefined;
  const ended=vi.fn();
  const source:LiveSource={connect(options){
   expect(options.channel).toBe('allowed');
   onEvent=options.onEvent;options.onStateChange?.('connected');
   return {close:ended};
  },emotes:async()=>({emotes:{},complete:true})};
  const server=createHostedLiveServer({channel:'allowed',source,cosmetics:()=>({resolve:async()=>null})});
  const addr=await listen(server);let ws:WebSocket|undefined;
  try{
   const deny=await fetch(addr+'/api/live');
   expect(deny.status).toBe(426);
   ws=await open(addr);
   const status=await packet(ws,'status',x=>x.status.state==='connected');
   expect(status.status.channel).toBe('allowed');
   const next=packet(ws,'event',x=>x.event.type==='message');
   const real=normalizeTwitchIrcFrame(parseTwitchIrcLine(
    '@id=real;display-name=Viewer;user-id=42 :viewer!viewer@viewer.tmi.twitch.tv PRIVMSG #allowed :Hi!')!,
     {channel:'allowed',fallbackId:'unused'});
   onEvent!(real!);
   expect((await next).event).toMatchObject({type:'message',message:{
    id:'twitch:allowed:real',sourceId:'twitch:allowed',user:{name:'Viewer'},parts:[{type:'text',text:'Hi!'}]
   }});
   const closed=new Promise(resolve=>ws!.once('close',resolve));
   ws.send('{"type":"connect","channel":"other"}');
   await closed;
   await vi.waitFor(()=>expect(ended).toHaveBeenCalledOnce());
  }finally{ws?.terminate();await close(server);}
 });
 it('rejects foreign origins and refuses to start without a configured server channel',async()=>{
  const source:LiveSource={connect:vi.fn(()=>({close:vi.fn()})),emotes:async()=>({emotes:{},complete:true})};
  const server=createHostedLiveServer({channel:'',source});
  const addr=await listen(server);
  try{
   expect(normalizeHostedChannel(' Bad!Name ')).toBeNull();
   expect(normalizeHostedChannel('  #Good_12 ')).toBe('good_12');
   await expect(open(addr,'https://evil.invalid')).rejects.toThrow();
   await expect(new Promise((resolve,reject)=>{
    const ws=new WebSocket(addr.replace('http:','ws:')+'/api/live?channel=bad!channel',{origin:addr});
    ws.once('open',()=>resolve(ws));ws.once('error',reject);
   })).rejects.toThrow();
   expect(source.connect).not.toHaveBeenCalled();
  }finally{await close(server);}
 });
});
