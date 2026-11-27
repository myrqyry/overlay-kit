import {describe,expect,it,vi} from 'vitest';
import {createPreviewAssetLibrary} from '../src/preview-asset-cache';
import {sampleMessage} from '../demo/sample';
import type {DisplayMessage} from '../src/chatbus';

const message=(id:string):DisplayMessage=>({
  id,timestamp:123,sourceId:'twitch:old-room',platform:'twitch',channelName:'old-room',
  user:{id:'user-private',username:'viewer_private',name:'Viewer Private',badges:[
    {id:'subscriber',provider:'twitch',name:'Subscriber',url:'https://cdn.example.org/sub.png'},
    {id:'special',provider:'7tv',name:'7TV',url:'javascript:alert(1)'},
  ]},
  parts:[
    {type:'text',text:'a private livestream message'},
    {type:'emote',emote:{id:'real-id',code:'RealEmote',url:'https://cdn.example.org/emote.webp',provider:'7tv',overlays:[],modifiers:[]}},
  ],
});
const paint={id:'real-paint',provider:'7tv' as const,
  gradients:[{function:'LINEAR_GRADIENT' as const,stops:[{at:0,color:0xfffa20aa},{at:1,color:0xff40d8cc}]}],
};
function memoryStore(){
  const map=new Map<string,string>();
  return {
    getItem:(key:string)=>map.get(key)??null,
    setItem:(key:string,value:string)=>{map.set(key,value);},
    removeItem:(key:string)=>{map.delete(key);},
    map,
  };
}
describe('live ChatBus cosmetics reused only as synthetic preview assets',()=>{
  it('caches real emote and badge artwork plus a late 7TV name paint, without raw chat or user identities',()=>{
    const storage=memoryStore();
    const lib=createPreviewAssetLibrary({storage});
    expect(lib.observe({type:'message',message:message('private-msg-id')})).toBe(true);
    expect(lib.observe({type:'identity',messageId:'private-msg-id',badges:[
      {id:'subscriber',provider:'twitch',name:'Subscriber',url:'https://cdn.example.org/sub.png'},
    ],namePaint:paint})).toBe(true);
    const raw=JSON.stringify([...storage.map.values()]);
    expect(raw).toContain('emote.webp');
    expect(raw).toContain('real-paint');
    for(const sensitive of ['private-msg-id','user-private','viewer_private','Viewer Private','private livestream message','old-room'])
      expect(raw).not.toContain(sensitive);
    const restored=createPreviewAssetLibrary({storage});
    const profiles=restored.profiles();
    expect(profiles).toHaveLength(1);
    expect(profiles[0]?.badges).toHaveLength(1);
    expect(profiles[0]?.paint?.gradients).toHaveLength(1);
    const synthetic=sampleMessage(200,profiles);
    expect(synthetic.user.name).toBe('CloudCat');
    expect(synthetic.user.badges[0]?.url).toBe('https://cdn.example.org/sub.png');
    expect(synthetic.user.namePaint?.id).toBe('real-paint');
    expect(synthetic.parts.some(part=>part.type==='emote'&&part.emote.code==='RealEmote')).toBe(true);
  });
  it('ignores synthetic/live-incompatible input and removes current deleted or moderated cosmetics',()=>{
    const storage=memoryStore();const lib=createPreviewAssetLibrary({storage});
    const data=message('msg');
    lib.observe({type:'message',message:data});
    expect(lib.profiles()).toHaveLength(1);
    lib.observe({type:'delete',messageId:'msg'});
    expect(lib.profiles()).toHaveLength(0);
    lib.observe({type:'message',message:{...data,id:'m2'}});
    lib.observe({type:'user-clear',sourceId:'twitch:old-room',username:'viewer_private'});
    expect(lib.profiles()).toHaveLength(0);
  });
  it('rejects unsafe remote image schemes, invalid persisted data, and expired snapshots',()=>{
    const store=memoryStore();let now=100000;
    const lib=createPreviewAssetLibrary({storage:store,now:()=>now,maxProfiles:2});
    for(let i=0;i<3;i++)lib.observe({type:'message',message:{...message('m'+i),id:'m'+i,
      parts:[{type:'emote',emote:{id:'x'+i,code:'X'+i,url:'https://cdn.example.org/'+i+'.png',overlays:[],modifiers:[]}}]}});
    expect(lib.profiles()).toHaveLength(2);
    expect(lib.profiles().some(p=>p.emotes[0]?.code==='X0')).toBe(false);
    store.setItem(lib.storageKey,'{not JSON');
    expect(createPreviewAssetLibrary({storage:store}).profiles()).toHaveLength(0);
    store.setItem(lib.storageKey,JSON.stringify({version:1,savedAt:now,profiles:[{
      badges:[{name:'bad',url:'javascript:alert(1)'}],
      emotes:[{id:'evil',code:'evil',url:'data:text/html,evil',overlays:[],modifiers:[]}],
      paint:{id:'untrusted',provider:'7tv',gradients:[{function:'URL',imageUrl:'javascript:alert(1)',stops:[]}]},
    }]}));
    expect(createPreviewAssetLibrary({storage:store,now:()=>now}).profiles()).toEqual([]);
    now+=32*24*3600*1000;
    expect(createPreviewAssetLibrary({storage:store,now:()=>now}).profiles()).toEqual([]);
  });
  it('scrubs user and channel labels from cached avatar badge metadata',()=>{
    const store=memoryStore();const lib=createPreviewAssetLibrary({storage:store});
    const item=message('avatar');
    item.user.badges=[{provider:'twitch-user',id:'viewer-avatar',name:'private_handle profile picture',
      tooltip:'@private_handle on Twitch',url:'https://static-cdn.jtvnw.net/jtv_user_pictures/avatar.png'},
      {provider:'twitch-source',id:'source-avatar',name:'secret_room profile picture',
      tooltip:'secret_room on Twitch',url:'https://static-cdn.jtvnw.net/jtv_user_pictures/channel.png'}];
    lib.observe({type:'message',message:item});
    const raw=store.getItem(lib.storageKey)??'';
    expect(raw).not.toContain('private_handle');
    expect(raw).not.toContain('secret_room');
    expect(lib.profiles()[0]?.badges.map(b=>b.name)).toEqual(['Viewer picture','Channel picture']);
  });
  it('deduplicates matching real cosmetics but preserves a later enriched paint variant',()=>{
    const store=memoryStore();
    const lib=createPreviewAssetLibrary({storage:store});
    expect(lib.observe({type:'message',message:message('one')})).toBe(true);
    const first=store.getItem(lib.storageKey);
    expect(lib.observe({type:'message',message:message('two')})).toBe(false);
    expect(lib.profiles()).toHaveLength(1);
    expect(store.getItem(lib.storageKey)).toBe(first);
    expect(lib.observe({type:'identity',messageId:'two',badges:message('two').user.badges,namePaint:paint})).toBe(true);
    expect(lib.profiles()).toHaveLength(2);
  });
  it('clears only its own stored cosmetic library and survives unavailable storage',()=>{
    const store=memoryStore();const lib=createPreviewAssetLibrary({storage:store});
    lib.observe({type:'message',message:message('x')});
    store.setItem('unrelated','keep');
    lib.clear();
    expect(store.getItem('unrelated')).toBe('keep');
    expect(store.getItem(lib.storageKey)).toBeNull();
    const broken={getItem:()=>{throw Error('denied');},setItem:()=>{throw Error('denied');},removeItem:()=>{throw Error('denied');}};
    const other=createPreviewAssetLibrary({storage:broken});
    expect(()=>other.observe({type:'message',message:message('x')})).not.toThrow();
    expect(other.profiles()).toHaveLength(1);
    expect(()=>other.clear()).not.toThrow();
  });
});
