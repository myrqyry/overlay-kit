// @vitest-environment jsdom
import {describe,it,expect} from 'vitest';
import {createChatMessageElement} from '../src/renderers';
import {createChatFeed} from '../src/views';
import {DEFAULT_OPTIONS,normalizeOptions,readOptions,writeOptions,optionsForEditor,isOptionApplicable} from '../src/options';
import type {DisplayMessage,DisplayNamePaint} from '../src/chatbus';

const paint:DisplayNamePaint={id:'7tv-v4',provider:'7tv',layers:[
  {kind:'solid',color:0xff224466,opacity:.8},
  {kind:'linear',angle:30,repeating:false,opacity:.55,stops:[
    {at:0,color:0xffff2266},{at:1,color:0xff00ccbb},
  ]},
  {kind:'image',url:'https://cdn.7tv.app/paint/pattern.webp',opacity:.5},
]};
const message=(id='blur',withPaint=true):DisplayMessage=>({
 id,timestamp:1,platform:'twitch',
 user:{name:'Painted',color:'#55aaff',badges:[],
   ...(withPaint?{namePaint:paint}:{})},
 parts:[{type:'text',text:'Still sharp text and emotes'},{type:'emote',
   emote:{id:'smile',code:'Smile',url:'https://cdn.example/emote.png',modifiers:[],overlays:[]}}],
});
const layers=(root:HTMLElement)=>Array.from(root.querySelectorAll<HTMLElement>('[data-message-paint-layer]'));
const outlines=(root:HTMLElement)=>Array.from(root.querySelectorAll<HTMLElement>('[data-message-paint-outline]'));

describe('bounded blur of 7TV namepaint message fills',()=>{
 it('adds a scoped Styling slider with 0 default and URL/preset validation',()=>{
  expect(DEFAULT_OPTIONS.messagePaintBlur).toBe(0);
  const defs=optionsForEditor('chat',false);
  const bg=defs.findIndex(x=>x.key==='messageBackground');
  expect(defs[bg+1]).toMatchObject({
    key:'messagePaintBlur',label:'Name paint background blur',
    kind:'range',section:'Chat • Styling',min:0,max:48,step:.5,unit:'px',
  });
  const saved=normalizeOptions({messageBackground:'name-paint',messagePaintBlur:2.5});
  const url=writeOptions(saved,'chat');
  expect(url).toContain('messagePaintBlur=2.5');
  expect(readOptions('?'+url,'chat')).toEqual(saved);
  expect(writeOptions(saved,'wall')).not.toContain('messagePaintBlur');
  expect(normalizeOptions({messagePaintBlur:'bad'}).messagePaintBlur).toBe(0);
  expect(normalizeOptions({messagePaintBlur:-1}).messagePaintBlur).toBe(0);
  expect(normalizeOptions({messagePaintBlur:100}).messagePaintBlur).toBe(48);
  expect(normalizeOptions({messagePaintBlur:2.7}).messagePaintBlur).toBe(2.5);
  expect(writeOptions(DEFAULT_OPTIONS,'chat')).not.toContain('messagePaintBlur');
 });
 it('only shows the control when a name-paint bubble background is selected',()=>{
  expect(isOptionApplicable('messagePaintBlur',normalizeOptions({messageBackground:'theme'}))).toBe(false);
  expect(isOptionApplicable('messagePaintBlur',normalizeOptions({messageBackground:'user-color'}))).toBe(false);
  expect(isOptionApplicable('messagePaintBlur',normalizeOptions({messageBackground:'name-paint'}))).toBe(true);
  expect(isOptionApplicable('messageOutline',normalizeOptions({messageBackground:'theme'}))).toBe(true);
 });
 it('preserves the current exact paint DOM and z-order when blur is zero',()=>{
  const row=createChatMessageElement(message(),{
    messageBackground:'name-paint',messagePaintBlur:0,messageOutline:2,backgroundAlpha:70,
  });
  expect(row.querySelector('[data-message-paint-surface]')).toBeNull();
  expect(row.querySelector('[data-message-paint-blur]')).toBeNull();
  expect(layers(row)).toHaveLength(3);
  expect(layers(row).every(layer=>layer.parentElement===row)).toBe(true);
  expect(outlines(row)).toHaveLength(3);
 });
 it('blurs only the fill in a rounded clipped layer, retaining paint ordering and opacity',()=>{
  const row=createChatMessageElement(message('with-blur'),{
    messageBackground:'name-paint',messagePaintBlur:3,messageOutline:2,
    radius:32,backgroundAlpha:70,textColorSource:'name-paint',
  });
  const clip=row.querySelector<HTMLElement>('[data-message-paint-surface]')!;
  const blurred=row.querySelector<HTMLElement>('[data-message-paint-blur]')!;
  expect(clip).toBeTruthy();
  expect(clip.style.overflow).toBe('hidden');
  expect(clip.style.borderRadius).toBe('inherit');
  expect(clip.style.zIndex).toBe('0');
  expect(blurred.parentElement).toBe(clip);
  expect(blurred.style.filter).toBe('blur(3px)');
  expect(blurred.style.inset).toBe('-3px');
  expect(layers(row)).toHaveLength(3);
  expect(layers(row).every(x=>x.parentElement===blurred)).toBe(true);
  expect(layers(row)[0].style.backgroundImage).toContain('rgb(34, 68, 102)');
  expect(layers(row)[1].style.backgroundImage).toContain('linear-gradient(30deg');
  expect(layers(row)[2].style.backgroundImage).toContain('https://cdn.7tv.app');
  expect(layers(row).map(x=>x.style.opacity)).toEqual(['0.56','0.385','0.35']);
  expect(outlines(row)).toHaveLength(3);
  expect(outlines(row).every(x=>x.parentElement===row&&x.style.filter==='')).toBe(true);
  expect(row.querySelector<HTMLElement>('.overlay-message-content')?.style.filter).toBe('');
  expect(row.querySelector<HTMLElement>('[data-username]')?.style.filter).not.toBe('blur(3px)');
  expect(row.querySelector('.overlay-emote')).not.toBeNull();
  expect(row.style.filter).toBe('');
 });
 it('does not blur theme, user-color, fallback or solid-only paint backgrounds',()=>{
  for(const source of ['theme','user-color'] as const){
    const row=createChatMessageElement(message(source),{
      messageBackground:source,messagePaintBlur:4,messageOutline:2,
    });
    expect(row.querySelector('[data-message-paint-surface]')).toBeNull();
    expect(row.style.filter).toBe('');
  }
  const fallback=createChatMessageElement(message('fallback',false),{
    messageBackground:'name-paint',messagePaintBlur:4,
  });
  expect(fallback.dataset.messageBackground).toBe('user-color');
  expect(fallback.querySelector('[data-message-paint-surface]')).toBeNull();
  const solid=message('solid');
  solid.user.namePaint={id:'single',provider:'7tv',color:0xffee44cc};
  const row=createChatMessageElement(solid,{messageBackground:'name-paint',messagePaintBlur:4});
  expect(row.querySelector('[data-message-paint-surface]')).toBeNull();
  expect(row.style.backgroundColor).toBeTruthy();
 });
 it('hot-switches blur and background modes without duplicating layers or resetting row lifetimes',()=>{
  const root=document.createElement('div');
  const feed=createChatFeed(root,{
    messageBackground:'name-paint',messagePaintBlur:0,messageOutline:3,ttlMs:120000,
  });
  feed.receive(message('live'));
  const row=root.querySelector<HTMLElement>('[data-message-id=live]')!;
  const started=feed.snapshot()[0]!.enteredAt;
  const ringCount=outlines(row).length;
  feed.configure({messagePaintBlur:2});
  feed.refreshAppearance();
  expect(root.querySelector('[data-message-id=live]')).toBe(row);
  expect(row.querySelector<HTMLElement>('[data-message-paint-blur]')?.style.filter).toBe('blur(2px)');
  expect(layers(row)).toHaveLength(3);
  expect(outlines(row)).toHaveLength(ringCount);
  feed.configure({messageBackground:'theme'});
  feed.refreshAppearance();
  expect(row.querySelector('[data-message-paint-surface]')).toBeNull();
  expect(layers(row)).toHaveLength(0);
  feed.configure({messageBackground:'name-paint',messagePaintBlur:0});
  feed.refreshAppearance();
  expect(row.querySelector('[data-message-paint-surface]')).toBeNull();
  expect(layers(row)).toHaveLength(3);
  expect(feed.snapshot()[0]!.enteredAt).toBe(started);
  feed.dispose();
 });
 it('handles paints delivered late and clears the old paint surface on identity change',()=>{
  const root=document.createElement('div');
  const feed=createChatFeed(root,{messageBackground:'name-paint',messagePaintBlur:2,ttlMs:120000});
  feed.receive(message('late',false));
  const row=root.querySelector<HTMLElement>('[data-message-id=late]')!;
  expect(row.querySelector('[data-message-paint-surface]')).toBeNull();
  expect(feed.updateIdentity('late',{badges:[],namePaint:paint})).toBe(true);
  expect(root.querySelector('[data-message-id=late]')).toBe(row);
  expect(row.querySelectorAll('[data-message-paint-surface]')).toHaveLength(1);
  expect(layers(row)).toHaveLength(3);
  feed.updateIdentity('late',{badges:[],namePaint:{
    id:'other',provider:'7tv',layers:[{kind:'solid',color:0xffabcdef,opacity:1}],
  }});
  expect(row.querySelectorAll('[data-message-paint-surface]')).toHaveLength(0);
  expect(layers(row)).toHaveLength(1);
  feed.dispose();
 });
 it('uses exactly one native filter even at the expanded upper bound',()=>{
  const saved=normalizeOptions({messageBackground:'name-paint',messagePaintBlur:48});
  expect(readOptions('?'+writeOptions(saved,'chat'),'chat')).toEqual(saved);
  for(const radius of [32,48,100]){
    const row=createChatMessageElement(message(),{messageBackground:'name-paint',
      messagePaintBlur:radius,backgroundAlpha:100,messageOutline:2});
    const group=row.querySelector<HTMLElement>('[data-message-paint-blur]')!;
    expect(group.style.filter).toBe('blur('+Math.min(radius,48)+'px)');
    expect(group.style.inset).toBe(-Math.min(radius,48)+'px');
    expect(row.querySelectorAll('[data-message-paint-blur]')).toHaveLength(1);
    expect(layers(row).every(layer=>layer.parentElement===group&&layer.style.filter==='')).toBe(true);
    expect(group.style.backdropFilter).toBeFalsy();
    expect(group.style.willChange).toBe('');
    expect(outlines(row).every(layer=>layer.style.filter==='')).toBe(true);
  }
 });
 it('avoids allocating a filter for uniform fills and completely invisible detail',()=>{
  const solid=message();
  solid.user.namePaint={id:'solid-layers',provider:'7tv',layers:[
    {kind:'solid',color:0xff224466,opacity:.8},
    {kind:'solid',color:0xff775533,opacity:.4},
  ]};
  const appearance={messageBackground:'name-paint' as const,messagePaintBlur:48,backgroundAlpha:100,messageOutline:2};
  const row=createChatMessageElement(solid,appearance);
  expect(row.querySelector('[data-message-paint-blur]')).toBeNull();
  expect(layers(row)).toHaveLength(2);
  expect(outlines(row)).toHaveLength(2);
  const hidden=message();
  hidden.user.namePaint={...paint,layers:paint.layers!.map(layer=>({...layer,opacity:layer.kind==='solid'?.8:0}))};
  expect(createChatMessageElement(hidden,appearance).querySelector('[data-message-paint-blur]')).toBeNull();
  expect(createChatMessageElement(message(),{...appearance,backgroundAlpha:0}).querySelector('[data-message-paint-blur]')).toBeNull();
 });

});
