import { describe,expect,it } from 'vitest';
import {createChatFeed} from '../src/views';
import {DEFAULT_OPTIONS,normalizeOptions,readOptions,writeOptions,optionsForEditor} from '../src/options';
import type {DisplayMessage} from '../src/chatbus';
const message=(id:string):DisplayMessage=>({
 id,timestamp:1,user:{name:id,badges:[]},parts:[{type:'text',text:'Message '+id}],
});
describe('chat layout modes',()=>{
 it('offers a real chat-layout setting, normalizes invalid choices and roundtrips into OBS URLs',()=>{
   expect(DEFAULT_OPTIONS.chatLayout).toBe('stack');
   const options=optionsForEditor('chat',false).find(item=>item.key==='chatLayout');
   expect(options?.choices?.map(choice=>choice.value)).toEqual(['stack','strip','spotlight']);
   expect(options?.section).toMatch(/^Chat/);
   expect(normalizeOptions({chatLayout:'invalid'}).chatLayout).toBe('stack');
   for(const mode of ['strip','spotlight'] as const){
     const url=writeOptions(normalizeOptions({chatLayout:mode}),'chat');
     expect(url).toContain('layout='+mode);
     expect(readOptions('?'+url,'chat').chatLayout).toBe(mode);
     expect(writeOptions(readOptions('?'+url,'chat'),'chat')).toBe(url);
   }
   expect(writeOptions(normalizeOptions({chatLayout:'strip'}),'wall')).not.toContain('layout');
 });
 it('bounds oversized strip emotes to the source height while always reserving the identity row',()=>{
   const root=document.createElement('div');
   const feed=createChatFeed(root,{layout:'strip',stripRows:'single',padding:8,fontSize:18,lineHeight:1.45});
   const initial=root.style.getPropertyValue('--chat-emote-height-limit');
   expect(initial).toContain('100dvh');
   expect(root.dataset.stripRows).toBe('single');
   feed.configure({stripRows:'single'}); // old API still selects same-line messages.
   expect(root.style.getPropertyValue('--chat-emote-height-limit')).toBe(initial);
   expect(root.dataset.stripRows).toBe('single');
   feed.configure({padding:22,fontSize:30,lineHeight:2});
   const updated=root.style.getPropertyValue('--chat-emote-height-limit');
   expect(updated).toContain('100dvh');
   expect(updated).not.toBe(initial); // A changed font or canvas budget is applied live.
   feed.configure({layout:'stack'});
   expect(root.style.getPropertyValue('--chat-emote-height-limit')).toBe('');
   feed.dispose();
 });
 it('restores the old single-row preference through the new-line toggle',()=>{
   expect(DEFAULT_OPTIONS.stripRows).toBe('double'); // kept for stored preset shape.
   expect(optionsForEditor('chat',false).find(item=>item.key==='stripRows')).toBeUndefined();
   expect(optionsForEditor('chat',false).find(item=>item.key==='newLineAfterUsername')?.kind).toBe('toggle');
   expect(normalizeOptions({stripRows:'single'}).stripRows).toBe('double');
   expect(normalizeOptions({stripRows:'single'}).newLineAfterUsername).toBe(false);
   expect(readOptions('?layout=strip&rows=single','chat').newLineAfterUsername).toBe(false);
   const query=writeOptions(normalizeOptions({chatLayout:'strip',stripRows:'single'}),'chat');
   expect(query).not.toContain('rows=');
   expect(query).toContain('newLine=0');
 });
 it('two-row strip puts badges and name in the header and message on its own lower line',()=>{
   const root=document.createElement('div');
   const feed=createChatFeed(root,{layout:'strip',stripRows:'double',maxActive:4,ttlMs:120000});
   feed.receive({id:'badge-user',timestamp:1,user:{name:'Alice',badges:[
     {name:'Subscriber',url:'https://files.kick.com/channel_subscriber_badges/1/conversion/original-fullsize.png',provider:'kick'},
   ]},parts:[{type:'text',text:'Hello from Alice'}]});
   const row=root.querySelector<HTMLElement>('.overlay-chat-message')!;
   const header=row.querySelector<HTMLElement>('.overlay-message-header')!;
   const body=row.querySelector<HTMLElement>('.overlay-message-body')!;
   expect(root.dataset.chatLayout).toBe('strip');
   expect(root.dataset.stripRows).toBe('double');
   expect(header.parentElement).toBe(row);
   expect(body.parentElement).toBe(row);
   expect(header.nextElementSibling).toBe(body);
   expect(header.querySelector('[data-username]')?.textContent).toBe('Alice');
   expect(header.querySelectorAll('.overlay-badge')).toHaveLength(1);
   expect(body.querySelector('.overlay-message-content')?.textContent).toBe('Hello from Alice');
   expect(body.querySelector('.overlay-badge')).toBeNull();
   expect(header.querySelector('.overlay-message-separator')?.textContent).toBe(': ');
   feed.updateBadges('badge-user',[{name:'New badge',url:'https://files.kick.com/channel_subscriber_badges/2/conversion/original-fullsize.png',provider:'kick'}]);
   expect(header.querySelector<HTMLImageElement>('.overlay-badge')?.alt).toBe('New badge');
   expect(root.querySelector('.overlay-chat-message')).toBe(row);
   feed.configure({stripRows:'single'});
   expect(root.dataset.stripRows).toBe('single');
   feed.refreshAppearance();
   expect(row.dataset.newLine).toBe('false');
   expect(root.querySelector('.overlay-chat-message')).toBe(row);
   feed.configure({stripRows:'double',layout:'stack'});
   expect(root.style.flexDirection).toBe('column');
   expect(root.querySelector('.overlay-chat-message')).toBe(row);
   feed.dispose();
 });
 it('hiding names and badges leaves the two-row header empty rather than creating phantom content',()=>{
   const root=document.createElement('div');
   const feed=createChatFeed(root,{layout:'strip',stripRows:'double',showNames:false,showBadges:false});
   feed.receive(message('text-only'));
   const row=root.querySelector('.overlay-chat-message')!;
   expect(row.querySelector('.overlay-message-header')?.childElementCount).toBe(0);
   expect(row.querySelector('.overlay-message-body .overlay-message-content')?.textContent).toBe('Message text-only');
   feed.dispose();
 });
 it('shows a late-arriving badge-only header without rebuilding the two-row card',()=>{
   const root=document.createElement('div');
   const feed=createChatFeed(root,{layout:'strip',stripRows:'double',showNames:false,showBadges:true});
   feed.receive(message('badge-later'));
   const row=root.querySelector('.overlay-chat-message')!;
   const header=row.querySelector<HTMLElement>('.overlay-message-header')!;
   expect(header.dataset.empty).toBe('true');
   feed.updateBadges('badge-later',[{name:'Subscriber',url:'https://files.kick.com/channel_subscriber_badges/1/conversion/original-fullsize.png'}]);
   expect(header.dataset.empty).toBe('false');
   expect(header.querySelector<HTMLImageElement>('.overlay-badge')?.alt).toBe('Subscriber');
   expect(root.querySelector('.overlay-chat-message')).toBe(row);
   feed.updateBadges('badge-later',[]);
   expect(header.dataset.empty).toBe('true');
   feed.dispose();
 });
 it('keeps default stack behavior but can switch to a single horizontal row without a second feed',()=>{
   const root=document.createElement('div');
   const feed=createChatFeed(root,{maxActive:4,ttlMs:120000});
   feed.receive(message('first'));feed.receive(message('second'));
   expect(root.style.flexDirection).toBe('column');
   expect(root.dataset.chatLayout).toBe('stack');
   feed.configure({layout:'strip'});
   expect(root.style.flexDirection).toBe('row');
   expect(root.style.flexWrap).toBe('nowrap');
   expect(root.style.overflow).toBe('hidden');
   expect(root.dataset.chatLayout).toBe('strip');
   expect(root.querySelectorAll('.overlay-chat-message')).toHaveLength(2);
   feed.receive(message('third'));
   expect(feed.snapshot().map(x=>x.id)).toEqual(['first','second','third']);
   feed.configure({layout:'stack'});
   expect(root.style.flexDirection).toBe('column');
   expect(root.dataset.chatLayout).toBe('stack');
   feed.dispose();
   expect(root.childElementCount).toBe(0);
 });
 it('latest-only view evicts stale content but restores configured capacity when switching back',()=>{
   const root=document.createElement('div');
   const feed=createChatFeed(root,{layout:'spotlight',maxActive:5,ttlMs:120000});
   feed.receive(message('one'));feed.receive(message('two'));feed.receive(message('three'));
   expect(feed.snapshot().map(x=>x.id)).toEqual(['three']);
   expect(root.querySelectorAll('.overlay-chat-message')).toHaveLength(1);
   feed.configure({layout:'strip'});
   feed.receive(message('four'));feed.receive(message('five'));
   expect(feed.snapshot().map(x=>x.id)).toEqual(['three','four','five']);
   feed.configure({maxActive:2,layout:'spotlight'});
   expect(feed.snapshot().map(x=>x.id)).toEqual(['five']);
   feed.configure({layout:'stack'});
   feed.receive(message('six'));feed.receive(message('seven'));
   expect(feed.snapshot().map(x=>x.id)).toEqual(['six','seven']);
   feed.dispose();
 });
  it('disposes fully offscreen horizontal messages without scrolling or retaining invisible rows',()=>{
   const root=document.createElement('div');
   const frames:FrameRequestCallback[]=[];
   const oldRaf=globalThis.requestAnimationFrame;
   const oldCancel=globalThis.cancelAnimationFrame;
   const original=HTMLElement.prototype.getBoundingClientRect;
   try{
     Object.defineProperty(globalThis,'requestAnimationFrame',{value:(fn:FrameRequestCallback)=>{frames.push(fn);return frames.length;},configurable:true});
     Object.defineProperty(globalThis,'cancelAnimationFrame',{value:()=>undefined,configurable:true});
     HTMLElement.prototype.getBoundingClientRect=function(){
       const length=root.children.length;
       const index=Array.from(root.children).indexOf(this);
       if(this===root)return {left:0,right:220,top:0,bottom:100,width:220,height:100,x:0,y:0,toJSON:()=>({})} as DOMRect;
       const right=220-(length-index-1)*120;
       return {left:right-120,right,top:55,bottom:90,width:120,height:35,x:right-120,y:55,toJSON:()=>({})} as DOMRect;
     };
     const feed=createChatFeed(root,{layout:'strip',maxActive:20,ttlMs:120000});
     for(let i=0;i<6;i++)feed.receive(message('msg'+i));
     expect(feed.snapshot()).toHaveLength(6); // work is batched
     while(frames.length){const callbacks=frames.splice(0);for(const cb of callbacks)cb(0);}
     expect(feed.snapshot().map(item=>item.id)).toEqual(['msg4','msg5']);
     expect(root.querySelectorAll('.overlay-chat-message')).toHaveLength(2);
     feed.configure({layout:'stack'});
     for(let i=6;i<9;i++)feed.receive(message('msg'+i));
     while(frames.length){const callbacks=frames.splice(0);for(const cb of callbacks)cb(0);}
     expect(feed.snapshot().map(item=>item.id)).toEqual(['msg4','msg5','msg6','msg7','msg8']);
     feed.dispose();
     expect(root.childElementCount).toBe(0);
   }finally{
     HTMLElement.prototype.getBoundingClientRect=original;
     Object.defineProperty(globalThis,'requestAnimationFrame',{value:oldRaf,configurable:true});
     Object.defineProperty(globalThis,'cancelAnimationFrame',{value:oldCancel,configurable:true});
   }
 });
 it('rejects invalid configured capacity even while Latest Only has a one-message override',()=>{
   const root=document.createElement('div');
   expect(()=>createChatFeed(root,{layout:'spotlight',maxActive:0})).toThrow(/maxActive/);
   const feed=createChatFeed(root,{layout:'spotlight',maxActive:3,ttlMs:120000});
   expect(()=>feed.configure({maxActive:0})).toThrow(/maxActive/);
   feed.configure({layout:'stack'});
   feed.receive(message('one'));feed.receive(message('two'));
   expect(feed.snapshot().map(row=>row.id)).toEqual(['one','two']);
   feed.dispose();
 });

 it('keeps moderation deletion immediate in either new mode',()=>{
   for(const layout of ['strip','spotlight'] as const){
     const root=document.createElement('div');
     const feed=createChatFeed(root,{layout,maxActive:5,ttlMs:120000,deleteEffect:'none'});
     feed.receive(message('ban-me'));
     expect(feed.removeMessage('ban-me')).toBe(true);
     expect(feed.snapshot()).toHaveLength(0);
     expect(root.childElementCount).toBe(0);
     feed.dispose();
   }
 });
});
