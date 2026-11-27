import {describe,expect,it} from 'vitest';
import {bestBadgeImageUrl} from '../src/badge-images';
import {fromChatbus} from '../src/chatbus';
import {createChatMessageElement} from '../src/renderers';

describe('high-density badge images and aspect-safe resizing',()=>{
 it('selects real highest-resolution badge asset by scale rather than input order',()=>{
  const images=[
   {url:'https://static-cdn.jtvnw.net/badges/v1/abc/1',scale:1},
   {url:'https://static-cdn.jtvnw.net/badges/v1/abc/2',scale:2},
   {url:'https://static-cdn.jtvnw.net/badges/v1/abc/3',scale:4},
  ];
  expect(bestBadgeImageUrl(images)).toBe(images[2]!.url);
  expect(bestBadgeImageUrl([images[0]!,images[1]!])).toBe(images[1]!.url);
  expect(bestBadgeImageUrl([images[0]!])).toBe(images[0]!.url);
 });
 it('uses declared image widths for other providers and preserves originals with no size hints',()=>{
  const images=[{url:'https://example.net/badge-small.png',width:18},
                {url:'https://example.net/badge-big.png',width:72}];
  expect(bestBadgeImageUrl(images)).toBe(images[1]!.url);
  expect(bestBadgeImageUrl([{url:'https://example.net/custom.svg'}])).toBe('https://example.net/custom.svg');
  expect(bestBadgeImageUrl([])).toBeUndefined();
  expect(bestBadgeImageUrl([{url:'https://example.net/first.svg'},{url:'https://example.net/second.svg'}]))
    .toBe('https://example.net/first.svg');
 });
 it('preserves high-density badge source through Chatbus projection and browser DOM',()=>{
  const message=fromChatbus({
   id:'high-dpi',timestamp:1,user:{username:'viewer',
    badges:[{id:'mod',provider:'twitch',name:'Moderator',images:[
     {url:'https://static-cdn.jtvnw.net/badges/v1/mod/1',scale:1},
     {url:'https://static-cdn.jtvnw.net/badges/v1/mod/3',scale:4}
    ]}]},fragments:[{type:'text',text:'hello'}],
  });
  expect(message.user.badges[0]?.url).toBe('https://static-cdn.jtvnw.net/badges/v1/mod/3');
  const row=createChatMessageElement(message,{showBadges:true,fontSize:30});
  expect(row.querySelector<HTMLImageElement>('.overlay-badge')?.src).toBe('https://static-cdn.jtvnw.net/badges/v1/mod/3');
  expect(row.querySelector<HTMLImageElement>('.overlay-badge')?.alt).toBe('Moderator');
 });
});
