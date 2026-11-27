// @vitest-environment node
import {describe,it,expect} from 'vitest';
import {WebSocket} from 'ws';
import {resolve} from 'node:path';
import {createLiveServer} from '../server/http';
import type {LiveSource} from '../server/hub';

const messageEvent={
  type:'message' as const,platform:'kick' as const,channelName:'demo',channelId:'99',timestamp:1,
  message:{id:'history-1',platform:'kick' as const,channelName:'demo',channelId:'99',timestamp:1,
    user:{platform:'kick' as const,id:'u1',username:'viewer',displayName:'Viewer'},
    text:'loaded before browser',fragments:[{type:'text' as const,text:'loaded before browser'}]},
};

const openAndCollect=(url:string,origin:string,count:number)=>new Promise<{ws:WebSocket;packets:any[]}>((resolvePackets,reject)=>{
  const ws=new WebSocket(url,{origin});
  const packets:any[]=[];const timer=setTimeout(()=>reject(new Error('packet timeout')),3000);
  ws.once('error',reject);
  ws.on('message',raw=>{
    packets.push(JSON.parse(String(raw)));
    if(packets.length>=count){clearTimeout(timer);resolvePackets({ws,packets});}
  });
});

describe('late browser live replay',()=>{
  it('replays messages emitted before the browser websocket connected',async()=>{
    const source:LiveSource={
      connect(options){options.onStateChange?.('connected');options.onEvent(messageEvent);return {close(){}};},
      emotes:async()=>({emotes:{},complete:true}),
    };
    const server=await createLiveServer({port:0,source,root:resolve('dist-demo'),restore:false,cosmetics:()=>({resolve:async()=>null})});
    let ws:WebSocket|undefined;
    try{
      const response=await fetch(server.address+'/api/live/connect',{method:'POST',headers:{Origin:server.address,'Content-Type':'application/json'},body:JSON.stringify({platform:'kick',channel:'demo'})});
      expect(response.status).toBe(200);
      const received=await openAndCollect(server.address.replace('http:','ws:')+'/live',server.address,2);
      ws=received.ws;
      const packets=received.packets;
      expect(packets[0]).toMatchObject({type:'status'});
      expect(packets[1]).toMatchObject({type:'event',event:{type:'message',message:{id:'kick:demo:history-1',sourceId:'kick:demo',parts:[{text:'loaded before browser'}]}}});
    }finally{ws?.close();await server.close();}
  });
});
