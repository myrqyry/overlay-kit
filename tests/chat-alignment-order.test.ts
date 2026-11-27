// @vitest-environment jsdom
import {describe,expect,it} from 'vitest';
import {
 DEFAULT_OPTIONS, normalizeOptions, optionsForEditor, readOptions, writeOptions,
 isOptionApplicable,
} from '../src/options';
import {createChatFeed} from '../src/views';
import {createChatMessageElement} from '../src/renderers';
import type {DisplayMessage} from '../src/chatbus';

const msg=(id:string):DisplayMessage=>({
 id,timestamp:1,platform:'twitch',user:{name:'User'+id,color:'#cc88bb',
   badges:[{name:'Moderator',provider:'twitch',url:'https://cdn.example/mod.svg'}]},
 parts:[{type:'text',text:'Message from '+id}],
});
const elementIds=(root:HTMLElement)=>Array.from(root.children)
 .filter((e):e is HTMLElement=>e instanceof HTMLElement).map(e=>e.dataset.messageId);

describe('independent text and message alignment',()=>{
 it('exposes independent text and message alignment controls with safe existing defaults and URL roundtrips',()=>{
  expect(DEFAULT_OPTIONS.textAlign).toBe('left');
  expect(DEFAULT_OPTIONS.align).toBe('left');
  const textControl=optionsForEditor('chat',false).find(x=>x.key==='textAlign');
  const messageControl=optionsForEditor('chat',false).find(x=>x.key==='align');
  expect(textControl).toMatchObject({kind:'select',label:'Text alignment',section:'Chat • Layout'});
  expect(messageControl).toMatchObject({kind:'select',label:'Message alignment'});
  expect(textControl?.choices?.map(x=>x.value)).toEqual(['left','center','right']);
  const settings=normalizeOptions({textAlign:'right',align:'center',vertical:'top'});
  const query=writeOptions(settings,'chat');
  expect(query).toContain('textAlign=right');
  expect(query).toContain('align=center');
  expect(query).toContain('vertical=top');
  expect(readOptions('?'+query,'chat')).toEqual(settings);
  expect(writeOptions(settings,'wall')).not.toContain('textAlign');
  expect(normalizeOptions({textAlign:'sideways'}).textAlign).toBe('left');
 });
 it('keeps the newline toggle immediately after username location and hides it only for floating labels',()=>{
  const controls=optionsForEditor('chat',false);
  const pos=controls.findIndex(x=>x.key==='nameplateStyle');
  expect(controls[pos]?.label).toBe('Username location');
  expect(controls[pos+1]?.key).toBe('newLineAfterUsername');
  expect(isOptionApplicable('newLineAfterUsername',normalizeOptions({nameplateStyle:'inline'}))).toBe(true);
  expect(isOptionApplicable('newLineAfterUsername',normalizeOptions({nameplateStyle:'floating'}))).toBe(false);
  expect(isOptionApplicable('textAlign',normalizeOptions({nameplateStyle:'floating'}))).toBe(true);
  expect(normalizeOptions({newLineAfterUsername:false,nameplateStyle:'floating'}).newLineAfterUsername).toBe(false);
 });
 it('aligns the entire identity group to the right of a longer message, separately from message-card anchoring',()=>{
  const row=createChatMessageElement(msg('a'),{
    textAlign:'right',newLineAfterUsername:true,nameplateStyle:'inline',fontSize:23,
  });
  expect(row.dataset.textAlign).toBe('right');
  expect(row.querySelector<HTMLElement>('.overlay-message-header')?.style.justifyContent).toBe('flex-end');
  expect(row.querySelector<HTMLElement>('.overlay-message-body')?.style.textAlign).toBe('right');
  expect(row.querySelector('.overlay-badge')).not.toBeNull();
  expect(row.dataset.newLine).toBe('true');
  const left=createChatMessageElement(msg('b'),{textAlign:'left'});
  expect(left.querySelector<HTMLElement>('.overlay-message-header')?.style.justifyContent).toBe('flex-start');
  const center=createChatMessageElement(msg('c'),{textAlign:'center'});
  expect(center.querySelector<HTMLElement>('.overlay-message-header')?.style.justifyContent).toBe('center');
 });
 it('honors right-aligned floating labels while preserving their transparent cutout and saved newline choice',()=>{
  const row=createChatMessageElement(msg('float'),{
    textAlign:'right',nameplateStyle:'floating',newLineAfterUsername:false,
    messageOutline:3,
  });
  expect(row.dataset.textAlign).toBe('right');
  expect(row.dataset.newLine).toBe('true');
  expect(row.querySelector('.overlay-message-header')).not.toBeNull();
  expect(row.querySelector('[data-message-paint-outline]')).not.toBeNull();
  expect(row.querySelector<HTMLElement>('.overlay-message-body')?.style.textAlign).toBe('right');
 });
 it('places the chat cards independently of text alignment, and hot-switches without resetting messages',()=>{
  const root=document.createElement('div');
  const feed=createChatFeed(root,{align:'right',textAlign:'left',vertical:'bottom',ttlMs:120000});
  feed.receive(msg('one'));
  const first=root.querySelector<HTMLElement>('[data-message-id=one]')!;
  const initial=feed.snapshot()[0]!.enteredAt;
  expect(root.style.alignItems).toBe('flex-end');
  expect(first.dataset.textAlign).toBe('left');
  feed.configure({textAlign:'right',align:'left'});
  feed.refreshAppearance();
  expect(root.style.alignItems).toBe('flex-start');
  expect(root.querySelector('[data-message-id=one]')).toBe(first);
  expect(first.dataset.textAlign).toBe('right');
  expect(feed.snapshot()[0]!.enteredAt).toBe(initial);
  feed.dispose();
 });
});
describe('vertical stacking direction',()=>{
 it('uses top anchor with newest message at the top and oldest below, without changing scene admission order',()=>{
  const root=document.createElement('div');
  const feed=createChatFeed(root,{vertical:'top',layout:'stack',ttlMs:120000});
  for(const id of ['old','middle','new'])feed.receive(msg(id));
  expect(root.style.flexDirection).toBe('column-reverse');
  expect(root.style.justifyContent).toBe('flex-end');
  expect(elementIds(root)).toEqual(['old','middle','new']);
  expect(feed.snapshot().map(x=>x.id)).toEqual(['old','middle','new']);
  feed.dispose();
 });
 it('uses bottom anchor with newest at the bottom and preserves order across live switching',()=>{
  const root=document.createElement('div');
  const feed=createChatFeed(root,{vertical:'bottom',layout:'stack',ttlMs:120000});
  for(const id of ['old','middle','new'])feed.receive(msg(id));
  const original=root.querySelector('[data-message-id=old]');
  expect(root.style.flexDirection).toBe('column');
  expect(root.style.justifyContent).toBe('flex-end');
  feed.configure({vertical:'top'});
  expect(root.style.flexDirection).toBe('column-reverse');
  feed.configure({vertical:'bottom'});
  expect(root.style.flexDirection).toBe('column');
  expect(root.querySelector('[data-message-id=old]')).toBe(original);
  expect(feed.snapshot().map(x=>x.id)).toEqual(['old','middle','new']);
  feed.dispose();
 });
 it('keeps horizontal strip chronological left-to-right and latest-only at one message',()=>{
  const root=document.createElement('div');
  const feed=createChatFeed(root,{layout:'strip',vertical:'top',ttlMs:120000});
  for(const id of ['old','middle','new'])feed.receive(msg(id));
  expect(root.style.flexDirection).toBe('row');
  expect(root.style.justifyContent).toBe('flex-end');
  expect(elementIds(root)).toEqual(['old','middle','new']);
  feed.configure({layout:'spotlight'});
  expect(feed.snapshot().map(x=>x.id)).toEqual(['new']);
  feed.dispose();
 });
});
