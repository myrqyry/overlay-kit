import {describe,expect,it,vi} from 'vitest';
import {getLiveCapability,connectLiveSource} from '../src/live-client';

describe('hosted Chatbus capability negotiation',()=>{
 it('detects the bounded hosted websocket endpoint and channel without assuming connected',async()=>{
  const fetcher=vi.fn(async()=>({
   ok:true,headers:new Headers({'content-type':'application/json'}),
   json:async()=>({service:'overlay-kit-live',mode:'hosted',websocketPath:'/api/live',channel:'allowed'}),
  }));
  vi.stubGlobal('fetch',fetcher);
  expect(await getLiveCapability()).toMatchObject({mode:'hosted',websocketPath:'/api/live',channel:'allowed'});
  expect(fetcher).toHaveBeenCalledWith('/api/live/status',expect.any(Object));
  vi.unstubAllGlobals();
 });
 it('rejects advertised external websocket URLs and retains local endpoint by default',async()=>{
  const fetcher=vi.fn(async()=>({
   ok:true,headers:new Headers({'content-type':'application/json'}),
   json:async()=>({service:'overlay-kit-live',mode:'hosted',websocketPath:'wss://evil.invalid/steal',channel:'allowed'}),
  }));
  vi.stubGlobal('fetch',fetcher);
  expect(await getLiveCapability()).toBeNull();
  vi.unstubAllGlobals();
 });
 it('opens the selected WebSocket endpoint and applies incoming status packets',()=>{
  const sockets:any[]=[];
  class FakeSocket{
   url:string;onopen:((event:unknown)=>void)|null=null;
   onmessage:((event:{data:string})=>void)|null=null;
   onclose:((event:unknown)=>void)|null=null;
   onerror:(()=>void)|null=null;
   constructor(url:string){this.url=url;sockets.push(this);}
   close(){}
  }
  vi.stubGlobal('WebSocket',FakeSocket);
  const statuses:any[]=[];
  const stream=connectLiveSource(()=>{},status=>statuses.push(status),undefined,{endpoint:'/api/live',platform:'kick',channel:'#Another_12'});
  expect(new URL(sockets[0].url).pathname).toBe('/api/live');
  expect(new URL(sockets[0].url).searchParams.get('platform')).toBe('kick');
  expect(new URL(sockets[0].url).searchParams.get('channel')).toBe('another_12');
  const youtube=connectLiveSource(()=>{},undefined,undefined,{endpoint:'/api/live',platform:'youtube',channel:'https://youtu.be/dQw4w9WgXcQ'});
  expect(new URL(sockets[1].url).searchParams.get('platform')).toBe('youtube');
  expect(new URL(sockets[1].url).searchParams.get('channel')).toBe('dQw4w9WgXcQ');
  sockets[0].onmessage({data:JSON.stringify({type:'status',status:{channel:'allowed',state:'connected',emotes:'ready',badges:'ready',error:null}})});
  expect(statuses).toMatchObject([{channel:'allowed',state:'connected'}]);
  stream.dispose();youtube.dispose();
  vi.unstubAllGlobals();
 });
});
