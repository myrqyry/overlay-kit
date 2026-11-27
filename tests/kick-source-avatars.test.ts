// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import type { ChatEvent, EmoteSet } from '@myrqyry/chatbus';
import { createLiveHub, createLiveMixer, type LiveSource } from '../server/hub';
import { createLiveReplayBuffer } from '../server/live-replay';
import { createChatMessageElement } from '../src/renderers';
import type { OverlayLiveEvent } from '../src/live';

const url='https://files.kick.com/images/user/93786/profile_image/conversion/b21d2c10-257e-4f64-adb4-6044d57751ab-fullsize.webp';
function message(platform:'kick'|'twitch',channel:string,id:string):ChatEvent {
  return {type:'message',platform,timestamp:100,
    channelName:channel,message:{
      id,platform,timestamp:100,channelName:channel,
      user:{platform,id:'viewer',username:'viewer'},
      text:'hey',fragments:[{type:'text',text:'hey'}],
    },
  };
}
function source(){
  const callbacks=new Map<string,(event:ChatEvent)=>void>();
  const live:LiveSource={
    connect:opts=>{
      const key=(opts.platform??'twitch')+':'+opts.channel;
      callbacks.set(key,opts.onEvent);
      return {close:()=>callbacks.delete(key)};
    },
    emotes:async()=>({emotes:{} as EmoteSet,complete:true}),
  };
  return {live,callbacks};
}
const blankBadges=()=>({
  resolve:()=>[],health:()=> 'ready' as const,
  loadGlobal:async()=>{},loadChannel:async()=>{},
});

describe('Kick source portraits in OverlayKit multichat',()=>{
  it('delivers Kick chat first and patches the verified streamer badge in place',async()=>{
    let finish!:(image:string|null)=>void;
    const loadKick=vi.fn(()=>new Promise<string|null>(resolve=>{finish=resolve;}));
    const {live,callbacks}=source();
    const events:OverlayLiveEvent[]=[];
    const hub=createLiveHub(live,packet=>{if(packet.type==='event')events.push(packet.event);},
      blankBadges as never,undefined,blankBadges as never,undefined,loadKick);
    hub.connect('nickwhite','kick');
    callbacks.get('kick:nickwhite')!(message('kick','nickwhite','m1'));
    expect(events).toContainEqual(expect.objectContaining({type:'message',message:expect.objectContaining({id:'m1'})}));
    const initial=events.find(item=>item.type==='message' && item.message.id==='m1');
    expect(initial?.type==='message'?initial.message.user.badges:undefined).toEqual([]);
    finish(url);
    await Promise.resolve();await Promise.resolve();await Promise.resolve();
    expect(events).toContainEqual({type:'badges',messageId:'m1',
      badges:[expect.objectContaining({provider:'kick-source',url,name:expect.stringContaining('nickwhite')})]});
    callbacks.get('kick:nickwhite')!(message('kick','nickwhite','m2'));
    expect(events.at(-1)).toMatchObject({type:'message',message:{id:'m2',user:{
      badges:[expect.objectContaining({provider:'kick-source',url})],
    }}});
    expect(loadKick).toHaveBeenCalledTimes(1);
    hub.close();
  });

  it('keeps Kick subscriber role badges when the source portrait appears',async()=>{
    let finish!:(image:string|null)=>void;
    const {live,callbacks}=source();
    const events:OverlayLiveEvent[]=[];
    const hub=createLiveHub(live,packet=>{if(packet.type==='event')events.push(packet.event);},
      blankBadges as never,undefined,blankBadges as never,undefined,
      ()=>new Promise(resolve=>{finish=resolve;}));
    hub.connect('nickwhite','kick');
    const subscribed=message('kick','nickwhite','subbed');
    subscribed.message!.user.badgeRefs=[{provider:'kick',id:'subscriber',version:'3',info:'Subscriber'}];
    callbacks.get('kick:nickwhite')!(subscribed);
    const initial=events.find(event=>event.type==='message');
    expect(initial?.type==='message'?initial.message.user.badges:[])
      .toContainEqual(expect.objectContaining({provider:'kick',text:'SUB 3'}));
    finish(url);
    await Promise.resolve();await Promise.resolve();await Promise.resolve();
    const latest=events.filter(event=>event.type==='badges').at(-1);
    expect(latest).toMatchObject({type:'badges',messageId:'subbed',badges:[
      {provider:'kick-source',url},{provider:'kick',text:'SUB 3'},
    ]});
    hub.close();
  });

  it('retains moderator, verified, and Gift25 identity when a Kick channel portrait arrives late',async()=>{
    let finish!:(value:string|null)=>void;
    const {live,callbacks}=source();
    const events:OverlayLiveEvent[]=[];
    const hub=createLiveHub(live,packet=>{if(packet.type==='event')events.push(packet.event);},
      blankBadges as never,undefined,blankBadges as never,undefined,
      ()=>new Promise(resolve=>{finish=resolve;}));
    hub.connect('nickwhite','kick');
    const roles=message('kick','nickwhite','roles');
    roles.message!.user.badgeRefs=[
      {provider:'kick',id:'moderator'},
      {provider:'kick',id:'verified'},
      {provider:'kick',id:'sub_gifter',version:'25'},
    ];
    callbacks.get('kick:nickwhite')!(roles);
    const first=events.find(item=>item.type==='message');
    expect(first?.type==='message'?
      first.message.user.badges.map(badge=>badge.text):[])
      .toEqual(['MOD','VERIFIED','GIFT 25']);
    finish(url);
    await Promise.resolve();await Promise.resolve();await Promise.resolve();
    const late=events.filter(item=>item.type==='badges').at(-1);
    expect(late?.type==='badges'?late.badges.map(badge=>badge.url??badge.text):[]).toEqual([
      url,'MOD','VERIFIED','GIFT 25',
    ]);
    hub.close();
  });

  it('keeps Kick and Twitch pictures separate in same-name multichat sources and replay',async()=>{
    const {live,callbacks}=source();
    const events:OverlayLiveEvent[]=[];
    const mixer=createLiveMixer(live,packet=>{if(packet.type==='event')events.push(packet.event);},
      blankBadges as never,undefined,blankBadges as never,undefined,
      async channel=>channel==='nickwhite'?url:null);
    mixer.addSource('nickwhite','twitch');mixer.addSource('nickwhite','kick');
    callbacks.get('twitch:nickwhite')!(message('twitch','nickwhite','same'));
    callbacks.get('kick:nickwhite')!(message('kick','nickwhite','same'));
    await Promise.resolve();await Promise.resolve();await Promise.resolve();
    expect(events.filter(item=>item.type==='badges')).toEqual([
      expect.objectContaining({messageId:'kick:nickwhite:same'}),
    ]);
    const replay=createLiveReplayBuffer();
    for(const event of events)replay.apply(event);
    const snapshot=replay.snapshot().map(item=>item.message);
    expect(snapshot.find(item=>item.sourceId==='kick:nickwhite')?.user.badges)
      .toContainEqual(expect.objectContaining({provider:'kick-source',url}));
    expect(snapshot.find(item=>item.sourceId==='twitch:nickwhite')?.user.badges).toEqual([]);
    mixer.close();
  });

  it('ignores an old Kick image after channel switches and after moderation deletes the row',async()=>{
    const pending:Array<(value:string|null)=>void>=[];
    const {live,callbacks}=source();
    const events:OverlayLiveEvent[]=[];
    const hub=createLiveHub(live,packet=>{if(packet.type==='event')events.push(packet.event);},
      blankBadges as never,undefined,blankBadges as never,undefined,
      ()=>new Promise(resolve=>pending.push(resolve)));
    hub.connect('nickwhite','kick');
    callbacks.get('kick:nickwhite')!(message('kick','nickwhite','old'));
    callbacks.get('kick:nickwhite')!({type:'message-delete',platform:'kick',timestamp:100,data:{messageId:'old'}});
    pending[0]!(url);
    await Promise.resolve();await Promise.resolve();
    expect(events.filter(event=>event.type==='badges')).toEqual([]);
    hub.connect('newchannel','kick');
    callbacks.get('kick:newchannel')!(message('kick','newchannel','new'));
    expect(events.at(-1)).toMatchObject({type:'message',message:{id:'new',user:{badges:[]}}});
    hub.close();
    pending[1]!(url);
    await Promise.resolve();await Promise.resolve();
    expect(events.filter(event=>event.type==='badges')).toEqual([]);
  });

  it('renders Kick portrait as the source badge without hiding native Kick icon',()=>{
    const element=createChatMessageElement({
      id:'kick-test',timestamp:100,platform:'kick',channelName:'nickwhite',
      user:{name:'viewer',badges:[{provider:'kick-source',name:'nickwhite profile picture',url}]},
      parts:[{type:'text',text:'hello'}],
    });
    const photo=element.querySelector<HTMLImageElement>('img.overlay-badge[data-provider="kick-source"]');
    expect(photo?.src).toBe(url);
    expect(photo?.alt).toBe('nickwhite profile picture');
    expect(element.querySelector('.overlay-service-badge[data-platform="kick"]')).not.toBeNull();
  });
});
