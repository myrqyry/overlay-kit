// @vitest-environment node
import {afterEach,describe,expect,it,vi} from 'vitest';
import {createYouTubeSource} from '../server/hub';
import type {ChatEvent} from '@myrqyry/chatbus';

afterEach(() => {vi.unstubAllGlobals(); vi.restoreAllMocks();});

describe('Overlay Kit public YouTube source',()=>{
  it('connects a public video ID without OAuth/API credentials, emits real Chatbus events, and closes on disconnect',async()=>{
    const closed=vi.fn(),received:ChatEvent[]=[],states:string[]=[],errors:Error[]=[];
    const connectPublic=vi.fn(async(options:{
      liveId?:string;onEvent:(event:ChatEvent)=>void;onStateChange?:(state:'connected')=>void;
    })=>{
      expect(options.liveId).toBe('live-video-1');
      options.onStateChange?.('connected');
      options.onEvent({id:'yt-1',type:'message',platform:'youtube',timestamp:123,origin:'live',
        message:{id:'yt-1',platform:'youtube',timestamp:123,
          user:{id:'u1',platform:'youtube',username:'viewer'},text:'hi',
          fragments:[{type:'text',text:'hi'}]}});
      return {liveId:'live-video-1',close:closed};
    });
    const source=createYouTubeSource({},connectPublic);
    const handle=source.connect({platform:'youtube',channel:'live-video-1',getEmotes:()=>({}),
      onEvent:e=>received.push(e),onStateChange:s=>states.push(s),
      onError:e=>errors.push(e)});
    await vi.waitFor(()=>expect(states).toContain('connected'));
    expect(connectPublic).toHaveBeenCalledOnce();
    expect(received).toMatchObject([{platform:'youtube',id:'yt-1',origin:'live'}]);
    expect(errors).toEqual([]);
    handle.close();
    expect(closed).toHaveBeenCalledOnce();
  });

  it('prefers the existing official API when server credentials are available',async()=>{
    const connectPublic=vi.fn(async()=>({close:vi.fn()}));
    const fetchMock=vi.fn(async(input:RequestInfo|URL)=> {
      const url=String(input);
      if(url.includes('/videos?')) return Response.json({
        items:[{snippet:{channelId:'channel-1'},liveStreamingDetails:{activeLiveChatId:'chat-1'}}]});
      return Response.json({items:[],nextPageToken:'next',offlineAt:'2026-11-22T00:00:00Z'});
    });
    vi.stubGlobal('fetch',fetchMock);
    const states:string[]=[];
    const source=createYouTubeSource({apiKey:'test-key'},connectPublic);
    const handle=source.connect({platform:'youtube',channel:'video-1',getEmotes:()=>({}),
      onEvent:()=>{},onStateChange:s=>states.push(s)});
    await vi.waitFor(()=>expect(states).toContain('connected'));
    expect(fetchMock).toHaveBeenCalled();
    expect(connectPublic).not.toHaveBeenCalled();
    handle.close();
  });

  it('closes a public connection that resolves after its consumer disconnects',async()=>{
    let finish!:(v:{close:()=>void})=>void;
    const closed=vi.fn();
    const connectPublic=vi.fn(()=>new Promise<{close:()=>void}>(resolve=>{finish=resolve;}));
    const source=createYouTubeSource({},connectPublic);
    const handle=source.connect({platform:'youtube',channel:'video-1',getEmotes:()=>({}),onEvent:()=>{}});
    await vi.waitFor(()=>expect(connectPublic).toHaveBeenCalledOnce());
    handle.close();
    finish({close:closed});
    await vi.waitFor(()=>expect(closed).toHaveBeenCalledOnce());
  });
});
