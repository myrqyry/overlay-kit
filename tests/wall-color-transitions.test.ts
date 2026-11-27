import {afterEach,describe,expect,it,vi} from 'vitest';
import {createEmoteWall} from '../src/views';
import {DEFAULT_OPTIONS,normalizeOptions,readOptions,writeOptions,optionsForEditor} from '../src/options';
import type {DisplayMessage} from '../src/chatbus';
import {readFileSync} from 'node:fs';

const packet:DisplayMessage={
  id:'color-transition',timestamp:1700,user:{name:'Painter',badges:[]},
  parts:[{type:'emote',emote:{
    id:'flower',code:'Flower',url:'/sample/flower.svg',
    overlays:[{code:'hat',url:'/sample/hat.svg'}],modifiers:[],
  }}],
};
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});

describe('independent color-driven emote transitions',()=>{
 it('round-trips every choice as an existing Wall-only entrance/exit control',()=>{
  for(const entrance of ['color-bloom','prism-reveal','pigment-wash'] as const){
   const options=normalizeOptions({...DEFAULT_OPTIONS,wallEnter:entrance});
   expect(options.wallEnter).toBe(entrance);
   expect(readOptions('?'+writeOptions(options,'wall'),'wall').wallEnter).toBe(entrance);
   expect(writeOptions(options,'chat')).not.toContain('wallEnter');
  }
  for(const exit of ['color-drain','prism-dissolve','afterglow'] as const){
   const options=normalizeOptions({...DEFAULT_OPTIONS,wallExit:exit});
   expect(readOptions('?'+writeOptions(options,'wall'),'wall').wallExit).toBe(exit);
  }
  expect(optionsForEditor('wall',true).filter(x=>['wallEnter','wallExit'].includes(x.key)).length).toBe(2);
 });
 it('uses alpha-preserving original layered art, independent motion and aesthetic axes',()=>{
  const root=document.createElement('div');
  const wall=createEmoteWall(root,{
   motion:'orbit',wallEnter:'color-bloom',wallExit:'afterglow',
   wallStyle:'cut-paper',wallColor:'warm',wallFinish:'halo',
   wallEnterMs:500,wallExitMs:440,
  });
  expect(wall.receive(packet)).toBe(1);
  const item=root.querySelector<HTMLElement>('[data-wall-item]')!;
  const visual=item.querySelector<HTMLElement>('.overlay-wall-visual')!;
  expect(item.dataset.motion).toBe('orbit');
  expect(visual.dataset.wallEnter).toBe('color-bloom');
  expect(visual.dataset.wallExit).toBe('afterglow');
  expect(visual.style.getPropertyValue('--wall-enter-duration')).toBe('500ms');
  expect(visual.style.getPropertyValue('--wall-exit-duration')).toBe('440ms');
  expect(visual.querySelectorAll('[data-overlay-layer]')).toHaveLength(1);
  expect(root.dataset.wallColor).toBe('warm');
  expect(root.dataset.wallFinish).toBe('halo');
  expect(root.dataset.wallStyle).toBe('cut-paper');
  expect(visual.querySelectorAll('.overlay-wall-fragment,.overlay-wall-echo')).toHaveLength(0);
  wall.dispose();
  expect(root.childElementCount).toBe(0);
 });
 it('shows each color exit on expiry then releases visuals when its matching animation finishes',()=>{
  vi.useFakeTimers();
  for(const effect of ['color-drain','prism-dissolve','afterglow'] as const){
   const root=document.createElement('div');
   const wall=createEmoteWall(root,{ttlMs:100,wallExit:effect,wallExitMs:400});
   wall.receive({...packet,id:'exit-'+effect});
   vi.advanceTimersByTime(100);
   const visual=root.querySelector<HTMLElement>('.overlay-wall-visual')!;
   expect(visual?.dataset.wallPhase).toBe('exiting');
   expect(visual?.dataset.wallExit).toBe(effect);
   const fromEntrance=new Event('animationend',{bubbles:true});
   Object.defineProperty(fromEntrance,'animationName',{value:'wall-in-color-bloom'});
   visual.dispatchEvent(fromEntrance);
   expect(root.querySelector('[data-wall-item]')).not.toBeNull();
   const completed=new Event('animationend',{bubbles:true});
   Object.defineProperty(completed,'animationName',{value:'wall-out-'+effect});
   visual.dispatchEvent(completed);
   expect(root.querySelectorAll('[data-wall-item]')).toHaveLength(0);
   wall.dispose();
  }
 });
 it('moderation stays immediate, reduced motion skips transitions and fallback does not leak nodes',()=>{
  vi.useFakeTimers();
  const root=document.createElement('div');
  const wall=createEmoteWall(root,{ttlMs:100,wallEnter:'prism-reveal',wallExit:'color-drain',wallExitMs:350});
  wall.receive(packet);
  wall.removeMessage(packet.id);
  expect(root.querySelectorAll('.overlay-wall-visual')).toHaveLength(0);
  wall.receive({...packet,id:'expire'});
  vi.advanceTimersByTime(100);
  expect(root.querySelectorAll('.overlay-wall-visual')).toHaveLength(1);
  vi.advanceTimersByTime(451);
  expect(root.querySelectorAll('.overlay-wall-visual')).toHaveLength(0);
  wall.dispose();
  vi.stubGlobal('matchMedia',()=>({matches:true}));
  const reduced=document.createElement('div');
  const reducedWall=createEmoteWall(reduced,{ttlMs:100,wallEnter:'pigment-wash',wallExit:'prism-dissolve'});
  reducedWall.receive(packet);
  vi.advanceTimersByTime(100);
  expect(reduced.querySelectorAll('.overlay-wall-visual')).toHaveLength(0);
  reducedWall.dispose();
 });
 it('defines alpha-aware CSS keyframes, backward-only entrance filling, and reduced-motion suppression',()=>{
  const css=readFileSync('src/wall-motion.css','utf8');
  for(const name of ['color-bloom','prism-reveal','pigment-wash'])
    expect(css).toContain('@keyframes wall-in-'+name);
  for(const name of ['color-drain','prism-dissolve','afterglow'])
    expect(css).toContain('@keyframes wall-out-'+name);
  expect(css).toContain('filter:none');
  // Backwards fill removes the animation's filter completely after entrance;
  // 'both' would keep an identity filter chain on every resident emote.
  for(const name of ['color-bloom','prism-reveal','pigment-wash']){
    expect(css).toMatch(new RegExp('animation: wall-in-'+name+'[^;]*backwards;'));
  }
  expect(css).toContain('prefers-reduced-motion');
 });
});
