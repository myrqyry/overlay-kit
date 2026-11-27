import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { DEFAULT_OPTIONS, normalizeOptions, optionsForEditor, readOptions, writeOptions } from '../src/options';
import { createChatFeed, createEmoteWall } from '../src/views';
import type { DisplayMessage } from '../src/chatbus';

const entrances = ['blur-focus', 'curtain-wipe', 'glitch-split', 'dissolve', 'split-flap', 'fold-collapse'] as const;
const exits = ['blur-out', 'curtain-close', 'glitch-split', 'dissolve', 'split-flap', 'fold-collapse'] as const;
const chat: DisplayMessage = {
 id:'chat-specimen', timestamp:1700, user:{name:'Tester',badges:[]},
 parts:[{type:'text',text:'Hello, world!'}, {type:'emote',emote:{id:'a',code:'a',url:'/assets/smile.svg',overlays:[],modifiers:[]}}],
};
const wallPacket: DisplayMessage = {
 ...chat, parts:[{type:'emote',emote:{id:'b',code:'b',url:'/assets/smile.svg',
   overlays:[{code:'hat',url:'/assets/hat.svg'}],modifiers:[]}}],
};
const chatCss=readFileSync('src/chat-motion.css','utf8');
const wallCss=readFileSync('src/wall-motion.css','utf8');

afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});

describe('complete visual specimen entrances and natural exits',()=>{
 it('exposes entrances and exits on the two owning views through the existing validated presets and URLs',()=>{
   for(const [view,key,values] of [
     ['chat','enter',entrances],['chat','exit',exits],
     ['wall','wallExit',exits],
   ] as const){
     const option=optionsForEditor(view,false).find(x=>x.key===key);
     for(const effect of values){
       expect(option?.choices?.some(x=>x.value===effect)).toBe(true);
       const state=normalizeOptions({...DEFAULT_OPTIONS,[key]:effect});
       expect(state[key]).toBe(effect);
       expect(readOptions('?'+writeOptions(state,view),view)[key]).toBe(effect);
       expect(writeOptions(state,view==='chat'?'wall':'chat')).not.toContain(key+'=');
     }
   }
   expect(DEFAULT_OPTIONS.enter).toBe('rise');
   expect(DEFAULT_OPTIONS.exit).toBe('fade');
   expect(DEFAULT_OPTIONS.wallExit).toBe('none');
   expect(normalizeOptions({enter:'invalid',exit:'invalid',wallExit:'invalid'}).exit).toBe('fade');
 });

 for(const effect of entrances){
   it('chat bubble '+effect+' animates the entire message, not just letters',()=>{
     const root=document.createElement('div');
     const feed=createChatFeed(root,{enter:effect,enterMs:600,letterEnter:'none'});
     expect(feed.receive({...chat,id:effect})).toBe(true);
     const row=root.querySelector<HTMLElement>('.overlay-chat-message')!;
     expect(row.dataset.enter).toBe(effect);
     expect(row.style.getPropertyValue('--chat-enter-duration')).toBe('600ms');
     expect(row.textContent).toContain('Hello, world!');
     expect(row.querySelector('img')).not.toBeNull();
     expect(chatCss).toContain('[data-enter="'+effect+'"]:not([data-phase="exiting"])');
     expect(chatCss).toContain('@keyframes chat-in-'+effect);
     expect(chatCss).toMatch(new RegExp('animation: chat-in-'+effect+'[^;]*backwards;'));
     feed.dispose();
     expect(root.childElementCount).toBe(0);
   });
 }

 for(const effect of exits){
   it('chat bubble '+effect+' retains the expiring slot then releases it on the matching animation',()=>{
     vi.useFakeTimers();
     const root=document.createElement('div');
     const feed=createChatFeed(root,{ttlMs:100,exit:effect,exitMs:460,letterExit:'none'});
     feed.receive({...chat,id:effect});
     const row=root.querySelector<HTMLElement>('.overlay-chat-message')!;
     vi.advanceTimersByTime(100);
     expect(row.dataset.phase).toBe('exiting');
     expect(row.dataset.exit).toBe(effect);
     expect(root.firstElementChild).toBe(row);
     expect(chatCss).toContain('[data-phase="exiting"][data-exit="'+effect+'"]');
     expect(chatCss).toContain('@keyframes chat-out-'+effect);
     expect(chatCss).toContain('animation: chat-out-'+effect);
     const wrong=new Event('animationend',{bubbles:true});
     Object.defineProperty(wrong,'animationName',{value:'chat-in-'+effect});
     row.dispatchEvent(wrong);
     expect(root.childElementCount).toBe(1);
     const done=new Event('animationend',{bubbles:true});
     Object.defineProperty(done,'animationName',{value:'chat-out-'+effect});
     row.dispatchEvent(done);
     expect(root.childElementCount).toBe(0);
     feed.dispose();
     expect(vi.getTimerCount()).toBe(0);
   });
 }

 for(const effect of exits){
   it('wall '+effect+' retires full layered art independently of its looping movement',()=>{
     vi.useFakeTimers();
     const root=document.createElement('div');
     const wall=createEmoteWall(root,{wallEnter:'blur-focus',wallExit:effect,
       wallExitMs:400,ttlMs:100,motion:'orbit',wallStyle:'cut-paper',wallColor:'warm',wallFinish:'halo'});
     expect(wall.receive({...wallPacket,id:effect})).toBe(1);
     const item=root.querySelector<HTMLElement>('.overlay-wall-item')!;
     const visual=item.querySelector<HTMLElement>('.overlay-wall-visual')!;
     expect(item.dataset.motion).toBe('orbit');
     expect(visual.querySelectorAll('img')).toHaveLength(2);
     expect(root.dataset.wallStyle).toBe('cut-paper');
     expect(root.dataset.wallColor).toBe('warm');
     expect(root.dataset.wallFinish).toBe('halo');
     vi.advanceTimersByTime(100);
     expect(visual.dataset.wallPhase).toBe('exiting');
     expect(visual.dataset.wallExit).toBe(effect);
     expect(wallCss).toContain('[data-wall-phase="exiting"][data-wall-exit="'+effect+'"]');
     expect(wallCss).toContain('@keyframes wall-out-'+effect);
     const wrong=new Event('animationend',{bubbles:true});
     Object.defineProperty(wrong,'animationName',{value:'wall-in-blur-focus'});
     visual.dispatchEvent(wrong);
     expect(root.childElementCount).toBe(1);
     const done=new Event('animationend',{bubbles:true});
     Object.defineProperty(done,'animationName',{value:'wall-out-'+effect});
     visual.dispatchEvent(done);
     expect(root.childElementCount).toBe(0);
     wall.dispose();
     expect(vi.getTimerCount()).toBe(0);
   });
 }

 it('moderation is immediate and abandoned exits cannot leak timers or nodes',()=>{
   vi.useFakeTimers();
   const chatRoot=document.createElement('div');
   const wallRoot=document.createElement('div');
   const feed=createChatFeed(chatRoot,{enter:'glitch-split',exit:'dissolve',ttlMs:50});
   const wall=createEmoteWall(wallRoot,{wallEnter:'glitch-split',wallExit:'dissolve',ttlMs:50});
   feed.receive(chat);wall.receive(wallPacket);
   feed.removeMessage(chat.id);wall.removeMessage(wallPacket.id);
   expect(chatRoot.childElementCount).toBe(0);
   expect(wallRoot.childElementCount).toBe(0);
   feed.receive({...chat,id:'expire'});
   wall.receive({...wallPacket,id:'expire'});
   vi.advanceTimersByTime(50);
   expect(chatRoot.childElementCount).toBe(1);
   expect(wallRoot.childElementCount).toBe(1);
   feed.clear();wall.clear();
   expect(chatRoot.childElementCount).toBe(0);
   expect(wallRoot.childElementCount).toBe(0);
   feed.dispose();wall.dispose();
   expect(vi.getTimerCount()).toBe(0);
 });

 it('reduced motion skips the animated exit and detaches immediately',()=>{
   vi.useFakeTimers();
   vi.stubGlobal('matchMedia',()=>({matches:true}));
   const chatRoot=document.createElement('div'),wallRoot=document.createElement('div');
   const feed=createChatFeed(chatRoot,{enter:'blur-focus',exit:'blur-out',ttlMs:50});
   const wall=createEmoteWall(wallRoot,{wallExit:'curtain-close',ttlMs:50});
   feed.receive(chat);wall.receive(wallPacket);
   vi.advanceTimersByTime(50);
   expect(chatRoot.childElementCount).toBe(0);
   expect(wallRoot.childElementCount).toBe(0);
   expect(chatCss).toContain('.overlay-chat-message { animation: none !important; }');
   expect(wallCss).toContain('.overlay-wall-visual { animation:none !important; }');
   feed.dispose();wall.dispose();
 });
});
