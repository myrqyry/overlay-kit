import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmoteWall } from '../src/views';
import { DEFAULT_OPTIONS, normalizeOptions, readOptions, writeOptions } from '../src/options';
import { createConstellationField, integrateField, type FieldPoint } from '../src/wall-constellation';
import type { DisplayMessage } from '../src/chatbus';

const packet=(id:string):DisplayMessage=>({
 id,timestamp:1700,user:{name:'Viewer',badges:[]},
 parts:[{type:'emote',emote:{id,code:id,url:'/art.png',
   overlays:[{code:'hat',url:'/hat.png'}],modifiers:[]}}],
});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
// jsdom has no raster canvas; Chromium integration verifies actual lines.
beforeEach(()=>{ vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null); });

describe('experimental wall choreography',()=>{
 it('round-trips real effects only in the wall settings',()=>{
   const settings=normalizeOptions({...DEFAULT_OPTIONS,wallEnter:'echo-print',wallField:'constellation'});
   const qs=writeOptions(settings,'wall');
   expect(qs).toContain('wallEnter=echo-print');
   expect(qs).toContain('wallField=constellation');
   expect(readOptions('?'+qs,'wall')).toMatchObject({wallEnter:'echo-print',wallField:'constellation'});
   expect(writeOptions(settings,'chat')).not.toContain('wallField');
 });
 it('echo print creates real artwork copies and destroys its timeline on removal',()=>{
   const root=document.createElement('div');
   const wall=createEmoteWall(root,{wallEnter:'echo-print',ttlMs:60_000});
   wall.receive(packet('one'));
   const visual=root.querySelector('.overlay-wall-visual')!;
   expect(visual.querySelectorAll('.overlay-wall-echo')).toHaveLength(3);
   expect(visual.querySelectorAll('.overlay-wall-echo img')).toHaveLength(6);
   expect(root.querySelectorAll('[data-overlay-layer]')).toHaveLength(4);
   wall.removeMessage('one');
   expect(root.querySelectorAll('.overlay-wall-echo')).toHaveLength(0);
   expect(root.childElementCount).toBe(0);
   wall.dispose();
 });
 it('caps simultaneous GSAP artwork echoes during chat bursts without dropping emotes',()=>{
   const root=document.createElement('div');
   const wall=createEmoteWall(root,{wallEnter:'echo-print',maxActive:60});
   for(let index=0;index<30;index++) wall.receive(packet('burst-'+index));
   expect(root.querySelectorAll('[data-wall-item]')).toHaveLength(30);
   expect(root.querySelectorAll('.overlay-wall-echo').length).toBeLessThanOrEqual(36);
   expect(root.querySelectorAll('.overlay-wall-echo').length).toBeGreaterThan(0);
   wall.dispose();
   expect(root.childElementCount).toBe(0);
 });

 it('constellation tracks arrivals, draws a shared canvas and cleans it when disabled',()=>{
   const root=document.createElement('div');
   const wall=createEmoteWall(root,{motion:'orbit',wallField:'constellation',maxActive:3});
   wall.receive(packet('one'));
   wall.receive(packet('two'));
   expect(root.querySelectorAll('canvas.overlay-wall-constellation')).toHaveLength(1);
   expect(root.querySelectorAll('[data-wall-item]')).toHaveLength(2);
   expect(root.querySelectorAll('[data-motion="still"]')).toHaveLength(2);
   wall.configure({wallField:'none'});
   expect(root.querySelector('canvas.overlay-wall-constellation')).toBeNull();
   expect(root.querySelectorAll('[data-motion="orbit"]')).toHaveLength(2);
   wall.configure({wallField:'constellation'});
   expect(root.querySelectorAll('canvas.overlay-wall-constellation')).toHaveLength(1);
   wall.dispose();
   expect(root.childElementCount).toBe(0);
 });
 it('field repulsion nudges close particles but keeps distant particles nearly still',()=>{
   const points: FieldPoint[]=[
     {id:'a',x:0,y:0,vx:0,vy:0,anchorX:0,anchorY:0},
     {id:'b',x:10,y:0,vx:0,vy:0,anchorX:10,anchorY:0},
     {id:'c',x:500,y:0,vx:0,vy:0,anchorX:500,anchorY:0},
   ];
   integrateField(points,1/30);
   expect(points[0]!.vx).toBeLessThan(0);
   expect(points[1]!.vx).toBeGreaterThan(0);
   expect(Math.abs(points[2]!.vx)).toBeLessThan(.001);
 });
 it('field step uses cached anchors with no DOM reads per animation frame',()=>{
   const root=document.createElement('div');
   const read=vi.spyOn(HTMLElement.prototype,'getBoundingClientRect');
   const field=createConstellationField(root);
   const element=document.createElement('div');
   field.track('one',element);
   field.anchor('one',100,120,50,50);
   read.mockClear();
   field.step(1/30);
   field.step(1/30);
   expect(read).not.toHaveBeenCalled();
   field.dispose();
   expect(root.childElementCount).toBe(0);
 });
 it('no constellation or echo animations start in the default wall',()=>{
   const root=document.createElement('div');
   const wall=createEmoteWall(root,{});
   wall.receive(packet('one'));
   expect(root.querySelector('canvas')).toBeNull();
   expect(root.querySelectorAll('.overlay-wall-echo')).toHaveLength(0);
   wall.dispose();
 });
});
