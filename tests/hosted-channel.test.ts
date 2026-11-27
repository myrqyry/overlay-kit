import {describe,expect,it,vi} from 'vitest';
import {hostedChannel} from '../server/hosted-channel';
describe('hosted channel selection',()=>{
 it('ships only the channel selected in the last verified local relay as a no-secret fallback',()=>{
  vi.stubEnv('OVERLAY_TWITCH_CHANNEL',undefined);
  expect(hostedChannel()).toBe('xqc');
  vi.stubEnv('OVERLAY_TWITCH_CHANNEL','another_channel');
  expect(hostedChannel()).toBe('another_channel');
  vi.stubEnv('OVERLAY_TWITCH_CHANNEL','');
  expect(hostedChannel()).toBe('');
  vi.unstubAllEnvs();
 });
});
