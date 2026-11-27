import {afterEach,describe,expect,it,vi} from 'vitest';
import {kickChatbusSource} from '../server/hub';

class QuietSocket {
  onopen:((event:Event)=>void)|null=null;
  onmessage:((event:MessageEvent<unknown>)=>void)|null=null;
  onerror:((event:Event)=>void)|null=null;
  onclose:((event:CloseEvent)=>void)|null=null;
  constructor(readonly url:string){}
  send(_data:string){}
  close(){this.onclose?.({} as CloseEvent);}
}

describe('Overlay Kit Kick source history opt-in',()=>{
  afterEach(()=>vi.unstubAllGlobals());

  it('emits recent Kick history immediately instead of waiting for a future socket message',async()=>{
    vi.stubGlobal('WebSocket',QuietSocket);
    vi.stubGlobal('fetch',vi.fn(async(input:string|URL|Request)=>{
      const url=String(input);
      if(url==='https://kick.com/api/v2/channels/example')return new Response(JSON.stringify({
        id:99,slug:'example',chatroom:{id:42},
      }),{status:200,headers:{'content-type':'application/json'}});
      if(url==='https://kick.com/api/v2/channels/99/messages')return new Response(JSON.stringify({data:{messages:[
        {id:'recent-1',chat_id:99,user_id:7,content:'already here',created_at:'2026-11-02T22:20:00Z',sender:{id:7,username:'viewer',identity:{badges:[]}}},
      ]}}),{status:200,headers:{'content-type':'application/json'}});
      if(url.includes('/api/v1/realtime/auth/connection'))return new Response(JSON.stringify({data:{token:'guest'}}),{status:200});
      if(url.includes('/api/v1/realtime/'))return new Response(JSON.stringify({data:{connections:[
        {provider:'centrifugo',credentials:{url:'wss://kick.test/socket'}},
      ]}}),{status:200});
      throw new Error('unexpected '+url);
    }));
    const events:any[]=[];
    const handle=kickChatbusSource.connect({platform:'kick',channel:'example',getEmotes:()=>({}),onEvent:event=>events.push(event)});
    await vi.waitFor(()=>expect(events.map(event=>event.message?.id)).toEqual(['recent-1']));
    expect(events[0]).toMatchObject({platform:'kick',message:{text:'already here'}});
    handle.close();
  });
});
