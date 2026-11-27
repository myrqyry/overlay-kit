import { describe, expect, it, vi } from 'vitest';
import type { BadgeRef } from '@myrqyry/chatbus';
import { createTwitchBadgeCatalog } from '../server/twitch-badges';

const raw = (set: string, version: string, suffix: string) =>
  ({set_id:set,versions:[{id:version,title:set+' '+version,
    image_url_1x:'https://static-cdn.jtvnw.net/badges/v1/'+suffix+'/1',
    image_url_2x:'https://static-cdn.jtvnw.net/badges/v1/'+suffix+'/2'}]});
const refs:BadgeRef[] = [
  {provider:'twitch',id:'moderator',version:'1'},
  {provider:'twitch',id:'subscriber',version:'12'},
  {provider:'twitch',id:'vip',version:'1'},
];
describe('anonymous Twitch badge catalogs',()=>{
 it('fetches global and room-id-scoped sets, resolves exact version in IRC order and channel overrides',async()=>{
  const requested:string[]=[];
  const catalog=createTwitchBadgeCatalog(async url=>{
    requested.push(url);
    return url.includes('global')
     ? [raw('moderator','1','global-mod'),raw('subscriber','12','global-sub')]
     : [raw('subscriber','12','channel-sub'),raw('vip','1','channel-vip')];
  });
  const refresh=vi.fn();
  await Promise.all([catalog.loadGlobal(refresh),catalog.loadChannel('71092938',refresh)]);
  const badges=catalog.resolve(refs);
  expect(badges.map(b=>[b.id,b.version,b.images[0]?.url])).toEqual([
   ['moderator','1','https://static-cdn.jtvnw.net/badges/v1/global-mod/1'],
   ['subscriber','12','https://static-cdn.jtvnw.net/badges/v1/channel-sub/1'],
   ['vip','1','https://static-cdn.jtvnw.net/badges/v1/channel-vip/1'],
  ]);
  expect(requested).toContain('https://api.ivr.fi/v2/twitch/badges/channel?id=71092938');
  await Promise.all([catalog.loadGlobal(refresh),catalog.loadChannel('71092938',refresh)]);
  expect(requested).toHaveLength(2);
 });
 it('rejects invalid/wrong-version and unsafe asset catalog entries without creating fake badges',async()=>{
  const catalog=createTwitchBadgeCatalog(async()=>[
    raw('subscriber','6','good'),
    {set_id:'bad',versions:[{id:'1',image_url_1x:'javascript:alert(1)'}]},
    {set_id:'modified',versions:[{id:'1',image_url_1x:'https://evil.example/badge'}]},
  ]);
  await catalog.loadGlobal(()=>{});
  expect(catalog.resolve([{provider:'twitch',id:'subscriber',version:'12'}])).toEqual([]);
  expect(catalog.resolve([{provider:'twitch',id:'bad',version:'1'},{provider:'twitch',id:'modified',version:'1'}])).toEqual([]);
 });
 it('isolates failed global/channel fetches while retaining successfully loaded sets',async()=>{
  let callsChannel=0;
  const catalog=createTwitchBadgeCatalog(async url => {
    if(url.includes('channel')) {
      callsChannel++;
      throw new Error('offline');
    }
    return [raw('moderator','1','mod')];
  });
  await Promise.all([catalog.loadGlobal(()=>{}),catalog.loadChannel('123',()=>{})]);
  expect(catalog.health()).toBe('degraded');
  expect(catalog.resolve(refs).map(x=>x.id)).toEqual(['moderator']);
  // Hot IRC rooms can deliver hundreds of messages/second. A failed
  // optional channel lookup must never trigger one HTTP request per message.
  for(let i=0;i<50;i++)await catalog.loadChannel('123',()=>{});
  expect(callsChannel).toBe(1);
 });
});
