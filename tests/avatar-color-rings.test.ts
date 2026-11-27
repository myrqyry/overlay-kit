// @vitest-environment jsdom
import {describe,expect,it} from 'vitest';
import {createChatMessageElement} from '../src/renderers';
import {createChatFeed} from '../src/views';
import type {DisplayMessage,DisplayBadge} from '../src/chatbus';
const url='https://static-cdn.jtvnw.net/jtv_user_pictures/example-profile_image-600x600.png';
const baseBadges:DisplayBadge[]=[
 {provider:'twitch-source',id:'source-avatar',name:'Streamer',url,color:'#68BE62'},
 {provider:'twitch-user',id:'viewer-avatar',name:'Viewer',url},
 {provider:'twitch',id:'subscriber',name:'Subscriber',url},
];
const message=(badges=baseBadges):DisplayMessage=>({
 id:'m1',platform:'twitch',timestamp:1,
 user:{name:'viewer',username:'viewer',color:'#12AABB',badges},parts:[{type:'text',text:'hi'}],
});
const find=(root:HTMLElement,provider:string)=>
 root.querySelector<HTMLImageElement>('img.overlay-badge[data-provider="'+provider+'"]');

describe('chat portrait rings',()=>{
 it('uses the stream owner color on source portrait and the message usercolor on chatter portrait',()=>{
  const root=createChatMessageElement(message());
  expect(find(root,'twitch-source')?.style.getPropertyValue('--avatar-ring-color')).toBe('#68BE62');
  expect(find(root,'twitch-user')?.style.getPropertyValue('--avatar-ring-color')).toBe('#12AABB');
  expect(find(root,'twitch')?.style.getPropertyValue('--avatar-ring-color')).toBe('');
  expect(find(root,'twitch-source')?.getAttribute('alt')).toBe('Streamer');
 });
 it('never applies a chatter color to streamer portrait without an owner color, including Kick',()=>{
  const root=createChatMessageElement(message([
   {provider:'kick-source',id:'source-avatar',name:'Channel',url},
   {provider:'twitch-user',id:'viewer-avatar',name:'Viewer',url},
  ]));
  expect(find(root,'kick-source')?.style.getPropertyValue('--avatar-ring-color')).toBe('');
  expect(find(root,'twitch-user')?.style.getPropertyValue('--avatar-ring-color')).toBe('#12AABB');
 });
 it('rejects invalid colors, preserving the neutral CSS fallback and ordinary badge artwork',()=>{
  const root=createChatMessageElement(message([
   {provider:'twitch-source',name:'Streamer',url,color:'red; background:red'},
   {provider:'twitch-user',name:'Viewer',url},
   {provider:'7tv',name:'Cosmetic',url},
  ]));
  expect(find(root,'twitch-source')?.style.getPropertyValue('--avatar-ring-color')).toBe('');
  expect(find(root,'7tv')?.style.getPropertyValue('--avatar-ring-color')).toBe('');
  const invalid=message([{provider:'twitch-user',name:'Viewer',url}]);
  invalid.user.color='javascript:alert(1)';
  const other=createChatMessageElement(invalid);
  expect(find(other,'twitch-user')?.style.getPropertyValue('--avatar-ring-color')).toBe('');
 });
 it('recomputes separate rings for late badge patches and preserves them when appearance refreshes',()=>{
  const root=document.createElement('div');
  const feed=createChatFeed(root,{showSourceBadges:true,showViewerBadges:true});
  feed.receive(message([]));
  feed.updateBadges('m1',baseBadges);
  expect(find(root,'twitch-source')?.style.getPropertyValue('--avatar-ring-color')).toBe('#68BE62');
  expect(find(root,'twitch-user')?.style.getPropertyValue('--avatar-ring-color')).toBe('#12AABB');
  feed.configure({showSourceBadges:false});
  feed.refreshAppearance();
  expect(find(root,'twitch-source')).toBeNull();
  expect(find(root,'twitch-user')?.style.getPropertyValue('--avatar-ring-color')).toBe('#12AABB');
  feed.configure({showSourceBadges:true});
  feed.refreshAppearance();
  expect(find(root,'twitch-source')?.style.getPropertyValue('--avatar-ring-color')).toBe('#68BE62');
  feed.dispose();
 });
});
