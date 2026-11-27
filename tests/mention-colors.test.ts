// @vitest-environment jsdom
import {describe,expect,it} from 'vitest';
import {createChatFeed} from '../src/views';
import {createChatMessageElement} from '../src/renderers';
import type {DisplayMessage} from '../src/chatbus';

const message=(id:string,username:string,color:string|undefined,parts:DisplayMessage['parts'],
  sourceId='kick:one',platform='kick'):DisplayMessage=>({
  id,timestamp:10,sourceId,platform,channelName:sourceId.split(':')[1],
  user:{id:'id-'+username,username,name:username,color,badges:[]},parts,
});
const text=(value:string):DisplayMessage['parts']=>[{type:'text',text:value}];
const mentions=(root:HTMLElement)=>Array.from(root.querySelectorAll<HTMLElement>('[data-mention="true"]'));
const color=(el:HTMLElement)=>el.style.color;

describe('mentions use the mentioned user’s observed chat color',()=>{
 it('colors a Twitch structured mention by target identity, not message author',()=>{
  const root=document.createElement('div');
  const feed=createChatFeed(root,{ttlMs:120000,textColorSource:'user-color'});
  feed.receive(message('target','MiXeD','#2acdef',text('Hey'),'twitch:one','twitch'));
  feed.receive(message('reply','someone','#ff3300',[
    {type:'text',text:'hello '},{type:'mention',text:'@MIXED',username:'mixed',userId:'id-MiXeD'},
    {type:'text',text:'!'},
  ],'twitch:one','twitch'));
  const mention=mentions(root)[0]!;
  expect(mention.textContent).toBe('@MIXED');
  expect(mention.dataset.username).toBe('mixed'); // Preserve existing structured-mention DOM metadata.
  expect(mention.style.color).toBe('rgb(42, 205, 239)');
  expect(mention.style.webkitTextFillColor).toBe('rgb(42, 205, 239)');
  const author=root.querySelector<HTMLElement>('[data-message-id=reply] [data-username]')!;
  expect(author.style.color).toBe('rgb(255, 51, 0)');
  feed.dispose();
 });
 it('recognizes Kick plain-text @mentions, preserving spacing, emotes, emoji, and literal HTML',()=>{
  const root=document.createElement('div'),feed=createChatFeed(root,{ttlMs:120000});
  feed.receive(message('target','chat_user','#ffaacc',text('hi')));
  const emote={id:'Kappa',code:'Kappa',url:'/kappa.png',overlays:[],modifiers:[]};
  feed.receive(message('reply','writer','#777777',[
   {type:'text',text:'Hi @CHAT_USER, email a@chat_user.com and visit https://x.test/@chat_user or https://x.test/?q=@chat_user. '},
   {type:'emote',emote},{type:'text',text:' @unknown 💛 <b> @chat_user!'},
  ]));
  const row=root.querySelector<HTMLElement>('[data-message-id=reply]')!;
  expect(mentions(row).map(m=>m.textContent)).toEqual(['@CHAT_USER','@unknown','@chat_user']);
  expect(mentions(row).map(color)).toEqual(['rgb(255, 170, 204)','','rgb(255, 170, 204)']);
  expect(row.textContent).toContain('email a@chat_user.com and visit ↗ x.test/@chat_user or ↗ x.test.');
  expect(Array.from(row.querySelectorAll<HTMLElement>('[data-overlay-link]'),x=>x.dataset.originalUrl))
    .toEqual(['https://x.test/@chat_user','https://x.test/?q=@chat_user']);
  expect(row.textContent).toContain('<b>');
  expect(row.querySelector('b')).toBeNull();
  expect(row.querySelectorAll('.overlay-emote img')).toHaveLength(1);
  feed.dispose();
 });
 it('colors a prior unresolved mention when its target speaks later, without replacing the row or timer',()=>{
  const root=document.createElement('div'),feed=createChatFeed(root,{ttlMs:120000,nameplateStyle:'floating'});
  feed.receive(message('early','writer','#ffffff',text('@later hello')));
  const row=root.querySelector<HTMLElement>('[data-message-id=early]')!;
  const mention=mentions(row)[0]!;
  const started=feed.snapshot().find(x=>x.id==='early')!.enteredAt;
  expect(color(mention)).toBe('');
  feed.receive(message('target','Later','#88f00a',text('hi')));
  expect(color(mention)).toBe('rgb(136, 240, 10)');
  expect(root.querySelector('[data-message-id=early]')).toBe(row);
  expect(feed.snapshot().find(x=>x.id==='early')!.enteredAt).toBe(started);
  feed.dispose();
 });
 it('separates Kick and Twitch sources and prevents identical-name color leakage',()=>{
  const root=document.createElement('div'),feed=createChatFeed(root,{ttlMs:120000});
  feed.receive(message('kick-target','alex','#77ff00',text('A'),'kick:one'));
  feed.receive(message('twitch-target','alex','#ee0099',text('B'),'twitch:one','twitch'));
  feed.receive(message('kick-reply','b','#eeeeee',text('@alex'),'kick:one'));
  feed.receive(message('twitch-reply','c','#eeeeee',text('@alex'),'twitch:one','twitch'));
  feed.receive(message('other-reply','d','#eeeeee',text('@alex'),'kick:two'));
  expect(color(mentions(root.querySelector<HTMLElement>('[data-message-id=kick-reply]')!)[0]!)).toBe('rgb(119, 255, 0)');
  expect(color(mentions(root.querySelector<HTMLElement>('[data-message-id=twitch-reply]')!)[0]!)).toBe('rgb(238, 0, 153)');
  expect(color(mentions(root.querySelector<HTMLElement>('[data-message-id=other-reply]')!)[0]!)).toBe('');
  feed.dispose();
 });
 it('uses explicit userId before a conflicting display name, and validates target color',()=>{
  const root=document.createElement('div'),feed=createChatFeed(root,{ttlMs:120000});
  const target=message('target','good','#abcdef',text('yes'));
  target.user.id='opaque-one';
  feed.receive(target);
  feed.receive(message('wrong','other','#ff0000',text('no')));
  feed.receive(message('mention','writer','#ffffff',[
   {type:'mention',text:'@other',username:'other',userId:'opaque-one'},
  ]));
  expect(color(mentions(root.querySelector<HTMLElement>('[data-message-id=mention]')!)[0]!)).toBe('rgb(171, 205, 239)');
  feed.receive(message('invalid','hacker','red; background:url(https://evil.test/)',text('no')));
  feed.receive(message('invalid-mention','writer','#ffffff',text('@hacker')));
  expect(color(mentions(root.querySelector<HTMLElement>('[data-message-id=invalid-mention]')!)[0]!)).toBe('');
  feed.dispose();
 });
 it('recolors with a new observed color, clears on source removal, and supports late source reuse',()=>{
  const root=document.createElement('div'),feed=createChatFeed(root,{ttlMs:120000});
  feed.receive(message('target1','alex','#ffaa00',text('first')));
  feed.receive(message('early','writer','#dddddd',text('hello @alex')));
  const early=mentions(root.querySelector<HTMLElement>('[data-message-id=early]')!)[0]!;
  feed.receive(message('target2','alex','#00aaff',text('updated')));
  expect(color(early)).toBe('rgb(0, 170, 255)');
  feed.removeSource('kick:one');
  feed.receive(message('after','writer','#dddddd',text('@alex still here')));
  expect(color(mentions(root)[0]!)).toBe('');
  feed.clear();feed.dispose();
 });
 it('forgets both ID and username colors after a source-scoped user clear',()=>{
  const root=document.createElement('div'),feed=createChatFeed(root,{ttlMs:120000});
  feed.receive(message('target','alex','#99bb11',text('hi')));
  feed.receive(message('author','writer','#dddddd',text('hey @alex')));
  const mention=mentions(root.querySelector<HTMLElement>('[data-message-id=author]')!)[0]!;
  expect(color(mention)).toBe('rgb(153, 187, 17)');
  feed.removeUser({sourceId:'kick:one',userId:'id-alex'});
  expect(color(mention)).toBe('');
  feed.receive(message('again','writer','#dddddd',text('ping @alex again')));
  expect(color(mentions(root.querySelector<HTMLElement>('[data-message-id=again]')!)[0]!)).toBe('');
  feed.dispose();
 });
 it('clears the cached user color between chat clear and a later fresh source',()=>{
  const root=document.createElement('div'),feed=createChatFeed(root,{ttlMs:120000});
  feed.receive(message('target','alex','#00ff00',text('hi')));
  feed.clear();
  feed.receive(message('after-clear','someone','#bbbbbb',text('hi @alex')));
  expect(color(mentions(root)[0]!)).toBe('');
  feed.dispose();
 });
 it('honors letter animation and text name-paint with mention-specific color',()=>{
  const root=document.createElement('div'),feed=createChatFeed(root,{
    ttlMs:120000,letterEnter:'rise',textColorSource:'name-paint',
  });
  feed.receive(message('target','moss','#4411dd',text('hi')));
  const author=message('reply','writer','#eeeeee',text('ping @moss'));
  author.user.namePaint={id:'paint',provider:'7tv',gradients:[{
    function:'LINEAR_GRADIENT',angle:30,stops:[{at:0,color:0xffff0000},{at:1,color:0xff0000ff}],
  }]};
  feed.receive(author);
  const row=root.querySelector<HTMLElement>('[data-message-id=reply]')!;
  expect(row.querySelector('.overlay-message-content')?.getAttribute('style')).toContain('background-image');
  expect(mentions(row)[0]!.style.webkitTextFillColor).toBe('rgb(68, 17, 221)');
  expect(mentions(row)[0]!.querySelectorAll('.overlay-letter').length).toBeGreaterThan(0);
  feed.refreshAppearance();
  expect(color(mentions(row)[0]!)).toBe('rgb(68, 17, 221)');
  feed.dispose();
 });
 it('does not infer a target color when used standalone, and caps untrusted mentions',()=>{
  const row=createChatMessageElement(message('standalone','writer','#aa00ff',text(
    '@one @two @three @four @five @six @seven @eight @nine @ten @eleven @twelve @thirteen @fourteen',
  )));
  expect(mentions(row).length).toBeLessThanOrEqual(12);
  expect(row.textContent).toContain('@fourteen');
  expect(mentions(row).every(x=>!x.style.color)).toBe(true);
 });
});
