import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEmoteWall } from '../src/views';
import type { DisplayMessage } from '../src/chatbus';

const packet=(id:string,user='Viewer'): DisplayMessage => ({
  id, timestamp:1700, user:{ name:user, username:user.toLowerCase(), badges:[] },
  parts:[{ type:'emote', emote:{
    id:'wide',code:'Wide',url:'/wide.svg',
    overlays:[{code:'layer',url:'/layer.svg'}],modifiers:[],
  }}],
});
function finishCSS(visual:HTMLElement, effect:string) {
  const end=new Event('animationend',{bubbles:true});
  Object.defineProperty(end,'animationName',{value:'wall-out-'+effect});
  visual.dispatchEvent(end);
}
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});

describe('Wall capacity eviction uses selected exit animation',()=>{
  it('fades the oldest on overflow while immediately making room for incoming art',()=>{
    const root=document.createElement('div');
    const wall=createEmoteWall(root,{maxActive:1,ttlMs:20_000,wallExit:'fade',wallExitMs:500});
    expect(wall.receive(packet('first'))).toBe(1);
    expect(wall.receive(packet('second'))).toBe(1);
    expect(wall.snapshot().map(item=>item.id)).toEqual(['second:emote:0']);
    const departing=root.querySelector<HTMLElement>('[data-wall-item="first:emote:0"]')!;
    expect(departing).not.toBeNull();
    const visual=departing.querySelector<HTMLElement>('.overlay-wall-visual')!;
    expect(visual.dataset.wallPhase).toBe('exiting');
    expect(visual.dataset.wallExit).toBe('fade');
    expect(root.querySelectorAll('[data-wall-item]')).toHaveLength(2);
    finishCSS(visual,'fade');
    expect(root.querySelectorAll('[data-wall-item]')).toHaveLength(1);
    expect(root.querySelector('[data-wall-item="second:emote:0"]')).not.toBeNull();
    wall.dispose();
  });

  it('animates a real shatter on capacity eviction, not just TTL expiry',()=>{
    const root=document.createElement('div');
    const wall=createEmoteWall(root,{maxActive:1,ttlMs:20_000,wallExit:'shatter',wallExitMs:600});
    wall.receive(packet('first'));
    wall.receive(packet('second'));
    const old=root.querySelector<HTMLElement>('[data-wall-item="first:emote:0"]')!;
    const fragments=old?.querySelectorAll('.overlay-wall-fragment');
    expect(old?.querySelector('.overlay-wall-visual')?.getAttribute('data-wall-phase')).toBe('exiting');
    expect(fragments).toHaveLength(9);
    expect(fragments?.[0]?.querySelectorAll('img')).toHaveLength(2);
    expect(wall.snapshot()).toHaveLength(1);
    wall.dispose();
    expect(root.childElementCount).toBe(0);
  });

  it('bounds outgoing DOM during heavy overflow bursts, retaining newest live emotes',()=>{
    vi.useFakeTimers();
    const root=document.createElement('div');
    const wall=createEmoteWall(root,{maxActive:2,ttlMs:20_000,wallExit:'sink',wallExitMs:700});
    for(let i=0;i<45;i++){
      wall.receive(packet('burst-'+i));
      expect(wall.snapshot()).toHaveLength(Math.min(2,i+1));
      expect(root.querySelectorAll('[data-wall-item]').length).toBeLessThanOrEqual(4);
    }
    expect(wall.snapshot().map(item=>item.id))
      .toEqual(['burst-43:emote:0','burst-44:emote:0']);
    const departing=root.querySelectorAll('[data-wall-phase="exiting"]');
    expect(departing).toHaveLength(2);
    vi.advanceTimersByTime(900);
    expect(root.querySelectorAll('[data-wall-item]')).toHaveLength(2);
    wall.dispose();
    expect(root.childElementCount).toBe(0);
  });

  it('applies exits when the maximum is decreased through configure',()=>{
    const root=document.createElement('div');
    const wall=createEmoteWall(root,{maxActive:3,ttlMs:20_000,wallExit:'drift'});
    ['a','b','c'].forEach(id=>wall.receive(packet(id)));
    wall.configure({maxActive:1});
    expect(wall.snapshot().map(item=>item.id)).toEqual(['c:emote:0']);
    expect(root.querySelectorAll('[data-wall-phase="exiting"]')).toHaveLength(1);
    // Lower maximum also lowers the bounded outgoing budget.
    expect(root.querySelectorAll('[data-wall-item]')).toHaveLength(2);
    wall.dispose();
  });

  it('moderation and clear immediately delete capacity-exiting art and its timelines',()=>{
    const root=document.createElement('div');
    const wall=createEmoteWall(root,{maxActive:1,ttlMs:20_000,wallExit:'shatter'});
    wall.receive(packet('a'));
    wall.receive(packet('b'));
    expect(root.querySelectorAll('.overlay-wall-fragment')).toHaveLength(9);
    wall.removeMessage('a');
    expect(root.querySelectorAll('[data-wall-item="a:emote:0"]')).toHaveLength(0);
    expect(root.querySelectorAll('.overlay-wall-fragment')).toHaveLength(0);
    wall.receive(packet('c'));
    expect(root.querySelectorAll('.overlay-wall-fragment')).toHaveLength(9);
    wall.removeUser({username:'viewer'});
    expect(root.querySelectorAll('[data-wall-item]')).toHaveLength(0);
    wall.receive(packet('d'));
    wall.receive(packet('e'));
    wall.clear();
    expect(root.childElementCount).toBe(0);
    wall.dispose();
  });

  it('does not retire any art when overflow policy is drop-new',()=>{
    const root=document.createElement('div');
    const wall=createEmoteWall(root,{maxActive:1,ttlMs:20_000,overflow:'drop-new',wallExit:'fade'});
    wall.receive(packet('old'));
    expect(wall.receive(packet('new'))).toBe(0);
    expect(root.querySelectorAll('[data-wall-phase="exiting"]')).toHaveLength(0);
    expect(wall.snapshot().map(item=>item.id)).toEqual(['old:emote:0']);
    wall.dispose();
  });

  it('removes capacity victims immediately with reduced motion or no exit',()=>{
    vi.stubGlobal('matchMedia',()=>({matches:true}));
    const root=document.createElement('div');
    const wall=createEmoteWall(root,{maxActive:1,wallExit:'shatter'});
    wall.receive(packet('old'));
    wall.receive(packet('new'));
    expect(root.querySelectorAll('[data-wall-item]')).toHaveLength(1);
    expect(root.querySelectorAll('[data-wall-phase="exiting"]')).toHaveLength(0);
    wall.dispose();
  });
});
