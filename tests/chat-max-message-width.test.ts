// @vitest-environment jsdom
import {describe,it,expect} from 'vitest';
import {DEFAULT_OPTIONS,normalizeOptions,optionsForEditor,readOptions,writeOptions} from '../src/options';
import {restoreSeparateSettings} from '../src/editor-settings';
import {createChatFeed} from '../src/views';
import type {DisplayMessage} from '../src/chatbus';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const sample=(id:string,text:string):DisplayMessage=>({
 id,timestamp:1,platform:'twitch',
 user:{name:'TheLongNameOfAChatter',color:'#aabbcc',badges:[]},
 parts:[{type:'text',text}],
});

describe('max message width',()=>{
 it('is a chat-only layout setting, unlimited by default and safely bounded for OBS links',()=>{
   expect(DEFAULT_OPTIONS.maxMessageWidth).toBe(0);
   const controls=optionsForEditor('chat',false);
   const anchor=controls.findIndex(x=>x.key==='align');
   expect(controls[anchor+1]).toMatchObject({
     key:'maxMessageWidth',kind:'range',label:'Max message width',
     section:'Chat • Layout',min:0,max:1920,step:10,unit:'px',
   });
   const settings=normalizeOptions({maxMessageWidth:320});
   expect(writeOptions(settings,'chat')).toContain('maxMessageWidth=320');
   expect(readOptions('?'+writeOptions(settings,'chat'),'chat')).toEqual(settings);
   expect(writeOptions(settings,'wall')).not.toContain('maxMessageWidth');
   expect(writeOptions(DEFAULT_OPTIONS,'chat')).not.toContain('maxMessageWidth');
   expect(normalizeOptions({maxMessageWidth:-20}).maxMessageWidth).toBe(0);
   expect(normalizeOptions({maxMessageWidth:19999}).maxMessageWidth).toBe(1920);
   expect(normalizeOptions({maxMessageWidth:325}).maxMessageWidth).toBe(330);
 });
 it('exposes a max-width CSS variable scoped to chat only with no limit at zero',()=>{
   const root=document.createElement('div');
   const feed=createChatFeed(root,{maxMessageWidth:0,ttlMs:120000});
   feed.receive(sample('first','a very long first message indeed'));
   expect(root.style.getPropertyValue('--chat-message-max-width')).toBe('100%');
   expect(root.dataset.messageWidthLimited).toBe('false');
   feed.configure({maxMessageWidth:340});
   expect(root.style.getPropertyValue('--chat-message-max-width')).toBe('340px');
   expect(root.dataset.messageWidthLimited).toBe('true');
   const row=root.querySelector('[data-message-id=first]');
   feed.configure({maxMessageWidth:0});
   expect(root.style.getPropertyValue('--chat-message-max-width')).toBe('100%');
   expect(root.querySelector('[data-message-id=first]')).toBe(row);
   feed.dispose();
 });
 it('caps stack, floating labels, spotlight and strip while preserving default mode caps',()=>{
   const css=readFileSync(resolve(import.meta.dirname,'../demo/styles.css'),'utf8');
   expect(css).toMatch(/\.overlay-chat-message\s*\{[^}]*max-width:\s*min\(100%,\s*var\(--chat-message-max-width/);
   expect(css).toMatch(/data-nameplate="floating"[^}]*max-width:\s*min\(100%,\s*var\(--chat-message-max-width/);
   expect(css).toMatch(/data-chat-layout="spotlight"[^}]*max-width:\s*min\(100%,\s*760px,\s*var\(--chat-message-max-width/);
   expect(css).toMatch(/data-chat-layout="strip"[^}]*max-width:\s*min\(68%,\s*560px,\s*var\(--chat-message-max-width/);
   expect(css).toContain('[data-message-width-limited="true"]');
 });
 it('keeps separate text/bubble alignment, emotes, and floating label on hot changes',()=>{
   const root=document.createElement('div');
   const feed=createChatFeed(root,{
      layout:'stack',textAlign:'right',align:'right',nameplateStyle:'floating',
      maxMessageWidth:280,ttlMs:120000,
   });
   feed.receive(sample('first','this message should naturally wrap across lines without clipping or shrinking fonts'));
   const row=root.querySelector<HTMLElement>('[data-message-id=first]')!;
   const time=feed.snapshot()[0]!.enteredAt;
   expect(root.style.alignItems).toBe('flex-end');
   expect(row.dataset.nameplate).toBe('floating');
   feed.configure({maxMessageWidth:410,layout:'spotlight'});
   expect(root.style.getPropertyValue('--chat-message-max-width')).toBe('410px');
   expect(root.querySelector('[data-message-id=first]')).toBe(row);
   expect(feed.snapshot()[0]!.enteredAt).toBe(time);
   feed.configure({layout:'strip',maxMessageWidth:260});
   expect(root.dataset.messageWidthLimited).toBe('true');
   feed.dispose();
 });
 it('exposes uniform width directly below the cap and roundtrips a chat-only preset preference',()=>{
   expect(DEFAULT_OPTIONS.uniformMessageWidth).toBe(false);
   const controls=optionsForEditor('chat',false);
   expect(controls[controls.findIndex(x=>x.key==='maxMessageWidth')+1]).toMatchObject({
     key:'uniformMessageWidth',kind:'toggle',label:'Uniform message width',
   });
   const settings=normalizeOptions({maxMessageWidth:320,uniformMessageWidth:true});
   const query=writeOptions(settings,'chat');
   expect(query).toContain('uniformMessageWidth=1');
   expect(readOptions('?'+query,'chat')).toEqual(settings);
   expect(writeOptions(settings,'wall')).not.toContain('uniformMessageWidth');
   expect(writeOptions(DEFAULT_OPTIONS,'chat')).not.toContain('uniformMessageWidth');
   expect(restoreSeparateSettings(null,{chat:settings},'').chat.uniformMessageWidth).toBe(true);
   expect(normalizeOptions({maxMessageWidth:0,uniformMessageWidth:true}).uniformMessageWidth).toBe(true);
 });
 it('stretches only with a positive cap and preserves existing row identity and lifetime on toggle',()=>{
   const root=document.createElement('div');
   const feed=createChatFeed(root,{maxMessageWidth:320,ttlMs:120000});
   try{
     feed.receive(sample('short','Hi'));
     const row=root.querySelector('[data-message-id=short]');
     const entered=feed.snapshot()[0]!.enteredAt;
     expect(root.dataset.uniformMessageWidth).toBe('false');
     feed.configure({uniformMessageWidth:true});
     expect(root.dataset.uniformMessageWidth).toBe('true');
     expect(root.querySelector('[data-message-id=short]')).toBe(row);
     expect(feed.snapshot()[0]!.enteredAt).toBe(entered);
     feed.configure({maxMessageWidth:0});
     expect(root.dataset.uniformMessageWidth).toBe('false');
     feed.configure({maxMessageWidth:280});
     expect(root.dataset.uniformMessageWidth).toBe('true');
     feed.configure({uniformMessageWidth:false});
     expect(root.dataset.uniformMessageWidth).toBe('false');
   }finally{feed.dispose();}
 });

});
