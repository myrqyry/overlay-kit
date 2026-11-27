import { describe,expect,it,vi } from 'vitest';
import type { ChatEvent,EmoteSet } from '@myrqyry/chatbus';
import { chatbusLiveSource, createLiveHub, createLiveMixer, type LiveSource } from '../server/hub';
const fixture: ChatEvent = {type:'message',platform:'twitch',timestamp:1000,message:{
  id:'a',platform:'twitch',timestamp:1000,user:{platform:'twitch',id:'u1',username:'user'},
  text:'Hi',fragments:[{type:'text',text:'Hi'}],
}};
describe('server-owned Chatbus lifecycle and admission',()=>{
 it('does not invent a channel, rejects invalid names, and broadcasts real event projections',async()=>{
  let sourceCallback: ((e:ChatEvent)=>void)|undefined;
  const close=vi.fn();
  const source:LiveSource={
   connect:options=>{ sourceCallback=options.onEvent; options.onStateChange?.('connected');return {close}; },
   emotes:async()=>({emotes:{},complete:true}),
  };
  const events:unknown[]=[];
  const hub=createLiveHub(source,packet=>events.push(packet));
  expect(hub.status().channel).toBeNull();
  expect(()=>hub.connect('some!bad')).toThrow(/channel/i);
  hub.connect(' #Example_1 ');
  expect(hub.status()).toMatchObject({channel:'example_1',state:'connected'});
  sourceCallback!(fixture);
  expect(events).toContainEqual({type:'event',event:{type:'message',message:expect.objectContaining({id:'a'})}});
  hub.disconnect();
  expect(close).toHaveBeenCalledTimes(1);
  expect(hub.status()).toMatchObject({channel:null,state:'disconnected'});
 });
 it('clears a stale transport error after the source successfully reconnects',()=>{
  let state:((value:any)=>void)|undefined;let fail:((error:Error)=>void)|undefined;
  const source:LiveSource={
    connect:options=>{state=options.onStateChange;fail=options.onError;return {close:()=>{}};},
    emotes:async()=>({emotes:{},complete:true}),
  };
  const hub=createLiveHub(source,()=>{});
  hub.connect('example','kick');
  state?.('error');fail?.(new Error('Kick WebSocket error'));
  expect(hub.status()).toMatchObject({state:'error',error:'Kick WebSocket error'});
  state?.('connected');
  expect(hub.status()).toMatchObject({state:'connected',error:null});
  hub.close();
 });

 it('routes Twitch and Kick through the same hub without conflating identical channel names',async()=>{
  const connected:{platform?:string;channel:string}[]=[];
  const source:LiveSource={
   connect:options=>{connected.push({platform:options.platform,channel:options.channel});
    options.onStateChange?.('connected');return {close:()=>{}};},
   emotes:async()=>({emotes:{},complete:true}),
  };
  const hub=createLiveHub(source,()=>{});
  hub.connect('same_name','twitch');
  expect(hub.status()).toMatchObject({platform:'twitch',channel:'same_name',state:'connected'});
  hub.connect('same_name','kick');
  expect(hub.status()).toMatchObject({platform:'kick',channel:'same_name',state:'connected'});
  expect(connected).toEqual([
   {platform:'twitch',channel:'same_name'},
   {platform:'kick',channel:'same_name'},
  ]);
  hub.close();
 });

 it('combines independent sources without disconnecting the first and removes only the selected source',async()=>{
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
  const packets:any[]=[];
  const hub=createLiveMixer(source,p=>packets.push(p),undefined,()=>({resolve:async()=>null}));
  hub.addSource('alpha','twitch');
  hub.addSource('dQw4w9WgXcQ','youtube');
  expect(hub.status().sources.map(s=>[s.platform,s.channel])).toEqual([
   ['twitch','alpha'],['youtube','dQw4w9WgXcQ'],
  ]);
  callbacks.get('twitch:alpha')!({...fixture,message:{...fixture.message!,id:'t1',channelName:'alpha'}});
  callbacks.get('youtube:dQw4w9WgXcQ')!({type:'message',platform:'youtube',timestamp:1001,
    channelName:'yt-channel',message:{id:'y1',platform:'youtube',timestamp:1001,
      channelName:'yt-channel',user:{platform:'youtube',id:'yu',username:'viewer'},text:'yo',fragments:[{type:'text',text:'yo'}]}});
  const mixed=packets.filter(p=>p.event?.type==='message').map(p=>p.event.message);
  expect(mixed.map(p=>p.platform)).toEqual(['twitch','youtube']);
  expect(mixed.map(p=>p.sourceId)).toEqual(['twitch:alpha','youtube:dQw4w9WgXcQ']);
  expect(mixed.map(p=>p.id)).toEqual(['twitch:alpha:t1','youtube:dQw4w9WgXcQ:y1']);
  const clearBefore=packets.length;
  callbacks.get('youtube:dQw4w9WgXcQ')!({type:'system',platform:'youtube',timestamp:1002,data:{kind:'chat-clear'}});
  expect(packets.slice(clearBefore)).toContainEqual({type:'event',event:{type:'clear',sourceId:'youtube:dQw4w9WgXcQ'}});
  hub.removeSource('dQw4w9WgXcQ','youtube');
  expect(closed).toEqual(['youtube:dQw4w9WgXcQ']);
  expect(hub.status().sources).toHaveLength(1);
  hub.close();
  expect(closed).toEqual(['youtube:dQw4w9WgXcQ','twitch:alpha']);
 });

 it('honors the explicit opt-out of unofficial public YouTube chat',async()=>{
  vi.stubEnv('OVERLAY_YOUTUBE_API_KEY','');
  vi.stubEnv('OVERLAY_YOUTUBE_ACCESS_TOKEN','');
  vi.stubEnv('OVERLAY_YOUTUBE_PUBLIC','0');
  const states:string[]=[];const errors:string[]=[];
  const handle=chatbusLiveSource.connect({platform:'youtube',channel:'dQw4w9WgXcQ',getEmotes:()=>({}),
    onEvent:()=>{},onStateChange:state=>states.push(state),onError:error=>errors.push(error.message)});
  await new Promise(resolve=>setTimeout(resolve,0));
  expect(states).toContain('error');
  expect(errors.at(-1)).toMatch(/Public YouTube chat disabled/i);
  handle.close();vi.unstubAllEnvs();
 });

 it('discards async catalog results from stale connections, without leaking messages',async()=>{
  let resolveEmotes: ((data:{emotes:EmoteSet;complete:boolean})=>void)|undefined;
  const callbacks: ((e:ChatEvent)=>void)[]=[];
  const stops=vi.fn();
  const source:LiveSource={
   connect:opts=>{callbacks.push(opts.onEvent);return {close:stops};},
   emotes:()=>new Promise(resolve=>{resolveEmotes=resolve;}),
  };
  const events:unknown[]=[];
  const hub=createLiveHub(source,packet=>events.push(packet));
  hub.connect('old');
  hub.connect('new');
  callbacks[0]!(fixture);
  expect(events.filter((x:any)=>x.type==='event'&&x.event.type==='message')).toHaveLength(0);
  resolveEmotes!({emotes:{},complete:true});
  await Promise.resolve();await Promise.resolve();
  expect(hub.status().channel).toBe('new');
  expect(stops).toHaveBeenCalledTimes(1);
  hub.close();
 });
 it('propagates moderation mutations and defers independent provider failures',async()=>{
  const callbacks: ((e:ChatEvent)=>void)[]=[];
  const source:LiveSource={connect:opts=>{callbacks.push(opts.onEvent);return {close:()=>{}};},
    emotes:async()=>{throw new Error('provider temporarily unreachable');}};
  const packets:unknown[]=[];
  const hub=createLiveHub(source,v=>packets.push(v));
  hub.connect('demo');
  callbacks[0]!({type:'message-delete',platform:'twitch',timestamp:1,data:{messageId:'a'}});
  expect(packets).toContainEqual({type:'event',event:{type:'delete',messageId:'a'}});
  await Promise.resolve();await Promise.resolve();
  expect(hub.status().emotes).toBe('degraded');
  hub.close();
 });
});

describe('badge resolution through the live hub',()=>{
 it('updates a visible message after global + channel catalogs arrive, without waiting to display text',async()=>{
  const callbacks:((event:ChatEvent)=>void)[]=[];
  const payload=(set:string,version:string,url:string)=>[
   {set_id:set,versions:[{id:version,title:set,image_url_1x:url}]},
  ];
  let finishGlobal:(data:unknown)=>void=()=>{};
  let finishChannel:(data:unknown)=>void=()=>{};
  const {createTwitchBadgeCatalog}=await import('../server/twitch-badges');
  const badges=createTwitchBadgeCatalog(url=>new Promise(resolve=>{
   if(url.includes('global'))finishGlobal=resolve; else finishChannel=resolve;
  }));
  const source:LiveSource={connect:opts=>{callbacks.push(opts.onEvent);return {close:()=>{}};},
   emotes:async()=>({emotes:{},complete:true})};
  const packets:any[]=[];
  const hub=createLiveHub(source,packet=>packets.push(packet),()=>badges);
  hub.connect('example');
  callbacks[0]!({type:'room-state',platform:'twitch',channelId:'71092938',timestamp:1});
  callbacks[0]!({...fixture,channelId:'71092938',message:{...fixture.message!,
    channelId:'71092938',user:{...fixture.message!.user,badgeRefs:[
      {provider:'twitch',id:'moderator',version:'1'},
      {provider:'twitch',id:'subscriber',version:'12'},
    ]}}});
  const initial=packets.find(p=>p.type==='event' && p.event.type==='message')?.event;
  expect(initial.message.user.badges).toEqual([]);
  finishGlobal(payload('moderator','1','https://static-cdn.jtvnw.net/badges/v1/mod-id/1'));
  await new Promise(resolve=>setTimeout(resolve,0));
  expect(packets.filter(p=>p.type==='event'&&p.event.type==='badges').at(-1).event).toMatchObject({
   messageId:'a',badges:[{name:'moderator',url:'https://static-cdn.jtvnw.net/badges/v1/mod-id/1'}],
  });
  finishChannel(payload('subscriber','12','https://static-cdn.jtvnw.net/badges/v1/sub-id/1'));
  await new Promise(resolve=>setTimeout(resolve,0));
  const updates=packets.filter(p=>p.type==='event' && p.event.type==='badges');
  expect(updates.at(-1).event.badges.map((b:any)=>b.name)).toEqual(['moderator','subscriber']);
  expect(updates.at(-1).event.badges.map((b:any)=>[b.provider,b.id])).toEqual([
    ['twitch','moderator'],['twitch','subscriber'],
  ]);
  hub.close();
 });
 it('uses supplied 4x Twitch badge art on late catalog updates and 2x fallback where necessary',async()=>{
  let onEvent:((event:ChatEvent)=>void)|undefined;
  const source:LiveSource={
    connect:options=>{onEvent=options.onEvent;return {close:()=>{}};},
    emotes:async()=>({emotes:{},complete:true}),
  };
  const {createTwitchBadgeCatalog}=await import('../server/twitch-badges');
  const badgeImage='https://static-cdn.jtvnw.net/badges/v1/high-density';
  const catalog=createTwitchBadgeCatalog(async()=>[
    {set_id:'moderator',versions:[{id:'1',
      image_url_1x:badgeImage+'/1',
      image_url_2x:badgeImage+'/2',
      image_url_4x:badgeImage+'/3',
    }]},
    {set_id:'vip',versions:[{id:'1',
      image_url_1x:'https://static-cdn.jtvnw.net/badges/v1/vip/1',
      image_url_2x:'https://static-cdn.jtvnw.net/badges/v1/vip/2',
    }]},
  ]);
  const emitted:any[]=[];
  const hub=createLiveHub(source,p=>emitted.push(p),()=>catalog);
  hub.connect('example');
  onEvent!({...fixture,message:{...fixture.message!,user:{...fixture.message!.user,
    badgeRefs:[{provider:'twitch',id:'moderator',version:'1'},
               {provider:'twitch',id:'vip',version:'1'}]}}});
  await new Promise(resolve=>setTimeout(resolve,0));
  const badgeUpdate=emitted.filter(p=>p.type==='event'&&p.event.type==='badges').at(-1)?.event;
  expect(badgeUpdate).toMatchObject({messageId:'a',badges:[
    {name:'moderator',url:badgeImage+'/3'},
    {name:'vip',url:'https://static-cdn.jtvnw.net/badges/v1/vip/2'},
  ]});
  hub.close();
 });
 it('never applies stale badge lookups after changing channels',async()=>{
  let oldDone:(data:unknown)=>void=()=>{};
  const {createTwitchBadgeCatalog}=await import('../server/twitch-badges');
  const create=()=>createTwitchBadgeCatalog(()=>new Promise(resolve=>{oldDone=resolve;}));
  const callbacks:((event:ChatEvent)=>void)[]=[];
  const source:LiveSource={connect:opts=>{callbacks.push(opts.onEvent);return {close:()=>{}};},
   emotes:async()=>({emotes:{},complete:true})};
  const packets:any[]=[];
  const hub=createLiveHub(source,packet=>packets.push(packet),create);
  hub.connect('old');
  callbacks[0]!({...fixture,message:{...fixture.message!,user:{...fixture.message!.user,
   badgeRefs:[{provider:'twitch',id:'moderator',version:'1'}]}}});
  hub.connect('new');
  oldDone([{set_id:'moderator',versions:[{id:'1',
    image_url_1x:'https://static-cdn.jtvnw.net/badges/v1/old/1'}]}]);
  await new Promise(resolve=>setTimeout(resolve,0));
  expect(packets.filter(p=>p.type==='event'&&p.event.type==='badges')).toHaveLength(0);
  hub.close();
 });
});

describe('provider-agnostic identity enrichment through live message projection',()=>{
 it('sends BTTV FFZ 7TV badges and user name paint as a single late identity update',async()=>{
  const callbacks:((e:ChatEvent)=>void)[]=[];
  const source:LiveSource={
    connect:opts=>{callbacks.push(opts.onEvent);return {close:()=>{}};},
    emotes:async()=>({emotes:{},complete:true}),
  };
  const fakeBadge=(provider:'bttv'|'ffz'|'7tv')=>({
    id:provider,provider,scope:'user' as const,images:[{url:'https://example.net/'+provider+'.png'}],
  });
  const cosmetics={badges:[fakeBadge('bttv'),fakeBadge('ffz'),fakeBadge('7tv')],
    namePaint:{provider:'7tv' as const,id:'paint',color:0xffeebbcc}};
  let finish:(v:typeof cosmetics)=>void=()=>{};
  const cosmeticsProvider={
    resolve:()=>new Promise<typeof cosmetics>(r=>{finish=r;}),
  };
  const packets:any[]=[];
  const hub=createLiveHub(source,x=>packets.push(x),undefined,()=>cosmeticsProvider);
  hub.connect('demo');
  callbacks[0]!(fixture);
  expect(packets.some(p=>p.event?.type==='message')).toBe(true);
  finish(cosmetics);
  await new Promise(resolve=>setTimeout(resolve,0));
  expect(packets.filter(p=>p.event?.type==='identity').at(-1)?.event).toMatchObject({
    type:'identity',messageId:'a',badges:[
      {provider:'bttv'},{provider:'ffz'},{provider:'7tv'},
    ],namePaint:{id:'paint',color:0xffeebbcc},
  });
  hub.close();
 });
});
