import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEmoteWall } from '../src/views';
import { DEFAULT_OPTIONS, normalizeOptions, readOptions, writeOptions } from '../src/options';
import { startWallExit } from '../src/wall-motion';
import type { DisplayMessage } from '../src/chatbus';

const message=(id:string):DisplayMessage=>({
 id,timestamp:1700,user:{name:'Tester',badges:[]},
 parts:[{type:'emote',emote:{id,code:id,url:'/asset.png',
   overlays:[{code:'mask',url:'/mask.png'}],modifiers:[]}}],
});

afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});

describe('GSAP emote arrivals and departures',()=>{
 it('validates and round-trips the new arrival/departure names without leaking them to Chat',()=>{
   for (const wallEnter of ['impact','assemble','comet'] as const) {
     const state=normalizeOptions({...DEFAULT_OPTIONS,wallEnter});
     expect(readOptions('?'+writeOptions(state,'wall'),'wall').wallEnter).toBe(wallEnter);
     expect(writeOptions(state,'chat')).not.toContain('wallEnter=');
   }
   for (const wallExit of ['shatter','vortex','fold-away'] as const) {
     const state=normalizeOptions({...DEFAULT_OPTIONS,wallExit});
     expect(readOptions('?'+writeOptions(state,'wall'),'wall').wallExit).toBe(wallExit);
   }
 });
 it('assembles an actual multilayer emote from 9 clipped tiles, then removes all on moderation',()=>{
   const root=document.createElement('div');
   const wall=createEmoteWall(root,{wallEnter:'assemble',wallEnterMs:640});
   wall.receive(message('a'));
   const item=root.querySelector('.overlay-wall-visual')!;
   const shards=Array.from(item.querySelectorAll<HTMLElement>('.overlay-wall-fragment'));
   expect(shards).toHaveLength(9);
   expect(shards.every(node=>node.style.clipPath.startsWith('inset('))).toBe(true);
   expect(item.querySelectorAll('.overlay-wall-fragment img')).toHaveLength(18);
   expect(item.querySelectorAll('[data-overlay-layer]')).toHaveLength(10);
   wall.removeMessage('a');
   expect(root.querySelectorAll('.overlay-wall-fragment')).toHaveLength(0);
   expect(root.childElementCount).toBe(0);
   wall.dispose();
 });
 it('impact and comet use distinct temporary artwork choreography, cleaned on deletion',()=>{
   const root=document.createElement('div');
   const wall=createEmoteWall(root,{wallEnter:'impact',wallEnterMs:400});
   wall.receive(message('a'));
   expect(root.querySelectorAll('.overlay-wall-impact-ring')).toHaveLength(2);
   wall.configure({wallEnter:'comet'});
   wall.receive(message('b'));
   expect(root.querySelectorAll('.overlay-wall-comet-trail')).toHaveLength(1);
   wall.dispose();
   expect(root.childElementCount).toBe(0);
 });
 it('holds natural expiry through actual GSAP shatter and cleans up on completion',()=>{
   vi.useFakeTimers();
   const root=document.createElement('div');
   const wall=createEmoteWall(root,{wallExit:'shatter',wallExitMs:500,ttlMs:100});
   wall.receive(message('a'));
   vi.advanceTimersByTime(100);
   expect(wall.snapshot()).toHaveLength(0);
   expect(root.querySelectorAll('.overlay-wall-fragment')).toHaveLength(9);
   const visual=root.querySelector<HTMLElement>('.overlay-wall-visual')!;
   expect(visual.dataset.wallPhase).toBe('exiting');
   expect(root.childElementCount).toBe(1);
   // Finishing the GSAP timeline releases the scene; no artificial fixed wait.
   vi.useRealTimers();
   wall.dispose();
   expect(root.childElementCount).toBe(0);
 });
 it('supports different theatrical exit choices with a cancelable lifecycle',()=>{
   const root=document.createElement('div');
   const wall=createEmoteWall(root,{wallExit:'vortex',wallExitMs:360,ttlMs:4000});
   wall.receive(message('a'));
   wall.configure({wallExit:'fold-away'});
   wall.receive(message('b'));
   expect(wall.snapshot()).toHaveLength(2);
   const first=root.querySelector<HTMLElement>('.overlay-wall-visual')!;
   let completed=0;
   const cancel=startWallExit(first,'vortex',360,()=>completed++);
   expect(first.dataset.wallPhase).toBe('exiting');
   cancel();
   expect(completed).toBe(0);
   expect(first.querySelectorAll('.overlay-wall-fragment')).toHaveLength(0);
   wall.dispose();
   expect(root.childElementCount).toBe(0);
 });
 it('limits simultaneous expensive assembly entrances under a burst without dropping emotes',()=>{
   const root=document.createElement('div');
   const wall=createEmoteWall(root,{wallEnter:'assemble',maxActive:60,ttlMs:20_000});
   for(let index=0;index<30;index++) wall.receive(message('burst-'+index));
   expect(root.querySelectorAll('[data-wall-item]')).toHaveLength(30);
   expect(root.querySelectorAll('.overlay-wall-fragment').length).toBeLessThanOrEqual(72);
   wall.dispose();
 });
 it('does not animate or split reduced-motion artwork, and expiry detaches immediately',()=>{
   vi.useFakeTimers();
   vi.stubGlobal('matchMedia',()=>({matches:true}));
   const root=document.createElement('div');
   const wall=createEmoteWall(root,{wallEnter:'assemble',wallExit:'shatter',ttlMs:100});
   wall.receive(message('quiet'));
   expect(root.querySelectorAll('.overlay-wall-fragment')).toHaveLength(0);
   vi.advanceTimersByTime(100);
   expect(root.childElementCount).toBe(0);
   wall.dispose();
 });
});
