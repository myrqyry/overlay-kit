import {describe,expect,it} from 'vitest';
import {createUserAdmissionFilter,normalizeIgnoredUsers} from '../src/admission';
import type {OverlayLiveEvent} from '../src/live';

const message=(username:string,name=username):OverlayLiveEvent=>({
  type:'message',
  message:{id:'m-'+username,timestamp:1,user:{username,name,badges:[]},parts:[{type:'text',text:'hi'}]},
});

describe('explicit username admission filter',()=>{
  it('normalizes comma/newline lists, @ prefixes, case and duplicates into a bounded stable value',()=>{
    expect(normalizeIgnoredUsers(' @NightBot, cloudCAT\nnightbot ;  StreamElements '))
      .toBe('nightbot,cloudcat,streamelements');
    expect(normalizeIgnoredUsers('x'.repeat(600))).toBe('');
  });

  it('rejects matching message authors case-insensitively without swallowing moderation/control events',()=>{
    const filter=createUserAdmissionFilter('nightbot, @CloudCat');
    expect(filter.accept(message('NightBot'))).toBe(false);
    expect(filter.accept(message('cloudcat','CloudCat'))).toBe(false);
    expect(filter.accept(message('human'))).toBe(true);
    expect(filter.accept({type:'delete',messageId:'m-nightbot'})).toBe(true);
    expect(filter.accept({type:'clear'})).toBe(true);
  });

  it('falls back to display name only when a normalized username is absent',()=>{
    const filter=createUserAdmissionFilter('previewbot');
    expect(filter.accept({
      type:'message',
      message:{id:'preview',timestamp:1,user:{name:'PreviewBot',badges:[]},parts:[]},
    })).toBe(false);
  });
});
