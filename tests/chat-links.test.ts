// @vitest-environment jsdom
import {describe,it,expect} from 'vitest';
import {DEFAULT_OPTIONS,normalizeOptions,optionsForEditor,readOptions,writeOptions} from '../src/options';
import {createChatMessageElement} from '../src/renderers';
import {createChatFeed} from '../src/views';
import type {DisplayMessage} from '../src/chatbus';

const msg=(id:string,text:string,parts?:DisplayMessage['parts']):DisplayMessage=>({
 id,timestamp:1,platform:'twitch',
 user:{name:'linker',username:'linker',id:'1',color:'#9fbdca',badges:[]},
 parts:parts??[{type:'text',text}],
});
const links=(row:HTMLElement)=>Array.from(row.querySelectorAll<HTMLElement>('[data-overlay-link]'));

describe('compact display of chat URLs for a noninteractive OBS overlay',()=>{
 it('exposes independent chat-only link display choices, compact by default, with URL/preset validation',()=>{
  expect(DEFAULT_OPTIONS.linkDisplay).toBe('compact');
  const controls=optionsForEditor('chat',false);
  const item=controls.find(x=>x.key==='linkDisplay');
  expect(item).toMatchObject({kind:'select',section:'Chat • Content',label:'Link display'});
  expect(item?.choices?.map(x=>x.value)).toEqual(['compact','domain','hidden','full']);
  const changed=normalizeOptions({linkDisplay:'domain'});
  expect(readOptions('?'+writeOptions(changed,'chat'),'chat').linkDisplay).toBe('domain');
  expect(writeOptions(changed,'chat')).toContain('links=domain');
  expect(writeOptions(changed,'wall')).not.toContain('links=');
  expect(writeOptions(DEFAULT_OPTIONS,'chat')).not.toContain('links=');
  expect(normalizeOptions({linkDisplay:'nonsense'}).linkDisplay).toBe('compact');
 });
 it('shows a compact safe label and preserves the entire original URL in DOM metadata but not anchors',()=>{
  const original='https://www.youtube.com/watch?v=abc123&utm_source=social&utm_medium=chat';
  const row=createChatMessageElement(msg('compact','Check '+original+' for the video.'));
  const link=links(row)[0]!;
  expect(link).toBeTruthy();
  expect(link.textContent).toBe('↗ youtube.com/watch');
  expect(link.dataset.originalUrl).toBe(original);
  expect(link.title).toBe(original);
  expect(link.dataset.linkHost).toBe('www.youtube.com');
  expect(row.querySelector('a')).toBeNull();
  expect(link.style.overflowWrap).toBe('anywhere');
  expect(row.textContent).not.toContain('utm_source');
  expect(row.textContent).toContain('Check ↗ youtube.com/watch for the video.');
 });
 it('handles full, domain-only and obscured display without modifying Chatbus parts',()=>{
  const original='https://clips.twitch.tv/FancyExampleClip?utm_campaign=long';
  const message=msg('full','Look '+original);
  for(const [mode,label] of [
    ['compact','↗ clips.twitch.tv/FancyExampleClip'],
    ['domain','↗ clips.twitch.tv'],
    ['hidden','↗ link'],
  ] as const){
    const row=createChatMessageElement(message,{linkDisplay:mode});
    const link=links(row)[0]!;
    expect(link.textContent).toBe(label);
    expect(link.dataset.originalUrl).toBe(original);
    expect(row.querySelector('a')).toBeNull();
  }
  const full=createChatMessageElement(message,{linkDisplay:'full'});
  expect(links(full)).toHaveLength(0);
  expect(full.textContent).toContain(original);
  expect(message.parts[0]).toMatchObject({text:'Look '+original});
 });
 it('handles www hosts, punctuation, multiple URLs, balanced parentheses, port, and mail addresses',()=>{
  const text='www.example.com/test. (https://en.wikipedia.org/wiki/Function_(mathematics)) Email me@example.com, next https://docs.example.org:8443/help/a/b?q=1!';
  const row=createChatMessageElement(msg('multiple',text));
  const tokens=links(row);
  expect(tokens).toHaveLength(3);
  expect(tokens.map(x=>x.dataset.originalUrl)).toEqual([
    'www.example.com/test',
    'https://en.wikipedia.org/wiki/Function_(mathematics)',
    'https://docs.example.org:8443/help/a/b?q=1',
  ]);
  expect(tokens.map(x=>x.textContent)).toEqual([
    '↗ example.com/test',
    '↗ en.wikipedia.org/wiki/…',
    '↗ docs.example.org:8443/help/…',
  ]);
  expect(row.textContent).toContain('… ) Email me@example.com, next '.replace('… )','…)'));
  expect(row.textContent?.endsWith('!')).toBe(true);
 });
 it('does not create mentions from @handles in URL paths or queries, preserving real mentions',()=>{
  const row=createChatMessageElement(msg('mentions',
    '@alex https://x.test/@alice/?q=@bob&via=@carol @real'));
  expect(links(row)).toHaveLength(1);
  expect(Array.from(row.querySelectorAll('[data-mention="true"]'),x=>x.textContent))
    .toEqual(['@alex','@real']);
  expect(row.querySelector('[data-original-url]')?.getAttribute('data-original-url'))
    .toBe('https://x.test/@alice/?q=@bob&via=@carol');
 });
 it('does not turn email, markup, javascript schemes or invalid domain candidates into links',()=>{
  const row=createChatMessageElement(msg('unsafe',
    'hi foo@www.example.com and javascript:alert(1) <b> www.<> http://?x no @mentions.'));
  expect(links(row)).toHaveLength(0);
  expect(row.querySelector('b')).toBeNull();
  expect(row.textContent).toContain('<b>');
  expect(row.textContent).toContain('http://?x');
 });
 it('refuses HTTP userinfo and spoofed URL candidates rather than masking their visible origin',()=>{
  const raw='https://trusted.test@attacker.test/secret https://user:password@example.com/file';
  const row=createChatMessageElement(msg('userinfo',raw));
  expect(links(row)).toHaveLength(0);
  expect(row.textContent).toContain(raw);
  expect(row.querySelector('a')).toBeNull();
 });
 it('caps URL substitutions in a noisy message and never destroys the remaining text',()=>{
  const input=Array.from({length:18},(_,i)=>'https://example.org/'+i).join(' ');
  const row=createChatMessageElement(msg('many',input));
  expect(links(row).length).toBeLessThanOrEqual(12);
  expect(row.textContent).toContain('https://example.org/17');
 });
 it('preserves inline media and emoji, and survives late color changes and settings refresh without resetting lifetime',()=>{
  const root=document.createElement('div');
  const feed=createChatFeed(root,{linkDisplay:'compact',ttlMs:120000,letterEnter:'rise'});
  const parts:DisplayMessage['parts']=[
    {type:'text',text:'@friend visit https://clips.twitch.tv/example?ref=spam '},
    {type:'emote',emote:{id:'smile',code:'Smile',url:'/smile.png',modifiers:[],overlays:[]}},
    {type:'text',text:' 💜 www.test.org/next'},
  ];
  feed.receive(msg('live','',parts));
  const row=root.querySelector<HTMLElement>('[data-message-id=live]')!;
  const enteredAt=feed.snapshot()[0]!.enteredAt;
  expect(links(row)).toHaveLength(2);
  expect(row.querySelectorAll('.overlay-emote')).toHaveLength(1);
  expect(row.querySelector('.overlay-letter')).not.toBeNull();
  feed.configure({linkDisplay:'domain'});
  feed.refreshAppearance();
  expect(root.querySelector('[data-message-id=live]')).toBe(row);
  expect(links(row).map(x=>x.textContent)).toEqual(['↗ clips.twitch.tv','↗ test.org']);
  feed.configure({linkDisplay:'full'});
  feed.refreshAppearance();
  expect(links(row)).toHaveLength(0);
  expect(row.textContent).toContain('https://clips.twitch.tv/example?ref=spam');
  expect(feed.snapshot()[0]!.enteredAt).toBe(enteredAt);
  feed.dispose();
 });
});
