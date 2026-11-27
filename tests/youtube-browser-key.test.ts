import {afterEach,describe,it,expect,vi} from 'vitest';
import {readBrowserYouTubeApiKey,saveBrowserYouTubeApiKey,forgetBrowserYouTubeApiKey,YOUTUBE_KEY_STORAGE} from '../src/youtube-browser-key';
import {createYouTubeKeyControls} from '../demo/youtube-key-controls';
import {createParentPreviewPackets} from '../src/browser-preview-packets';
const fixture='AIza'+'FixtureKeyForTestingOnly012345678901';
afterEach(()=>localStorage.clear());
describe('browser-only YouTube credentials',()=>{
 it('stores only explicit, syntactically plausible keys locally and supports forgetting',()=>{
  expect(readBrowserYouTubeApiKey()).toBeUndefined();
  expect(()=>saveBrowserYouTubeApiKey('bad key')).toThrow();
  saveBrowserYouTubeApiKey(fixture);
  expect(readBrowserYouTubeApiKey()).toBe(fixture);
  expect(localStorage.getItem(YOUTUBE_KEY_STORAGE)).toBe(fixture);
  forgetBrowserYouTubeApiKey();
  expect(readBrowserYouTubeApiKey()).toBeUndefined();
 });
 it('never pre-fills a stored key or adds it to an anchor or form action',()=>{
  saveBrowserYouTubeApiKey(fixture);
  const root=document.createElement('div');createYouTubeKeyControls(root);
  expect(root.querySelector('input')?.type).toBe('password');
  expect(root.querySelector('input')?.value).toBe('');
  expect(root.innerHTML).not.toContain(fixture);
 });
 it('only forwards live preview packets from the owning same-origin parent to active sources',()=>{
  const source={platform:'youtube' as const,channel:'jfKfPfyJRdk'};
  const receive=vi.fn();
  const registry=createParentPreviewPackets(window,'https://example.test');
  const handle=registry.open(source,receive);
  const data={type:'overlay-kit-preview-live-packet',source,packet:{type:'status',value:{state:'connected'}}};
  registry.receive(new MessageEvent('message',{source:window,origin:'https://elsewhere.test',data}));
  expect(receive).not.toHaveBeenCalled();
  registry.receive(new MessageEvent('message',{source:window,origin:'https://example.test',data}));
  expect(receive).toHaveBeenCalledOnce();
  handle.dispose();
  registry.receive(new MessageEvent('message',{source:window,origin:'https://example.test',data}));
  expect(receive).toHaveBeenCalledOnce();
 });
});
