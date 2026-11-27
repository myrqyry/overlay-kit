// @vitest-environment jsdom
import {describe,it,expect} from 'vitest';
import {DEFAULT_OPTIONS,normalizeOptions,readOptions,writeOptions,optionsForEditor} from '../src/options';
import {createChatMessageElement} from '../src/renderers';
import {createChatFeed} from '../src/views';
import type {DisplayBadge,DisplayMessage} from '../src/chatbus';

const badges:DisplayBadge[]=[
 {provider:'twitch-source',id:'source-avatar',name:'Streamer',url:'/streamer.png'},
 {provider:'twitch-user',id:'viewer-avatar',name:'Viewer',url:'/viewer.png'},
 {provider:'twitch',id:'moderator',name:'Moderator',url:'/mod.png'},
 {provider:'kick',id:'verified',name:'Verified',url:'/verified.png'},
 {provider:'twitch',id:'subscriber',name:'Subscriber',url:'/sub.png'},
 {provider:'kick',id:'sub_gifter',name:'Gift',text:'GIFT 1'},
 {provider:'7tv',id:'cosmetic',name:'7TV',url:'/cosmetic.png'},
 {provider:'kick',id:'flyby',name:'Flyby',url:'/flyby.png'},
];
const message=(id='b1',input=badges):DisplayMessage=>({
 id,timestamp:100,platform:'twitch',user:{name:'viewer',badges:input},parts:[{type:'text',text:'hi'}],
});
const visible=(root:HTMLElement)=>Array.from(root.querySelectorAll<HTMLElement>('[data-badge-container] .overlay-badge'))
 .map(el=>el.tagName==='IMG'?(el as HTMLImageElement).alt:el.textContent);
const categories=[
 ['showSourceBadges','Streamer'],
 ['showViewerBadges','Viewer'],
 ['showRoleBadges','Moderator','Verified'],
 ['showSubscriberBadges','Subscriber'],
 ['showGifterBadges','GIFT 1'],
 ['showCosmeticBadges','7TV','Flyby'],
] as const;
describe('granular badge controls',()=>{
 it('exposes independent toggles in Chat editor and source URLs, preserving defaults',()=>{
  const definitions=optionsForEditor('chat',false);
  const keys=['showBadges','showPlatformBadges',...categories.map(x=>x[0])];
  for(const key of keys){
   const def=definitions.find(x=>x.key===key);
   expect(def?.kind).toBe('toggle');
   expect(def?.section).toBe('Chat • Badges');
   expect(DEFAULT_OPTIONS[key as keyof typeof DEFAULT_OPTIONS]).toBe(true);
   const changed=normalizeOptions({[key]:'false'});
   expect(changed[key as keyof typeof changed]).toBe(false);
   const query=writeOptions(changed,'chat');
   expect(readOptions('?'+query,'chat')[key as keyof typeof changed]).toBe(false);
   expect(writeOptions(changed,'wall')).not.toContain(def!.query+'=');
  }
  expect(readOptions('?badges=0','chat').showBadges).toBe(false);
 });
 it.each(categories)('hides %s independently while retaining other visible badge types', (key,...hidden)=>{
  const normal=createChatMessageElement(message());
  const selected=createChatMessageElement(message(),{[key]:false});
  expect(visible(normal)).toHaveLength(badges.length);
  for(const label of hidden)expect(visible(selected)).not.toContain(label);
  for(const badge of visible(normal).filter(x=>!hidden.includes(x as never)))
   expect(visible(selected)).toContain(badge);
  expect(selected.querySelector('.overlay-service-badge[data-platform="twitch"]')).not.toBeNull();
 });
 it('toggles platform icon without hiding other badge types, and honors master switch',()=>{
  const none=createChatMessageElement(message(),{showPlatformBadges:false});
  expect(none.querySelector('.overlay-service-badge')).toBeNull();
  expect(visible(none)).toHaveLength(badges.length);
  const off=createChatMessageElement(message(),{showBadges:false});
  expect(visible(off)).toEqual([]);
  expect(off.querySelector('.overlay-service-badge')).not.toBeNull();
 });
 it('filters late badge and identity updates and reconfiguration without destroying the stored badges',()=>{
  const root=document.createElement('div');
  const feed=createChatFeed(root,{showSourceBadges:false,showCosmeticBadges:false,showPlatformBadges:false});
  feed.receive(message('late',[]));
  expect(visible(root)).toHaveLength(0);
  feed.updateBadges('late',badges);
  expect(visible(root)).toEqual(['Viewer','Moderator','Verified','Subscriber','GIFT 1']);
  expect(root.querySelector('.overlay-service-badge')).toBeNull();
  feed.updateIdentity('late',{badges});
  expect(visible(root)).toEqual(['Viewer','Moderator','Verified','Subscriber','GIFT 1']);
  feed.configure({showSourceBadges:true,showCosmeticBadges:true,showPlatformBadges:true});
  feed.refreshAppearance();
  expect(visible(root)).toHaveLength(badges.length);
  expect(root.querySelector('.overlay-service-badge[data-platform="twitch"]')).not.toBeNull();
  feed.dispose();
 });
});
