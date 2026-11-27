import {describe,expect,it} from 'vitest';
import {normalizeViewerChannel,normalizeViewerPlatform,readViewerSources,restoreHostedViewerSources,withViewerChannel,withViewerSource,withViewerSources} from '../src/channel-choice';

describe('independent hosted chat channel choices',()=>{
 it('validates Twitch channel names and normalizes copy/pasted # prefixes',()=>{
  expect(normalizeViewerChannel(' #Some_Channel ')).toBe('some_channel');
  expect(normalizeViewerChannel(' alpha ')).toBe('alpha');
  for(const invalid of ['', '#', 'channel-name!', 'http://example.com', 'a'.repeat(26),'white space']){
    expect(normalizeViewerChannel(invalid)).toBeNull();
  }
 });
 it('adds one canonical channel parameter to each OBS URL, preserving visuals and preview flags',()=>{
  const url=withViewerChannel('wall.html?preview=1&wallStyle=cut-paper&channel=old','Other');
  expect(url).toBe('wall.html?preview=1&wallStyle=cut-paper&channel=other');
  expect(withViewerChannel('chat.html?layout=strip','new_ch')).toBe('chat.html?layout=strip&channel=new_ch');
  expect(withViewerChannel('chat.html?channel=old','')).toBe('chat.html');
 });
 it('keeps Twitch as the legacy default and carries Kick explicitly in source URLs',()=>{
  expect(normalizeViewerPlatform(undefined)).toBe('twitch');
  expect(normalizeViewerPlatform('KICK')).toBe('kick');
  expect(normalizeViewerPlatform('YouTube')).toBe('youtube');
  expect(normalizeViewerChannel(' xqc ','kick')).toBe('xqc');
  expect(normalizeViewerChannel(' dQw4w9WgXcQ ','youtube')).toBe('dQw4w9WgXcQ');
  expect(normalizeViewerChannel('https://www.youtube.com/watch?v=dQw4w9WgXcQ','youtube')).toBe('dQw4w9WgXcQ');
  expect(withViewerSource('wall.html?preview=1&platform=twitch&channel=old','kick','XQC'))
    .toBe('wall.html?preview=1&channel=xqc&platform=kick');
  expect(withViewerSource('chat.html?layout=strip&platform=kick&channel=xqc','twitch','Some_Channel'))
    .toBe('chat.html?layout=strip&channel=some_channel');
  expect(withViewerSource('chat.html?layout=stack','youtube','https://youtu.be/dQw4w9WgXcQ'))
    .toBe('chat.html?layout=stack&channel=dQw4w9WgXcQ&platform=youtube');
 });
 it('roundtrips a mixed source set while retaining legacy one-source URLs',()=>{
  const mixed=withViewerSources('chat.html?layout=strip&platform=kick&channel=old',[
    {platform:'twitch',channel:'Alpha'},
    {platform:'youtube',channel:'https://youtu.be/dQw4w9WgXcQ'},
  ]);
  const url=new URL(mixed,'https://overlay.test/');
  expect(url.searchParams.get('platform')).toBeNull();
  expect(url.searchParams.get('channel')).toBeNull();
  expect(url.searchParams.getAll('source')).toEqual(['twitch:alpha','youtube:dQw4w9WgXcQ']);
  expect(readViewerSources(url.search)).toEqual([
    {platform:'twitch',channel:'alpha'},
    {platform:'youtube',channel:'dQw4w9WgXcQ'},
  ]);
  expect(readViewerSources('?platform=kick&channel=XQC')).toEqual([{platform:'kick',channel:'xqc'}]);
 });

 it('encodes removing the last source as live disabled, rather than an implicit default room',()=>{
  expect(withViewerSources('chat.html?preview=1&source=kick:old',[])).toBe('chat.html?preview=1&live=0');
  expect(withViewerSources('wall.html?live=0&preview=1',[{platform:'kick',channel:'new'}])).toBe('wall.html?preview=1&source=kick%3Anew');
 });
 it('keeps an explicitly saved empty source set disconnected on reload',()=>{
  const fallback={platform:'twitch' as const,channel:'default_room'};
  const legacy={platform:'kick' as const,channel:'old'};
  expect(restoreHostedViewerSources('[]',legacy,fallback,['twitch','kick'])).toEqual([]);
  expect(restoreHostedViewerSources(null,null,fallback,['twitch','kick'])).toEqual([fallback]);
  expect(restoreHostedViewerSources(null,legacy,fallback,['twitch','kick'])).toEqual([legacy]);
  expect(restoreHostedViewerSources(JSON.stringify([legacy]),null,fallback,['twitch'])).toEqual([]);
 });

});
