import {createKickBadgeCatalog,type KickBadgeCatalog} from '@myrqyry/chatbus';
import {loadTwitchSourcePortrait} from './twitch-source-identity';
/** Loopback-only overlay source host. One Chatbus connection fans out to
 * independent OBS/Chromium clients. Never publishes tokens or raw IRC frames. */
import { createServer, type Server as HttpServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, readFileSync, writeFileSync } from 'node:fs';
import { resolve, extname, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { chatbusLiveSource,createLiveMixer, type LiveSource, type ServerPacket } from './hub';
import {normalizeLivePlatform,type LivePlatform} from '../src/live-platform';
import { createTwitchBadgeCatalog, type TwitchBadgeCatalog } from './twitch-badges';
import { fetchKickUserAvatar, fetchTwitchUserAvatar } from '@myrqyry/chatbus';
import { createUserCosmeticsResolver, type CosmeticResolver } from './cosmetics';
import { createGoogleFontProxy } from './font-proxy';
import { createLocalOAuth } from './oauth-local';
import {readKickClientConfig,type KickOAuthClient} from './kick-client';
import { createYouTubeSource } from './hub';
import { connectTwitchChat } from '@myrqyry/chatbus';
import {createLiveReplayBuffer} from './live-replay';

const here = dirname(fileURLToPath(import.meta.url));
const defaultRoot = resolve(here, '../dist-demo');
const defaultConfig = resolve(here, '../.live-channel.json');
const mime: Record<string, string> = {
  '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8', '.txt':'text/plain; charset=utf-8', '.svg':'image/svg+xml',
  '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp',
  '.gif':'image/gif', '.avif':'image/avif', '.json':'application/json; charset=utf-8',
  '.ico':'image/x-icon',
};
const sendJson = (res:ServerResponse,code:number, data:unknown) => {
  res.writeHead(code,{'content-type':'application/json; charset=utf-8','cache-control':'no-store',
    'x-content-type-options':'nosniff'});
  res.end(JSON.stringify(data));
};
const reject = (res:ServerResponse,code:number) => sendJson(res,code,{error: code === 403 ? 'Forbidden' : 'Not found'});
async function readBody(req:IncomingMessage): Promise<unknown> {
  let text = '';
  for await (const chunk of req) {
    text += String(chunk);
    if (text.length > 4096) throw new Error('Request too large');
  }
  try {return JSON.parse(text);}catch{throw new Error('Malformed JSON');}
}

export interface LiveServerOptions {
  port?:number;
  source?:LiveSource;
  /** Optional shared Chatbus catalog factory for isolated hosts/tests. */
  kickBadgeCatalog?:()=>KickBadgeCatalog;
  badgeCatalog?:()=>TwitchBadgeCatalog;
  cosmetics?:()=>Pick<CosmeticResolver,'resolve'> & Partial<Pick<CosmeticResolver,'close'>>;
  root?:string;
  fontFetch?:typeof fetch;
  configPath?:string;
  restore?:boolean;
  oauthFile?:string;
  oauthFetch?:typeof fetch;
  /** Optional injected local Kick OAuth client; never sent to browsers. */
  kickClient?:KickOAuthClient;
  /** Browser-visible loopback origin when this server sits behind a local dev proxy. */
  publicOrigin?:string;
}
export async function createLiveServer(options:LiveServerOptions = {}) {
  const roots = resolve(options.root ?? defaultRoot);
  const fonts=createGoogleFontProxy(roots,options.fontFetch);
  const kickClient=options.kickClient??readKickClientConfig();
  const oauth=createLocalOAuth({file:options.oauthFile??resolve(here,'../.oauth-accounts.json'),fetcher:options.oauthFetch,clients:{
    ...(kickClient?{kick:kickClient}:{}),
    youtube:{clientId:process.env.OVERLAY_YOUTUBE_CLIENT_ID??'',clientSecret:process.env.OVERLAY_YOUTUBE_CLIENT_SECRET},
    twitch:{clientId:process.env.OVERLAY_TWITCH_CLIENT_ID??'',clientSecret:process.env.OVERLAY_TWITCH_CLIENT_SECRET},
  }});
  // OAuth identity stays server-side; the websocket sees only projected chat.
  const liveSource:LiveSource=options.source??{
    connect(input){
      if(input.platform!=='youtube'&&input.platform!=='twitch')return chatbusLiveSource.connect(input);
      let canceled=false;let active:{close():void}|undefined;
      const provider=input.platform;
      void oauth.accessToken(provider).then(async token=>{
        if(canceled)return;
        if(provider==='twitch'){
          if(!token){active=chatbusLiveSource.connect(input);return;}
          const connection=await connectTwitchChat({channel:input.channel,accessToken:token,
            getEmotes:input.getEmotes,onEvent:input.onEvent,onError:input.onError,
            onStateChange:input.onStateChange});
          if(canceled)connection.close();else active=connection;
          return;
        }
        active=createYouTubeSource({accessToken:token??process.env.OVERLAY_YOUTUBE_ACCESS_TOKEN,
          apiKey:token?undefined:process.env.OVERLAY_YOUTUBE_API_KEY}).connect(input);
      }).catch(error=>{if(!canceled){input.onStateChange?.('error');input.onError?.(error instanceof Error?error:new Error('Authenticated connection failed'));}});
      return {close(){canceled=true;active?.close();}};
    },
    emotes:(channel,platform)=>chatbusLiveSource.emotes(channel,platform),
  };
  const configPath = options.configPath ?? defaultConfig;
  const sockets = new Set<WebSocket>();
  const replay=createLiveReplayBuffer(50);
  const broadcast = (packet:ServerPacket) => {
    if(packet.type==='event')replay.apply(packet.event);
    const data = JSON.stringify(packet);
    for (const ws of sockets) {
      if (ws.readyState !== WebSocket.OPEN) continue;
      if (ws.bufferedAmount > 1024 * 1024) { ws.terminate(); continue; }
      ws.send(data);
    }
  };
  const hub = createLiveMixer(liveSource,broadcast,
    options.badgeCatalog ?? createTwitchBadgeCatalog,
    options.cosmetics ?? createUserCosmeticsResolver,
    options.kickBadgeCatalog??(()=>createKickBadgeCatalog(undefined,options.source?null:undefined)),
    loadTwitchSourcePortrait, fetchKickUserAvatar, fetchTwitchUserAvatar);
  const restartProvider=(platform:LivePlatform)=>{
    const sources=hub.status().sources.filter(source=>source.platform===platform&&source.channel);
    for(const item of sources){
      hub.removeSource(item.channel!,platform);
      hub.addSource(item.channel!,platform);
    }
  };
  const persistSources=()=>{
    if(options.restore===false)return;
    const sources=hub.status().sources.flatMap(item=>
      item.platform&&item.channel?[{platform:item.platform,channel:item.channel}]:[]);
    writeFileSync(configPath,JSON.stringify({sources}),{mode:0o600});
  };
  let address = '';
  const server:HttpServer = createServer(async(req,res) => {
    const reqUrl = new URL(req.url ?? '/', 'http://localhost');
    const path = reqUrl.pathname;
    const origin = req.headers.origin;
    const publicOrigin = options.publicOrigin?.replace(/\/$/, '');
    const sameOrigin = origin === address || Boolean(publicOrigin && origin === publicOrigin);
    if(path.startsWith('/api/fonts/')){
      if(req.method!=='GET'){reject(res,405);return;}
      if(await fonts.handle(path,reqUrl.searchParams,res))return;
      reject(res,404);return;
    }
    if(path==='/api/oauth/status'&&req.method==='GET'){
      sendJson(res,200,{connected:oauth.status(),configured:oauth.configured(),mode:'local'});return;
    }
    if(path==='/api/oauth/start'&&req.method==='POST'){
      if(!sameOrigin||req.headers['content-type']?.split(';')[0]!=='application/json'){reject(res,403);return;}
      try{
        const body=await readBody(req) as {provider?:unknown};
        if(body?.provider!=='youtube'&&body?.provider!=='twitch'&&body?.provider!=='kick')throw new Error('Unsupported OAuth provider');
        // Kick app registration uses localhost for its exact callback; the UI
        // remains on 127.0.0.1 because the loopback relay binds there.
        const callbackOrigin=body.provider==='kick'
          ? new URL(address.replace('127.0.0.1','localhost')).origin
          : (publicOrigin??address);
        const response=await oauth.begin(body.provider,callbackOrigin+'/api/oauth/callback');
        sendJson(res,200,{url:response.url});
      }catch(error){sendJson(res,400,{error:error instanceof Error?error.message:'OAuth unavailable'});}
      return;
    }
    if(path==='/api/oauth/callback'&&req.method==='GET'){
      const state=reqUrl.searchParams.get('state')??'';
      const code=reqUrl.searchParams.get('code')??'';
      const error=reqUrl.searchParams.get('error');
      const provider=reqUrl.searchParams.get('provider');
      // Callback provider is determined by the state record, never trusted from query.
      try{
        if(error)throw new Error('Provider denied authorization');
        const target=oauth.providerForState(state);
        if(provider&&provider!==target)throw new Error('Provider mismatch');
        if(!target)throw new Error('OAuth provider missing');
        await oauth.complete(target,state,code);
        if(target!=='kick')restartProvider(target); // Existing Kick realtime is still anonymous.
        res.writeHead(303,{location:target==='kick'?address+'/?oauth=connected':'/?oauth=connected','cache-control':'no-store'});res.end();
      }catch{res.writeHead(303,{location:'/?oauth=failed','cache-control':'no-store'});res.end();}
      return;
    }
    if(path==='/api/oauth/disconnect'&&req.method==='POST'){
      if(!sameOrigin||req.headers['content-type']?.split(';')[0]!=='application/json'){reject(res,403);return;}
      try{
        const body=await readBody(req) as {provider?:unknown};
        if(body?.provider!=='youtube'&&body?.provider!=='twitch'&&body?.provider!=='kick')throw new Error('Unsupported provider');
        oauth.disconnect(body.provider);
        if(body.provider!=='kick')restartProvider(body.provider);
        sendJson(res,200,{connected:oauth.status()});
      }catch{sendJson(res,400,{error:'Invalid provider'});}
      return;
    }
    if (path === '/api/live/status' && req.method === 'GET') {
      sendJson(res,200,{service:'overlay-kit-live',mode:'local',platform:hub.status().platform??'twitch',
        platforms:['twitch','kick','youtube','tiktok'],status:hub.status(),clients:sockets.size});
      return;
    }
    if (path.startsWith('/api/live/')) {
      if (req.method !== 'POST') {reject(res,405);return;}
      // Require browser same-origin: no cross-origin form/JSON requests can
      // silently retarget this workstation's stream source.
      if (!sameOrigin || req.headers['content-type']?.split(';')[0] !== 'application/json') {
        reject(res,403);return;
      }
      if (path === '/api/live/connect') {
        try {
          const data=await readBody(req) as {channel?:unknown;platform?:unknown;combine?:unknown}|null;
          if(!data||typeof data.channel!=='string')throw new Error('Channel required');
          const platform=normalizeLivePlatform(data.platform);
          if(!platform)throw new Error('Platform must be Twitch, Kick, YouTube or TikTok');
          if(data.combine===true)hub.addSource(data.channel,platform);
          else hub.connect(data.channel,platform);
          persistSources();
          sendJson(res,200,{status:hub.status()});
        } catch(error) {
          sendJson(res,400,{error:error instanceof Error?error.message:'Could not connect'});
        }
        return;
      }
      if(path==='/api/live/reconnect'){
        try{
          const data=await readBody(req) as {channel?:unknown;platform?:unknown}|null;
          const platform=normalizeLivePlatform(data?.platform);
          if(!platform||typeof data?.channel!=='string')throw Error('Platform and channel required');
          if(!hub.reconnectSource(data.channel,platform)){sendJson(res,404,{error:'Source is not connected'});return;}
          persistSources();sendJson(res,200,{status:hub.status()});
        }catch(error){sendJson(res,400,{error:error instanceof Error?error.message:'Could not reconnect'});}
        return;
      }
      if (path === '/api/live/disconnect') {
        try{
          const data=await readBody(req) as {channel?:unknown;platform?:unknown}|null;
          if(data&&typeof data.channel==='string'){
            const platform=normalizeLivePlatform(data.platform);
            if(!platform)throw new Error('Platform must be Twitch, Kick, YouTube or TikTok');
            hub.removeSource(data.channel,platform);
          }else hub.disconnect();
          persistSources();
          sendJson(res,200,{status:hub.status()});
        }catch(error){
          sendJson(res,400,{error:error instanceof Error?error.message:'Could not disconnect'});
        }
        return;
      }
      reject(res,404);return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {reject(res,405);return;}
    if (path === '/live') {reject(res,426);return;}
    let decoded: string;
    try { decoded=decodeURIComponent(path); } catch {reject(res,400);return;}
    if (decoded.includes('\0') || decoded.includes('\\') || decoded.split('/').some(x=>x.startsWith('.'))) {
      reject(res,403);return;
    }
    const target=resolve(roots,'.'+(decoded==='/'?'/index.html':decoded));
    if (target!==roots && !target.startsWith(roots+sep)) {reject(res,403);return;}
    try {
      const body=await new Promise<Buffer>((ok,bad)=>readFile(target,(err,data)=>err?bad(err):ok(data)));
      res.writeHead(200,{'content-type':mime[extname(target)] ?? 'application/octet-stream',
        'x-content-type-options':'nosniff','cache-control':'no-store'});
      res.end(req.method==='HEAD'?undefined:body);
    } catch {reject(res,404);}
  });
  const wss=new WebSocketServer({noServer:true,maxPayload:1024});
  server.on('upgrade',(req,socket,head)=>{
    const path = new URL(req.url ?? '/', 'http://localhost').pathname;
    const publicOrigin = options.publicOrigin?.replace(/\/$/, '');
    const allowedOrigin = req.headers.origin===address || Boolean(publicOrigin && req.headers.origin===publicOrigin);
    if(path!=='/live'||!allowedOrigin){
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');socket.destroy();return;
    }
    wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req));
  });
  wss.on('connection',(ws:WebSocket)=>{
    sockets.add(ws);
    ws.send(JSON.stringify({type:'status',status:hub.status()}));
    for(const event of replay.snapshot())ws.send(JSON.stringify({type:'event',event}));
    ws.on('close',()=>sockets.delete(ws));
    // Browser clients have no commands on this read-only event channel.
    ws.on('message',()=>ws.close(1008,'Read-only stream'));
  });
  const listenPort=options.port ?? 5220;
  await new Promise<void>((ok,bad)=>{
    server.once('error',bad);
    server.listen(listenPort,'127.0.0.1',()=>{
      server.off('error',bad);
      const port=(server.address() as {port:number}).port;
      address='http://127.0.0.1:'+port;
      ok();
    });
  });
  if (options.restore !== false) {
    try {
      const data=JSON.parse(readFileSync(configPath,'utf8')) as {
        channel?:unknown;platform?:unknown;sources?:unknown;
      };
      if(Array.isArray(data.sources)){
        for(const item of data.sources){
          if(!item||typeof item!=='object')continue;
          const source=item as {channel?:unknown;platform?:unknown};
          const platform=normalizeLivePlatform(source.platform);
          if(platform&&typeof source.channel==='string')hub.addSource(source.channel,platform);
        }
      }else if(typeof data.channel==='string'){
        const platform=normalizeLivePlatform(data.platform)??'twitch';
        hub.connect(data.channel,platform);
      }
    } catch { /* no saved channel or invalid saved file, remain disconnected */ }
  }
  return {
    address,hub,
    close:async()=>{
      hub.close();
      for(const ws of sockets)ws.terminate();
      await new Promise<void>(ok=>wss.close(()=>ok()));
      await new Promise<void>(ok=>server.close(()=>ok()));
    },
  };
}
