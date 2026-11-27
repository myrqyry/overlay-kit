// @vitest-environment jsdom
import {describe,it,expect} from 'vitest';
import {
  DEFAULT_OPTIONS,normalizeOptions,optionsForEditor,readOptions,writeOptions,
} from '../src/options';
import {createChatMessageElement} from '../src/renderers';
import {createChatFeed} from '../src/views';
import {restoreEditorSettings,restoreSeparateSettings} from '../src/editor-settings';
import type {DisplayMessage} from '../src/chatbus';

const sample=(id='row',name='Moss'):DisplayMessage=>({
  id,timestamp:1,platform:'twitch',sourceId:'twitch:one',
  user:{name,color:'#abcdef',badges:[{
    name:'VIP',provider:'twitch',url:'https://cdn.example/vip.png',
  }]},
  parts:[{type:'text',text:'hello world'}],
});
describe('restore new-line-after-username control',()=>{
 it('exposes a Chat layout toggle with the existing two-line layout as default',()=>{
  expect(DEFAULT_OPTIONS.newLineAfterUsername).toBe(true);
  const control=optionsForEditor('chat',false).find(x=>x.key==='newLineAfterUsername');
  expect(control).toMatchObject({kind:'toggle',section:'Chat • Layout',label:'New line after username'});
  expect(normalizeOptions({newLineAfterUsername:'false'}).newLineAfterUsername).toBe(false);
  expect(normalizeOptions({newLineAfterUsername:'garbage'}).newLineAfterUsername).toBe(true);
 });
 it('roundtrips on OBS chat URLs and presets without affecting other overlays',()=>{
  const sameLine=normalizeOptions({newLineAfterUsername:false,chatLayout:'strip'});
  const query=writeOptions(sameLine,'chat');
  expect(query).toContain('newLine=0');
  expect(readOptions('?'+query,'chat').newLineAfterUsername).toBe(false);
  expect(writeOptions(DEFAULT_OPTIONS,'chat')).not.toContain('newLine=');
  expect(writeOptions(sameLine,'wall')).not.toContain('newLine=');
  expect(normalizeOptions({version:1,settings:{newLineAfterUsername:false}}).newLineAfterUsername).toBe(false);
 });
 it('honors previously saved Horizontal Strip single/two-row URLs and preset values',()=>{
  expect(readOptions('?layout=strip&rows=single','chat').newLineAfterUsername).toBe(false);
  expect(readOptions('?layout=strip&rows=double','chat').newLineAfterUsername).toBe(true);
  expect(readOptions('?layout=strip&rows=single&newLine=1','chat').newLineAfterUsername).toBe(true);
  expect(normalizeOptions({stripRows:'single'}).newLineAfterUsername).toBe(false);
  expect(normalizeOptions({stripRows:'double'}).newLineAfterUsername).toBe(true);
  expect(normalizeOptions({stripRows:'single',newLineAfterUsername:true}).newLineAfterUsername).toBe(true);
  expect(writeOptions(normalizeOptions({stripRows:'single'}),'chat')).toContain('newLine=0');
 });
 it('imports retired rows=single links into both editor recovery flows',()=>{
  const oldSingle=restoreEditorSettings({version:1,settings:DEFAULT_OPTIONS},
    '?rows=single&from=old-chat-link');
  expect(oldSingle.importedFromUrl).toBe(true);
  expect(oldSingle.settings.newLineAfterUsername).toBe(false);
  expect(oldSingle.remainingSearch).toBe('from=old-chat-link');
  const restored=restoreSeparateSettings(null,null,
    '?rows=single&from=old-chat-link','chat');
  expect(restored.importedFromUrl).toBe(true);
  expect(restored.importedView).toBe('chat');
  expect(restored.chat.newLineAfterUsername).toBe(false);
  expect(restored.wall).toEqual(DEFAULT_OPTIONS);
  expect(restored.remainingSearch).toBe('from=old-chat-link');
 });

 it('renders inline identity + message in one line without changing their markup or emotes',()=>{
  const row=createChatMessageElement(sample('inline'),{
    nameplateStyle:'inline',newLineAfterUsername:false,showPlatformBadges:true,
  });
  expect(row.dataset.newLine).toBe('false');
  expect(row.dataset.nameplate).toBe('inline');
  const header=row.querySelector<HTMLElement>('.overlay-message-header')!;
  const body=row.querySelector<HTMLElement>('.overlay-message-body')!;
  expect(header.parentElement).toBe(row);
  expect(header.nextElementSibling).toBe(body);
  expect(header.querySelector('[data-username]')?.textContent).toBe('Moss');
  expect(header.querySelector('.overlay-badge')).not.toBeNull();
  expect(header.querySelector('.overlay-service-badge')).not.toBeNull();
  expect(body.querySelector('.overlay-message-content')?.textContent).toBe('hello world');
  expect(header.querySelector<HTMLElement>('.overlay-message-separator')?.hidden).toBe(false);
 });
 it('leaves the existing two-line rendering and floating header unaffected by default',()=>{
  const normal=createChatMessageElement(sample('default'),{nameplateStyle:'inline'});
  expect(normal.dataset.newLine).toBe('true');
  expect(normal.querySelector<HTMLElement>('.overlay-message-separator')?.hidden).toBe(true);
  const floating=createChatMessageElement(sample('floating'),{
    nameplateStyle:'floating',newLineAfterUsername:false,messageOutline:3,
  });
  expect(floating.dataset.newLine).toBe('true');
  expect(floating.querySelector<HTMLElement>('.overlay-message-separator')?.hidden).toBe(true);
  expect(floating.querySelector('[data-message-paint-outline]')).not.toBeNull();
 });
 it('supports an empty identity header without a phantom colon or gap',()=>{
  const noHeader=createChatMessageElement(sample(),{
    newLineAfterUsername:false,showBadges:false,showNames:false,showPlatformBadges:false,
  });
  expect(noHeader.querySelector<HTMLElement>('.overlay-message-header')?.dataset.empty).toBe('true');
  expect(noHeader.querySelector('.overlay-message-separator')).toBeNull();
  expect(noHeader.querySelector('.overlay-message-content')?.textContent).toBe('hello world');
 });
 it('hot-switches existing rows and layouts without resetting lifetime or row identity',()=>{
  const root=document.createElement('div');
  const feed=createChatFeed(root,{layout:'stack',nameplateStyle:'inline',
    newLineAfterUsername:true,ttlMs:120000});
  feed.receive(sample('first'));
  const row=root.querySelector<HTMLElement>('[data-message-id=first]')!;
  const started=feed.snapshot()[0]!.enteredAt;
  for(const layout of ['stack','strip','spotlight'] as const){
    feed.configure({layout,newLineAfterUsername:false});
    feed.refreshAppearance();
    expect(root.querySelector('[data-message-id=first]')).toBe(row);
    expect(row.dataset.newLine).toBe('false');
    expect(root.dataset.stripRows).toBe('single');
  }
  feed.configure({newLineAfterUsername:true});
  feed.refreshAppearance();
  expect(row.dataset.newLine).toBe('true');
  expect(root.dataset.stripRows).toBe('double');
  expect(feed.snapshot()[0]?.enteredAt).toBe(started);
  feed.dispose();
 });
 it('restores the extra emote height when strip messages share the username line',()=>{
  const root=document.createElement('div');
  const feed=createChatFeed(root,{layout:'strip',fontSize:24,lineHeight:1.5,
    padding:8,newLineAfterUsername:true});
  const reserved=root.style.getPropertyValue('--chat-emote-height-limit');
  feed.configure({newLineAfterUsername:false});
  const compact=root.style.getPropertyValue('--chat-emote-height-limit');
  const px=(value:string)=>Number(value.match(/- (\d+)px/)?.[1]??'0');
  expect(px(reserved)).toBeGreaterThan(px(compact));
  expect(px(compact)).toBe(28); // padding twice, plus bubble inset
  feed.configure({nameplateStyle:'floating'});
  expect(root.style.getPropertyValue('--chat-emote-height-limit')).toBe(reserved);
  feed.dispose();
 });

 it('keeps old live stripRows API as an alias and lets floating labels take precedence',()=>{
  const root=document.createElement('div');
  const feed=createChatFeed(root,{layout:'strip',stripRows:'single',ttlMs:120000});
  feed.receive(sample('old'));
  const row=root.querySelector<HTMLElement>('[data-message-id=old]')!;
  expect(root.dataset.stripRows).toBe('single');
  expect(row.dataset.newLine).toBe('false');
  feed.configure({stripRows:'double'});
  feed.refreshAppearance();
  expect(row.dataset.newLine).toBe('true');
  feed.configure({nameplateStyle:'floating',newLineAfterUsername:false});
  feed.refreshAppearance();
  expect(row.dataset.newLine).toBe('true');
  expect(root.dataset.stripRows).toBe('double');
  feed.dispose();
 });
});
