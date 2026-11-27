import {afterEach,describe,expect,it,vi} from 'vitest';
import {normalizeTwitchIrcFrame,parseTwitchIrcLine} from '@myrqyry/chatbus';
import {connectBrowserLiveSource,getPreferredLiveCapability} from '../src/browser-live-client';
import type {LiveSource} from '../server/hub';
afterEach(()=>vi.unstubAllGlobals());
describe('browser-only Overlay Kit',()=>{
 it('uses explicit static mode without contacting a nonexistent relay',async()=>{
  const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
  expect(await getPreferredLiveCapability(true)).toEqual({mode:'browser',platform:'twitch',platforms:['twitch'],channel:null});
  expect(fetcher).not.toHaveBeenCalled();
 });
 it('keeps the existing server discovery in normal builds',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json({service:'overlay-kit-live',mode:'local',platforms:['twitch','kick','youtube']})));
  expect(await getPreferredLiveCapability(false)).toMatchObject({mode:'local',websocketPath:'/live'});
 });
 it('shares the existing mixer projection, namespace and disposal',()=>{
  let deliver:Parameters<LiveSource['connect']>[0]['onEvent'];
  const close=vi.fn();
  const source:LiveSource={connect(options){deliver=options.onEvent;options.onStateChange?.('connected');return {close};},emotes:async()=>({emotes:{},complete:true})};
  const events=vi.fn(),status=vi.fn(),signal=vi.fn();
  const handle=connectBrowserLiveSource(events,status,signal,{platform:'twitch',channel:'example'},source);
  const event=normalizeTwitchIrcFrame(parseTwitchIrcLine('@id=real;display-name=Viewer;user-id=1 :viewer!v@v PRIVMSG #example :Hello')!,{channel:'example',fallbackId:'fallback'})!;
  deliver!(event);
  expect(events).toHaveBeenCalledWith(expect.objectContaining({type:'message',message:expect.objectContaining({sourceId:'twitch:example',id:'twitch:example:real'})}));
  expect(status).toHaveBeenCalledWith(expect.objectContaining({state:'connected'}));
  handle.dispose();
  expect(close).toHaveBeenCalledOnce();
  events.mockClear();deliver!(event);expect(events).not.toHaveBeenCalled();
 });
});
