import {describe,expect,it} from 'vitest';
import {createKickBadgeCatalog,normalizeKickEvent, type ChatEvent} from '@myrqyry/chatbus';
import {createLiveHub, type LiveSource} from '../server/hub';
import {createChatFeed} from '../src/views';
import {applyLiveEvent} from '../src/live-client';

const image=(id:number)=>`https://files.kick.com/channel_subscriber_badges/${id}/conversion/original-fullsize.png`;
const sample={subscriber_badges:[
  {months:1,badge_image:{src:image(11)}},
  {months:3,badge_image:{src:image(22)}},
  {months:12,badge_image:{src:image(33)}},
]};
const kickMessage=(id:string, count:string):ChatEvent=>({
  type:'message',platform:'kick',timestamp:1000,
  message:{id,platform:'kick',timestamp:1000,
    user:{platform:'kick',username:'viewer',badgeRefs:[
      {provider:'kick',id:'subscriber',version:count},
      {provider:'kick',id:'moderator'},
    ]},text:'hi',fragments:[{type:'text',text:'hi'}]},
});
const stub=()=>{
  const callbacks:((event:ChatEvent)=>void)[]=[];
  const source:LiveSource={connect:o=>{callbacks.push(o.onEvent);return {close(){}};},
    emotes:async()=>({emotes:{},complete:true})};
  return {source,callbacks};
};

describe('OverlayKit consumes Chatbus Kick badges',()=>{
  it('renders selected native v2 badges immediately and adds subscribers without losing them',async()=>{
    const {source,callbacks}=stub();
    let finish:(value:unknown)=>void=()=>{};
    const catalog=createKickBadgeCatalog(()=>new Promise(resolve=>{finish=resolve;}));
    const packets:any[]=[];
    const hub=createLiveHub(source,p=>packets.push(p),undefined,undefined,()=>catalog);
    hub.connect('nickwhite','kick');
    const goat='https://ext.cdn.kick.com/chat/badges/GOAT_019f591b-30ae-7285-8377-293e708a5e30.png';
    const gold='https://ext.cdn.kick.com/chat/badges/GoldenK_019f591b-0a69-712f-836d-8cc8962acd0c.png';
    const level='https://ext.cdn.kick.com/chat/badges/50_b83d144a-3f6f-4bbe-a50c-80aebc21420b.png';
    const native=normalizeKickEvent({type:'ChatMessage',data:{
      id:'native-k',chatroom_id:92721,created_at:'2026-10-28T20:00:00Z',content:'hey',
      sender:{id:21,username:'nativeviewer',identity:{
        badges:[{type:'subscriber',count:2,text:'Subscriber'}],
        badges_v2:[
          {name:'level',badge_type:'global',image_url:level,metadata:{level:50},selected:false,sort_order:1},
          {name:'GOAT',badge_type:'global',image_url:goat,selected:true,sort_order:4},
          {name:'GoldenK',badge_type:'global',image_url:gold,selected:false,sort_order:4},
        ],
      }},
    }},{channelName:'nickwhite'});
    expect(native).not.toBeNull();
    callbacks[0]!(native!);
    const incoming=packets.find(p=>p.event?.type==='message')!.event;
    expect(incoming.message.user.badges).toEqual([
      expect.objectContaining({name:'Level 50',url:level}),
      expect.objectContaining({name:'GOAT',url:goat}),
      expect.objectContaining({provider:'kick',id:'subscriber',text:'SUB 2'}),
    ]);
    const root=document.createElement('div');
    const chat=createChatFeed(root,{maxActive:4,ttlMs:100_000});
    applyLiveEvent(chat,incoming);
    const row=root.querySelector('.overlay-chat-message');
    expect(Array.from(row!.querySelectorAll<HTMLImageElement>('img.overlay-badge')).map(img=>img.src)).toEqual([level,goat]);
    expect(row!.querySelector<HTMLElement>('[data-badge-fallback]')?.textContent).toBe('SUB 2');
    finish(sample);
    await new Promise(resolve=>setTimeout(resolve,0));
    const late=packets.filter(p=>p.event?.type==='badges').at(-1)?.event;
    expect(late).toMatchObject({type:'badges',messageId:'native-k',badges:[
      {name:'Level 50',url:level},{name:'GOAT',url:goat},{name:'Subscriber (1 month)',url:image(11)},
    ]});
    applyLiveEvent(chat,late);
    expect(root.querySelector('.overlay-chat-message')).toBe(row);
    expect(Array.from(row!.querySelectorAll<HTMLImageElement>('img.overlay-badge')).map(img=>img.src))
      .toEqual([level,goat,image(11)]);
    expect(Array.from(row!.querySelectorAll<HTMLImageElement>('img.overlay-badge')).map(img=>img.dataset.provider))
      .toEqual(['kick','kick','kick']);
    chat.dispose();
    hub.close();
  });
  it('shows image-backed Kick badges even without subscriber references',()=>{
    const {source,callbacks}=stub();
    const packets:any[]=[];
    const hub=createLiveHub(source,p=>packets.push(p),undefined,undefined,
      ()=>createKickBadgeCatalog(async()=>({subscriber_badges:[]})));
    hub.connect('nickwhite','kick');
    const flyby='https://ext.cdn.kick.com/chat/badges/Flyby_019f591a-e1bb-7a1a-be0a-97d8d1ae1a91.png';
    const native=normalizeKickEvent({type:'ChatMessage',data:{
      id:'native-only',chatroom_id:92721,created_at:'2026-10-28T20:00:00Z',content:'hi',
      sender:{id:22,username:'solo',identity:{badges_v2:[
        {name:'Flyby',badge_type:'global',image_url:flyby,selected:true,sort_order:4},
      ]}},
    }},{channelName:'nickwhite'});
    callbacks[0]!(native!);
    const packet=packets.find(p=>p.event?.type==='message')?.event;
    expect(packet?.message.user.badges).toEqual([expect.objectContaining({name:'Flyby',url:flyby})]);
    hub.close();
  });

  it('keeps chat immediate and updates a visible row with authentic channel art',async()=>{
    const {source,callbacks}=stub();
    let finish:(value:unknown)=>void=()=>{};
    const catalog=createKickBadgeCatalog(()=>new Promise(resolve=>{finish=resolve;}));
    const packets:any[]=[];
    const hub=createLiveHub(source,p=>packets.push(p),undefined,undefined,()=>catalog);
    hub.connect('example','kick');
    expect(hub.status().badges).toBe('loading');
    callbacks[0]!(kickMessage('k1','5'));
    expect(packets.find(p=>p.event?.type==='message')?.event.message.user.badges).toEqual([
      expect.objectContaining({provider:'kick',id:'subscriber',text:'SUB 5'}),
      expect.objectContaining({provider:'kick',id:'moderator',text:'MOD'}),
    ]);
    const root=document.createElement('div');
    const chat=createChatFeed(root,{maxActive:5,ttlMs:100_000});
    const initial=packets.find(p=>p.event?.type==='message')!.event;
    applyLiveEvent(chat,initial);
    const row=root.querySelector('.overlay-chat-message');
    expect(row?.querySelectorAll('img.overlay-badge')).toHaveLength(0);
    expect(Array.from(row!.querySelectorAll('[data-badge-fallback]'),e=>e.textContent)).toEqual(['SUB 5','MOD']);
    expect(row?.querySelector<HTMLElement>('[data-badge-fallback]')?.textContent).toBe('SUB 5');
    finish(sample);
    await new Promise(resolve=>setTimeout(resolve,0));
    expect(packets.filter(p=>p.event?.type==='badges').at(-1)?.event).toMatchObject({
      messageId:'k1',badges:[
        {name:'Subscriber (3 months)',provider:'kick',url:image(22)},
        {name:'Moderator',provider:'kick',text:'MOD'},
      ],
    });
    const late=packets.filter(p=>p.event?.type==='badges').at(-1)!.event;
    applyLiveEvent(chat,late);
    expect(root.querySelector('.overlay-chat-message')).toBe(row); // no row replay
    expect(row?.querySelector<HTMLImageElement>('.overlay-badge[data-provider="kick"]')?.src).toBe(image(22));
    expect(row?.querySelector<HTMLImageElement>('.overlay-badge')?.alt).toBe('Subscriber (3 months)');
    expect(hub.status().badges).toBe('ready');
    callbacks[0]!(kickMessage('k2','12'));
    expect(packets.filter(p=>p.event?.type==='message').at(-1)?.event.message.user.badges).toEqual([
      expect.objectContaining({name:'Subscriber (12 months)',provider:'kick',url:image(33)}),
      expect.objectContaining({name:'Moderator',provider:'kick',text:'MOD'}),
    ]);
    chat.dispose();
    hub.close();
  });

  it('ignores old Kick catalog completions after changing channels',async()=>{
    const {source,callbacks}=stub();
    const resolutions=new Map<string,(value:unknown)=>void>();
    const created:ReturnType<typeof createKickBadgeCatalog>[]=[];
    const packets:any[]=[];
    const hub=createLiveHub(source,p=>packets.push(p),undefined,undefined,()=>{
      const catalog=createKickBadgeCatalog(url=>new Promise(resolve=>{resolutions.set(url,resolve);}));
      created.push(catalog);return catalog;
    });
    hub.connect('old','kick');
    callbacks[0]!(kickMessage('k-old','12'));
    hub.connect('new','kick');
    callbacks[1]!(kickMessage('k-new','3'));
    resolutions.get('https://kick.com/api/v2/channels/old')!(sample);
    await new Promise(resolve=>setTimeout(resolve,0));
    expect(packets.filter(p=>p.event?.type==='badges')).toHaveLength(0);
    resolutions.get('https://kick.com/api/v2/channels/new')!(sample);
    await new Promise(resolve=>setTimeout(resolve,0));
    expect(packets.filter(p=>p.event?.type==='badges').map(p=>p.event.messageId)).toEqual(['k-new']);
    expect(created).toHaveLength(2);
    hub.close();
  });
});

describe('Kick semantic role badge fallbacks',()=>{
  it('keeps subscriber and sub-gifter badges visible before/without artwork and replaces subscriber fallback when art resolves',async()=>{
    const {source,callbacks}=stub();
    let finish:(value:unknown)=>void=()=>{};
    const catalog=createKickBadgeCatalog(()=>new Promise(resolve=>{finish=resolve;}));
    const packets:any[]=[];
    const hub=createLiveHub(source,p=>packets.push(p),undefined,undefined,()=>catalog);
    hub.connect('example','kick');
    const event=normalizeKickEvent({type:'ChatMessage',data:{
      id:'roles',chatroom_id:42,content:'yo',created_at:'2026-11-02T18:00:00Z',
      sender:{id:5,username:'gifter',identity:{color:'#53fc18',badges:[
        {type:'subscriber',text:'Subscriber',count:3},
        {type:'sub_gifter',text:'Sub Gifter',count:12},
      ]}},
    }},{channelName:'example'});
    callbacks[0]!(event!);
    const initial=packets.find(p=>p.event?.type==='message')!.event;
    expect(initial.message.user.badges).toEqual([
      expect.objectContaining({provider:'kick',id:'subscriber',text:'SUB 3'}),
      expect.objectContaining({provider:'kick',id:'sub_gifter',text:'GIFT 12'}),
    ]);
    const root=document.createElement('div');
    const chat=createChatFeed(root,{maxActive:4,ttlMs:100_000});
    applyLiveEvent(chat,initial);
    expect(Array.from(root.querySelectorAll<HTMLElement>('[data-badge-fallback]')).map(x=>x.textContent))
      .toEqual(['SUB 3','GIFT 12']);

    finish(sample);
    await new Promise(resolve=>setTimeout(resolve,0));
    const late=packets.filter(p=>p.event?.type==='badges').at(-1)!.event;
    expect(late.badges).toEqual([
      expect.objectContaining({provider:'kick',id:'subscriber',url:image(22)}),
      expect.objectContaining({provider:'kick',id:'sub_gifter',text:'GIFT 12'}),
    ]);
    applyLiveEvent(chat,late);
    expect(root.querySelector<HTMLImageElement>('img.overlay-badge[data-provider="kick"]')?.src).toBe(image(22));
    expect(Array.from(root.querySelectorAll<HTMLElement>('[data-badge-fallback]')).map(x=>x.textContent))
      .toEqual(['GIFT 12']);
    chat.dispose();hub.close();
  });
});
