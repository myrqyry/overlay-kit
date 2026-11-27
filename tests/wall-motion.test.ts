import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEmoteWall } from '../src/views';
import { DEFAULT_OPTIONS, normalizeOptions, optionsForEditor, readOptions, writeOptions } from '../src/options';
import type { DisplayMessage } from '../src/chatbus';

const packet:DisplayMessage = {
  id:'wall-test',timestamp:1700,user:{name:'Viewer',badges:[]},
  parts:[{type:'emote',emote:{
    id:'wide',code:'Wide',url:'/wide.svg',
    overlays:[{code:'overlay',url:'/overlay.svg'}],modifiers:[],
  }}],
};
afterEach(()=>{ vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('independent wall motion settings',()=>{
  it('persists spawn/loop/exit options in a wall-only source URL and presets',()=>{
    const options=normalizeOptions({...DEFAULT_OPTIONS,
      motion:'orbit',wallEnter:'pop',wallExit:'drift',wallEnterMs:440,wallExitMs:380,
      wallSpeed:1.35,wallDistance:61,
    });
    const query=writeOptions(options,'wall');
    expect(query).toContain('wallEnter=pop');
    expect(query).toContain('wallExit=drift');
    expect(query).not.toContain('letterEnter=');
    expect(readOptions('?'+query,'wall').motion).toBe('orbit');
    expect(readOptions('?'+query,'wall').wallExitMs).toBe(380);
    expect(normalizeOptions({wallExitMs:12000}).wallExitMs).toBeLessThanOrEqual(1500);
    expect(optionsForEditor('wall',true).map(x=>x.key))
      .toEqual(expect.arrayContaining(['wallEnter','wallExit','wallEnterMs','wallExitMs']));
    expect(optionsForEditor('chat',true).map(x=>x.key)).not.toContain('wallExit');
  });

  it('keeps motion speed and travel distance directly under the motion choice',()=>{
    const movement=optionsForEditor('wall',true)
      .filter(option=>option.section==='Wall • Movement')
      .map(option=>option.key);
    const motionIndex=movement.indexOf('motion');
    expect(movement.slice(motionIndex,motionIndex+3))
      .toEqual(['motion','wallSpeed','wallDistance']);
  });

  it('keeps entrance and exit durations directly beside the transition they control',()=>{
    const movement=optionsForEditor('wall',true)
      .filter(option=>option.section==='Wall • Movement')
      .map(option=>option.key);
    const enterIndex=movement.indexOf('wallEnter');
    const exitIndex=movement.indexOf('wallExit');
    expect(movement.slice(enterIndex,enterIndex+2)).toEqual(['wallEnter','wallEnterMs']);
    expect(movement.slice(exitIndex,exitIndex+2)).toEqual(['wallExit','wallExitMs']);
    expect(movement.indexOf('wallField')).toBeGreaterThan(exitIndex);
    expect(movement.indexOf('wallChorus')).toBeGreaterThan(exitIndex);
  });

  it('uses independent visuals for one-shot entrance/exit while outer motion loops',()=>{
    const root=document.createElement('div');
    const wall=createEmoteWall(root,{
      motion:'orbit',wallSpeed:1.5,wallDistance:60,
      wallEnter:'pop',wallExit:'drift',wallEnterMs:420,wallExitMs:300,
    });
    expect(wall.receive(packet)).toBe(1);
    const entity=root.querySelector<HTMLElement>('[data-wall-item]')!;
    const visual=entity.querySelector<HTMLElement>('.overlay-wall-visual')!;
    expect(entity.dataset.motion).toBe('orbit');
    expect(entity.querySelectorAll('[data-overlay-layer]')).toHaveLength(1);
    expect(visual.dataset.wallEnter).toBe('pop');
    expect(visual.dataset.wallExit).toBe('drift');
    expect(visual.style.getPropertyValue('--wall-enter-duration')).toBe('420ms');
    expect(entity.style.getPropertyValue('--wall-period')).toBe('4.666666666666667s');
    expect(entity.style.width).toBe('max-content');
    expect(visual.style.width).toBe('max-content');
    wall.dispose();
    expect(root.childElementCount).toBe(0);
  });

  it('retains expiring sprites through a real exit phase but releases logical capacity',()=>{
    vi.useFakeTimers();
    const root=document.createElement('div');
    const wall=createEmoteWall(root,{ttlMs:100,maxActive:1,wallExit:'shrink',wallExitMs:240});
    wall.receive(packet);
    vi.advanceTimersByTime(100);
    expect(wall.snapshot()).toHaveLength(0);
    const visual=root.querySelector<HTMLElement>('.overlay-wall-visual')!;
    expect(visual.dataset.wallPhase).toBe('exiting');
    expect(visual.dataset.wallExit).toBe('shrink');
    const ignored=new Event('animationend',{bubbles:true});
    Object.defineProperty(ignored,'animationName',{value:'wall-in-pop'});
    visual.dispatchEvent(ignored);
    expect(root.childElementCount).toBe(1);
    const completed=new Event('animationend',{bubbles:true});
    Object.defineProperty(completed,'animationName',{value:'wall-out-shrink'});
    visual.dispatchEvent(completed);
    expect(root.childElementCount).toBe(0);
    vi.advanceTimersByTime(800);
    wall.dispose();
  });

  it('removes moderation/deleted immediately and animates capacity victims',()=>{
    vi.useFakeTimers();
    const root=document.createElement('div');
    const wall=createEmoteWall(root,{maxActive:1,ttlMs:100,wallExit:'drift'});
    wall.receive(packet);
    wall.removeMessage(packet.id);
    expect(root.childElementCount).toBe(0);
    wall.receive(packet);
    vi.advanceTimersByTime(100);
    expect(root.childElementCount).toBe(1);
    wall.clear();
    expect(root.childElementCount).toBe(0);
    expect(wall.receive({...packet,id:'new'})).toBe(1);
    expect(wall.receive({...packet,id:'newer'})).toBe(1);
    expect(root.childElementCount).toBe(2);
    expect(root.querySelector('[data-wall-item="new:emote:0"] .overlay-wall-visual')?.getAttribute('data-wall-phase')).toBe('exiting');
    wall.dispose();
  });

  it('cleans up on animation fallback and reduced-motion preference',()=>{
    vi.useFakeTimers();
    const root=document.createElement('div');
    const wall=createEmoteWall(root,{ttlMs:50,wallExit:'spin',wallExitMs:200});
    wall.receive(packet);
    vi.advanceTimersByTime(50);
    expect(root.childElementCount).toBe(1);
    vi.advanceTimersByTime(300);
    expect(root.childElementCount).toBe(0);
    wall.dispose();
    vi.stubGlobal('matchMedia',()=>({matches:true}));
    const reduced=document.createElement('div');
    const wallReduced=createEmoteWall(reduced,{ttlMs:50,wallExit:'spin'});
    wallReduced.receive(packet);
    vi.advanceTimersByTime(50);
    expect(reduced.childElementCount).toBe(0);
    wallReduced.dispose();
  });

  it('repositions existing art when newly selected paths need safe-edge travel room',()=>{
    const root=document.createElement('div');
    Object.defineProperty(root,'clientWidth',{value:400});
    Object.defineProperty(root,'clientHeight',{value:300});
    const wall=createEmoteWall(root,{motion:'still',spawn:'edges',size:48});
    wall.receive(packet);
    const item=root.firstElementChild as HTMLElement;
    Object.defineProperty(item,'offsetWidth',{value:60});
    Object.defineProperty(item,'offsetHeight',{value:48});
    wall.configure({motion:'orbit',wallDistance:60});
    const left=parseFloat(item.style.left);
    const top=parseFloat(item.style.top);
    expect(left).toBeGreaterThanOrEqual(60);
    expect(left).toBeLessThanOrEqual(280);
    expect(top).toBeGreaterThanOrEqual(60);
    expect(top).toBeLessThanOrEqual(192);
    wall.dispose();
  });

  it('updates continuing movement in-place and does not replace existing artwork',()=>{
    const root=document.createElement('div');
    const wall=createEmoteWall(root,{motion:'float',wallEnter:'pop'});
    wall.receive(packet);
    const old=root.firstElementChild;
    wall.configure({motion:'sway',wallSpeed:2,wallDistance:30});
    expect(root.firstElementChild).toBe(old);
    const entity=root.firstElementChild as HTMLElement;
    expect(entity.dataset.motion).toBe('sway');
    expect(entity.style.getPropertyValue('--wall-distance')).toBe('30px');
    expect(entity.style.getPropertyValue('--wall-period')).toBe('3.5s');
    wall.dispose();
  });
});
