import {describe,expect,it} from 'vitest';
import {DEFAULT_OPTIONS,normalizeOptions,optionsForEditor,readOptions,writeOptions} from '../src/options';
import {createEmoteWall} from '../src/views';
import {applyWallAesthetics,WALL_COLOR_CHOICES,WALL_FINISH_CHOICES} from '../src/wall-aesthetics';
import type {DisplayMessage} from '../src/chatbus';

const message=(id:string):DisplayMessage=>({
 id,timestamp:1700,user:{name:'Viewer',badges:[]},parts:[{type:'emote',emote:{
  id,code:'smile',url:'/emote.png',overlays:[],modifiers:[],
 }}],
});

describe('independent visual choices for emote wall',()=>{
  it('provides a diverse collection of color and edge choices independent from material and motion',()=>{
    expect(WALL_COLOR_CHOICES.map(x=>x.value)).toEqual(['original','soft','vivid','monochrome','warm']);
    expect(WALL_FINISH_CHOICES.map(x=>x.value)).toEqual(['none','halo','relief']);
    expect(DEFAULT_OPTIONS.wallColor).toBe('original');
    expect(DEFAULT_OPTIONS.wallFinish).toBe('none');
    const wall=optionsForEditor('wall',false);
    expect(wall.find(x=>x.key==='wallColor')?.choices).toEqual(WALL_COLOR_CHOICES);
    expect(wall.find(x=>x.key==='wallFinish')?.choices).toEqual(WALL_FINISH_CHOICES);
    expect(optionsForEditor('chat',true).some(x=>x.key==='wallColor'||x.key==='wallFinish')).toBe(false);
  });
  it('roundtrips mixable aesthetics in wall URLs and saved presets but not chat URLs',()=>{
    for(const wallStyle of ['original','cut-paper','ink-wash','holo-foil'] as const) {
      for(const wallColor of ['original','vivid','monochrome'] as const) {
        for(const wallFinish of ['none','halo','relief'] as const){
          const settings=normalizeOptions({wallStyle,wallColor,wallFinish,motion:'orbit'});
          const query=writeOptions(settings,'wall');
          expect(readOptions('?'+query,'wall')).toMatchObject({wallStyle,wallColor,wallFinish,motion:'orbit'});
          expect(writeOptions(settings,'chat')).not.toMatch(/wallColor=|wallFinish=|wallStyle=/);
        }
      }
    }
    expect(normalizeOptions({wallColor:'url(javascript:evil)',wallFinish:'glitch-attack'}))
      .toMatchObject({wallColor:'original',wallFinish:'none'});
  });
  it('applies combination changes to existing emotes without recreating scene nodes',()=>{
    const root=document.createElement('div');
    const wall=createEmoteWall(root,{maxActive:5,wallStyle:'cut-paper',wallColor:'soft',wallFinish:'halo'});
    wall.receive(message('first'));
    const emote=root.querySelector('.overlay-emote');
    const visual=root.querySelector('.overlay-wall-visual');
    expect(root.dataset).toMatchObject({wallStyle:'cut-paper',wallColor:'soft',wallFinish:'halo'});
    wall.configure({wallStyle:'ink-wash',wallColor:'monochrome',wallFinish:'relief'});
    expect(root.querySelector('.overlay-emote')).toBe(emote);
    expect(root.querySelector('.overlay-wall-visual')).toBe(visual);
    expect(root.dataset).toMatchObject({wallStyle:'ink-wash',wallColor:'monochrome',wallFinish:'relief'});
    expect(root.querySelectorAll('[data-wall-ink-resource]')).toHaveLength(1);
    expect(wall.snapshot()).toHaveLength(1);
    wall.configure({wallColor:'vivid',wallFinish:'none'});
    expect(root.dataset.wallColor).toBe('vivid');
    expect(root.dataset.wallFinish).toBe('none');
    expect(root.dataset.wallStyle).toBe('ink-wash');
    wall.dispose();
    expect(root.hasAttribute('data-wall-color')).toBe(false);
    expect(root.hasAttribute('data-wall-finish')).toBe(false);
    expect(root.hasAttribute('data-wall-style')).toBe(false);
    expect(root.querySelectorAll('[data-wall-ink-resource]')).toHaveLength(0);
    expect(root.childElementCount).toBe(0);
  });
  it('sanitizes direct API values and cleans only its own appearance attributes',()=>{
    const root=document.createElement('div');root.dataset.wallStyle='cut-paper';
    const first=applyWallAesthetics(root,'vivid','halo');
    expect(root.dataset.wallColor).toBe('vivid');
    expect(root.dataset.wallFinish).toBe('halo');
    first.dispose();
    expect(root.dataset.wallStyle).toBe('cut-paper');
    expect(root.dataset.wallColor).toBeUndefined();
    const next=applyWallAesthetics(root,'url(foo)' as never,'evil' as never);
    expect(root.dataset.wallColor).toBe('original');
    expect(root.dataset.wallFinish).toBe('none');
    next.dispose();
  });
});
