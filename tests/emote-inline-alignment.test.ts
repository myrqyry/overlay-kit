// @vitest-environment jsdom
import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createChatMessageElement,createEmoteArtwork} from '../src/renderers';
import type {DisplayMessage,EmoteArtwork} from '../src/chatbus';

const artwork=(code:string,provider='7tv'):EmoteArtwork=>({
 id:code,code,url:'https://cdn.example/'+code+'.webp',provider,modifiers:[],overlays:[],
});
const display=(id:string,parts:DisplayMessage['parts']):DisplayMessage=>({
 id,timestamp:1,user:{name:'chatter',badges:[]},parts,
});

describe('chat artwork sits just above typographic text-bottom without shifting row structure',()=>{
 it('aligns an emote at the end of normal text without changing its requested height',()=>{
  const row=createChatMessageElement(display('suffix',[
    {type:'text',text:'no dog disease '},{type:'emote',emote:artwork('pepe')},
  ]),{fontSize:29,emoteSize:36});
  const emote=row.querySelector<HTMLElement>('.overlay-message-content .overlay-emote')!;
  expect(emote.style.verticalAlign).toBe('-0.12em');
  expect(emote.style.height).toBe('36px');
  expect(emote.querySelector<HTMLImageElement>('img')?.style.width).toBe('auto');
  expect(row.querySelector('.overlay-message-content')?.textContent).toContain('no dog disease');
 });
 it('aligns emotes that form their own chat line, including FFZ modifier stacks',()=>{
  const layered={...artwork('animated'),modifiers:[{code:'shake',flags:8192}]};
  const row=createChatMessageElement(display('alone',[
    {type:'text',text:'text above\n'},{type:'emote',emote:layered},
  ]),{fontSize:31,emoteSize:40});
  const el=row.querySelector<HTMLElement>('.overlay-message-content .overlay-emote')!;
  expect(el.style.verticalAlign).toBe('-0.12em');
  expect(el.style.height).toBe('40px');
  expect(el.querySelector('[data-ffz-effect]')).not.toBeNull();
 });
 it('aligns rendered unicode emoji artwork as well as provider emotes',()=>{
  const emoji=createEmoteArtwork({
    id:'unicode',code:'💜',url:'',provider:'unicode-emoji',emojiService:'twemoji',
    modifiers:[],overlays:[],
  },34,'-0.12em');
  expect(emoji.style.verticalAlign).toBe('-0.12em');
  expect(emoji.dataset.unicodeEmoji).toBe('twemoji');
 });
 it('raises badge artwork gently without rebuilding or resizing the username row',()=>{
  const row=createChatMessageElement({
    id:'badge-baseline',timestamp:1,platform:'twitch',
    user:{name:'Moss',color:'#44ccaa',badges:[
      {name:'Partner',provider:'twitch',url:'https://cdn.example/partner.svg'},
      {name:'Source avatar',provider:'twitch-source',url:'https://cdn.example/avatar.png',color:'#3399ee'},
    ]},
    parts:[{type:'text',text:'hello'}],
  },{fontSize:26,usernameSize:34,showPlatformBadges:true});
  const header=row.querySelector<HTMLElement>('.overlay-message-header')!;
  const name=header.querySelector<HTMLElement>('[data-username]')!;
  expect(header.contains(name)).toBe(true);
  expect(header.querySelectorAll('.overlay-badge')).toHaveLength(2);
  const css=readFileSync(resolve(import.meta.dirname,'../demo/styles.css'),'utf8');
  expect(css).toMatch(/\.overlay-message-header\s*\{[^}]*align-items:\s*center;/);
  expect(css).toMatch(/\.overlay-badge\s*\{[^}]*top:\s*-\.08em;/);
  expect(css).toMatch(/\.overlay-badge\s*\{[^}]*vertical-align:\s*middle;/);
  expect(css).toMatch(/\.overlay-service-badge\s*\{[^}]*top:\s*-\.12em;/);
  // Portrait rings and badge dimensions must not be traded for alignment.
  expect(css).toContain('box-shadow:0 0 0 .07em var(--avatar-ring-color');
  expect(css).toContain('object-fit: contain');
  expect(css).toContain('height: 1em; width: auto;');
 });

 it('leaves standalone emote-wall artwork centered (chat-only change)',()=>{
  expect(createEmoteArtwork(artwork('wall'),54).style.verticalAlign).toBe('middle');
  const unicode=createEmoteArtwork({
    id:'unicode',code:'💜',url:'',provider:'unicode-emoji',emojiService:'twemoji',
    modifiers:[],overlays:[],
  },54);
  expect(unicode.style.verticalAlign).toBe('middle');
 });
});
