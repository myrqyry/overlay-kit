import {describe,it,expect} from 'vitest';
import {createChatMessageElement,type ChatAppearance} from '../src/renderers';
import {createChatFeed} from '../src/views';
import {DEFAULT_OPTIONS,normalizeOptions,optionsForEditor,readOptions,writeOptions} from '../src/options';
import type {DisplayMessage,DisplayNamePaint} from '../src/chatbus';

type ExpandedAppearance=ChatAppearance & {
  messageBackground?:'theme'|'user-color'|'name-paint';
  messageOutline?:number;
};
const paint:DisplayNamePaint={id:'paint',provider:'7tv',layers:[
  {kind:'linear',angle:35,repeating:false,opacity:.7,stops:[
    {at:0,color:0xffff3366},{at:1,color:0xff3355ff},
  ]},
]};
const message=(id='m',withPaint=true):DisplayMessage=>({
 id,timestamp:1,user:{name:'Alice',username:'alice',color:'#336699',badges:[],...(withPaint?{namePaint:paint}:{})},
 parts:[{type:'text',text:'Hello there'}],
});

describe('message background and outline controls',()=>{
 it('offers theme, user-color, and name-paint backgrounds plus an independent message outline',()=>{
  expect(DEFAULT_OPTIONS).toMatchObject({messageBackground:'theme',messageOutline:0});
  const controls=optionsForEditor('chat',false);
  expect(controls.find(x=>x.key==='messageBackground')?.choices?.map(x=>x.value))
    .toEqual(['theme','user-color','name-paint']);
  expect(controls.find(x=>x.key==='messageOutline')).toMatchObject({kind:'range',min:0,max:8});
  const custom=normalizeOptions({messageBackground:'name-paint',messageOutline:2.5,backgroundAlpha:55});
  const url=writeOptions(custom,'chat');
  expect(url).toContain('messageBg=name-paint');
  expect(url).toContain('messageOutline=2.5');
  expect(readOptions('?'+url,'chat')).toMatchObject({messageBackground:'name-paint',messageOutline:2.5});
 });

 it('keeps the existing low-level custom background override in theme mode',()=>{
  const el=createChatMessageElement(message(),{background:'rgb(1, 2, 3)'});
  expect(el.style.background).toBe('rgb(1, 2, 3)');
 });

 it('uses the chatter color as the bubble fill and outline without changing text color',()=>{
  const el=createChatMessageElement(message('no-paint',false),{
    messageBackground:'user-color',backgroundAlpha:50,messageOutline:2,
  } as ExpandedAppearance);
  expect(el.dataset.messageBackground).toBe('user-color');
  expect(el.style.backgroundColor).toContain('rgba(51, 102, 153, 0.5)');
  expect(el.style.borderWidth).toBe('2px');
  expect(el.style.borderColor).toBe('rgb(51, 102, 153)');
  expect(el.style.color).not.toBe('rgb(51, 102, 153)');
 });

 it('renders sanitized name-paint layers as bubble artwork and falls back to user color before theme',()=>{
  const painted=createChatMessageElement(message(),{
    messageBackground:'name-paint',backgroundAlpha:60,messageOutline:1,
  } as ExpandedAppearance);
  expect(painted.dataset.messageBackground).toBe('name-paint');
  const layers=painted.querySelectorAll<HTMLElement>('[data-message-paint-layer]');
  expect(layers).toHaveLength(1);
  expect(layers[0].style.backgroundImage).toContain('linear-gradient(35deg');
  expect(layers[0].style.opacity).toBe('0.42');
  expect(painted.style.borderColor).toBeTruthy();

  const fallback=createChatMessageElement(message('fallback',false),{
    messageBackground:'name-paint',backgroundAlpha:25,
  } as ExpandedAppearance);
  expect(fallback.dataset.messageBackground).toBe('user-color');
  expect(fallback.style.backgroundColor).toContain('rgba(51, 102, 153, 0.25)');
 });

 it('follows 7TV gradient artwork on the outline even with a theme background',()=>{
  const el=createChatMessageElement(message('gradient'),{
    messageBackground:'theme',messageOutline:3,radius:18,backgroundAlpha:0,
  });
  expect(el.dataset.messageBackground).toBe('theme');
  expect(el.style.borderWidth).toBe('3px');
  const ring=el.querySelector<HTMLElement>('[data-message-paint-outline]');
  expect(ring).not.toBeNull();
  expect(ring!.style.backgroundImage).toContain('linear-gradient(35deg');
  expect(ring!.style.backgroundImage).toContain('rgb(255, 51, 102)');
  expect(ring!.style.backgroundImage).toContain('rgb(51, 85, 255)');
  expect(ring!.style.opacity).toBe('0.7');
  expect(ring!.style.padding).toBe('3px');
  expect(ring!.style.inset).toBe('-3px');
  expect(ring!.style.borderRadius).toBe('inherit');
  expect(el.querySelectorAll('[data-message-paint-layer]')).toHaveLength(0);
 });

 it('preserves ordered 7TV outline layers without replacing the message fill',()=>{
  const layered:DisplayNamePaint={id:'v4-outline',provider:'7tv',layers:[
    {kind:'solid',color:0xff123456,opacity:1},
    {kind:'linear',angle:45,repeating:true,opacity:.5,stops:[
      {at:0,color:0xffff0000},{at:1,color:0xff00ff00},
    ]},
    {kind:'image',url:'https://cdn.7tv.app/paint/texture.webp',opacity:.8},
    {kind:'image',url:'javascript:alert(1)',opacity:1},
  ]};
  const value=message('layer-outline');value.user.namePaint=layered;
  const el=createChatMessageElement(value,{messageBackground:'user-color',messageOutline:2});
  const rings=Array.from(el.querySelectorAll<HTMLElement>('[data-message-paint-outline]'));
  expect(rings).toHaveLength(3);
  // A flat underlay now uses a native rounded border, so its inner
  // corner is rendered as a normal stroke rather than a double CSS mask.
  expect(rings[0].style.borderColor).toBe('rgb(18, 52, 86)');
  expect(rings[0].style.borderStyle).toBe('solid');
  expect(rings[0].style.backgroundImage).toBe('');
  expect(rings[1].style.backgroundImage).toContain('repeating-linear-gradient(45deg');
  expect(rings[1].style.opacity).toBe('0.5');
  expect(rings[2].style.backgroundImage).toContain('https://cdn.7tv.app/paint/texture.webp');
  expect(el.style.backgroundColor).toContain('rgba(51, 102, 153');
  expect(el.querySelectorAll('[data-message-paint-layer]')).toHaveLength(0);
 });

 it('renders legacy 7TV gradients with repeat, position and size in the outline',()=>{
  const value=message('legacy-outline');
  value.user.namePaint={id:'v3',provider:'7tv',gradients:[{
    function:'LINEAR_GRADIENT',angle:110,repeat:true,
    at:[.2,.8],canvasSize:[.65,.4],canvasRepeat:'repeat-x',
    stops:[{at:0,color:0xffff0000},{at:1,color:0xff00ff00}],
  }]};
  const el=createChatMessageElement(value,{messageOutline:2,messageBackground:'theme'});
  const ring=el.querySelector<HTMLElement>('[data-message-paint-outline]')!;
  expect(ring.style.backgroundImage).toContain('repeating-linear-gradient(110deg');
  expect(ring.style.backgroundPosition).toBe('20% 80%');
  expect(ring.style.backgroundSize).toBe('65% 40%');
  expect(ring.style.backgroundRepeat).toBe('repeat-x');
 });

 it('does not allow unsafe 7TV image URLs to become outline artwork',()=>{
  const value=message('unsafe-outline');
  value.user.namePaint={id:'unsafe',provider:'7tv',gradients:[{
    function:'URL',imageUrl:'javascript:alert(1)',stops:[],
  }]};
  const el=createChatMessageElement(value,{messageOutline:3,messageBackground:'theme'});
  expect(el.querySelectorAll('[data-message-paint-outline]')).toHaveLength(0);
  expect(el.style.borderColor).toBe('rgba(246, 240, 233, 0.42)');
 });

 it('uses a 7TV solid-color paint without requiring a name-paint background',()=>{
  const value=message('solid');
  value.user.namePaint={id:'solid',provider:'7tv',color:0xffaa22cc};
  const el=createChatMessageElement(value,{messageBackground:'theme',messageOutline:1.5});
  expect(el.style.borderColor).toBe('rgb(170, 34, 204)');
  expect(el.querySelectorAll('[data-message-paint-outline]')).toHaveLength(0);
 });

 it('cleans up the paint ring for late identity and outline-setting changes',()=>{
  const root=document.createElement('div');
  const feed=createChatFeed(root,{messageBackground:'theme',messageOutline:2});
  feed.receive(message('late-outline',false));
  const row=root.querySelector<HTMLElement>('[data-message-id="late-outline"]')!;
  expect(row.querySelectorAll('[data-message-paint-outline]')).toHaveLength(0);
  feed.updateIdentity('late-outline',{badges:[],namePaint:paint});
  expect(root.querySelector('[data-message-id="late-outline"]')).toBe(row);
  expect(row.querySelectorAll('[data-message-paint-outline]')).toHaveLength(1);
  feed.configure({messageOutline:0});
  feed.refreshAppearance();
  const same=root.querySelector<HTMLElement>('[data-message-id="late-outline"]')!;
  expect(same).toBe(row);
  expect(same.querySelectorAll('[data-message-paint-outline]')).toHaveLength(0);
  expect(same.style.borderWidth).toBe('');
  feed.configure({messageOutline:2});
  feed.refreshAppearance();
  expect(row.querySelectorAll('[data-message-paint-outline]')).toHaveLength(1);
  feed.dispose();
 });

 it('preserves bottom-to-top order for layered name-paint bubble artwork',()=>{
  const layered:DisplayNamePaint={id:'layers',provider:'7tv',layers:[
    {kind:'solid',color:0xff112233,opacity:1},
    {kind:'linear',angle:80,repeating:false,opacity:.5,stops:[
      {at:0,color:0xffff0000},{at:1,color:0xff00ff00},
    ]},
  ]};
  const value=message('layer-order');value.user.namePaint=layered;
  const el=createChatMessageElement(value,{messageBackground:'name-paint'} as ExpandedAppearance);
  const layers=Array.from(el.querySelectorAll<HTMLElement>('[data-message-paint-layer]'));
  expect(layers).toHaveLength(2);
  expect(layers[0].style.backgroundImage).toContain('rgb(17, 34, 51)');
  expect(layers[1].style.backgroundImage).toContain('linear-gradient(80deg');
 });

 it('applies a late name paint to the existing bubble without recreating the row',()=>{
  const root=document.createElement('div');
  const feed=createChatFeed(root,{messageBackground:'name-paint',backgroundAlpha:70} as Parameters<typeof createChatFeed>[1] & ExpandedAppearance);
  feed.receive(message('late',false));
  const row=root.querySelector<HTMLElement>('[data-message-id="late"]')!;
  expect(row.dataset.messageBackground).toBe('user-color');
  feed.updateIdentity('late',{badges:[],namePaint:paint});
  expect(root.querySelector('[data-message-id="late"]')).toBe(row);
  expect(row.dataset.messageBackground).toBe('name-paint');
  expect(row.querySelectorAll('[data-message-paint-layer]')).toHaveLength(1);
  feed.dispose();
 });
});

describe('identity row is separate from message content in every chat layout',()=>{
 for(const layout of ['stack','strip','spotlight'] as const){
  it(layout+' places badges/name above the message body',()=>{
   const root=document.createElement('div');
   const feed=createChatFeed(root,{layout,maxActive:4,ttlMs:120000});
   feed.receive(message(layout));
   const row=root.querySelector<HTMLElement>('.overlay-chat-message')!;
   const header=row.querySelector<HTMLElement>('.overlay-message-header')!;
   const body=row.querySelector<HTMLElement>('.overlay-message-body')!;
   expect(header.tagName).toBe('DIV');
   expect(body.tagName).toBe('DIV');
   expect(header.nextElementSibling).toBe(body);
   expect(header.querySelector<HTMLElement>('.overlay-message-separator')?.hidden).toBe(true);
   expect(body.textContent).toContain('Hello there');
   feed.dispose();
  });
 }
});
