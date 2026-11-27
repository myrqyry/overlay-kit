// @vitest-environment node
import {describe,expect,it,vi} from 'vitest';
import {createTwitchViewerAvatarLookup} from '../server/twitch-viewer-avatars';

describe('bounded Twitch chatter avatar lookups',()=>{
 it('deduplicates normalized logins and caches successful lookups',async()=>{
  const load=vi.fn(async name=>'https://static-cdn.jtvnw.net/jtv_user_pictures/'+name+'.png');
  const queue=createTwitchViewerAvatarLookup(load);
  const a=queue.get('Viewer'),b=queue.get('viewer');
  expect(a).toBe(b);
  const url=await a;
  expect(await queue.get('VIEWER')).toBe(url);
  expect(load).toHaveBeenCalledOnce();
  expect(load).toHaveBeenCalledWith('viewer');
  expect(await queue.get('invalid-user!')).toBeNull();
  expect(load).toHaveBeenCalledOnce();
  queue.close();
 });
 it('bounds parallel remote requests and queue length; closes pending work',async()=>{
  const pending:((value:string|null)=>void)[]=[];
  const load=vi.fn(()=>new Promise<string|null>(resolve=>pending.push(resolve)));
  const queue=createTwitchViewerAvatarLookup(load);
  const tasks=Array.from({length:53},(_,i)=>queue.get('viewer'+i));
  await vi.waitFor(()=>expect(load).toHaveBeenCalledTimes(3));
  expect(await tasks[51]).toBeNull();
  expect(await tasks[52]).toBeNull();
  queue.close();
  const queued=await Promise.all(tasks.slice(3,51));
  expect(queued.every(x=>x===null)).toBe(true);
  for(const finish of pending)finish(null);
  expect((await Promise.all(tasks.slice(0,3))).every(x=>x===null)).toBe(true);
  await vi.waitFor(()=>expect(load).toHaveBeenCalledTimes(3));
 });
});
