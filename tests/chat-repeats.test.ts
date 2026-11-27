import {describe,it,expect,vi} from 'vitest';
import {createChatFeed} from '../src/views';
import {normalizeOptions,readOptions,writeOptions} from '../src/options';
import type {DisplayMessage} from '../src/chatbus';
const msg=(id:string,text='hello',user='alice',sourceId='twitch:room'):DisplayMessage=>({
 id,timestamp:1,sourceId,user:{name:user,username:user,badges:[]},parts:[{type:'text',text}]
});
describe('chat repeat presentation',()=>{
 it('defaults to uncompressed and exposes URL options',()=>{
  const root=document.createElement('div');const f=createChatFeed(root);
  f.receive(msg('1'));f.receive(msg('2'));expect(f.snapshot()).toHaveLength(2);f.dispose();
  const settings=normalizeOptions({repeatMode:'bump',repeatMatch:'normalized',repeatScope:'channel',repeatWindow:8});
  expect(readOptions('?'+writeOptions(settings,'chat'),'chat')).toMatchObject({repeatMode:'bump',repeatMatch:'normalized',repeatScope:'channel',repeatWindow:8});
 });
 it('keeps the same DOM row, counts and bumps to latest without changing other rows',()=>{
  const root=document.createElement('div');const f=createChatFeed(root,{repeatMode:'bump'});
  f.receive(msg('1'));const row=root.firstElementChild;
  f.receive(msg('2','other'));f.receive(msg('3'));
  expect(f.snapshot().map(x=>x.id)).toEqual(['2','1']);
  expect(root.lastElementChild).toBe(row);
  expect(row?.querySelector('.overlay-repeat-count')?.textContent).toBe('×2');
  expect(f.receive(msg('3'))).toBe(false);
  f.refreshAppearance();expect(row?.querySelector('.overlay-repeat-count')?.textContent).toBe('×2');
  f.dispose();
 });
 it('keeps the counter in its own bubble-level corner slot through appearance refresh',()=>{
  const root=document.createElement('div');const f=createChatFeed(root,{repeatMode:'count'});
  f.receive(msg('1'));f.receive(msg('2'));
  const row=root.firstElementChild!;
  const badge=row.querySelector('.overlay-repeat-count');
  expect(badge?.parentElement).toBe(row);
  expect(row.firstElementChild).toBe(badge);
  expect(row.querySelector('.overlay-message-body')?.textContent).toBe('hello');
  f.configure({nameplateStyle:'floating',textAlign:'right'});f.refreshAppearance();
  expect(row.firstElementChild?.className).toBe('overlay-repeat-count');
  f.configure({repeatShowCount:false});
  expect(row.querySelector('.overlay-repeat-count')).toBeNull();
  expect(row.hasAttribute('data-repeat-badge')).toBe(false);
  f.dispose();
 });
 it('counts in place, isolates room and sender, and handles member deletion',()=>{
  const root=document.createElement('div');const f=createChatFeed(root,{repeatMode:'count',deleteEffect:'none'});
  f.receive(msg('1'));f.receive(msg('2','other'));f.receive(msg('3'));
  f.receive(msg('4','hello','bob'));f.receive(msg('5','hello','alice','kick:room'));
  expect(f.snapshot().map(x=>x.id)).toEqual(['1','2','4','5']);
  f.removeMessage('3');expect(f.snapshot().map(x=>x.id)).toEqual(['2','4','5']);
  f.receive(msg('6'));expect(f.snapshot().map(x=>x.id)).toEqual(['2','4','5','6']);f.dispose();
 });
 it('collective mode exposes participants and honors moderation of a nonrepresentative sender',()=>{
  const root=document.createElement('div');const f=createChatFeed(root,{repeatMode:'count',repeatScope:'channel',deleteEffect:'none'});
  f.receive(msg('1'));f.receive(msg('2','hello','bob'));
  expect(root.querySelector('.overlay-repeat-count')?.textContent).toBe('×2 · 2 chatters');
  f.removeUser({username:'bob',sourceId:'twitch:room'});
  expect(f.snapshot()).toHaveLength(0);f.dispose();
 });
 it('refresh extends lifespan while count alone does not',()=>{
  vi.useFakeTimers();
  try{
   for(const repeatMode of ['count','refresh'] as const){
    const root=document.createElement('div');const f=createChatFeed(root,{repeatMode,ttlMs:100,exit:'none'});
    f.receive(msg('1'));vi.advanceTimersByTime(70);f.receive(msg('2'));vi.advanceTimersByTime(40);
    expect(f.snapshot()).toHaveLength(repeatMode==='refresh'?1:0);f.dispose();
   }
  }finally{vi.useRealTimers();}
 });
 it('normalizes plain text but preserves resolved emote identities and special messages',()=>{
  const root=document.createElement('div');const f=createChatFeed(root,{repeatMode:'count',repeatMatch:'normalized'});
  f.receive(msg('1','HELLO world'));f.receive(msg('2','hello  world'));
  const emote=(id:string,artId:string):DisplayMessage=>({...msg(id),parts:[{type:'emote',emote:{id:artId,code:'Kappa',url:'/assets/smile.svg',overlays:[],modifiers:[]}}]});
  f.receive(emote('3','emote-a'));f.receive(emote('4','emote-b'));f.receive(emote('5','emote-a'));
  f.receive({...msg('6','hello world'),traits:{customRewardId:'reward'}});
  expect(f.snapshot().map(x=>x.id)).toEqual(['1','3','4','6']);
  expect(root.querySelectorAll('.overlay-repeat-count')).toHaveLength(2);
  f.configure({repeatShowCount:false});expect(root.querySelectorAll('.overlay-repeat-count')).toHaveLength(0);
  f.configure({repeatShowCount:true});expect(root.querySelectorAll('.overlay-repeat-count')).toHaveLength(2);
  f.dispose();
 });
 it('starts a fresh row after eviction and keeps clear/dispose safe',()=>{
  const root=document.createElement('div');const f=createChatFeed(root,{repeatMode:'bump',maxActive:1});
  f.receive(msg('1'));f.receive(msg('2','other'));f.receive(msg('3'));
  expect(f.snapshot().map(x=>x.id)).toEqual(['3']);expect(root.querySelector('.overlay-repeat-count')).toBeNull();
  f.clear();f.receive(msg('4'));expect(f.snapshot().map(x=>x.id)).toEqual(['4']);f.dispose();
 });
});
