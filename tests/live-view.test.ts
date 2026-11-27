import { describe,expect,it } from 'vitest';
import { createChatFeed,createEmoteWall } from '../src/views';
import { applyLiveEvent } from '../src/live-client';
import type { DisplayMessage } from '../src/chatbus';
const sample=(id:string,userId:string,sourceId?:string,platform?:string):DisplayMessage=>({
 id,timestamp:1000,...(sourceId?{sourceId}:{}),...(platform?{platform}:{}),
 user:{id:userId,username:userId,name:userId,badges:[]},
 parts:[{type:'text',text:'Hi'},{type:'emote',emote:{id:'a',code:'Hey',url:'/assets/smile.svg',overlays:[],modifiers:[]}}],
});
describe('moderation across emote wall and chat',()=>{
 it('deletes messages, clears users and clears whole scene',()=>{
  const c=createChatFeed(document.createElement('div'));
  const w=createEmoteWall(document.createElement('div'));
  for(const message of [sample('m1','alice'),sample('m2','bob'),sample('m3','alice')]) {
   applyLiveEvent(c,{type:'message',message});applyLiveEvent(w,{type:'message',message});
  }
  expect(c.snapshot()).toHaveLength(3);expect(w.snapshot()).toHaveLength(3);
  applyLiveEvent(c,{type:'delete',messageId:'m1'}); applyLiveEvent(w,{type:'delete',messageId:'m1'});
  expect(c.snapshot().map(x=>x.id)).toEqual(['m2','m3']);
  expect(w.snapshot().map(x=>x.id)).toEqual(['m2:emote:0','m3:emote:0']);
  applyLiveEvent(c,{type:'user-clear',userId:'alice'});applyLiveEvent(w,{type:'user-clear',userId:'alice'});
  expect(c.snapshot().map(x=>x.id)).toEqual(['m2']); expect(w.snapshot().map(x=>x.id)).toEqual(['m2:emote:0']);
  applyLiveEvent(c,{type:'clear'});applyLiveEvent(w,{type:'clear'});
  expect(c.snapshot()).toHaveLength(0);expect(w.snapshot()).toHaveLength(0);
  c.dispose();w.dispose();
 });
 it('scopes provider clears and bans to one mixed-chat source',()=>{
  const c=createChatFeed(document.createElement('div'));
  const w=createEmoteWall(document.createElement('div'));
  const twitch=sample('twitch:alpha:m1','same-user','twitch:alpha','twitch');
  const youtube=sample('youtube:video:m2','same-user','youtube:video','youtube');
  for(const message of [twitch,youtube]){
    applyLiveEvent(c,{type:'message',message});applyLiveEvent(w,{type:'message',message});
  }
  applyLiveEvent(c,{type:'user-clear',sourceId:'youtube:video',userId:'same-user'});
  applyLiveEvent(w,{type:'user-clear',sourceId:'youtube:video',userId:'same-user'});
  expect(c.snapshot().map(x=>x.value.platform)).toEqual(['twitch']);
  expect(w.snapshot()).toHaveLength(1);
  applyLiveEvent(c,{type:'message',message:youtube});applyLiveEvent(w,{type:'message',message:youtube});
  applyLiveEvent(c,{type:'clear',sourceId:'youtube:video'});applyLiveEvent(w,{type:'clear',sourceId:'youtube:video'});
  expect(c.snapshot().map(x=>x.value.platform)).toEqual(['twitch']);
  expect(w.snapshot()).toHaveLength(1);
  c.dispose();w.dispose();
 });
});

describe('late arriving Twitch badge assets',()=>{
 it('patches existing chat rows without restarting animation, changing TTL or resurrecting deleted items',()=>{
  const root=document.createElement('div');
  const c=createChatFeed(root);
  const message=sample('late','alice');
  applyLiveEvent(c,{type:'message',message});
  const el=root.querySelector<HTMLElement>('[data-message-id=late]')!;
  expect(el.querySelectorAll('.overlay-badge')).toHaveLength(0);
  const badge={name:'Moderator',url:'https://static-cdn.jtvnw.net/badges/v1/mod/1'};
  applyLiveEvent(c,{type:'badges',messageId:'late',badges:[badge]});
  expect(root.querySelector('[data-message-id=late]')).toBe(el);
  expect(el.querySelector('.overlay-badge')?.getAttribute('src')).toBe(badge.url);
  expect(c.snapshot()[0]?.value.user.badges).toEqual([badge]);
  applyLiveEvent(c,{type:'delete',messageId:'late'});
  applyLiveEvent(c,{type:'badges',messageId:'late',badges:[badge]});
  expect(root.querySelector('[data-message-id=late]')).toBeNull();
  expect(c.snapshot()).toHaveLength(0);
  c.dispose();
 });
});

describe('cosmetic identity updates reuse existing rows',()=>{
 it('adds third-party badges and name paint without replacing the message element or moving the scene clock',()=>{
  const root=document.createElement('div');
  const feed=createChatFeed(root);
  feed.receive(sample('cosmetics','alice'));
  const row=root.querySelector<HTMLElement>('[data-message-id="cosmetics"]')!;
  const before=feed.snapshot()[0]!.enteredAt;
  applyLiveEvent(feed,{type:'identity',messageId:'cosmetics',
    badges:[
      {name:'BTTV',url:'https://example.net/bttv.webp',provider:'bttv'},
      {name:'FFZ',url:'https://example.net/ffz.webp',provider:'ffz'},
      {name:'7TV',url:'https://example.net/7tv.webp',provider:'7tv'},
    ],
    namePaint:{id:'n',provider:'7tv',color:0xff224488,gradients:[{
      function:'LINEAR_GRADIENT',angle:40,stops:[{at:0,color:0xff123456},{at:1,color:0xffabcdef}],
    }]},
  });
  expect(root.querySelector('[data-message-id="cosmetics"]')).toBe(row);
  expect(feed.snapshot()[0]!.enteredAt).toBe(before);
  expect(Array.from(row.querySelectorAll('.overlay-badge')).map(x=>x.getAttribute('data-provider')))
    .toEqual(['bttv','ffz','7tv']);
  expect(row.querySelector<HTMLElement>('[data-username]')?.style.backgroundImage).toContain('linear-gradient');
  applyLiveEvent(feed,{type:'delete',messageId:'cosmetics'});
  applyLiveEvent(feed,{type:'identity',messageId:'cosmetics',
    badges:[{name:'late',url:'https://example.net/x.webp'}]});
  expect(root.querySelector('.overlay-chat-message')).toBeNull();
  feed.dispose();
 });
});
