import {existsSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {normalizeKickEvent} from '@myrqyry/chatbus';
import {fromChatbus,projectDisplayBadges} from '../src/chatbus';
import {createChatMessageElement} from '../src/renderers';

const refs=[{provider:'kick',id:'moderator'},{provider:'kick',id:'verified'},
  {provider:'kick',id:'sub_gifter',version:'1'},{provider:'kick',id:'subscriber',version:'3'}];
const message=()=>fromChatbus(normalizeKickEvent({type:'ChatMessage',data:{
  id:'roles',chatroom_id:42,content:'hello',created_at:'2026-11-10T06:00:00Z',
  sender:{id:17,username:'viewer',identity:{badges:[
    {type:'moderator',text:'Moderator'},{type:'verified',text:'Verified'},
    {type:'sub_gifter',text:'Sub Gifter',count:1}]}},
}},{channelName:'example'})!.message!);
const labels=(row:HTMLElement)=>Array.from(row.querySelectorAll('[data-badge-fallback]'),e=>e.textContent);

describe('Kick role art is optional, not redistributed',()=>{
 it('projects only semantic identity for every role without native art',()=>{
  expect(projectDisplayBadges([],refs)).toEqual([
    expect.objectContaining({id:'moderator',text:'MOD'}),
    expect.objectContaining({id:'verified',text:'VERIFIED'}),
    expect.objectContaining({id:'sub_gifter',text:'GIFT 1'}),
    expect.objectContaining({id:'subscriber',text:'SUB 3'}),
  ]);
  expect(projectDisplayBadges([],refs).every(b=>!b.url)).toBe(true);
  for(const version of ['25','12','broken']){
    expect(projectDisplayBadges([],[{provider:'kick',id:'sub_gifter',version}])[0]?.text)
      .toBe(version==='broken'?'GIFT':'GIFT '+version);
  }
  expect(projectDisplayBadges([],[{provider:'kick',id:'mod'}])).toEqual([]);
 });
 it('renders complete semantic badges without optional files',()=>{
  const row=createChatMessageElement(message());
  expect(labels(row)).toEqual(['MOD','VERIFIED','GIFT 1']);
  expect(row.querySelectorAll('img.overlay-badge')).toHaveLength(0);
 });
 it('selects only matching local optional artwork; restores text if an image fails',()=>{
  const row=createChatMessageElement(message(),{kickRoleArtwork:{
    moderator:'/personal/mod.png','gift-1':'/personal/gift.png','gift-25':'/personal/25.png'}});
  const imgs=Array.from(row.querySelectorAll<HTMLImageElement>('img.overlay-badge'));
  expect(imgs.map(e=>new URL(e.src).pathname)).toEqual(['/personal/mod.png','/personal/gift.png']);
  expect(labels(row)).toEqual(['VERIFIED']);
  imgs[0]!.dispatchEvent(new Event('error'));
  expect(labels(row)).toEqual(['MOD','VERIFIED']);
 });
 it('prefers real native image art, never guesses a gifting milestone',()=>{
  const url='https://ext.cdn.kick.com/chat/badges/example.png';
  expect(projectDisplayBadges([{id:'moderator',provider:'kick',url}],refs)[0]?.url).toBe(url);
  const msg=message();
  msg.user.badges=[{provider:'kick',id:'moderator',name:'Moderator',url},
    {provider:'kick',id:'sub_gifter',name:'Gifter',text:'GIFT 26'}];
  const row=createChatMessageElement(msg,{kickRoleArtwork:{moderator:'/personal/mod.png','gift-25':'/personal/25.png'}});
  expect(row.querySelector<HTMLImageElement>('img.overlay-badge')?.src).toBe(url);
  expect(labels(row)).toEqual(['GIFT 26']);
 });
 it('does not ship the old copied artwork',()=>{
  for(const name of ['moderator','verified','gift-1','gift-25'])
    expect(existsSync('public/assets/kick-'+name+'.svg')).toBe(false);
 });
});
