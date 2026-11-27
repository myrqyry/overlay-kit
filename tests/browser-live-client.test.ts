import {afterEach,describe,expect,it,vi} from 'vitest';
import {normalizeTwitchIrcFrame,parseTwitchIrcLine,normalizeKickEvent} from '@myrqyry/chatbus';
import {connectBrowserLiveSource,getPreferredLiveCapability} from '../src/browser-live-client';
import type {LiveSource} from '../server/hub';
afterEach(()=>vi.unstubAllGlobals());
describe('browser-only Overlay Kit',()=>{
 it('uses explicit static mode without contacting a nonexistent relay',async()=>{
  const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
  expect(await getPreferredLiveCapability(true)).toEqual({mode:'browser',platform:'twitch',platforms:['twitch','kick','youtube'],channel:null});
  expect(fetcher).not.toHaveBeenCalled();
 });
 it('does not contact YouTube or any relay without an explicitly configured browser key',()=>{
  const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
  const status=vi.fn();
  const handle=connectBrowserLiveSource(vi.fn(),status,undefined,{platform:'youtube',channel:'jfKfPfyJRdk'});
  expect(status).toHaveBeenCalledWith(expect.objectContaining({state:'error',error:expect.stringMatching(/API key/i)}));
  expect(fetcher).not.toHaveBeenCalled();
  handle.dispose();
 });
 it('keeps the existing server discovery in normal builds',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json({service:'overlay-kit-live',mode:'local',platforms:['twitch','kick','youtube']})));
  expect(await getPreferredLiveCapability(false)).toMatchObject({mode:'local',websocketPath:'/live'});
 });
 it('renders namespaced Kick messages from the shared browser transport',()=>{
  let deliver:Parameters<LiveSource['connect']>[0]['onEvent'];
  const close=vi.fn();
  const source:LiveSource={connect(options){expect(options.platform).toBe('kick');deliver=options.onEvent;options.onStateChange?.('connected');return {close};},emotes:async()=>({emotes:{},complete:true})};
  const events=vi.fn();
  const handle=connectBrowserLiveSource(events,vi.fn(),undefined,{platform:'kick',channel:'example'},source);
  const event=normalizeKickEvent({type:'ChatMessage',data:{id:'kick1',chatroom_id:42,content:'Hello [emote:37226:KEKW]',created_at:'2026-11-26T12:00:00Z',sender:{id:7,username:'Viewer'}}},{channelName:'example',channelId:'42'})!;
  deliver!(event);
  expect(events).toHaveBeenCalledWith(expect.objectContaining({type:'message',message:expect.objectContaining({sourceId:'kick:example',id:'kick:example:kick1',parts:expect.arrayContaining([expect.objectContaining({type:'emote'})])})}));
  handle.dispose();
  expect(close).toHaveBeenCalledOnce();
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
