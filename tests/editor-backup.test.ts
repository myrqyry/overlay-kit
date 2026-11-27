import {describe,expect,it} from 'vitest';
import {DEFAULT_OPTIONS,normalizeOptions} from '../src/options';
import {createEditorBackup,parseEditorBackup} from '../src/editor-backup';

describe('whole-editor user settings backup',()=>{
  it('round-trips all four overlay settings, active overlay and per-overlay user presets',()=>{
    const settings={
      wall:normalizeOptions({...DEFAULT_OPTIONS,wallSize:72}),
      chat:normalizeOptions({...DEFAULT_OPTIONS,font:34}),
      avatars:normalizeOptions({...DEFAULT_OPTIONS,avatarsMax:31}),
      events:normalizeOptions({...DEFAULT_OPTIONS,eventDuration:11}),
    };
    const presets={
      wall:{Soft:normalizeOptions({...DEFAULT_OPTIONS,motion:'float'})},
      chat:{Compact:normalizeOptions({...DEFAULT_OPTIONS,max:12})},
      avatars:{Crowd:normalizeOptions({...DEFAULT_OPTIONS,avatarsMax:40})},
      events:{Top:normalizeOptions({...DEFAULT_OPTIONS,eventPosition:'top'})},
    };
    const backup=createEditorBackup(settings,presets,'chat');
    expect(backup).toMatchObject({
      version:1,
      kind:'overlay-kit-user-settings',
      activeView:'chat',
      settings:{wall:{wallSize:72},chat:{font:34},avatars:{avatarsMax:31},events:{eventDuration:11}},
    });
    const restored=parseEditorBackup(JSON.parse(JSON.stringify(backup)));
    expect(restored).toEqual(backup);
  });

  it('rejects partial or wrong-kind files instead of silently treating them as a single-overlay preset',()=>{
    expect(()=>parseEditorBackup({version:1,settings:{font:30}})).toThrow(/all user settings/i);
    expect(()=>parseEditorBackup({
      version:1,kind:'overlay-kit-user-settings',activeView:'wall',
      settings:{wall:{},chat:{},avatars:{}},presets:{wall:{},chat:{},avatars:{},events:{}},
    })).toThrow(/overlay settings/i);
  });
});
