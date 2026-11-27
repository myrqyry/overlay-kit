// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import type { ChatEvent, EmoteSet } from '@myrqyry/chatbus';
import { createLiveHub, createLiveMixer, type LiveSource } from '../server/hub';
import { createLiveReplayBuffer } from '../server/live-replay';
import { createChatMessageElement } from '../src/renderers';
import type { OverlayLiveEvent } from '../src/live';

const url = 'https://static-cdn.jtvnw.net/jtv_user_pictures/alpha-profile_image-600x600.png';
const message = (channel:string,id:string):ChatEvent => ({
  platform:'twitch',type:'message',timestamp:100,
  channelName:channel,message:{
    platform:'twitch',id,timestamp:100,channelName:channel,
    user:{platform:'twitch',id:'viewer',username:'viewer'},text:'hello',
    fragments:[{type:'text',text:'hello'}],
  },
});
function source() {
  const callbacks=new Map<string,(event:ChatEvent)=>void>();
  const live:LiveSource={
    connect:opts=>{
      callbacks.set(opts.channel,opts.onEvent);
      return {close:()=>callbacks.delete(opts.channel)};
    },
    emotes:async()=>({emotes:{} as EmoteSet,complete:true}),
  };
  return {live,callbacks};
}
const noBadges=()=>({
  resolve:()=>[],health:()=> 'ready' as const,
  loadGlobal:async()=>{},loadChannel:async()=>{},
});

describe('Twitch streamer portrait as a multichat source badge',()=>{
  it('patches existing chat messages without refetching or delaying their original delivery',async()=>{
    let finish!:(value:string|null)=>void;
    const resolveAvatar=vi.fn(()=>new Promise<string|null>(resolve=>{finish=resolve;}));
    const {live,callbacks}=source();
    const events:OverlayLiveEvent[]=[];
    const hub=createLiveHub(live,packet=>{if(packet.type==='event')events.push(packet.event);},
      noBadges as never,undefined,undefined,resolveAvatar);
    hub.connect('alpha','twitch');
    callbacks.get('alpha')!(message('alpha','m1'));
    expect(events[0]).toMatchObject({type:'message',message:{id:'m1',user:{badges:[]}}});
    finish(url);
    await Promise.resolve();await Promise.resolve();await Promise.resolve();
    expect(events).toContainEqual({type:'badges',messageId:'m1',badges:[
      expect.objectContaining({provider:'twitch-source',url,name:expect.stringContaining('alpha')}),
    ]});
    callbacks.get('alpha')!(message('alpha','m2'));
    expect(events.at(-1)).toMatchObject({type:'message',message:{
      id:'m2',user:{badges:[expect.objectContaining({provider:'twitch-source',url})]},
    }});
    expect(resolveAvatar).toHaveBeenCalledTimes(1);
    hub.close();
  });

  it('never applies a stale Twitch picture to a new channel after reconnect',async()=>{
    const completions:((image:string|null)=>void)[]=[];
    const {live,callbacks}=source();
    const events:OverlayLiveEvent[]=[];
    const hub=createLiveHub(live,packet=>{if(packet.type==='event')events.push(packet.event);},
      noBadges as never,undefined,undefined,()=>new Promise(resolve=>{completions.push(resolve);}));
    hub.connect('alpha');
    callbacks.get('alpha')!(message('alpha','m1'));
    hub.connect('beta');
    callbacks.get('beta')!(message('beta','m2'));
    completions[0]!(url);
    await Promise.resolve();await Promise.resolve();
    expect(events.filter(item=>item.type==='badges')).toEqual([]);
    hub.close();
  });

  it('scopes portraits to their source and persists late badge updates for replay',async()=>{
    const {live,callbacks}=source();
    const packetEvents:OverlayLiveEvent[]=[];
    const mixer=createLiveMixer(live,packet=>{if(packet.type==='event')packetEvents.push(packet.event);},
      noBadges as never,undefined,undefined,
      async channel=>channel==='alpha'?url:null);
    mixer.addSource('alpha','twitch');mixer.addSource('beta','twitch');
    callbacks.get('alpha')!(message('alpha','same'));
    callbacks.get('beta')!(message('beta','same'));
    await Promise.resolve();await Promise.resolve();await Promise.resolve();
    const badges=packetEvents.filter(item=>item.type==='badges');
    expect(badges).toEqual([expect.objectContaining({messageId:'twitch:alpha:same'})]);
    const replay=createLiveReplayBuffer();
    for(const event of packetEvents)replay.apply(event);
    const snapshots=replay.snapshot().map(item=>item.message);
    expect(snapshots.find(item=>item.sourceId==='twitch:alpha')?.user.badges)
      .toContainEqual(expect.objectContaining({provider:'twitch-source',url}));
    expect(snapshots.find(item=>item.sourceId==='twitch:beta')?.user.badges).toEqual([]);
    mixer.close();
  });

  it('renders the picture as a small accessible badge without injecting HTML',()=>{
    const root=createChatMessageElement({
      id:'hi',timestamp:100,platform:'twitch',channelName:'alpha',
      user:{name:'viewer',badges:[{provider:'twitch-source',name:'alpha streamer',url}]},
      parts:[{type:'text',text:'hello'}],
    });
    const portrait=root.querySelector<HTMLImageElement>('img.overlay-badge[data-provider="twitch-source"]');
    expect(portrait?.src).toBe(url);
    expect(portrait?.alt).toContain('alpha');
    expect(root.querySelector('.overlay-service-badge[data-platform="twitch"]')).not.toBeNull();
  });
});

describe('Twitch chatter profile images',()=>{
 it('loads a real chatter identity separately from the source portrait and patches the live row',async()=>{
  const streamer='https://static-cdn.jtvnw.net/jtv_user_pictures/alpha-profile_image-600x600.png';
  const viewer='https://static-cdn.jtvnw.net/jtv_user_pictures/viewer-profile_image-600x600.png';
  const {live,callbacks}=source();
  const events:OverlayLiveEvent[]=[];
  const userLookup=vi.fn(async(login:string)=>login==='viewer'?viewer:null);
  const hub=createLiveHub(live,packet=>{if(packet.type==='event')events.push(packet.event);},
    noBadges as never,undefined,undefined,async()=>streamer,undefined,userLookup);
  hub.connect('alpha','twitch');
  callbacks.get('alpha')!(message('alpha','one'));
  await vi.waitFor(()=>expect(userLookup).toHaveBeenCalledWith('viewer'));
  await vi.waitFor(()=>expect(events.filter(e=>e.type==='badges').at(-1)).toMatchObject({
    type:'badges',messageId:'one',badges:[
      {provider:'twitch-source',url:streamer},
      {provider:'twitch-user',url:viewer},
    ],
  }));
  const next=message('alpha','two');
  callbacks.get('alpha')!(next);
  await Promise.resolve();await Promise.resolve();
  expect(userLookup).toHaveBeenCalledTimes(1);
  expect(events.find(e=>e.type==='message'&&e.message.id==='two')).toMatchObject({
    type:'message',message:{id:'two',user:{badges:[{provider:'twitch-source',url:streamer}]}},
  });
  hub.close();
 });

 it('does not resurrect removed rows with late Twitch viewer pictures',async()=>{
  const {live,callbacks}=source();
  const events:OverlayLiveEvent[]=[];
  let finish!:(value:string|null)=>void;
  const lookup=vi.fn(()=>new Promise<string|null>(r=>{finish=r;}));
  const hub=createLiveHub(live,packet=>{if(packet.type==='event')events.push(packet.event);},
    noBadges as never,undefined,undefined,async()=>null,undefined,lookup);
  hub.connect('alpha','twitch');
  callbacks.get('alpha')!(message('alpha','gone'));
  await vi.waitFor(()=>expect(lookup).toHaveBeenCalledWith('viewer'));
  callbacks.get('alpha')!({platform:'twitch',channelName:'alpha',type:'message-delete',timestamp:101,
    data:{messageId:'gone'}});
  finish('https://static-cdn.jtvnw.net/jtv_user_pictures/viewer-profile_image-600x600.png');
  await Promise.resolve();await Promise.resolve();await Promise.resolve();
  expect(events.filter(e=>e.type==='badges'&&e.messageId==='gone')).toEqual([]);
  hub.close();
 });
});

describe('source owner chat color metadata',()=>{
 it('keeps the owner color on the streamer portrait without borrowing a viewer color',async()=>{
  const {live,callbacks}=source();
  const events:OverlayLiveEvent[]=[];
  const hub=createLiveHub(live,packet=>{if(packet.type==='event')events.push(packet.event)},
    noBadges as never,undefined,undefined,
    async()=>({url,color:'#68BE62'}));
  hub.connect('alpha','twitch');
  const chatter=message('alpha','viewer-color');
  chatter.message!.user.color='#FF00FF';
  callbacks.get('alpha')!(chatter);
  await vi.waitFor(()=>expect(events.filter(e=>e.type==='badges').length).toBeGreaterThan(0));
  const patch=events.filter(e=>e.type==='badges').at(-1);
  expect(patch).toMatchObject({type:'badges',badges:[
    {provider:'twitch-source',color:'#68BE62'},
  ]});
  hub.close();
 });
 it('learns Kick owner color only from the broadcaster, not other chatters',async()=>{
  const {live,callbacks}=source();
  const events:OverlayLiveEvent[]=[];
  const hub=createLiveHub(live,packet=>{if(packet.type==='event')events.push(packet.event)},
    noBadges as never,undefined,undefined,undefined,async()=>url);
  hub.connect('alpha','kick');
  await vi.waitFor(()=>{expect(events.filter(e=>e.type==='badges')).toHaveLength(0)});
  const viewer=message('alpha','viewer');
  viewer.platform='kick';viewer.message!.platform='kick';
  viewer.message!.user.color='#CC0000';
  callbacks.get('alpha')!(viewer);
  const broadcaster=message('alpha','owner');
  broadcaster.platform='kick';broadcaster.message!.platform='kick';
  broadcaster.message!.user.username='alpha';broadcaster.message!.user.color='#00DD88';
  callbacks.get('alpha')!(broadcaster);
  await vi.waitFor(()=>expect(events.filter(e=>e.type==='badges').length).toBeGreaterThan(0));
  const latest=events.filter(e=>e.type==='badges').at(-1);
  expect(latest).toMatchObject({type:'badges',badges:[
    {provider:'kick-source',color:'#00DD88'},
  ]});
  hub.close();
 });
});
