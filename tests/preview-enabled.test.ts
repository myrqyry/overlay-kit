import {describe,expect,it} from 'vitest';
import {DEFAULT_PREVIEW_ENABLED,restorePreviewEnabled} from '../src/preview-enabled';

describe('preview activation defaults',()=>{
  const wanted={wall:true,chat:true,avatars:false,events:false};
  it('starts only Emote Wall and Chat on a fresh browser',()=>{
    expect(DEFAULT_PREVIEW_ENABLED).toEqual(wanted);
    expect(restorePreviewEnabled(null)).toEqual(wanted);
  });
  it('keeps saved true/false choices including Avatars and Events',()=>{
    expect(restorePreviewEnabled(JSON.stringify({
      wall:false,chat:false,avatars:true,events:true,
    }))).toEqual({wall:false,chat:false,avatars:true,events:true});
  });
  it('applies defaults to incomplete or malformed saved records',()=>{
    expect(restorePreviewEnabled(JSON.stringify({avatars:true,events:0,chat:'false'})))
      .toEqual({...wanted,avatars:true});
    expect(restorePreviewEnabled('{bad')).toEqual(wanted);
    expect(restorePreviewEnabled('null')).toEqual(wanted);
  });
});
