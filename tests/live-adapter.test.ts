import { describe, expect, it } from 'vitest';
import type { ChatEvent } from '@myrqyry/chatbus';
import { fromChatbusEvent } from '../src/live';

const emote = (code: string, id: string, url: string, extra: Record<string, unknown> = {}) =>
 ({ code, id, url, provider: '7tv' as const, zeroWidth: false, ...extra });
const msg = {
 id:'twitch-msg-1', platform:'twitch' as const, channelName:'tester',
 timestamp:1770000000000, user: {
   platform:'twitch' as const, id:'u-44', username:'example', displayName:'Example',
   color:'#ff99aa', badges:[{ id:'mod', provider:'twitch' as const, scope:'channel' as const,
      name:'Moderator', images:[{url:'https://example.test/mod1.png',width:18}, {url:'https://example.test/mod2.png',width:36}] }],
 },
 text:'Hi Cat Hat', fragments:[
   {type:'text' as const,text:'Hi '},
   {type:'emote' as const,text:'Cat',
      emote:emote('Cat','c1','https://example.test/cat.webp'),
      overlays:[emote('Hat','h1','https://example.test/hat.webp',{zeroWidth:true})],
      modifiers:[emote('Glow','g1','https://example.test/glow.webp',{modifier:'hidden',modifierFlags:8})],
   },
 ]};
describe('real Chatbus ChatEvent projection', () => {
 it('preserves real typed badge images, native IDs, stacked art and modifier flags', () => {
   const event: ChatEvent = { type:'message', platform:'twitch', timestamp:msg.timestamp, message:msg };
   const projected = fromChatbusEvent(event);
   expect(projected).toMatchObject({type:'message', message:{
      id:'twitch-msg-1',user:{name:'Example',id:'u-44',username:'example',
        badges:[{name:'Moderator',url:'https://example.test/mod2.png'}]},
      parts:[{type:'text',text:'Hi '},{type:'emote',emote:{
        id:'c1',url:'https://example.test/cat.webp',
        overlays:[{code:'Hat',url:'https://example.test/hat.webp'}],
        modifiers:[{code:'Glow',flags:8}],
      }}],
   }});
 });
 it('maps moderation deletion and clear/timeout events without inventing chat messages', () => {
   expect(fromChatbusEvent({type:'message-delete',platform:'twitch',timestamp:1,data:{messageId:'deleted'}}))
      .toEqual({type:'delete',messageId:'deleted'});
   expect(fromChatbusEvent({type:'system',platform:'twitch',timestamp:1,data:{kind:'chat-clear'}}))
      .toEqual({type:'clear'});
   expect(fromChatbusEvent({type:'user-timeout',platform:'twitch',timestamp:1,
      user:{platform:'twitch',id:'u-44',username:'example'}})).toEqual({type:'user-clear',userId:'u-44',username:'example'});
   expect(fromChatbusEvent({type:'room-state',platform:'twitch',timestamp:1})).toBeNull();
 });
 it('never forwards transport raw data or user-provided HTML', () => {
   const event: ChatEvent={type:'message',platform:'twitch',timestamp:1,message:{...msg,
      raw:{secret:'no'},fragments:[{type:'text',text:'<script>doBadStuff()</script>'}]}};
   const projected=fromChatbusEvent(event);
   expect(JSON.stringify(projected)).not.toContain('no');
   expect(projected).toMatchObject({type:'message',message:{parts:[{type:'text',text:'<script>doBadStuff()</script>'}]}});
 });
});

describe('shared normalized Chatbus event/identity contract',()=>{
 it('preserves message traits, reply relationships, roles and 7TV paint without raw provider payloads',()=>{
  const input:ChatEvent={type:'message',platform:'twitch',timestamp:120,message:{
    ...msg,traits:{highlighted:true,firstMessage:true},reply:{
      parentMessageId:'parent-1',parentUsername:'other',parentMessageBody:'Hi',
    },user:{...msg.user,roles:['moderator'],namePaint:{
      id:'p1',provider:'7tv',color:0xff2266aa,
      gradients:[{function:'LINEAR_GRADIENT',angle:15,stops:[
        {at:0,color:0xff224488},{at:1,color:0xff889922},
      ]}],
      raw:{secret:'keep-server-only'},
    }},raw:{secret:'no-raw-message'},
  }};
  const projected=fromChatbusEvent(input);
  expect(projected).toMatchObject({type:'message',message:{
    platform:'twitch',traits:{highlighted:true,firstMessage:true},
    reply:{parentMessageId:'parent-1',parentUsername:'other'},
    user:{roles:['moderator'],namePaint:{id:'p1',provider:'7tv',color:0xff2266aa,
      gradients:[{angle:15,stops:[{at:0,color:0xff224488},{at:1,color:0xff889922}]}]}},
  }});
  expect(JSON.stringify(projected)).not.toContain('keep-server-only');
  expect(JSON.stringify(projected)).not.toContain('no-raw-message');
 });
 it('offers Chatbus social event signals for non-chat events without fake chat rows',async()=>{
  const {fromChatbusSignal}=await import('../src/live');
  const signal=fromChatbusSignal({type:'raid',platform:'twitch',timestamp:140,
    user:{platform:'twitch',id:'44',username:'raider'},data:{count:37,rawSecret:'never'}},145);
  expect(signal).toMatchObject({type:'signal',signal:{
    schemaVersion:1,producer:'chatbus',
    event:{type:'raid',occurredAtMs:140,receivedAtMs:145},
    actor:{username:'raider'},measurements:{count:37},
  }});
  expect(JSON.stringify(signal)).not.toContain('never');
 });
});
