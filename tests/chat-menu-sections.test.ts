import {describe,it,expect} from 'vitest';
import {optionsForEditor} from '../src/options';

describe('chat inspector sections',()=>{
  it('separates layout, styling, and animation controls',()=>{
    const byKey=new Map(optionsForEditor('chat',true).map(option=>[option.key,option.section]));
    for(const key of ['chatLayout','align','vertical','spacing','padding'])
      expect(byKey.get(key as any)).toBe('Chat • Layout');
    for(const key of ['chatStyle','messageBackground','backgroundAlpha','messageOutline','radius'])
      expect(byKey.get(key as any)).toBe('Chat • Styling');
    for(const key of ['enter','enterMs','exit','exitMs','deleteEffect','deleteMs','letterEnter','letterEnterMs','letterExit','smoothReflow','reflowMs'])
      expect(byKey.get(key as any)).toBe('Chat • Animations');
    expect(optionsForEditor('chat',true).some(option=>String(option.section)==='Chat • Layout & style')).toBe(false);
  });
});
