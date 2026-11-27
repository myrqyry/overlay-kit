import {createKickBadgeCatalog,type KickBadgeCatalog} from '@myrqyry/chatbus';
import {loadTwitchSourcePortrait} from './twitch-source-identity';
/** Bounded per-channel Chatbus WebSocket rooms for hosted Overlay Kit.
 * Each channel is owned by its listeners, not a mutable global channel.
 * No unauthenticated control packets; switching channels means connecting
 * a different stream, not redirecting somebody else's existing stream.
 */
import {createServer} from 'node:http';
import type {IncomingMessage} from 'node:http';
import {WebSocketServer,WebSocket} from 'ws';
import {chatbusLiveSource,createLiveMixer,type LiveSource,type ServerPacket} from './hub';
import {normalizeHostedChannel,normalizeHostedPlatform,hostedPlatforms} from './hosted-channel';
export {normalizeHostedChannel,normalizeHostedPlatform} from './hosted-channel';
import type {LivePlatform} from '../src/live-platform';
import {createTwitchBadgeCatalog,type TwitchBadgeCatalog} from './twitch-badges';
import {fetchKickUserAvatar,fetchTwitchUserAvatar} from '@myrqyry/chatbus';
import {createUserCosmeticsResolver,type CosmeticResolver} from './cosmetics';

type Cosmetics=Pick<CosmeticResolver,'resolve'> & Partial<Pick<CosmeticResolver,'close'>>;
export interface HostedLiveOptions {
  platform?:LivePlatform;
  channel?:string;
  source?:LiveSource;
  /** Optional shared Chatbus catalog factory for isolated hosts/tests. */
  kickBadgeCatalog?:()=>KickBadgeCatalog;
  badgeCatalog?:()=>TwitchBadgeCatalog;
  cosmetics?:()=>Cosmetics;
  maxClients?:number;
  maxRooms?:number;
}
function sameOrigin(req:IncomingMessage):boolean {
 const origin=req.headers.origin;
 const host=req.headers.host;
 if(typeof origin!=='string'||typeof host!=='string')return false;
 try{
  const address=new URL(origin);
  const loopback=host.startsWith('127.0.0.1:')||host.startsWith('localhost:');
  return address.host===host &&
    (address.protocol==='https:'||(loopback&&address.protocol==='http:'));
 }catch{return false;}
}
interface Room {
  hub:ReturnType<typeof createLiveMixer>;
  sockets:Set<WebSocket>;
}
export function createHostedLiveServer(options:HostedLiveOptions={}) {
 const platforms=hostedPlatforms();
 const requestedDefault=normalizeHostedPlatform(options.platform)??'twitch';
 const defaultPlatform=platforms.includes(requestedDefault)?requestedDefault:'twitch';
 const defaultChannel=normalizeHostedChannel(options.channel,defaultPlatform);
 const rooms=new Map<string,Room>();
 const wss=new WebSocketServer({noServer:true,maxPayload:1024,clientTracking:false});
 const http=createServer((_req,res)=>{
   res.writeHead(426,{'content-type':'application/json','cache-control':'no-store'});
   res.end(JSON.stringify({error:'WebSocket required'}));
 });
 const reject=(socket:import('node:stream').Duplex)=>{
   socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
   socket.destroy();
 };
 const totalClients=()=>[...rooms.values()].reduce((count,room)=>count+room.sockets.size,0);
 const roomKey=(platform:LivePlatform,channel:string)=>platform+':'+channel;
 const getRoom=(platform:LivePlatform,channel:string):Room=>{
   const key=roomKey(platform,channel);
   const existing=rooms.get(key);
   if(existing)return existing;
   const sockets=new Set<WebSocket>();
   const emit=(packet:ServerPacket)=>{
     const bytes=JSON.stringify(packet);
     for(const socket of sockets){
       if(socket.readyState!==WebSocket.OPEN)continue;
       if(socket.bufferedAmount>1024*1024){socket.terminate();continue;}
       socket.send(bytes);
     }
   };
   const hub=createLiveMixer(
     options.source??chatbusLiveSource,
     emit,
     options.badgeCatalog??createTwitchBadgeCatalog,
     options.cosmetics??createUserCosmeticsResolver,
     options.kickBadgeCatalog??(()=>createKickBadgeCatalog(undefined,options.source?null:undefined)),
     loadTwitchSourcePortrait,fetchKickUserAvatar,fetchTwitchUserAvatar,
   );
   const room={hub,sockets};
   rooms.set(key,room);
   return room;
 };
 const accept=(ws:WebSocket,platform:LivePlatform,channel:string)=>{
   const key=roomKey(platform,channel);
   const room=getRoom(platform,channel);
   room.sockets.add(ws);
   ws.send(JSON.stringify({type:'status',status:room.hub.status()}));
   if(room.sockets.size===1){
     setImmediate(()=>{
       if(ws.readyState!==WebSocket.OPEN||rooms.get(key)!==room)return;
       try{room.hub.connect(channel,platform);}
       catch{ws.close(1011,'Chatbus could not start');}
     });
   }
   ws.on('message',()=>ws.close(1008,'Read-only stream'));
   ws.on('close',()=>{
     room.sockets.delete(ws);
     if(room.sockets.size===0&&rooms.get(key)===room){
       rooms.delete(key);
       room.hub.close();
     }
   });
 };
 http.on('upgrade',(req,socket,head)=>{
   let pathname='',channel:string|null=null,platform:LivePlatform|null=null;
   try {
     const url=new URL(req.url??'/', 'http://localhost');
     pathname=url.pathname;
     platform=url.searchParams.has('platform')
       ? normalizeHostedPlatform(url.searchParams.get('platform'))
       : defaultPlatform;
     channel=platform && url.searchParams.has('channel')
       ? normalizeHostedChannel(url.searchParams.get('channel'),platform)
       : defaultChannel;
   }catch{}
   const key=platform&&channel?roomKey(platform,channel):null;
   if(pathname!=='/api/live'||!sameOrigin(req)||!platform||!platforms.includes(platform)||!channel||
      totalClients()>=(options.maxClients??12)||
      (key&&!rooms.has(key)&&rooms.size>=(options.maxRooms??3))){
     reject(socket);return;
   }
   wss.handleUpgrade(req,socket,head,ws=>accept(ws,platform!,channel!));
 });
 http.on('close',()=>{
   for(const room of rooms.values()){
     for(const socket of room.sockets)socket.terminate();
     room.sockets.clear();
     room.hub.close();
   }
   rooms.clear();wss.close();
 });
 return http;
}
