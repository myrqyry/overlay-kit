import { afterEach, describe, expect, it, vi } from 'vitest';
import { advanceWallCollisions, createWallCollisions, type CollisionBody } from '../src/wall-collisions';
import { createEmoteWall } from '../src/views';
import { DEFAULT_OPTIONS, normalizeOptions, readOptions, writeOptions, OPTION_DEFINITIONS } from '../src/options';
import type { DisplayMessage } from '../src/chatbus';

const packet=(id:string):DisplayMessage=>({
  id, timestamp:1, user:{name:id,badges:[]},
  parts:[{type:'emote',emote:{id,code:'Wide',url:'/wide.svg',overlays:[{code:'layer',url:'/layer.svg'}],modifiers:[]}}],
});
const body=(x:number,y:number,vx:number,vy:number,width=28,height=28):CollisionBody=>({x,y,vx,vy,width,height});
const originalRaf=globalThis.requestAnimationFrame;
const originalCancel=globalThis.cancelAnimationFrame;
afterEach(()=>{
  vi.unstubAllGlobals();vi.restoreAllMocks();vi.useRealTimers();
  globalThis.requestAnimationFrame=originalRaf;
  globalThis.cancelAnimationFrame=originalCancel;
});

function frameClock(){
  let id=0;
  const pending=new Map<number,FrameRequestCallback>();
  const cancel=vi.fn((n:number)=>{pending.delete(n);});
  vi.stubGlobal('requestAnimationFrame',(callback:FrameRequestCallback)=>{pending.set(++id,callback);return id;});
  vi.stubGlobal('cancelAnimationFrame',cancel);
  return{
    pending:()=>pending.size,
    cancel,
    step(time:number){const tasks=[...pending.values()];pending.clear();for(const task of tasks)task(time);},
  };
}

describe('deterministic collision solver',()=>{
  it('rebounds at all edges, respecting actual rectangular width/height',()=>{
    const a=body(78,2,120,-80,30,20);
    advanceWallCollisions([a],100,80,.05);
    expect(a.x).toBe(70);
    expect(a.vx).toBeLessThan(0);
    expect(a.y).toBe(0);
    expect(a.vy).toBeGreaterThan(0);
  });
  it('separates overlapping sprites and exchanges closing velocities',()=>{
    const a=body(30,20,60,0,30,20),b=body(61,20,-60,0,30,20);
    advanceWallCollisions([a,b],200,100,.05);
    expect(a.x+a.width).toBeLessThanOrEqual(b.x+.01);
    expect(a.vx).toBeLessThan(0);
    expect(b.vx).toBeGreaterThan(0);
    expect(a.y).toBe(20);
    expect(b.y).toBe(20);
  });
  it('handles coincident starts, tiny viewports, nonsquare art, and long time gaps without NaNs',()=>{
    const bodies=[
      body(0,0,30,50,50,15),body(0,0,-10,-60,23,45),body(0,0,3,7,55,55),
    ];
    for(let i=0;i<50;i++)advanceWallCollisions(bodies,40,30,60);
    for(const a of bodies){
      expect(Number.isFinite(a.x+a.y+a.vx+a.vy)).toBe(true);
      expect(a.x).toBeGreaterThanOrEqual(0);
      expect(a.y).toBeGreaterThanOrEqual(0);
      expect(a.x).toBeLessThanOrEqual(Math.max(0,40-a.width));
      expect(a.y).toBeLessThanOrEqual(Math.max(0,30-a.height));
    }
  });
  it('is deterministic from the same bodies and inputs',()=>{
    const first=[body(30,30,60,20),body(48,38,-35,-22),body(100,110,-5,7)];
    const second=first.map(x=>({...x}));
    for(let n=0;n<30;n++){
      advanceWallCollisions(first,300,200,1/60);
      advanceWallCollisions(second,300,200,1/60);
    }
    expect(second).toEqual(first);
  });
});

describe('emote wall collision path and lifecycle',()=>{
  it('roundtrips an opt-in Collision motion through wall URLs and manifest, without changing default motion',()=>{
    expect(DEFAULT_OPTIONS.motion).toBe('float');
    const normalized=normalizeOptions({...DEFAULT_OPTIONS,motion:'collide',wallSpeed:1.75});
    expect(normalized.motion).toBe('collide');
    const url=writeOptions(normalized,'wall');
    expect(url).toContain('motion=collide');
    expect(readOptions('?'+url,'wall').motion).toBe('collide');
    expect(writeOptions(normalized,'chat')).not.toContain('motion=');
    expect(OPTION_DEFINITIONS.find(x=>x.key==='motion')?.choices)
      .toContainEqual({value:'collide',label:'Collision'});
  });

  it('advances collision entities using compositor translate with preserved layered artwork',()=>{
    const clock=frameClock();
    const root=document.createElement('div');
    Object.defineProperties(root,{clientWidth:{value:400},clientHeight:{value:280}});
    const wall=createEmoteWall(root,{motion:'collide',maxActive:3,ttlMs:60000,
      wallStyle:'cut-paper',wallColor:'soft',wallFinish:'halo',wallEnter:'pop'});
    wall.receive(packet('first'));
    wall.receive(packet('second'));
    const items=Array.from(root.querySelectorAll<HTMLElement>('.overlay-wall-item'));
    expect(items).toHaveLength(2);
    for(const item of items){
      Object.defineProperties(item,{offsetWidth:{value:50},offsetHeight:{value:45}});
    }
    wall.configure({spawn:'full'}); // dimension-aware positioning and tracking
    clock.step(0);
    clock.step(16);
    expect(items[0]!.dataset.motion).toBe('collide');
    expect(items[0]!.style.translate).toMatch(/px.*px/);
    expect(items[0]!.querySelectorAll('[data-overlay-layer]')).toHaveLength(1);
    expect(items[0]!.querySelector('.overlay-wall-visual')?.getAttribute('data-wall-enter')).toBe('pop');
    expect(root.dataset.wallStyle).toBe('cut-paper');
    expect(root.dataset.wallColor).toBe('soft');
    expect(root.dataset.wallFinish).toBe('halo');
    expect(clock.pending()).toBe(1);
    wall.dispose();
    expect(clock.pending()).toBe(0);
    expect(items[0]!.style.translate).toBe('');
    expect(root.childElementCount).toBe(0);
  });

  it('preserves one loop while enabled, transitions to other paths/constellation and back without residual translate',()=>{
    const clock=frameClock();
    const root=document.createElement('div');
    Object.defineProperties(root,{clientWidth:{value:400},clientHeight:{value:280}});
    const wall=createEmoteWall(root,{motion:'float',maxActive:3,ttlMs:60000});
    wall.receive(packet('first'));
    const item=root.firstElementChild as HTMLElement;
    Object.defineProperties(item,{offsetWidth:{value:50},offsetHeight:{value:45}});
    expect(clock.pending()).toBe(0); // unchanged default CSS path has no physics RAF
    wall.configure({motion:'collide',wallSpeed:2});
    expect(item.dataset.motion).toBe('collide');
    clock.step(16);
    clock.step(32);
    expect(item.style.translate).not.toBe('');
    expect(clock.pending()).toBe(1);
    wall.configure({wallField:'constellation'});
    expect(item.dataset.motion).toBe('still');
    expect(item.style.translate).toBe('');
    expect(clock.pending()).toBe(0);
    wall.configure({wallField:'none'});
    clock.step(48);
    expect(clock.pending()).toBe(1);
    wall.configure({motion:'orbit'});
    expect(item.dataset.motion).toBe('orbit');
    expect(item.style.translate).toBe('');
    expect(clock.pending()).toBe(0);
    wall.configure({motion:'collide'});
    clock.step(64);
    expect(clock.pending()).toBe(1);
    wall.removeMessage('first');
    expect(clock.pending()).toBe(0);
    wall.dispose();
  });


  it('holds the last collision position through natural exit instead of snapping to spawn',()=>{
    vi.useFakeTimers();
    const clock=frameClock();
    const root=document.createElement('div');
    Object.defineProperties(root,{clientWidth:{value:400},clientHeight:{value:240}});
    const wall=createEmoteWall(root,{motion:'collide',ttlMs:100,wallExit:'fade',wallExitMs:400});
    wall.receive(packet('expiring'));
    const item=root.querySelector<HTMLElement>('[data-wall-item]')!;
    Object.defineProperties(item,{offsetWidth:{value:60},offsetHeight:{value:48}});
    wall.configure({spawn:'full'});
    clock.step(16);
    clock.step(32);
    const position=item.style.translate;
    expect(position).not.toBe('');
    vi.advanceTimersByTime(100);
    expect(item.querySelector('.overlay-wall-visual')?.getAttribute('data-wall-phase')).toBe('exiting');
    expect(item.style.translate).toBe(position);
    expect(clock.pending()).toBe(0);
    const visual=item.querySelector('.overlay-wall-visual')!;
    const finished=new Event('animationend',{bubbles:true});
    Object.defineProperty(finished,'animationName',{value:'wall-out-fade'});
    visual.dispatchEvent(finished);
    expect(root.childElementCount).toBe(0);
    wall.dispose();
    expect(clock.pending()).toBe(0);
  });

  it('halts on reduced motion and resumes when the preference changes; no orphaned frame',()=>{
    const clock=frameClock();
    let reduced=false;
    let change:((event:Event)=>void)|undefined;
    vi.stubGlobal('matchMedia',()=>({
      get matches(){return reduced;},
      addEventListener(_key:string,fn:(event:Event)=>void){change=fn;},
      removeEventListener:vi.fn(),
    }));
    const root=document.createElement('div');
    Object.defineProperties(root,{clientWidth:{value:300},clientHeight:{value:200}});
    const field=createWallCollisions(root);
    const item=document.createElement('div');
    Object.defineProperties(item,{offsetWidth:{value:40},offsetHeight:{value:40},offsetLeft:{value:30},offsetTop:{value:30}});
    root.append(item);
    field.track('a',item);
    field.setEnabled(true);
    clock.step(16);
    expect(clock.pending()).toBe(1);
    reduced=true;change?.(new Event('change'));
    expect(clock.pending()).toBe(0);
    expect(item.style.translate).toBe('');
    reduced=false;change?.(new Event('change'));
    expect(clock.pending()).toBe(1);
    field.dispose();
    expect(clock.pending()).toBe(0);
  });
});
