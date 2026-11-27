// @vitest-environment jsdom
import {describe,expect,it} from 'vitest';
import {createChatMessageElement,syncFloatingNameplateNotch} from '../src/renderers';
import {createChatFeed} from '../src/views';
import {DEFAULT_OPTIONS,normalizeOptions,optionsForEditor,readOptions,writeOptions} from '../src/options';
import type {DisplayMessage,DisplayNamePaint} from '../src/chatbus';

const gradient:DisplayNamePaint={
 id:'two-tone',provider:'7tv',gradients:[{function:'LINEAR_GRADIENT',angle:65,
  stops:[{at:0,color:0xffff3366},{at:1,color:0xff3355ff}]}],
};
const message=(id='one',namePaint?:DisplayNamePaint):DisplayMessage=>({
 id,timestamp:100,platform:'twitch',
 user:{name:'Moss',username:'moss',color:'#3399AA',badges:[],
  ...(namePaint?{namePaint}:{})},
 parts:[{type:'text',text:'Hello chat'}],
});
const text=(row:HTMLElement)=>row.querySelector<HTMLElement>('.overlay-message-content')!;
const username=(row:HTMLElement)=>row.querySelector<HTMLElement>('[data-username-wrap]')!;

describe('independent chat text color and typography controls',()=>{
 it('preserves existing defaults and keeps the current message-size URL and presets intact',()=>{
  expect(DEFAULT_OPTIONS.font).toBe(20);
  expect(DEFAULT_OPTIONS.usernameSize).toBe(0);
  expect(DEFAULT_OPTIONS.textColorSource).toBe('theme');
  const controls=optionsForEditor('chat',false);
  expect(controls.find(x=>x.key==='font')?.label).toBe('Message text size');
  expect(controls.find(x=>x.key==='usernameSize')).toMatchObject({kind:'range',min:0,max:64});
  expect(controls.find(x=>x.key==='textColorSource')?.choices?.map(x=>x.value))
    .toEqual(['theme','user-color','name-paint']);
  expect(normalizeOptions({textColorSource:'javascript:alert(1)'}).textColorSource).toBe('theme');
  expect(normalizeOptions({usernameSize:999}).usernameSize).toBe(64);
  const custom=normalizeOptions({font:28,usernameSize:13,textColorSource:'user-color'});
  const query=writeOptions(custom,'chat');
  expect(query).toContain('font=28');
  expect(query).toContain('usernameSize=13');
  expect(query).toContain('textColorSource=user-color');
  expect(readOptions('?'+query,'chat')).toMatchObject({font:28,usernameSize:13,textColorSource:'user-color'});
  expect(writeOptions(custom,'wall')).not.toContain('usernameSize');
  expect(writeOptions(DEFAULT_OPTIONS,'chat')).not.toContain('usernameSize');
 });
 it('sizes username separately while default keeps the username inherited',()=>{
  const normal=createChatMessageElement(message(),{fontSize:32});
  expect(normal.style.fontSize).toBe('32px');
  expect(username(normal).style.fontSize).toBe('');
  const small=createChatMessageElement(message(),{fontSize:32,usernameSize:14});
  expect(small.style.fontSize).toBe('32px');
  expect(username(small).style.fontSize).toBe('14px');
  expect(text(small).style.fontSize).toBe('');
  const large=createChatMessageElement(message(),{fontSize:15,usernameSize:35,nameplateStyle:'floating'});
  expect(large.style.fontSize).toBe('15px');
  expect(username(large).style.fontSize).toBe('35px');
  expect(large.querySelector('.overlay-message-header')?.textContent).toContain('Moss');
 });
 it('keeps the floating notch shallow and inside the label padding even with a large username',()=>{
  const row=createChatMessageElement(message('notch'),{
    nameplateStyle:'floating',fontSize:12,usernameSize:40,messageOutline:3,
  });
  const h=row.querySelector<HTMLElement>('.overlay-message-header')!;
  h.style.paddingLeft='6px';
  h.style.paddingRight='6px';
  const ring=row.querySelector<HTMLElement>('[data-message-paint-outline]')!;
  Object.defineProperty(h,'getBoundingClientRect',{value:()=>({left:32,right:150,top:4,bottom:43,width:118,height:39})});
  Object.defineProperty(ring,'getBoundingClientRect',{value:()=>({left:0,right:250,top:0,bottom:120,width:250,height:120})});
  // Use the actual 6px header inset instead of cutting half the 40px
  // username size away from the top-left rounded corner. CSS ink clearance
  // follows the 3px outline, while the notch remains only 5px deep.
  syncFloatingNameplateNotch(row);
  expect(ring.style.clipPath).toContain('34px');
  expect(ring.style.clipPath).toContain('148px');
  expect(ring.style.clipPath).toContain('5px');
 });

 it('leaves message and paint color untouched by default but selects user color for text only',()=>{
  const normal=createChatMessageElement(message(),{textColorSource:'theme'});
  expect(text(normal).style.color).toBe('');
  expect(username(normal).querySelector('[data-username]')?.getAttribute('style')).toContain('color');
  const colored=createChatMessageElement(message(),{textColorSource:'user-color'});
  expect(text(colored).style.color).toBe('rgb(51, 153, 170)');
  expect(username(colored).querySelector<HTMLElement>('[data-username]')?.style.color).toBe('rgb(51, 153, 170)');
  expect(colored.style.color).toBe('');
 });
 it('shows the sanitized 7TV paint as message lettering, preserving original username paint',()=>{
  const row=createChatMessageElement(message('paint',gradient),{textColorSource:'name-paint'});
  expect(text(row).style.backgroundImage).toContain('linear-gradient(65deg');
  expect(text(row).style.backgroundImage).toContain('rgb(255, 51, 102)');
  expect(text(row).style.webkitTextFillColor).toBe('transparent');
  expect(text(row).style.backgroundClip).toBe('text');
  const label=row.querySelector<HTMLElement>('[data-username]')!;
  expect(label.style.backgroundImage).toContain('linear-gradient(65deg');
  expect(label.textContent).toBe('Moss');
 });
 it('keeps opacity and ordered 7TV v4 color layers when using name paint for text',()=>{
  const layered:DisplayNamePaint={id:'v4',provider:'7tv',layers:[
    {kind:'solid',color:0xff223344,opacity:1},
    {kind:'linear',angle:30,repeating:false,opacity:.4,stops:[
      {at:0,color:0xffff0000},{at:1,color:0xff00ff00},
    ]},
    {kind:'image',url:'javascript:alert(1)',opacity:.8},
  ]};
  const row=createChatMessageElement(message('v4',layered),{textColorSource:'name-paint'});
  const css=text(row).style.backgroundImage;
  expect(css).toContain('linear-gradient(30deg');
  expect(css).toContain('rgba(255, 0, 0, 0.4)');
  expect(css).toContain('rgba(0, 255, 0, 0.4)');
  expect(css).toContain('rgb(34, 51, 68)');
  expect(css).not.toContain('javascript:');
  expect(css.indexOf('linear-gradient(30deg')).toBeLessThan(css.indexOf('rgb(34, 51, 68)'));
 });

 it('uses fallback usercolor for a missing/unsafe paint and never injects URLs',()=>{
  const fallback=createChatMessageElement(message('no-paint'),{textColorSource:'name-paint'});
  expect(text(fallback).style.color).toBe('rgb(51, 153, 170)');
  const unsafe:DisplayNamePaint={id:'bad',provider:'7tv',gradients:[
    {function:'URL',imageUrl:'javascript:alert(1)',stops:[]},
  ]};
  const row=createChatMessageElement(message('unsafe',unsafe),{textColorSource:'name-paint'});
  expect(text(row).style.backgroundImage).not.toContain('javascript:');
  expect(text(row).style.color).toBe('rgb(51, 153, 170)');
  const invalid=message('invalid');invalid.user.color='red; background:url(https://evil.example)';
  const noColor=createChatMessageElement(invalid,{textColorSource:'user-color'});
  expect(text(noColor).style.color).toBe('');
 });
 it('updates existing live rows on settings changes and late 7TV paints without re-admitting messages',()=>{
  const root=document.createElement('div');
  const feed=createChatFeed(root,{fontSize:20,usernameSize:0,textColorSource:'name-paint',ttlMs:120000});
  feed.receive(message('live'));
  const row=root.querySelector<HTMLElement>('[data-message-id=live]')!;
  const started=feed.snapshot()[0]!.enteredAt;
  expect(text(row).style.color).toBe('rgb(51, 153, 170)');
  feed.updateIdentity('live',{badges:[],namePaint:gradient});
  expect(text(row).style.backgroundImage).toContain('linear-gradient(65deg');
  feed.configure({fontSize:25,usernameSize:11,textColorSource:'theme'});
  feed.refreshAppearance();
  expect(root.querySelector('[data-message-id=live]')).toBe(row);
  expect(row.style.fontSize).toBe('25px');
  expect(username(row).style.fontSize).toBe('11px');
  expect(text(row).style.backgroundImage).toBe('');
  expect(text(row).style.color).toBe('');
  expect(feed.snapshot()[0]!.enteredAt).toBe(started);
  feed.dispose();
 });
});
