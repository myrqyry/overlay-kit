import {describe, expect, it} from 'vitest';
import {fromChatbus} from '../src/chatbus';
import {createEmoteArtwork} from '../src/renderers';

describe('FFZ modifier presentation', () => {
  const art = (flags:number) => ({
    id:'base',code:'Base',url:'https://example.org/base.webp',
    overlays:[{code:'Hat',url:'https://example.org/hat.webp'}],
    modifiers:[{code:'Effect',flags}],
  });

  it('keeps hidden modifier images out of the stack while composing independent effects', () => {
    const flags=1|2|4|8|2048|4096|8192|16384|32768|65536;
    const element=createEmoteArtwork(art(flags),48);
    expect(element.querySelectorAll('img')).toHaveLength(2);
    expect(element.dataset.modifierFlags).toBe(String(flags));
    expect(Array.from(element.querySelectorAll('[data-ffz-effect]')).map(
      node=>node.getAttribute('data-ffz-effect'),
    )).toEqual(['grow-x','flip','hyper-shake','jam','bounce','rainbow','hyper-red','cursed']);
    expect(element.querySelector('[data-ffz-effect="flip"]')?.getAttribute('data-flip')).toBe('xy');
    expect(element.querySelector('img[data-overlay-layer]')).not.toBeNull();
  });

  it('does not wrap an unmodified emote or alter its intrinsic aspect ratio', () => {
    const element=createEmoteArtwork({
      id:'wide',code:'Wide',url:'/wide.webp',overlays:[],modifiers:[],
    },56);
    expect(element.querySelectorAll('[data-ffz-effect]')).toHaveLength(0);
    expect(element.querySelector('img')?.style.width).toBe('auto');
    expect(element.style.width).toBe('max-content');
  });

  it('preserves modifier flags on visible overlay layers and ignores unknown bits', () => {
    const message=fromChatbus({
      id:'one',timestamp:5,user:{username:'viewer'},fragments:[{
        type:'emote',text:'Base',emote:{id:'base',code:'Base',url:'/base.webp'},
        overlays:[{id:'overlay',code:'Hat',url:'/hat.webp',modifierFlags:1|2|2048}],
      }],
    });
    const part=message.parts[0];
    expect(part?.type).toBe('emote');
    if(part?.type!=='emote')return;
    expect(part.emote.overlays[0]).toMatchObject({flags:1|2|2048});
    const element=createEmoteArtwork(part.emote);
    expect(element.querySelectorAll('img')).toHaveLength(1);
    expect(element.querySelectorAll('[data-ffz-effect]')).toHaveLength(2);
    const unknown=createEmoteArtwork(art(1<<20));
    expect(unknown.dataset.modifierFlags).toBe(String(1<<20));
    expect(unknown.querySelectorAll('[data-ffz-effect]')).toHaveLength(0);
  });

  it('lets a lone modifier emote render normally, without applying its effect', () => {
    const message=fromChatbus({id:'one',timestamp:5,user:{username:'viewer'},fragments:[{
      type:'modifier',text:'ffzRainbow',
      emote:{id:'rainbow',code:'ffzRainbow',url:'/rainbow.webp',modifierFlags:2049},
    }]});
    const part=message.parts[0];
    if(part?.type!=='emote')throw Error('Expected standalone emote');
    const element=createEmoteArtwork(part.emote);
    expect(element.querySelectorAll('img')).toHaveLength(1);
    expect(element.querySelectorAll('[data-ffz-effect]')).toHaveLength(0);
  });

  it('reserves doubled intrinsic width after loading the base for GrowX', () => {
    const element=createEmoteArtwork(art(1|8),48);
    const base=element.querySelector('img')!;
    Object.defineProperties(base,{naturalWidth:{value:60},naturalHeight:{value:30}});
    base.dispatchEvent(new Event('load'));
    expect(element.style.width).toBe('192px');
  });
});
